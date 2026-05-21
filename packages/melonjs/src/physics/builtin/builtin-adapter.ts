import type { Rect } from "../../geometries/rectangle.ts";
import { Vector2d } from "../../math/vector2d.ts";
import type Renderable from "../../renderable/renderable.js";
import state from "../../state/state.ts";
import type {
	AdapterCapabilities,
	AdapterOptions,
	BodyDefinition,
	BodyShape,
	PhysicsAdapter,
	RaycastHit,
} from "../adapter.ts";
import type { Bounds } from "../bounds.ts";
import type World from "../world.js";
import Body from "./body.js";
import Detector from "./detector.js";
import { raycastQuery } from "./raycast.ts";

/**
 * Default {@link PhysicsAdapter} that wraps melonJS's native SAT-based
 * physics. Owns the active body set, the {@link Detector}, gravity, and
 * the simulation step. Returns the legacy {@link Body} class as its body
 * handle so existing property-based game code (`body.vel.x = 5`,
 * `body.isStatic = true`) keeps working unchanged.
 *
 * Instantiated by default during `Application` construction; user code
 * only touches this directly when explicitly wiring it via
 * `new Application(w, h, { physic: { adapter: new BuiltinAdapter() } })`.
 * @category Physics
 */
export default class BuiltinAdapter implements PhysicsAdapter {
	/**
	 * Short adapter identifier exposed as `world.physic`. Lets user code
	 * branch on the active physics implementation without importing the
	 * concrete adapter class.
	 */
	readonly physicLabel = "builtin";

	/**
	 * Advertised capabilities; user code may branch on these.
	 */
	readonly capabilities: AdapterCapabilities = {
		constraints: false,
		continuousCollisionDetection: false,
		sleepingBodies: false,
		raycasts: true,
		velocityLimit: true,
		isGrounded: true,
	};

	/**
	 * World gravity. Mutate to change at runtime.
	 * @default <0, 0.98>
	 */
	gravity: Vector2d;

	/**
	 * Active physics bodies in this simulation.
	 */
	readonly bodies: Set<Body> = new Set();

	/**
	 * Collision detector instance, created in {@link init}.
	 */
	detector!: Detector;

	/**
	 * Back-reference to the owning world, set in {@link init}.
	 */
	private world!: World;

	constructor(options: AdapterOptions = {}) {
		this.gravity = options.gravity ?? new Vector2d(0, 0.98);
	}

	init(world: World): void {
		this.world = world;
		this.detector = new Detector(world);
	}

	destroy(): void {
		this.bodies.clear();
	}

	step(dt: number): void {
		const isPaused = state.isPaused();
		// open the per-frame collision diff so the detector can synthesize
		// start/end events on top of SAT's frame-by-frame overlap reports
		this.detector.beginFrame();
		// iterate through all bodies
		for (const body of this.bodies) {
			const ancestor = body.ancestor;
			if (!body.isStatic && ancestor) {
				// if the game is not paused, and ancestor can be updated
				if (
					!(isPaused && !ancestor.updateWhenPaused) &&
					(ancestor.inViewport || ancestor.alwaysUpdate)
				) {
					this.applyGravity(body);
					// `Body.update` is documented `@protected` in body.js
					// JSDoc, but the adapter is its sole legitimate caller
					// (the adapter step IS what advances the body). The
					// JSDoc also documents a `dt` param the runtime ignores
					// (it uses `timer.tick` instead); we pass it through
					// anyway for future compatibility / legibility.
					// @ts-expect-error -- @protected method called from the adapter that owns the body lifecycle
					if (body.update(dt)) {
						ancestor.isDirty = true;
					}
					this.detector.collisions(ancestor);
				}
			}
			// Always clear the force accumulator each step — even for static
			// bodies, out-of-viewport bodies, and paused bodies. Otherwise a
			// stray applyForce call would leak indefinitely and fire as a
			// surprise impulse when the body becomes simulatable again.
			body.force.set(0, 0);
		}
		// fire onCollisionEnd for pairs that separated this step
		this.detector.endFrame();
	}

	syncFromPhysics(): void {
		// No-op: BuiltinAdapter mutates `renderable.pos` directly during
		// `step` via `body.update(dt)`, so there is nothing to copy back
		// after the step.
	}

	addBody(renderable: Renderable, def: BodyDefinition): Body {
		// Returns the legacy `Body` class as the body handle; the field
		// is also written to `renderable.body` so property-based code
		// keeps working.
		//
		// Two entry points converge here:
		// 1. Explicit (preferred): `world.adapter.addBody(this, { type: "dynamic", shapes: [...] })`
		// 2. Legacy migration: `this.body = new Body(this, shapes)` already
		//    created a body but it wasn't registered with the adapter yet;
		//    we register the existing instance and map any supplied def
		//    fields onto it.
		//
		// Pick ONE registration path per body. Calling `addBody` twice on
		// the same renderable after it's already adapter-managed throws —
		// the second call is a programming error.
		let body = renderable.body as Body | undefined;
		const isAlreadyAdapterManaged =
			body instanceof Body && this.bodies.has(body);
		if (isAlreadyAdapterManaged) {
			throw new Error(
				"BuiltinAdapter.addBody: renderable is already adapter-managed. " +
					"Use adapter.updateShape() / property mutation / adapter.removeBody() " +
					"first if you need to change the body.",
			);
		}
		if (!(body instanceof Body)) {
			body = new Body(renderable, def.shapes);
			renderable.body = body;
		} else if (def.shapes.length > 0) {
			// legacy-bridge path: replace existing shapes if the def
			// provides them (otherwise keep what the user already built).
			// `body.shapes` is typed in body.js as a union that includes a
			// scalar `Point` variant — never used at runtime, but TS sees
			// it so `.length` doesn't narrow. Cast to the array form.
			(body.shapes as BodyShape[]).length = 0;
			body.getBounds().clear();
			for (const s of def.shapes) {
				body.addShape(s);
			}
		}
		// map portable BodyDefinition fields onto Body properties
		body.setStatic(def.type === "static");
		if (typeof def.collisionType === "number") {
			body.collisionType = def.collisionType;
		}
		if (typeof def.collisionMask === "number") {
			body.collisionMask = def.collisionMask;
		}
		if (def.frictionAir !== undefined) {
			if (typeof def.frictionAir === "number") {
				body.setFriction(def.frictionAir, def.frictionAir);
			} else {
				body.setFriction(def.frictionAir.x, def.frictionAir.y);
			}
		}
		if (typeof def.restitution === "number") {
			body.bounce = def.restitution;
		}
		if (typeof def.density === "number") {
			body.mass = def.density;
		}
		if (typeof def.gravityScale === "number") {
			body.gravityScale = def.gravityScale;
		}
		if (def.maxVelocity !== undefined) {
			body.setMaxVelocity(def.maxVelocity.x, def.maxVelocity.y);
		}
		if (def.isSensor === true) {
			body.isSensor = true;
		}
		this.bodies.add(body);
		return body;
	}

	removeBody(renderable: Renderable): void {
		const body = renderable.body;
		if (body instanceof Body) {
			this.bodies.delete(body);
		}
	}

	updateShape(renderable: Renderable, shapes: BodyShape[]): void {
		const body = renderable.body;
		if (!(body instanceof Body)) {
			return;
		}
		// clear existing shapes, then add new ones. `body.shapes` is
		// typed too widely (see `addBody`); cast to the array form.
		(body.shapes as BodyShape[]).length = 0;
		body.getBounds().clear();
		for (const s of shapes) {
			body.addShape(s);
		}
	}

	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		const body = renderable.body as Body | undefined;
		const target = out ?? new Vector2d();
		// after removeBody the body reference may still dangle on the
		// renderable — return zero so the behaviour matches adapters that
		// fully forget the body (e.g. MatterAdapter clears its bodyMap).
		if (!body || !this.bodies.has(body)) {
			return target.set(0, 0);
		}
		return target.set(body.vel.x, body.vel.y);
	}

	setVelocity(renderable: Renderable, v: Vector2d): void {
		(renderable.body as Body).vel.setV(v);
	}

	applyForce(renderable: Renderable, force: Vector2d, point?: Vector2d): void {
		// When `point` is provided and differs from the body's centroid,
		// `Body.applyForce`'s 4-arg form generates a torque from the lever
		// arm (`τ = r × F`). The 2-arg call (no point) preserves the
		// pre-angular behavior exactly: just accumulate into the linear
		// force vector.
		const body = renderable.body as Body;
		if (point) {
			body.applyForce(force.x, force.y, point.x, point.y);
		} else {
			body.applyForce(force.x, force.y);
		}
	}

	applyImpulse(renderable: Renderable, impulse: Vector2d): void {
		// impulse = mass * dv  →  dv = impulse / mass
		const body = renderable.body as Body;
		const invMass = body.mass > 0 ? 1 / body.mass : 0;
		body.vel.x += impulse.x * invMass;
		body.vel.y += impulse.y * invMass;
	}

	setPosition(renderable: Renderable, p: Vector2d): void {
		// `pos` is an ObservableVector3d on Renderable; preserve the
		// existing Z (`pos.z` is the depth field, set independently).
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
	}

	setAngle(renderable: Renderable, angle: number): void {
		// Under BuiltinAdapter the rotation is *visual only* — SAT
		// collisions remain axis-aligned against the original shapes —
		// but the renderable's `currentTransform` is updated so the
		// sprite rotates correctly.
		(renderable.body as Body).setAngle(angle);
	}

	getAngle(renderable: Renderable): number {
		return (renderable.body as Body).angle;
	}

	setAngularVelocity(renderable: Renderable, omega: number): void {
		(renderable.body as Body).setAngularVelocity(omega);
	}

	getAngularVelocity(renderable: Renderable): number {
		return (renderable.body as Body).angularVelocity;
	}

	applyTorque(renderable: Renderable, torque: number): void {
		(renderable.body as Body).applyTorque(torque);
	}

	setStatic(renderable: Renderable, isStatic: boolean): void {
		(renderable.body as Body).setStatic(isStatic);
	}

	setGravityScale(renderable: Renderable, scale: number): void {
		(renderable.body as Body).gravityScale = scale;
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = renderable.body as Body;
		if (typeof friction === "number") {
			body.setFriction(friction, friction);
		} else {
			body.setFriction(friction.x, friction.y);
		}
	}

	setMaxVelocity(
		renderable: Renderable,
		limit: { x: number; y: number },
	): void {
		(renderable.body as Body).setMaxVelocity(limit.x, limit.y);
	}

	getMaxVelocity(renderable: Renderable): { x: number; y: number } {
		const v = (renderable.body as Body).maxVel;
		return { x: v.x, y: v.y };
	}

	setCollisionType(renderable: Renderable, type: number): void {
		(renderable.body as Body).collisionType = type;
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		(renderable.body as Body).setCollisionMask(mask);
	}

	setSensor(renderable: Renderable, isSensor: boolean): void {
		// A sensor body still fires collision events (`onCollisionStart` /
		// `onCollisionActive` / `onCollisionEnd`) — the SAT detector skips
		// only the positional push-out (`respondToCollision`). Same
		// semantics as Matter's `isSensor`, so adapter-agnostic trigger /
		// one-way-platform code behaves identically on both adapters.
		(renderable.body as Body).isSensor = isSensor;
	}

	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined {
		// Adapter-side debug surface: the body's AABB in renderable-local
		// coordinates. Builtin Body already stores its bounds in local
		// space, so we just copy into the caller's `out`. Gated on
		// `this.bodies.has(body)` (same predicate as `getVelocity`) so a
		// dangling Body reference left on `renderable.body` after
		// `removeBody` matches the adapter contract — returns
		// `undefined` for an unregistered body.
		const body = renderable.body as Body | undefined;
		if (!body || !this.bodies.has(body)) {
			return undefined;
		}
		const b = body.bounds;
		out.setMinMax(b.min.x, b.min.y, b.max.x, b.max.y);
		return out;
	}

	getBodyShapes(renderable: Renderable): readonly BodyShape[] {
		// Adapter-side debug surface: live `shapes` list in renderable-
		// local coordinates. Read-only — callers must not mutate.
		// Gated on `this.bodies.has(body)` to match the adapter contract:
		// an unregistered body (or no body) returns an empty array.
		// `body.shapes` is typed in body.js as a union that includes a
		// scalar `Point` variant (legacy, never produced at runtime).
		const body = renderable.body as Body | undefined;
		if (!body || !this.bodies.has(body)) {
			return [];
		}
		return body.shapes as BodyShape[];
	}

	isGrounded(renderable: Renderable): boolean {
		// Derived from the SAT body's `falling` flag, updated by the
		// detector each frame: a body is grounded when it's not currently
		// moving downward off a surface.
		const body = renderable.body as Body;
		return !body.falling && !body.jumping;
	}

	raycast(from: Vector2d, to: Vector2d): RaycastHit | null {
		// Goes through the same SAT-based broadphase walk as the legacy
		// `Detector.rayCast` (both share `raycastQuery` in `./raycast.ts`),
		// and returns the portable `RaycastHit` shape (`renderable`,
		// `point`, `normal`, `fraction`) for parity with the matter /
		// planck adapters. `point` is the precise parametric entry point
		// on the shape surface (line-segment vs polygon edges, quadratic
		// ray vs ellipse); `normal` is the outward-facing surface normal
		// at that entry; `fraction` is `0..1` along the ray.
		const hits = raycastQuery(this.world, from.x, from.y, to.x, to.y);
		return hits[0] ?? null;
	}

	queryAABB(rect: Rect): Renderable[] {
		// Walks the SAT broadphase quadtree to get a candidate set then
		// filters by actual AABB overlap, so output is the precise
		// intersection — not just same-partition neighbours. Useful for
		// AoE damage queries, mouse picking, trigger-zone sweeps.
		const queryBounds = rect.getBounds();
		// Pass our own array to `retrieve` so we never touch the
		// broadphase's shared scratch — user code may call this from
		// inside an `onCollisionStart` handler firing mid-iteration of
		// the SAT detector's scratch walk; sharing would clobber the
		// outer iteration. Then filter in place so the call costs a
		// single allocation, not two.
		const result: Renderable[] = [];
		this.world.broadphase.retrieve(rect, undefined, result);
		let writeIdx = 0;
		for (let i = 0, len = result.length; i < len; i++) {
			const r = result[i];
			const b = r.getBounds();
			if (b.overlaps(queryBounds)) {
				result[writeIdx++] = r;
			}
		}
		result.length = writeIdx;
		return result;
	}

	applyGravity(body: Body): void {
		// Backward-compat shim for the legacy `World.bodyApplyGravity`.
		// `ignoreGravity` is deprecated in favor of `gravityScale = 0`
		// (see Body#ignoreGravity JSDoc). Keep both checks until the
		// legacy field is removed — `gravityScale = 0` is the portable
		// path that also works under matter; `ignoreGravity = true` is
		// the legacy path that only this adapter reads.
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy field is read intentionally for backward compatibility
		if (body.gravityScale !== 0 && !body.ignoreGravity) {
			body.force.x += body.mass * this.gravity.x * body.gravityScale;
			body.force.y += body.mass * this.gravity.y * body.gravityScale;
		}
	}
}
