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
 * The id of the level `offset` steps from the current one, or `null` when that
 * lands outside the set. Shared so the bounds check lives in exactly one place
 * — it used to be spelled out in `next` and `previous` separately.
 * @param {number} offset - steps from the current level (1 = next, -1 = previous)
 * @returns {string|null} the level id, or null when there is none
 * @ignore
 * @internal
 */
function levelIdAt(offset) {
	const index = currentLevelIdx + offset;
	return index >= 0 && index < levelIdx.length ? levelIdx[index] : null;
}

/**
 * Options accepted by every level-loading call.
 *
 * `async` is the switch that decides what the call HANDS BACK: leave it out and
 * you get the boolean these calls have always returned, set it and you get a
 * promise that settles once the level is actually in the world. Everything else
 * behaves identically either way, `onLoaded` included.
 *
 * Note that awaiting a call WITHOUT `async: true` is not an error — `await true`
 * is valid and resolves immediately — so the level will not be loaded yet. Pass
 * the flag whenever you intend to await.
 * @typedef {object} LevelLoadOptions
 * @property {Container} [container=game.world] - container in which to load the specified level
 * @property {Function} [onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded, called in both forms
 * @property {boolean} [async=false] - return a promise that settles once the level is in the world, instead of a boolean
 * @property {boolean} [flatten=game.mergeGroup] - (TMX only) if true, flatten all objects into the given container
 * @property {boolean} [setViewportBounds=true] - (TMX only) if true, set the viewport bounds to the map size
 * @property {number} [scale=1] - (glTF/GLB only) pixels per glTF unit applied to the whole scene
 * @property {boolean} [rightHanded=true] - (glTF/GLB only) convert the right-handed (Y-up) source to the engine's Y-down via a rotation rather than a mirror
 * @property {boolean} [lights=true] - (glTF/GLB only) add the scene's authored `KHR_lights_punctual` lights (plus a soft ambient fill) as {@link Light3d} world children
 * @property {number} [lightIntensityScale] - (glTF/GLB only) multiply each light's authored physical intensity by this factor instead of normalizing it to 1
 * @property {boolean} [castGroundShadow=false] - (glTF/GLB only) give every mesh in the scene a ground shadow
 * @property {number} [shadowGroundY] - (glTF/GLB only) world Y the ground shadows land on
 */

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
	 * load a level into the game manager, and return a promise that settles once
	 * it is actually in the world<br>
	 * (will also create all level defined entities, etc..)
	 *
	 * `options.onLoaded` still fires, so the two forms mix freely. An unknown
	 * `levelId` throws SYNCHRONOUSLY rather than rejecting — that is a typo, not
	 * a load failure, and it should not need `await` to surface.
	 * @overload
	 * @param {string} levelId - level id
	 * @param {LevelLoadOptions & { async: true }} options - load options, with `async` set
	 * @returns {Promise<boolean>} resolves `true` once the level is in the world
	 * @example
	 * await me.loader.preload(game.assets);
	 * await me.level.load("a4_level1", { async: true });
	 * // the world is populated here
	 * @category Level
	 */
	/**
	 * load a level into the game manager<br>
	 * (will also create all level defined entities, etc..)
	 *
	 * While the game loop is running the load is DEFERRED to a microtask, so
	 * this returns before anything is in the world. Sequence follow-up work from
	 * `options.onLoaded`, from an `event.LEVEL_LOADED` listener, or by passing
	 * `async: true` and awaiting the promise that overload returns.
	 *
	 * Note that `await me.level.load(id)` without `async: true` does not await
	 * the load: the call returns a boolean, and `await true` resolves at once.
	 * @overload
	 * @param {string} levelId - level id
	 * @param {LevelLoadOptions & { async?: false }} [options] - additional optional parameters
	 * @returns {boolean} `true`
	 * @example
	 * // load a level
	 * me.level.load("a4_level1");
	 *
	 * // load into a specific container
	 * me.level.load("a4_level2", { container: levelContainer });
	 *
	 * // a glTF/GLB scene (preloaded with type "glb") under a Camera3d:
	 * // 50 pixels per glTF unit, authored intensities kept at a 1/1000 scale
	 * me.level.load("diorama", { scale: 50, lightIntensityScale: 0.001 });
	 * @category Level
	 */
	/**
	 * @param {string} levelId - level id
	 * @param {LevelLoadOptions} [options] - additional optional parameters
	 * @returns {boolean|Promise<boolean>} `true`, or a promise when `async` is set
	 * @ignore
	 */
	load(levelId, options) {
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

		const wantsPromise = options.async === true;

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
			const deferred = Promise.resolve().then(() => {
				safeLoadLevel(levelId, options, true);
				return true;
			});
			if (wantsPromise) {
				return deferred;
			}
			// Fire-and-forget: rethrow on a clean stack so a failure still
			// surfaces as an uncaught error the way it did when the deferral was
			// a timer, rather than as a silent unhandled rejection.
			deferred.catch((error) => {
				queueMicrotask(() => {
					throw error;
				});
			});
			return true;
		}

		// No loop means no frame to unwind, so this stays SYNCHRONOUS exactly as
		// before — deferring it would change when the level exists for anyone
		// loading one before the game starts.
		if (wantsPromise) {
			// wrapped so a failure arrives as a REJECTION here too: letting it
			// escape as an exception would make the error surface depend on
			// whether the loop happened to be running, and `.catch()` could not
			// see it, since the throw beats the handler being attached
			try {
				safeLoadLevel(levelId, options);
			} catch (error) {
				return Promise.reject(error);
			}
			return Promise.resolve(true);
		}
		safeLoadLevel(levelId, options);
		return true;
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
	 * reload the current level, and return a promise that settles once the level is in the world.
	 *
	 * @overload
	 * @param {LevelLoadOptions & { async: true }} options - load options, with `async` set
	 * @returns {Promise<boolean>} resolves `true` once the level is back in the world
	 * @example
	 * await me.level.reload({ async: true });
	 * @category Level
	 */
	/**
	 * reload the current level.
	 *
	 * While the game loop is running the load is deferred to a microtask, so this
	 * returns before anything is in the world — see {@link level.load}.
	 * @overload
	 * @param {LevelLoadOptions & { async?: false }} [options] - additional optional parameters
	 * @returns {boolean} `true`
	 * @category Level
	 */
	/**
	 * @param {LevelLoadOptions} [options] - additional optional parameters
	 * @returns {boolean|Promise<boolean>} see the overloads
	 * @ignore
	 */
	reload(options) {
		// reset the level to initial state
		//levels[currentLevel].reset();
		return this.load(this.getCurrentLevelId(), options);
	},

	/**
	 * load the next level, and return a promise that settles once the level is in the world.
	 *
	 * With no level to go to this reports `false` WITHOUT loading anything, and
	 * the promise form resolves `false` rather than rejecting: running out of
	 * levels is an ordinary outcome, not an error.
	 *
	 * @overload
	 * @param {LevelLoadOptions & { async: true }} options - load options, with `async` set
	 * @returns {Promise<boolean>} resolves `true`, or `false` if there is no next level
	 * @example
	 * await me.level.next({ async: true });
	 * @category Level
	 */
	/**
	 * load the next level.
	 *
	 * With no level to go to this reports `false` WITHOUT loading anything, and
	 * the promise form resolves `false` rather than rejecting: running out of
	 * levels is an ordinary outcome, not an error.
	 *
	 * While the game loop is running the load is deferred to a microtask, so this
	 * returns before anything is in the world — see {@link level.load}.
	 * @overload
	 * @param {LevelLoadOptions & { async?: false }} [options] - additional optional parameters
	 * @returns {boolean} `true` if the next level was loaded, `false` if there is none
	 * @category Level
	 */
	/**
	 * @param {LevelLoadOptions} [options] - additional optional parameters
	 * @returns {boolean|Promise<boolean>} see the overloads
	 * @ignore
	 */
	next(options) {
		const levelId = levelIdAt(1);
		if (levelId !== null) {
			return this.load(levelId, options);
		}
		return options?.async === true ? Promise.resolve(false) : false;
	},

	/**
	 * load the previous level, and return a promise that settles once the level is in the world.
	 *
	 * With no level to go to this reports `false` WITHOUT loading anything, and
	 * the promise form resolves `false` rather than rejecting: running out of
	 * levels is an ordinary outcome, not an error.
	 *
	 * @overload
	 * @param {LevelLoadOptions & { async: true }} options - load options, with `async` set
	 * @returns {Promise<boolean>} resolves `true`, or `false` if there is no previous level
	 * @example
	 * await me.level.previous({ async: true });
	 * @category Level
	 */
	/**
	 * load the previous level.
	 *
	 * With no level to go to this reports `false` WITHOUT loading anything, and
	 * the promise form resolves `false` rather than rejecting: running out of
	 * levels is an ordinary outcome, not an error.
	 *
	 * While the game loop is running the load is deferred to a microtask, so this
	 * returns before anything is in the world — see {@link level.load}.
	 * @overload
	 * @param {LevelLoadOptions & { async?: false }} [options] - additional optional parameters
	 * @returns {boolean} `true` if the previous level was loaded, `false` if there is none
	 * @category Level
	 */
	/**
	 * @param {LevelLoadOptions} [options] - additional optional parameters
	 * @returns {boolean|Promise<boolean>} see the overloads
	 * @ignore
	 */
	previous(options) {
		const levelId = levelIdAt(-1);
		if (levelId !== null) {
			return this.load(levelId, options);
		}
		return options?.async === true ? Promise.resolve(false) : false;
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
