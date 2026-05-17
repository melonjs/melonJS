import type { Ellipse } from "../geometries/ellipse.ts";
import type { Polygon } from "../geometries/polygon.ts";
import type { Rect } from "../geometries/rectangle.ts";
import type { Vector2d } from "../math/vector2d.ts";
import type { Bounds } from "./bounds.ts";

/**
 * @import Renderable from "../renderable/renderable.js";
 * @import World from "./world.js";
 */

/**
 * Body simulation kind. `static` bodies never move (terrain, walls);
 * `dynamic` bodies are simulated (player, projectiles); `kinematic`
 * bodies are user-positioned but participate in collision (moving
 * platforms, elevators).
 */
export type BodyType = "static" | "dynamic" | "kinematic";

/** Collision shape that a physics body may be composed of. */
export type BodyShape = Rect | Ellipse | Polygon;

/**
 * Collision response passed to the modern collision lifecycle hooks
 * (`onCollisionStart`, `onCollisionActive`, `onCollisionEnd`) on every
 * adapter.
 *
 * **Receiver-symmetric:** `a` is always the renderable whose handler is
 * firing (`response.a === this`), `b` is always the partner (`response.b
 * === other`). The same overlap is dispatched once to each side as a
 * separate response with `a`/`b` swapped accordingly.
 *
 * **NOT the same contract as the legacy `onCollision`.** The legacy
 * handler receives a different response shape (fixed `a`/`b` per pair,
 * `overlapV` sign convention from b → a, fires 2× per frame for
 * dynamic-dynamic pairs). See `Renderable.onCollision` JSDoc for that
 * one.
 * @example
 *   onCollisionActive(response, other) {
 *       if (response.normal.y < -0.7) {
 *           // push-me-up direction ⇒ I'm on top of `other` (stomp)
 *       }
 *   }
 */
export interface CollisionResponse {
	/** the renderable whose handler is firing — always `=== this`. */
	a: import("../renderable/renderable.js").default;
	/** the partner renderable — always `=== other`. */
	b: import("../renderable/renderable.js").default;
	/**
	 * Unit minimum-translation vector for the receiver: the direction `a`
	 * must move to separate from `b`. Same sign convention across every
	 * adapter — in canvas coordinates (y grows downward):
	 *
	 * - `normal.y < -0.7` → push me **up** ⇒ I'm on top of `b` (stomp / landed on)
	 * - `normal.y >  0.7` → push me **down** ⇒ I'm underneath `b`
	 * - `Math.abs(normal.x) > 0.7` → mostly horizontal contact (side hit)
	 */
	normal: { x: number; y: number };
	/** Penetration depth along the shortest-separation axis (always positive). */
	depth: number;
	/**
	 * Engine-native contact pair object. **Shape is adapter-specific** —
	 * `Matter.Pair` under `@melonjs/matter-adapter`, a `ContactPair`-shaped
	 * object under a future Rapier adapter, a `b2Contact` under a future
	 * Box2D adapter, etc. Reading this commits your code to a specific
	 * engine; use the portable `normal` / `depth` fields for
	 * adapter-portable handlers.
	 *
	 * Present only when the active adapter has a native pair concept;
	 * `undefined` under the built-in SAT adapter (which has no native
	 * pair representation — the SAT detector works pair-by-pair without
	 * persisting them).
	 */
	pair?: unknown;
	/**
	 * @deprecated Use `depth`. Built-in SAT legacy field; kept on modern
	 * handler dispatches for migration. `undefined` under
	 * `@melonjs/matter-adapter`.
	 */
	overlap?: number;
	/**
	 * @deprecated Use `normal`. Built-in SAT legacy field; flipped per
	 * receiver so the sign convention aligns with `normal` on the modern
	 * dispatch. `undefined` under `@melonjs/matter-adapter`.
	 */
	overlapN?: { x: number; y: number };
	/**
	 * @deprecated Built-in SAT legacy field, equal to `normal × depth`.
	 * Flipped per receiver. `undefined` under `@melonjs/matter-adapter`.
	 */
	overlapV?: { x: number; y: number };
}

/**
 * Portable physics body handle returned by {@link PhysicsAdapter.addBody}
 * and stored on `renderable.body`. Every adapter guarantees these
 * methods so engine-portable code can read and mutate body state
 * without knowing which adapter is active.
 *
 * Each adapter exports a concrete `Body` type (e.g.
 * `MatterAdapter.Body`, `BuiltinAdapter.Body`) that extends this
 * interface with its native fields — cast to the adapter-specific type
 * only when reaching for engine-specific state (Matter's `frictionAir`,
 * BuiltinAdapter's `vel`/`force`, etc.).
 *
 * Methods marked optional are not implemented by every adapter; check
 * the adapter docs or fall back to the equivalent on the adapter
 * itself (e.g. `adapter.setVelocity(r, v)` always works).
 */
export interface PhysicsBody {
	/** Set linear velocity in viewport pixels per frame. */
	setVelocity(x: number, y: number): void;
	/** Read linear velocity; writes into `out` if provided to avoid an alloc. */
	getVelocity(out?: Vector2d): Vector2d;
	/**
	 * Apply a continuous force (integrated over the next step). When the
	 * optional application point is provided and differs from the body's
	 * centroid, a corresponding torque is generated:
	 * `τ = r × F`, where `r = point - centroid`. BuiltinAdapter routes the
	 * torque into {@link applyTorque}; MatterAdapter passes the point
	 * directly to `Matter.Body.applyForce`.
	 * @example
	 * // pure linear thrust (existing 2-arg form, unchanged):
	 * ship.body.applyForce(0, -0.05);
	 *
	 * // off-centre kick: pushes the crate to the right AND tips it over,
	 * // because the contact point is at the top of the crate, away from
	 * // its centroid:
	 * const topX = crate.pos.x + crate.width / 2;
	 * const topY = crate.pos.y;
	 * crate.body.applyForce(1.5, 0, topX, topY);
	 * @param x - force X component
	 * @param y - force Y component
	 * @param pointX - world X of the application point (defaults to centroid)
	 * @param pointY - world Y of the application point (defaults to centroid)
	 */
	applyForce(x: number, y: number, pointX?: number, pointY?: number): void;
	/** Apply an instantaneous impulse (`Δv = J / mass`). */
	applyImpulse(x: number, y: number): void;
	/**
	 * Toggle static (fixed-position, infinite-mass) state. Static bodies
	 * still participate in collisions; they just don't integrate.
	 */
	setStatic(isStatic?: boolean): void;
	/**
	 * Set the bit mask of collision types this body collides with.
	 * @see collision.types
	 */
	setCollisionMask(mask: number): void;
	/** Set the collision category bit for this body. */
	setCollisionType?(type: number): void;
	/** Toggle sensor mode (fires collision events without push-out). */
	setSensor?(isSensor?: boolean): void;
	/** Set mass directly (recomputes inertia where applicable). */
	setMass?(m: number): void;
	/** Set restitution / bounciness. */
	setBounce?(r: number): void;
	/** Set per-body gravity multiplier. */
	setGravityScale?(scale: number): void;
	/**
	 * Set angular velocity (rad / frame). BuiltinAdapter integrates this
	 * each step into the body's `angle` and updates the renderable's
	 * `currentTransform` (visual rotation only — SAT collisions remain
	 * axis-aligned). MatterAdapter routes to `Matter.Body.setAngularVelocity`,
	 * which participates fully in matter's rotational dynamics.
	 * @example
	 * // a coin sprite that spins continuously while sitting on the ground:
	 * coin.body.setAngularVelocity?.(0.05);
	 */
	setAngularVelocity?(omega: number): void;
	/**
	 * Read angular velocity (rad / frame). Returns 0 if rotation isn't tracked.
	 * @example
	 * if ((spinner.body.getAngularVelocity?.() ?? 0) > 1) {
	 *     spinner.body.setAngularVelocity?.(1); // cap spin
	 * }
	 */
	getAngularVelocity?(): number;
	/**
	 * Set absolute rotation angle (radians). Re-syncs the renderable's
	 * `currentTransform` immediately — no need to wait for the next
	 * physics step. Useful when you want to point a body at a target.
	 * @example
	 * // turret tracks the player every frame:
	 * const dx = player.centerX - turret.centerX;
	 * const dy = player.centerY - turret.centerY;
	 * turret.body.setAngle?.(Math.atan2(dy, dx));
	 */
	setAngle?(rad: number): void;
	/** Read absolute rotation angle (radians). */
	getAngle?(): number;
	/**
	 * Apply an angular impulse directly: `Δω = τ / pseudoInertia`. Bypasses
	 * the force/lever-arm computation in {@link applyForce} for the case
	 * where you want to spin something up without applying a linear force —
	 * a thruster, a power-up's intrinsic rotation, a knockback spin effect.
	 * @example
	 * // give a powerup a one-shot 360° spin-up burst on collection:
	 * powerup.body.applyTorque?.(50);
	 */
	applyTorque?(torque: number): void;
	/** Live alias of the collision category bit. */
	collisionType: number;
	/** Live alias of the collision mask bits. */
	collisionMask: number;
}

/**
 * Engine-portable body description, passed to {@link PhysicsAdapter.addBody}.
 * Adapter-native fields (Box2D meters, Matter collisionFilter bits, etc.)
 * are derived from these portable fields by each adapter.
 */
export interface BodyDefinition {
	/** simulation kind */
	type: BodyType;
	/** collision shapes (one or more — compound body support) */
	shapes: BodyShape[];

	/** mass per unit area; defaults are adapter-specific */
	density?: number;
	/**
	 * Per-step velocity damping (Matter's `frictionAir`). Bleeds velocity
	 * off every frame regardless of contact, creating terminal velocity.
	 * Number applies uniformly; `{x, y}` damps each axis independently
	 * (melonJS-specific — Matter only supports scalar and will average).
	 */
	frictionAir?: number | { x: number; y: number };
	/**
	 * Bounciness (coefficient of restitution): `0` = inelastic (stops on
	 * contact), `1` = perfectly elastic (rebound speed equals impact speed).
	 * Typically in `[0, 1]`. Values `> 1` produce a super-elastic
	 * ("energy-gain") rebound — physically unrealistic but useful for
	 * arcade effects like pinball flippers, slingshot boosters, or
	 * trampoline pads. The value is not clamped at the interface level;
	 * how an adapter handles out-of-range values is adapter-specific.
	 */
	restitution?: number;
	/**
	 * Surface coefficient of friction during contact. Matter's
	 * `body.friction` — `0` = frictionless (objects slide past each
	 * other), `1` = high stick. Determines how much tangential velocity
	 * is transferred between contacting bodies. Combined with body
	 * rotation, this is what produces "throw" between colliding circles
	 * and "english" off a wall. Distinct from `frictionAir` (per-step
	 * drag with no contact required). Builtin SAT adapter ignores this.
	 */
	friction?: number;
	/**
	 * Per-body gravity multiplier. `0` disables gravity for this body;
	 * negative inverts it. Matches Matter's `body.gravityScale`.
	 */
	gravityScale?: number;
	/**
	 * Hard cap on velocity magnitude per axis. melonJS extension —
	 * Matter has no direct equivalent and uses `frictionAir`-induced
	 * terminal velocity instead; MatterAdapter implements this by
	 * clamping velocity in an `afterUpdate` hook.
	 */
	maxVelocity?: { x: number; y: number };

	/** disable rotation simulation; the body keeps its initial angle */
	fixedRotation?: boolean;
	/** the body generates collision events but no physical response */
	isSensor?: boolean;

	/**
	 * Bit flag identifying this body's collision type. See
	 * {@link collision.types}. Adapters translate to their native filter
	 * system (Matter `collisionFilter.category`, Box2D `categoryBits`).
	 */
	collisionType?: number;
	/**
	 * Bit mask of collision types this body can collide with. Defaults to
	 * `collision.types.ALL_OBJECT`.
	 */
	collisionMask?: number;

	/** arbitrary user data attached to the body */
	userData?: unknown;
}

/**
 * Adapter feature flags. The engine reads these to negotiate optional
 * capabilities; user code can branch on them to gracefully degrade when
 * a feature isn't available under the active adapter.
 */
export interface AdapterCapabilities {
	/** supports joints, springs, hinges, etc. */
	constraints: boolean;
	/** supports continuous collision detection for fast-moving bodies */
	continuousCollisionDetection: boolean;
	/** supports body sleeping to reduce simulation cost when idle */
	sleepingBodies: boolean;
	/** supports {@link PhysicsAdapter.raycast} */
	raycasts: boolean;
	/**
	 * supports {@link BodyDefinition.maxVelocity} /
	 * {@link PhysicsAdapter.setMaxVelocity}. BuiltinAdapter does this
	 * via its kinematic integrator; MatterAdapter via an `afterUpdate`
	 * clamp. Adapters that can't enforce a hard cap report `false`.
	 */
	velocityLimit: boolean;
	/**
	 * supports {@link PhysicsAdapter.isGrounded}. Adapters that can't
	 * cheaply derive ground contact (no contact iteration) report `false`.
	 */
	isGrounded: boolean;
}

/**
 * Common adapter constructor options. Concrete adapters may extend this
 * with their own engine-specific options.
 */
export interface AdapterOptions {
	/** world gravity vector, default `(0, 0.98)` */
	gravity?: Vector2d;
}

/** Result of a successful {@link PhysicsAdapter.raycast}. */
export interface RaycastHit {
	/** the renderable whose body the ray hit */
	renderable: import("../renderable/renderable.js").default;
	/** world-space hit point */
	point: Vector2d;
	/** surface normal at the hit point */
	normal: Vector2d;
	/** position along the ray, `0..1` from `from` to `to` */
	fraction: number;
}

/**
 * Swappable physics engine integration. `BuiltinAdapter` ships with
 * melonjs and wraps the engine's native SAT-based physics; third-party
 * adapters (e.g. `@melonjs/matter-adapter`) implement this interface to
 * plug a different engine in.
 *
 * **Lifecycle contract:** one adapter per {@link World}, instantiated and
 * passed to `Application` at construction, never swapped at runtime.
 * Adapter state (bodies, constraints, sleeping flags, etc.) does not
 * migrate between adapters.
 *
 * **Body handle convention:** {@link PhysicsAdapter.addBody} returns an
 * opaque handle that becomes `renderable.body`. Each adapter chooses its
 * own concrete body type — `BuiltinAdapter` returns the legacy
 * {@link Body} class so existing property-based code (`body.vel.x = 5`,
 * `body.isStatic = true`) keeps working unchanged. Third-party adapters
 * return their engine's native body type. For adapter-agnostic code, use
 * the portable methods on the adapter itself ({@link setVelocity},
 * {@link applyForce}, etc.) instead of mutating the handle directly.
 */
export interface PhysicsAdapter {
	/** advertised capabilities; user code may branch on these */
	readonly capabilities: AdapterCapabilities;

	/**
	 * Short adapter identifier exposed as `world.physic`. User code uses
	 * it to branch on which physics implementation is active without
	 * importing the adapter class — e.g.
	 *
	 * ```ts
	 * if (app.world.physic === "matter") {
	 *     // matter-only setup (constraints, etc.)
	 * }
	 * ```
	 *
	 * Convention: a single lowercase token. The first-party labels are
	 * `"builtin"` (default — `BuiltinAdapter`) and `"matter"`
	 * (`@melonjs/matter-adapter`). Third-party adapters should pick a
	 * concise identifier that won't collide with future official ones.
	 *
	 * The reserved value `"none"` is set on `world.physic` only when the
	 * user passes `physic: "none"` to `Application` to disable physics
	 * entirely; adapters should not use it.
	 *
	 * Defaults to `"builtin"` if an adapter doesn't declare its own — keeps
	 * legacy adapters wired in before this field was added still working.
	 */
	readonly physicLabel?: string;

	/**
	 * Optional display name reported on the startup banner. Defaults to
	 * the adapter class name. Third-party packages typically set this to
	 * their npm package id (e.g. `"@melonjs/matter-adapter"`).
	 */
	readonly name?: string;
	/**
	 * Optional package version reported on the startup banner. Set this
	 * when shipping the adapter as a separate npm package so users can
	 * tell which version is wired in at a glance.
	 */
	readonly version?: string;
	/**
	 * Optional URL (npm / homepage / repo) reported on the startup banner.
	 * Convention matches the debug-plugin's startup line.
	 */
	readonly url?: string;

	/** world gravity. Mutate to change at runtime. */
	gravity: Vector2d;

	/**
	 * Called once after the adapter is attached to a {@link World}.
	 * Adapters may register internal listeners, allocate native engine
	 * state, or read world bounds here.
	 */
	init?(world: import("./world.js").default): void;

	/** Called when the adapter is being torn down; release native resources. */
	destroy?(): void;

	/** Advance the simulation by one frame. Called from `World.update(dt)`. */
	step(dt: number): void;

	/**
	 * Copy physics-engine body positions back to `renderable.pos` and
	 * rotations to the renderable's transform. Called after {@link step}
	 * each frame. Adapters that mutate the renderable directly during
	 * step (e.g. `BuiltinAdapter`) may leave this a no-op.
	 */
	syncFromPhysics(): void;

	/**
	 * Optional inverse of {@link syncFromPhysics} — push a single
	 * renderable's current pos/angle into the physics engine. Called by
	 * the engine when game code teleports a renderable. Adapters may
	 * also expose this via {@link setPosition} and skip implementing
	 * it directly.
	 */
	syncToPhysics?(
		renderable: import("../renderable/renderable.js").default,
	): void;

	/**
	 * Register a body with the simulation. Returns an opaque handle that
	 * becomes `renderable.body`. Each adapter chooses its own concrete
	 * body type — see the class doc for the convention.
	 *
	 * **Prefer the declarative path.** Set `renderable.bodyDef` and call
	 * `Container.addChild(renderable)` — the container auto-invokes
	 * `addBody` AND inserts the renderable into the world's broadphase
	 * (QuadTree) in one atomic step. Direct calls to `addBody` only
	 * register the body with this adapter; they do NOT add the renderable
	 * to the world's container hierarchy, so the broadphase won't return
	 * it as a collision candidate. A body registered via direct `addBody`
	 * without a matching `addChild` will integrate (velocity, forces) but
	 * never collide.
	 */
	addBody(
		renderable: import("../renderable/renderable.js").default,
		def: BodyDefinition,
	): PhysicsBody;

	/**
	 * Unregister a body. Called automatically when `Container.removeChild`
	 * detaches the renderable; direct calls are the inverse of a direct
	 * `addBody` (rare — use `removeChild` for the normal lifecycle).
	 */
	removeBody(renderable: import("../renderable/renderable.js").default): void;

	/** Replace the body's collision geometry without re-creating the body. */
	updateShape?(
		renderable: import("../renderable/renderable.js").default,
		shapes: BodyShape[],
	): void;

	/**
	 * Portable velocity / force / position API. Every adapter implements
	 * these by routing to its native engine. Use these instead of
	 * mutating the body handle directly when writing adapter-agnostic
	 * code.
	 */
	getVelocity(
		renderable: import("../renderable/renderable.js").default,
		out?: Vector2d,
	): Vector2d;
	setVelocity(
		renderable: import("../renderable/renderable.js").default,
		v: Vector2d,
	): void;
	applyForce(
		renderable: import("../renderable/renderable.js").default,
		force: Vector2d,
		point?: Vector2d,
	): void;
	applyImpulse(
		renderable: import("../renderable/renderable.js").default,
		impulse: Vector2d,
		point?: Vector2d,
	): void;
	setPosition(
		renderable: import("../renderable/renderable.js").default,
		p: Vector2d,
	): void;
	setAngle?(
		renderable: import("../renderable/renderable.js").default,
		angle: number,
	): void;
	/** Read absolute rotation angle (radians). Returns 0 if not tracked. */
	getAngle?(renderable: import("../renderable/renderable.js").default): number;
	/** Set angular velocity (rad / frame). */
	setAngularVelocity?(
		renderable: import("../renderable/renderable.js").default,
		omega: number,
	): void;
	/** Read angular velocity (rad / frame). Returns 0 if not tracked. */
	getAngularVelocity?(
		renderable: import("../renderable/renderable.js").default,
	): number;
	/** Apply an angular impulse (`Δω = τ / inertia`). */
	applyTorque?(
		renderable: import("../renderable/renderable.js").default,
		torque: number,
	): void;

	/**
	 * Runtime body-property mutators. Each maps to the corresponding
	 * {@link BodyDefinition} field and lets game code change a body's
	 * physical properties without re-creating it. Adapter implementations
	 * route to their native engine (BuiltinAdapter writes to the `Body`
	 * handle; MatterAdapter calls Matter's `Body.set*` helpers).
	 */
	setStatic(
		renderable: import("../renderable/renderable.js").default,
		isStatic: boolean,
	): void;
	setGravityScale(
		renderable: import("../renderable/renderable.js").default,
		scale: number,
	): void;
	setFrictionAir(
		renderable: import("../renderable/renderable.js").default,
		friction: number | { x: number; y: number },
	): void;
	setMaxVelocity(
		renderable: import("../renderable/renderable.js").default,
		limit: { x: number; y: number },
	): void;
	/**
	 * Read the body's current velocity cap (mirror of
	 * {@link setMaxVelocity}). Returns plain `{x, y}` so callers don't
	 * need to import a vector type. Optional — adapters that don't
	 * implement velocity caps omit this method.
	 */
	getMaxVelocity?(renderable: import("../renderable/renderable.js").default): {
		x: number;
		y: number;
	};
	setCollisionType(
		renderable: import("../renderable/renderable.js").default,
		type: number,
	): void;
	setCollisionMask(
		renderable: import("../renderable/renderable.js").default,
		mask: number,
	): void;
	/**
	 * Toggle a body between solid and sensor mode. A sensor still fires
	 * collision events (`onCollisionStart` / `onCollisionActive` /
	 * `onCollisionEnd`) but the engine does not push the bodies apart on
	 * contact — useful for one-way platforms, trigger zones, ground-snap
	 * ground assists, etc.
	 *
	 * Adapters without a native sensor flag emulate by toggling the
	 * collision mask between its previous value and `NO_OBJECT`.
	 */
	setSensor?(
		renderable: import("../renderable/renderable.js").default,
		isSensor: boolean,
	): void;

	/**
	 * Whether the body has at least one active contact with a surface
	 * below it (collision normal pointing up). Capability-gated by
	 * {@link AdapterCapabilities.isGrounded}. melonJS extension — Matter
	 * has no direct equivalent and the MatterAdapter implements it by
	 * scanning active pairs each call.
	 */
	isGrounded?(
		renderable: import("../renderable/renderable.js").default,
	): boolean;

	/**
	 * Optional spatial queries — capability-gated by
	 * {@link AdapterCapabilities.raycasts}. Adapters that don't support
	 * these omit the methods entirely (`typeof adapter.raycast === "function"`).
	 */
	raycast?(from: Vector2d, to: Vector2d): RaycastHit | null;
	queryAABB?(rect: Rect): import("../renderable/renderable.js").default[];

	/**
	 * Return the body's axis-aligned bounding box in **renderable-local**
	 * coordinates (relative to `renderable.pos`). Writes into the
	 * supplied `out` Bounds so callers can poll allocation-free each
	 * frame. Returns `undefined` if the renderable has no registered
	 * body.
	 *
	 * Used by ecosystem tooling — most notably `@melonjs/debug-plugin`
	 * — to visualize the body's effective collision extent. The adapter
	 * owns coordinate-system conversion: builtin Body already stores
	 * bounds in local space, matter stores them in world space and the
	 * adapter subtracts `renderable.pos` before writing.
	 *
	 * Required by the adapter contract: any adapter that registers
	 * bodies MUST implement this. The output is the canonical, local-
	 * space representation tools rely on regardless of which engine
	 * the adapter wraps.
	 */
	getBodyAABB(
		renderable: import("../renderable/renderable.js").default,
		out: Bounds,
	): Bounds | undefined;

	/**
	 * Return a snapshot of the body's collision shapes in
	 * **renderable-local** coordinates. The returned array is intended
	 * for read-only inspection (debug drawing, hit-region queries) —
	 * adapters may return a live reference for performance, so callers
	 * MUST NOT mutate it. Returns an empty array if no body.
	 *
	 * Pairs with {@link getBodyAABB} as the adapter-side debug surface;
	 * lets each adapter own its coordinate convention without polluting
	 * the underlying physics-engine body objects. Required by the
	 * adapter contract.
	 */
	getBodyShapes(
		renderable: import("../renderable/renderable.js").default,
	): readonly BodyShape[];
}
