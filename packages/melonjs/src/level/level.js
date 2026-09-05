import { game } from "../application/application.ts";
import { getTMX } from "./../loader/loader.js";
import state from "./../state/state.ts";
import { emit, LEVEL_LOADED } from "../system/event.ts";
import { resetGUID } from "./../utils/utils.ts";
import GLTFScene from "./gltf/GLTFScene.js";
import TMXTileMap from "./tiled/TMXTileMap.js";

// our levels
const levels = {};
// level index table
const levelIdx = [];
// current level index
let currentLevelIdx = 0;

/**
 * @ignore
 * @internal
 */
function safeLoadLevel(levelId, options, restart) {
	// clean the destination container
	options.container.reset();

	// reset the renderer
	game.reset();

	// clean the current (previous) level
	if (levels[level.getCurrentLevelId()]) {
		levels[level.getCurrentLevelId()].destroy();
	}

	// update current level index
	currentLevelIdx = levelIdx.indexOf(levelId);

	// add the specified level to the game world. TMX maps keep their
	// dedicated loader (GUID reset + viewport bounds + object flattening);
	// other formats (glTF/GLB scenes, …) use the generic duck-typed
	// `addTo(container, options)` interface.
	const targetLevel = levels[levelId];
	if (targetLevel.format === "tmx") {
		loadTMXLevel(
			levelId,
			options.container,
			options.flatten,
			options.setViewportBounds,
		);
	} else {
		options.container.anchorPoint.set(0, 0);
		targetLevel.addTo(options.container, options);
	}

	// publish the corresponding message
	emit(LEVEL_LOADED, levelId);

	// fire the callback
	options.onLoaded(levelId);

	if (restart) {
		// resume the game loop if it was previously running
		state.restart();
	}
}

/**
 * Load a TMX level
 * @private
 * @param {string} levelId - level id
 * @param {Container} container - target container
 * @param {boolean} [flatten=true] - if true, flatten all objects into the given container
 * @param {boolean} [setViewportBounds=false] - if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
 * @ignore
 * @internal
 */
function loadTMXLevel(levelId, container, flatten, setViewportBounds) {
	const level = levels[levelId];
	// reset the GUID generator
	// and pass the level id as parameter
	resetGUID(levelId, level.nextobjectid);

	// Tiled use 0,0 anchor coordinates
	container.anchorPoint.set(0, 0);

	// add all level elements to the target container
	level.addTo(container, flatten, setViewportBounds);
}

/**
 * a level manager. once resources loaded, the level manager contains all references of defined levels.
 * @namespace level
 */

export const level = {
	/**
	 * add a level into the game manager (usually called by the preloader)
	 * @public
	 * @param {string} format - level format ("tmx" for Tiled maps, "gltf" / "glb" for 3D scenes)
	 * @param {string} levelId - the level id (or name)
	 * @param {Function} [callback] - a function to be called once the level is loaded
	 * @returns {boolean} true if the level was loaded
	 */
	add(format, levelId, callback) {
		let levelObject;
		switch (format) {
			case "tmx":
				levelObject = () => {
					return new TMXTileMap(levelId, getTMX(levelId));
				};
				break;
			case "gltf":
			case "glb":
				levelObject = () => {
					return new GLTFScene(levelId);
				};
				break;
			default:
				throw new Error("no level loader defined for format " + format);
		}

		// register the level once (idempotent)
		if (levels[levelId] == null) {
			levels[levelId] = levelObject();
			levelIdx.push(levelId);
		} else {
			return false;
		}

		// call the callback if defined
		if (callback) {
			callback();
		}
		// true if level loaded
		return true;
	},

	/**
	 * load a level into the game manager<br>
	 * (will also create all level defined entities, etc..)
	 * @public
	 * @param {string} levelId - level id
	 * @param {object} [options] - additional optional parameters
	 * @param {Container} [options.container=game.world] - container in which to load the specified level
	 * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
	 * @param {boolean} [options.flatten=game.mergeGroup] - (TMX only) if true, flatten all objects into the given container
	 * @param {boolean} [options.setViewportBounds=true] - (TMX only) if true, set the viewport bounds to the map size
	 * @param {number} [options.scale=1] - (glTF/GLB only) pixels per glTF unit applied to the whole scene
	 * @param {boolean} [options.rightHanded=true] - (glTF/GLB only) convert the right-handed (Y-up) source to the engine's Y-down via a rotation rather than a mirror
	 * @param {boolean} [options.lights=true] - (glTF/GLB only) add the scene's authored `KHR_lights_punctual` lights (plus a soft ambient fill) as {@link Light3d} world children; each carries its authored name for `getChildByName` lookups
	 * @param {number} [options.lightIntensityScale] - (glTF/GLB only) multiply each light's authored physical intensity (lux/candela) by this factor instead of normalizing it to 1 — see {@link GLTFScene#addTo}
	 * @param {boolean} [options.castGroundShadow] - (glTF/GLB only) give this scene's meshes a ground shadow ({@link Mesh#castGroundShadow}). Overrides the application's `castGroundShadow` setting for this scene, in both directions; omit it to inherit. As a scene-wide opt-in it skips nodes with no vertical extent — a scene's ground plane is exactly that, and shadowing it with itself smears a blob across the whole floor
	 * @param {number} [options.shadowGroundY] - (glTF/GLB only) world Y of the floor those shadows land on ({@link Mesh#shadowGroundY}); omit it and each blob sits at its own object's base at full strength, which is right for a scene whose props already rest on the ground
	 * @returns {boolean} true if the level was successfully loaded
	 * @example
	 * // the game assets to be be preloaded
	 * // TMX maps
	 * let resources = [
	 *     {name: "a4_level1",   type: "tmx",   src: "data/level/a4_level1.tmx"},
	 *     {name: "a4_level2",   type: "tmx",   src: "data/level/a4_level2.tmx"},
	 *     {name: "a4_level3",   type: "tmx",   src: "data/level/a4_level3.tmx"},
	 *     // ...
	 * ];
	 *
	 * // ...
	 *
	 * // load a level into the game world
	 * me.level.load("a4_level1");
	 * ...
	 * ...
	 * // load a level into a specific container
	 * let levelContainer = new me.Container();
	 * me.level.load("a4_level2", {container:levelContainer});
	 * // add a simple transformation
	 * levelContainer.translate(levelContainer.width / 2, levelContainer.height / 2 );
	 * levelContainer.rotate(0.05);
	 * levelContainer.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
	 * // add it to the game world
	 * app.world.addChild(levelContainer);
	 *
	 * // load a glTF/GLB scene (preloaded with type "glb") under a Camera3d:
	 * // 50 pixels per glTF unit, authored lux/candela intensities kept at
	 * // a 1/1000 scale instead of being normalized to 1
	 * me.level.load("diorama", { scale: 50, lightIntensityScale: 0.001 });
	 * // …and give every prop in it a ground shadow landing on the floor at y = 0
	 * // (the scene's own ground plane is skipped — it has no height to cast)
	 * me.level.load("diorama", { scale: 50, castGroundShadow: true, shadowGroundY: 0 });
	 * // the authored lights are world children — grab the sun for a day/night cycle
	 * const sun = app.world.getChildByName("Sun")[0];
	 */
	load(levelId, options) {
		// Fire-and-forget by contract: this returns `true`, not the promise, so
		// existing (including typed) callers are unaffected. Use `loadAsync()`
		// to await the load. The rejection is rethrown on a clean stack so a
		// failure still surfaces as an uncaught error the way it did when the
		// deferral was a timer, rather than as a silent unhandled rejection.
		this.loadAsync(levelId, options).catch((error) => {
			queueMicrotask(() => {
				throw error;
			});
		});
		return true;
	},

	/**
	 * Load a level, and resolve once it is in the world.
	 *
	 * Same as {@link level.load} in every respect except that it hands back the
	 * completion of the load instead of discarding it. `options.onLoaded` still
	 * fires, so the two forms can be mixed.
	 *
	 * An unknown `levelId` throws SYNCHRONOUSLY rather than rejecting — that is
	 * a programmer error, not a load failure, and it should not need `await` to
	 * surface.
	 * @public
	 * @param {string} levelId - level id
	 * @param {object} [options] - additional options, as accepted by {@link level.load}
	 * @param {Container} [options.container=game.world] - container in which to load the specified level
	 * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
	 * @param {boolean} [options.flatten=game.mergeGroup] - (TMX only) if true, flatten all objects into the given container
	 * @param {boolean} [options.setViewportBounds=true] - (TMX only) if true, set the viewport bounds to the map size
	 * @param {number} [options.scale=1] - (glTF/GLB only) pixels per glTF unit applied to the whole scene
	 * @param {boolean} [options.rightHanded=true] - (glTF/GLB only) convert the right-handed (Y-up) source to the engine's Y-down via a rotation rather than a mirror
	 * @param {boolean} [options.lights=true] - (glTF/GLB only) add the scene's authored lights as {@link Light3d} world children
	 * @param {number} [options.lightIntensityScale] - (glTF/GLB only) multiply each light's authored physical intensity by this factor
	 * @param {boolean} [options.castGroundShadow=false] - (glTF/GLB only) give every mesh in the scene a ground shadow
	 * @param {number} [options.shadowGroundY] - (glTF/GLB only) world Y the ground shadows land on
	 * @returns {Promise<void>} resolves once the level is in the world
	 * @example
	 * // await it, then start play
	 * await me.loader.preload(game.assets);
	 * await me.level.loadAsync("map1");
	 * @category Level
	 */
	loadAsync(levelId, options) {
		options = Object.assign(
			{
				container: game.world,
				onLoaded: game.onLevelLoaded,
				flatten: game.mergeGroup,
				setViewportBounds: true,
			},
			options || {},
		);

		// throw an exception if not existing
		if (typeof levels[levelId] === "undefined") {
			throw new Error("level " + levelId + " not found");
		}

		// Deferred so the current frame can unwind first. `level.load()` is
		// routinely called from inside the loop — a trigger handler, an update
		// step — and `safeLoadLevel` resets and destroys the very container the
		// loop may be iterating. `state.stop()` sets a flag; it does not unwind
		// the frame already on the stack.
		//
		// A microtask rather than a timer. Both unwind the stack — a microtask
		// drains when the JS stack empties, i.e. at the end of the rAF callback
		// holding update AND draw — but `setTimeout` is clamped to >= 1s in a
		// background tab, which would strand a load queued as the tab hides.
		// The timer this replaced dated to 2011, before promises existed; there
		// was never a macrotask semantic to preserve.
		if (state.isRunning()) {
			// stop the game loop to avoid some silly side effects
			state.stop();
			return Promise.resolve().then(() => {
				safeLoadLevel(levelId, options, true);
			});
		}
		// No loop means no frame to unwind, so this stays SYNCHRONOUS exactly as
		// before — deferring it would change when the level exists for anyone
		// loading one before the game starts.
		safeLoadLevel(levelId, options);
		return Promise.resolve();
	},

	/**
	 * return the current level id<br>
	 * @public
	 * @returns {string}
	 */
	getCurrentLevelId() {
		return levelIdx[currentLevelIdx];
	},

	/**
	 * return the current level definition.
	 * for a reference to the live instantiated level,
	 * rather use the container in which it was loaded (e.g. app.world)
	 * @public
	 * @returns {TMXTileMap|GLTFScene} the current level object (a TMXTileMap for Tiled maps, a GLTFScene for glTF/GLB scenes)
	 */
	getCurrentLevel() {
		return levels[this.getCurrentLevelId()];
	},

	/**
	 * reload the current level
	 * @public
	 * @param {object} [options] - additional optional parameters
	 * @param {Container} [options.container=game.world] - container in which to load the specified level
	 * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
	 * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
	 * @returns {object} the current level
	 */
	reload(options) {
		// reset the level to initial state
		//levels[currentLevel].reset();
		return this.load(this.getCurrentLevelId(), options);
	},

	/**
	 * load the next level
	 * @public
	 * @param {object} [options] - additional optional parameters
	 * @param {Container} [options.container=game.world] - container in which to load the specified level
	 * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
	 * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
	 * @returns {boolean} true if the next level was successfully loaded
	 */
	next(options) {
		//go to the next level
		if (currentLevelIdx + 1 < levelIdx.length) {
			return this.load(levelIdx[currentLevelIdx + 1], options);
		} else {
			return false;
		}
	},

	/**
	 * load the previous level<br>
	 * @public
	 * @param {object} [options] - additional optional parameters
	 * @param {Container} [options.container=game.world] - container in which to load the specified level
	 * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
	 * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
	 * @returns {boolean} true if the previous level was successfully loaded
	 */
	previous(options) {
		// go to previous level
		if (currentLevelIdx - 1 >= 0) {
			return this.load(levelIdx[currentLevelIdx - 1], options);
		} else {
			return false;
		}
	},

	/**
	 * return the amount of level preloaded
	 * @public
	 * @returns {number} the amount of level preloaded
	 */
	levelCount() {
		return levelIdx.length;
	},
};
