import type { Ellipse } from "../geometries/ellipse.ts";
import type { Polygon } from "../geometries/polygon.ts";
import type { Rect } from "../geometries/rectangle.ts";
import type { Sphere } from "../geometries/sphere.ts";
import type { Vector2d } from "../math/vector2d.ts";
import type { Vector3d } from "../math/vector3d.ts";
import type Renderable from "../renderable/renderable.js";
import type { Bounds } from "./bounds.ts";
import type World from "./world.js";

/**
 * Body simulation kind. `static` bodies never move (terrain, walls);
 * `dynamic` bodies are simulated (player, projectiles); `kinematic`
 * bodies are user-positioned but participate in collision (moving
 * platforms, elevators).
 */
export type BodyType = "static" | "dynamic" | "kinematic";

/**
 * Collision shape that a physics body may be composed of.
 *
 * A shape may also carry its own optional collision settings, which refine the
 * body's rather than replacing them — `collisionType`, `collisionMask`,
 * `isTrigger` and `isActive`. See {@link Body#addShape} for the semantics.
 *
 * Adapter support: the builtin and planck adapters honour them (planck maps
 * them onto per-fixture filters, which Box2D provides natively). The matter
 * adapter does NOT — its `collisionFilter` and `isSensor` belong to a body, not
 * to the parts it is built from, so per-shape values are ignored there.
 */
export type BodyShape = Rect | Ellipse | Polygon;

/**
 * One overlapping SHAPE pair, passed to the shape-level collision lifecycle
 * hooks (`onShapeCollisionStart`, `onShapeCollisionActive`,
 * `onShapeCollisionEnd`).
 *
 * **Why this exists alongside `CollisionResponse`.** A body may collide with
 * another through several shapes at once. `onCollision` and the
 * `onCollision*` lifecycle report ONE contact per body pair — the one chosen
 * for physical resolution — so a footprint contact can mask a simultaneous
 * hurtbox contact. These hooks report every overlapping pair, without changing
 * which one resolves.
 *
 * **Opt-in.** The detector only enumerates shape pairs when an object declares
 * at least one of these handlers. Declaring none costs nothing.
 *
 * **Supported on every backend.** The builtin detector enumerates shape pairs
 * directly; `@melonjs/planck-adapter` and `@melonjs/matter-adapter` map one
 * melonJS shape onto one native collider and their engines already report
 * contacts per collider pair, so both dispatch these natively. The adapters
 * supply `normal` and `depth` rather than the full SAT vector set, matching
 * what they already provide to `onCollision`.
 *
 * **Receiver-symmetric**, exactly like `CollisionResponse`: `a` and `shapeA`
 * are always the side whose handler is firing, `b` and `shapeB` the partner.
 *
 * **Do not retain it.** The object is pooled and reused across pairs and
 * frames. Copy anything needed beyond the handler call.
 * @example
 *   onShapeCollisionStart(contact, other) {
 *       // which of MY shapes was hit
 *       if (contact.indexShapeA === HURTBOX && contact.isTrigger) {
 *           this.takeHit(other, contact.normal);
 *       }
 *   }
 */
export interface ShapeCollisionContact {
	/** the renderable whose handler is firing — always `=== this`. */
	a: Renderable;
	/** the partner renderable — always `=== other`. */
	b: Renderable;
	/** the receiver's own shape in this contact. */
	shapeA: BodyShape;
	/** the partner's shape in this contact. */
	shapeB: BodyShape;
	/** index of `shapeA` in the receiver's `body.shapes`. */
	indexShapeA: number;
	/** index of `shapeB` in the partner's `body.shapes`. */
	indexShapeB: number;
	/** true when either shape is a trigger, so the pair contributes no push-out. */
	isTrigger: boolean;
	/** penetration depth. Zero in `onShapeCollisionEnd`, where the shapes have separated. */
	overlap: number;
	/** alias of `overlap`. */
	depth: number;
	/** minimum translation vector for the receiver. */
	overlapV: { x: number; y: number };
	/** contact normal in the legacy `overlapN` convention. */
	overlapN: { x: number; y: number };
	/** contact normal oriented for the receiver. */
	normal: { x: number; y: number };
	/** Z components, non-zero only for a `Box3d` pair that resolved along Z. */
	overlapZ: number;
	overlapNZ: number;
	normalZ: number;
}

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
	a: Renderable;
	/** the partner renderable — always `=== other`. */
	b: Renderable;
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
	 * @deprecated since 19.5.0 - Use `depth`. Built-in SAT legacy field; kept on modern
	 * handler dispatches for migration. `undefined` under
	 * `@melonjs/matter-adapter`.
	 */
	overlap?: number;
	/**
	 * @deprecated since 19.5.0 - Use `normal`. Built-in SAT legacy field; flipped per
	 * receiver so the sign convention aligns with `normal` on the modern
	 * dispatch. `undefined` under `@melonjs/matter-adapter`.
	 */
	overlapN?: { x: number; y: number };
	/**
	 * @deprecated since 19.5.0 - Built-in SAT legacy field, equal to `normal × depth`.
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
	/**
	 * collision shapes (one or more — compound body support). Already
	 * resolved: a definition naming a collision shape file is a
	 * {@link BodyDefinitionInit}, and the engine resolves it before any
	 * adapter is handed it.
	 */
	shapes: BodyShape[];

	/** mass per unit area; defaults are adapter-specific */
	density?: number;
	/**
	 * Per-step velocity damping (Matter's `frictionAir`). Bleeds velocity
	 * off every frame regardless of contact, creating terminal velocity.
	 * Number applies uniformly; `{x, y}` damps each axis independently
	 * (melonJS-specific — Matter only supports scalar and will average).
	 *
	 * It damps ROTATION as well as translation on the matter and planck
	 * adapters, so it is also what stops a body spinning once something has
	 * set it turning. Left at `0`, a spin never decays. The builtin adapter
	 * maps it onto its per-axis `body.friction` damping vector instead, and
	 * has no rotation to damp.
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

	/**
	 * Disable rotation simulation, so the body keeps whatever angle it has.
	 *
	 * Defaults to whatever the underlying engine defaults to, which for both
	 * matter and planck is `false`: a rigid body turns when something turns
	 * it. Pass `true` for anything that must stay upright, such as a
	 * platformer actor that should never tip over.
	 *
	 * The builtin adapter ignores this field, since its rotation is visual
	 * only and its collision shapes never turn either way.
	 * @default false
	 * @example
	 * // a character that stays upright whatever it walks into
	 * this.bodyDef = { type: "dynamic", shapes: [...], fixedRotation: true };
	 */
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
 * One fixture of a collision shape file, as exported by a physics-shape
 * editor. Geometry is either a polygon outline or a circle, and the material
 * values beside it are custom parameters the exporter template declares rather
 * than guaranteed fields, so the spelling varies between templates. melonJS
 * reads the common ones.
 *
 * Reached through {@link BodyDefinitionInit.shapes}; never written by hand in
 * the usual case, where `shapes` names the preloaded file instead.
 */
export interface ShapeEntry {
	/** polygon outline as a flat `[x0, y0, x1, y1, …]` coordinate list */
	shape?: number[];
	/**
	 * polygon outline as points. A concave outline is exported already
	 * decomposed, so this is normally a list of convex pieces, each of which
	 * becomes its own {@link Polygon}; a single outline is also read.
	 */
	vertices?: { x: number; y: number }[] | { x: number; y: number }[][];
	/** circle geometry, becoming an {@link Ellipse} */
	circle?: { x: number; y: number; radius: number };
	/** circle radius, when the centre sits beside it rather than inside it */
	radius?: number;
	/** circle centre, paired with a sibling `radius` */
	center?: { x: number; y: number };

	/** mass per unit area */
	density?: number;
	/** surface friction during contact */
	friction?: number;
	/** bounciness; `restitution` is the other spelling */
	bounce?: number;
	/** bounciness; `bounce` is the other spelling */
	restitution?: number;
	/** the fixture reports collisions without a physical response */
	isSensor?: boolean;

	/**
	 * Collision filtering, in melonJS's own names, for a file written or
	 * adjusted by hand. These are {@link collision.types} values.
	 *
	 * The exporting tool's own `filter` block (`categoryBits` / `maskBits`,
	 * in any spelling) is deliberately NOT read: those numbers live in that
	 * tool's namespace, a template writes its defaults for every fixture
	 * whether or not the author set anything, and its default category `1`
	 * is melonJS's `PLAYER_OBJECT`. Importing them would silently tag a shape
	 * as something it is not and stop it colliding. Set filtering on the body
	 * definition instead.
	 */
	collisionType?: number;
	/** collision filtering, in melonJS's own names. See above. */
	collisionMask?: number;
}

/**
 * A body definition as authored, before the engine resolves it.
 *
 * This is what {@link Renderable#bodyDef} takes. It is a
 * {@link BodyDefinition} whose `shapes` may additionally name a collision
 * shape file, which is resolved into real shapes when the renderable is added
 * to a container — so every adapter receives the same
 * {@link BodyDefinition}, and one definition works unchanged on the builtin,
 * matter and planck backends alike.
 * @example
 * // preload the file the shape editor exported, like any other JSON
 * { name: "shapes", type: "json", src: "data/physics/shapes.json" }
 *
 * // then name it, and the body inside it to use
 * new Sprite(x, y, {
 *     image: "hotdog",
 *     bodyDef: { type: "dynamic", shapes: "shapes", id: "hotdog" },
 * });
 *
 * // material values the file carries are applied unless the definition
 * // states otherwise, so this body bounces at 0.9 whatever the file says
 * { type: "dynamic", shapes: "shapes", id: "hotdog", restitution: 0.9 }
 *
 * // authored shapes still work, and the two can be mixed
 * { type: "static", shapes: [new Rect(0, 0, 32, 32)] }
 */
export interface BodyDefinitionInit extends Omit<BodyDefinition, "shapes"> {
	/**
	 * The body's collision shapes, as any of:
	 *
	 * - real shapes, the usual case
	 * - the name a collision shape file was preloaded under, paired with
	 *   {@link BodyDefinitionInit.id}
	 * - the exported fixtures themselves, for a file read by hand
	 *
	 * Shapes are OWNED by the body they are given to, and a rotating body
	 * mutates them in place, so never share one array between two bodies.
	 * Naming the file instead sidesteps this: every body resolved from it
	 * mints its own shapes.
	 */
	shapes: BodyShape[] | ShapeEntry[] | string;
	/**
	 * Which body to read out of the file, when `shapes` names one. A
	 * collision shape file usually holds a map of body name to fixtures, and
	 * this is the name the shapes were authored under.
	 *
	 * Not needed for a single-body export, where the file IS one body's
	 * fixture list with no map above it; there is nothing for an id to name,
	 * and the whole file is used.
	 */
	id?: string;
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
	 * supports {@link PhysicsAdapter.raycast3d}. 2D-only adapters
	 * (matter, planck) report `false` and omit the method; users can
	 * branch on this flag before calling
	 * `world.adapter.raycast3d?.(...)` to skip a no-op delegation.
	 */
	raycasts3d: boolean;
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
	renderable: Renderable;
	/** world-space hit point */
	point: Vector2d;
	/** surface normal at the hit point */
	normal: Vector2d;
	/** position along the ray, `0..1` from `from` to `to` */
	fraction: number;
}

/**
 * Result of a successful {@link PhysicsAdapter.raycast3d}. Same
 * shape as {@link RaycastHit}, with Vector3d in place of Vector2d.
 * 3D adapters approximate each renderable's collision volume as a
 * bounding sphere centred on `renderable.getAbsolutePosition()`
 * with radius = the renderable's bounds circumradius — same model
 * `Camera3d.isVisible` uses for frustum culling.
 */
export interface RaycastHit3d {
	/** the renderable the ray hit */
	renderable: Renderable;
	/** world-space hit point (sphere entry) */
	point: Vector3d;
	/** surface normal at the hit point (outward from sphere centre) */
	normal: Vector3d;
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
	 * Optional display name reported on the startup banner. Falls back to the
	 * adapter's `physicLabel`, then its class name — avoid relying on the latter,
	 * as it is mangled in minified builds. Third-party packages typically set
	 * this to their npm package id (e.g. `"@melonjs/matter-adapter"`).
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
	init?(world: World): void;

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
	syncToPhysics?(renderable: Renderable): void;

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
	addBody(renderable: Renderable, def: BodyDefinition): PhysicsBody;

	/**
	 * Unregister a body. Called automatically when `Container.removeChild`
	 * detaches the renderable; direct calls are the inverse of a direct
	 * `addBody` (rare — use `removeChild` for the normal lifecycle).
	 */
	removeBody(renderable: Renderable): void;

	/** Replace the body's collision geometry without re-creating the body. */
	updateShape?(renderable: Renderable, shapes: BodyShape[]): void;

	/**
	 * Portable velocity / force / position API. Every adapter implements
	 * these by routing to its native engine. Use these instead of
	 * mutating the body handle directly when writing adapter-agnostic
	 * code.
	 */
	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d;
	setVelocity(renderable: Renderable, v: Vector2d): void;
	applyForce(renderable: Renderable, force: Vector2d, point?: Vector2d): void;
	applyImpulse(
		renderable: Renderable,
		impulse: Vector2d,
		point?: Vector2d,
	): void;
	setPosition(renderable: Renderable, p: Vector2d): void;
	setAngle?(renderable: Renderable, angle: number): void;
	/** Read absolute rotation angle (radians). Returns 0 if not tracked. */
	getAngle?(renderable: Renderable): number;
	/** Set angular velocity (rad / frame). */
	setAngularVelocity?(renderable: Renderable, omega: number): void;
	/** Read angular velocity (rad / frame). Returns 0 if not tracked. */
	getAngularVelocity?(renderable: Renderable): number;
	/** Apply an angular impulse (`Δω = τ / inertia`). */
	applyTorque?(renderable: Renderable, torque: number): void;

	/**
	 * Runtime body-property mutators. Each maps to the corresponding
	 * {@link BodyDefinition} field and lets game code change a body's
	 * physical properties without re-creating it. Adapter implementations
	 * route to their native engine (BuiltinAdapter writes to the `Body`
	 * handle; MatterAdapter calls Matter's `Body.set*` helpers).
	 */
	setStatic(renderable: Renderable, isStatic: boolean): void;
	setGravityScale(renderable: Renderable, scale: number): void;
	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void;
	setMaxVelocity(renderable: Renderable, limit: { x: number; y: number }): void;
	/**
	 * Read the body's current velocity cap (mirror of
	 * {@link setMaxVelocity}). Returns plain `{x, y}` so callers don't
	 * need to import a vector type. Optional — adapters that don't
	 * implement velocity caps omit this method.
	 */
	getMaxVelocity?(renderable: Renderable): {
		x: number;
		y: number;
	};
	setCollisionType(renderable: Renderable, type: number): void;
	setCollisionMask(renderable: Renderable, mask: number): void;
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
	setSensor?(renderable: Renderable, isSensor: boolean): void;

	/**
	 * Whether the body has at least one active contact with a surface
	 * below it (collision normal pointing up). Capability-gated by
	 * {@link AdapterCapabilities.isGrounded}. melonJS extension — Matter
	 * has no direct equivalent and the MatterAdapter implements it by
	 * scanning active pairs each call.
	 */
	isGrounded?(renderable: Renderable): boolean;

	/**
	 * Spatial queries.
	 *
	 * `raycast` is capability-gated by {@link AdapterCapabilities.raycasts}.
	 * Adapters that don't support it may omit the method entirely
	 * (`typeof adapter.raycast === "function"`).
	 *
	 * `queryAABB` is mandatory — every adapter must support a region query
	 * (a broadphase walk is already needed for collision detection, so
	 * exposing it costs nothing).
	 */
	raycast?(from: Vector2d, to: Vector2d): RaycastHit | null;
	/**
	 * Optional 3D variant of {@link PhysicsAdapter.raycast}. Walks
	 * the world's {@link Octree} (active only under `cameraClass:
	 * Camera3d`) and returns the nearest renderable whose bounding
	 * sphere the ray intersects. 2D adapters omit this method;
	 * call sites should check `capabilities.raycasts3d` first.
	 */
	raycast3d?(from: Vector3d, to: Vector3d): RaycastHit3d | null;
	queryAABB(rect: Rect): Renderable[];
	/**
	 * Optional 3D sphere region query — returns renderables whose
	 * `getAbsolutePosition()` lies within `radius` of `center`.
	 * The narrow phase is a point-in-sphere test against each
	 * candidate's centre; callers wanting bounding-sphere overlap
	 * should intersect with the candidate's bounds afterwards.
	 *
	 * Two call shapes:
	 * - `querySphere(center: Vector3d, radius: number)` — loose form
	 * - `querySphere(sphere: Sphere)` — packaged form, the
	 *   idiomatic surface once a query shape needs to be passed
	 *   around or cached
	 *
	 * Active only under a 3D broadphase ({@link Octree}, set when
	 * `world.sortOn === "depth"`). Adapters that don't expose a 3D
	 * spatial index omit the method.
	 * @example
	 * // Loose form — quick one-off query:
	 * const nearby = world.adapter.querySphere?.(enemy.pos, HIT_RADIUS);
	 * @example
	 * // Idiomatic form — give an entity its own bounding sphere and
	 * // reuse it each frame:
	 * import { Sphere } from "melonjs";
	 *
	 * class Enemy extends Renderable {
	 *   collider = new Sphere(0, 0, 0, 30);
	 *
	 *   update(dt) {
	 *     // keep the sphere glued to this renderable's pose
	 *     this.collider.pos.set(this.pos.x, this.pos.y, this.pos.z);
	 *     // query — returns every renderable whose centre is within
	 *     // this enemy's collider
	 *     const nearby = world.adapter.querySphere?.(this.collider) ?? [];
	 *     for (const r of nearby) {
	 *       // narrow-phase / kind filter / etc.
	 *     }
	 *     return super.update(dt);
	 *   }
	 * }
	 */
	querySphere?(center: Vector3d, radius: number): Renderable[];
	querySphere?(sphere: Sphere): Renderable[];

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
	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined;

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
	getBodyShapes(renderable: Renderable): readonly BodyShape[];
}
