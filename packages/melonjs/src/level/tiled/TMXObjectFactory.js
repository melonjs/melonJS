import { polygonPool } from "../../geometries/polygon.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import { setPoolRegisterCallback } from "../../system/legacy_pool.js";
import { createShapeObject } from "./factories/shape.js";
import { createTextObject } from "./factories/text.js";
import { createTileObject } from "./factories/tile.js";
import TMXLayer from "./TMXLayer.js";

/**
 * registry of Tiled object factory functions
 * @ignore
 */
const factories = new Map();

/**
 * tracks class constructors registered via registerTiledObjectClass
 * (used to detect duplicate registrations with different constructors)
 * @ignore
 */
const registeredClasses = new Map();

/**
 * whether built-in factories have been registered
 * @ignore
 */
let factoriesInitialized = false;

/**
 * Return a default shape (polygon) for the given dimensions,
 * or the existing shapes if already defined in settings.
 * @param {object} settings - TMX object settings
 * @returns {Polygon|object[]} shape(s) for the object body
 * @ignore
 */
export function getDefaultShape(settings) {
	if (typeof settings.shapes !== "undefined") {
		return settings.shapes;
	}
	return polygonPool.get(0, 0, [
		vector2dPool.get(0, 0),
		vector2dPool.get(settings.width, 0),
		vector2dPool.get(settings.width, settings.height),
	]);
}

/**
 * Detect the object type from its TMX settings.
 * The detection order is:
 * 1. TMXLayer instances → "layer" (passthrough)
 * 2. Object class matching a registered factory → class name
 * 3. Object name matching a registered factory → name
 * 4. Object with text data → "text"
 * 5. Object with tile/gid data → "tile"
 * 6. Everything else → "shape"
 * @param {object} settings - TMX object settings
 * @returns {string} the factory type key
 * @ignore
 */
export function detectObjectType(settings) {
	if (settings instanceof TMXLayer) {
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
 * <br><br>
 * For simple cases where you just want to map a Tiled class to a constructor,
 * use {@link registerTiledObjectClass} instead.
 * @category Tilemap
 * @param {string} type - the object type key (built-in type or Tiled class/name)
 * @param {Function} factory - factory function with signature `(settings, map) => Renderable`
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
 * an instance of the given constructor will be created with `new Constructor(x, y, settings)`.
 * <br><br>
 * This is a convenience wrapper around {@link registerTiledObjectFactory}.
 * If the same class is registered twice with the same constructor, the call is silently ignored.
 * If a different constructor is registered for the same name, an error is thrown.
 * <br><br>
 * Note: classes registered via {@link pool.register} are also automatically registered
 * as Tiled object factories (unless {@link pool.autoRegisterTiled} is set to `false`).
 * @category Tilemap
 * @param {string} name - the Tiled class or object name to match
 * @param {Function} Constructor - class constructor with signature `(x, y, settings)`
 * @example
 * // register a custom enemy class for use in Tiled maps
 * // In Tiled: set the object class to "Enemy" and add custom properties
 * registerTiledObjectClass("Enemy", Enemy);
 *
 * @example
 * // equivalent to pool.register (which auto-registers for Tiled too)
 * pool.register("CoinEntity", CoinEntity, true);
 * // CoinEntity is now available both in the pool AND as a Tiled object factory
 */
export function registerTiledObjectClass(name, Constructor) {
	const existing = registeredClasses.get(name);
	if (typeof existing !== "undefined") {
		if (existing === Constructor) {
			// same class already registered — no-op
			return;
		}
		throw new Error(
			"a different class is already registered for Tiled type: " + name,
		);
	}
	registeredClasses.set(name, Constructor);
	registerTiledObjectFactory(name, (settings) => {
		const obj = new Constructor(settings.x, settings.y, settings);
		obj.pos.z = settings.z;
		return obj;
	});
}

/**
 * pending class registrations queued before initFactories runs
 * @ignore
 */
const pendingClasses = [];

/**
 * Queue a class for registration as a Tiled object factory.
 * Registrations are applied when initFactories() runs (on first
 * createTMXObject call), avoiding circular import issues at module load time.
 * @param {string} name - the Tiled class or name to match
 * @param {Function} Constructor - class constructor with signature (x, y, settings)
 * @ignore
 */
export function registerBuiltinTiledClass(name, Constructor) {
	if (factoriesInitialized) {
		// already initialized, register immediately
		registerTiledObjectClass(name, Constructor);
	} else {
		pendingClasses.push([name, Constructor]);
	}
}

/**
 * Register built-in factories and apply pending class registrations.
 * Called lazily on first createTMXObject call, after all modules are fully loaded.
 * @ignore
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

	// apply pending class-based factories
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
 */
export function createTMXObject(settings, map) {
	if (!factoriesInitialized) {
		initFactories();
	}

	const type = detectObjectType(settings);

	// TMXLayer instances are already instantiated — pass through
	if (type === "layer") {
		return settings;
	}

	const factory = factories.get(type);
	if (typeof factory === "undefined") {
		throw new Error("no Tiled object factory registered for type: " + type);
	}

	return factory(settings, map);
}

// wire pool.register() to automatically register Tiled object factories
// uses pool.pull instead of new Constructor to preserve object recycling
setPoolRegisterCallback((className, classObj, poolInstance) => {
	const factoryFn = (settings) => {
		const obj = poolInstance.pull(className, settings.x, settings.y, settings);
		obj.pos.z = settings.z;
		return obj;
	};

	if (factoriesInitialized) {
		registeredClasses.set(className, classObj);
		registerTiledObjectFactory(className, factoryFn);
	} else {
		// queue as a raw factory (not via registerTiledObjectClass which uses new Constructor)
		pendingClasses.push([className, classObj, factoryFn]);
	}
});
