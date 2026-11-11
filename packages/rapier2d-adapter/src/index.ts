import type * as RAPIER from "@dimforge/rapier2d-compat";
import {
	type AdapterCapabilities,
	type BodyDefinition,
	type BodyShape,
	type Bounds,
	collision,
	Ellipse,
	Line,
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
 * Minimum melonJS version this adapter requires: the lower bound of its
 * `melonjs` peer dependency range, so the two cannot disagree.
 * @hidden
 */
export const REQUIRED_MELONJS_VERSION = "20.0.0";

/**
 * Options accepted by the {@link RapierAdapter} constructor and by
 * {@link RapierAdapter.create}.
 */
export interface RapierAdapterOptions {
	/**
	 * World gravity in **pixels per second²**. Default `{x: 0, y: 320}`,
	 * about 10 m/s² at the default `pixelsPerMeter` of 32: Earth-like
	 * gravity pulling down. Converted to meters for Rapier.
	 */
	gravity?: { x: number; y: number };
	/**
	 * Rapier is tuned for objects about a meter across, so the adapter works
	 * in meters and converts at every boundary (positions, velocities,
	 * gravity, forces, queries). Default `32`: a 32×32 sprite is one meter.
	 * Raising it makes every body smaller in meters, so lighter, and the same
	 * force moves it further; motion under gravity alone looks the same in
	 * pixels.
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
 * How thick a `Line` on a dynamic body is simulated as, in pixels. A segment
 * has no area, so it gives a dynamic body no mass; a thin quad along it does.
 * On a static or kinematic body a `Line` is a true Rapier segment.
 */
const LINE_THICKNESS = 2;

/**
 * How far UP a contact normal must point for {@link RapierAdapter.isGrounded}
 * to count the contact as ground: the upward component of the unit normal
 * the body is pushed along. `0.1` accepts any surface up to about 84 degrees
 * from horizontal and rejects a vertical wall, as the other adapters do.
 */
const GROUND_NORMAL_Y = 0.1;

/**
 * The message for a shape this adapter cannot build a collider from: the
 * same wording, and the same two reasons, as the matter and planck adapters.
 * @param adapter - the adapter's name, for the prefix
 * @param shape - the shape that was refused
 * @returns the message to throw
 */
function unsupportedShapeMessage(adapter: string, shape: BodyShape): string {
	// `type` rather than `constructor.name`: the class name is mangled by a
	// minifier and this string is most useful in a production build.
	const name =
		(shape as { type?: string }).type ??
		(shape as { constructor: { name: string } }).constructor.name;
	const prefix = `${adapter}: unsupported shape type ${name}.`;
	if (name === "Box3d" || name === "Sphere") {
		return `${prefix} Box3d and Sphere carry a depth extent, and a 2D solver has no depth to resolve it against, so they are resolved only by the builtin adapter. Either give this body the planar shape with the same footprint (an Ellipse for a Sphere, a Rect for a Box3d), or leave it on the builtin adapter.`;
	}
	if (name === "Point") {
		return `${prefix} A Point has no area to build a collider from. Use a small Rect or Ellipse instead, with isSensor set if it is only meant to report contacts.`;
	}
	return `${prefix} This adapter builds colliders from Rect, RoundRect, Polygon, Line and Ellipse.`;
}

/** A point or a vector, in pixels or meters. */
type XY = { x: number; y: number };

/**
 * A collider's outline in pixels, relative to its body's origin and
 * unrotated: what {@link RapierAdapter.getBodyShapes} poses and reports.
 * Kept by the adapter because Rapier hands back the vertices of some shapes
 * (convex polygons) but not of others (segments, triangles).
 */
type LocalGeometry =
	| { kind: "circle"; x: number; y: number; r: number }
	| { kind: "polygon"; points: { x: number; y: number }[] }
	| { kind: "line"; a: { x: number; y: number }; b: { x: number; y: number } };

/** What the adapter knows about one Rapier collider. */
interface ColliderEntry {
	renderable: Renderable;
	/** the melonJS shape it was built from */
	shape: BodyShape;
	/** that shape's index in the body definition */
	index: number;
	geometry: LocalGeometry;
}

/** The Rapier module, once {@link RapierAdapter.load} has compiled it. */
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
 * melonJS physics adapter for Rapier 2D (https://rapier.rs), compiled to
 * WebAssembly.
 *
 * Rapier is a fast rigid-body engine: many bodies at once, continuous
 * collision detection per body, a deterministic simulation, joints and a
 * character controller. This adapter implements the full
 * {@link PhysicsAdapter} interface, so the same `bodyDef`s and collision
 * hooks that run on the built-in, matter and planck adapters run here.
 *
 * Rapier's WebAssembly has to be compiled before an adapter can be
 * constructed. {@link RapierAdapter.create} does both, and is the same call
 * on every melonJS adapter; {@link RapierAdapter.load} compiles it ahead of
 * time. Rapier works in meters and seconds; the adapter converts through
 * {@link RapierAdapterOptions.pixelsPerMeter} (default `32`).
 * @example
 * import { Application } from "melonjs";
 * import { RapierAdapter } from "@melonjs/rapier2d-adapter";
 *
 * const app = new Application(800, 600, {
 *     parent: "screen",
 *     physic: await RapierAdapter.create({ gravity: { x: 0, y: 900 } }),
 * });
 * @category Plugins
 * @document ../README.md
 */
export class RapierAdapter implements PhysicsAdapter {
	readonly physicLabel = "rapier";
	readonly name = "@melonjs/rapier2d-adapter";
	readonly version = __VERSION__;
	readonly url = "https://www.npmjs.com/package/@melonjs/rapier2d-adapter";

	readonly capabilities: AdapterCapabilities = {
		constraints: true,
		// opt-in per body: `(body as RapierAdapter.Body).enableCcd(true)`
		continuousCollisionDetection: true,
		sleepingBodies: true,
		raycasts: true,
		// Rapier 2D is 2D-only; no `raycast3d`
		raycasts3d: false,
		velocityLimit: true,
		isGrounded: true,
	};

	gravity: Vector2d;

	/**
	 * The Rapier module: an escape hatch for what the portable
	 * {@link PhysicsAdapter} interface does not cover (joints, the
	 * character controller, native queries).
	 *
	 * ```ts
	 * const adapter = app.world.adapter as RapierAdapter;
	 * const { rapier, world } = adapter;
	 * const a = player.body as RapierAdapter.Body;
	 * const b = anchor.body as RapierAdapter.Body;
	 * const params = rapier.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 });
	 * world.createImpulseJoint(params, a, b, true);
	 * ```
	 *
	 * Code that touches `adapter.rapier` or `adapter.world` is Rapier-only.
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
	private readonly collidersOf = new Map<Renderable, RAPIER.Collider[]>();
	/** collider handle -> its renderable, shape and outline */
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
	/** bodies with a force or torque to clear once the frame is stepped */
	private readonly forced = new Set<RAPIER.RigidBody>();
	private readonly velocityLimits = new Map<
		Renderable,
		{ x: number; y: number }
	>();
	private readonly defMap = new Map<Renderable, BodyDefinition>();
	/**
	 * Offset between `renderable.pos` and the Rapier body's translation (the
	 * body origin, at the first shape's centre), in pixels.
	 */
	private readonly posOffsets = new Map<Renderable, { x: number; y: number }>();
	/**
	 * Shapes handed back by {@link RapierAdapter#getBodyShapes}: one reusable
	 * array per renderable, refreshed in place.
	 */
	private readonly reportedShapes = new Map<Renderable, BodyShape[]>();

	private readonly subSteps: number;

	/**
	 * Download and compile Rapier's WebAssembly. Every call returns the same
	 * promise, so it can be started early (in parallel with
	 * `loader.preload()`) and awaited wherever it is needed; a failed load
	 * (offline, a blocked chunk) rejects, and a later call tries again.
	 *
	 * Rapier is imported with `import()`, so bundlers put its 3 MB in a chunk
	 * of its own, downloaded only when this is called.
	 * @returns a promise that resolves once the adapter can be constructed
	 * @example
	 * const rapierReady = RapierAdapter.load();
	 * await loader.preload(assets);
	 * await rapierReady;
	 * app.world.setAdapter(new RapierAdapter());
	 */
	static load(): Promise<void> {
		loading ??= import("@dimforge/rapier2d-compat")
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
	 * Whether {@link RapierAdapter.load} has finished, so that
	 * `new RapierAdapter()` can be called.
	 * @returns true once Rapier is compiled
	 */
	static get loaded(): boolean {
		return rapier !== undefined;
	}

	/**
	 * Create an adapter, the same way for every adapter: wait for
	 * {@link RapierAdapter.load}, then construct it.
	 * @param options - the constructor's options
	 * @returns the new adapter, an instance of the class `create` is called on
	 * @example
	 * const app = new Application(800, 600, {
	 *     physic: await RapierAdapter.create(),
	 * });
	 */
	static async create<T extends PhysicsAdapter>(
		// the shape of `PhysicsAdapterClass`, spelled out so this package
		// still type-checks against a melonJS older than the one defining it
		this: Pick<typeof RapierAdapter, "load"> &
			(new (
				options?: RapierAdapterOptions,
			) => T),
		options?: RapierAdapterOptions,
	): Promise<T> {
		await this.load();
		return new this(options);
	}

	/**
	 * Construct an adapter. Rapier must be loaded first: use
	 * {@link RapierAdapter.create}, or await {@link RapierAdapter.load}.
	 * @param options - see {@link RapierAdapterOptions}
	 */
	constructor(options: RapierAdapterOptions = {}) {
		if (utils.checkVersion(REQUIRED_MELONJS_VERSION, melonjsVersion) > 0) {
			throw new Error(
				`@melonjs/rapier2d-adapter requires melonJS >= ${REQUIRED_MELONJS_VERSION}, ` +
					`but the loaded melonJS is ${melonjsVersion}.`,
			);
		}
		if (rapier === undefined) {
			throw new Error(
				"@melonjs/rapier2d-adapter: Rapier is not loaded yet. Use " +
					"`await RapierAdapter.create(options)`, or `await RapierAdapter.load()` " +
					"before `new RapierAdapter(options)`.",
			);
		}
		this.rapier = rapier;
		this.pixelsPerMeter = options.pixelsPerMeter ?? 32;
		this.subSteps = Math.max(1, Math.floor(options.subSteps ?? 1));
		const g = options.gravity ?? { x: 0, y: 320 };
		this.gravity = new Vector2d(g.x, g.y);
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

	private vecInMeters(x: number, y: number): { x: number; y: number } {
		return { x: this.px2m(x), y: this.px2m(y) };
	}

	// -------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------

	init(world: World): void {
		this.melonWorld = world;
		this.world = new this.rapier.World(
			this.vecInMeters(this.gravity.x, this.gravity.y),
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
		this.bodyMap.clear();
		this.collidersOf.clear();
		this.colliderMap.clear();
		this.filters.clear();
		this.activePairs.clear();
		this.pendingEvents.length = 0;
		this.forced.clear();
		this.velocityLimits.clear();
		this.defMap.clear();
		this.posOffsets.clear();
		this.reportedShapes.clear();
	}

	step(dt: number): void {
		if (!this.alive) {
			throw new Error(
				"@melonjs/rapier2d-adapter: step() on an adapter with no Rapier world: it was destroyed, or never installed with `world.setAdapter()`.",
			);
		}
		// as the other adapters: no simulation while the game is paused
		if (state.isPaused()) {
			return;
		}
		// read every step, so `adapter.gravity` can change while the game runs
		this.world.gravity = this.vecInMeters(this.gravity.x, this.gravity.y);
		// melonJS passes dt in ms; Rapier wants seconds
		this.world.timestep = dt / 1000 / this.subSteps;
		for (let i = 0; i < this.subSteps; i++) {
			this.world.step(this.eventQueue, this.hooks);
			this._dispatchQueuedEvents();
		}
		// Rapier keeps a force until it is cleared; clearing it once the
		// frame is stepped gives `applyForce` its documented meaning, a force
		// for this frame, across every sub-step
		this._clearForces();
		this._clampVelocities();
		this._dispatchActiveContacts();
	}

	syncFromPhysics(): void {
		for (const [renderable, body] of this.bodyMap) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: pos is typed non-null but the pool releases it on recycle
			if (!renderable.pos) {
				continue;
			}
			const p = body.translation();
			const px = this.m2px(p.x);
			const py = this.m2px(p.y);
			const off = this.posOffsets.get(renderable);
			renderable.pos.x = px + (off?.x ?? 0);
			renderable.pos.y = py + (off?.y ?? 0);
			// mirror the body's angle onto the renderable's transform, turning
			// about the body origin: `preDraw` pivots at `pos`, and the body
			// origin sits `-posOffset` from it
			const angle = body.rotation();
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

	addBody(renderable: Renderable, def: BodyDefinition): RapierAdapter.Body {
		const R = this.rapier;
		// The frame the renderable DRAWS in, as on the planck adapter: the
		// anchor offset `preDraw` applies, unless the renderable opts out of
		// it, and never from an infinite (container) size.
		const anchored = renderable.applyAnchorTransform;
		const anchorX =
			anchored && Number.isFinite(renderable.width)
				? renderable.width * renderable.anchorPoint.x
				: 0;
		const anchorY =
			anchored && Number.isFinite(renderable.height)
				? renderable.height * renderable.anchorPoint.y
				: 0;
		const baseX = renderable.pos.x - anchorX;
		const baseY = renderable.pos.y - anchorY;

		// the body origin is the first shape's centre, so a body that rotates
		// turns about the middle of what it looks like
		const centroid = this._computeCentroid(def.shapes);
		const desc =
			def.type === "static"
				? R.RigidBodyDesc.fixed()
				: def.type === "kinematic"
					? // moved by its velocity, as a Box2D kinematic body is
						R.RigidBodyDesc.kinematicVelocityBased()
					: R.RigidBodyDesc.dynamic();
		desc.setTranslation(
			this.px2m(baseX + centroid.x),
			this.px2m(baseY + centroid.y),
		);
		// `frictionAir` damps rotation as well as movement, as on matter and
		// planck: Rapier damping, a rate per second
		const damping = this._scalarOf(def.frictionAir) ?? 0;
		desc.setLinearDamping(damping);
		desc.setAngularDamping(damping);
		desc.setGravityScale(def.gravityScale ?? 1);
		// unset means a rigid body rotates, as on matter and planck
		if (def.fixedRotation === true) {
			desc.lockRotations();
		}
		const body = this.world.createRigidBody(desc);

		const colliders: RAPIER.Collider[] = [];
		const bodyType =
			typeof def.collisionType === "number" ? def.collisionType : 0x0001;
		const bodyMask =
			typeof def.collisionMask === "number"
				? def.collisionMask
				: collision.types.ALL_OBJECT;
		for (const [index, shape] of def.shapes.entries()) {
			// `isActive === false` keeps a shape out of the simulation
			if ((shape as { isActive?: boolean }).isActive === false) {
				continue;
			}
			const shapeType = (shape as { collisionType?: number }).collisionType;
			const shapeMask = (shape as { collisionMask?: number }).collisionMask;
			const trigger = (shape as { isTrigger?: boolean }).isTrigger === true;
			for (const part of this._shapeToColliders(shape, centroid, def.type)) {
				part.desc
					.setDensity(def.density ?? 1)
					.setFriction(def.friction ?? 0.2)
					.setRestitution(def.restitution ?? 0)
					// a trigger shape is a sensor: it reports contacts and
					// contributes nothing to the solver
					.setSensor(def.isSensor === true || trigger)
					.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
				const collider = this.world.createCollider(part.desc, body);
				// a shape's own collision settings override the body's, as on
				// the planck adapter
				this._applyFilter(
					collider,
					typeof shapeType === "number" ? shapeType : bodyType,
					typeof shapeMask === "number" ? shapeMask : bodyMask,
				);
				this.colliderMap.set(collider.handle, {
					renderable,
					shape,
					index,
					geometry: part.geometry,
				});
				colliders.push(collider);
			}
		}

		if (def.maxVelocity) {
			this.velocityLimits.set(renderable, {
				x: def.maxVelocity.x,
				y: def.maxVelocity.y,
			});
		}
		this.bodyMap.set(renderable, body);
		this.collidersOf.set(renderable, colliders);
		this.defMap.set(renderable, def);
		// maps the body origin back onto `renderable.pos`, anchor included
		this.posOffsets.set(renderable, {
			x: anchorX - centroid.x,
			y: anchorY - centroid.y,
		});

		this._spliceHelpers(renderable, body, colliders);

		const adapterBody = body as RapierAdapter.Body;
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
		const colliders = this.collidersOf.get(renderable) ?? [];
		// a partner still touching this body learns the contact ended, as it
		// does on the other adapters
		const handles = new Set(
			colliders.map((c) => {
				return c.handle;
			}),
		);
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
		// removes the body's colliders with it
		this.world.removeRigidBody(body);
		this.forced.delete(body);
		this.bodyMap.delete(renderable);
		this.collidersOf.delete(renderable);
		this.velocityLimits.delete(renderable);
		this.defMap.delete(renderable);
		this.posOffsets.delete(renderable);
		this.reportedShapes.delete(renderable);
	}

	updateShape(renderable: Renderable, shapes: BodyShape[]): void {
		// rebuild the body with the new shapes, carrying its velocity over
		const oldDef = this.defMap.get(renderable);
		if (!oldDef) {
			return;
		}
		const oldBody = this.bodyMap.get(renderable);
		const linvel = oldBody?.linvel();
		const angvel = oldBody?.angvel() ?? 0;
		this.removeBody(renderable);
		const body = this.addBody(renderable, { ...oldDef, shapes });
		if (linvel) {
			body.setLinvel(linvel, true);
			body.setAngvel(angvel, true);
		}
	}

	// -------------------------------------------------------------------
	// Portable velocity / force / position API
	// -------------------------------------------------------------------

	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		const body = this.bodyMap.get(renderable);
		const target = out ?? new Vector2d();
		if (body) {
			const v = body.linvel();
			return target.set(this.m2px(v.x), this.m2px(v.y));
		}
		return target.set(0, 0);
	}

	setVelocity(renderable: Renderable, v: Vector2d): void {
		this.bodyMap.get(renderable)?.setLinvel(this.vecInMeters(v.x, v.y), true);
	}

	applyForce(renderable: Renderable, force: Vector2d, point?: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			this._addForce(body, force.x, force.y, point?.x, point?.y);
		}
	}

	applyImpulse(
		renderable: Renderable,
		impulse: Vector2d,
		point?: Vector2d,
	): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		const j = this.vecInMeters(impulse.x, impulse.y);
		if (point) {
			body.applyImpulseAtPoint(j, this.vecInMeters(point.x, point.y), true);
		} else {
			// the native method, not the portable helper spliced over it
			this.rapier.RigidBody.prototype.applyImpulse.call(body, j, true);
		}
	}

	setPosition(renderable: Renderable, p: Vector2d): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			// `p` is in `renderable.pos` space; the body origin is offset from it
			const off = this.posOffsets.get(renderable);
			body.setTranslation(
				this.vecInMeters(p.x - (off?.x ?? 0), p.y - (off?.y ?? 0)),
				true,
			);
		}
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
	}

	setAngle(renderable: Renderable, angle: number): void {
		this.bodyMap.get(renderable)?.setRotation(angle, true);
	}

	getAngle(renderable: Renderable): number {
		return this.bodyMap.get(renderable)?.rotation() ?? 0;
	}

	setAngularVelocity(renderable: Renderable, omega: number): void {
		this.bodyMap.get(renderable)?.setAngvel(omega, true);
	}

	getAngularVelocity(renderable: Renderable): number {
		return this.bodyMap.get(renderable)?.angvel() ?? 0;
	}

	applyTorque(renderable: Renderable, torque: number): void {
		const body = this.bodyMap.get(renderable);
		if (body) {
			body.addTorque(torque, true);
			this.forced.add(body);
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
		for (const collider of this.collidersOf.get(renderable) ?? []) {
			collider.setSensor(isSensor);
		}
	}

	setFrictionAir(
		renderable: Renderable,
		friction: number | { x: number; y: number },
	): void {
		const body = this.bodyMap.get(renderable);
		if (!body) return;
		// both, as `addBody` sets them from the `bodyDef`'s `frictionAir`
		const damping = this._scalarOf(friction) ?? 0;
		body.setLinearDamping(damping);
		body.setAngularDamping(damping);
	}

	setMaxVelocity(
		renderable: Renderable,
		limit: { x: number; y: number },
	): void {
		this.velocityLimits.set(renderable, { x: limit.x, y: limit.y });
	}

	getMaxVelocity(renderable: Renderable): { x: number; y: number } {
		// a copy, so changing it does not change the cap; no cap reads as
		// Infinity
		const limit = this.velocityLimits.get(renderable);
		return limit ? { x: limit.x, y: limit.y } : { x: Infinity, y: Infinity };
	}

	setCollisionType(renderable: Renderable, type: number): void {
		this._setFilter(renderable, type, undefined);
	}

	setCollisionMask(renderable: Renderable, mask: number): void {
		this._setFilter(renderable, undefined, mask);
	}

	// -------------------------------------------------------------------
	// Debug surface
	// -------------------------------------------------------------------

	/**
	 * The body's bounds in renderable-local pixels: the union of the shapes
	 * {@link RapierAdapter.getBodyShapes} reports.
	 * @param renderable - the renderable whose body bounds to read
	 * @param out - destination `Bounds` (filled in place, also returned)
	 */
	getBodyAABB(renderable: Renderable, out: Bounds): Bounds | undefined {
		const shapes = this.getBodyShapes(renderable);
		if (shapes.length === 0) return undefined;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const shape of shapes) {
			const b = shape.getBounds();
			if (b.min.x < minX) minX = b.min.x;
			if (b.min.y < minY) minY = b.min.y;
			if (b.max.x > maxX) maxX = b.max.x;
			if (b.max.y > maxY) maxY = b.max.y;
		}
		out.setMinMax(minX, minY, maxX, maxY);
		return out;
	}

	/**
	 * The body's collision shapes in renderable-local pixels, at the body's
	 * current position and rotation: one per Rapier collider, so what
	 * actually collides. An Ellipse is a circle of the average radius, a
	 * concave polygon is its triangles, and a shape with `isActive: false`
	 * has none.
	 * @param renderable - the renderable whose body shapes to read
	 */
	getBodyShapes(renderable: Renderable): readonly BodyShape[] {
		const body = this.bodyMap.get(renderable);
		if (body === undefined) {
			return [];
		}
		const colliders = this.collidersOf.get(renderable) ?? [];
		const t = body.translation();
		const angle = body.rotation();
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const ox = this.m2px(t.x) - renderable.pos.x;
		const oy = this.m2px(t.y) - renderable.pos.y;
		const pose = (p: { x: number; y: number }) => {
			return {
				x: ox + (cos * p.x - sin * p.y),
				y: oy + (sin * p.x + cos * p.y),
			};
		};

		let cached = this.reportedShapes.get(renderable);
		// rebuilt only when the structure changes; the pose is refreshed in
		// place, so a spinning body allocates little per frame
		if (cached === undefined || cached.length !== colliders.length) {
			cached = [];
			this.reportedShapes.set(renderable, cached);
		}
		for (let i = 0; i < colliders.length; i++) {
			const entry = this.colliderMap.get(colliders[i].handle);
			if (entry === undefined) continue;
			const g = entry.geometry;
			const existing = cached[i];
			if (g.kind === "circle") {
				const c = pose(g);
				if (existing instanceof Ellipse) {
					existing.pos.set(c.x, c.y);
					existing.radiusV.set(g.r, g.r);
				} else {
					cached[i] = new Ellipse(c.x, c.y, g.r * 2, g.r * 2);
				}
				continue;
			}
			const points = g.kind === "line" ? [g.a, g.b] : g.points;
			const posed = points.map(pose);
			if (
				existing instanceof Polygon &&
				existing instanceof Line === (g.kind === "line") &&
				existing.points.length === posed.length
			) {
				for (let v = 0; v < posed.length; v++) {
					existing.points[v].set(posed[v].x, posed[v].y);
				}
				existing.pos.set(0, 0);
				existing.recalc();
				existing.updateBounds();
			} else {
				// a line has two points and a polygon at least three, which the
				// tuple types say and the arrays above cannot
				type XY = { x: number; y: number };
				cached[i] =
					g.kind === "line"
						? new Line(0, 0, [posed[0], posed[1]])
						: new Polygon(0, 0, posed as [XY, XY, XY, ...XY[]]);
			}
		}
		return cached;
	}

	isGrounded(renderable: Renderable): boolean {
		const body = this.bodyMap.get(renderable);
		if (!body) return false;
		const bodyY = body.translation().y;
		// "Grounded" = a touching contact that pushes the body UP, as on the
		// other adapters: the side of a wall never lands a body. A sensor
		// pushes nothing and has no contact normal, so a sensor contact keeps
		// the older rule: the other body's centre is below this one's.
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
					// the normal points from the first collider of the
					// manifold to the second; `flipped` says the manifold's
					// first collider is `other`
					const ny = flipped ? -manifold.normal().y : manifold.normal().y;
					// this body is pushed along the opposite of that
					if (-ny < -GROUND_NORMAL_Y) {
						grounded = true;
					}
				});
			});
			if (grounded) return true;
		}
		return false;
	}

	raycast(from: Vector2d, to: Vector2d): RaycastHit | null {
		const origin = this.vecInMeters(from.x, from.y);
		const dir = this.vecInMeters(to.x - from.x, to.y - from.y);
		if (dir.x === 0 && dir.y === 0) return null;
		const ray = new this.rapier.Ray(origin, dir);
		// a shape the ray starts inside is skipped, as Box2D does, so a body
		// casting from its own centre does not hit itself
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
			point: new Vector2d(
				this.m2px(origin.x + dir.x * toi),
				this.m2px(origin.y + dir.y * toi),
			),
			normal: new Vector2d(hit.normal.x, hit.normal.y),
			fraction: toi,
		};
	}

	queryAABB(rect: Rect): Renderable[] {
		const result: Renderable[] = [];
		const seen = new Set<Renderable>();
		this.world.collidersWithAabbIntersectingAabb(
			this.vecInMeters(
				rect.pos.x + rect.width / 2,
				rect.pos.y + rect.height / 2,
			),
			this.vecInMeters(rect.width / 2, rect.height / 2),
			(collider) => {
				const entry = this.colliderMap.get(collider.handle);
				if (entry !== undefined && !seen.has(entry.renderable)) {
					seen.add(entry.renderable);
					result.push(entry.renderable);
				}
				return true;
			},
		);
		return result;
	}

	// -------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------

	/**
	 * The portable `PhysicsBody` helpers, spliced onto the Rapier body so
	 * `renderable.body.setVelocity(x, y)` works as on every adapter. The body
	 * stays a real `RAPIER.RigidBody`. `applyImpulse` and `setGravityScale`
	 * share a name with a native method of another signature, so the helper
	 * calls the native one through the prototype.
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
			setVelocity: (x: number, y: number) => {
				body.setLinvel(this.vecInMeters(x, y), true);
			},
			getVelocity: (out?: Vector2d): Vector2d => {
				const v = body.linvel();
				return (out ?? new Vector2d()).set(this.m2px(v.x), this.m2px(v.y));
			},
			applyForce: (x: number, y: number, pointX?: number, pointY?: number) => {
				this._addForce(body, x, y, pointX, pointY);
			},
			applyImpulse: (x: number, y: number) => {
				proto.applyImpulse.call(body, this.vecInMeters(x, y), true);
			},
			setSensor: (isSensor = true) => {
				for (const collider of colliders) {
					collider.setSensor(isSensor);
				}
			},
			setStatic: (isStatic = true) => {
				body.setBodyType(
					isStatic
						? this.rapier.RigidBodyType.Fixed
						: this.rapier.RigidBodyType.Dynamic,
					true,
				);
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
				for (const collider of colliders) {
					collider.setRestitution(r);
				}
			},
			setGravityScale: (scale: number) => {
				proto.setGravityScale.call(body, scale, true);
			},
			setAngle: (rad: number) => {
				body.setRotation(rad, true);
			},
			getAngle: () => {
				return body.rotation();
			},
			setAngularVelocity: (omega: number) => {
				body.setAngvel(omega, true);
			},
			getAngularVelocity: () => {
				return body.angvel();
			},
			applyTorque: (torque: number) => {
				body.addTorque(torque, true);
				this.forced.add(body);
			},
		};
		Object.assign(body, helpers);
		// `collisionType` / `collisionMask` read the first collider's values
		// and write every collider's, as on the planck adapter
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

	private _addForce(
		body: RAPIER.RigidBody,
		x: number,
		y: number,
		pointX?: number,
		pointY?: number,
	): void {
		const force = this.vecInMeters(x, y);
		if (typeof pointX === "number" && typeof pointY === "number") {
			// off the centre of mass, so it also turns the body
			body.addForceAtPoint(force, this.vecInMeters(pointX, pointY), true);
		} else {
			body.addForce(force, true);
		}
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
	 * Give a collider its melonJS collision type and mask.
	 *
	 * Rapier's own collision groups hold 16 bits of membership and 16 of
	 * filter, where melonJS types and masks are 32 bits (user types run up
	 * to bit 31). A collider whose values fit is filtered by Rapier natively.
	 * One whose type uses a bit from 16 up, or whose mask allows only such
	 * bits, lets every pair through Rapier's groups and is filtered by the
	 * `filterContactPair` / `filterIntersectionPair` hooks instead, on the
	 * full 32 bits. Pairs of two native colliders never reach the hooks.
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
		for (const collider of this.collidersOf.get(renderable) ?? []) {
			const current = this.filters.get(collider.handle);
			this._applyFilter(
				collider,
				category ?? current?.category ?? 0x0001,
				mask ?? current?.mask ?? collision.types.ALL_OBJECT,
			);
		}
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
		// Rapier damping is one value; an {x, y} is averaged, as on planck
		return (v.x + v.y) / 2;
	}

	private _clampVelocities(): void {
		for (const [renderable, limit] of this.velocityLimits) {
			const body = this.bodyMap.get(renderable);
			if (!body) continue;
			// limits are in pixels per second, the adapter's velocity unit
			const limitX = this.px2m(limit.x);
			const limitY = this.px2m(limit.y);
			const v = body.linvel();
			const vx = Math.max(-limitX, Math.min(limitX, v.x));
			const vy = Math.max(-limitY, Math.min(limitY, v.y));
			if (vx !== v.x || vy !== v.y) {
				body.setLinvel({ x: vx, y: vy }, false);
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
				this.activePairs.set(key, [h1, h2]);
				this._dispatchPair(h1, h2, "start");
			} else if (this.activePairs.delete(key)) {
				// a pair already ended (one of its bodies was removed) is not
				// ended twice
				this._dispatchPair(h1, h2, "end");
			}
		}
	}

	private _dispatchActiveContacts(): void {
		// once per frame, for every pair still touching, as on planck
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
	): { nx: number; ny: number; depth: number } {
		const c1 = this.world.getCollider(h1);
		const c2 = this.world.getCollider(h2);
		let nx = 0;
		let ny = 0;
		let depth = 0;
		if (c1.isSensor() || c2.isSensor()) {
			return { nx, ny, depth };
		}
		this.world.contactPair(c1, c2, (manifold, flipped) => {
			const count = manifold.numContacts();
			if (count === 0) return;
			const n = manifold.normal();
			// the deepest point of the deepest manifold names the contact
			let deepest = 0;
			for (let i = 0; i < count; i++) {
				const d = -manifold.contactDist(i);
				if (d > deepest) deepest = d;
			}
			if (deepest >= depth) {
				depth = deepest;
				nx = flipped ? -n.x : n.x;
				ny = flipped ? -n.y : n.y;
			}
		});
		return { nx, ny, depth: this.m2px(depth) };
	}

	private _dispatchPair(
		h1: number,
		h2: number,
		phase: "start" | "active" | "end",
	): void {
		const e1 = this.colliderMap.get(h1);
		const e2 = this.colliderMap.get(h2);
		if (e1 === undefined || e2 === undefined) return;
		const rA = e1.renderable;
		const rB = e2.renderable;
		// Detachment handling, as on the other adapters: skip a stale pair,
		// and skip start/active when either side has left the world; an end
		// still reaches the side that remains.
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

		// a separated pair has no contact: identity only, as on the others
		const { nx, ny, depth } =
			phase === "end" ? { nx: 0, ny: 0, depth: 0 } : this._contact(h1, h2);

		const methodForSide = (receiver: Renderable): string => {
			if (phase === "start") return "onCollisionStart";
			if (phase === "end") return "onCollisionEnd";
			return typeof (receiver as Renderable & { onCollisionActive?: unknown })
				.onCollisionActive === "function"
				? "onCollisionActive"
				: "onCollision";
		};

		this._dispatchShapePair(e1, e2, nx, ny, depth, phase, aDetached, bDetached);

		const pair = { collider1: h1, collider2: h2 };
		// the normal points from A to B: A escapes along its opposite, B
		// along it
		const responseAB = {
			a: rA,
			b: rB,
			normal: { x: -nx, y: -ny },
			depth,
			pair,
		};
		const responseBA = {
			a: rB,
			b: rA,
			normal: { x: nx, y: ny },
			depth,
			pair,
		};
		// a handler earlier in this dispatch may have removed this body
		if (!aDetached && this.bodyMap.has(rA)) {
			const fnA = (rA as Renderable & Record<string, unknown>)[
				methodForSide(rA)
			];
			if (typeof fnA === "function") {
				(fnA as (response: unknown, other: Renderable) => unknown).call(
					rA,
					responseAB,
					rB,
				);
			}
		}
		if (!bDetached && this.bodyMap.has(rB)) {
			const fnB = (rB as Renderable & Record<string, unknown>)[
				methodForSide(rB)
			];
			if (typeof fnB === "function") {
				(fnB as (response: unknown, other: Renderable) => unknown).call(
					rB,
					responseBA,
					rA,
				);
			}
		}
	}

	/**
	 * Fire the shape-level collision hooks for one pair of colliders. Each
	 * melonJS shape is one collider (a concave polygon, one per triangle), so
	 * Rapier's per-collider events name the shapes.
	 * @param e1 - the first collider's entry
	 * @param e2 - the second collider's entry
	 * @param nx - contact normal x, from the first to the second
	 * @param ny - contact normal y, from the first to the second
	 * @param depth - penetration depth, in pixels
	 * @param phase - which lifecycle hook to fire
	 * @param aDetached - true when the first renderable has left the world
	 * @param bDetached - true when the second renderable has left the world
	 */
	private _dispatchShapePair(
		e1: ColliderEntry,
		e2: ColliderEntry,
		nx: number,
		ny: number,
		depth: number,
		phase: "start" | "active" | "end",
		aDetached: boolean,
		bDetached: boolean,
	): void {
		const method =
			phase === "start"
				? "onShapeCollisionStart"
				: phase === "end"
					? "onShapeCollisionEnd"
					: "onShapeCollisionActive";
		const isTrigger =
			(e1.shape as { isTrigger?: boolean }).isTrigger === true ||
			(e2.shape as { isTrigger?: boolean }).isTrigger === true;
		const emit = (
			own: ColliderEntry,
			other: ColliderEntry,
			ownNx: number,
			ownNy: number,
		): void => {
			const receiver = own.renderable;
			const fn = (receiver as Renderable & Record<string, unknown>)[method];
			// skipped too when an earlier handler removed this body
			if (typeof fn !== "function" || !this.bodyMap.has(receiver)) {
				return;
			}
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
					// the SAT fields `ShapeCollisionContact` declares, in the
					// builtin's convention
					overlapN: { x: -ownNx, y: -ownNy },
					overlapV: { x: -ownNx * depth, y: -ownNy * depth },
					overlapZ: 0,
					overlapNZ: 0,
					normalZ: 0,
				},
				other.renderable,
			);
		};
		if (!aDetached) {
			emit(e1, e2, -nx, -ny);
		}
		if (!bDetached) {
			emit(e2, e1, nx, ny);
		}
	}

	private _computeCentroid(shapes: BodyShape[]): { x: number; y: number } {
		// the first shape's geometric centre, as on matter and planck
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

	/**
	 * The Rapier colliders a melonJS shape becomes, with their outlines.
	 * @param shape - the shape
	 * @param centroid - the body origin, in renderable-local pixels
	 * @param type - the body type, for a `Line`
	 * @returns one collider description per piece
	 */
	private _shapeToColliders(
		shape: BodyShape,
		centroid: XY,
		type: BodyDefinition["type"],
	): { desc: RAPIER.ColliderDesc; geometry: LocalGeometry }[] {
		const R = this.rapier;
		// renderable-local pixels to body-local pixels
		const local = (x: number, y: number) => {
			return { x: x - centroid.x, y: y - centroid.y };
		};
		const flat = (points: { x: number; y: number }[]) => {
			const out = new Float32Array(points.length * 2);
			points.forEach((p, i) => {
				out[i * 2] = this.px2m(p.x);
				out[i * 2 + 1] = this.px2m(p.y);
			});
			return out;
		};
		const box = (cx: number, cy: number, w: number, h: number) => {
			const c = local(cx, cy);
			return {
				desc: R.ColliderDesc.cuboid(
					this.px2m(w / 2),
					this.px2m(h / 2),
				).setTranslation(this.px2m(c.x), this.px2m(c.y)),
				geometry: {
					kind: "polygon" as const,
					points: [
						{ x: c.x - w / 2, y: c.y - h / 2 },
						{ x: c.x + w / 2, y: c.y - h / 2 },
						{ x: c.x + w / 2, y: c.y + h / 2 },
						{ x: c.x - w / 2, y: c.y + h / 2 },
					],
				},
			};
		};

		// `Rect` and `Line` extend `Polygon`, so they are checked first
		if (shape instanceof Rect) {
			return [
				box(
					shape.pos.x + shape.width / 2,
					shape.pos.y + shape.height / 2,
					shape.width,
					shape.height,
				),
			];
		}
		if (shape instanceof Ellipse) {
			// Rapier has no ellipse: a circle of the average radius, as on
			// matter and planck
			const r = (shape.radiusV.x + shape.radiusV.y) / 2;
			const c = local(shape.pos.x, shape.pos.y);
			return [
				{
					desc: R.ColliderDesc.ball(this.px2m(r)).setTranslation(
						this.px2m(c.x),
						this.px2m(c.y),
					),
					geometry: { kind: "circle", x: c.x, y: c.y, r },
				},
			];
		}
		if (shape instanceof Line) {
			const [p1, p2] = shape.points;
			const a = local(shape.pos.x + p1.x, shape.pos.y + p1.y);
			const b = local(shape.pos.x + p2.x, shape.pos.y + p2.y);
			const length = Math.hypot(b.x - a.x, b.y - a.y);
			if (type !== "dynamic" || length === 0) {
				// an exact segment, for the terrain a Tiled polyline usually is
				return [
					{
						desc: R.ColliderDesc.segment(
							this.vecInMeters(a.x, a.y),
							this.vecInMeters(b.x, b.y),
						),
						geometry: { kind: "line", a, b },
					},
				];
			}
			// a segment has no area, so it would give a dynamic body no mass: a
			// thin quad along it instead
			const nx = (-(b.y - a.y) / length) * (LINE_THICKNESS / 2);
			const ny = ((b.x - a.x) / length) * (LINE_THICKNESS / 2);
			const quad = [
				{ x: a.x + nx, y: a.y + ny },
				{ x: b.x + nx, y: b.y + ny },
				{ x: b.x - nx, y: b.y - ny },
				{ x: a.x - nx, y: a.y - ny },
			];
			const desc = R.ColliderDesc.convexHull(flat(quad));
			if (desc !== null) {
				return [{ desc, geometry: { kind: "polygon", points: quad } }];
			}
		}
		if (shape instanceof Polygon) {
			const points = shape.points.map((p) => {
				return local(shape.pos.x + p.x, shape.pos.y + p.y);
			});
			if (shape.isConvex() === false) {
				// concave: its triangles, so the outline is simulated exactly
				const indices = shape.getIndices();
				const parts: { desc: RAPIER.ColliderDesc; geometry: LocalGeometry }[] =
					[];
				for (let i = 0; i + 2 < indices.length; i += 3) {
					const tri = [
						points[indices[i]],
						points[indices[i + 1]],
						points[indices[i + 2]],
					];
					parts.push({
						desc: R.ColliderDesc.triangle(
							this.vecInMeters(tri[0].x, tri[0].y),
							this.vecInMeters(tri[1].x, tri[1].y),
							this.vecInMeters(tri[2].x, tri[2].y),
						),
						geometry: { kind: "polygon", points: tri },
					});
				}
				if (parts.length > 0) {
					return parts;
				}
			}
			const desc = R.ColliderDesc.convexHull(flat(points));
			if (desc !== null) {
				return [{ desc, geometry: { kind: "polygon", points } }];
			}
			// a degenerate outline (collinear points) has no hull: its
			// bounding box, as on matter
			const bounds = shape.getBounds();
			return [
				box(
					bounds.x + bounds.width / 2,
					bounds.y + bounds.height / 2,
					Math.max(bounds.width, 1),
					Math.max(bounds.height, 1),
				),
			];
		}
		// refused loudly rather than skipped, as on matter and planck
		throw new Error(unsupportedShapeMessage("RapierAdapter", shape));
	}
}

/**
 * Namespace-merged with the {@link RapierAdapter} class to expose
 * adapter-owned types alongside the runtime API.
 */
// biome-ignore lint/style/useNamingConvention: namespace must match the class it merges with
// eslint-disable-next-line @typescript-eslint/no-namespace -- intentional class+namespace declaration merge so adapter-owned types (`RapierAdapter.Body`) are reachable alongside the runtime class
export namespace RapierAdapter {
	/**
	 * The body handle attached to `renderable.body` under
	 * {@link RapierAdapter}: the Rapier `RigidBody` (with all its native
	 * methods: `enableCcd`, `linvel`, `mass`, `sleep`, …) and the portable
	 * melonJS helpers spliced onto it.
	 *
	 * ```ts
	 * (this.body as RapierAdapter.Body).enableCcd(true);
	 * ```
	 */
	export type Body = RAPIER.RigidBody & PhysicsBody;
}
