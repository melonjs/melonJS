import { consolePhysics } from "../application/header.ts";
import { hasRegisteredEvents } from "../input/pointerevent.ts";
import Container, {
	hasRegisteredBody,
	registerTreeBodies,
	unregisterTreeBodies,
} from "../renderable/container.js";
import {
	emit,
	GAME_RESET,
	LEVEL_LOADED,
	off,
	on,
	WORLD_STEP,
} from "../system/event.ts";
import { createBroadphase } from "./broadphase/factory.ts";
import Body from "./builtin/body.js";
import BuiltinAdapter from "./builtin/builtin-adapter.ts";

/**
 * @import Application from "./../application/application.ts";
 * @import Detector from "./builtin/detector.js";
 * @import { Vector2d } from "../math/vector2d.ts";
 * @import { JointDefinition, PhysicsAdapter, PhysicsJoint } from "./adapter.ts";
 */

/**
 * Frozen empty Set returned by `world.bodies` when the active adapter
 * doesn't expose a native `bodies` Set (third-party adapters that own
 * their own body storage). Frozen so `world.bodies.add(x)` throws
 * `TypeError` instead of silently mutating a throwaway.
 * @ignore
 * @internal
 */
const EMPTY_BODIES = Object.freeze(new Set());

/**
 * Whether {@link World#reset} keeps the body of the given renderable: a
 * persistent renderable, or any renderable still in the world's tree after
 * the reset, at any depth.
 * @ignore
 * @internal
 * @param {World} world - the world being reset
 * @param {object} [renderable] - the renderable owning the body
 * @returns {boolean}
 */
function keepsBodyOf(world, renderable) {
	if (!renderable) {
		return false;
	}
	if (renderable.isPersistent === true) {
		return true;
	}
	for (let a = renderable.ancestor; a; a = a.ancestor) {
		if (a === world) {
			return true;
		}
	}
	return false;
}

/**
 * Drop the body handles {@link World#setAdapter} is about to build again, at
 * any depth: a renderable with a `bodyDef` gets a new body from it, at rest,
 * even from another instance of the same adapter, which would otherwise take
 * the old built-in `Body` over with its velocity. A definition with no shapes
 * of its own keeps its body: it is the legacy bridge, whose shapes live on
 * the `Body` it was built with.
 * @ignore
 * @internal
 * @param {object} node - a renderable leaving the outgoing adapter
 */
function releaseDefinedBodies(node) {
	const shapes = node.bodyDef?.shapes;
	if (node.body !== undefined && shapes !== undefined && shapes.length > 0) {
		if (node.body instanceof Body) {
			node.body.destroy();
		}
		node.body = undefined;
	}
	if (node instanceof Container) {
		node.forEach(releaseDefinedBodies);
	}
}

/**
 * The angle of every body {@link World#setAdapter} is about to build again,
 * at any depth, read from the outgoing adapter: a body is built at angle 0,
 * and is turned back to this once it is.
 * @ignore
 * @internal
 * @param {object} node - a renderable leaving the outgoing adapter
 * @param {PhysicsAdapter} adapter - the outgoing adapter
 * @param {Map<object, number>} out - receives each turned body's angle
 */
function collectBodyAngles(node, adapter, out) {
	const shapes = node.bodyDef?.shapes;
	if (node.body !== undefined && shapes !== undefined && shapes.length > 0) {
		const angle = adapter.getAngle?.(node) ?? 0;
		if (angle !== 0) {
			out.set(node, angle);
		}
	}
	if (node instanceof Container) {
		node.forEach((child) => {
			collectBodyAngles(child, adapter, out);
		});
	}
}

/**
 * an object representing the physic world, and responsible for managing and updating all children and physics
 * @category Container
 */
export default class World extends Container {
	/**
	 * @param {number} [x=0] - position of the container (accessible via the inherited pos.x property)
	 * @param {number} [y=0] - position of the container (accessible via the inherited pos.y property)
	 * @param {number} [width=Infinity] - width of the world container
	 * @param {number} [height=Infinity] - height of the world container
	 * @param {PhysicsAdapter} [adapter] - physics adapter to use; defaults to a new {@link BuiltinAdapter} instance
	 */
	constructor(
		x = 0,
		y = 0,
		width = Infinity,
		height = Infinity,
		adapter = undefined,
	) {
		// call the super constructor
		super(x, y, width, height, true);

		// world is the root container
		this.name = "rootContainer";

		// to mimic the previous behavior
		this.anchorPoint.set(0, 0);

		/**
		 * the application (game) this physic world belong to
		 * @type {Application}
		 */
		this.app = undefined;

		/**
		 * Identifier of the active physics adapter, taken from the
		 * adapter's `physicLabel` field by {@link World#setAdapter} —
		 * `"builtin"` (default — `BuiltinAdapter`), `"matter"`
		 * (`@melonjs/matter-adapter`), or a third-party label.
		 * The reserved value `"none"` is set when physics is disabled via
		 * `physic: "none"` in `ApplicationSettings`; `World.step` skips
		 * the simulation entirely under that label, and the rest of the
		 * world container behaves like a pure scene graph.
		 *
		 * User code can branch on the value without importing the
		 * adapter class:
		 *
		 * ```ts
		 * if (app.world.physic === "matter") {
		 *     // matter-only setup (constraints, native queries, …)
		 * }
		 * ```
		 * @see ApplicationSettings.physic
		 * @see PhysicsAdapter.physicLabel
		 * @type {string}
		 * @default "builtin"
		 * @example
		 * // disable physics entirely
		 * app.world.physic = "none";
		 */
		this.physic = "builtin";

		/**
		 * the rate at which the game world is updated,
		 * may be greater than or lower than the display fps
		 * @default 60
		 * @see timer.maxfps
		 */
		this.fps = 60;

		/**
		 * Enabled pre-rendering for all tile layers. <br>
		 * If false layers are rendered dynamically, if true layers are first fully rendered into an offscreen canvas.<br>
		 * the "best" rendering method depends of your game (amount of layer, layer size, amount of tiles per layer, etc.)<br>
		 * Note : rendering method is also configurable per layer by adding a boolean "preRender" property to your layer in Tiled ({@link https://doc.mapeditor.org/en/stable/manual/custom-properties/#adding-properties}).
		 * @type {boolean}
		 * @default false
		 */
		this.preRender = false;

		/**
		 * Enable the WebGL2 procedural shader path for orthogonal tile
		 * layers. When `true` (default), eligible layers render via a
		 * single quad per tileset + a fragment shader doing per-pixel GID
		 * lookup — bypassing the per-tile drawImage loop entirely.
		 * Supported features on the shader path: animated tiles, all
		 * three flip bits (H/V/AD), per-layer opacity/tint/blend mode,
		 * and oversized bottom-aligned tiles up to 4 cells of overflow.
		 * Layers that don't qualify (Canvas/WebGL1, non-orthogonal,
		 * collection-of-image tilesets, non-zero `tileoffset`, or tile
		 * overflow beyond the shader's 4-cell limit) fall back to the
		 * legacy path automatically. Set to `false` to disable globally.
		 * @type {boolean}
		 * @default true
		 */
		this.gpuTilemap = true;

		/**
		 * the active physics adapter, read through {@link World#adapter}
		 * @ignore
		 * @type {PhysicsAdapter}
		 */
		this._adapter = undefined;

		/**
		 * an adapter given to {@link World#setAdapter} during a physics
		 * step, installed once that step ends
		 * @ignore
		 * @type {PhysicsAdapter|undefined}
		 */
		this._pendingAdapter = undefined;

		/**
		 * true while the active adapter is stepping
		 * @ignore
		 * @type {boolean}
		 */
		this._stepping = false;

		/**
		 * the joints {@link World#addJoint} made, kept to rebuild them on
		 * {@link World#setAdapter} and to remove them with their bodies
		 * @ignore
		 * @type {Set<{ definition: JointDefinition, native: unknown }>}
		 */
		this._joints = new Set();

		this.setAdapter(adapter ?? new BuiltinAdapter());

		/**
		 * Spatial broadphase used by built-in physics and pointer
		 * event picking. The concrete class depends on
		 * {@link Container#sortOn}: under `"depth"` (the value
		 * `Camera3d.defaultSortOn` sets on stage reset) it's an
		 * `Octree`; under any 2D sortOn it's a `QuadTree`. The choice
		 * is reactive — the `sortOn` setter swaps the broadphase if a
		 * 2D↔3D boundary crossing occurs, so stage transitions between
		 * Camera2d and Camera3d stages are handled transparently.
		 *
		 * Implementation detail — game code shouldn't reach in here.
		 * Use `world.adapter.queryAABB(rect)` /
		 * `world.adapter.querySphere(sphere)` /
		 * `world.adapter.raycast(...)` instead.
		 * @type {import("./broadphase/broadphase.ts").Broadphase}
		 */
		this.broadphase = createBroadphase(this);

		// reset the world container on the game reset signal
		on(GAME_RESET, this.reset, this);

		// reset the broadphase on level load. 2D path resizes the
		// QuadTree root to match the new world bounds; 3D path just
		// clears contents because the Octree root is a fixed
		// origin-centred box that doesn't depend on the level's 2D
		// extent.
		// Held as a field, not an inline arrow, so `destroy()` can pass it to
		// `off()` — an anonymous handler is unremovable, and its closure keeps
		// this world (and its whole child tree and broadphase) reachable from
		// the event bus for the life of the page.
		this.onLevelLoaded = () => {
			if (this._sortOn === "depth") {
				this.broadphase.clear();
			} else {
				this.broadphase.clear(this.getBounds().clone());
			}
		};
		on(LEVEL_LOADED, this.onLevelLoaded);
	}

	/**
	 * Release this world's global event subscriptions before handing off to
	 * the container teardown. Without this a destroyed world stays on the
	 * bus: it keeps resetting itself on `GAME_RESET` and clearing a
	 * broadphase nobody reads on `LEVEL_LOADED`, and it cannot be garbage
	 * collected because both handlers close over it.
	 * @ignore
	 * @internal
	 */
	destroy() {
		off(GAME_RESET, this.reset, this);
		off(LEVEL_LOADED, this.onLevelLoaded);
		this.onLevelLoaded = undefined;
		super.destroy(...arguments);
		// after the children, whose bodies the adapter takes out as they go:
		// an adapter can hold memory the garbage collector does not reclaim
		// (Rapier's WebAssembly), so it is released with its world
		this._pendingAdapter = undefined;
		this._adapter?.destroy?.();
	}

	/**
	 * Override the inherited `Container.sortOn` setter so the
	 * broadphase swaps to match when crossing a 2D↔3D boundary. See
	 * the `broadphase` JSDoc for why the swap is reactive rather than
	 * Stage-driven. The 2D/3D classification key is `"depth"` — every
	 * other sortOn value lives in the 2D regime.
	 * @returns {"x"|"y"|"z"|"depth"}
	 */
	get sortOn() {
		return this._sortOn;
	}
	/**
	 * @param {"x"|"y"|"z"|"depth"} value
	 */
	set sortOn(value) {
		const was3D = this._sortOn === "depth";
		// delegate to Container's setter for validation + comparator
		super.sortOn = value;
		const now3D = this._sortOn === "depth";
		if (was3D !== now3D) {
			this.broadphase = createBroadphase(this);
		}
	}

	/**
	 * The physics adapter driving this world: a {@link BuiltinAdapter}
	 * unless the `Application`'s `physic` setting, or
	 * {@link World#setAdapter}, gave it another one. Read-only; change it
	 * with {@link World#setAdapter}.
	 * @returns {PhysicsAdapter}
	 */
	get adapter() {
		return this._adapter;
	}

	/**
	 * Replace the physics adapter driving this world, for example to move a
	 * game from `@melonjs/planck-adapter` to `@melonjs/matter-adapter`. The
	 * previous adapter is destroyed, and the new one builds every physics
	 * body in the world again, from each renderable's `bodyDef`, where the
	 * renderable stands and at the angle its body had.
	 *
	 * The joints {@link World#addJoint} made are built again too, from their
	 * definitions, once their bodies are; a {@link PhysicsJoint} handle stays
	 * the same object and gets the new engine's joint as its `native`. A
	 * joint the new adapter cannot build is dropped and reported with the
	 * refused bodies below: all of them under an adapter without joints
	 * (`capabilities.constraints` is `false`), so remove them with
	 * {@link World#removeJoint} before switching to one.
	 *
	 * Nothing else carries over: velocities, forces and contacts start again
	 * from rest, and gravity is the new adapter's own, in its own units. A
	 * body added with a direct `adapter.addBody()` call rather than a
	 * `bodyDef` is not built again, and a legacy `Body` without a `bodyDef`
	 * only works with the {@link BuiltinAdapter}.
	 *
	 * Called during a physics step, from a collision handler for example,
	 * the swap happens as soon as that step ends; called more than once in
	 * one step, the last adapter asked for is installed.
	 *
	 * A body the new adapter cannot build (a `Box3d`, `Sphere` or `Point`
	 * moving to a 2D adapter), or a joint, does not stop the swap: every
	 * other body and joint is moved, the refused bodies are left without a
	 * body, and this throws once the swap is complete, naming the first
	 * refusal and counting the joints dropped. Called during a step, that
	 * error is reported with `console.error` instead, so the game loop keeps
	 * running.
	 * @param {PhysicsAdapter} adapter - the adapter to use from now on
	 * @returns {World} this world
	 * @throws {Error} once the swap is complete, when a body or a joint could
	 * not be built on the new adapter
	 * @example
	 * import { MatterAdapter } from "@melonjs/matter-adapter";
	 * app.world.setAdapter(await MatterAdapter.create({ gravity: { x: 0, y: 1 } }));
	 * @example
	 * // matter has no joints: remove them before switching to it
	 * for (const joint of ropeJoints) {
	 *     app.world.removeJoint(joint);
	 * }
	 * app.world.setAdapter(await MatterAdapter.create());
	 */
	setAdapter(adapter) {
		if (this._stepping) {
			// tearing an engine down from inside its own step is unsafe
			// (planck silently refuses to destroy a body while stepping); the
			// last adapter asked for is the one installed once the step ends
			this._pendingAdapter = adapter;
			return this;
		}
		const previous = this._adapter;
		if (adapter === previous) {
			return this;
		}
		// taking the bodies out below removes their joints: keep the list to
		// build them again on the new adapter
		const joints = [...this._joints];
		// and the bodies' angles: each is built again as it stands, turned
		const angles = new Map();
		if (previous !== undefined) {
			// take every body out of the outgoing simulation, at any depth,
			// and drop the handles it built: each is built again, at rest
			this.forEach((child) => {
				collectBodyAngles(child, previous, angles);
				unregisterTreeBodies(child, this);
				releaseDefinedBodies(child);
			});
			previous.destroy?.();
		}
		this._adapter = adapter;
		this.physic = adapter.physicLabel ?? "builtin";
		adapter.init?.(this);
		// and build them again in the new one. A body it cannot build does
		// not stop the others: the swap completes, then says what it refused
		const refused = [];
		this.forEach((child) => {
			registerTreeBodies(child, this, refused);
		});
		for (const [node, angle] of angles) {
			if (hasRegisteredBody(node, this)) {
				adapter.setAngle?.(node, angle);
			}
		}
		// then the joints between them. One whose body was refused goes with
		// that body; on an adapter without joints, they all go
		let withBody = 0;
		let unsupported = 0;
		for (const joint of joints) {
			const { a, b } = joint.definition;
			if (!hasRegisteredBody(a, this) || !hasRegisteredBody(b, this)) {
				joint.native = null;
				withBody++;
				continue;
			}
			joint.native = adapter.addJoint?.(joint.definition) ?? null;
			if (joint.native !== null) {
				this._joints.add(joint);
			} else {
				unsupported++;
			}
		}
		// the start-up banner names the adapter of the moment; a later switch
		// is named too, so the console never lists an adapter no longer in use
		if (this.app?.isInitialized === true && this.app.settings.consoleHeader) {
			consolePhysics(this);
		}
		const problems = [];
		if (refused.length > 0) {
			const count =
				refused.length === 1 ? "1 body" : `${refused.length} bodies`;
			problems.push(
				`could not build ${count} on the new adapter, which now runs without ${refused.length === 1 ? "it" : "them"}. The first: ${refused[0].message}`,
			);
		}
		const jointCount = (n) => {
			return n === 1 ? "1 joint" : `${n} joints`;
		};
		if (unsupported > 0) {
			problems.push(
				`dropped ${jointCount(unsupported)}: the ${this.physic} adapter has none (capabilities.constraints is false). Remove them with removeJoint() before switching to it.`,
			);
		}
		if (withBody > 0) {
			problems.push(
				`dropped ${jointCount(withBody)} on a body it could not build.`,
			);
		}
		if (problems.length > 0) {
			throw new Error(`melonJS: setAdapter() ${problems.join(" It also ")}`);
		}
		return this;
	}

	/**
	 * Join two bodies with a joint: a `"hinge"`, `"rope"`, `"weld"` or
	 * `"slider"` (see {@link JointType}). It works the same on every adapter
	 * that has joints (`capabilities.constraints`: the planck and Rapier
	 * adapters), each building its engine's own joint. On an adapter without
	 * joints, the built-in and matter ones, it throws: check
	 * `capabilities.constraints` first in code meant to run on any adapter.
	 *
	 * Both renderables need a body in this world first, so add them with
	 * {@link Container#addChild} before joining them. The world keeps the
	 * joint: {@link World#setAdapter} builds it again on the new adapter, and
	 * it is removed when either body leaves the world.
	 * @param {JointDefinition} definition - what to join, and how
	 * @returns {PhysicsJoint} the joint, to remove it later with
	 * {@link World#removeJoint}
	 * @throws {Error} on an adapter without joints, or (from the adapter) when
	 * a renderable has no body in the world or the `type` is unknown
	 * @example
	 * // code meant to run on any adapter checks first
	 * if (app.world.adapter.capabilities.constraints) {
	 *     app.world.addJoint({ type: "rope", a: hook, b: lantern });
	 * }
	 * @example
	 * // a chain of links hanging from a hook (all three have a bodyDef)
	 * app.world.addChild(hook);
	 * app.world.addChild(link1);
	 * app.world.addChild(link2);
	 * app.world.addJoint({ type: "hinge", a: hook, b: link1, anchorA: { x: 4, y: 8 }, anchorB: { x: 3, y: 0 } });
	 * app.world.addJoint({ type: "hinge", a: link1, b: link2, anchorA: { x: 3, y: 16 }, anchorB: { x: 3, y: 0 } });
	 * @example
	 * // a plank glued to a wall, that breaks off when removed
	 * const glue = app.world.addJoint({ type: "weld", a: wall, b: plank });
	 * // later
	 * app.world.removeJoint(glue);
	 */
	addJoint(definition) {
		// a copy, which the adapter completes with the defaults it resolved:
		// the definition given is left as it is, and a rebuild makes the same
		// joint
		const resolved = { ...definition };
		const native = this.adapter.addJoint?.(resolved) ?? null;
		if (native === null) {
			throw new Error(
				`melonJS: addJoint() needs a physics adapter with joints, and the ${this.physic} adapter has none (capabilities.constraints is false). Use @melonjs/planck-adapter or @melonjs/rapier2d-adapter.`,
			);
		}
		const joint = { definition: resolved, native };
		this._joints.add(joint);
		return joint;
	}

	/**
	 * Remove a joint {@link World#addJoint} made; its two bodies move apart
	 * freely from then on. Removing a joint twice, or one already removed with
	 * its body, does nothing.
	 * @param {PhysicsJoint} joint - the joint to remove
	 * @returns {World} this world
	 */
	removeJoint(joint) {
		if (this._joints.delete(joint)) {
			this.adapter.removeJoint?.(joint.native);
			/** @type {{ native: unknown }} */ (joint).native = null;
		}
		return this;
	}

	/**
	 * Remove the joints holding a renderable whose body leaves the world.
	 * @ignore
	 * @param {object} renderable - the renderable leaving the world
	 */
	_removeJointsOf(renderable) {
		for (const joint of this._joints) {
			if (
				joint.definition.a === renderable ||
				joint.definition.b === renderable
			) {
				this.removeJoint(joint);
			}
		}
	}

	/**
	 * Build a renderable's joints again on the active adapter. Called by an
	 * adapter whose `updateShape()` rebuilt the body: the old body took its
	 * joints with it, and the handles game code holds get the new ones.
	 * @ignore
	 * @param {object} renderable - the renderable whose body was rebuilt
	 */
	_rebuildJointsOf(renderable) {
		for (const joint of this._joints) {
			const { a, b } = joint.definition;
			if (a === renderable || b === renderable) {
				joint.native = this.adapter.addJoint?.(joint.definition) ?? null;
				if (joint.native === null) {
					this._joints.delete(joint);
				}
			}
		}
	}

	/**
	 * Active physics bodies in this simulation. Backed by the active
	 * adapter; mutating this set directly is no longer the recommended
	 * pattern — use `world.adapter.addBody(...)` / `removeBody(...)`.
	 *
	 * Adapters that don't expose a native `bodies` Set (e.g. third-party
	 * integrations that own their own body storage) cause this getter
	 * to return a frozen empty Set, so any `world.bodies.add(...)`
	 * attempt throws `TypeError` instead of silently mutating a
	 * throwaway.
	 * @returns {Set<Body>}
	 */
	get bodies() {
		return (
			/** @type {{ bodies?: Set<Body> }} */ (this.adapter).bodies ??
			EMPTY_BODIES
		);
	}

	/**
	 * world gravity. Mutate to change at runtime.
	 * @returns {Vector2d}
	 */
	get gravity() {
		return this.adapter.gravity;
	}
	set gravity(v) {
		this.adapter.gravity = v;
	}

	/**
	 * the collision detector instance used by this world instance.
	 * Available only when the active adapter is {@link BuiltinAdapter}.
	 * @returns {Detector | undefined}
	 */
	get detector() {
		return /** @type {{ detector?: Detector }} */ (this.adapter).detector;
	}

	/**
	 * reset the game world. Children flagged
	 * {@link Renderable#isPersistent} are kept, with everything below them,
	 * and so are their physics bodies.
	 */
	reset() {
		// clear the quadtree
		this.broadphase.clear();

		// reset the anchorPoint
		this.anchorPoint.set(0, 0);

		// call the parent method
		super.reset();

		// save the bodies of what the reset kept (only meaningful for the
		// builtin adapter). Not only the persistent renderables themselves:
		// a persistent container is kept with all of its children, at any
		// depth, so their bodies are kept with them. Keeping just the bodies
		// whose own renderable was flagged dropped every body inside a
		// persistent group, which then stopped falling and colliding after a
		// state change or a `level.load`.
		const bodies = /** @type {{ bodies?: Set<Body> }} */ (this.adapter).bodies;
		if (bodies !== undefined) {
			const persistentBodies = [];
			bodies.forEach((value) => {
				if (keepsBodyOf(this, value.ancestor)) {
					persistentBodies.push(value);
				}
			});

			// empty the list of active physic bodies
			// Note: this should be empty already when calling the parent method
			bodies.clear();

			// insert persistent child bodies into the new state
			if (persistentBodies.length > 0) {
				persistentBodies.forEach((body) => {
					this.addBody(body);
				});
			}
		}
	}

	/**
	 * Add a physic body to the game world. Legacy API for code that
	 * constructed `new Body(...)` directly and now wants to register it
	 * with the active physics adapter.
	 * @see Container.addChild
	 * @param {Body} body
	 * @returns {World} this game world
	 */
	addBody(body) {
		if (this.physic === "builtin") {
			const bodies = /** @type {{ bodies?: Set<Body> }} */ (this.adapter)
				.bodies;
			bodies?.add(body);
		}
		return this;
	}

	/**
	 * Remove a physic body from the game world
	 * @see Container.removeChild
	 * @param {Body} body
	 * @returns {World} this game world
	 */
	removeBody(body) {
		if (this.physic === "builtin") {
			const bodies = /** @type {{ bodies?: Set<Body> }} */ (this.adapter)
				.bodies;
			bodies?.delete(body);
		}
		return this;
	}

	/**
	 * Apply gravity to the given body. Backward-compat shim; the actual
	 * simulation runs through the active adapter.
	 * @private
	 * @param {Body} body
	 */
	bodyApplyGravity(body) {
		/** @type {{ applyGravity?: (b: Body) => void }} */ (
			this.adapter
		).applyGravity?.(body);
	}

	/**
	 * update the game world
	 * @param {number} dt - the time passed since the last frame update
	 * @returns {boolean} true if the world is dirty
	 */
	update(dt) {
		// only update the quadtree if necessary
		if (this.physic === "builtin" || hasRegisteredEvents() === true) {
			// clear the quadtree
			this.broadphase.clear();
			// insert the world container (children) into the quadtree
			this.broadphase.insertContainer(this);
		}

		// advance the active adapter's simulation
		this.step(dt);

		// call the super constructor
		return super.update(dt);
	}

	/**
	 * update the physics simulation by one step (called by the game world update method)
	 * @param {number} dt - the time passed since the last frame update
	 */
	step(dt) {
		// `physic` is the active adapter's identifier ("builtin", "matter",
		// etc.) or the sentinel "none" when physics is disabled. The step
		// runs under any adapter; only "none" skips it.
		if (this.physic !== "none") {
			this._stepping = true;
			try {
				this.adapter.step(dt);
				this.adapter.syncFromPhysics();
			} finally {
				this._stepping = false;
			}
			const pending = this._pendingAdapter;
			if (pending !== undefined) {
				this._pendingAdapter = undefined;
				try {
					this.setAdapter(pending);
				} catch (error) {
					// thrown out of the game loop it would stop the game; the
					// swap itself is complete for every other body
					console.error(error);
				}
			}
		}
		emit(WORLD_STEP, dt);
	}
}
