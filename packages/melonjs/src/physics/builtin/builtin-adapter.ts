import type { Rect } from "../../geometries/rectangle.ts";
import { Sphere } from "../../geometries/sphere.ts";
import { warnOnce } from "../../lang/console.js";
import { Quaternion } from "../../math/quaternion.ts";
import { Vector2d } from "../../math/vector2d.ts";
import { Vector3d } from "../../math/vector3d.ts";
import type Renderable from "../../renderable/renderable.js";
import state from "../../state/state.ts";
import type {
	AdapterCapabilities,
	AdapterOptions,
	BodyDefinition,
	BodyShape,
	PhysicsAdapter,
	PhysicsAdapterClass,
	RaycastHit,
	RaycastHit3d,
} from "../adapter.ts";
import type { Bounds } from "../bounds.ts";
import Octree from "../broadphase/octree.ts";
import type World from "../world.js";
import Body from "./body.js";
import Detector from "./detector.js";
import { raycastQuery } from "./raycast.ts";

/**
 * The body of a renderable this adapter manages. `Renderable#body` is the
 * portable `PhysicsBody`, as another adapter puts a body of its own there:
 * here it is the built-in `Body`, and this is where that is checked.
 * @param renderable - a renderable with a body of this adapter
 * @returns its body
 */
function bodyOf(renderable: Renderable): Body {
	const body = renderable.body;
	if (body instanceof Body) {
		return body;
	}
	throw new TypeError("BuiltinAdapter: this renderable has no built-in body");
}

// the axis the built-in bodies turn about, and a scratch for setRotation
const _AXIS_Z = new Vector3d(0, 0, 1);

/** where the warnings about the built-in's 3D limits point to */
const FULL_3D = "For bodies that turn in 3D, use @melonjs/rapier3d-adapter.";
const _rotScratch = new Vector3d();

/** world-space AABB scratch for `raycast3d`; never escapes the call */
const _rayBox = {
	minX: 0,
	minY: 0,
	minZ: 0,
	maxX: 0,
	maxY: 0,
	maxZ: 0,
};

/** reusable hit record for `rayAABB3d`; never escapes `raycast3d` */
const _rayHit = { t: 0, nx: 0, ny: 0, nz: 0 };

/**
 * Fill `out` with the world-space AABB of a renderable's 3D shapes
 * ({@link Box3d} and {@link Sphere}), unioned. Returns `false` when the
 * renderable has no body, or a body with no 3D shape in it — those keep the
 * bounding-sphere path, so no existing `raycast3d` result changes.
 *
 * A sphere contributes the AABB that contains it. A body that is nothing but
 * ONE sphere is measured exactly instead, by {@link worldSphere}, which the
 * ray tries first; this box is what a body mixing the two shapes, or carrying
 * several spheres, degrades to.
 *
 * A shape's world position follows the same convention the SAT narrowphase
 * uses: the renderable's absolute position plus the shape's local offset.
 * @param renderable - the candidate to measure
 * @param cx - the renderable's absolute x
 * @param cy - the renderable's absolute y
 * @param cz - the renderable's absolute z
 * @param out - scratch AABB to fill; only written when this returns `true`
 */
function worldBox3d(
	renderable: Renderable,
	cx: number,
	cy: number,
	cz: number,
	out: typeof _rayBox,
): boolean {
	// `renderable.body` is the PORTABLE handle, and this is the builtin
	// adapter, so narrow to the concrete type rather than asserting it. The
	// cast this replaces only existed because `Renderable.body` was `any`;
	// `instanceof` is both safe and more correct, since a body belonging to
	// another adapter now reports no hit instead of being read as one.
	const body = renderable.body;
	if (!(body instanceof Body) || !body.hasDepth) {
		return false;
	}
	// the same frame the narrowphase measures in, so a ray hits a body where
	// it actually collides rather than where its raw `pos` is
	const anchor = anchorOffset(renderable);
	const ox = cx - anchor.x;
	const oy = cy - anchor.y;
	let found = false;
	const shapes = body.shapes as unknown as {
		type: string;
		isActive?: boolean;
		pos: { x: number; y: number; z: number };
		halfExtents: { x: number; y: number; z: number };
		radius: number;
	}[];
	for (let i = 0, len = shapes.length; i < len; i++) {
		const shape = shapes[i];
		const isSphere = shape.type === "Sphere";
		if (shape.type !== "Box3d" && !isSphere) continue;
		// an inactive shape is out of collision, and raycast3d is a collision
		// query — skip it rather than let it contribute a depth extent (#1590)
		if (shape.isActive === false) continue;
		// a sphere's extent is its radius on all three axes
		const hx = isSphere ? Math.abs(shape.radius) : shape.halfExtents.x;
		const hy = isSphere ? Math.abs(shape.radius) : shape.halfExtents.y;
		const hz = isSphere ? Math.abs(shape.radius) : shape.halfExtents.z;
		const minX = ox + shape.pos.x - hx;
		const minY = oy + shape.pos.y - hy;
		const minZ = cz + shape.pos.z - hz;
		const maxX = ox + shape.pos.x + hx;
		const maxY = oy + shape.pos.y + hy;
		const maxZ = cz + shape.pos.z + hz;
		if (!found) {
			found = true;
			out.minX = minX;
			out.minY = minY;
			out.minZ = minZ;
			out.maxX = maxX;
			out.maxY = maxY;
			out.maxZ = maxZ;
		} else {
			if (minX < out.minX) out.minX = minX;
			if (minY < out.minY) out.minY = minY;
			if (minZ < out.minZ) out.minZ = minZ;
			if (maxX > out.maxX) out.maxX = maxX;
			if (maxY > out.maxY) out.maxY = maxY;
			if (maxZ > out.maxZ) out.maxZ = maxZ;
		}
	}
	return found;
}

/** reusable world-space sphere for `raycast3d`; never escapes it */
const _raySphere = { x: 0, y: 0, z: 0, r: 0 };

/**
 * Fill `out` with the world-space centre and radius of a renderable's body
 * when that body is exactly ONE active {@link Sphere}, and return `true`.
 *
 * Worth its own path because the ray test for a sphere is exact and cheap —
 * the generic fallback below already solves ray-vs-sphere, it just solves it
 * against the renderable's 2D bounds half-diagonal, which for a sphere body
 * is the wrong radius about the wrong centre. A body carrying several shapes,
 * or mixing a sphere with a {@link Box3d}, returns `false` here and is
 * measured as the unioned AABB instead: one sphere cannot stand in for two.
 * @param renderable - the candidate to measure
 * @param cx - the renderable's absolute x
 * @param cy - the renderable's absolute y
 * @param cz - the renderable's absolute z
 * @param out - scratch sphere to fill; only written when this returns `true`
 */
function worldSphere(
	renderable: Renderable,
	cx: number,
	cy: number,
	cz: number,
	out: typeof _raySphere,
): boolean {
	// `renderable.body` is the PORTABLE handle, and this is the builtin
	// adapter, so narrow to the concrete type rather than asserting it. The
	// cast this replaces only existed because `Renderable.body` was `any`;
	// `instanceof` is both safe and more correct, since a body belonging to
	// another adapter now reports no hit instead of being read as one.
	const body = renderable.body;
	if (!(body instanceof Body) || !body.hasDepth) {
		return false;
	}
	const shapes = body.shapes as unknown as {
		type: string;
		isActive?: boolean;
		pos: { x: number; y: number; z: number };
		radius: number;
	}[];
	let only: (typeof shapes)[number] | undefined;
	for (let i = 0, len = shapes.length; i < len; i++) {
		const shape = shapes[i];
		if (shape.isActive === false) continue;
		if (shape.type !== "Sphere" || only !== undefined) {
			return false;
		}
		only = shape;
	}
	if (only === undefined) {
		return false;
	}
	// the same frame the narrowphase measures in; see `worldBox3d`
	const anchor = anchorOffset(renderable);
	out.x = cx - anchor.x + only.pos.x;
	out.y = cy - anchor.y + only.pos.y;
	out.z = cz + only.pos.z;
	out.r = Math.abs(only.radius);
	return true;
}

/** scratch for `anchorOffset`; never escapes its callers */
const _anchor = { x: 0, y: 0 };
/** shared zero, for renderables that place themselves */
const _zeroAnchor = { x: 0, y: 0 };

/**
 * How far a renderable's drawn frame sits from its `pos`, per axis.
 *
 * The narrowphase measures collision shapes from the frame the renderable
 * DRAWS in, which `anchorPoint` shifts by `-size * anchorPoint`, so anything
 * reporting or querying that geometry has to use the same frame or it reads a
 * body half its own size away from where it collides.
 *
 * `applyAnchorTransform === false` is the renderable saying it draws at `pos`
 * with no anchor shift at all, which is what `preDraw` itself reads: a
 * `GLTFModel` sets it outright, and a `Mesh` clears it on the `Camera3d`
 * world-space path, both because they place themselves by their own transform
 * and pivot about their model origin rather than a bounds box. `Number.isFinite`
 * guards a `Container`'s default size of `Infinity`, where `Infinity * 0` would
 * yield `NaN` and poison every position derived from it.
 * @param renderable - the renderable to measure
 * @returns the x and y offsets to subtract, both zero for a corner anchor
 */
function anchorOffset(renderable: Renderable): { x: number; y: number } {
	if (!renderable.applyAnchorTransform) {
		return _zeroAnchor;
	}
	_anchor.x = Number.isFinite(renderable.width)
		? renderable.width * renderable.anchorPoint.x
		: 0;
	_anchor.y = Number.isFinite(renderable.height)
		? renderable.height * renderable.anchorPoint.y
		: 0;
	return _anchor;
}

/**
 * Ray-vs-AABB via the slab method, for `t ∈ [0, 1]` along the segment
 * `from → from + d`. Returns the entry fraction and the face normal of the
 * slab that was entered last (which is the face actually hit), or `null` on
 * a miss.
 *
 * A ray starting inside the box reports `t = 0`, matching the
 * bounding-sphere path's "origin inside → t = 0" convention. Its normal is
 * taken from the axis whose entry plane is nearest behind the origin, which
 * keeps the value well-defined rather than zero.
 * @param from - segment start
 * @param dx - segment delta on x (`to.x - from.x`)
 * @param dy - segment delta on y
 * @param dz - segment delta on z
 * @param box - the world-space AABB to test against
 */
function rayAABB3d(
	from: Vector3d,
	dx: number,
	dy: number,
	dz: number,
	box: typeof _rayBox,
): typeof _rayHit | null {
	let tMin = Number.NEGATIVE_INFINITY;
	let tMax = Number.POSITIVE_INFINITY;
	// axis that produced tMin, and the sign of the face entered
	let axis = 0;
	let sign = -1;

	// x slab
	if (dx === 0) {
		if (from.x < box.minX || from.x > box.maxX) return null;
	} else {
		const inv = 1 / dx;
		let t1 = (box.minX - from.x) * inv;
		let t2 = (box.maxX - from.x) * inv;
		let s = -1;
		if (t1 > t2) {
			const tmp = t1;
			t1 = t2;
			t2 = tmp;
			s = 1;
		}
		if (t1 > tMin) {
			tMin = t1;
			axis = 0;
			sign = s;
		}
		if (t2 < tMax) tMax = t2;
		if (tMin > tMax) return null;
	}

	// y slab
	if (dy === 0) {
		if (from.y < box.minY || from.y > box.maxY) return null;
	} else {
		const inv = 1 / dy;
		let t1 = (box.minY - from.y) * inv;
		let t2 = (box.maxY - from.y) * inv;
		let s = -1;
		if (t1 > t2) {
			const tmp = t1;
			t1 = t2;
			t2 = tmp;
			s = 1;
		}
		if (t1 > tMin) {
			tMin = t1;
			axis = 1;
			sign = s;
		}
		if (t2 < tMax) tMax = t2;
		if (tMin > tMax) return null;
	}

	// z slab
	if (dz === 0) {
		if (from.z < box.minZ || from.z > box.maxZ) return null;
	} else {
		const inv = 1 / dz;
		let t1 = (box.minZ - from.z) * inv;
		let t2 = (box.maxZ - from.z) * inv;
		let s = -1;
		if (t1 > t2) {
			const tmp = t1;
			t1 = t2;
			t2 = tmp;
			s = 1;
		}
		if (t1 > tMin) {
			tMin = t1;
			axis = 2;
			sign = s;
		}
		if (t2 < tMax) tMax = t2;
		if (tMin > tMax) return null;
	}

	// entirely behind the origin, or entirely past the segment end
	if (tMax < 0 || tMin > 1) return null;

	_rayHit.t = tMin < 0 ? 0 : tMin;
	_rayHit.nx = axis === 0 ? sign : 0;
	_rayHit.ny = axis === 1 ? sign : 0;
	_rayHit.nz = axis === 2 ? sign : 0;
	return _rayHit;
}

/**
 * Default {@link PhysicsAdapter} that wraps melonJS's native SAT-based
 * physics. Owns the active body set, the {@link Detector}, gravity, and
 * the simulation step. Returns the legacy {@link Body} class as its body
 * handle so existing property-based game code (`body.vel.x = 5`,
 * `body.isStatic = true`) keeps working unchanged.
 *
 * Instantiated by default during `Application` construction; user code
 * only touches this directly when explicitly wiring it, for example with
 * another gravity:
 * `new Application(w, h, { physic: await BuiltinAdapter.create({ gravity }) })`.
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
		raycasts3d: true,
		// bodies move along Z (velZ, forceZ); they turn about Z only
		bodies3d: true,
		velocityLimit: true,
		isGrounded: true,
	};

	/**
	 * World gravity. Mutate to change at runtime. A {@link Vector3d} given
	 * here (or as the `gravity` option) also pulls along the depth axis, its
	 * `z` added to each body's `forceZ` as `x` and `y` are to its `force`.
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

	/**
	 * Resolves once the adapter can be constructed. The built-in solver is plain JavaScript, loaded with melonJS, so this resolves
	 * at once; it is here so every adapter has the same
	 * {@link PhysicsAdapterClass} API, and code written as
	 * `await BuiltinAdapter.create()` reads the same as for one that loads
	 * WebAssembly first.
	 * @returns a resolved promise
	 */
	static load(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Create an adapter, the same way for every adapter: wait for
	 * {@link BuiltinAdapter.load}, then construct it. Here that is the same as
	 * `new BuiltinAdapter(options)`, which stays supported.
	 * @param options - the constructor's options
	 * @returns the new adapter, an instance of the class `create` is called on
	 * @example
	 * const app = new Application(800, 600, {
	 *     physic: await BuiltinAdapter.create(),
	 * });
	 */
	static async create<T extends PhysicsAdapter>(
		this: PhysicsAdapterClass<T, AdapterOptions>,
		options?: AdapterOptions,
	): Promise<T> {
		await this.load();
		return new this(options);
	}

	constructor(options: AdapterOptions = {}) {
		// kept as given: a Vector3d's z pulls along the depth axis (see step)
		this.gravity = (options.gravity ?? new Vector2d(0, 0.98)) as Vector2d;
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
		// Clear every body's record of which directions it was pushed out of
		// immovable geometry in, BEFORE any of them is stepped.
		//
		// A separate pass rather than the head of the loop below, because that
		// interleaves clearing with resolution: a body's pass reads the record
		// of each body it collides with, and for those it has not reached yet
		// that would still hold the previous step's value. The same scene then
		// settles differently depending on the order bodies were added in.
		//
		// Cleared here rather than in `body.update()` so that bodies the loop
		// skips (static, paused, off-screen) are cleared too: those are still
		// reachable as the *other* side of a contact resolved from a simulated
		// body's pass.
		for (const body of this.bodies) {
			body.immovableBlock = 0;
		}
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
			//
			// `forceZ` is part of that accumulator and MUST be cleared with it:
			// left out, a single frame of input keeps accelerating the body
			// along z forever, because callers set the force per-frame while a
			// key is held and rely on this reset to stop.
			//
			// Guarded because `detector.collisions()` above dispatches user
			// collision handlers, and one of those may have destroyed this very
			// body (`Renderable.destroy()` releases `force` to the pool and
			// leaves it undefined). A body torn down mid-step has no
			// accumulator left to clear.
			if (body.force !== undefined) {
				body.force.set(0, 0);
				body.forceZ = 0;
			}
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
			// `addShape` only ever raises `hasDepth`, so it is cleared with the
			// shapes or a body that drops its last Box3d / Sphere would keep
			// resolving along z. Read-only to users; cast as for `shapes`.
			(body as { hasDepth: boolean }).hasDepth = false;
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

	/**
	 * The built-in physics has no joints (`capabilities.constraints` is
	 * `false`): always returns `null`, which makes {@link World#addJoint}
	 * throw.
	 * @returns `null`
	 */
	addJoint(): null {
		return null;
	}

	/**
	 * Does nothing: the built-in physics has no joints to remove.
	 */
	removeJoint(): void {}

	updateShape(renderable: Renderable, shapes: BodyShape[]): void {
		const body = renderable.body;
		if (!(body instanceof Body)) {
			return;
		}
		// clear existing shapes, then add new ones. `body.shapes` is
		// typed too widely (see `addBody`); cast to the array form.
		(body.shapes as BodyShape[]).length = 0;
		body.getBounds().clear();
		// see `addBody`: cleared with the shapes, raised again by `addShape`
		(body as { hasDepth: boolean }).hasDepth = false;
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

	setVelocity(renderable: Renderable, v: Vector2d | Vector3d): void {
		// a Vector3d also sets the velocity along the depth axis; a Vector2d
		// has no `z`, which leaves it as it was
		bodyOf(renderable).setVelocity(v.x, v.y, (v as Vector3d).z);
	}
	getVelocity3d(renderable: Renderable, out?: Vector3d): Vector3d {
		const body = renderable.body as Body | undefined;
		const target = out ?? new Vector3d();
		// see getVelocity: a removed body reads as still
		if (!body || !this.bodies.has(body)) {
			return target.set(0, 0, 0);
		}
		return target.set(body.vel.x, body.vel.y, body.velZ);
	}

	applyForce(
		renderable: Renderable,
		force: Vector2d | Vector3d,
		point?: Vector2d | Vector3d,
	): void {
		// When `point` is provided and differs from the body's centroid,
		// `Body.applyForce`'s 4-arg form generates a torque from the lever
		// arm (`τ = r × F`). The 2-arg call (no point) preserves the
		// pre-angular behavior exactly: just accumulate into the linear
		// force vector.
		const body = bodyOf(renderable);
		if (point) {
			body.applyForce(force.x, force.y, point.x, point.y);
		} else {
			body.applyForce(force.x, force.y);
		}
		// a Vector3d also pushes along the depth axis; the built-in bodies
		// turn about Z only, so a point adds no turn from it
		const fz = (force as Vector3d).z;
		if (typeof fz === "number") {
			body.forceZ += fz;
		}
	}

	applyImpulse(renderable: Renderable, impulse: Vector2d | Vector3d): void {
		// impulse = mass * dv  →  dv = impulse / mass. A Vector3d also kicks
		// along the depth axis; a Vector2d has no `z`, which leaves it alone
		bodyOf(renderable).applyImpulse(
			impulse.x,
			impulse.y,
			(impulse as Vector3d).z,
		);
	}

	/**
	 * Move a renderable and its body. A {@link Vector3d} also sets the depth
	 * of a body that lives in 3D, one with a {@link Box3d}, {@link Sphere} or
	 * other 3D shape; a flat body keeps its depth, which in a 2D game is its
	 * draw order, whatever it is given. So `setPosition(bullet, gun.pos)`
	 * (a renderable's `pos` is a 3D vector at run time) moves a flat bullet
	 * without moving it in front of or behind anything.
	 * @param renderable - the body's renderable
	 * @param p - the new position, in `renderable.pos` space
	 */
	setPosition(renderable: Renderable, p: Vector2d | Vector3d): void {
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
		const z = (p as Vector3d).z;
		const body = renderable.body as Body | undefined;
		if (typeof z === "number" && body?.hasDepth === true) {
			renderable.depth = z;
		}
	}

	setAngle(renderable: Renderable, angle: number): void {
		// Under BuiltinAdapter the rotation is *visual only* — SAT
		// collisions remain axis-aligned against the original shapes —
		// but the renderable's `currentTransform` is updated so the
		// sprite rotates correctly.
		bodyOf(renderable).setAngle(angle);
	}

	getAngle(renderable: Renderable): number {
		return bodyOf(renderable).angle;
	}
	/**
	 * The body's orientation: its turn about Z, the only one the built-in
	 * bodies have.
	 * @param renderable - the body's renderable
	 * @param [out] - the quaternion to write into
	 * @returns the turn about Z, as a quaternion
	 */
	getRotation(renderable: Renderable, out?: Quaternion): Quaternion {
		const angle = (renderable.body as Body | undefined)?.angle ?? 0;
		return (out ?? new Quaternion()).identity().rotate(angle, _AXIS_Z);
	}
	/**
	 * Turn the body to an orientation. The built-in bodies turn about Z
	 * only, so the part of `q` about Z is applied (the turn that takes +X
	 * to where `q` takes it, seen down Z) and the rest is left out.
	 * @param renderable - the body's renderable
	 * @param q - the orientation
	 */
	setRotation(renderable: Renderable, q: Quaternion): void {
		// a turn with a part about X or Y: say once what is left out
		if (Math.abs(q.x) > 1e-6 || Math.abs(q.y) > 1e-6) {
			warnOnce(
				`melonJS: the built-in physics turns bodies about Z only, so setRotation() keeps the part of a turn about Z. ${FULL_3D}`,
			);
		}
		q.apply(_rotScratch.set(1, 0, 0));
		const planar =
			_rotScratch.x * _rotScratch.x + _rotScratch.y * _rotScratch.y;
		// a turn that takes +X (all but float noise) along Z has no part
		// about Z, and neither has one that is not a number: the angle stays
		if (!(planar >= 1e-12) || !Number.isFinite(planar)) {
			return;
		}
		bodyOf(renderable).setAngle(Math.atan2(_rotScratch.y, _rotScratch.x));
	}
	/**
	 * The body's angular velocity about each axis: about Z only, as the
	 * built-in bodies turn.
	 * @param renderable - the body's renderable
	 * @param [out] - the vector to write into
	 * @returns `(0, 0, ω)`
	 */
	getAngularVelocity3d(renderable: Renderable, out?: Vector3d): Vector3d {
		const omega = (renderable.body as Body | undefined)?.angularVelocity ?? 0;
		return (out ?? new Vector3d()).set(0, 0, omega);
	}

	setAngularVelocity(renderable: Renderable, omega: number | Vector3d): void {
		if (
			typeof omega !== "number" &&
			((omega.x !== 0 && Number.isFinite(omega.x)) ||
				(omega.y !== 0 && Number.isFinite(omega.y)))
		) {
			warnOnce(
				`melonJS: the built-in physics turns bodies about Z only, so setAngularVelocity() keeps the spin about Z. ${FULL_3D}`,
			);
		}
		// a Vector3d's turn about Z, the only one the built-in bodies have
		bodyOf(renderable).setAngularVelocity(
			typeof omega === "number" ? omega : omega.z,
		);
	}

	getAngularVelocity(renderable: Renderable): number {
		return bodyOf(renderable).angularVelocity;
	}

	applyTorque(renderable: Renderable, torque: number): void {
		bodyOf(renderable).applyTorque(torque);
	}

	setStatic(renderable: Renderable, isStatic: boolean): void {
		bodyOf(renderable).setStatic(isStatic);
	}

	setGravityScale(renderable: Renderable, scale: number): void {
		bodyOf(renderable).gravityScale = scale;
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = bodyOf(renderable);
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
		bodyOf(renderable).setMaxVelocity(limit.x, limit.y);
	}

	getMaxVelocity(renderable: Renderable): { x: number; y: number } {
		const v = bodyOf(renderable).maxVel;
		return { x: v.x, y: v.y };
	}

	setCollisionType(renderable: Renderable, type: number): void {
		bodyOf(renderable).collisionType = type;
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		bodyOf(renderable).setCollisionMask(mask);
	}

	setSensor(renderable: Renderable, isSensor: boolean): void {
		// A sensor body still fires collision events (`onCollisionStart` /
		// `onCollisionActive` / `onCollisionEnd`) — the SAT detector skips
		// only the positional push-out (`respondToCollision`). Same
		// semantics as Matter's `isSensor`, so adapter-agnostic trigger /
		// one-way-platform code behaves identically on both adapters.
		bodyOf(renderable).isSensor = isSensor;
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
		// same frame as `getBodyShapes`: where the body collides, which is
		// the renderable's drawn frame rather than raw `pos`
		const { x: ax, y: ay } = anchorOffset(renderable);
		out.setMinMax(b.min.x - ax, b.min.y - ay, b.max.x - ax, b.max.y - ay);
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
		const src = body.shapes as BodyShape[];
		// Reported in the frame the body actually collides in. The stored
		// shapes stay exactly as authored — the anchor offset is applied by
		// the narrowphase, not baked into them, so that the rotation pivot,
		// `applyForce`'s lever arm and the shape pools all keep reading the
		// coordinates the caller wrote. Reporting those raw would put the
		// debug overlay half a body away from where the collision happens.
		const { x: ax, y: ay } = anchorOffset(renderable);
		if (ax === 0 && ay === 0) {
			// the overwhelmingly common case, and the one `Entity` and Tiled
			// objects always take: hand back the live list, allocating nothing
			return src;
		}
		// Anything else needs shifted copies, since the live shapes must not
		// be mutated. Only debug consumers read this, and only for a body
		// whose renderable is not corner-anchored.
		const shifted = src.map((shape) => {
			const copy = shape.clone();
			// Written component-wise, not through `pos.set(x, y)`. A `Box3d`
			// and a `Sphere` carry a `Vector3d` here and `Vector3d.set(x, y)`
			// defaults z to 0, so the two-argument call silently flattened
			// every 3D shape's depth offset onto the renderable's own depth,
			// which put the debug overlay's wireframe at the wrong altitude.
			// `clone()` has already carried z across.
			copy.pos.x = shape.pos.x - ax;
			copy.pos.y = shape.pos.y - ay;
			return copy;
		});
		return shifted;
	}

	isGrounded(renderable: Renderable): boolean {
		// The interface's rule: a surface under the body, one this step's
		// collisions pushed it up out of. The `falling` / `jumping` flags
		// keep their say (a body rising past a ledge it grazes is still
		// airborne), but alone they called a body grounded whenever it was
		// not moving down: one never stepped, or held still in the air with
		// no gravity.
		const body = bodyOf(renderable);
		return body.onSurface && !body.falling && !body.jumping;
	}

	/**
	 * Always `false`: the builtin simulation steps every body each frame and
	 * has no sleeping (`capabilities.sleepingBodies` is `false`).
	 * @param _renderable - the renderable whose body to read
	 * @returns `false`
	 */
	isSleeping(_renderable: Renderable): boolean {
		return false;
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

	raycast3d(from: Vector3d, to: Vector3d): RaycastHit3d | null {
		// Available only when the broadphase is an Octree (i.e. the
		// active camera's sortOn is "depth"). Under a 2D sortOn the
		// world's broadphase is a QuadTree and there's no z partition
		// to walk, so we return null. User code can guard via
		// `world.adapter.capabilities.raycasts3d` AND
		// `world.sortOn === "depth"` to skip a no-op call.
		const octree = this.world.broadphase;
		if (this.world.sortOn !== "depth" || !(octree instanceof Octree)) {
			return null;
		}

		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const dz = to.z - from.z;

		// Broadphase walk: only visit octants the ray segment
		// (`from` → `to`, `t ∈ [0, 1]`) actually crosses, via slab
		// AABB tests at each node. Strictly tighter candidate set
		// than enclosing the segment in a single AABB — saves the
		// per-candidate narrow-phase cost on long rays whose
		// segment-AABB would cover most of the scene.
		const candidates: Renderable[] = [];
		octree.queryRay(from.x, from.y, from.z, dx, dy, dz, 1, candidates);

		let bestFraction = Number.POSITIVE_INFINITY;
		let bestRenderable: Renderable | null = null;
		let bestEntryT = 0;

		let bestNx = 0;
		let bestNy = 0;
		let bestNz = 0;

		for (let i = 0, len = candidates.length; i < len; i++) {
			const r = candidates[i];
			if (typeof r.getAbsolutePosition !== "function") continue;
			const center = r.getAbsolutePosition();
			const cx = center.x;
			const cy = center.y;
			// `getAbsolutePosition()` returns Vector3d; the engine's
			// stale .js typings expose Vector2d as the union member,
			// so `.z` may not be visible to TS even though it's
			// always present at runtime.
			const cz = (center as { z?: number }).z ?? 0;

			// Exact ray-vs-AABB when this renderable carries a 3D body,
			// which is the case that matters: probing floor height under a
			// character. Everything else keeps the bounding-sphere path
			// below, so no existing raycast3d result changes.
			//
			// A body that is one sphere skips this and goes through the path
			// below with its OWN centre and radius, which is exact for a
			// sphere where an AABB is not.
			const isSphereBody = worldSphere(r, cx, cy, cz, _raySphere);
			if (!isSphereBody && worldBox3d(r, cx, cy, cz, _rayBox)) {
				const hit = rayAABB3d(from, dx, dy, dz, _rayBox);
				if (hit === null) continue;
				if (hit.t < bestFraction) {
					bestFraction = hit.t;
					bestRenderable = r;
					bestEntryT = hit.t;
					bestNx = hit.nx;
					bestNy = hit.ny;
					bestNz = hit.nz;
				}
				continue;
			}

			// A sphere body is measured as itself. Everything else falls back
			// to a bounding sphere of radius = bounds half-diagonal (matching
			// `Camera3d.isVisible`'s circumradius convention), centred on the
			// renderable.
			let sx = cx;
			let sy = cy;
			let sz = cz;
			let radius: number;
			if (isSphereBody) {
				sx = _raySphere.x;
				sy = _raySphere.y;
				sz = _raySphere.z;
				radius = _raySphere.r;
			} else {
				const bounds = r.getBounds();
				const w = bounds.width;
				const h = bounds.height;
				radius = Math.sqrt(w * w + h * h) * 0.5;
			}
			// Ray–sphere intersection in parametric form: solve
			//   |from + t·(to − from) − center|² = r²
			// for t ∈ [0, 1]. Take the smaller root (entry).
			const ox = from.x - sx;
			const oy = from.y - sy;
			const oz = from.z - sz;
			const a = dx * dx + dy * dy + dz * dz;
			if (a === 0) continue;
			const b = 2 * (ox * dx + oy * dy + oz * dz);
			const c = ox * ox + oy * oy + oz * oz - radius * radius;
			const disc = b * b - 4 * a * c;
			if (disc < 0) continue;
			const sqrtDisc = Math.sqrt(disc);
			const t0 = (-b - sqrtDisc) / (2 * a);
			const t1 = (-b + sqrtDisc) / (2 * a);
			// Hit table (t0 < t1 always when the ray crosses the
			// sphere):
			//   t0 ∈ [0, 1]            — segment enters in-range; t=t0
			//   t0 < 0 ≤ t1            — `from` is inside the sphere; t=0
			//   t0 < 0 and t1 < 0      — sphere behind `from`; miss
			//   t0 > 1                 — sphere past `to`; miss
			// The `t1 ≥ 0` guard on the inside-sphere branch is
			// independent of whether `t1` is ≤ 1, because a sphere
			// that fully encloses the segment (t0 < 0, t1 > 1)
			// still counts as a t=0 hit at the ray origin.
			let t: number;
			if (t0 >= 0 && t0 <= 1) {
				t = t0;
			} else if (t0 < 0 && t1 >= 0) {
				t = 0;
			} else {
				continue;
			}
			if (t < bestFraction) {
				bestFraction = t;
				bestRenderable = r;
				bestEntryT = t;
				// sphere normal, resolved at the entry point
				const px = from.x + dx * t;
				const py = from.y + dy * t;
				const pz = from.z + dz * t;
				const ux = px - sx;
				const uy = py - sy;
				const uz = pz - sz;
				const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
				bestNx = ux / uLen;
				bestNy = uy / uLen;
				bestNz = uz / uLen;
			}
		}

		if (bestRenderable === null) {
			return null;
		}

		return {
			renderable: bestRenderable,
			point: new Vector3d(
				from.x + dx * bestEntryT,
				from.y + dy * bestEntryT,
				from.z + dz * bestEntryT,
			),
			normal: new Vector3d(bestNx, bestNy, bestNz),
			fraction: bestFraction,
		};
	}

	querySphere(center: Vector3d, radius: number): Renderable[];
	querySphere(sphere: Sphere): Renderable[];
	querySphere(
		centerOrSphere: Vector3d | Sphere,
		radius?: number,
	): Renderable[] {
		// Active only under a 3D broadphase. Return [] for the 2D case
		// so user code can call this unconditionally without a
		// `sortOn === "depth"` guard sprinkled at every call site.
		const result: Renderable[] = [];
		const octree = this.world.broadphase;
		if (this.world.sortOn !== "depth" || !(octree instanceof Octree)) {
			return result;
		}
		// Unpack the two call shapes. We resolve to the loose (cx,
		// cy, cz, r) form once, then run the single shared narrow
		// phase below — no duplication between the Vector3d and
		// Sphere paths.
		const isSphere = centerOrSphere instanceof Sphere;
		const cx = isSphere ? centerOrSphere.pos.x : centerOrSphere.x;
		const cy = isSphere ? centerOrSphere.pos.y : centerOrSphere.y;
		const cz = isSphere ? centerOrSphere.pos.z : centerOrSphere.z;
		const r = isSphere ? centerOrSphere.radius : radius!;
		// Broadphase walk: octree returns candidates whose octant the
		// sphere overlaps. Then narrow-phase by actual centre distance
		// so callers don't have to repeat the test (matches how
		// `queryAABB` does the bounds-overlap filter at this level).
		octree.querySphere(cx, cy, cz, r, result);
		const r2 = r * r;
		let writeIdx = 0;
		for (let i = 0, len = result.length; i < len; i++) {
			const item = result[i];
			if (typeof item.getAbsolutePosition !== "function") continue;
			const p = item.getAbsolutePosition();
			const dx = p.x - cx;
			const dy = p.y - cy;
			// `getAbsolutePosition()` returns Vector3d; legacy .js
			// typings expose `Vector2d | Vector3d` — `.z` is always
			// present at runtime under Camera3d.
			const dz = ((p as { z?: number }).z ?? 0) - cz;
			if (dx * dx + dy * dy + dz * dz <= r2) {
				result[writeIdx++] = item;
			}
		}
		result.length = writeIdx;
		return result;
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
			// a Vector3d gravity pulls along the depth axis too
			const gz = (this.gravity as { z?: number }).z;
			if (typeof gz === "number" && gz !== 0) {
				body.forceZ += body.mass * gz * body.gravityScale;
			}
		}
	}
}
