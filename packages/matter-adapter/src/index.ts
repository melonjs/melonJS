import * as Matter from "matter-js";
// @ts-expect-error — poly-decomp has no published types; only used to
// register a global decomposer with matter-js below.
import * as decomp from "poly-decomp";

// Matter.js calls `decomp` internally via `Common.setDecomp(...)` to
// break concave polygons (common in Tiled collision groups) into convex
// pieces. Registering it once up-front saves users from having to wire
// the global themselves.
Matter.Common.setDecomp(decomp);

import {
	type AdapterCapabilities,
	type BodyDefinition,
	type BodyShape,
	type Bounds,
	Ellipse,
	version as melonjsVersion,
	type PhysicsAdapter,
	type PhysicsBody,
	Polygon,
	type RaycastHit,
	Rect,
	type Renderable,
	state,
	utils,
	Vector2d,
	type World,
} from "melonjs";

declare const __VERSION__: string;

/**
 * Minimum melonJS version this adapter requires. The PhysicsAdapter
 * interface, `bodyDef` auto-registration, and the resolver in
 * `Application` are part of the 19.5 work — older releases don't have
 * the plumbing for instance-based adapters. Tracks the engine version
 * actually shipping these APIs (will be bumped to "19.5.0" once the
 * engine release is cut).
 */
export const REQUIRED_MELONJS_VERSION = "19.5.0";

/**
 * Options accepted by the {@link MatterAdapter} constructor.
 */
export interface MatterAdapterOptions {
	/** initial world gravity, default `{x: 0, y: 1}` (matter-js convention) */
	gravity?: { x: number; y: number };
	/**
	 * Number of physics substeps per engine frame. Each call to
	 * {@link MatterAdapter.step} runs `Engine.update(engine, dt / N)`
	 * `N` times instead of one full-dt step. Increases narrow-phase
	 * accuracy at high relative velocities (break shots, projectiles)
	 * at the cost of ~N× physics CPU. Default `1` matches the legacy
	 * single-step behaviour. Values < 1 are clamped to 1.
	 */
	subSteps?: number;
	/**
	 * raw matter-js engine options forwarded to `Matter.Engine.create()`.
	 * Use this to tweak solver iterations, constraint accuracy, etc.
	 */
	matterEngineOptions?: Matter.IEngineDefinition;
}

/**
 * melonJS physics adapter wrapping matter-js (https://brm.io/matter-js/).
 *
 * Implements the full {@link PhysicsAdapter} interface so the same game
 * code that runs on the built-in SAT physics also runs under Matter —
 * with the upgrade in capabilities Matter brings (real rotational
 * dynamics, restitution-based stacking, constraints, sleeping bodies,
 * native raycasts).
 * @example
 * import { Application } from "melonjs";
 * import { MatterAdapter } from "@melonjs/matter-adapter";
 *
 * const app = new Application(800, 600, {
 *     parent: "screen",
 *     physic: new MatterAdapter(),
 * });
 */
export class MatterAdapter implements PhysicsAdapter {
	readonly name = "@melonjs/matter-adapter";
	readonly version = __VERSION__;
	readonly url = "https://www.npmjs.com/package/@melonjs/matter-adapter";

	readonly capabilities: AdapterCapabilities = {
		constraints: true,
		continuousCollisionDetection: true,
		sleepingBodies: true,
		raycasts: true,
		velocityLimit: true,
		isGrounded: true,
	};

	gravity: Vector2d;

	/**
	 * Raw matter-js namespace — escape hatch for matter-specific features
	 * the portable `PhysicsAdapter` interface doesn't cover (constraints,
	 * compound bodies, events on the Matter engine, queries, etc.).
	 *
	 * Saves you from adding a transitive `import * as Matter from "matter-js"`
	 * just to reach the factories you need. The Matter modules are accessed
	 * by the same names matter's own docs use, so examples from the
	 * matter-js docs copy-paste without renaming:
	 *
	 * ```ts
	 * const spring = adapter.matter.Constraint.create({
	 *   bodyA: a.body, bodyB: b.body, stiffness: 0.04, length: 80,
	 * });
	 * adapter.matter.Composite.add(adapter.engine.world, spring);
	 * ```
	 *
	 * Game code that touches `adapter.matter.*` is matter-only — it will
	 * not work under any other physics adapter. Use the
	 * `PhysicsAdapter` methods for anything that should stay portable.
	 * @see {@link https://brm.io/matter-js/docs/ Official matter-js documentation}
	 * for the full module reference (`Matter.Constraint`, `Matter.Composite`,
	 * `Matter.Bodies`, `Matter.Events`, `Matter.Query`, `Matter.Vector`, …).
	 */
	readonly matter: typeof Matter = Matter;

	/** the underlying Matter engine; exposed for advanced use cases. */
	engine!: Matter.Engine;

	/** back-reference to the owning melonJS world (set in {@link init}). */
	world!: World;

	/** renderable → its matter-js body */
	private readonly bodyMap = new Map<Renderable, Matter.Body>();
	/** matter-js body → its renderable (for collision / sync) */
	private readonly renderableMap = new Map<Matter.Body, Renderable>();
	/** per-body velocity cap (Matter has no native equivalent) */
	private readonly velocityLimits = new Map<
		Renderable,
		{ x: number; y: number }
	>();
	/** per-body bodyDef hash kept for shape introspection / removeBody */
	private readonly defMap = new Map<Renderable, BodyDefinition>();
	/**
	 * Per-body gravity multiplier. matter-js 0.20 doesn't honor a
	 * body-level gravityScale, so we emulate it by applying a counter-
	 * force each step (see {@link init} `beforeUpdate`). Only stored for
	 * bodies with scale ≠ 1; the default-1 case is the hot path and we
	 * skip the map lookup entirely for it.
	 */
	private readonly bodyGravityScale = new Map<Matter.Body, number>();
	/**
	 * Offset between `renderable.pos` (top-left in melonJS convention)
	 * and `Matter.Body.position` (centroid in Matter's convention). Stored
	 * at addBody time so syncFromPhysics can place the sprite correctly.
	 */
	private readonly posOffsets = new Map<Renderable, { x: number; y: number }>();

	private readonly matterOptions: Matter.IEngineDefinition | undefined;

	private readonly subSteps: number;

	constructor(options: MatterAdapterOptions = {}) {
		// Mirror the BasePlugin version-check pattern: refuse to construct
		// against a melonJS that's too old to support the PhysicsAdapter
		// surface this adapter expects. Throwing here is loud and early —
		// the error names the required version so users know what to upgrade.
		if (utils.checkVersion(REQUIRED_MELONJS_VERSION, melonjsVersion) > 0) {
			throw new Error(
				`@melonjs/matter-adapter requires melonJS >= ${REQUIRED_MELONJS_VERSION}, ` +
					`but the loaded melonJS is ${melonjsVersion}.`,
			);
		}
		this.matterOptions = options.matterEngineOptions;
		this.subSteps = Math.max(1, Math.floor(options.subSteps ?? 1));
		// Default to matter-js native gravity: `(0, 1)` with the internal
		// `gravity.scale = 0.001`. This is intentionally NOT tuned to
		// match BuiltinAdapter's per-frame integration feel — the whole
		// point of running on Matter is to get Matter's real-physics
		// feel. Game code that wants legacy-style "fast arcade gravity"
		// should bump these values explicitly via the constructor option.
		const g = options.gravity ?? { x: 0, y: 1 };
		this.gravity = new Vector2d(g.x, g.y);
	}

	/**
	 * Stored references to the listeners registered in {@link init}, so
	 * {@link destroy} can `Matter.Events.off` them. Without these stored
	 * refs, a destroy/re-init cycle would leak the old listeners and
	 * dispatch every event twice on the second cycle.
	 */
	private _matterListeners: Array<{
		name: string;
		fn: (e: unknown) => void;
	}> = [];

	init(world: World): void {
		this.world = world;
		this.engine = Matter.Engine.create(this.matterOptions);
		// reflect our gravity vector onto the Matter engine
		this.engine.gravity.x = this.gravity.x;
		this.engine.gravity.y = this.gravity.y;
		// matter-js's internal `gravity.scale` defaults to 0.001 — left
		// untouched so this adapter behaves like a vanilla matter-js
		// engine. Game code that wants stronger gravity should pass a
		// larger `options.gravity` value, or mutate `adapter.gravity`
		// after construction.
		const on = (name: string, fn: (e: unknown) => void) => {
			Matter.Events.on(
				this.engine,
				name,
				fn as Parameters<typeof Matter.Events.on>[2],
			);
			this._matterListeners.push({ name, fn });
		};
		// Emulate per-body gravityScale: matter-js 0.20 only honors the
		// engine-level `gravity.scale`, so we add a counter-force to each
		// non-default-scale body before integration. Net effect after
		// matter's own gravity step = mass * gravity * scale * gravityScale.
		on("beforeUpdate", () => {
			if (this.bodyGravityScale.size === 0) return;
			const gx = this.engine.gravity.x;
			const gy = this.engine.gravity.y;
			const gs = (this.engine.gravity as { scale?: number }).scale ?? 0.001;
			for (const [body, scale] of this.bodyGravityScale) {
				if (body.isStatic || body.isSleeping) continue;
				const k = (scale - 1) * body.mass * gs;
				body.force.x += k * gx;
				body.force.y += k * gy;
			}
		});
		// after each step, clamp velocities to maxVelocity (Matter has no
		// native cap) and copy positions back to the renderables
		on("afterUpdate", () => {
			this._clampVelocities();
			this.syncFromPhysics();
		});
		// Route matter's three collision events to the renderable hooks.
		// `onCollision` is the legacy alias — same firing as `onCollisionStart`
		// (one-shot when contact begins). For frame-by-frame "still in contact"
		// semantics use `onCollisionActive`; for "contact just broke" use
		// `onCollisionEnd`.
		on("collisionStart", (e) => {
			this._dispatchCollisions((e as { pairs: Matter.Pair[] }).pairs, "start");
		});
		on("collisionActive", (e) => {
			this._dispatchCollisions((e as { pairs: Matter.Pair[] }).pairs, "active");
		});
		on("collisionEnd", (e) => {
			this._dispatchCollisions((e as { pairs: Matter.Pair[] }).pairs, "end");
		});
	}

	destroy(): void {
		// Unregister listeners first so any matter events fired during the
		// teardown don't re-enter our dispatchers with already-cleared state.
		for (const { name, fn } of this._matterListeners) {
			Matter.Events.off(
				this.engine,
				name,
				fn as Parameters<typeof Matter.Events.off>[2],
			);
		}
		this._matterListeners = [];
		Matter.Composite.clear(this.engine.world, false, true);
		Matter.Engine.clear(this.engine);
		this.bodyMap.clear();
		this.renderableMap.clear();
		this.velocityLimits.clear();
		this.defMap.clear();
		this.bodyGravityScale.clear();
		this.posOffsets.clear();
	}

	step(dt: number): void {
		// Mirror BuiltinAdapter's pause behavior: when the engine is
		// paused (browser loses focus, state.pause(), etc.) skip the
		// physics step entirely. Matter has no per-body pause control,
		// so we pause the whole simulation rather than individual bodies
		// — bodies with `updateWhenPaused = true` are not preserved here,
		// which is a documented difference from BuiltinAdapter.
		if (state.isPaused()) {
			return;
		}
		// mirror gravity (user may have mutated this.gravity since init)
		this.engine.gravity.x = this.gravity.x;
		this.engine.gravity.y = this.gravity.y;
		// matter-js takes delta in ms — exactly what World.update passes.
		// Substepping: run N engine ticks of `dt/N` instead of one of `dt`.
		// The narrow phase is discrete (no swept tests), so a body moving
		// faster than ~1 radius per tick can tunnel through another body
		// or a thin wall. Smaller per-tick deltas keep the inter-body
		// motion under that threshold; default `subSteps=1` reproduces
		// the previous single-step behaviour exactly.
		if (this.subSteps === 1) {
			Matter.Engine.update(this.engine, dt);
		} else {
			const sub = dt / this.subSteps;
			for (let i = 0; i < this.subSteps; i++) {
				Matter.Engine.update(this.engine, sub);
			}
		}
	}

	syncFromPhysics(): void {
		for (const [body, renderable] of this.renderableMap) {
			// Renderables can be destroyed mid-step (level reset, pool
			// recycle, removeChild) — their pooled `pos` vector gets
			// released and becomes undefined, but the body may still be
			// in matter's engine for one more frame. Skip those instead
			// of crashing; the body will be unregistered shortly.
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: pos is typed non-null but the pool releases it on recycle
			if (!renderable.pos) {
				continue;
			}
			// melonJS renderable.pos is top-left (anchor 0,0 default);
			// Matter body.position is the centroid. Apply the stored
			// offset to translate back into renderable space.
			const off = this.posOffsets.get(renderable);
			if (off) {
				renderable.pos.x = body.position.x + off.x;
				renderable.pos.y = body.position.y + off.y;
			} else {
				renderable.pos.x = body.position.x;
				renderable.pos.y = body.position.y;
			}
			// Mirror body angle onto the renderable's transform. melonJS
			// renderables expose `currentTransform` as a Matrix3d.
			// `Renderable.preDraw` applies the transform with the pivot at
			// `renderable.pos`, but matter rotates the body around its
			// centroid. For renderables whose `pos` is the top-left
			// (anchor 0,0) with a body shape centered inside the bounds,
			// the two pivots differ by `-posOffset` — rotating around
			// `pos` would spin the sprite around its corner. Pre-translate
			// by the centroid-relative offset so the rotation lands on
			// the visible center regardless of anchor.
			const t = (
				renderable as {
					currentTransform?: {
						identity?: () => unknown;
						rotate?: (a: number) => unknown;
						translate?: (x: number, y: number) => unknown;
					};
				}
			).currentTransform;
			if (
				t &&
				typeof t.identity === "function" &&
				typeof t.rotate === "function" &&
				typeof t.translate === "function"
			) {
				const off2 = this.posOffsets.get(renderable);
				const cx = off2 ? -off2.x : 0;
				const cy = off2 ? -off2.y : 0;
				t.identity();
				if (cx !== 0 || cy !== 0) {
					t.translate(cx, cy);
					t.rotate(body.angle);
					t.translate(-cx, -cy);
				} else {
					t.rotate(body.angle);
				}
			}
		}
	}

	addBody(renderable: Renderable, def: BodyDefinition): MatterAdapter.Body {
		// translate shapes into matter bodies. Multi-shape defs become a
		// matter compound body (Matter.Body.create with parts).
		const baseX = renderable.pos.x;
		const baseY = renderable.pos.y;
		const parts = def.shapes.map((s) => this._shapeToMatter(s, baseX, baseY));
		let body: Matter.Body;
		if (parts.length === 1) {
			body = parts[0];
		} else {
			body = Matter.Body.create({ parts });
		}

		// apply portable BodyDefinition fields onto the matter body
		if (def.type === "static") {
			Matter.Body.setStatic(body, true);
		}
		if (typeof def.density === "number") {
			Matter.Body.setDensity(body, def.density);
		}
		if (def.frictionAir !== undefined) {
			// Matter only supports scalar frictionAir; melonJS defs can be
			// {x, y} — average the two so the simulation feels close even
			// when the user passes per-axis values (rare).
			body.frictionAir =
				typeof def.frictionAir === "number"
					? def.frictionAir
					: (def.frictionAir.x + def.frictionAir.y) / 2;
		}
		if (typeof def.restitution === "number") {
			body.restitution = def.restitution;
		}
		if (typeof def.friction === "number") {
			body.friction = def.friction;
		}
		if (typeof def.gravityScale === "number" && def.gravityScale !== 1) {
			// matter-js 0.20 has no per-body gravityScale — store it and
			// apply a counter-force each step in the beforeUpdate handler.
			this.bodyGravityScale.set(body, def.gravityScale);
		}
		if (def.maxVelocity) {
			this.velocityLimits.set(renderable, {
				x: def.maxVelocity.x,
				y: def.maxVelocity.y,
			});
		}
		// Install live getter/setter aliases so the matter-native form
		// (`body.collisionFilter.category` / `body.collisionFilter.mask`)
		// and the legacy melonJS form (`body.collisionType` /
		// `body.collisionMask`) read and write the same underlying state.
		// Either API works; matter users don't have to learn melonJS's
		// names, and legacy melonJS handlers don't have to know about
		// collisionFilter.
		Object.defineProperties(body, {
			collisionType: {
				get(this: Matter.Body) {
					return this.collisionFilter.category;
				},
				set(this: Matter.Body, v: number) {
					this.collisionFilter.category = v;
				},
				configurable: true,
				enumerable: true,
			},
			collisionMask: {
				get(this: Matter.Body) {
					return this.collisionFilter.mask;
				},
				set(this: Matter.Body, v: number) {
					this.collisionFilter.mask = v;
				},
				configurable: true,
				enumerable: true,
			},
		});
		if (typeof def.collisionType === "number") {
			body.collisionFilter.category = def.collisionType;
		}
		if (typeof def.collisionMask === "number") {
			body.collisionFilter.mask = def.collisionMask;
		}
		if (def.isSensor) {
			body.isSensor = true;
		}
		// Default to fixed rotation. Matter has full rotational dynamics
		// while SAT didn't; existing platformer-style game code assumes
		// bodies stay axis-aligned. Users that genuinely want rotation
		// (a rolling barrel, a rag-doll, etc.) opt out via
		// `fixedRotation: false`.
		if (def.fixedRotation !== false) {
			Matter.Body.setInertia(body, Number.POSITIVE_INFINITY);
		}

		Matter.Composite.add(this.engine.world, body);
		this.bodyMap.set(renderable, body);
		this.renderableMap.set(body, renderable);
		this.defMap.set(renderable, def);
		// Track the offset between renderable.pos (top-left) and the
		// matter body's centroid so syncFromPhysics places the sprite
		// correctly.
		this.posOffsets.set(renderable, {
			x: baseX - body.position.x,
			y: baseY - body.position.y,
		});
		// Debug-plugin compatibility is provided via the adapter-side
		// `getBodyAABB` / `getBodyShapes` methods (see below). No
		// foreign methods are attached to the matter Body itself — it
		// stays a pure `Matter.Body`, with adapter-owned coordinate-
		// system translation living on the adapter where it belongs.
		// melonJS Body convention: attach legacy-shaped helper methods so
		// `renderable.body.setVelocity(x, y)` / `applyForce(x, y)` etc.
		// work identically under either adapter. The body is still a real
		// `Matter.Body` — these are additive convenience methods that
		// delegate to matter's free functions. Users who want raw matter
		// access can keep calling `Matter.Body.setVelocity(body, v)`.
		//
		// `helpers` is typed as the portable {@link PhysicsBody} interface
		// (minus the `collisionType`/`collisionMask` data fields, which
		// are installed as live getter/setter aliases on the body itself
		// just below). If a method is added to or removed from PhysicsBody
		// in melonJS, this object fails to type-check until updated —
		// keeps the matter helpers in lockstep with the portable contract.
		const helpers: Omit<PhysicsBody, "collisionType" | "collisionMask"> = {
			setVelocity(x: number, y: number) {
				Matter.Body.setVelocity(body, { x, y });
			},
			getVelocity(out?: Vector2d): Vector2d {
				return (out ?? new Vector2d()).set(body.velocity.x, body.velocity.y);
			},
			applyForce(x: number, y: number, pointX?: number, pointY?: number) {
				// Matter's `applyForce` is inherently lever-arm-aware: a
				// force applied at a point != centroid generates a torque
				// automatically as part of matter's integration. Pass the
				// point through when provided, otherwise default to the
				// body's centroid (pure linear, matching the 2-arg call).
				const point =
					typeof pointX === "number" && typeof pointY === "number"
						? { x: pointX, y: pointY }
						: body.position;
				Matter.Body.applyForce(body, point, { x, y });
			},
			applyImpulse(x: number, y: number) {
				// matter has no applyImpulse — convert via dv = J / m
				const invMass = body.mass > 0 ? 1 / body.mass : 0;
				Matter.Body.setVelocity(body, {
					x: body.velocity.x + x * invMass,
					y: body.velocity.y + y * invMass,
				});
			},
			setSensor(isSensor = true) {
				body.isSensor = isSensor;
			},
			setStatic(isStatic = true) {
				Matter.Body.setStatic(body, isStatic);
			},
			setCollisionMask(mask: number) {
				// `body.collisionMask` is a live alias of
				// `body.collisionFilter.mask` (see the property descriptor
				// installed below), so writing either form propagates.
				body.collisionFilter.mask = mask;
			},
			setCollisionType(type: number) {
				body.collisionFilter.category = type;
			},
			setMass: (m: number) => {
				Matter.Body.setMass(body, m);
			},
			setBounce(r: number) {
				// matter's body property is `restitution`; expose `setBounce`
				// to match the legacy melonJS API while writing the
				// matter-native field.
				body.restitution = r;
			},
			setGravityScale: (scale: number) => {
				// matter-js 0.20 has no native per-body gravity scale —
				// the adapter emulates it via `bodyGravityScale` map +
				// per-frame counter-force. Update the map directly here.
				if (scale === 1) {
					this.bodyGravityScale.delete(body);
				} else {
					this.bodyGravityScale.set(body, scale);
				}
			},
			setAngularVelocity(omega: number) {
				Matter.Body.setAngularVelocity(body, omega);
			},
			getAngularVelocity(): number {
				return body.angularVelocity;
			},
			setAngle(rad: number) {
				Matter.Body.setAngle(body, rad);
			},
			getAngle(): number {
				return body.angle;
			},
			applyTorque(t: number) {
				// matter-js accumulates `body.torque` for the next step;
				// adding to it is the documented way to apply an angular
				// impulse without going through the force/lever-arm path.
				body.torque += t;
			},
		};
		Object.assign(body, helpers);
		// After Object.assign the runtime body satisfies both the
		// matter-js `Body` interface AND the portable `PhysicsBody`
		// (plus the live `collisionType` / `collisionMask` aliases
		// installed via Object.defineProperties above). TypeScript can't
		// see the spliced helpers, so cast explicitly — this is the one
		// spot where the adapter promises the body conforms to its
		// published `MatterAdapter.Body` type.
		const adapterBody = body as MatterAdapter.Body;
		// Convention: `renderable.body` is the adapter's body handle.
		// Stored as the portable `PhysicsBody` on the Renderable; matter-
		// specific code casts to `MatterAdapter.Body` to reach native
		// fields (frictionAir, angle, …).
		renderable.body = adapterBody;
		return adapterBody;
	}

	removeBody(renderable: Renderable): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			Matter.Composite.remove(this.engine.world, body);
			this.bodyMap.delete(renderable);
			this.renderableMap.delete(body);
			this.velocityLimits.delete(renderable);
			this.defMap.delete(renderable);
			this.posOffsets.delete(renderable);
			this.bodyGravityScale.delete(body);
		}
	}

	updateShape(renderable: Renderable, shapes: BodyShape[]): void {
		// matter-js doesn't support live shape mutation cleanly — the
		// pragmatic approach is to rebuild the body. Preserve the prior
		// def, swap shapes, re-register — AND carry forward the velocity
		// state (linear + angular) so a moving body whose shape changes
		// mid-flight doesn't stop dead.
		const oldDef = this.defMap.get(renderable);
		if (!oldDef) {
			return;
		}
		const oldBody = this.bodyMap.get(renderable);
		const savedVel = oldBody
			? { x: oldBody.velocity.x, y: oldBody.velocity.y }
			: undefined;
		const savedAngVel = oldBody?.angularVelocity ?? 0;
		this.removeBody(renderable);
		const newBody = this.addBody(renderable, { ...oldDef, shapes });
		if (savedVel) {
			Matter.Body.setVelocity(newBody, savedVel);
			Matter.Body.setAngularVelocity(newBody, savedAngVel);
		}
	}

	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		const body = this.bodyMap.get(renderable);
		const target = out ?? new Vector2d();
		if (body) {
			return target.set(body.velocity.x, body.velocity.y);
		}
		return target.set(0, 0);
	}

	setVelocity(renderable: Renderable, v: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			Matter.Body.setVelocity(body, { x: v.x, y: v.y });
		}
	}

	applyForce(renderable: Renderable, force: Vector2d, point?: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		// True Newtonian force application — Matter integrates this as
		// `force / mass * dt²` per step. Game code that wants the legacy
		// "set velocity to this value each frame" pattern (what
		// BuiltinAdapter's force-accumulator gave you under the hood)
		// should use `setVelocity` instead.
		Matter.Body.applyForce(body, point ?? body.position, {
			x: force.x,
			y: force.y,
		});
	}

	applyImpulse(renderable: Renderable, impulse: Vector2d): void {
		// Matter has no applyImpulse — convert via dv = J / m and update vel.
		// (interface `point?` is accepted in the call site but matter has no
		// off-center impulse equivalent, so we ignore it.)
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		const invMass = body.mass > 0 ? 1 / body.mass : 0;
		Matter.Body.setVelocity(body, {
			x: body.velocity.x + impulse.x * invMass,
			y: body.velocity.y + impulse.y * invMass,
		});
	}

	setPosition(renderable: Renderable, p: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			// `p` is in renderable.pos space (typically top-left). Matter's
			// body.position is the centroid — convert via the offset stored
			// at addBody time so syncFromPhysics keeps renderable.pos at the
			// requested value.
			const off = this.posOffsets.get(renderable);
			Matter.Body.setPosition(body, {
				x: p.x - (off?.x ?? 0),
				y: p.y - (off?.y ?? 0),
			});
		}
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
	}

	setAngle(renderable: Renderable, angle: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			Matter.Body.setAngle(body, angle);
		}
	}

	getAngle(renderable: Renderable): number {
		const body = this.bodyMap.get(renderable);
		return body ? body.angle : 0;
	}

	setAngularVelocity(renderable: Renderable, omega: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			Matter.Body.setAngularVelocity(body, omega);
		}
	}

	getAngularVelocity(renderable: Renderable): number {
		const body = this.bodyMap.get(renderable);
		return body ? body.angularVelocity : 0;
	}

	applyTorque(renderable: Renderable, torque: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.torque += torque;
		}
	}

	setStatic(renderable: Renderable, isStatic: boolean): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			Matter.Body.setStatic(body, isStatic);
		}
	}

	setGravityScale(renderable: Renderable, scale: number): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		// matter-js 0.20 doesn't read body.gravityScale — track our own
		// counter-force map (cleared on scale=1 to keep the hot path fast).
		if (scale === 1) {
			this.bodyGravityScale.delete(body);
		} else {
			this.bodyGravityScale.set(body, scale);
		}
	}

	setSensor(renderable: Renderable, isSensor: boolean): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.isSensor = isSensor;
		}
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.frictionAir =
				typeof friction === "number" ? friction : (friction.x + friction.y) / 2;
		}
	}

	setMaxVelocity(
		renderable: Renderable,
		limit: { x: number; y: number },
	): void {
		this.velocityLimits.set(renderable, { x: limit.x, y: limit.y });
	}

	getMaxVelocity(renderable: Renderable): { x: number; y: number } {
		return this.velocityLimits.get(renderable) ?? { x: 0, y: 0 };
	}

	setCollisionType(renderable: Renderable, type: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			// either name works (alias installed in addBody); the matter-
			// native one is the canonical write
			body.collisionFilter.category = type;
		}
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.collisionFilter.mask = mask;
		}
	}

	/**
	 * Adapter-side debug surface: the body's AABB in renderable-local
	 * coordinates. Matter tracks `body.bounds` in WORLD space; we
	 * subtract `renderable.pos` so the result matches melonJS's local-
	 * space convention (the debug plugin translates to the renderable
	 * origin before drawing, and would otherwise see the bounds drawn
	 * offset by the renderable's world position).
	 */
	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined {
		const body = this.bodyMap.get(renderable);
		if (!body) return undefined;
		const b = body.bounds;
		const rp = renderable.pos;
		out.setMinMax(
			b.min.x - rp.x,
			b.min.y - rp.y,
			b.max.x - rp.x,
			b.max.y - rp.y,
		);
		return out;
	}

	/**
	 * Adapter-side debug surface: the body's collision shapes in
	 * renderable-local coordinates. We return the original `def.shapes`
	 * array — those are the input shape definitions in local space,
	 * unchanged by matter's body transformation (rotation is baked into
	 * matter's vertices, not into our local-space defs). Read-only.
	 */
	getBodyShapes(renderable: Renderable): readonly BodyShape[] {
		return this.defMap.get(renderable)?.shapes ?? [];
	}

	isGrounded(renderable: Renderable): boolean {
		const body = this.bodyMap.get(renderable);
		if (!body) return false;
		// "Grounded" = at least one active contact with a body whose center
		// is below us. Matter's `pair.collision.normal` direction depends
		// on which body was the SAT reference (it's not stably "from A to
		// B"), so comparing the other body's vertical position is more
		// robust than reading the normal sign.
		for (const pair of this.engine.pairs.list) {
			if (!pair.isActive) continue;
			const isA = pair.bodyA === body;
			const isB = pair.bodyB === body;
			if (!isA && !isB) continue;
			const other = isA ? pair.bodyB : pair.bodyA;
			if (other.position.y > body.position.y) {
				return true;
			}
		}
		return false;
	}

	raycast(from: Vector2d, to: Vector2d): RaycastHit | null {
		const bodies = Matter.Composite.allBodies(this.engine.world);
		const collisions = Matter.Query.ray(bodies, from, to);
		if (collisions.length === 0) return null;
		const c = collisions[0];
		const hitBody = c.bodyA;
		const renderable = this.renderableMap.get(hitBody);
		if (!renderable) return null;
		// approximate hit point as the nearest body center along the ray
		// (Matter.Query.ray doesn't surface a precise hit point — for that
		// you'd need to do your own segment intersection per body)
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const segLen = Math.hypot(dx, dy);
		const fraction =
			segLen > 0
				? Math.hypot(hitBody.position.x - from.x, hitBody.position.y - from.y) /
					segLen
				: 0;
		return {
			renderable,
			point: new Vector2d(hitBody.position.x, hitBody.position.y),
			normal: new Vector2d(c.normal.x, c.normal.y),
			fraction: Math.min(1, Math.max(0, fraction)),
		};
	}

	queryAABB(rect: Rect): Renderable[] {
		const bodies = Matter.Composite.allBodies(this.engine.world);
		const matched = Matter.Query.region(bodies, {
			min: { x: rect.pos.x, y: rect.pos.y },
			max: { x: rect.pos.x + rect.width, y: rect.pos.y + rect.height },
		});
		const result: Renderable[] = [];
		for (const b of matched) {
			const r = this.renderableMap.get(b);
			if (r) result.push(r);
		}
		return result;
	}

	// ---------------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------------

	private _clampVelocities(): void {
		for (const [renderable, limit] of this.velocityLimits) {
			const body = this.bodyMap.get(renderable);
			if (!body) continue;
			const vx = Math.max(-limit.x, Math.min(limit.x, body.velocity.x));
			const vy = Math.max(-limit.y, Math.min(limit.y, body.velocity.y));
			if (vx !== body.velocity.x || vy !== body.velocity.y) {
				Matter.Body.setVelocity(body, { x: vx, y: vy });
			}
		}
	}

	private _dispatchCollisions(
		pairs: Matter.Pair[],
		phase: "start" | "active" | "end",
	): void {
		// Pick the single handler to dispatch for each side per pair.
		// The supersedes rule (modern `onCollisionActive` wins over legacy
		// `onCollision` when both are defined) is baked into the picker,
		// so the per-pair loop becomes a straight dispatch with no
		// skip-flag bookkeeping.
		//
		// `onCollision` is the legacy every-frame alias; legacy melonJS
		// SAT fires it every frame two bodies overlap, which maps to
		// matter's `collisionActive`. Routing it there preserves legacy
		// semantics for code that never migrated to the modern hooks.
		const methodForSide = (receiver: Renderable): string => {
			if (phase === "start") return "onCollisionStart";
			if (phase === "end") return "onCollisionEnd";
			// active: modern handler wins if defined, else fall back to legacy
			return typeof (receiver as Renderable & { onCollisionActive?: unknown })
				.onCollisionActive === "function"
				? "onCollisionActive"
				: "onCollision";
		};
		for (const pair of pairs) {
			const rA = this.renderableMap.get(pair.bodyA);
			const rB = this.renderableMap.get(pair.bodyB);
			if (!rA || !rB) continue;
			// Detachment handling. `ancestor === null` means the renderable
			// was attached to a container and later detached (removeChild,
			// mid-step level reload). `ancestor === undefined` means it was
			// never in a tree at all (unit tests adding bodies directly to
			// the adapter) — leave those alone.
			//
			// For START / ACTIVE phases: if either partner is detached the
			// pair is stale, skip the whole dispatch.
			//
			// For END phase: dispatch to whichever partner is still attached
			// — they want to know their neighbor just left. Skip only when
			// both are gone.
			const ancA = (rA as Renderable & { ancestor?: object | null }).ancestor;
			const ancB = (rB as Renderable & { ancestor?: object | null }).ancestor;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: ancestor is set to null by Container on removeChild; TS narrows it away on the cast
			const aDetached = ancA === null;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: ancestor is set to null by Container on removeChild; TS narrows it away on the cast
			const bDetached = ancB === null;
			if (phase === "end") {
				if (aDetached && bDetached) continue;
			} else if (aDetached || bDetached) {
				continue;
			}
			// Matter-native response shape passed to user handlers.
			//
			//   - `a` / `b` — receiver and partner renderables. We dispatch
			//     once per side, so each side sees itself as `a`.
			//   - `normal` — unit MTV (minimum translation vector) for the
			//     receiver. Direction `this` must move to separate from
			//     `other`. Matter's `pair.collision.normal` is already the
			//     MTV of `bodyA`; for the B-side dispatch we negate so each
			//     handler sees the normal from its own perspective.
			//       `normal.y < -0.7`  → push me up to escape  (I'm on top → stomp)
			//       `normal.y >  0.7`  → push me down to escape (I'm below → being stomped on)
			//   - `depth` — penetration depth (matter native name).
			//   - `pair` — raw `Matter.Pair`, exposed for advanced use
			//     (supports, tangent, body refs, etc.).
			const collision = pair.collision;
			const depth = collision.depth;
			const normal = collision.normal;
			const responseAB = {
				a: rA,
				b: rB,
				normal: { x: normal.x, y: normal.y },
				depth,
				pair,
			};
			const responseBA = {
				a: rB,
				b: rA,
				normal: { x: -normal.x, y: -normal.y },
				depth,
				pair,
			};
			if (!aDetached) {
				const mA = methodForSide(rA);
				const fnA = (rA as Renderable & Record<string, unknown>)[mA];
				if (typeof fnA === "function") {
					(fnA as (response: unknown, other: Renderable) => unknown).call(
						rA,
						responseAB,
						rB,
					);
				}
			}
			if (!bDetached) {
				const mB = methodForSide(rB);
				const fnB = (rB as Renderable & Record<string, unknown>)[mB];
				if (typeof fnB === "function") {
					(fnB as (response: unknown, other: Renderable) => unknown).call(
						rB,
						responseBA,
						rA,
					);
				}
			}
		}
	}

	private _shapeToMatter(
		shape: BodyShape,
		baseX: number,
		baseY: number,
	): Matter.Body {
		if (shape instanceof Rect) {
			// melonJS Rect: pos is top-left in shape-local space. Matter
			// rectangles are centered, so we shift by half-width/half-height.
			const w = shape.width;
			const h = shape.height;
			return Matter.Bodies.rectangle(
				baseX + shape.pos.x + w / 2,
				baseY + shape.pos.y + h / 2,
				w,
				h,
			);
		}
		if (shape instanceof Ellipse) {
			// Matter has no native ellipse — approximate as a circle with the
			// average radius. For tall/narrow ellipses this is a poor fit;
			// a future improvement could synthesize a polygon hull.
			const e = shape as unknown as {
				pos: { x: number; y: number };
				radiusV?: { x: number; y: number };
				radius?: number;
			};
			const rx = e.radiusV?.x ?? e.radius ?? 1;
			const ry = e.radiusV?.y ?? e.radius ?? 1;
			const radius = (rx + ry) / 2;
			return Matter.Bodies.circle(baseX + e.pos.x, baseY + e.pos.y, radius);
		}
		if (shape instanceof Polygon) {
			// translate polygon vertices into world-space, then let Matter
			// recompute its own center / vertex list
			const points = shape.points.map((p) => ({
				x: baseX + shape.pos.x + p.x,
				y: baseY + shape.pos.y + p.y,
			}));
			// average the points to get an initial center for Bodies.fromVertices
			const cx =
				points.reduce((s, p) => s + p.x, 0) / Math.max(1, points.length);
			const cy =
				points.reduce((s, p) => s + p.y, 0) / Math.max(1, points.length);
			const body = Matter.Bodies.fromVertices(cx, cy, [points]);
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: matter-js types claim non-null, but fromVertices returns undefined for degenerate polygons (collinear / zero-area)
			if (body) {
				return body;
			}
			// Bodies.fromVertices returns undefined when the vertices form
			// a degenerate (collinear, zero-area, etc.) polygon. Fall back
			// to an axis-aligned bounding box so the body still exists in
			// the simulation rather than disappearing silently.
			let minX = Number.POSITIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;
			for (const p of points) {
				if (p.x < minX) minX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.x > maxX) maxX = p.x;
				if (p.y > maxY) maxY = p.y;
			}
			const w = Math.max(1, maxX - minX);
			const h = Math.max(1, maxY - minY);
			return Matter.Bodies.rectangle(minX + w / 2, minY + h / 2, w, h);
		}
		throw new Error(
			`MatterAdapter: unsupported shape type ${
				(shape as { constructor: { name: string } }).constructor.name
			}`,
		);
	}
}

/**
 * Namespace-merged with the {@link MatterAdapter} class to expose
 * adapter-owned types alongside the runtime API. Access via
 * `MatterAdapter.Body`, etc.
 */
// biome-ignore lint/style/useNamingConvention: namespace must match the class it merges with
export namespace MatterAdapter {
	/**
	 * The concrete body handle attached to `renderable.body` under
	 * {@link MatterAdapter}. Combines the raw `Matter.Body` (with all
	 * native fields — `frictionAir`, `restitution`, `friction`, `angle`,
	 * `angularVelocity`, …) with the portable melonJS helper methods
	 * (`setVelocity`, `applyImpulse`, `setStatic`, etc.) spliced on at
	 * `addBody` time.
	 *
	 * Type it explicitly when reaching for matter-native fields:
	 *
	 * ```ts
	 * (this.body as MatterAdapter.Body).frictionAir = 0.02;
	 * ```
	 *
	 * Keeps user code free of a direct `matter-js` import — the matter
	 * dependency stays behind the adapter boundary.
	 */
	export type Body = ReturnType<typeof Matter.Body.create> & PhysicsBody;
}
