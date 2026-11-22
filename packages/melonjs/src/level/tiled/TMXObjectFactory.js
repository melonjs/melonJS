import { polygonPool } from "../../geometries/polygon.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import { setPoolRegisterCallback } from "../../system/legacy_pool.js";
import TileLayer from "../tilemap/TileLayer.js";
import { createShapeObject } from "./factories/shape.js";
import { createTextObject } from "./factories/text.js";
import { createTileObject } from "./factories/tile.js";

/**
 * @import Renderable from "../../renderable/renderable.js";
 * @import TMXObject from "./TMXObject.js";
 * @import TMXTileMap from "./TMXTileMap.js";
 */

/**
 * registry of Tiled object factory functions
 * @ignore
 * @internal
 */
const factories = new Map();

/**
 * tracks class constructors registered via registerTiledObjectClass
 * (used to detect duplicate registrations with different constructors)
 * @ignore
 * @internal
 */
const registeredClasses = new Map();

/**
 * whether built-in factories have been registered
 * @ignore
 * @internal
 */
let factoriesInitialized = false;

/**
 * Names whose current factory came from a built-in class.
 *
 * A built-in is a DEFAULT, so a game's own class takes the name over whenever
 * it is registered, and not only before the first map load. Without this the
 * outcome depended on the ordering: a `Stage` registering its classes in
 * `onResetEvent`, with an earlier level already loaded, hit the
 * duplicate-registration error rather than winning.
 * @ignore
 * @internal
 */
const builtinNames = new Set();

/**
 * the factories for an object's shape rather than its class
 * @ignore
 * @internal
 */
const STRUCTURAL_TYPES = new Set(["text", "tile", "shape"]);

/**
 * Return a default shape (polygon) for the given dimensions,
 * or the existing shapes if already defined in settings.
 * @param {object} settings - TMX object settings
 * @returns {Polygon|object[]} shape(s) for the object body
 * @ignore
 * @internal
 */
export function getDefaultShape(settings) {
	if (typeof settings.shapes !== "undefined") {
		return settings.shapes;
	}
	// four vertices, not three: a Tiled object with no explicit geometry is a
	// rectangle, and omitting (0, height) leaves the upper-right triangle —
	// the lower-left half of every such object was not solid.
	return polygonPool.get(0, 0, [
		vector2dPool.get(0, 0),
		vector2dPool.get(settings.width, 0),
		vector2dPool.get(settings.width, settings.height),
		vector2dPool.get(0, settings.height),
	]);
}

/**
 * Detect the object type from its TMX settings.
 * The detection order is:
 * 1. tile layers (a Tiled layer, or any `TileLayer`) → "layer" (passthrough)
 * 2. Object class matching a registered factory → class name
 * 3. Object name matching a registered factory → name
 * 4. A tile object with no class, whose tile's class matches a factory or
 *    class the game registered (never a built-in) → the tile's class
 * 5. Object with text data → "text"
 * 6. Object with tile/gid data → "tile"
 * 7. Everything else → "shape"
 * @param {object} settings - TMX object settings
 * @returns {string} the factory type key
 * @ignore
 * @internal
 */
export function detectObjectType(settings) {
	if (settings instanceof TileLayer) {
		return "layer";
	}
	// check if a factory is registered for this object's class
	if (typeof settings.class === "string" && factories.has(settings.class)) {
		return settings.class;
	}
	// check if a factory is registered for this object's name
	if (typeof settings.name === "string" && factories.has(settings.name)) {
		return settings.name;
	}
	// a tile object with no class of its own takes its tile's class, as in
	// Tiled. Only for a name the game registered itself, so a tile classed
	// like a built-in ("shape", "Trigger"...) stays a tile
	if (!settings.class && typeof settings.tile === "object") {
		const tileClass = settings.tile.tileset.getTileClass(settings.tile.tileId);
		if (
			tileClass !== undefined &&
			factories.has(tileClass) &&
			!STRUCTURAL_TYPES.has(tileClass) &&
			!builtinNames.has(tileClass)
		) {
			return tileClass;
		}
	}
	if (typeof settings.text === "object") {
		return "text";
	}
	if (typeof settings.tile === "object") {
		return "tile";
	}
	return "shape";
}

/**
 * Register a factory function for a given Tiled object type.
 * When a Tiled map is loaded, objects are matched to factories using the following
 * priority: object class → object name → structural type ("text", "tile", "shape").
 * <br><br>
 * Built-in structural types are: `"text"`, `"tile"`, `"shape"`.
 * Custom types are matched against the object's Tiled `class` or `name` property.
 * A tile object with no class of its own is matched by its tile's class.
 * <br><br>
 * For simple cases where you just want to map a Tiled class to a constructor,
 * use {@link registerTiledObjectClass} instead.
 * @category Tilemap
 * @template [S=TMXObject]
 * @param {string} type - the object type key (built-in type or Tiled class/name)
 * @param {(settings: S, map: TMXTileMap) => Renderable} factory - factory function, given the Tiled object (a {@link TMXObject}) and its map
 * @example
 * // register a custom factory for "Spine" objects in Tiled
 * // (set the object class to "Spine" in Tiled, and add atlasFile/jsonFile custom properties)
 * registerTiledObjectFactory("Spine", (settings, map) => {
 *     const obj = new Spine(settings.x, settings.y, settings);
 *     obj.pos.z = settings.z;
 *     return obj;
 * });
 *
 * @example
 * // override the built-in "shape" factory to add custom behavior
 * registerTiledObjectFactory("shape", (settings, map) => {
 *     const obj = new Renderable(settings.x, settings.y, settings.width, settings.height);
 *     obj.pos.z = settings.z;
 *     // add custom initialization...
 *     return obj;
 * });
 */
export function registerTiledObjectFactory(type, factory) {
	if (typeof factory !== "function") {
		throw new Error("invalid factory function for " + type);
	}

	if (typeof factories.get(type) !== "undefined") {
		console.warn(
			"melonJS: overriding Tiled object factory for " + type + " type",
		);
	}

	factories.set(type, factory);
}

/**
 * Register a class constructor as a Tiled object factory.
 * When an object with a matching `class` or `name` is found in a Tiled map,
 * an instance of the given constructor will be created with `new Constructor(x, y, settings)`,
 * `settings` being the {@link TMXObject} as read from the map.
 * <br><br>
 * A tile object with no class of its own is matched by its tile's class, as in
 * Tiled: give a tile a class in Tiled's tileset editor, and every object placed
 * from that tile is built by the class registered under that name (an object's
 * own class or name, when registered, still comes first). The tile's custom
 * properties are read with {@link TMXObject#resolvedProperty}.
 * <br><br>
 * This is a convenience wrapper around {@link registerTiledObjectFactory}.
 * If the same class is registered twice with the same constructor, the call is silently ignored.
 * If a different constructor is registered for the same name, an error is thrown.
 * <br><br>
 * Note: classes registered via {@link pool.register} are also automatically registered
 * as Tiled object factories (unless {@link pool.autoRegisterTiled} is set to `false`).
 * @category Tilemap
 * @template [S=TMXObject]
 * @param {string} name - the Tiled class or object name to match
 * @param {new (x: number, y: number, settings: S) => Renderable} Constructor - class constructor, given the object's position and the object (a {@link TMXObject})
 * @example
 * // register a custom enemy class for use in Tiled maps
 * // In Tiled: set the object class to "Enemy" and add custom properties
 * registerTiledObjectClass("Enemy", Enemy);
 *
 * @example
 * // the older spelling: `pool.register` registers a Tiled factory as a side
 * // effect, and additionally makes the class RECYCLABLE, which this registry
 * // alone does not do
 * pool.register("CoinEntity", CoinEntity, true);
 */
export function registerTiledObjectClass(name, Constructor) {
	const existing = registeredClasses.get(name);
	let displacesBuiltin = false;
	if (typeof existing !== "undefined") {
		if (existing === Constructor) {
			// same class already registered — no-op
			return;
		}
		if (!builtinNames.has(name)) {
			throw new Error(
				"a different class is already registered for Tiled type: " + name,
			);
		}
		// only a default sat here, so the game's class takes the name over
		builtinNames.delete(name);
		displacesBuiltin = true;
	}
	registeredClasses.set(name, Constructor);
	const factory = (settings) => {
		const obj = new Constructor(settings.x, settings.y, settings);
		obj.pos.z = settings.z;
		return obj;
	};
	if (displacesBuiltin) {
		// expected, so no "overriding Tiled object factory" warning
		factories.set(name, factory);
	} else {
		registerTiledObjectFactory(name, factory);
	}
}

/**
 * pending class registrations queued before initFactories runs
 * @ignore
 * @internal
 */
const pendingClasses = [];

/**
 * Built-in classes queued at boot, kept apart from `pendingClasses`.
 *
 * They are DEFAULTS: a game that registers its own class for one of these
 * names must win, and before this was separated it lost. Built-ins are queued
 * at boot and flushed at the first map load, while `registerTiledObjectClass`
 * writes immediately, so the built-in landed second and silently replaced the
 * game's class with no error at the call and none at load.
 * @ignore
 * @internal
 */
const pendingBuiltins = [];

/**
 * Queue a class for registration as a Tiled object factory.
 * Registrations are applied when initFactories() runs (on first
 * createTMXObject call), avoiding circular import issues at module load time.
 * @param {string} name - the Tiled class or name to match
 * @param {Function} Constructor - class constructor with signature (x, y, settings)
 * @ignore
 * @internal
 */
export function registerBuiltinTiledClass(name, Constructor) {
	if (factoriesInitialized) {
		applyBuiltinTiledClass(name, Constructor);
	} else {
		pendingBuiltins.push([name, Constructor]);
	}
}

/**
 * Register one built-in class as a default, under its name and its `me.` alias.
 *
 * The alias is the 1.x spelling: a map authored then has objects classed
 * `me.Trigger`, and the engine has always answered to both. It used to arrive
 * by side effect, since `pool.register` registered a Tiled factory for the
 * prefixed name as well, and the built-ins went through that call.
 * @param {string} name - the Tiled class or name to match
 * @param {Function} Constructor - class constructor with signature (x, y, settings)
 * @ignore
 * @internal
 */
function applyBuiltinTiledClass(name, Constructor) {
	for (const key of [name, "me." + name]) {
		// a default fills a gap, it never overwrites
		if (!factories.has(key)) {
			registerTiledObjectClass(key, Constructor);
			builtinNames.add(key);
		}
	}
}

/**
 * Register built-in factories and apply pending class registrations.
 * Called lazily on first createTMXObject call, after all modules are fully loaded.
 * @ignore
 * @internal
 */
function initFactories() {
	// only register built-in structural factories if not already overridden
	if (!factories.has("text")) {
		registerTiledObjectFactory("text", createTextObject);
	}
	if (!factories.has("tile")) {
		registerTiledObjectFactory("tile", createTileObject);
	}
	if (!factories.has("shape")) {
		registerTiledObjectFactory("shape", createShapeObject);
	}

	// Built-ins first, and only where the game has not already claimed the
	// name. Same rule as the structural factories above: a default fills a
	// gap, it never overwrites.
	for (const [name, Constructor] of pendingBuiltins) {
		applyBuiltinTiledClass(name, Constructor);
	}
	pendingBuiltins.length = 0;

	// then everything registered through `pool.register`, in call order, so a
	// game's registration still displaces the built-in of the same name
	for (const entry of pendingClasses) {
		const [name, Constructor, factoryFn] = entry;
		if (typeof factoryFn === "function") {
			// pool-registered: use provided factory (preserves pool.pull recycling)
			registeredClasses.set(name, Constructor);
			registerTiledObjectFactory(name, factoryFn);
		} else {
			// direct registration: use new Constructor()
			registerTiledObjectClass(name, Constructor);
		}
	}
	pendingClasses.length = 0;

	factoriesInitialized = true;
}

/**
 * Instantiate a TMX object based on its settings, using the registered factory
 * for its detected type.
 * @param {object} settings - TMX object settings
 * @param {TMXTileMap} map - the parent tile map
 * @returns {Renderable} the instantiated object
 * @ignore
 * @internal
 */
export function createTMXObject(settings, map) {
	if (!factoriesInitialized) {
		initFactories();
	}

	const type = detectObjectType(settings);

	// tile layers are already instantiated — pass through
	if (type === "layer") {
		return settings;
	}

	const factory = factories.get(type);
	if (typeof factory === "undefined") {
		throw new Error("no Tiled object factory registered for type: " + type);
	}

	return factory(settings, map);
}

/**
 * Register a class for the objects of a level: the same registry whatever the
 * map editor. An object of a Tiled map, an entity of a level in another format
 * read by a plugin: one whose class (or name) is `name` is built with
 * `new Constructor(x, y, settings)`.
 * <br><br>
 * {@link registerTiledObjectClass} is this function under its older name.
 * @category Tilemap
 * @function
 * @template [S=TMXObject]
 * @param {string} name - the class or name the level gives the object
 * @param {new (x: number, y: number, settings: S) => Renderable} Constructor - class constructor, given the object's position and its description
 * @example
 * registerObjectClass("Enemy", Enemy);
 */
export const registerObjectClass = registerTiledObjectClass;

/**
 * Register a function building the objects of a level, for a class or a name:
 * the same registry whatever the map editor. {@link registerTiledObjectFactory}
 * is this function under its older name.
 * @category Tilemap
 * @function
 * @template [S=TMXObject]
 * @param {string} type - the class or name the level gives the object
 * @param {(settings: S, map: object) => Renderable} factory - given the object's description and the map it is read from
 */
export const registerObjectFactory = registerTiledObjectFactory;

/**
 * Whether a class or a factory is registered under a name, by the game or by
 * the engine (its own classes, such as `Trigger` or `Light2d`, are): what a
 * level reader asks before {@link createLevelObject}, to tell an object the
 * game has a class for from one it has to make something of by itself.
 * @category Tilemap
 * @param {string} name - a class or an object name
 * @returns {boolean} true if a class or a factory is registered for it
 */
export function hasObjectFactory(name) {
	if (!factoriesInitialized) {
		initFactories();
	}
	return factories.has(name);
}

/**
 * Build the object a level describes, with the class or factory registered for
 * it ({@link registerObjectClass}, {@link registerObjectFactory}): by the
 * description's `class`, then its `name`. This is what the Tiled loader calls
 * for each object of a map; a reader for another level format calls it for its
 * own. With nothing registered under either, the description is taken as a
 * Tiled object's: a text, a tile, or a shape with a static body of the
 * description's `width` and `height`. Use {@link hasObjectFactory} first to do
 * otherwise.
 * @category Tilemap
 * @param {object} settings - the object's description: `x`, `y`, `z`, `width`, `height`, `name`, `class`, and whatever else its class reads
 * @param {object} [map] - the map the object is read from, handed to a factory
 * @returns {Renderable} the object
 */
export function createLevelObject(settings, map) {
	return createTMXObject(settings, map);
}

// Wire `pool.register()` to register a Tiled object factory too, so the older
// one-call idiom keeps working.
//
// It constructs directly. It used to call `pool.pull`, to keep Tiled objects
// recycled, but that stopped meaning anything once `Container` released to
// the typed pools instead of pushing here: nothing refills the legacy pool,
// so every `pull` took its construction branch anyway. The only thing it did
// that `new` does not is stamp `className` on the instance, which was read by
// `pool.push` and by nothing else.
setPoolRegisterCallback((className, Constructor) => {
	const factoryFn = (settings) => {
		const obj = new Constructor(settings.x, settings.y, settings);
		obj.pos.z = settings.z;
		return obj;
	};

	if (factoriesInitialized) {
		registeredClasses.set(className, Constructor);
		registerTiledObjectFactory(className, factoryFn);
	} else {
		// queue as a raw factory (not via registerTiledObjectClass which uses new Constructor)
		pendingClasses.push([className, Constructor, factoryFn]);
	}
});
