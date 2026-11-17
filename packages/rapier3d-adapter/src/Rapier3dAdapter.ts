/**
 * The adapter: the melonJS `PhysicsAdapter` interface on Rapier 3D.
 *
 * It owns the lifecycle (making and freeing the Rapier world, stepping it)
 * and the bodies (making them from a `bodyDef`, removing them), and answers
 * the portable API. The work itself is done by:
 *
 * - `Simulation`: the Rapier world and which body and colliders each
 *   renderable has, shared by every part below
 * - `colliders/`: the colliders the 3D shapes become, their collision types
 *   and masks, and their footprints
 * - `contacts/`: the collision hooks
 * - `bodies/`: the body's pose on its renderable, its motion, what was set on
 *   it at run time, and the helpers on `renderable.body`
 * - `joints/` and `queries/`
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import {
	type AdapterCapabilities,
	type BodyDefinition,
	type BodyShape,
	type Bounds,
	collision,
	version as melonjsVersion,
	type PhysicsAdapter,
	type PhysicsBody,
	Quaternion,
	type RaycastHit3d,
	type Rect,
	type Renderable,
	type Sphere,
	state,
	utils,
	Vector2d,
	Vector3d,
	type World,
} from "melonjs";
import { spliceHelpers } from "./bodies/helpers";
import { Motion } from "./bodies/Motion";
import { type Pose, poseOf, writePose } from "./bodies/pose";
import { RuntimeOverrides } from "./bodies/RuntimeOverrides";
import { CollisionFilters } from "./colliders/CollisionFilters";
import { emptyFootprint, growFootprint } from "./colliders/footprint";
import { buildColliderParts } from "./colliders/shapes";
import type { ColliderEntry, ColliderPart } from "./colliders/types";
import { ContactDispatcher } from "./contacts/ContactDispatcher";
import { Joints } from "./joints/Joints";
import { loadedRapier, loadRapier } from "./loader";
import { Units, zOf } from "./math/units";
import * as queries from "./queries/queries";
import { Simulation } from "./Simulation";
import {
	type Rapier3dAdapterOptions,
	type Rapier3dJointDefinition,
	REQUIRED_MELONJS_VERSION,
	type Vector3Like,
} from "./types";

// a body's turn about Z, set by `setAngle`
const _turn = new Quaternion();

declare const __VERSION__: string;

/**
 * melonJS physics adapter for Rapier 3D (https://rapier.rs), compiled to
 * WebAssembly: rigid bodies that move and turn in three dimensions, for a
 * game drawn with `Camera3d`.
 *
 * Bodies are declared as on every adapter, with a `bodyDef`, from the 3D
 * shapes: {@link Box3d}, {@link Sphere}, {@link Capsule3d},
 * {@link ConvexHull3d} and {@link TriangleMesh3d}. Shapes are in the
 * renderable's space, relative to its `pos` (and `depth`), which is where the
 * body sits; each frame the body's position is written back to `pos` /
 * `depth`, and its turn onto `currentTransform`, so a {@link Mesh}, a
 * `Sprite3d` or a `GLTFModel` tumbles as it is simulated.
 *
 * The adapter takes the 3D form of the portable API: `setVelocity`,
 * `applyForce`, `applyImpulse` and `setPosition` take a {@link Vector3d},
 * and `getVelocity3d`, `getRotation` / `setRotation` and
 * `getAngularVelocity3d` read the rest. The 2D calls still work, in the
 * plane of the body: a `Vector2d` leaves the depth as it was.
 *
 * Rapier's WebAssembly has to be compiled before an adapter can be
 * constructed: {@link Rapier3dAdapter.create} does both.
 * @example
 * import { Application, Camera3d } from "melonjs";
 * import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
 *
 * const app = new Application(800, 600, {
 *     parent: "screen",
 *     cameraClass: Camera3d,
 *     physic: await Rapier3dAdapter.create(),
 * });
 * @category Plugins
 * @document ../README.md
 */
export class Rapier3dAdapter implements PhysicsAdapter {
	readonly physicLabel = "rapier3d";
	readonly name = "@melonjs/rapier3d-adapter";
	readonly version = __VERSION__;
	readonly url = "https://www.npmjs.com/package/@melonjs/rapier3d-adapter";

	readonly capabilities: AdapterCapabilities = {
		constraints: true,
		// opt-in per body: `(body as Rapier3dAdapter.Body).enableCcd(true)`
		continuousCollisionDetection: true,
		sleepingBodies: true,
		// a 3D world is queried with `raycast3d`
		raycasts: false,
		raycasts3d: true,
		velocityLimit: true,
		isGrounded: true,
		bodies3d: true,
	};

	/**
	 * World gravity, in pixels per second². Change it at any time; read at
	 * every step.
	 */
	gravity: Vector3d;

	/**
	 * The Rapier module: an escape hatch for what the portable
	 * {@link PhysicsAdapter} interface does not cover (other joints, the
	 * character controller, native queries). See the README.
	 * @see {@link https://rapier.rs/docs/user_guides/javascript/getting_started_js Rapier JavaScript user guide}
	 */
	readonly rapier: typeof RAPIER;

	/** Spatial conversion factor between melonJS pixels and Rapier meters. */
	readonly pixelsPerMeter: number;

	/** Back-reference to the owning melonJS world (set in {@link init}). */
	melonWorld!: World;

	private readonly subSteps: number;
	private readonly sim: Simulation;
	private readonly filters: CollisionFilters;
	private readonly contacts: ContactDispatcher;
	private readonly motion: Motion;
	private readonly joints: Joints;
	/** what was set on every collider of a body at run time */
	private readonly overrides = new RuntimeOverrides();
	/** each body's definition, which `updateShape()` builds from again */
	private readonly defs = new Map<Renderable, BodyDefinition>();
	/** each renderable's transform when its body was made, and its bridge */
	private readonly poses = new Map<Renderable, Pose>();
	/** the shapes {@link Rapier3dAdapter.getBodyShapes} reports */
	private readonly reportedShapes = new Map<Renderable, BodyShape[]>();

	/**
	 * Download and compile Rapier's WebAssembly. Every call returns the same
	 * promise, so it can be started early and awaited wherever it is needed;
	 * a failed load rejects, and a later call tries again.
	 *
	 * Rapier is imported with `import()`, so bundlers put it in a chunk of its
	 * own, downloaded only when this is called.
	 * @returns a promise that resolves once the adapter can be constructed
	 * @example
	 * const rapierReady = Rapier3dAdapter.load();
	 * await loader.preload(assets);
	 * await rapierReady;
	 * app.world.setAdapter(new Rapier3dAdapter());
	 */
	static load(): Promise<void> {
		return loadRapier();
	}

	/**
	 * Whether {@link Rapier3dAdapter.load} has finished, so that
	 * `new Rapier3dAdapter()` can be called.
	 * @returns true once Rapier is compiled
	 */
	static get loaded(): boolean {
		return loadedRapier() !== undefined;
	}

	/**
	 * Create an adapter, the same way for every adapter: wait for
	 * {@link Rapier3dAdapter.load}, then construct it.
	 * @param options - the constructor's options
	 * @returns the new adapter, an instance of the class `create` is called on
	 */
	static async create<T extends PhysicsAdapter>(
		this: Pick<typeof Rapier3dAdapter, "load"> &
			(new (
				options?: Rapier3dAdapterOptions,
			) => T),
		options?: Rapier3dAdapterOptions,
	): Promise<T> {
		await this.load();
		return new this(options);
	}

	/**
	 * Construct an adapter. Rapier must be loaded first: use
	 * {@link Rapier3dAdapter.create}, or await {@link Rapier3dAdapter.load}.
	 * @param options - see {@link Rapier3dAdapterOptions}
	 */
	constructor(options: Rapier3dAdapterOptions = {}) {
		if (utils.checkVersion(REQUIRED_MELONJS_VERSION, melonjsVersion) > 0) {
			throw new Error(
				`@melonjs/rapier3d-adapter requires melonJS >= ${REQUIRED_MELONJS_VERSION}, ` +
					`but the loaded melonJS is ${melonjsVersion}.`,
			);
		}
		const rapier = loadedRapier();
		if (rapier === undefined) {
			throw new Error(
				"@melonjs/rapier3d-adapter: Rapier is not loaded yet. Use " +
					"`await Rapier3dAdapter.create(options)`, or `await Rapier3dAdapter.load()` " +
					"before `new Rapier3dAdapter(options)`.",
			);
		}
		this.rapier = rapier;
		const ppm = options.pixelsPerMeter ?? 32;
		if (!(ppm > 0) || !Number.isFinite(ppm)) {
			throw new Error(
				`@melonjs/rapier3d-adapter: pixelsPerMeter must be a positive number (got ${ppm}).`,
			);
		}
		this.pixelsPerMeter = ppm;
		this.subSteps = Math.max(1, Math.floor(options.subSteps ?? 1));
		const g = options.gravity ?? { x: 0, y: 320, z: 0 };
		this.gravity = new Vector3d(g.x, g.y, g.z ?? 0);

		this.sim = new Simulation(rapier, new Units(ppm));
		this.filters = new CollisionFilters(rapier);
		this.contacts = new ContactDispatcher(this.sim);
		this.motion = new Motion(this.sim);
		this.joints = new Joints(this.sim);
	}

	/** The Rapier world; exposed for advanced use. Made in {@link init}. */
	get world(): RAPIER.World {
		return this.sim.world;
	}

	// ── lifecycle ───────────────────────────────────────────────────────────

	init(world: World): void {
		this.melonWorld = world;
		this.sim.open(this.gravityInMeters());
		this.contacts.open();
	}

	destroy(): void {
		// nothing to free before `init()`, or a second time
		if (!this.sim.alive) {
			return;
		}
		this.contacts.close();
		this.sim.close();
		this.filters.clear();
		this.motion.clear();
		this.joints.clear();
		this.overrides.clear();
		this.defs.clear();
		this.poses.clear();
		this.reportedShapes.clear();
	}

	step(dt: number): void {
		if (!this.sim.alive) {
			throw new Error(
				"@melonjs/rapier3d-adapter: step() on an adapter with no Rapier world: it was destroyed, or never installed with `world.setAdapter()`.",
			);
		}
		// as the other adapters: no simulation while the game is paused
		if (state.isPaused()) {
			return;
		}
		// a step of no length simulates nothing, and one that is not a number
		// would leave every body it touched stuck for good
		if (!(dt > 0) || !Number.isFinite(dt)) {
			return;
		}
		const { world } = this.sim;
		// read every step, so `adapter.gravity` can change while the game runs
		world.gravity = this.gravityInMeters();
		// melonJS passes dt in ms; Rapier wants seconds
		world.timestep = dt / 1000 / this.subSteps;
		for (let i = 0; i < this.subSteps; i++) {
			world.step(this.contacts.queue, this.filters.hooks);
			this.contacts.dispatchQueuedEvents();
		}
		// a force is for this frame, across every sub-step
		this.motion.clearForces();
		this.motion.clampVelocities();
		this.contacts.dispatchActiveContacts();
	}

	syncFromPhysics(): void {
		for (const [renderable, body] of this.sim.bodies) {
			// a body at rest, or that never moves, has nothing new to write;
			// `setPosition` / `setRotation` write a moved one themselves
			if (body.isFixed() || body.isSleeping()) {
				continue;
			}
			this.writePose(renderable, body);
		}
	}

	// ── bodies ──────────────────────────────────────────────────────────────

	addBody(renderable: Renderable, def: BodyDefinition): Rapier3dAdapter.Body {
		const { rapier, units, world } = this.sim;
		// build every collider first, so a refused shape leaves no body behind,
		// nor takes away the one the renderable had
		const parts = buildColliderParts(rapier, units, def.shapes);
		// a renderable has one body: a second one replaces the first
		this.removeBody(renderable);
		const { RigidBodyDesc } = rapier;
		const desc =
			def.type === "static"
				? RigidBodyDesc.fixed()
				: def.type === "kinematic"
					? // moved by its velocity, as on the other adapters
						RigidBodyDesc.kinematicVelocityBased()
					: RigidBodyDesc.dynamic();
		// the body sits where the renderable is: shapes are relative to it
		desc.setTranslation(
			units.toMeters(renderable.pos.x),
			units.toMeters(renderable.pos.y),
			units.toMeters(renderable.depth),
		);
		// `frictionAir` damps rotation as well as movement, as on the 2D
		// adapter: Rapier damping, a rate per second
		const damping = averageOf(def.frictionAir) ?? 0;
		desc.setLinearDamping(damping);
		desc.setAngularDamping(damping);
		desc.setGravityScale(def.gravityScale ?? 1);
		// unset means a rigid body turns
		if (def.fixedRotation === true) {
			desc.lockRotations();
		}
		const body = world.createRigidBody(desc);
		const colliders: RAPIER.Collider[] = [];
		this.sim.bodies.set(renderable, body);
		this.sim.collidersOf.set(renderable, colliders);
		this.defs.set(renderable, def);
		this.createColliders(renderable, body, def, parts, colliders);

		if (def.maxVelocity) {
			this.setMaxVelocity(renderable, def.maxVelocity);
		}
		this.poses.set(renderable, poseOf(renderable));

		spliceHelpers(this.helperContext(), renderable, body, colliders);
		const adapterBody = body as Rapier3dAdapter.Body;
		renderable.body = adapterBody;
		// as the builtin `Body` constructor does: a renderable with a body
		// takes part in physics and receives pointer events
		renderable.isKinematic = false;
		return adapterBody;
	}

	removeBody(renderable: Renderable): void {
		const body = this.sim.bodies.get(renderable);
		if (body === undefined) {
			return;
		}
		// a partner still touching this body learns the contact ended
		this.forgetColliders(this.sim.collidersOf.get(renderable) ?? []);
		// one of their hooks may have taken this body out already
		if (this.sim.bodies.get(renderable) !== body) {
			return;
		}
		// Rapier removes the body's joints and colliders with it
		this.joints.forgetJointsOf(body);
		this.sim.world.removeRigidBody(body);
		this.motion.forget(renderable, body);
		this.sim.bodies.delete(renderable);
		this.sim.collidersOf.delete(renderable);
		this.defs.delete(renderable);
		this.poses.delete(renderable);
		this.reportedShapes.delete(renderable);
		this.overrides.delete(renderable);
	}

	/**
	 * Give a body new shapes. The body itself stays: its position, turn and
	 * velocities, its joints, what was changed on it at run time (static or
	 * not, gravity scale, damping, sensor, collision type and mask, bounce,
	 * speed cap, Rapier's own settings such as CCD) and the handle on
	 * `renderable.body`. Its colliders are replaced, so the pairs touching
	 * it end and start again, and its mass is that of the new shapes.
	 *
	 * A shape this adapter cannot build throws before anything is changed.
	 * @param renderable - the body's renderable
	 * @param shapes - the new shapes, relative to `pos`
	 */
	updateShape(renderable: Renderable, shapes: BodyShape[]): void {
		const def = this.defs.get(renderable);
		const body = this.sim.bodies.get(renderable);
		const colliders = this.sim.collidersOf.get(renderable);
		if (!def || !body || !colliders) {
			return;
		}
		// every new collider is built before an old one goes
		const parts = buildColliderParts(this.sim.rapier, this.sim.units, shapes);
		this.forgetColliders(colliders);
		// one of the hooks told so may have taken this body out
		if (this.sim.bodies.get(renderable) !== body) {
			return;
		}
		for (const collider of colliders) {
			this.sim.world.removeCollider(collider, false);
		}
		// emptied in place: the body's helpers hold this array
		colliders.length = 0;
		const next = { ...def, shapes };
		this.defs.set(renderable, next);
		this.reportedShapes.delete(renderable);
		this.createColliders(renderable, body, next, parts, colliders);
		// the mass and the inertia of the new shapes, from now
		body.recomputeMassPropertiesFromColliders();
		body.wakeUp();
	}

	// ── joints ──────────────────────────────────────────────────────────────

	/**
	 * Make a joint between two bodies: what `world.addJoint()` calls, which
	 * game code uses instead. A `"hinge"` is a Rapier revolute joint about
	 * `axis` (default Z), a `"rope"` a rope joint, a `"weld"` a fixed joint
	 * and a `"slider"` a prismatic joint along `axis` (default X). Anchors
	 * are in each renderable's own space, relative to its `pos`, in pixels,
	 * and the axis in `a`'s; a `z` left out is `0`.
	 *
	 * The bodies are joined as they stand, however each is turned: a weld
	 * and a slider keep the turn between them, and a hinge leaves them only
	 * the turn about its axis.
	 * @param def - what to join, and how, in pixels and radians
	 * @returns the Rapier joint
	 */
	addJoint(def: Rapier3dJointDefinition): RAPIER.ImpulseJoint {
		return this.joints.add(def);
	}

	/**
	 * Remove a joint {@link Rapier3dAdapter.addJoint} made: what
	 * `world.removeJoint()` calls. A joint already gone, with one of its
	 * bodies, is ignored.
	 * @param joint - the Rapier joint
	 */
	removeJoint(joint: RAPIER.ImpulseJoint): void {
		this.joints.remove(joint);
	}

	// ── velocity, forces and position ───────────────────────────────────────

	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		const target = out ?? new Vector2d();
		const v = this.sim.bodies.get(renderable)?.linvel();
		const { units } = this.sim;
		return v
			? target.set(units.toPixels(v.x), units.toPixels(v.y))
			: target.set(0, 0);
	}

	/**
	 * The body's velocity on all three axes, in pixels per second.
	 * @param renderable - the body's renderable
	 * @param [out] - the vector to write into
	 * @returns the velocity; zero for a renderable with no body here
	 */
	getVelocity3d(renderable: Renderable, out?: Vector3d): Vector3d {
		const target = out ?? new Vector3d();
		const v = this.sim.bodies.get(renderable)?.linvel();
		const { units } = this.sim;
		return v
			? target.set(
					units.toPixels(v.x),
					units.toPixels(v.y),
					units.toPixels(v.z),
				)
			: target.set(0, 0, 0);
	}

	/**
	 * Set the body's velocity, in pixels per second. A {@link Vector3d} sets
	 * all three axes; a {@link Vector2d} sets x and y and keeps the depth
	 * velocity as it was.
	 * @param renderable - the body's renderable
	 * @param v - the velocity
	 */
	setVelocity(renderable: Renderable, v: Vector2d | Vector3d): void {
		const body = this.sim.bodies.get(renderable);
		if (body) {
			this.motion.setVelocity(body, v.x, v.y, zOf(v));
		}
	}

	/**
	 * Push the body for this frame, across every sub-step: it accelerates by
	 * `force / mass` pixels per second². A force at `point` (in world pixels)
	 * also turns it. A force or point given as a {@link Vector2d} acts in
	 * the plane of the body.
	 * @param renderable - the body's renderable
	 * @param force - the force
	 * @param [point] - where it pushes, in world space
	 */
	applyForce(
		renderable: Renderable,
		force: Vector2d | Vector3d,
		point?: Vector2d | Vector3d,
	): void {
		const body = this.sim.bodies.get(renderable);
		if (body) {
			this.motion.addForce(body, force, point);
		}
	}

	/**
	 * Strike the body once: its velocity changes by `impulse / mass` pixels
	 * per second, at once. An impulse at `point` (in world pixels) also turns
	 * it. A {@link Vector2d} strikes in the plane of the body.
	 * @param renderable - the body's renderable
	 * @param impulse - the impulse
	 * @param [point] - where it strikes, in world space
	 */
	applyImpulse(
		renderable: Renderable,
		impulse: Vector2d | Vector3d,
		point?: Vector2d | Vector3d,
	): void {
		const body = this.sim.bodies.get(renderable);
		if (!body) return;
		const j = this.sim.units.inMeters(impulse.x, impulse.y, zOf(impulse) ?? 0);
		if (point) {
			body.applyImpulseAtPoint(j, this.motion.pointInMeters(body, point), true);
		} else {
			// Rapier's own method, not the portable helper spliced over it
			this.rapier.RigidBody.prototype.applyImpulse.call(body, j, true);
		}
	}

	/**
	 * Move the body and its renderable, at once. A {@link Vector3d} sets the
	 * depth too; a {@link Vector2d} keeps it. A renderable with no body here
	 * is moved all the same, as on every adapter. A coordinate that is not a
	 * finite number leaves the body and its renderable where they are.
	 * @param renderable - the body's renderable
	 * @param p - the new position, in `renderable.pos` space
	 */
	setPosition(renderable: Renderable, p: Vector2d | Vector3d): void {
		const depth = zOf(p) ?? renderable.depth;
		// a coordinate that is not a number leaves the body where it is, as
		// `setAngle` does: Rapier would keep the body there, at NaN, until
		// the next position, and the renderable's depth with it
		if (
			!Number.isFinite(p.x) ||
			!Number.isFinite(p.y) ||
			!Number.isFinite(depth)
		) {
			return;
		}
		// one batched write, as the pose is written each frame
		renderable.setPosition(p.x, p.y, depth);
		renderable.isDirty = true;
		this.sim.bodies
			.get(renderable)
			?.setTranslation(this.sim.units.inMeters(p.x, p.y, depth), true);
	}

	// ── turn and spin ───────────────────────────────────────────────────────

	/**
	 * The body's orientation, from the one it had when it was made.
	 * @param renderable - the body's renderable
	 * @param [out] - the quaternion to write into
	 * @returns the orientation; identity for a renderable with no body here
	 */
	getRotation(renderable: Renderable, out?: Quaternion): Quaternion {
		const target = out ?? new Quaternion();
		const body = this.sim.bodies.get(renderable);
		if (!body) {
			return target.identity();
		}
		const q = body.rotation();
		return target.set(q.x, q.y, q.z, q.w);
	}

	/**
	 * Turn the body, and its renderable with it, to an orientation, from the
	 * one it had when it was made.
	 * @param renderable - the body's renderable
	 * @param q - the orientation
	 */
	setRotation(renderable: Renderable, q: Quaternion): void {
		const body = this.sim.bodies.get(renderable);
		if (!body) return;
		// a non-unit quaternion is not a turn: normalized, as Rapier needs
		const n = q.clone().normalize();
		body.setRotation({ x: n.x, y: n.y, z: n.z, w: n.w }, true);
		this.writePose(renderable, body);
	}

	/**
	 * Turn the body to `angle` about Z, the turn a 2D game knows, leaving out
	 * any other.
	 * @param renderable - the body's renderable
	 * @param angle - in radians
	 */
	setAngle(renderable: Renderable, angle: number): void {
		const body = this.sim.bodies.get(renderable);
		// an angle that is not a number leaves the body as it is, as
		// `Quaternion#rotate` and `Matrix3d#rotate` do
		if (!body || !Number.isFinite(angle)) return;
		body.setRotation(_turn.identity().rotate(angle), true);
		this.writePose(renderable, body);
	}

	/**
	 * The body's turn about Z: the angle +X is turned through, seen down Z.
	 * @param renderable - the body's renderable
	 * @returns in radians; `0` for a renderable with no body here
	 */
	getAngle(renderable: Renderable): number {
		const body = this.sim.bodies.get(renderable);
		if (!body) return 0;
		// where the turn takes +X, its x and y: the first column of the
		// quaternion's matrix, which is all of `apply` this needs
		const { x, y, z, w } = body.rotation();
		const tx = 1 - 2 * (y * y + z * z);
		const ty = 2 * (x * y + w * z);
		return tx * tx + ty * ty < 1e-12 ? 0 : Math.atan2(ty, tx);
	}

	/**
	 * Set the body's spin, in radians per second: a {@link Vector3d} about
	 * each axis, a number about Z, keeping the spin about X and Y.
	 * @param renderable - the body's renderable
	 * @param omega - the spin
	 */
	setAngularVelocity(renderable: Renderable, omega: number | Vector3d): void {
		const body = this.sim.bodies.get(renderable);
		if (!body) return;
		if (typeof omega === "number") {
			const w = body.angvel();
			body.setAngvel({ x: w.x, y: w.y, z: omega }, true);
		} else {
			body.setAngvel({ x: omega.x, y: omega.y, z: omega.z }, true);
		}
	}

	getAngularVelocity(renderable: Renderable): number {
		return this.sim.bodies.get(renderable)?.angvel().z ?? 0;
	}

	/**
	 * The body's spin about each axis, in radians per second.
	 * @param renderable - the body's renderable
	 * @param [out] - the vector to write into
	 * @returns the spin; zero for a renderable with no body here
	 */
	getAngularVelocity3d(renderable: Renderable, out?: Vector3d): Vector3d {
		const target = out ?? new Vector3d();
		const w = this.sim.bodies.get(renderable)?.angvel();
		return w ? target.set(w.x, w.y, w.z) : target.set(0, 0, 0);
	}

	/**
	 * Twist the body for this frame: a number about Z, a {@link Vector3d}
	 * about each axis. In Rapier's own unit (N·m, not scaled by
	 * `pixelsPerMeter`), as on the 2D Rapier adapter.
	 * @param renderable - the body's renderable
	 * @param torque - the torque
	 */
	applyTorque(renderable: Renderable, torque: number | Vector3d): void {
		const body = this.sim.bodies.get(renderable);
		if (body) {
			this.motion.addTorque(body, torque);
		}
	}

	// ── what a body is ──────────────────────────────────────────────────────

	setStatic(renderable: Renderable, isStatic: boolean): void {
		const { RigidBodyType } = this.rapier;
		this.sim.bodies
			.get(renderable)
			?.setBodyType(
				isStatic ? RigidBodyType.Fixed : RigidBodyType.Dynamic,
				true,
			);
	}

	setGravityScale(renderable: Renderable, scale: number): void {
		const body = this.sim.bodies.get(renderable);
		if (body) {
			// Rapier's own method, not the portable helper spliced over it
			this.rapier.RigidBody.prototype.setGravityScale.call(body, scale, true);
		}
	}

	setSensor(renderable: Renderable, isSensor: boolean): void {
		const colliders = this.sim.collidersOf.get(renderable);
		if (colliders === undefined) return;
		this.overrides.of(renderable).sensor = isSensor;
		for (const collider of colliders) {
			collider.setSensor(isSensor);
		}
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = this.sim.bodies.get(renderable);
		if (!body) return;
		const damping = averageOf(friction) ?? 0;
		body.setLinearDamping(damping);
		body.setAngularDamping(damping);
	}

	/**
	 * Cap the body's speed on each axis, in pixels per second. A `z` caps
	 * the depth axis too; left out, that axis has no cap.
	 * @param renderable - the body's renderable
	 * @param limit - the cap
	 */
	setMaxVelocity(renderable: Renderable, limit: Vector3Like): void {
		// nothing to cap, and nothing to keep, for a renderable with no body
		if (!this.sim.bodies.has(renderable)) return;
		this.motion.limits.set(renderable, {
			x: limit.x,
			y: limit.y,
			z: limit.z,
		});
	}

	getMaxVelocity(renderable: Renderable): {
		x: number;
		y: number;
		z: number;
	} {
		// a copy, so changing it does not change the cap; no cap reads as
		// Infinity
		const limit = this.motion.limits.get(renderable);
		return {
			x: limit?.x ?? Infinity,
			y: limit?.y ?? Infinity,
			z: limit?.z ?? Infinity,
		};
	}

	setCollisionType(renderable: Renderable, type: number): void {
		this.setFilter(renderable, type, undefined);
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		this.setFilter(renderable, undefined, mask);
	}

	// ── reading bodies, and querying the world ──────────────────────────────

	/**
	 * The body's XY bounds in renderable-local pixels, relative to `pos`: the
	 * footprint of its colliders as the body is turned now. Exact for a
	 * box, a sphere and a capsule; for a hull or a triangle mesh, that of its
	 * bounding box, turned.
	 * @param renderable - the renderable whose body bounds to read
	 * @param out - destination `Bounds` (filled in place, also returned)
	 */
	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined {
		const body = this.sim.bodies.get(renderable);
		const colliders = this.sim.collidersOf.get(renderable);
		if (body === undefined || colliders === undefined) {
			return undefined;
		}
		if (colliders.length === 0) {
			return undefined;
		}
		const q = body.rotation();
		const box = emptyFootprint();
		for (const collider of colliders) {
			const entry = this.sim.colliders.get(collider.handle);
			if (entry !== undefined) {
				growFootprint(entry, q, box);
			}
		}
		out.setMinMax(box[0], box[1], box[2], box[3]);
		return out;
	}

	/**
	 * The body's collision shapes, as given in its `bodyDef`, relative to
	 * `pos` and before the body turns (the turn is
	 * {@link Rapier3dAdapter.getRotation}). A shape with `isActive: false`
	 * is left out.
	 * @param renderable - the renderable whose body shapes to read
	 */
	getBodyShapes(renderable: Renderable): readonly BodyShape[] {
		const colliders = this.sim.collidersOf.get(renderable);
		if (colliders === undefined) {
			return [];
		}
		let cached = this.reportedShapes.get(renderable);
		if (cached === undefined) {
			cached = [];
			for (const collider of colliders) {
				const entry = this.sim.colliders.get(collider.handle);
				if (entry !== undefined) {
					cached.push(entry.shape);
				}
			}
			this.reportedShapes.set(renderable, cached);
		}
		return cached;
	}

	/**
	 * Whether Rapier has put the body to sleep: a dynamic body at rest, left
	 * out of the step until a contact or a write to it (a velocity, a force,
	 * an impulse, a position or a rotation, which all wake it) moves it
	 * again. `false` for a fixed or kinematic body, and for a renderable this
	 * adapter does not know, including every one once it is destroyed.
	 * @param renderable - the renderable whose body to read
	 * @returns `true` while the body sleeps
	 * @example
	 * // the shot is over once every block has come to rest
	 * const settled = blocks.every((b) => adapter.isSleeping(b));
	 */
	isSleeping(renderable: Renderable): boolean {
		const body = this.sim.bodies.get(renderable);
		// Rapier reports a fixed or kinematic body at rest as asleep too
		return body !== undefined && body.isDynamic() && body.isSleeping();
	}

	isGrounded(renderable: Renderable): boolean {
		return queries.isGrounded(this.sim, renderable);
	}

	/**
	 * The first collider a segment meets, from `from` to `to`, in world
	 * pixels: the exact shape, not a bounding volume. A shape the ray starts
	 * inside is skipped, so a body casting from its own centre does not hit
	 * itself. Sensors are hit like any other body.
	 * @param from - where the ray starts
	 * @param to - where it ends
	 * @returns the hit, or `null`
	 */
	raycast3d(from: Vector3d, to: Vector3d): RaycastHit3d | null {
		return queries.raycast3d(this.sim, from, to);
	}

	/**
	 * The renderables whose colliders' boxes overlap a rectangle in XY, at
	 * any depth: the boxes {@link Rapier3dAdapter.getBodyAABB} reports.
	 * @param rect - the rectangle, in world pixels
	 * @returns the renderables, each once
	 */
	queryAABB(rect: Rect): Renderable[] {
		return queries.queryAABB(this.sim, rect);
	}

	/**
	 * The renderables whose colliders overlap a sphere: their exact shapes.
	 * @param center - the centre in world pixels, or a {@link Sphere}
	 * @param [radius] - the radius in pixels, with a centre; none, or less
	 * than none, is a point
	 * @returns the renderables, each once
	 */
	querySphere(center: Vector3d | Sphere, radius?: number): Renderable[] {
		return queries.querySphere(this.sim, center, radius);
	}

	// ── internals ───────────────────────────────────────────────────────────

	/**
	 * The gravity in meters per second², for Rapier.
	 * @returns the gravity
	 */
	private gravityInMeters() {
		const { x, y, z } = this.gravity;
		return this.sim.units.inMeters(x, y, z);
	}

	/**
	 * Write a body's place and turn back onto its renderable.
	 * @param renderable - the renderable
	 * @param body - its body
	 */
	private writePose(renderable: Renderable, body: RAPIER.RigidBody): void {
		writePose(renderable, body, this.poses.get(renderable), this.sim.units);
	}

	/**
	 * Make a body's colliders, with the body definition's material and
	 * filter, a shape's own settings over them, and what was set on the
	 * whole body at run time over both.
	 * @param renderable - the body's renderable
	 * @param body - the body
	 * @param def - its definition
	 * @param parts - the colliders to make
	 * @param colliders - the body's list of colliders, added to
	 */
	private createColliders(
		renderable: Renderable,
		body: RAPIER.RigidBody,
		def: BodyDefinition,
		parts: ColliderPart[],
		colliders: RAPIER.Collider[],
	): void {
		const over = this.overrides.get(renderable);
		const bodyType =
			typeof def.collisionType === "number" ? def.collisionType : 0x0001;
		const bodyMask =
			typeof def.collisionMask === "number"
				? def.collisionMask
				: collision.types.ALL_OBJECT;
		for (const { shape, index, desc, min, max, round } of parts) {
			const shapeType = (shape as { collisionType?: number }).collisionType;
			const shapeMask = (shape as { collisionMask?: number }).collisionMask;
			const trigger = (shape as { isTrigger?: boolean }).isTrigger === true;
			desc
				.setDensity(def.density ?? 1)
				.setFriction(def.friction ?? 0.2)
				.setRestitution(over?.restitution ?? def.restitution ?? 0)
				// a trigger shape is a sensor: it reports contacts and
				// contributes nothing to the solver
				.setSensor(over?.sensor ?? (def.isSensor === true || trigger))
				.setActiveEvents(this.rapier.ActiveEvents.COLLISION_EVENTS);
			const collider = this.sim.world.createCollider(desc, body);
			// a shape's own collision settings override the body's
			this.filters.apply(
				collider,
				over?.category ??
					(typeof shapeType === "number" ? shapeType : bodyType),
				over?.mask ?? (typeof shapeMask === "number" ? shapeMask : bodyMask),
			);
			const entry: ColliderEntry = { renderable, shape, index, min, max };
			if (round !== undefined) {
				entry.round = round;
			}
			this.sim.colliders.set(collider.handle, entry);
			colliders.push(collider);
		}
	}

	/**
	 * Tell the pairs touching colliders that are about to go that their
	 * contact ended, then forget the colliders.
	 * @param colliders - the colliders leaving the world
	 */
	private forgetColliders(colliders: RAPIER.Collider[]): void {
		this.contacts.endContacts(colliders);
		for (const collider of colliders) {
			this.sim.colliders.delete(collider.handle);
			this.filters.forget(collider.handle);
		}
	}

	/**
	 * Change the collision type and/or mask of every collider of a body, and
	 * keep it for the colliders `updateShape()` makes.
	 * @param renderable - the body's renderable
	 * @param category - the new type, or undefined to keep each collider's
	 * @param mask - the new mask, or undefined to keep each collider's
	 */
	private setFilter(
		renderable: Renderable,
		category: number | undefined,
		mask: number | undefined,
	): void {
		const colliders = this.sim.collidersOf.get(renderable);
		if (colliders === undefined) return;
		const over = this.overrides.of(renderable);
		if (category !== undefined) over.category = category;
		if (mask !== undefined) over.mask = mask;
		this.filters.update(colliders, category, mask);
	}

	/**
	 * What the helpers spliced onto a body act through.
	 * @returns the context
	 */
	private helperContext() {
		return {
			adapter: this,
			sim: this.sim,
			motion: this.motion,
			filters: this.filters,
			overrides: this.overrides,
		};
	}
}

/**
 * One damping rate from a `frictionAir`: Rapier damping is one value, so an
 * `{x, y}` is averaged.
 * @param v - the setting
 * @returns the rate, or undefined when none is set
 */
function averageOf(
	v: number | { x: number; y: number } | undefined,
): number | undefined {
	if (v === undefined) return undefined;
	if (typeof v === "number") return v;
	return (v.x + v.y) / 2;
}

/**
 * Namespace-merged with the {@link Rapier3dAdapter} class to expose
 * adapter-owned types alongside the runtime API.
 */
// biome-ignore lint/style/useNamingConvention: namespace must match the class it merges with
// eslint-disable-next-line @typescript-eslint/no-namespace -- intentional class+namespace declaration merge so adapter-owned types (`Rapier3dAdapter.Body`) are reachable alongside the runtime class
export namespace Rapier3dAdapter {
	/**
	 * The body handle attached to `renderable.body` under
	 * {@link Rapier3dAdapter}: the Rapier `RigidBody` (with all its native
	 * methods: `enableCcd`, `linvel`, `mass`, `sleep`, …) and the portable
	 * melonJS helpers spliced onto it.
	 *
	 * ```ts
	 * (this.body as Rapier3dAdapter.Body).enableCcd(true);
	 * ```
	 */
	export type Body = RAPIER.RigidBody & PhysicsBody;
}
