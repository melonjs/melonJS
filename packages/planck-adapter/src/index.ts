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
import * as planck from "planck";

declare const __VERSION__: string;

/**
 * Minimum melonJS version this adapter requires. The PhysicsAdapter
 * interface, `bodyDef` auto-registration, and the resolver in
 * `Application` are part of the 19.5 work — older releases don't have
 * the plumbing for instance-based adapters.
 */
export const REQUIRED_MELONJS_VERSION = "19.5.0";

/**
 * Options accepted by the {@link PlanckAdapter} constructor.
 */
export interface PlanckAdapterOptions {
	/**
	 * World gravity in **pixels per second²** (matches melonJS pixel-space
	 * convention). Default `{x: 0, y: 320}` ≈ 10 m/s² at
	 * `pixelsPerMeter = 32` — Earth-like gravity pulling down.
	 *
	 * Internally translated to meters by dividing by {@link pixelsPerMeter}
	 * before being applied to the planck world.
	 */
	gravity?: { x: number; y: number };
	/**
	 * Planck is a Box2D port and operates in **meters** internally; the
	 * adapter converts to/from melonJS's pixel-space at every boundary
	 * (positions, velocities, gravity, forces). Default `32` — i.e. one
	 * 32×32 sprite is one Box2D unit, which falls inside Box2D's tuned
	 * sweet spot (0.1 – 10 m).
	 *
	 * Bumping this makes the world feel "smaller" (objects act heavier);
	 * lowering makes everything feel "bigger" (and risks stability issues
	 * if bodies grow past Box2D's tuned scale).
	 */
	pixelsPerMeter?: number;
	/**
	 * Number of physics substeps per engine frame. Each call to
	 * {@link PlanckAdapter.step} runs `world.step(dt / N)` `N` times
	 * instead of one full-dt step. Increases narrow-phase accuracy at
	 * high relative velocities at the cost of ~N× physics CPU. Default
	 * `1`. Values < 1 are clamped to 1.
	 */
	subSteps?: number;
	/**
	 * Box2D solver iterations per step. The defaults are Box2D's
	 * recommended values; bump `position` for stiffer stacks (less
	 * jitter at the cost of CPU) or `velocity` for crisper restitution.
	 */
	velocityIterations?: number;
	positionIterations?: number;
}

/**
 * melonJS physics adapter wrapping planck.js (https://piqnt.com/planck.js/).
 *
 * Planck is a JavaScript/TypeScript port of Box2D 2.3.0 — a mature,
 * battle-tested rigid-body simulator with continuous collision detection,
 * sleeping bodies, and joint constraints. This adapter implements the
 * full {@link PhysicsAdapter} interface so the same game code that runs
 * on the built-in SAT physics also runs under planck — with the upgrade
 * in capabilities Box2D brings (CCD for fast-moving bodies, restitution-
 * based stacking, real rotational dynamics).
 *
 * Box2D operates in **meters / seconds / radians** internally. melonJS
 * stays in **pixels** for positions and **radians** for angles; the
 * adapter handles the spatial unit conversion through
 * {@link PlanckAdapterOptions.pixelsPerMeter} (default `32`). Times are
 * passed through directly (planck expects seconds, the adapter divides
 * the incoming millisecond `dt` by 1000).
 * @example
 * import { Application } from "melonjs";
 * import { PlanckAdapter } from "@melonjs/planck-adapter";
 *
 * const app = new Application(800, 600, {
 *     parent: "screen",
 *     physic: new PlanckAdapter(),
 * });
 */
export class PlanckAdapter implements PhysicsAdapter {
	readonly physicLabel = "planck";
	readonly name = "@melonjs/planck-adapter";
	readonly version = __VERSION__;
	readonly url = "https://www.npmjs.com/package/@melonjs/planck-adapter";

	readonly capabilities: AdapterCapabilities = {
		constraints: true,
		continuousCollisionDetection: true,
		sleepingBodies: true,
		raycasts: true,
		// Planck (Box2D) is 2D-only; no `raycast3d` method. User code
		// under Camera3d should run on the builtin adapter (or a
		// future 3D adapter) if it needs `world.adapter.raycast3d?(...)`.
		raycasts3d: false,
		velocityLimit: true,
		isGrounded: true,
	};

	gravity: Vector2d;

	/**
	 * Raw planck namespace — escape hatch for planck-specific features
	 * the portable {@link PhysicsAdapter} interface doesn't cover (joints,
	 * compound fixtures, native queries, etc.).
	 *
	 * Saves you from adding a transitive `import * as planck from "planck"`
	 * just to reach the factories you need:
	 *
	 * ```ts
	 * const joint = adapter.planck.RevoluteJoint(
	 *     { collideConnected: false },
	 *     a.body as PlanckAdapter.Body,
	 *     b.body as PlanckAdapter.Body,
	 *     adapter.planck.Vec2(0, 0),
	 * );
	 * adapter.world.createJoint(joint);
	 * ```
	 *
	 * Game code that touches `adapter.planck.*` is planck-only — it will
	 * not work under any other physics adapter. Use the
	 * {@link PhysicsAdapter} methods for anything that should stay
	 * portable.
	 * @see {@link https://piqnt.com/planck.js/docs/ Official planck.js documentation}
	 */
	readonly planck: typeof planck = planck;

	/** Spatial conversion factor between melonJS pixels and Box2D meters. */
	readonly pixelsPerMeter: number;

	/** The underlying planck world; exposed for advanced use cases. */
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- `planck.World` is also a deprecated factory function; the type annotation refers to the class, which is not deprecated
	world!: planck.World;

	/** Back-reference to the owning melonJS world (set in {@link init}). */
	melonWorld!: World;

	private readonly bodyMap = new Map<Renderable, planck.Body>();
	private readonly renderableMap = new Map<planck.Body, Renderable>();
	private readonly velocityLimits = new Map<
		Renderable,
		{ x: number; y: number }
	>();
	private readonly defMap = new Map<Renderable, BodyDefinition>();
	/**
	 * Offset between `renderable.pos` (top-left in melonJS convention)
	 * and `planck.Body.getPosition()` (the body anchor we register at,
	 * usually the visible center). Stored in pixels at addBody time so
	 * `syncFromPhysics` can place the sprite correctly.
	 */
	private readonly posOffsets = new Map<Renderable, { x: number; y: number }>();
	/**
	 * Saved reference to the body's native `applyForce` BEFORE we splice
	 * the portable helper of the same name. Adapter methods that need
	 * the raw `(Vec2, Vec2, wake)` signature look it up here — calling
	 * `body.applyForce(...)` after splicing would resolve to the helper,
	 * coerce the Vec2 args to NaN, and silently no-op.
	 */
	private readonly nativeApplyForce = new WeakMap<
		planck.Body,
		(force: planck.Vec2Value, point: planck.Vec2Value, wake?: boolean) => void
	>();

	private readonly subSteps: number;
	private readonly velocityIterations: number;
	private readonly positionIterations: number;

	constructor(options: PlanckAdapterOptions = {}) {
		// Mirror the BasePlugin version-check pattern: refuse to construct
		// against a melonJS that's too old to support the PhysicsAdapter
		// surface this adapter expects. Throwing here is loud and early —
		// the error names the required version so users know what to upgrade.
		if (utils.checkVersion(REQUIRED_MELONJS_VERSION, melonjsVersion) > 0) {
			throw new Error(
				`@melonjs/planck-adapter requires melonJS >= ${REQUIRED_MELONJS_VERSION}, ` +
					`but the loaded melonJS is ${melonjsVersion}.`,
			);
		}
		this.pixelsPerMeter = options.pixelsPerMeter ?? 32;
		this.subSteps = Math.max(1, Math.floor(options.subSteps ?? 1));
		this.velocityIterations = options.velocityIterations ?? 8;
		this.positionIterations = options.positionIterations ?? 3;
		// Default ≈ 10 m/s² at pixelsPerMeter=32 — Earth-feel gravity in
		// pixel space.
		const g = options.gravity ?? { x: 0, y: 320 };
		this.gravity = new Vector2d(g.x, g.y);
	}

	// -------------------------------------------------------------------
	// Unit conversion helpers (pixels ↔ meters)
	// -------------------------------------------------------------------

	/**
	 * pixels → meters
	 * @param px pixel value (melonJS pixel space)
	 */
	private px2m(px: number): number {
		return px / this.pixelsPerMeter;
	}

	/**
	 * meters → pixels
	 * @param m meter value (planck physics space)
	 */
	private m2px(m: number): number {
		return m * this.pixelsPerMeter;
	}

	// eslint-disable-next-line @typescript-eslint/no-deprecated -- `planck.Vec2` return type references the class (not the deprecated factory overload of the same name)
	private vec2InMeters(x: number, y: number): planck.Vec2 {
		return new planck.Vec2(this.px2m(x), this.px2m(y));
	}

	// -------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------

	init(world: World): void {
		this.melonWorld = world;
		this.world = new planck.World(
			this.vec2InMeters(this.gravity.x, this.gravity.y),
		);
		// Route planck's collision events to the renderable hooks. Box2D
		// fires begin-contact / end-contact discretely and continuously
		// reports active contacts via the contact list each step; we
		// dispatch START on begin-contact, END on end-contact, and ACTIVE
		// from a post-step pass over `world.getContactList()`.
		this.world.on("begin-contact", (contact: planck.Contact) => {
			this._dispatchContact(contact, "start");
		});
		this.world.on("end-contact", (contact: planck.Contact) => {
			this._dispatchContact(contact, "end");
		});
	}

	destroy(): void {
		// planck has no engine-level destroy; clear bodies + listeners and
		// drop references so GC can reclaim the world.
		for (let body = this.world.getBodyList(); body; ) {
			const next = body.getNext();
			this.world.destroyBody(body);
			body = next;
		}
		this.bodyMap.clear();
		this.renderableMap.clear();
		this.velocityLimits.clear();
		this.defMap.clear();
		this.posOffsets.clear();
	}

	step(dt: number): void {
		// Mirror BuiltinAdapter/MatterAdapter pause behavior: when the
		// engine is paused (browser loses focus, state.pause(), etc.)
		// skip the physics step entirely.
		if (state.isPaused()) {
			return;
		}
		// Mirror gravity (user may have mutated this.gravity since init).
		this.world.setGravity(this.vec2InMeters(this.gravity.x, this.gravity.y));
		// melonJS passes dt in ms; planck wants seconds. Substepping
		// matches the matter-adapter shape: N ticks of `dt/N` instead of
		// one full-dt step, for narrow-phase accuracy on fast bodies.
		const dtSeconds = dt / 1000;
		if (this.subSteps === 1) {
			this.world.step(
				dtSeconds,
				this.velocityIterations,
				this.positionIterations,
			);
		} else {
			const sub = dtSeconds / this.subSteps;
			for (let i = 0; i < this.subSteps; i++) {
				this.world.step(sub, this.velocityIterations, this.positionIterations);
			}
		}
		this._clampVelocities();
		this._dispatchActiveContacts();
	}

	syncFromPhysics(): void {
		for (const [body, renderable] of this.renderableMap) {
			// Renderables can be destroyed mid-step (level reset, pool
			// recycle, removeChild); skip those instead of crashing.
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: pos is typed non-null but the pool releases it on recycle
			if (!renderable.pos) {
				continue;
			}
			const p = body.getPosition();
			const px = this.m2px(p.x);
			const py = this.m2px(p.y);
			const off = this.posOffsets.get(renderable);
			if (off) {
				renderable.pos.x = px + off.x;
				renderable.pos.y = py + off.y;
			} else {
				renderable.pos.x = px;
				renderable.pos.y = py;
			}
			// Mirror body angle onto the renderable's transform. Same
			// centroid-relative rotation pivot as matter-adapter — planck
			// rotates around the body's anchor (which we set to the shape
			// centroid at addBody time), but `Renderable.preDraw` pivots
			// at `renderable.pos`. The difference is exactly `-posOffset`.
			const angle = body.getAngle();
			const t = renderable.currentTransform;
			const cx = off ? -off.x : 0;
			const cy = off ? -off.y : 0;
			t.identity();
			if (cx !== 0 || cy !== 0) {
				t.translate(cx, cy);
				t.rotate(angle);
				t.translate(-cx, -cy);
			} else {
				t.rotate(angle);
			}
		}
	}

	// -------------------------------------------------------------------
	// Body registration
	// -------------------------------------------------------------------

	addBody(renderable: Renderable, def: BodyDefinition): PlanckAdapter.Body {
		const baseX = renderable.pos.x;
		const baseY = renderable.pos.y;

		// Compute the shape centroid in renderable-local pixel space. We
		// register the body anchor at that centroid (in world meters), so
		// the rotation pivot matches melonJS's "rotate around centre"
		// expectation when the user opts into rotation.
		const centroid = this._computeCentroid(def.shapes);
		const bodyWorldPx = { x: baseX + centroid.x, y: baseY + centroid.y };

		const bodyDef: planck.BodyDef = {
			type: def.type,
			position: this.vec2InMeters(bodyWorldPx.x, bodyWorldPx.y),
			angle: 0,
			fixedRotation: def.fixedRotation !== false, // default true (mirrors matter-adapter)
			linearDamping: this._scalarOf(def.frictionAir) ?? 0,
			gravityScale: def.gravityScale ?? 1,
			bullet: false,
		};
		const body = this.world.createBody(bodyDef);

		// Attach each shape as a fixture, with vertices in body-local
		// meters (renderable-space shape position minus centroid, divided
		// by pixelsPerMeter).
		for (const shape of def.shapes) {
			const planckShape = this._shapeToPlanck(shape, centroid);
			if (!planckShape) continue;
			const fixtureDef: planck.FixtureOpt = {
				density: def.density ?? (def.type === "static" ? 0 : 1),
				friction: def.friction ?? 0.2,
				restitution: def.restitution ?? 0,
				isSensor: def.isSensor === true,
				// Bit 0 reserved by Box2D for "no filter set"; melonJS
				// collisionType/Mask map directly onto categoryBits/maskBits.
				filterCategoryBits:
					typeof def.collisionType === "number" ? def.collisionType : 0x0001,
				filterMaskBits:
					typeof def.collisionMask === "number" ? def.collisionMask : 0xffff,
			};
			body.createFixture(planckShape, fixtureDef);
		}

		// Box2D recomputes mass from fixtures when fixtures are added; for
		// dynamic bodies with zero-density (rare) the mass stays zero,
		// which Box2D treats as "infinite mass" — same as static. Force a
		// recompute so the user gets the expected dynamic behaviour.
		if (def.type === "dynamic") {
			body.resetMassData();
		}

		if (def.maxVelocity) {
			this.velocityLimits.set(renderable, {
				x: def.maxVelocity.x,
				y: def.maxVelocity.y,
			});
		}

		this.bodyMap.set(renderable, body);
		this.renderableMap.set(body, renderable);
		this.defMap.set(renderable, def);
		this.posOffsets.set(renderable, { x: -centroid.x, y: -centroid.y });

		// Helper methods spliced onto the planck body so user code can
		// write `renderable.body.setVelocity(x, y)` regardless of which
		// adapter is active. The body is still a real `planck.Body`.
		//
		// **Splicing rule:** only splice helpers whose name doesn't
		// already exist on `planck.Body` with the same signature. Methods
		// like `setAngularVelocity`, `getAngle`, `applyTorque`, and
		// `setGravityScale` are NATIVE on planck.Body with signatures
		// compatible with `PhysicsBody`; the native implementations
		// already satisfy the portable contract, so we leave them alone
		// and let TS see them via the `planck.Body` half of the
		// `PlanckAdapter.Body` intersection type. Splicing those would
		// shadow the native method AND recurse (`body.setAngularVelocity`
		// would call the helper, which would call `body.setAngularVelocity`,
		// …). Verified by `tests/planck-adapter.spec.ts`.
		//
		// `applyForce` IS spliced because its signature differs from the
		// native — the portable helper takes `(x, y, pointX?, pointY?)`
		// numbers while planck's native takes `(Vec2, Vec2, wake?)`. The
		// native is reachable via `body.applyForceToCenter(Vec2)` or by
		// casting `body as planck.Body` if a user needs the raw form.
		// Capture native applyForce reference so the spliced helper can
		// reach the real planck method without recursing. Also stored on
		// the adapter (in `nativeApplyForce`) so adapter-level methods
		// can reach the native signature too.
		const nativeApplyForce = body.applyForce.bind(body);
		this.nativeApplyForce.set(body, nativeApplyForce);
		// All helpers are arrow functions so `this` lexically refers to
		// the adapter (not the helpers object literal). Avoids the
		// `const self = this` aliasing pattern that no-this-alias forbids.
		const helpers: Omit<PhysicsBody, "collisionType" | "collisionMask"> = {
			setVelocity: (x: number, y: number) => {
				body.setLinearVelocity(this.vec2InMeters(x, y));
			},
			getVelocity: (out?: Vector2d): Vector2d => {
				const v = body.getLinearVelocity();
				return (out ?? new Vector2d()).set(this.m2px(v.x), this.m2px(v.y));
			},
			applyForce: (x: number, y: number, pointX?: number, pointY?: number) => {
				// Planck's native `applyForce(Vec2, Vec2, wake)` is
				// inherently lever-arm-aware: applying a force at a
				// point != body anchor generates a torque automatically.
				// Pass the point through when provided, otherwise use the
				// body anchor (pure linear, matching the 2-arg call).
				const point =
					typeof pointX === "number" && typeof pointY === "number"
						? this.vec2InMeters(pointX, pointY)
						: body.getPosition();
				nativeApplyForce(this.vec2InMeters(x, y), point, true);
			},
			applyImpulse: (x: number, y: number) => {
				body.applyLinearImpulse(
					this.vec2InMeters(x, y),
					body.getPosition(),
					true,
				);
			},
			setSensor: (isSensor = true) => {
				for (
					let fixture = body.getFixtureList();
					fixture;
					fixture = fixture.getNext()
				) {
					fixture.setSensor(isSensor);
				}
			},
			setStatic: (isStatic = true) => {
				body.setType(isStatic ? "static" : "dynamic");
			},
			setCollisionMask: (mask: number) => {
				for (
					let fixture = body.getFixtureList();
					fixture;
					fixture = fixture.getNext()
				) {
					fixture.setFilterMaskBits(mask);
				}
			},
			setCollisionType: (type: number) => {
				for (
					let fixture = body.getFixtureList();
					fixture;
					fixture = fixture.getNext()
				) {
					fixture.setFilterCategoryBits(type);
				}
			},
			/**
			 * Replace the body's mass while preserving center of mass +
			 * inertia. Used when game code needs a body to feel heavier
			 * or lighter without rebuilding it.
			 * @param m new mass value in kilograms
			 */
			setMass: (m: number) => {
				// planck.getMassData(out) fills the passed object in place
				// (Box2D's "scratch buffer" convention); allocate a fresh
				// MassData, read current mass/center/inertia, swap in the
				// new mass, then write back via setMassData.
				const data: planck.MassData = {
					center: new planck.Vec2(0, 0),
					mass: 0,
					I: 0,
				};
				body.getMassData(data);
				data.mass = m;
				body.setMassData(data);
			},
			setBounce: (r: number) => {
				for (
					let fixture = body.getFixtureList();
					fixture;
					fixture = fixture.getNext()
				) {
					fixture.setRestitution(r);
				}
			},
			// NOTE: `setGravityScale`, `setAngularVelocity`,
			// `getAngularVelocity`, `setAngle`, `getAngle`, and
			// `applyTorque` are deliberately NOT spliced — planck.Body
			// already provides them with compatible signatures, and the
			// PhysicsAdapter.Body intersection type surfaces them via the
			// `planck.Body` side of the intersection.
		};
		Object.assign(body, helpers);

		// Live getter/setter aliases for `collisionType` / `collisionMask`
		// that read and write the first fixture's filter bits. Each
		// fixture has its own filter in Box2D; we surface the body-wide
		// aliases here because user code expects single values. Writes
		// propagate to every fixture (see setCollisionType / setCollisionMask).
		Object.defineProperties(body, {
			collisionType: {
				get(this: planck.Body) {
					const f = this.getFixtureList();
					return f ? f.getFilterCategoryBits() : 0;
				},
				set(this: planck.Body, v: number) {
					for (
						let fixture = this.getFixtureList();
						fixture;
						fixture = fixture.getNext()
					) {
						fixture.setFilterCategoryBits(v);
					}
				},
				configurable: true,
				enumerable: true,
			},
			collisionMask: {
				get(this: planck.Body) {
					const f = this.getFixtureList();
					return f ? f.getFilterMaskBits() : 0;
				},
				set(this: planck.Body, v: number) {
					for (
						let fixture = this.getFixtureList();
						fixture;
						fixture = fixture.getNext()
					) {
						fixture.setFilterMaskBits(v);
					}
				},
				configurable: true,
				enumerable: true,
			},
		});

		const adapterBody = body as PlanckAdapter.Body;
		renderable.body = adapterBody;
		return adapterBody;
	}

	removeBody(renderable: Renderable): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			this.world.destroyBody(body);
			this.bodyMap.delete(renderable);
			this.renderableMap.delete(body);
			this.velocityLimits.delete(renderable);
			this.defMap.delete(renderable);
			this.posOffsets.delete(renderable);
		}
	}

	updateShape(renderable: Renderable, shapes: BodyShape[]): void {
		// Box2D doesn't support live shape mutation; rebuild the body and
		// carry forward linear + angular velocity state so a moving body
		// whose shape changes mid-flight doesn't stop dead.
		const oldDef = this.defMap.get(renderable);
		if (!oldDef) {
			return;
		}
		const oldBody = this.bodyMap.get(renderable);
		const savedVel = oldBody
			? { x: oldBody.getLinearVelocity().x, y: oldBody.getLinearVelocity().y }
			: undefined;
		const savedAngVel = oldBody?.getAngularVelocity() ?? 0;
		this.removeBody(renderable);
		const newBody = this.addBody(renderable, { ...oldDef, shapes });
		if (savedVel) {
			newBody.setLinearVelocity(new planck.Vec2(savedVel.x, savedVel.y));
			newBody.setAngularVelocity(savedAngVel);
		}
	}

	// -------------------------------------------------------------------
	// Portable velocity / force / position API
	// -------------------------------------------------------------------

	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		const body = this.bodyMap.get(renderable);
		const target = out ?? new Vector2d();
		if (body) {
			const v = body.getLinearVelocity();
			return target.set(this.m2px(v.x), this.m2px(v.y));
		}
		return target.set(0, 0);
	}

	setVelocity(renderable: Renderable, v: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.setLinearVelocity(this.vec2InMeters(v.x, v.y));
		}
	}

	applyForce(renderable: Renderable, force: Vector2d, point?: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		const p = point ? this.vec2InMeters(point.x, point.y) : body.getPosition();
		// `body.applyForce` is shadowed by the portable helper after
		// splice (takes numbers, not Vec2s); fall back to the saved
		// native reference for the raw planck (Vec2, Vec2, wake)
		// signature.
		this.nativeApplyForce.get(body)?.(
			this.vec2InMeters(force.x, force.y),
			p,
			true,
		);
	}

	applyImpulse(
		renderable: Renderable,
		impulse: Vector2d,
		point?: Vector2d,
	): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		const p = point ? this.vec2InMeters(point.x, point.y) : body.getPosition();
		body.applyLinearImpulse(this.vec2InMeters(impulse.x, impulse.y), p, true);
	}

	setPosition(renderable: Renderable, p: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			// `p` is in renderable.pos space (typically top-left). The body
			// is anchored at the shape centroid; convert via the cached
			// offset so syncFromPhysics keeps renderable.pos at the
			// requested value.
			const off = this.posOffsets.get(renderable);
			const wpx = p.x - (off?.x ?? 0);
			const wpy = p.y - (off?.y ?? 0);
			body.setTransform(this.vec2InMeters(wpx, wpy), body.getAngle());
		}
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
	}

	setAngle(renderable: Renderable, angle: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.setTransform(body.getPosition(), angle);
		}
	}

	getAngle(renderable: Renderable): number {
		const body = this.bodyMap.get(renderable);
		return body ? body.getAngle() : 0;
	}

	setAngularVelocity(renderable: Renderable, omega: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.setAngularVelocity(omega);
		}
	}

	getAngularVelocity(renderable: Renderable): number {
		const body = this.bodyMap.get(renderable);
		return body ? body.getAngularVelocity() : 0;
	}

	applyTorque(renderable: Renderable, torque: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.applyTorque(torque, true);
		}
	}

	// -------------------------------------------------------------------
	// Runtime body-property mutators
	// -------------------------------------------------------------------

	setStatic(renderable: Renderable, isStatic: boolean): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.setType(isStatic ? "static" : "dynamic");
		}
	}

	setGravityScale(renderable: Renderable, scale: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.setGravityScale(scale);
		}
	}

	setSensor(renderable: Renderable, isSensor: boolean): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		for (
			let fixture = body.getFixtureList();
			fixture;
			fixture = fixture.getNext()
		) {
			fixture.setSensor(isSensor);
		}
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		body.setLinearDamping(this._scalarOf(friction) ?? 0);
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
		if (!body) return;
		for (
			let fixture = body.getFixtureList();
			fixture;
			fixture = fixture.getNext()
		) {
			fixture.setFilterCategoryBits(type);
		}
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		for (
			let fixture = body.getFixtureList();
			fixture;
			fixture = fixture.getNext()
		) {
			fixture.setFilterMaskBits(mask);
		}
	}

	// -------------------------------------------------------------------
	// Debug surface
	// -------------------------------------------------------------------

	/**
	 * Adapter-side debug surface: the body's AABB in renderable-local
	 * pixel coordinates. Planck computes fixture AABBs in world meters;
	 * we union them, convert to pixels, then subtract `renderable.pos`
	 * so the debug plugin (which translates to renderable origin before
	 * drawing) gets local-space bounds.
	 * @param renderable - the renderable whose body bounds to read
	 * @param out - destination `Bounds` (filled in place, also returned)
	 */
	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined {
		const body = this.bodyMap.get(renderable);
		if (!body) return undefined;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		const tmpAABB = new planck.AABB();
		for (
			let fixture = body.getFixtureList();
			fixture;
			fixture = fixture.getNext()
		) {
			// Each fixture may have multiple child proxies (for chain
			// shapes); for the primitive shapes we use, child 0 is the
			// canonical AABB. planck always returns a defined AABB for
			// valid child indices.
			const aabb = fixture.getAABB(0);
			tmpAABB.combine(aabb);
			if (aabb.lowerBound.x < minX) minX = aabb.lowerBound.x;
			if (aabb.lowerBound.y < minY) minY = aabb.lowerBound.y;
			if (aabb.upperBound.x > maxX) maxX = aabb.upperBound.x;
			if (aabb.upperBound.y > maxY) maxY = aabb.upperBound.y;
		}
		if (minX === Number.POSITIVE_INFINITY) return undefined;
		const rp = renderable.pos;
		out.setMinMax(
			this.m2px(minX) - rp.x,
			this.m2px(minY) - rp.y,
			this.m2px(maxX) - rp.x,
			this.m2px(maxY) - rp.y,
		);
		return out;
	}

	/**
	 * Adapter-side debug surface: the body's collision shapes in
	 * renderable-local pixel coordinates. Returns the original
	 * `def.shapes` array — those are the input shape definitions in
	 * local pixel space, unchanged by Box2D's body transformation
	 * (rotation is baked into planck's fixture vertices, not into our
	 * local-space defs). Read-only.
	 * @param renderable - the renderable whose body shapes to read
	 */
	getBodyShapes(renderable: Renderable): readonly BodyShape[] {
		return this.defMap.get(renderable)?.shapes ?? [];
	}

	isGrounded(renderable: Renderable): boolean {
		const body = this.bodyMap.get(renderable);
		if (!body) return false;
		// "Grounded" = at least one active contact with a body whose
		// centre is below us. Box2D's contact normal direction is "from
		// fixtureA to fixtureB" which isn't a stable per-body sign;
		// comparing the other body's vertical position is more robust.
		//
		// Sleeping bodies in Box2D keep their contact list but the
		// contact edges aren't refreshed until something wakes them up;
		// for a settled body the check is still accurate because the
		// sleeping contact's `isTouching` reflects the last resolved
		// state (which is the rested-on-floor state we care about).
		for (
			let contactEdge = body.getContactList();
			contactEdge;
			contactEdge = contactEdge.next
		) {
			const contact = contactEdge.contact;
			if (!contact.isTouching()) continue;
			const other = contactEdge.other;
			// `other` is nullable in planck's typings (a contact edge can
			// outlive its partner during destruction); skip orphaned
			// edges rather than risk a crash.
			if (other && other.getPosition().y > body.getPosition().y) {
				return true;
			}
		}
		return false;
	}

	raycast(from: Vector2d, to: Vector2d): RaycastHit | null {
		const p1 = this.vec2InMeters(from.x, from.y);
		const p2 = this.vec2InMeters(to.x, to.y);
		// Plain primitives captured by the closure so TS narrowing
		// survives across the callback boundary — typing `hit` as a
		// nullable struct would either trip eslint's "always truthy"
		// CFA pass (because the callback assigns to it) or force a
		// `// eslint-disable-next-line` dance.
		let hitFixture: planck.Fixture | null = null;
		let hitPointX = 0;
		let hitPointY = 0;
		let hitNormalX = 0;
		let hitNormalY = 0;
		let hitFraction = 0;
		// Planck's rayCast callback returns the new ray fraction:
		// 0 = stop, 1 = continue, current value = clip to closest. We
		// return the fraction to clip and keep updating the hit state,
		// ending with the closest fixture along the ray.
		this.world.rayCast(p1, p2, (fixture, point, normal, fraction) => {
			hitFixture = fixture;
			hitPointX = point.x;
			hitPointY = point.y;
			hitNormalX = normal.x;
			hitNormalY = normal.y;
			hitFraction = fraction;
			return fraction;
		});
		// TS CFA can't see closure-captured assignments — the callback
		// above sets `hitFixture` but TS still narrows it to its initial
		// `null` here, so this check looks redundant. It is not: when
		// the ray misses everything, planck never invokes the callback
		// and the original `null` survives.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (hitFixture === null) return null;
		const body = (hitFixture as planck.Fixture).getBody();
		const renderable = this.renderableMap.get(body);
		if (!renderable) return null;
		return {
			renderable,
			point: new Vector2d(this.m2px(hitPointX), this.m2px(hitPointY)),
			normal: new Vector2d(hitNormalX, hitNormalY),
			fraction: hitFraction,
		};
	}

	queryAABB(rect: Rect): Renderable[] {
		const aabb = new planck.AABB(
			this.vec2InMeters(rect.pos.x, rect.pos.y),
			this.vec2InMeters(rect.pos.x + rect.width, rect.pos.y + rect.height),
		);
		const result: Renderable[] = [];
		const seen = new Set<planck.Body>();
		this.world.queryAABB(aabb, (fixture) => {
			const body = fixture.getBody();
			if (seen.has(body)) return true;
			seen.add(body);
			const r = this.renderableMap.get(body);
			if (r) result.push(r);
			return true;
		});
		return result;
	}

	// -------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------

	private _scalarOf(
		v: number | { x: number; y: number } | undefined,
	): number | undefined {
		if (v === undefined) return undefined;
		if (typeof v === "number") return v;
		// Planck only supports scalar linear damping; melonJS defs can be
		// {x, y} — average the two so the simulation feels close even when
		// the user passes per-axis values (rare).
		return (v.x + v.y) / 2;
	}

	private _clampVelocities(): void {
		for (const [renderable, limit] of this.velocityLimits) {
			const body = this.bodyMap.get(renderable);
			if (!body) continue;
			// Limits are in pixel-space; convert to m/s for comparison
			// with planck's linear velocity.
			const limitX = this.px2m(limit.x);
			const limitY = this.px2m(limit.y);
			const v = body.getLinearVelocity();
			const vx = Math.max(-limitX, Math.min(limitX, v.x));
			const vy = Math.max(-limitY, Math.min(limitY, v.y));
			if (vx !== v.x || vy !== v.y) {
				body.setLinearVelocity(new planck.Vec2(vx, vy));
			}
		}
	}

	private _dispatchActiveContacts(): void {
		// After each step, walk the world contact list for currently-
		// touching pairs and dispatch `onCollisionActive` / `onCollision`.
		// Begin/End are dispatched from the event handlers (instant), and
		// active is per-frame while contact persists.
		for (
			let contact = this.world.getContactList();
			contact;
			contact = contact.getNext()
		) {
			if (!contact.isTouching()) continue;
			this._dispatchContact(contact, "active");
		}
	}

	private _dispatchContact(
		contact: planck.Contact,
		phase: "start" | "active" | "end",
	): void {
		const bodyA = contact.getFixtureA().getBody();
		const bodyB = contact.getFixtureB().getBody();
		const rA = this.renderableMap.get(bodyA);
		const rB = this.renderableMap.get(bodyB);
		if (!rA || !rB) return;
		// Detachment handling. Same rules as matter-adapter: skip stale
		// pairs (both detached) and skip start/active when either side is
		// detached; for `end`, dispatch to whichever partner remains.
		const ancA = (rA as Renderable & { ancestor?: object | null }).ancestor;
		const ancB = (rB as Renderable & { ancestor?: object | null }).ancestor;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: ancestor is set to null by Container on removeChild
		const aDetached = ancA === null;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: ancestor is set to null by Container on removeChild
		const bDetached = ancB === null;
		if (phase === "end") {
			if (aDetached && bDetached) return;
		} else if (aDetached || bDetached) {
			return;
		}

		// World-space manifold gives us the collision normal in world
		// coords; we report it as the MTV for the receiver side.
		const worldManifold = new planck.WorldManifold();
		contact.getWorldManifold(worldManifold);
		const nx = worldManifold.normal.x;
		const ny = worldManifold.normal.y;
		// Box2D's normal points from fixtureA to fixtureB; the MTV for A
		// to escape B is `-normal`, MTV for B is `+normal`. Per
		// CollisionResponse contract, each side sees the normal pointing
		// in the direction it must move to separate.
		const depth = this._estimateContactDepth(contact);

		const methodForSide = (receiver: Renderable): string => {
			if (phase === "start") return "onCollisionStart";
			if (phase === "end") return "onCollisionEnd";
			return typeof (receiver as Renderable & { onCollisionActive?: unknown })
				.onCollisionActive === "function"
				? "onCollisionActive"
				: "onCollision";
		};

		const responseAB = {
			a: rA,
			b: rB,
			normal: { x: -nx, y: -ny },
			depth,
			pair: contact,
		};
		const responseBA = {
			a: rB,
			b: rA,
			normal: { x: nx, y: ny },
			depth,
			pair: contact,
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

	private _estimateContactDepth(contact: planck.Contact): number {
		// Box2D's manifold tracks per-point separation in meters; the
		// most-overlapping point's separation is the negated depth.
		const manifold = contact.getManifold();
		let minSep = 0;
		for (let i = 0; i < manifold.pointCount; i++) {
			const sep = (manifold.points[i] as { separation?: number }).separation;
			if (typeof sep === "number" && sep < minSep) {
				minSep = sep;
			}
		}
		// Convert to pixels for parity with matter-adapter's `depth` units.
		return this.m2px(-minSep);
	}

	private _computeCentroid(shapes: BodyShape[]): { x: number; y: number } {
		// Pick the first shape's geometric centre as the body anchor.
		// Multi-shape bodies still rotate around that single point;
		// that's the same approximation matter-adapter makes (Matter uses
		// the parent body's centroid even for compound bodies).
		if (shapes.length === 0) return { x: 0, y: 0 };
		const shape = shapes[0];
		if (shape instanceof Rect) {
			return {
				x: shape.pos.x + shape.width / 2,
				y: shape.pos.y + shape.height / 2,
			};
		}
		if (shape instanceof Ellipse) {
			return { x: shape.pos.x, y: shape.pos.y };
		}
		if (shape instanceof Polygon) {
			let sx = 0;
			let sy = 0;
			for (const p of shape.points) {
				sx += p.x;
				sy += p.y;
			}
			const n = Math.max(1, shape.points.length);
			return { x: shape.pos.x + sx / n, y: shape.pos.y + sy / n };
		}
		return { x: 0, y: 0 };
	}

	private _shapeToPlanck(
		shape: BodyShape,
		centroid: { x: number; y: number },
	): planck.Shape | null {
		// All planck shapes are body-local in meters. We translate the
		// melonJS shape into local space by subtracting the body
		// centroid (which is the body's anchor in renderable-local
		// pixel space), then convert pixels → meters.
		if (shape instanceof Rect) {
			const w = shape.width;
			const h = shape.height;
			const cx = shape.pos.x + w / 2 - centroid.x;
			const cy = shape.pos.y + h / 2 - centroid.y;
			// planck.Box wants half-extents in meters.
			return new planck.Box(
				this.px2m(w / 2),
				this.px2m(h / 2),
				new planck.Vec2(this.px2m(cx), this.px2m(cy)),
				0,
			);
		}
		if (shape instanceof Ellipse) {
			// Box2D has no native ellipse — approximate as a circle with
			// the average radius. Future improvement: polygon hull for
			// tall/narrow ellipses.
			const radius = (shape.radiusV.x + shape.radiusV.y) / 2;
			const cx = shape.pos.x - centroid.x;
			const cy = shape.pos.y - centroid.y;
			return new planck.Circle(
				new planck.Vec2(this.px2m(cx), this.px2m(cy)),
				this.px2m(radius),
			);
		}
		if (shape instanceof Polygon) {
			// Box2D polygons must be convex with vertices in CCW order
			// and ≤ 8 vertices. The melonJS Polygon class doesn't enforce
			// these constraints; we let planck throw if the user passes
			// something invalid (same failure mode as matter's
			// `Bodies.fromVertices` on a degenerate hull).
			const pts = shape.points.map(
				(p) =>
					new planck.Vec2(
						this.px2m(shape.pos.x + p.x - centroid.x),
						this.px2m(shape.pos.y + p.y - centroid.y),
					),
			);
			return new planck.Polygon(pts);
		}
		// Unknown shape — skip silently rather than throw, matching the
		// matter-adapter philosophy of "best effort" for compound bodies
		// with mixed shape types.
		return null;
	}
}

/**
 * Namespace-merged with the {@link PlanckAdapter} class to expose
 * adapter-owned types alongside the runtime API. Access via
 * `PlanckAdapter.Body`, etc.
 */
// biome-ignore lint/style/useNamingConvention: namespace must match the class it merges with
// eslint-disable-next-line @typescript-eslint/no-namespace -- intentional class+namespace declaration merge so adapter-owned types (`PlanckAdapter.Body`) are reachable alongside the runtime class; cannot be expressed as a separate ES2015 module export
export namespace PlanckAdapter {
	/**
	 * The concrete body handle attached to `renderable.body` under
	 * {@link PlanckAdapter}. Combines the raw `planck.Body` (with all
	 * native methods — `getLinearVelocity`, `getAngle`, `getMass`,
	 * `setSleepingAllowed`, …) with the portable melonJS helper methods
	 * (`setVelocity`, `applyImpulse`, `setStatic`, etc.) spliced on at
	 * `addBody` time.
	 *
	 * Type it explicitly when reaching for planck-native methods:
	 *
	 * ```ts
	 * (this.body as PlanckAdapter.Body).setBullet(true);
	 * ```
	 *
	 * Keeps user code free of a direct `planck` import — the planck
	 * dependency stays behind the adapter boundary.
	 */
	export type Body = planck.Body & PhysicsBody;
}
