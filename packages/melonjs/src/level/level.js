import { game } from "../application/application.ts";
import { getTileMap } from "./../loader/loader.js";
import state from "./../state/state.ts";
import { emit, LEVEL_LOADED } from "../system/event.ts";
import { defer } from "../utils/function.ts";
import { resetGUID } from "./../utils/utils.ts";
import GLTFScene from "./gltf/GLTFScene.js";
import { LDtkLevel } from "./ldtk/level.ts";
import { ldtkMaps } from "./ldtk/registry.ts";
import TileMap from "./tiled/TileMap.js";
import { bindViewportToLevel, releaseViewport } from "./tilemap/viewport.js";

/**
 * additional import for TypeScript
 * @import Container from "../renderable/container.js";
 * @import {LDtkWorld} from "./ldtk/level.ts";
 * @import {Bounds} from "../physics/bounds.ts";
 * @import Mesh from "../renderable/mesh.js";
 * @import {Light3d} from "../lighting/light3d.ts";
 * @import {Vector3d} from "../math/vector3d.ts";
 * @import {Color} from "../math/color.ts";
 */
// the formats a level can be registered in: how its level object is made,
// and the options its loading reads
const formats = new Map();
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
			options.objects,
		);
	} else {
		// a level that numbers its objects says where the ids it does not
		// use start, as a Tiled map does: the ones made at run time follow
		if (typeof targetLevel.nextobjectid === "number") {
			resetGUID(levelId, targetLevel.nextobjectid);
		}
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
 * @param {boolean|Function} [objects=true] - the objects to build
 * @ignore
 * @internal
 */
function loadTMXLevel(levelId, container, flatten, setViewportBounds, objects) {
	const level = levels[levelId];
	// reset the GUID generator
	// and pass the level id as parameter
	resetGUID(levelId, level.nextobjectid);

	// Tiled use 0,0 anchor coordinates
	container.anchorPoint.set(0, 0);

	// add all level elements to the target container
	level.addTo(container, flatten, setViewportBounds, objects);
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
 * Awaiting a call WITHOUT `async: true` is not an error, but it is not a wait
 * either: the call hands back a boolean, and `await true` resolves immediately.
 * While the loop is running the load is deferred onto a timer, so it has NOT
 * happened by the time such an `await` resumes. Pass the flag when you mean to
 * await.
 * @typedef {object} LevelLoadOptions
 * @property {Container} [container=game.world] - container in which to load the specified level
 * @property {Function} [onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded, called in both forms
 * @property {boolean} [async=false] - return a promise that settles once the level is in the world, instead of a boolean
 * @property {boolean} [flatten=game.mergeGroup] - (tile maps: `"tmx"`, `"tilemap"`, `"spritefusion"`) if true, flatten all objects into the given container
 * @property {boolean} [setViewportBounds=true] - (tile maps and LDtk) if true, set the viewport bounds to the map size
 * @property {string[]} [collisionLayers] - (LDtk only) the IntGrid layers whose cells are solid, by their identifier; by default the ones whose identifier contains "collision"
 * @property {number[]} [solidValues] - (LDtk only) the values of those layers that are solid; by default every value but 0
 * @property {boolean} [showIntGrid=false] - (LDtk only) draw the IntGrid layers that have no tiles of their own, each value in its LDtk color
 * @property {boolean|Function} [objects=true] - (tile maps and LDtk) build the objects the level places: all of them, none, or the ones a function says, given each object's settings as its class would be (`(settings) => !taken.has(settings.id)` leaves out what the player took)
 * @property {string[]} [levels] - (LDtk only, loading a whole world) the levels to start with, by their identifier; by default every level
 * @property {number} [scale=1] - (glTF/GLB only) pixels per glTF unit applied to the whole scene
 * @property {boolean} [rightHanded=true] - (glTF/GLB only) convert the right-handed (Y-up) source to the engine's Y-down via a rotation rather than a mirror
 * @property {boolean} [lights=true] - (glTF/GLB only) add the scene's authored `KHR_lights_punctual` lights (plus a soft ambient fill) as {@link Light3d} world children
 * @property {number} [lightIntensityScale] - (glTF/GLB only) multiply each light's authored physical intensity by this factor instead of normalizing it to 1
 * @property {boolean} [castGroundShadow] - (glTF/GLB only) give every mesh in the scene a ground shadow; omit to inherit the application's `castGroundShadow` setting (on by default)
 * @property {number} [shadowGroundY] - (glTF/GLB only) world Y the ground shadows land on
 * @property {number} [shadowOpacity] - (glTF/GLB only) how dark the blobs are ({@link Mesh#shadowOpacity})
 * @property {number} [shadowScale] - (glTF/GLB only) blob footprint multiplier ({@link Mesh#shadowScale})
 * @property {number} [shadowOffset] - (glTF/GLB only) how far to slide them along the light, in blob radii ({@link Mesh#shadowOffset})
 * @property {number} [shadowStretch] - (glTF/GLB only) how much longer they are along it ({@link Mesh#shadowStretch})
 * @property {number} [shadowDirectionX] - (glTF/GLB only) x of the ground direction they are cast along
 * @property {number} [shadowDirectionZ] - (glTF/GLB only) z of that direction
 * @property {number[]|Vector3d} [shadowGroundNormal] - (glTF/GLB only) up normal of the floor, for a scene that is not level
 * @property {Light3d} [shadowLight] - (glTF/GLB only) a {@link Light3d} to take the shadow direction from, re-read every draw
 * @property {number} [toonBands] - (glTF/GLB only) cel-shade every lit mesh into this many bands ({@link Mesh#toonBands})
 * @property {number} [outlineWidth] - (glTF/GLB only) outline every mesh this many world units wide ({@link Mesh#outlineWidth})
 * @property {Color|string|number[]} [outlineColor] - (glTF/GLB only) the outline colour ({@link Mesh#outlineColor})
 * @property {string} [outlineMode] - (glTF/GLB only) what `outlineWidth` is measured in, world units or `"screen"` pixels ({@link Mesh#outlineMode})
 * @property {number} [rimLight] - (glTF/GLB only) a rim light on every lit mesh, this strong ({@link Mesh#rimLight})
 * @property {Color|string|number[]} [rimColor] - (glTF/GLB only) the rim light's colour ({@link Mesh#rimColor})
 * @property {boolean} [pickable] - (glTF/GLB only) set `false` to have {@link Camera3d#pick} pass over the scene's meshes ({@link Mesh#pickable})
 * @property {number} [crossfade] - (glTF/GLB only) for an animated or skinned asset, the default crossfade between its clips, in milliseconds ({@link GLTFModel#crossfade})
 */

/**
 * Every option {@link level.load} understands: the three the director handles
 * itself, plus each level format's own, declared next to the code that reads
 * them (`TileMap.loadOptions`, `GLTFScene.loadOptions`).
 *
 * This exists so that nothing has to keep a SECOND copy of the list. `Trigger`
 * forwards a caller's settings on to `load()` and used to name the options it
 * would carry, which meant every option added to a level format was silently
 * dropped there until somebody noticed — the six glTF options were, for three
 * releases (#1649). Forwarders now filter by this, so naming an option once,
 * beside the code that reads it, is enough.
 * Internal: this exists so the forwarders and the formats cannot disagree, not
 * as a surface for games to read. `level.load` remains the documented API and
 * its options are unchanged.
 * It grows when a format is registered ({@link level.registerFormat}), so
 * read it when it is needed rather than once.
 * @type {ReadonlyArray<string>}
 * @see level.load
 * @ignore
 * @internal
 */
export const LEVEL_LOAD_OPTIONS = [
	// handled by the director itself, whatever the format
	"container",
	"onLoaded",
	"async",
	// each format's own are added as it is registered: see `registerFormat`
];

/**
 * The level director: it knows every level the loader has read, and puts
 * one into the world on request.
 *
 * A level is registered when its asset loads, under the asset's name, whatever
 * it was made with:
 *
 * | asset type | made with | `level.load(...)` |
 * | --- | --- | --- |
 * | `"tmx"` | [Tiled](https://www.mapeditor.org) | the asset's name |
 * | `"tilemap"` | any tool that writes a tile map | the asset's name |
 * | `"spritefusion"` | [Sprite Fusion](https://www.spritefusion.com) | the asset's name |
 * | `"ldtk"` | [LDtk](https://ldtk.io) | `"<asset>:<level>"` for one level of the project, `"<asset>"` for its whole world |
 * | `"gltf"`, `"glb"` | a 3D tool that exports glTF | the asset's name |
 *
 * The objects a level places are built by the classes registered with
 * {@link registerObjectClass}, and the level's tile layers are
 * {@link TileLayer}s, whichever of them it is.
 * @namespace level
 * @example
 * await loader.preload([
 *     { name: "cave",  type: "tmx",          src: "data/map/cave.tmx" },
 *     { name: "tiles", type: "image",        src: "data/img/tiles.png" },
 *     { name: "tower", type: "spritefusion", src: "data/tower/map.json" },
 *     { name: "world", type: "ldtk",         src: "data/world/world.ldtk" },
 * ]);
 * registerObjectClass("Player", Player);
 *
 * await level.load("cave", { async: true });            // a Tiled map
 * await level.load("tower", { async: true });           // a Sprite Fusion map
 * await level.load("world:Entrance", { async: true });  // one level of an LDtk project
 * await level.load("world", { async: true });           // or its whole world
 */

export const level = {
	/**
	 * Register a level format: what {@link level.add} makes a level of that
	 * format from, so that {@link level.load}, {@link level.next},
	 * {@link level.reload} and a `Trigger` work with it as they do with a
	 * Tiled map. A loader for another map editor's files registers one, then
	 * calls `level.add(format, levelId)` for each level it has read.
	 *
	 * `create(levelId)` returns the level object, which the director keeps
	 * and asks for two things:
	 * - `addTo(container, options)`: add everything the level holds to the
	 *   container. `options` are the ones given to `level.load`; the
	 *   container has been emptied first.
	 * - `destroy()`: let go of what `addTo` built, when another level is
	 *   loaded. The level is loaded again later with another `addTo`.
	 *
	 * It is made when the level is added, which is usually while assets are
	 * still loading: keep `create` cheap, and read images and build layers in
	 * `addTo`. A `nextobjectid` number on it, if any, is where the ids of the
	 * objects made at run time start.
	 * @param {string} format - the name of the format, as given to {@link level.add}
	 * @param {object} definition - how levels of this format are made
	 * @param {Function} definition.create - `create(levelId)`, returning the level object
	 * @param {string[]} [definition.loadOptions] - the names of the options `addTo` reads beyond `container`, `onLoaded` and `async`, so that a `Trigger` forwards them from its settings
	 * @throws {Error} when the format is already registered, or `create` is not a function
	 * @example
	 * // levels kept by a parser of your own, registered with `loader.setParser`
	 * level.registerFormat("rooms", {
	 *     create: (levelId) => new Room(rooms.get(levelId)),
	 * });
	 * // then, for each room the parser has read:
	 * level.add("rooms", "cellar");
	 * // and in the game:
	 * level.load("cellar");
	 */
	registerFormat(format, definition) {
		if (typeof definition?.create !== "function") {
			throw new Error(
				`level format "${format}" needs a create(levelId) function`,
			);
		}
		if (formats.has(format)) {
			throw new Error(`level format "${format}" is already registered`);
		}
		formats.set(format, definition);
		for (const option of definition.loadOptions ?? []) {
			if (!LEVEL_LOAD_OPTIONS.includes(option)) {
				LEVEL_LOAD_OPTIONS.push(option);
			}
		}
	},

	/**
	 * add a level into the game manager (usually called by the preloader)
	 * @public
	 * @param {string} format - level format ("tmx" for Tiled maps, "gltf" / "glb" for 3D scenes, or one registered with {@link level.registerFormat})
	 * @param {string} levelId - the level id (or name)
	 * @param {Function} [callback] - a function to be called once the level is loaded
	 * @returns {boolean} true if the level was loaded
	 */
	add(format, levelId, callback) {
		const definition = formats.get(format);
		if (definition === undefined) {
			throw new Error("no level loader defined for format " + format);
		}

		// register the level once (idempotent)
		if (levels[levelId] == null) {
			levels[levelId] = definition.create(levelId);
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
	 * Have the viewport follow a level's area, as it does a Tiled map's: its
	 * bounds are the area's (or its own size where the area is smaller), and
	 * an area smaller than the viewport is centred in it, now and each time
	 * the viewport is resized. For the `addTo` of a format registered with
	 * {@link level.registerFormat}.
	 *
	 * A viewport follows one level at a time: following another replaces the
	 * first. Call the function returned from the level's `destroy`.
	 * @param {Container} container - the container the level was added to
	 * @param {Bounds} bounds - the level's area, in the container
	 * @returns {Function} call it to stop following
	 * @example
	 * // in a level's addTo(container, options)
	 * if (options.setViewportBounds !== false) {
	 *     const area = new Bounds();
	 *     area.setMinMax(0, 0, this.width, this.height);
	 *     this.unfollow = level.followViewport(container, area);
	 * }
	 * // and in its destroy()
	 * this.unfollow?.();
	 */
	followViewport(container, bounds) {
		const follow = bindViewportToLevel(container, bounds);
		return () => {
			releaseViewport(follow);
		};
	},

	/**
	 * Unregister a level, the reverse of {@link level.add}: the loader calls it
	 * when unloading a bundle frees the map or scene the level was built from,
	 * and the map's parser registers it again (at the end of the level order)
	 * when that bundle is loaded again.
	 *
	 * Unregistering the CURRENT level leaves the world as it is — what was
	 * built from the level stays there and keeps running — but there is then no
	 * current level: {@link level.getCurrentLevelId} returns `undefined`, so
	 * {@link level.reload} has nothing to reload, until a level is loaded again.
	 *
	 * A format registered with {@link level.registerFormat} calls it itself,
	 * for each of its levels, when the file they were read from is unloaded.
	 * @param {string} levelId - the level id (or name)
	 * @returns {boolean} true if the level was registered
	 */
	remove(levelId) {
		const index = levelIdx.indexOf(levelId);
		if (index === -1) {
			return false;
		}
		levelIdx.splice(index, 1);
		delete levels[levelId];
		// keep the index pointing at the same level, or at none
		if (index < currentLevelIdx) {
			currentLevelIdx--;
		} else if (index === currentLevelIdx) {
			currentLevelIdx = -1;
		}
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
	 * @param {string} levelId - level id: the name of the map's asset, or for an LDtk project `"<asset>:<level>"` (one level) or `"<asset>"` (its whole world)
	 * @param {LevelLoadOptions & { async: true }} options - load options, with `async` set
	 * @returns {Promise<boolean>} resolves `true` once the level is in the world
	 * @example
	 * await me.loader.preload(game.assets);
	 * await me.level.load("a4_level1", { async: true });
	 * // the world is populated here
	 * @example
	 * // a level of an LDtk project loaded as the asset "world", leaving out
	 * // the objects the player already took
	 * await me.level.load("world:Entrance", {
	 *     async: true,
	 *     objects: (settings) => !taken.has(settings.id),
	 * });
	 * @category Level
	 */
	/**
	 * load a level into the game manager<br>
	 * (will also create all level defined entities, etc..)
	 *
	 * While the game loop is running the load is DEFERRED to a timer, so this
	 * returns before anything is in the world. Sequence follow-up work from
	 * `options.onLoaded`, from an `event.LEVEL_LOADED` listener, or by passing
	 * `async: true` and awaiting the promise that overload returns.
	 *
	 * Note that `await me.level.load(id)` without `async: true` does not await
	 * the load: the call returns a boolean, and `await true` resolves at once.
	 * @overload
	 * @param {string} levelId - level id: the name of the map's asset, or for an LDtk project `"<asset>:<level>"` (one level) or `"<asset>"` (its whole world)
	 * @param {LevelLoadOptions & { async?: false }} [options] - additional optional parameters
	 * @returns {boolean} `true`
	 * @example
	 * // load a level
	 * me.level.load("a4_level1");
	 *
	 * // a Sprite Fusion map (preloaded with type "spritefusion")
	 * me.level.load("tower");
	 *
	 * // one level of an LDtk project (preloaded with type "ldtk" as "world")
	 * me.level.load("world:Entrance");
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

		// Deferred so the current frame can finish first. `level.load()` is
		// routinely called from inside the loop — a trigger handler, an update
		// step — and `safeLoadLevel` resets and destroys the very container the
		// loop may be iterating. `state.stop()` sets a flag; it does not unwind
		// the frame already on the stack.
		//
		// A TIMER, through the engine's own `defer`, and deliberately not a
		// microtask. A macrotask cannot run inside another, so the load lands
		// after the current frame whatever the frame does. A microtask only
		// lands there while the whole update-and-draw path stays synchronous —
		// true today, but it would start running mid-frame the day anything in
		// that path awaits, silently and with nothing to catch it.
		if (state.isRunning()) {
			// stop the game loop to avoid some silly side effects
			state.stop();
			if (wantsPromise) {
				// The load runs in `.then`, not in the executor: a throw from
				// inside `defer`'s callback would escape the executor entirely,
				// leaving the promise pending forever. Raised one level up it
				// rejects, which is why this needs no try/catch.
				return new Promise((resolve) => {
					defer(resolve, null);
				}).then(() => {
					safeLoadLevel(levelId, options, true);
					return true;
				});
			}
			// Fire-and-forget: no promise is created, so there is nothing to
			// swallow a failure — a throw inside the timer lands on an empty
			// stack as an uncaught error, which is the surface this has always
			// had.
			defer(() => {
				safeLoadLevel(levelId, options, true);
			}, null);
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
	 * @returns {TileMap|GLTFScene|LDtkLevel|LDtkWorld} the current level object (a TileMap for Tiled maps, a GLTFScene for glTF/GLB scenes, an LDtkLevel or an LDtkWorld for LDtk)
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
	 * While the game loop is running the load is deferred to a timer, so this
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
	 * While the game loop is running the load is deferred to a timer, so this
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
	 * While the game loop is running the load is deferred to a timer, so this
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

// the formats the engine reads itself
level.registerFormat("tmx", {
	create: (levelId) => {
		return new TileMap(levelId, getTileMap(levelId));
	},
	loadOptions: TileMap.loadOptions,
});
level.registerFormat("ldtk", {
	// made by the loader, with the project they belong to
	create: (levelId) => {
		return ldtkMaps.get(levelId);
	},
	loadOptions: LDtkLevel.loadOptions,
});
for (const format of ["gltf", "glb"]) {
	level.registerFormat(format, {
		create: (levelId) => {
			return new GLTFScene(levelId);
		},
		loadOptions: GLTFScene.loadOptions,
	});
}
