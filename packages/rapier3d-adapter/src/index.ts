import type * as RAPIER from "@dimforge/rapier3d-compat";
import {
	type AdapterCapabilities,
	type BodyDefinition,
	type BodyShape,
	type Bounds,
	Box3d,
	Capsule3d,
	ConvexHull3d,
	collision,
	Mesh,
	version as melonjsVersion,
	type PhysicsAdapter,
	type PhysicsBody,
	Quaternion,
	type RaycastHit3d,
	type Rect,
	type Renderable,
	Sphere,
	state,
	TriangleMesh3d,
	utils,
	Vector2d,
	Vector3d,
	type World,
} from "melonjs";

declare const __VERSION__: string;

/**
 * Minimum melonJS version this adapter requires: the lower bound of its
 * `melonjs` peer dependency range, so the two cannot disagree. 20.16 is the
 * first with the 3D shapes and the 3D adapter interface.
 * @hidden
 */
export const REQUIRED_MELONJS_VERSION = "20.16.0";

/** A point or a vector in three dimensions, in pixels or meters. */
type XYZ = { x: number; y: number; z: number };

/**
 * A point or a vector in pixels whose `z` may be left out: a
 * {@link Vector3d}, a {@link Vector2d} or a plain object. What a missing `z`
 * means is said where it is taken.
 */
export interface Vector3Like {
	x: number;
	y: number;
	z?: number | undefined;
}

/**
 * The `z` of a vector that may not have one.
 * @param v - the vector
 * @returns its `z`, or `undefined`
 */
function zOf(v: Vector3Like): number | undefined {
	return typeof v.z === "number" ? v.z : undefined;
}

/**
 * What `world.addJoint()` passes to {@link Rapier3dAdapter.addJoint}: melonJS's
 * `JointDefinition`, whose anchors and axis may also carry a `z`.
 */
export interface Rapier3dJointDefinition {
	type: "hinge" | "rope" | "weld" | "slider";
	a: Renderable;
	b: Renderable;
	/** in `a`'s own space, relative to its `pos`; `z` defaults to `0` */
	anchorA?: Vector3Like;
	/** in `b`'s own space, relative to its `pos`; `z` defaults to `0` */
	anchorB?: Vector3Like;
	collideConnected?: boolean;
	limits?: { min: number; max: number };
	maxLength?: number;
	/**
	 * `"hinge"`: the axis the bodies turn about, default Z, so a hinge turns
	 * as it does in 2D. `"slider"`: the direction `b` slides in, default X.
	 * In `a`'s own space; `z` defaults to `0`.
	 */
	axis?: Vector3Like;
}

/**
 * Options accepted by the {@link Rapier3dAdapter} constructor and by
 * {@link Rapier3dAdapter.create}.
 */
export interface Rapier3dAdapterOptions {
	/**
	 * World gravity in **pixels per second²**. Default `{x: 0, y: 320, z: 0}`,
	 * about 10 m/s² at the default `pixelsPerMeter` of 32, pulling down: the
	 * engine's 3D convention is Y-down (see `Camera3d`). Converted to meters
	 * for Rapier.
	 */
	gravity?: Vector3Like;
	/**
	 * Rapier is tuned for objects about a meter across, so the adapter works
	 * in meters and converts at every boundary (positions, velocities,
	 * gravity, forces, queries). Default `32`: a 32-pixel cube is one meter.
	 * Raising it makes every body smaller in meters, so lighter, and the same
	 * force moves it further; motion under gravity alone looks the same in
	 * pixels. Must be a positive number.
	 */
	pixelsPerMeter?: number;
	/**
	 * Rapier steps per engine frame, each of `dt / N` seconds. More sub-steps
	 * make fast contacts and tall stacks more accurate, at about `N` times
	 * the physics cost. Default `1`; values below 1 are clamped to 1. A
	 * force applied once in a frame acts across all of them.
	 */
	subSteps?: number;
}

/**
 * How far UP a contact normal must point for
 * {@link Rapier3dAdapter.isGrounded} to count the contact as ground, as on
 * the 2D adapters: the upward component (`-y`, the engine being Y-down) of
 * the unit normal the body is pushed along.
 */
const GROUND_NORMAL_Y = 0.1;

/**
 * Half the depth `queryAABB` searches through, in meters: a 2D rectangle
 * query in a 3D world finds what lies over that rectangle at any depth.
 */
const QUERY_HALF_DEPTH = 1e7;

/**
 * The message for a shape this adapter cannot build a collider from.
 * @param shape - the shape that was refused
 * @returns the message to throw
 */
function unsupportedShapeMessage(shape: BodyShape): string {
	// `type` rather than `constructor.name`: the class name is mangled by a
	// minifier and this string is most useful in a production build.
	const name =
		(shape as { type?: string }).type ??
		(shape as { constructor: { name: string } }).constructor.name;
	return `Rapier3dAdapter: unsupported shape type ${name}. A 3D world needs a shape with depth: this adapter builds colliders from Box3d, Sphere, Capsule3d, ConvexHull3d and TriangleMesh3d. A Rect becomes a Box3d of the same footprint, an Ellipse a Sphere.`;
}

/** What the adapter knows about one Rapier collider. */
interface ColliderEntry {
	renderable: Renderable;
	/** the melonJS shape it was built from */
	shape: BodyShape;
	/** that shape's index in the body definition */
	index: number;
	/** the collider's box in body space, in pixels, before the body turns */
	min: XYZ;
	max: XYZ;
	/**
	 * a sphere or a capsule as the segment its radius sweeps, in body space
	 * and pixels: its bounds once turned are those of the turned segment, a
	 * radius wider, where its turned box would be too large
	 */
	round?: { a: XYZ; b: XYZ; r: number };
}

/** A collider ready to be made: its description, and what is kept about it. */
interface ColliderPart {
	shape: BodyShape;
	index: number;
	desc: RAPIER.ColliderDesc;
	min: XYZ;
	max: XYZ;
	round?: { a: XYZ; b: XYZ; r: number };
}

/**
 * What was changed on every collider of a body at run time, so that
 * `updateShape()` gives it to the new ones.
 */
interface ColliderOverrides {
	category?: number;
	mask?: number;
	sensor?: boolean;
	restitution?: number;
}

/** A box in XY: min x, min y, max x, max y. */
type Footprint = [number, number, number, number];

/**
 * A pair whose start or active hooks are running. When one of them takes a
 * body of the pair out, the contact's end is told in the order a hook can
 * rely on: to the side going out at once, while it is whole, and to the other
 * once the hooks are done; and only to a side that heard the start.
 */
interface Dispatch {
	key: string;
	h1: number;
	h2: number;
	e1: ColliderEntry;
	e2: ColliderEntry;
	/** the sides that may hear the end: those the start reached */
	reached: number;
	/** the sides already told the end */
	told: number;
	/** true once a body of the pair was taken out */
	ended: boolean;
}

/** Which hooks of a pair a dispatch reaches: one bit per side and level. */
const SIDE_A = 1;
const SIDE_B = 2;
const SHAPE_A = 4;
const SHAPE_B = 8;
const EVERY_SIDE = SIDE_A | SIDE_B | SHAPE_A | SHAPE_B;

/**
 * How a renderable draws its `currentTransform`, so the body's turn can be
 * written onto it: `bridge` is the sign of each axis between the space the
 * transform turns in and the engine's (a {@link Mesh} turns in its source's
 * Y-up space), and `base` the transform it had when the body was made.
 */
interface Pose {
	base: Float64Array;
	bridge: [number, number, number];
}

/** The Rapier module, once {@link Rapier3dAdapter.load} has compiled it. */
let rapier: typeof RAPIER | undefined;
/** The load in progress or done, shared by every caller. */
let loading: Promise<void> | undefined;

/**
 * A key for an unordered pair of colliders.
 * @param h1 - one collider handle
 * @param h2 - the other
 * @returns the same key for (h1, h2) and (h2, h1)
 */
function pairKey(h1: number, h2: number): string {
	return h1 < h2 ? `${h1}:${h2}` : `${h2}:${h1}`;
}

/**
 * Turn a vector by a unit quaternion.
 * @param q - the turn
 * @param v - the vector
 * @returns a new, turned vector
 */
function rotate(q: RAPIER.Rotation, v: XYZ): XYZ {
	// v + 2w (q × v) + 2 q × (q × v)
	const tx = 2 * (q.y * v.z - q.z * v.y);
	const ty = 2 * (q.z * v.x - q.x * v.z);
	const tz = 2 * (q.x * v.y - q.y * v.x);
	return {
		x: v.x + q.w * tx + (q.y * tz - q.z * ty),
		y: v.y + q.w * ty + (q.z * tx - q.x * tz),
		z: v.z + q.w * tz + (q.x * ty - q.y * tx),
	};
}

/**
 * The inverse of a unit quaternion.
 * @param q - the turn
 * @returns the turn back
 */
function conjugate(q: RAPIER.Rotation): RAPIER.Rotation {
	return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/**
 * Two turns composed: `a` applied after `b`.
 * @param a - the second turn
 * @param b - the first turn
 * @returns the combined turn
 */
function multiply(a: RAPIER.Rotation, b: RAPIER.Rotation): RAPIER.Rotation {
	return {
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
	};
}

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

	/** The Rapier world; exposed for advanced use. Created in {@link init}. */
	world!: RAPIER.World;

	/** Back-reference to the owning melonJS world (set in {@link init}). */
	melonWorld!: World;

	private eventQueue!: RAPIER.EventQueue;
	/** true between {@link init} and {@link destroy}: Rapier's world exists */
	private alive = false;
	/** Filters every pair with a 32-bit collision type or mask; see `_applyFilter`. */
	private readonly hooks: RAPIER.PhysicsHooks;

	private readonly bodyMap = new Map<Renderable, RAPIER.RigidBody>();
	/** the joints {@link Rapier3dAdapter.addJoint} made that are still alive */
	private readonly joints = new Set<RAPIER.ImpulseJoint>();
	private readonly collidersOf = new Map<Renderable, RAPIER.Collider[]>();
	/** collider handle -> its renderable, shape and box */
	private readonly colliderMap = new Map<number, ColliderEntry>();
	/** collider handle -> its melonJS collision type and mask */
	private readonly filters = new Map<
		number,
		{ category: number; mask: number }
	>();
	/** touching pairs, from Rapier's start events until their end */
	private readonly activePairs = new Map<string, [number, number]>();
	/** a step's events, collected before any is dispatched */
	private readonly pendingEvents: number[] = [];
	/** the pairs whose start or active hooks are running, innermost last */
	private readonly dispatching: Dispatch[] = [];
	/** bodies with a force or torque to clear once the frame is stepped */
	private readonly forced = new Set<RAPIER.RigidBody>();
	private readonly velocityLimits = new Map<Renderable, Vector3Like>();
	private readonly defMap = new Map<Renderable, BodyDefinition>();
	/** each renderable's transform when its body was made, and its bridge */
	private readonly poses = new Map<Renderable, Pose>();
	/** the shapes {@link Rapier3dAdapter.getBodyShapes} reports */
	private readonly reportedShapes = new Map<Renderable, BodyShape[]>();
	/** what was set on every collider of a body at run time */
	private readonly overrides = new Map<Renderable, ColliderOverrides>();

	private readonly subSteps: number;

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
		loading ??= import("@dimforge/rapier3d-compat")
			.then(async (module) => {
				// decode the embedded bytes and compile the WebAssembly
				await module.init();
				rapier = module;
			})
			.catch((error: unknown) => {
				loading = undefined;
				throw error;
			});
		return loading;
	}

	/**
	 * Whether {@link Rapier3dAdapter.load} has finished, so that
	 * `new Rapier3dAdapter()` can be called.
	 * @returns true once Rapier is compiled
	 */
	static get loaded(): boolean {
		return rapier !== undefined;
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
		const computeImpulse = rapier.SolverFlags.COMPUTE_IMPULSE;
		this.hooks = {
			filterContactPair: (c1, c2) => {
				return this._passesFilter(c1, c2) ? computeImpulse : null;
			},
			filterIntersectionPair: (c1, c2) => {
				return this._passesFilter(c1, c2);
			},
		};
	}

	// -------------------------------------------------------------------
	// Unit conversion helpers (pixels <-> meters)
	// -------------------------------------------------------------------

	private px2m(px: number): number {
		return px / this.pixelsPerMeter;
	}

	private m2px(m: number): number {
		return m * this.pixelsPerMeter;
	}

	private inMeters(x: number, y: number, z: number): XYZ {
		return { x: this.px2m(x), y: this.px2m(y), z: this.px2m(z) };
	}

	// -------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------

	init(world: World): void {
		this.melonWorld = world;
		this.world = new this.rapier.World(
			this.inMeters(this.gravity.x, this.gravity.y, this.gravity.z),
		);
		this.eventQueue = new this.rapier.EventQueue(true);
		this.alive = true;
	}

	destroy(): void {
		// nothing to free before `init()`, or a second time
		if (!this.alive) {
			return;
		}
		this.alive = false;
		// Rapier's objects live in WebAssembly memory, which the garbage
		// collector does not reclaim: they are freed here
		this.eventQueue.free();
		this.world.free();
		this.joints.clear();
		this.bodyMap.clear();
		this.collidersOf.clear();
		this.colliderMap.clear();
		this.filters.clear();
		this.activePairs.clear();
		this.pendingEvents.length = 0;
		this.forced.clear();
		this.velocityLimits.clear();
		this.defMap.clear();
		this.poses.clear();
		this.reportedShapes.clear();
		this.overrides.clear();
		this.dispatching.length = 0;
	}

	step(dt: number): void {
		if (!this.alive) {
			throw new Error(
				"@melonjs/rapier3d-adapter: step() on an adapter with no Rapier world: it was destroyed, or never installed with `world.setAdapter()`.",
			);
		}
		// as the other adapters: no simulation while the game is paused
		if (state.isPaused()) {
			return;
		}
		// a step of no length simulates nothing, and one that is not a
		// number would leave every body it touched stuck for good
		if (!(dt > 0) || !Number.isFinite(dt)) {
			return;
		}
		// read every step, so `adapter.gravity` can change while the game runs
		this.world.gravity = this.inMeters(
			this.gravity.x,
			this.gravity.y,
			this.gravity.z,
		);
		// melonJS passes dt in ms; Rapier wants seconds
		this.world.timestep = dt / 1000 / this.subSteps;
		for (let i = 0; i < this.subSteps; i++) {
			this.world.step(this.eventQueue, this.hooks);
			this._dispatchQueuedEvents();
		}
		// a force is for this frame, across every sub-step
		this._clearForces();
		this._clampVelocities();
		this._dispatchActiveContacts();
	}

	syncFromPhysics(): void {
		for (const [renderable, body] of this.bodyMap) {
			// a body at rest, or that never moves, has nothing new to write;
			// `setPosition` / `setRotation` write a moved one themselves
			if (body.isFixed() || body.isSleeping()) {
				continue;
			}
			this._syncRenderable(renderable, body);
		}
	}

	/**
	 * Write a body's position onto its renderable's `pos` / `depth` and its
	 * turn onto its `currentTransform`, from the transform it had when the
	 * body was made.
	 * @param renderable - the renderable
	 * @param body - its body
	 */
	private _syncRenderable(renderable: Renderable, body: RAPIER.RigidBody) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: pos is typed non-null but the pool releases it on recycle
		if (!renderable.pos) {
			return;
		}
		const p = body.translation();
		renderable.pos.x = this.m2px(p.x);
		renderable.pos.y = this.m2px(p.y);
		renderable.depth = this.m2px(p.z);
		const pose = this.poses.get(renderable);
		if (pose === undefined) {
			return;
		}
		const { x, y, z, w } = body.rotation();
		// the turn as a matrix, R[row][col]
		const r00 = 1 - 2 * (y * y + z * z);
		const r01 = 2 * (x * y - z * w);
		const r02 = 2 * (x * z + y * w);
		const r10 = 2 * (x * y + z * w);
		const r11 = 1 - 2 * (x * x + z * z);
		const r12 = 2 * (y * z - x * w);
		const r20 = 2 * (x * z - y * w);
		const r21 = 2 * (y * z + x * w);
		const r22 = 1 - 2 * (x * x + y * y);
		// carried into the space the transform turns in: D · R · D, with the
		// bridge D its own inverse
		const [d0, d1, d2] = pose.bridge;
		const m = [
			r00,
			r01 * d0 * d1,
			r02 * d0 * d2,
			r10 * d1 * d0,
			r11,
			r12 * d1 * d2,
			r20 * d2 * d0,
			r21 * d2 * d1,
			r22,
		];
		// currentTransform = R' · base, column by column (column-major)
		const out = renderable.currentTransform.val;
		const base = pose.base;
		for (let col = 0; col < 4; col++) {
			const o = col * 4;
			const b0 = base[o];
			const b1 = base[o + 1];
			const b2 = base[o + 2];
			out[o] = m[0] * b0 + m[1] * b1 + m[2] * b2;
			out[o + 1] = m[3] * b0 + m[4] * b1 + m[5] * b2;
			out[o + 2] = m[6] * b0 + m[7] * b1 + m[8] * b2;
			out[o + 3] = base[o + 3];
		}
		renderable.isDirty = true;
	}

	// -------------------------------------------------------------------
	// Body registration
	// -------------------------------------------------------------------

	addBody(renderable: Renderable, def: BodyDefinition): Rapier3dAdapter.Body {
		const R = this.rapier;
		// build every collider first, so a refused shape leaves no body
		// behind, nor takes away the one the renderable had
		const parts = this._buildParts(def.shapes);
		// a renderable has one body: a second one replaces the first
		this.removeBody(renderable);
		const desc =
			def.type === "static"
				? R.RigidBodyDesc.fixed()
				: def.type === "kinematic"
					? // moved by its velocity, as on the other adapters
						R.RigidBodyDesc.kinematicVelocityBased()
					: R.RigidBodyDesc.dynamic();
		// the body sits where the renderable is: shapes are relative to it
		desc.setTranslation(
			this.px2m(renderable.pos.x),
			this.px2m(renderable.pos.y),
			this.px2m(renderable.depth),
		);
		// `frictionAir` damps rotation as well as movement, as on the 2D
		// adapter: Rapier damping, a rate per second
		const damping = this._scalarOf(def.frictionAir) ?? 0;
		desc.setLinearDamping(damping);
		desc.setAngularDamping(damping);
		desc.setGravityScale(def.gravityScale ?? 1);
		// unset means a rigid body turns
		if (def.fixedRotation === true) {
			desc.lockRotations();
		}
		const body = this.world.createRigidBody(desc);
		const colliders: RAPIER.Collider[] = [];
		this.bodyMap.set(renderable, body);
		this.collidersOf.set(renderable, colliders);
		this.defMap.set(renderable, def);
		this._createColliders(renderable, body, def, parts, colliders);

		if (def.maxVelocity) {
			this.setMaxVelocity(renderable, def.maxVelocity);
		}
		this.poses.set(renderable, {
			base: Float64Array.from(renderable.currentTransform.val),
			bridge:
				renderable instanceof Mesh
					? // a mesh turns in its source's Y-up space (see Mesh)
						[1, -1, renderable.rightHanded ? -1 : 1]
					: [1, 1, 1],
		});

		this._spliceHelpers(renderable, body, colliders);

		const adapterBody = body as Rapier3dAdapter.Body;
		renderable.body = adapterBody;
		// as the builtin `Body` constructor does: a renderable with a body
		// takes part in physics and receives pointer events
		renderable.isKinematic = false;
		return adapterBody;
	}

	removeBody(renderable: Renderable): void {
		const body = this.bodyMap.get(renderable);
		if (body === undefined) {
			return;
		}
		// a partner still touching this body learns the contact ended
		this._endContacts(this.collidersOf.get(renderable) ?? []);
		// one of their hooks may have taken this body out already
		if (this.bodyMap.get(renderable) !== body) {
			return;
		}
		// Rapier removes the body's joints with it
		for (const joint of this.joints) {
			if (
				!joint.isValid() ||
				joint.body1().handle === body.handle ||
				joint.body2().handle === body.handle
			) {
				this.joints.delete(joint);
			}
		}
		// removes the body's colliders with it
		this.world.removeRigidBody(body);
		this.forced.delete(body);
		this.bodyMap.delete(renderable);
		this.collidersOf.delete(renderable);
		this.velocityLimits.delete(renderable);
		this.defMap.delete(renderable);
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
		const def = this.defMap.get(renderable);
		const body = this.bodyMap.get(renderable);
		const colliders = this.collidersOf.get(renderable);
		if (!def || !body || !colliders) {
			return;
		}
		// every new collider is built before an old one goes
		const parts = this._buildParts(shapes);
		this._endContacts(colliders);
		// one of the hooks told so may have taken this body out
		if (this.bodyMap.get(renderable) !== body) {
			return;
		}
		for (const collider of colliders) {
			this.world.removeCollider(collider, false);
		}
		// emptied in place: the body's helpers hold this array
		colliders.length = 0;
		const next = { ...def, shapes };
		this.defMap.set(renderable, next);
		this.reportedShapes.delete(renderable);
		this._createColliders(renderable, body, next, parts, colliders);
		// the mass and the inertia of the new shapes, from now
		body.recomputeMassPropertiesFromColliders();
		body.wakeUp();
	}

	/**
	 * The colliders a list of shapes becomes, not yet in the world. A shape
	 * with `isActive: false` makes none.
	 * @param shapes - the shapes of a body definition
	 * @returns one part per active shape
	 * @throws {Error} for a shape this adapter cannot build
	 */
	private _buildParts(shapes: BodyShape[]): ColliderPart[] {
		const parts: ColliderPart[] = [];
		for (const [index, shape] of shapes.entries()) {
			// `isActive === false` keeps a shape out of the simulation
			if ((shape as { isActive?: boolean }).isActive === false) {
				continue;
			}
			parts.push({ shape, index, ...this._shapeToCollider(shape) });
		}
		return parts;
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
	private _createColliders(
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
			const collider = this.world.createCollider(desc, body);
			// a shape's own collision settings override the body's
			this._applyFilter(
				collider,
				over?.category ??
					(typeof shapeType === "number" ? shapeType : bodyType),
				over?.mask ?? (typeof shapeMask === "number" ? shapeMask : bodyMask),
			);
			const entry: ColliderEntry = { renderable, shape, index, min, max };
			if (round !== undefined) {
				entry.round = round;
			}
			this.colliderMap.set(collider.handle, entry);
			colliders.push(collider);
		}
	}

	/**
	 * Forget colliders that are about to go, and tell the pairs touching
	 * them that their contact ended.
	 * @param colliders - the colliders leaving the world
	 */
	private _endContacts(colliders: RAPIER.Collider[]): void {
		const handles = new Set(
			colliders.map((c) => {
				return c.handle;
			}),
		);
		// a pair whose start or active hooks are running: the side going out
		// hears the end now, the other once those hooks are done, so that no
		// one hears of an end before its start
		for (const d of this.dispatching) {
			const going =
				(handles.has(d.h1) ? SIDE_A | SHAPE_A : 0) |
				(handles.has(d.h2) ? SIDE_B | SHAPE_B : 0);
			if (going !== 0 && (this.activePairs.delete(d.key) || d.ended)) {
				d.ended = true;
				const sides = going & d.reached & ~d.told;
				d.told |= sides;
				this._dispatch(d.e1, d.e2, d.h1, d.h2, "end", sides);
			}
		}
		for (const [key, [h1, h2]] of this.activePairs) {
			if (handles.has(h1) || handles.has(h2)) {
				this.activePairs.delete(key);
				this._dispatchPair(h1, h2, "end");
			}
		}
		for (const handle of handles) {
			this.colliderMap.delete(handle);
			this.filters.delete(handle);
		}
	}

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
		const bodyA = this.bodyMap.get(def.a);
		const bodyB = this.bodyMap.get(def.b);
		if (bodyA === undefined || bodyB === undefined) {
			throw new Error(
				"@melonjs/rapier3d-adapter: addJoint() needs both renderables to have a body in the world; add them with addChild() first.",
			);
		}
		const { JointData } = this.rapier;
		const anchorB = this._localAnchor(def.anchorB);
		// no anchor on `a`: the point of `a` under b's anchor, so nothing
		// moves when the joint is made; a rope joins the two centres
		const anchorA =
			def.anchorA === undefined && def.type !== "rope"
				? this._localPoint(bodyA, this._worldPoint(bodyB, anchorB))
				: this._localAnchor(def.anchorA);
		// the defaults resolved here are written back, so the same joint is
		// made again when the world rebuilds it
		def.anchorA ??= {
			x: this.m2px(anchorA.x),
			y: this.m2px(anchorA.y),
			z: this.m2px(anchorA.z),
		};
		def.anchorB ??= { x: 0, y: 0, z: 0 };
		// the turn that brings b's space onto a's, as the two stand
		const aInB = multiply(conjugate(bodyB.rotation()), bodyA.rotation());
		let data: RAPIER.JointData;
		switch (def.type) {
			case "hinge": {
				// the same axis in the world, in each body's own space: the
				// same vector in both when they are turned alike, or apart
				// about the axis only, as a 2D hinge is
				const axis = this._unitAxis(def.axis, { x: 0, y: 0, z: 1 });
				data = JointData.revoluteWithAxes(
					anchorA,
					anchorB,
					axis,
					rotate(aInB, axis),
				);
				break;
			}
			case "rope": {
				if (def.maxLength === undefined) {
					const pa = this._worldPoint(bodyA, anchorA);
					const pb = this._worldPoint(bodyB, anchorB);
					def.maxLength = this.m2px(
						Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z),
					);
				}
				data = JointData.rope(this.px2m(def.maxLength), anchorA, anchorB);
				break;
			}
			case "weld":
				// welded as they stand: A's frame is A, B's frame is the turn
				// that brings B onto A
				data = JointData.fixed(
					anchorA,
					{ x: 0, y: 0, z: 0, w: 1 },
					anchorB,
					aInB,
				);
				break;
			case "slider":
				data = JointData.prismatic(
					anchorA,
					anchorB,
					this._unitAxis(def.axis, { x: 1, y: 0, z: 0 }),
				);
				break;
			default:
				throw new Error(
					`@melonjs/rapier3d-adapter: unknown joint type "${String((def as { type: unknown }).type)}"; use "hinge", "rope", "weld" or "slider".`,
				);
		}
		const joint = this.world.createImpulseJoint(data, bodyA, bodyB, true);
		if (def.type === "slider") {
			// Rapier gives both bodies the same frame, which would turn b
			// onto a: b's frame is a's as b sees it, so b keeps its turn
			joint.setFrameX2(multiply(aInB, joint.frameX1()));
		}
		joint.setContactsEnabled(def.collideConnected === true);
		if (
			def.limits !== undefined &&
			(def.type === "hinge" || def.type === "slider")
		) {
			// radians for a hinge, meters along the axis for a slider
			const scale = def.type === "slider" ? 1 / this.pixelsPerMeter : 1;
			(joint as RAPIER.UnitImpulseJoint).setLimits(
				def.limits.min * scale,
				def.limits.max * scale,
			);
		}
		this.joints.add(joint);
		return joint;
	}

	/**
	 * Remove a joint {@link Rapier3dAdapter.addJoint} made: what
	 * `world.removeJoint()` calls. A joint already gone, with one of its
	 * bodies, is ignored.
	 * @param joint - the Rapier joint
	 */
	removeJoint(joint: RAPIER.ImpulseJoint): void {
		if (this.joints.delete(joint) && joint.isValid()) {
			this.world.removeImpulseJoint(joint, true);
		}
	}

	/**
	 * A joint axis as a unit vector, or the default for a missing or zero one.
	 * @param axis - the axis given, if any
	 * @param fallback - the default
	 * @returns a unit vector
	 */
	private _unitAxis(axis: Vector3Like | undefined, fallback: XYZ): XYZ {
		if (axis === undefined) {
			return fallback;
		}
		const z = axis.z ?? 0;
		const length = Math.hypot(axis.x, axis.y, z);
		if (!(length > 0) || !Number.isFinite(length)) {
			throw new Error(
				"@melonjs/rapier3d-adapter: a joint axis needs a length; got a zero or non-finite vector.",
			);
		}
		return { x: axis.x / length, y: axis.y / length, z: z / length };
	}

	/**
	 * A joint anchor in pixels as a point on its body in meters. No anchor is
	 * the body's origin, its renderable's `pos`.
	 * @param anchor - the anchor in pixels, or undefined
	 * @returns the body-local anchor
	 */
	private _localAnchor(anchor?: Vector3Like): XYZ {
		if (anchor === undefined) {
			return { x: 0, y: 0, z: 0 };
		}
		return this.inMeters(anchor.x, anchor.y, anchor.z ?? 0);
	}

	/**
	 * A world point as a point on a body, both in meters.
	 * @param body - the body
	 * @param world - the point in the world
	 * @returns the point on the body
	 */
	private _localPoint(body: RAPIER.RigidBody, world: XYZ): XYZ {
		const t = body.translation();
		return rotate(conjugate(body.rotation()), {
			x: world.x - t.x,
			y: world.y - t.y,
			z: world.z - t.z,
		});
	}

	/**
	 * A body-local point in world space, both in meters.
	 * @param body - the body
	 * @param local - the point on the body
	 * @returns the point in the world
	 */
	private _worldPoint(body: RAPIER.RigidBody, local: XYZ): XYZ {
		const t = body.translation();
		const p = rotate(body.rotation(), local);
		return { x: t.x + p.x, y: t.y + p.y, z: t.z + p.z };
	}

	// -------------------------------------------------------------------
	// Portable velocity / force / position API
	// -------------------------------------------------------------------

	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		const target = out ?? new Vector2d();
		const body = this.bodyMap.get(renderable);
		if (body) {
			const v = body.linvel();
			return target.set(this.m2px(v.x), this.m2px(v.y));
		}
		return target.set(0, 0);
	}

	/**
	 * The body's velocity on all three axes, in pixels per second.
	 * @param renderable - the body's renderable
	 * @param [out] - the vector to write into
	 * @returns the velocity; zero for a renderable with no body here
	 */
	getVelocity3d(renderable: Renderable, out?: Vector3d): Vector3d {
		const target = out ?? new Vector3d();
		const body = this.bodyMap.get(renderable);
		if (body) {
			const v = body.linvel();
			return target.set(this.m2px(v.x), this.m2px(v.y), this.m2px(v.z));
		}
		return target.set(0, 0, 0);
	}

	/**
	 * Set the body's velocity, in pixels per second. A {@link Vector3d} sets
	 * all three axes; a {@link Vector2d} sets x and y and keeps the depth
	 * velocity as it was.
	 * @param renderable - the body's renderable
	 * @param v - the velocity
	 */
	setVelocity(renderable: Renderable, v: Vector2d | Vector3d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			this._setLinvel(body, v.x, v.y, zOf(v));
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
		const body = this.bodyMap.get(renderable);
		if (body) {
			this._addForce(body, force, point);
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
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		const j = this.inMeters(impulse.x, impulse.y, zOf(impulse) ?? 0);
		if (point) {
			body.applyImpulseAtPoint(j, this._pointInMeters(body, point), true);
		} else {
			// the native method, not the portable helper spliced over it
			this.rapier.RigidBody.prototype.applyImpulse.call(body, j, true);
		}
	}

	/**
	 * Move the body and its renderable, at once. A {@link Vector3d} sets the
	 * depth too; a {@link Vector2d} keeps it. A renderable with no body here
	 * is moved all the same, as on every adapter.
	 * @param renderable - the body's renderable
	 * @param p - the new position, in `renderable.pos` space
	 */
	setPosition(renderable: Renderable, p: Vector2d | Vector3d): void {
		const depth = zOf(p) ?? renderable.depth;
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
		renderable.depth = depth;
		this.bodyMap
			.get(renderable)
			?.setTranslation(this.inMeters(p.x, p.y, depth), true);
	}

	/**
	 * The body's orientation, from the one it had when it was made.
	 * @param renderable - the body's renderable
	 * @param [out] - the quaternion to write into
	 * @returns the orientation; identity for a renderable with no body here
	 */
	getRotation(renderable: Renderable, out?: Quaternion): Quaternion {
		const target = out ?? new Quaternion();
		const body = this.bodyMap.get(renderable);
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
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		// a non-unit quaternion is not a turn: normalized, as Rapier needs
		const n = q.clone().normalize();
		body.setRotation({ x: n.x, y: n.y, z: n.z, w: n.w }, true);
		this._syncRenderable(renderable, body);
	}

	/**
	 * Turn the body to `angle` about Z, the turn a 2D game knows, leaving out
	 * any other.
	 * @param renderable - the body's renderable
	 * @param angle - in radians
	 */
	setAngle(renderable: Renderable, angle: number): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		body.setRotation(
			{ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) },
			true,
		);
		this._syncRenderable(renderable, body);
	}

	/**
	 * The body's turn about Z: the angle +X is turned through, seen down Z.
	 * @param renderable - the body's renderable
	 * @returns in radians; `0` for a renderable with no body here
	 */
	getAngle(renderable: Renderable): number {
		const body = this.bodyMap.get(renderable);
		if (!body) return 0;
		const x = rotate(body.rotation(), { x: 1, y: 0, z: 0 });
		return x.x * x.x + x.y * x.y < 1e-12 ? 0 : Math.atan2(x.y, x.x);
	}

	/**
	 * Set the body's spin, in radians per second: a {@link Vector3d} about
	 * each axis, a number about Z, keeping the spin about X and Y.
	 * @param renderable - the body's renderable
	 * @param omega - the spin
	 */
	setAngularVelocity(renderable: Renderable, omega: number | Vector3d): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		if (typeof omega === "number") {
			const w = body.angvel();
			body.setAngvel({ x: w.x, y: w.y, z: omega }, true);
		} else {
			body.setAngvel({ x: omega.x, y: omega.y, z: omega.z }, true);
		}
	}

	getAngularVelocity(renderable: Renderable): number {
		return this.bodyMap.get(renderable)?.angvel().z ?? 0;
	}

	/**
	 * The body's spin about each axis, in radians per second.
	 * @param renderable - the body's renderable
	 * @param [out] - the vector to write into
	 * @returns the spin; zero for a renderable with no body here
	 */
	getAngularVelocity3d(renderable: Renderable, out?: Vector3d): Vector3d {
		const target = out ?? new Vector3d();
		const w = this.bodyMap.get(renderable)?.angvel();
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
		const body = this.bodyMap.get(renderable);
		if (body) {
			this._addTorque(body, torque);
		}
	}

	// -------------------------------------------------------------------
	// Runtime body-property mutators
	// -------------------------------------------------------------------

	setStatic(renderable: Renderable, isStatic: boolean): void {
		this.bodyMap
			.get(renderable)
			?.setBodyType(
				isStatic
					? this.rapier.RigidBodyType.Fixed
					: this.rapier.RigidBodyType.Dynamic,
				true,
			);
	}

	setGravityScale(renderable: Renderable, scale: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			this.rapier.RigidBody.prototype.setGravityScale.call(body, scale, true);
		}
	}

	setSensor(renderable: Renderable, isSensor: boolean): void {
		const colliders = this.collidersOf.get(renderable);
		if (colliders === undefined) return;
		this._override(renderable).sensor = isSensor;
		for (const collider of colliders) {
			collider.setSensor(isSensor);
		}
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		const damping = this._scalarOf(friction) ?? 0;
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
		if (!this.bodyMap.has(renderable)) return;
		this.velocityLimits.set(renderable, {
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
		const limit = this.velocityLimits.get(renderable);
		return {
			x: limit?.x ?? Infinity,
			y: limit?.y ?? Infinity,
			z: limit?.z ?? Infinity,
		};
	}

	setCollisionType(renderable: Renderable, type: number): void {
		this._setFilter(renderable, type, undefined);
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		this._setFilter(renderable, undefined, mask);
	}

	// -------------------------------------------------------------------
	// Debug surface and queries
	// -------------------------------------------------------------------

	/**
	 * The body's XY bounds in renderable-local pixels, relative to `pos`: the
	 * footprint of its colliders as the body is turned now. Exact for a
	 * box, a sphere and a capsule; for a hull or a triangle mesh, that of its
	 * bounding box, turned.
	 * @param renderable - the renderable whose body bounds to read
	 * @param out - destination `Bounds` (filled in place, also returned)
	 */
	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined {
		const body = this.bodyMap.get(renderable);
		const colliders = this.collidersOf.get(renderable);
		if (body === undefined || colliders === undefined) {
			return undefined;
		}
		if (colliders.length === 0) {
			return undefined;
		}
		const q = body.rotation();
		const box: Footprint = [Infinity, Infinity, -Infinity, -Infinity];
		for (const collider of colliders) {
			const entry = this.colliderMap.get(collider.handle);
			if (entry !== undefined) {
				this._growFootprint(entry, q, box);
			}
		}
		out.setMinMax(box[0], box[1], box[2], box[3]);
		return out;
	}

	/**
	 * Grow a box in XY by a collider's footprint as its body is turned, in
	 * pixels, relative to the body's origin.
	 * @param entry - the collider's entry
	 * @param q - its body's turn
	 * @param box - the box to grow
	 */
	private _growFootprint(
		entry: ColliderEntry,
		q: RAPIER.Rotation,
		box: Footprint,
	): void {
		const { min, max, round } = entry;
		// a sphere or a capsule: the two ends of its segment, turned with
		// the body, a radius wider. Any other: the eight corners of its box,
		// turned with the body
		const r = round?.r ?? 0;
		for (let i = 0; i < (round ? 2 : 8); i++) {
			const p = rotate(
				q,
				round
					? i === 0
						? round.a
						: round.b
					: {
							x: i & 1 ? max.x : min.x,
							y: i & 2 ? max.y : min.y,
							z: i & 4 ? max.z : min.z,
						},
			);
			if (p.x - r < box[0]) box[0] = p.x - r;
			if (p.y - r < box[1]) box[1] = p.y - r;
			if (p.x + r > box[2]) box[2] = p.x + r;
			if (p.y + r > box[3]) box[3] = p.y + r;
		}
	}

	/**
	 * The body's collision shapes, as given in its `bodyDef`, relative to
	 * `pos` and before the body turns (the turn is
	 * {@link Rapier3dAdapter.getRotation}). A shape with `isActive: false`
	 * is left out.
	 * @param renderable - the renderable whose body shapes to read
	 */
	getBodyShapes(renderable: Renderable): readonly BodyShape[] {
		const colliders = this.collidersOf.get(renderable);
		if (colliders === undefined) {
			return [];
		}
		let cached = this.reportedShapes.get(renderable);
		if (cached === undefined) {
			cached = [];
			for (const collider of colliders) {
				const entry = this.colliderMap.get(collider.handle);
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
		const body = this.bodyMap.get(renderable);
		return body !== undefined && body.isDynamic() && body.isSleeping();
	}

	isGrounded(renderable: Renderable): boolean {
		const body = this.bodyMap.get(renderable);
		if (!body) return false;
		const bodyY = body.translation().y;
		// a touching contact that pushes the body UP, as on the 2D adapters;
		// a sensor pushes nothing, so a sensor contact counts when the other
		// body's centre is below this one's
		for (const collider of this.collidersOf.get(renderable) ?? []) {
			let grounded = false;
			this.world.intersectionPairsWith(collider, (other) => {
				const parent = other.parent();
				if (
					!grounded &&
					parent !== null &&
					this.world.intersectionPair(collider, other) &&
					parent.translation().y > bodyY
				) {
					grounded = true;
				}
			});
			this.world.contactPairsWith(collider, (other) => {
				if (grounded) return;
				this.world.contactPair(collider, other, (manifold, flipped) => {
					if (manifold.numContacts() === 0) return;
					const ny = flipped ? -manifold.normal().y : manifold.normal().y;
					// this body is pushed along the opposite of the normal
					if (-ny < -GROUND_NORMAL_Y) {
						grounded = true;
					}
				});
			});
			if (grounded) return true;
		}
		return false;
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
		// nothing to hit once the Rapier world is freed
		if (!this.alive) return null;
		const origin = this.inMeters(from.x, from.y, from.z);
		const dir = this.inMeters(to.x - from.x, to.y - from.y, to.z - from.z);
		if (dir.x === 0 && dir.y === 0 && dir.z === 0) return null;
		const ray = new this.rapier.Ray(origin, dir);
		const hit = this.world.castRayAndGetNormal(
			ray,
			1,
			true,
			undefined,
			undefined,
			undefined,
			undefined,
			(collider) => {
				return !collider.containsPoint(origin);
			},
		);
		if (hit === null) return null;
		const entry = this.colliderMap.get(hit.collider.handle);
		if (entry === undefined) return null;
		const toi = hit.timeOfImpact;
		return {
			renderable: entry.renderable,
			point: new Vector3d(
				this.m2px(origin.x + dir.x * toi),
				this.m2px(origin.y + dir.y * toi),
				this.m2px(origin.z + dir.z * toi),
			),
			normal: new Vector3d(hit.normal.x, hit.normal.y, hit.normal.z),
			fraction: toi,
		};
	}

	/**
	 * The renderables whose colliders' boxes overlap a rectangle in XY, at
	 * any depth: the boxes {@link Rapier3dAdapter.getBodyAABB} reports.
	 * @param rect - the rectangle, in world pixels
	 * @returns the renderables, each once
	 */
	queryAABB(rect: Rect): Renderable[] {
		const { x, y } = rect.pos;
		return this._collect((visit) => {
			this.world.collidersWithAabbIntersectingAabb(
				{
					x: this.px2m(x + rect.width / 2),
					y: this.px2m(y + rect.height / 2),
					z: 0,
				},
				{
					x: this.px2m(rect.width / 2),
					y: this.px2m(rect.height / 2),
					z: QUERY_HALF_DEPTH,
				},
				(collider) => {
					// Rapier keeps its own boxes loose, more so around a body
					// that moves: those are the candidates, tested here
					const entry = this.colliderMap.get(collider.handle);
					const body = collider.parent();
					if (entry === undefined || body === null) return true;
					const box: Footprint = [Infinity, Infinity, -Infinity, -Infinity];
					this._growFootprint(entry, body.rotation(), box);
					const t = body.translation();
					const bx = this.m2px(t.x);
					const by = this.m2px(t.y);
					return bx + box[0] <= x + rect.width &&
						bx + box[2] >= x &&
						by + box[1] <= y + rect.height &&
						by + box[3] >= y
						? visit(collider)
						: true;
				},
			);
		});
	}

	/**
	 * The renderables whose colliders overlap a sphere: their exact shapes.
	 * @param center - the centre in world pixels, or a {@link Sphere}
	 * @param [radius] - the radius in pixels, with a centre; none, or less
	 * than none, is a point
	 * @returns the renderables, each once
	 */
	querySphere(center: Vector3d | Sphere, radius?: number): Renderable[] {
		const isSphere = center instanceof Sphere;
		const c = isSphere ? center.pos : center;
		const r = isSphere ? center.radius : (radius ?? 0);
		const ball = new this.rapier.Ball(this.px2m(Math.max(r, 0)));
		return this._collect((visit) => {
			this.world.intersectionsWithShape(
				this.inMeters(c.x, c.y, c.z),
				{ x: 0, y: 0, z: 0, w: 1 },
				ball,
				visit,
			);
		});
	}

	/**
	 * The renderables a Rapier query visits, each once.
	 * @param query - runs the query with the visitor
	 * @returns the renderables
	 */
	private _collect(
		query: (visit: (collider: RAPIER.Collider) => boolean) => void,
	): Renderable[] {
		const result: Renderable[] = [];
		// nothing to find once the Rapier world is freed
		if (!this.alive) return result;
		const seen = new Set<Renderable>();
		query((collider) => {
			const entry = this.colliderMap.get(collider.handle);
			if (entry !== undefined && !seen.has(entry.renderable)) {
				seen.add(entry.renderable);
				result.push(entry.renderable);
			}
			return true;
		});
		return result;
	}

	// -------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------

	/**
	 * The portable `PhysicsBody` helpers, spliced onto the Rapier body so
	 * `renderable.body.setVelocity(x, y, z)` works as on every adapter. The
	 * body stays a real `RAPIER.RigidBody`.
	 * @param renderable - the body's renderable
	 * @param body - the Rapier body
	 * @param colliders - its colliders
	 */
	private _spliceHelpers(
		renderable: Renderable,
		body: RAPIER.RigidBody,
		colliders: RAPIER.Collider[],
	): void {
		const proto = this.rapier.RigidBody.prototype;
		const helpers: Omit<PhysicsBody, "collisionType" | "collisionMask"> = {
			setVelocity: (x: number, y: number, z?: number) => {
				this._setLinvel(body, x, y, z);
			},
			getVelocity: (out?: Vector2d): Vector2d => {
				return this.getVelocity(renderable, out);
			},
			getVelocity3d: (out?: Vector3d): Vector3d => {
				return this.getVelocity3d(renderable, out);
			},
			applyForce: (x: number, y: number, pointX?: number, pointY?: number) => {
				this._addForce(
					body,
					{ x, y },
					typeof pointX === "number" && typeof pointY === "number"
						? { x: pointX, y: pointY }
						: undefined,
				);
			},
			applyImpulse: (x: number, y: number, z?: number) => {
				proto.applyImpulse.call(body, this.inMeters(x, y, z ?? 0), true);
			},
			setSensor: (isSensor = true) => {
				this.setSensor(renderable, isSensor);
			},
			setStatic: (isStatic = true) => {
				this.setStatic(renderable, isStatic);
			},
			setCollisionMask: (mask: number) => {
				this._setFilter(renderable, undefined, mask);
			},
			setCollisionType: (type: number) => {
				this._setFilter(renderable, type, undefined);
			},
			/**
			 * Set the body's mass, keeping how it is spread over its shapes:
			 * every collider's density is scaled by the same factor.
			 * @param m - the new mass, in kilograms
			 */
			setMass: (m: number) => {
				const current = body.mass();
				if (current > 0) {
					const k = m / current;
					for (const collider of colliders) {
						collider.setDensity(collider.density() * k);
					}
					body.recomputeMassPropertiesFromColliders();
				}
			},
			setBounce: (r: number) => {
				this._override(renderable).restitution = r;
				for (const collider of colliders) {
					collider.setRestitution(r);
				}
			},
			setGravityScale: (scale: number) => {
				this.setGravityScale(renderable, scale);
			},
			setAngle: (rad: number) => {
				this.setAngle(renderable, rad);
			},
			getAngle: () => {
				return this.getAngle(renderable);
			},
			setAngularVelocity: (omega: number) => {
				this.setAngularVelocity(renderable, omega);
			},
			getAngularVelocity: () => {
				return this.getAngularVelocity(renderable);
			},
			applyTorque: (torque: number) => {
				this.applyTorque(renderable, torque);
			},
		};
		Object.assign(body, helpers);
		// `collisionType` / `collisionMask` read the first collider's values
		// and write every collider's, as on the 2D adapters
		const filters = this.filters;
		Object.defineProperties(body, {
			collisionType: {
				get: () => {
					const first = colliders[0] as RAPIER.Collider | undefined;
					return first ? (filters.get(first.handle)?.category ?? 0) : 0;
				},
				set: (v: number) => {
					this._setFilter(renderable, v, undefined);
				},
				configurable: true,
				enumerable: true,
			},
			collisionMask: {
				get: () => {
					const first = colliders[0] as RAPIER.Collider | undefined;
					return first ? (filters.get(first.handle)?.mask ?? 0) : 0;
				},
				set: (v: number) => {
					this._setFilter(renderable, undefined, v);
				},
				configurable: true,
				enumerable: true,
			},
		});
	}

	/**
	 * Set a body's velocity in pixels per second; a `z` left out keeps the
	 * depth velocity.
	 * @param body - the body
	 * @param x - along X
	 * @param y - along Y
	 * @param [z] - along Z
	 */
	private _setLinvel(
		body: RAPIER.RigidBody,
		x: number,
		y: number,
		z?: number,
	): void {
		body.setLinvel(
			{
				x: this.px2m(x),
				y: this.px2m(y),
				z: typeof z === "number" ? this.px2m(z) : body.linvel().z,
			},
			true,
		);
	}

	/**
	 * Add a force for this frame, in pixels: at a world point, it also turns
	 * the body. A force or a point with no `z` acts in the plane of the body.
	 * @param body - the body
	 * @param force - the force
	 * @param [point] - where it pushes, in world pixels
	 */
	private _addForce(
		body: RAPIER.RigidBody,
		force: Vector3Like,
		point?: Vector3Like,
	): void {
		const f = this.inMeters(force.x, force.y, zOf(force) ?? 0);
		if (point) {
			body.addForceAtPoint(f, this._pointInMeters(body, point), true);
		} else {
			body.addForce(f, true);
		}
		this.forced.add(body);
	}

	/**
	 * A world point in meters; one with no depth is in the plane of the body.
	 * @param body - the body it acts on
	 * @param point - the point in world pixels
	 * @returns the point in meters
	 */
	private _pointInMeters(body: RAPIER.RigidBody, point: Vector3Like): XYZ {
		const z = point.z;
		return {
			x: this.px2m(point.x),
			y: this.px2m(point.y),
			z: typeof z === "number" ? this.px2m(z) : body.translation().z,
		};
	}

	/**
	 * Add a torque for this frame: a number about Z, a vector about each axis.
	 * @param body - the body
	 * @param torque - the torque
	 */
	private _addTorque(
		body: RAPIER.RigidBody,
		torque: number | Vector3Like,
	): void {
		body.addTorque(
			typeof torque === "number"
				? { x: 0, y: 0, z: torque }
				: { x: torque.x, y: torque.y, z: torque.z ?? 0 },
			true,
		);
		this.forced.add(body);
	}

	private _clearForces(): void {
		for (const body of this.forced) {
			if (body.isValid()) {
				body.resetForces(false);
				body.resetTorques(false);
			}
		}
		this.forced.clear();
	}

	/**
	 * Give a collider its melonJS collision type and mask. Rapier's own
	 * collision groups hold 16 bits of membership and 16 of filter, where
	 * melonJS types and masks are 32 bits: a collider whose values do not fit
	 * is filtered by the `filterContactPair` / `filterIntersectionPair`
	 * hooks instead, on the full 32 bits.
	 * @param collider - the collider to configure
	 * @param category - its collision type
	 * @param mask - the collision types it collides with
	 */
	private _applyFilter(
		collider: RAPIER.Collider,
		category: number,
		mask: number,
	): void {
		this.filters.set(collider.handle, { category, mask });
		const hooked =
			category >>> 16 !== 0 || (mask >>> 16 !== 0 && (mask & 0xffff) === 0);
		if (hooked) {
			collider.setCollisionGroups(0xffffffff);
			collider.setActiveHooks(
				this.rapier.ActiveHooks.FILTER_CONTACT_PAIRS |
					this.rapier.ActiveHooks.FILTER_INTERSECTION_PAIRS,
			);
		} else {
			collider.setCollisionGroups(
				(((category & 0xffff) << 16) | (mask & 0xffff)) >>> 0,
			);
			collider.setActiveHooks(this.rapier.ActiveHooks.NONE);
		}
	}

	/**
	 * Change the collision type and/or mask of every collider of a body.
	 * @param renderable - the body's renderable
	 * @param category - the new type, or undefined to keep each collider's
	 * @param mask - the new mask, or undefined to keep each collider's
	 */
	private _setFilter(
		renderable: Renderable,
		category: number | undefined,
		mask: number | undefined,
	): void {
		const colliders = this.collidersOf.get(renderable);
		if (colliders === undefined) return;
		const over = this._override(renderable);
		if (category !== undefined) over.category = category;
		if (mask !== undefined) over.mask = mask;
		for (const collider of colliders) {
			const current = this.filters.get(collider.handle);
			this._applyFilter(
				collider,
				category ?? current?.category ?? 0x0001,
				mask ?? current?.mask ?? collision.types.ALL_OBJECT,
			);
		}
	}

	/**
	 * What was set on every collider of a body at run time, to write to.
	 * @param renderable - the body's renderable
	 * @returns its record, made when there is none
	 */
	private _override(renderable: Renderable): ColliderOverrides {
		let over = this.overrides.get(renderable);
		if (over === undefined) {
			over = {};
			this.overrides.set(renderable, over);
		}
		return over;
	}

	/**
	 * Whether two colliders collide, by their full 32-bit types and masks.
	 * @param c1 - a collider handle
	 * @param c2 - the other
	 * @returns true when each one's mask includes the other's type
	 */
	private _passesFilter(c1: number, c2: number): boolean {
		const f1 = this.filters.get(c1);
		const f2 = this.filters.get(c2);
		if (f1 === undefined || f2 === undefined) {
			return true;
		}
		return (f1.mask & f2.category) !== 0 && (f2.mask & f1.category) !== 0;
	}

	private _scalarOf(
		v: number | { x: number; y: number } | undefined,
	): number | undefined {
		if (v === undefined) return undefined;
		if (typeof v === "number") return v;
		// Rapier damping is one value; an {x, y} is averaged
		return (v.x + v.y) / 2;
	}

	private _clampVelocities(): void {
		for (const [renderable, limit] of this.velocityLimits) {
			const body = this.bodyMap.get(renderable);
			if (!body) continue;
			const v = body.linvel();
			const clamp = (value: number, px: number | undefined) => {
				// no cap on this axis; one that is not a number caps nothing
				// (it would turn the velocity itself into NaN)
				if (typeof px !== "number" || Number.isNaN(px)) return value;
				const m = this.px2m(Math.abs(px));
				return Math.max(-m, Math.min(m, value));
			};
			const vx = clamp(v.x, limit.x);
			const vy = clamp(v.y, limit.y);
			const vz = clamp(v.z, limit.z);
			if (vx !== v.x || vy !== v.y || vz !== v.z) {
				body.setLinvel({ x: vx, y: vy, z: vz }, false);
			}
		}
	}

	/**
	 * Dispatch the start and end events Rapier queued during the last step.
	 * They are all read before any is dispatched, so a handler that removes
	 * a body cannot disturb the queue.
	 */
	private _dispatchQueuedEvents(): void {
		const events = this.pendingEvents;
		events.length = 0;
		this.eventQueue.drainCollisionEvents((h1, h2, started) => {
			events.push(h1, h2, started ? 1 : 0);
		});
		for (let i = 0; i < events.length; i += 3) {
			const h1 = events[i];
			const h2 = events[i + 1];
			const key = pairKey(h1, h2);
			if (events[i + 2] === 1) {
				// a hook earlier in this step may have taken one of them out
				if (this.colliderMap.has(h1) && this.colliderMap.has(h2)) {
					this.activePairs.set(key, [h1, h2]);
					this._dispatchPair(h1, h2, "start");
				}
			} else if (this.activePairs.delete(key)) {
				// a pair already ended (one of its bodies was removed) is not
				// ended twice
				this._dispatchPair(h1, h2, "end");
			}
		}
	}

	private _dispatchActiveContacts(): void {
		// once per frame, for every pair still touching
		for (const [h1, h2] of this.activePairs.values()) {
			this._dispatchPair(h1, h2, "active");
		}
	}

	/**
	 * The contact between two colliders: the normal from the first to the
	 * second, and how deep they overlap, in pixels. Zero for a sensor pair,
	 * which Rapier computes no contact for.
	 * @param h1 - the first collider handle
	 * @param h2 - the second
	 * @returns the normal and the depth
	 */
	private _contact(
		h1: number,
		h2: number,
	): { nx: number; ny: number; nz: number; depth: number } {
		const c1 = this.world.getCollider(h1);
		const c2 = this.world.getCollider(h2);
		let nx = 0;
		let ny = 0;
		let nz = 0;
		let depth = 0;
		if (c1.isSensor() || c2.isSensor()) {
			return { nx, ny, nz, depth };
		}
		this.world.contactPair(c1, c2, (manifold, flipped) => {
			const count = manifold.numContacts();
			if (count === 0) return;
			const n = manifold.normal();
			let deepest = 0;
			for (let i = 0; i < count; i++) {
				const d = -manifold.contactDist(i);
				if (d > deepest) deepest = d;
			}
			if (deepest >= depth) {
				depth = deepest;
				const s = flipped ? -1 : 1;
				nx = s * n.x;
				ny = s * n.y;
				nz = s * n.z;
			}
		});
		return { nx, ny, nz, depth: this.m2px(depth) };
	}

	/**
	 * Fire the hooks of one pair of colliders, on both renderables. A start
	 * or active hook may take a body of the pair out: see {@link Dispatch}.
	 * @param h1 - the first collider handle
	 * @param h2 - the second
	 * @param phase - which lifecycle hook to fire
	 */
	private _dispatchPair(
		h1: number,
		h2: number,
		phase: "start" | "active" | "end",
	): void {
		const e1 = this.colliderMap.get(h1);
		const e2 = this.colliderMap.get(h2);
		if (e1 === undefined || e2 === undefined) return;
		if (phase === "end") {
			this._dispatch(e1, e2, h1, h2, phase, EVERY_SIDE);
			return;
		}
		const current: Dispatch = {
			key: pairKey(h1, h2),
			h1,
			h2,
			e1,
			e2,
			// a pair already active had its start on every side
			reached: phase === "start" ? 0 : EVERY_SIDE,
			told: 0,
			ended: false,
		};
		this.dispatching.push(current);
		try {
			this._dispatch(
				e1,
				e2,
				h1,
				h2,
				phase,
				EVERY_SIDE,
				phase === "start" ? current : undefined,
			);
		} finally {
			this.dispatching.splice(this.dispatching.indexOf(current), 1);
		}
		if (current.ended) {
			this._dispatch(e1, e2, h1, h2, "end", current.reached & ~current.told);
		}
	}

	/**
	 * Fire one phase of a pair's hooks: the shape-level ones, then the
	 * renderables' own. A renderable whose body is gone hears nothing.
	 * @param e1 - the first collider's entry
	 * @param e2 - the second collider's entry
	 * @param h1 - the first collider handle
	 * @param h2 - the second
	 * @param phase - which lifecycle hook to fire
	 * @param sides - the sides and levels to fire it on, as bits
	 * @param [record] - where to note each side reached, before its hook runs
	 */
	private _dispatch(
		e1: ColliderEntry,
		e2: ColliderEntry,
		h1: number,
		h2: number,
		phase: "start" | "active" | "end",
		sides: number,
		record?: Dispatch,
	): void {
		const rA = e1.renderable;
		const rB = e2.renderable;
		// skip start/active when either side has left the world; an end still
		// reaches the side that remains
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
		// a hook earlier in this dispatch may have removed a body: its
		// renderable hears nothing from then on
		const reaches = (side: number, receiver: Renderable, detached: boolean) => {
			if ((sides & side) === 0 || detached || !this.bodyMap.has(receiver)) {
				return false;
			}
			if (record !== undefined) {
				record.reached |= side;
			}
			return true;
		};

		// a separated pair has no contact: identity only
		const { nx, ny, nz, depth } =
			phase === "end"
				? { nx: 0, ny: 0, nz: 0, depth: 0 }
				: this._contact(h1, h2);

		const methodForSide = (receiver: Renderable): string => {
			if (phase === "start") return "onCollisionStart";
			if (phase === "end") return "onCollisionEnd";
			return typeof (receiver as Renderable & { onCollisionActive?: unknown })
				.onCollisionActive === "function"
				? "onCollisionActive"
				: "onCollision";
		};

		// each melonJS shape is one collider, so Rapier's events name the
		// shapes: the shape-level hooks first
		const shapeMethod =
			phase === "start"
				? "onShapeCollisionStart"
				: phase === "end"
					? "onShapeCollisionEnd"
					: "onShapeCollisionActive";
		const isTrigger =
			(e1.shape as { isTrigger?: boolean }).isTrigger === true ||
			(e2.shape as { isTrigger?: boolean }).isTrigger === true;
		const emitShape = (
			own: ColliderEntry,
			other: ColliderEntry,
			sign: number,
		): void => {
			const receiver = own.renderable;
			const fn = (receiver as Renderable & Record<string, unknown>)[
				shapeMethod
			];
			if (typeof fn !== "function") return;
			// (`+ 0` keeps a zero normal from reading as -0)
			const ownNx = sign * nx + 0;
			const ownNy = sign * ny + 0;
			const ownNz = sign * nz + 0;
			(fn as (contact: unknown, other: Renderable) => unknown).call(
				receiver,
				{
					a: receiver,
					b: other.renderable,
					shapeA: own.shape,
					shapeB: other.shape,
					indexShapeA: own.index,
					indexShapeB: other.index,
					isTrigger,
					depth,
					overlap: depth,
					normal: { x: ownNx, y: ownNy },
					normalZ: ownNz,
					// the SAT fields, in the builtin's convention
					overlapN: { x: -ownNx + 0, y: -ownNy + 0 },
					overlapNZ: -ownNz + 0,
					overlapV: { x: -ownNx * depth + 0, y: -ownNy * depth + 0 },
					overlapZ: -ownNz * depth + 0,
				},
				other.renderable,
			);
		};
		// the normal points from A to B: A escapes along its opposite, B
		// along it
		if (reaches(SHAPE_A, rA, aDetached)) {
			emitShape(e1, e2, -1);
		}
		if (reaches(SHAPE_B, rB, bDetached)) {
			emitShape(e2, e1, 1);
		}

		const pair = { collider1: h1, collider2: h2 };
		const emit = (receiver: Renderable, other: Renderable, sign: number) => {
			const fn = (receiver as Renderable & Record<string, unknown>)[
				methodForSide(receiver)
			];
			if (typeof fn !== "function") return;
			(fn as (response: unknown, other: Renderable) => unknown).call(
				receiver,
				{
					a: receiver,
					b: other,
					normal: { x: sign * nx + 0, y: sign * ny + 0, z: sign * nz + 0 },
					depth,
					pair,
				},
				other,
			);
		};
		if (reaches(SIDE_A, rA, aDetached)) {
			emit(rA, rB, -1);
		}
		if (reaches(SIDE_B, rB, bDetached)) {
			emit(rB, rA, 1);
		}
	}

	/**
	 * The Rapier collider a melonJS 3D shape becomes, with its box in body
	 * space, in pixels.
	 * @param shape - the shape
	 * @returns its collider description and box
	 * @throws {Error} for a 2D shape, or anything else this adapter cannot build
	 */
	private _shapeToCollider(
		shape: BodyShape,
	): Omit<ColliderPart, "shape" | "index"> {
		const R = this.rapier;
		const box = (c: XYZ, hx: number, hy: number, hz: number) => {
			return {
				min: { x: c.x - hx, y: c.y - hy, z: c.z - hz },
				max: { x: c.x + hx, y: c.y + hy, z: c.z + hz },
			};
		};
		const at = (desc: RAPIER.ColliderDesc, c: XYZ) => {
			return desc.setTranslation(
				this.px2m(c.x),
				this.px2m(c.y),
				this.px2m(c.z),
			);
		};
		if (shape instanceof Box3d) {
			const h = shape.halfExtents;
			return {
				desc: at(
					R.ColliderDesc.cuboid(this.px2m(h.x), this.px2m(h.y), this.px2m(h.z)),
					shape.pos,
				),
				...box(shape.pos, h.x, h.y, h.z),
			};
		}
		if (shape instanceof Sphere) {
			const r = shape.radius;
			const { x, y, z } = shape.pos;
			return {
				desc: at(R.ColliderDesc.ball(this.px2m(r)), shape.pos),
				...box(shape.pos, r, r, r),
				round: { a: { x, y, z }, b: { x, y, z }, r },
			};
		}
		if (shape instanceof Capsule3d) {
			const r = shape.radius;
			const half = shape.halfSegment;
			const { x, y, z } = shape.pos;
			// along Y, as Rapier's own capsule
			return {
				desc: at(
					R.ColliderDesc.capsule(this.px2m(half), this.px2m(r)),
					shape.pos,
				),
				...box(shape.pos, r, half + r, r),
				round: { a: { x, y: y - half, z }, b: { x, y: y + half, z }, r },
			};
		}
		if (shape instanceof TriangleMesh3d || shape instanceof ConvexHull3d) {
			const source =
				shape instanceof TriangleMesh3d ? shape.vertices : shape.points;
			const meters = new Float32Array(source.length);
			const { x: ox, y: oy, z: oz } = shape.pos;
			for (let i = 0; i < source.length; i += 3) {
				meters[i] = this.px2m(source[i] + ox);
				meters[i + 1] = this.px2m(source[i + 1] + oy);
				meters[i + 2] = this.px2m(source[i + 2] + oz);
			}
			const b = shape.getBounds3d();
			const bounds = {
				min: { x: b.min.x, y: b.min.y, z: b.min.z },
				max: { x: b.max.x, y: b.max.y, z: b.max.z },
			};
			if (shape instanceof TriangleMesh3d) {
				return {
					desc: R.ColliderDesc.trimesh(meters, shape.indices),
					...bounds,
				};
			}
			const hull = R.ColliderDesc.convexHull(meters);
			if (hull !== null) {
				return { desc: hull, ...bounds };
			}
			// points all in one plane have no hull: their bounding box
			const c = {
				x: (bounds.min.x + bounds.max.x) / 2,
				y: (bounds.min.y + bounds.max.y) / 2,
				z: (bounds.min.z + bounds.max.z) / 2,
			};
			const half = (lo: number, hi: number) => {
				return Math.max((hi - lo) / 2, 0.5);
			};
			const hx = half(bounds.min.x, bounds.max.x);
			const hy = half(bounds.min.y, bounds.max.y);
			const hz = half(bounds.min.z, bounds.max.z);
			return {
				desc: at(
					R.ColliderDesc.cuboid(this.px2m(hx), this.px2m(hy), this.px2m(hz)),
					c,
				),
				...box(c, hx, hy, hz),
			};
		}
		// refused loudly rather than skipped, as on the other adapters
		throw new Error(unsupportedShapeMessage(shape));
	}
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
