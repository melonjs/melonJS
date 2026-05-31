import { hasRegisteredEvents } from "../input/pointerevent.ts";
import Container from "../renderable/container.js";
import {
	emit,
	GAME_RESET,
	LEVEL_LOADED,
	on,
	WORLD_STEP,
} from "../system/event.ts";
import { AABB3d } from "./broadphase/aabb3d.ts";
import Octree from "./broadphase/octree.ts";
import QuadTree from "./broadphase/quadtree.ts";
import BuiltinAdapter from "./builtin/builtin-adapter.ts";
import { collision } from "./collision.js";

/**
 * @import Application from "./../application/application.ts";
 * @import Body from "./builtin/body.js";
 * @import Detector from "./builtin/detector.js";
 * @import { Vector2d } from "../math/vector2d.ts";
 * @import { PhysicsAdapter } from "./adapter.ts";
 */

/**
 * Frozen empty Set returned by `world.bodies` when the active adapter
 * doesn't expose a native `bodies` Set (third-party adapters that own
 * their own body storage). Frozen so `world.bodies.add(x)` throws
 * `TypeError` instead of silently mutating a throwaway.
 * @ignore
 */
const EMPTY_BODIES = Object.freeze(new Set());

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
		 * adapter's `physicLabel` field at `Application` construction —
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
		 * the physics adapter driving this world. Defaults to a
		 * {@link BuiltinAdapter} wrapping the engine's native SAT-based
		 * physics. Override at `Application` construction time via
		 * `settings.physic.adapter`. Cannot be swapped at runtime.
		 * @type {PhysicsAdapter}
		 */
		this.adapter = adapter ?? new BuiltinAdapter();
		this.adapter.init?.(this);

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
		this.broadphase = this.#makeBroadphase();

		// reset the world container on the game reset signal
		on(GAME_RESET, this.reset, this);

		// update the broadband world bounds if a new level is loaded
		on(LEVEL_LOADED, () => {
			// reset the broadphase (impl-agnostic — both classes accept
			// the matching bounds shape here; the setter would have
			// already swapped impl if sortOn flipped).
			this.broadphase.clear(this.#broadphaseBounds());
		});
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
			this.broadphase = this.#makeBroadphase();
		}
	}

	#makeBroadphase() {
		return this._sortOn === "depth"
			? new Octree(
					this,
					this.#broadphaseBounds(),
					collision.maxChildren,
					collision.maxDepth,
				)
			: new QuadTree(
					this,
					/** @type {import("./bounds.ts").Bounds} */ (
						this.#broadphaseBounds()
					),
					collision.maxChildren,
					collision.maxDepth,
				);
	}

	#broadphaseBounds() {
		if (this._sortOn === "depth") {
			// Camera3d games conventionally center the play area on the
			// world origin (items at e.g. x ∈ [-PLAY_BOUND_X, PLAY_BOUND_X])
			// — `world.getBounds()` returns the 2D viewport rect (0..w,
			// 0..h) which DOESN'T contain those items. Using viewport
			// bounds as the octree root would cause negative-coord items
			// to be misclassified into octants whose AABBs don't contain
			// them, breaking `querySphere`'s spatial pruning.
			//
			// Use a generous origin-centred box instead. ±10000 covers
			// arcade-3D scales (AfterBurner ≈ ±350 xy, ±1000 z); items
			// outside still work — `getIndex` keeps them at root.objects
			// so retrieve / queryAABB / querySphere walk them via the
			// root-level pass, just without the spatial-partition win.
			const aabb = new AABB3d();
			aabb.setMinMax(-10000, -10000, -10000, 10000, 10000, 10000);
			return aabb;
		}
		return this.getBounds().clone();
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
	 * reset the game world
	 */
	reset() {
		// clear the quadtree
		this.broadphase.clear();

		// reset the anchorPoint
		this.anchorPoint.set(0, 0);

		// call the parent method
		super.reset();

		// save persistent child bodies (only meaningful for the builtin adapter)
		const bodies = /** @type {{ bodies?: Set<Body> }} */ (this.adapter).bodies;
		if (bodies !== undefined) {
			const persistentBodies = [];
			bodies.forEach((value) => {
				if (value.ancestor && value.ancestor.isPersistent) {
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
			this.adapter.step(dt);
			this.adapter.syncFromPhysics();
		}
		emit(WORLD_STEP, dt);
	}
}
