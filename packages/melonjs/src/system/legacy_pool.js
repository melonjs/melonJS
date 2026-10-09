import { warning } from "../lang/console.js";
import { getTotalPoolSize } from "../pool";

/**
 * callback invoked when a class is registered, used by the Tiled object factory
 * @ignore
 * @internal
 */
let onRegisterCallback = null;

/**
 * Set a callback to be invoked whenever pool.register() is called.
 * @param {Function} callback - function(className, classObj, poolInstance) called on each registration
 * @ignore
 * @internal
 */
export function setPoolRegisterCallback(callback) {
	onRegisterCallback = callback;
}

/**
 * Which methods have already warned.
 *
 * Once per method, never per call: `pull` runs in the hot path of any game
 * that pools its bullets, and `warning` prints a collapsed group WITH a stack
 * trace. Firing that per bullet would be worse than the thing it warns about.
 * @ignore
 * @internal
 */
const warned = new Set();

/**
 * Say this method is on the way out, once.
 *
 * Names both replacements, because `pool.register` was doing two unrelated
 * jobs and a caller only ever wanted one of them: recycling instances, or
 * letting a Tiled map name a class.
 * @param {string} method - the method being called
 * @ignore
 * @internal
 */
function warnOnce(method) {
	if (warned.has(method)) {
		return;
	}
	warned.add(method);
	warning(
		"pool." + method + "()",
		'getPool("tween") / createPool() to pool instances, or ' +
			"registerTiledObjectClass() to let a Tiled map name a class",
		"18.0.0",
	);
}

/**
 * Object pooling - a technique that might speed up your game if used properly.<br>
 * If some of your classes will be instantiated and removed a lot at a time, it is a
 * good idea to add the class to this object pool. A separate pool for that class
 * will be created, which will reuse objects of the class. That way they won't be instantiated
 * each time you need a new one (slowing your game), but stored into that pool and taking one
 * already instantiated when you need it.<br><br>
 * This technique is also used by the engine to instantiate objects defined in the map,
 * which means, that on level loading the engine will try to instantiate every object
 * found in the map, based on the user defined name in each Object Properties<br>
 * <img src="../images/object_properties.png"/><br>
 *
 * **Superseded by the typed pools.** `createPool` arrived in 18.0.0 and does
 * the same job without the string keys: `getPool("tween")`, `getPool("text")`
 * and the rest are typed, so a wrong name is a compile error rather than a
 * throw, and a pool can be created for any class with `createPool`. For
 * registering a class so a Tiled map can name it, use
 * {@link registerTiledObjectClass}, which is what this now delegates to.
 *
 * The engine itself no longer uses this pool for anything.
 * @deprecated since 18.0.0, use {@link getPool} / `createPool`, and
 * {@link registerTiledObjectClass} for Tiled classes
 * @see {@link pool} the default global instance of ObjectPool
 */
class ObjectPool {
	constructor() {
		this.objectClass = {};
		this.instance_counter = 0;

		/**
		 * When enabled, classes registered via {@link pool.register} are also
		 * automatically registered as Tiled object factories, so that objects
		 * placed in a Tiled map with a matching class or name will be
		 * instantiated using the registered constructor.
		 * Set to `false` to disable this behavior (e.g. for classes that should
		 * only be used programmatically and not from Tiled maps).
		 * @type {boolean}
		 * @default true
		 * @example
		 * // disable auto-registration for a specific class
		 * pool.autoRegisterTiled = false;
		 * pool.register("InternalHelper", HelperClass);
		 * pool.autoRegisterTiled = true; // re-enable for subsequent registrations
		 */
		this.autoRegisterTiled = true;
	}

	/**
	 * Register an object to the pool. <br>
	 * Pooling must be set to true if more than one such objects will be created. <br>
	 * (Note: for an object to be poolable, it must implement an `onResetEvent` method) <br><br>
	 * Registered classes are also automatically available as Tiled object factories,
	 * meaning objects placed in a Tiled map with a matching class or name will be
	 * instantiated using the registered constructor. For more control, use
	 * {@link registerTiledObjectClass} or {@link registerTiledObjectFactory} instead.
	 * @param {string} className - as defined in the Name field of the Object Properties (in Tiled)
	 * @param {object} classObj - corresponding Class to be instantiated
	 * @param {boolean} [recycling=false] - enables object recycling for the specified class
	 * @example
	 * // implement CherryEntity
	 * class Cherry extends Sprite {
	 *    onResetEvent() {
	 *        // reset object mutable properties
	 *        this.lifeBar = 100;
	 *    }
	 * };
	 * // add our users defined entities in the object pool and enable object recycling
	 * // this also registers "cherrysprite" as a Tiled object factory, so any object
	 * // with class or name "cherrysprite" in a Tiled map will create a Cherry instance
	 * me.pool.register("cherrysprite", Cherry, true);
	 */
	register(className, classObj, recycling = false) {
		warnOnce("register");
		if (typeof classObj !== "undefined") {
			const entry = {
				class: classObj,
				pool: recycling ? [] : undefined,
			};
			this.objectClass[className] = entry;
			// also register with "me." prefix for backward compatibility
			if (!className.startsWith("me.")) {
				this.objectClass["me." + className] = entry;
			}
			// also register as a Tiled object factory
			if (this.autoRegisterTiled && typeof onRegisterCallback === "function") {
				onRegisterCallback(className, classObj, this);
				// also register with "me." prefix for backward compatibility
				if (!className.startsWith("me.")) {
					onRegisterCallback("me." + className, classObj, this);
				}
			}
		} else {
			throw new Error(
				"Cannot register object '" + className + "', invalid class",
			);
		}
	}

	/**
	 * Pull a new instance of the requested object (if added into the object pool)
	 * @param {string} name - as used in {@link pool.register}
	 * @param {...*} args - arguments to be passed when instantiating/reinitializing the object
	 * @returns {object} the instance of the requested object
	 * @example
	 * me.pool.register("bullet", BulletEntity, true);
	 * me.pool.register("enemy", EnemyEntity, true);
	 * // ...
	 * // when we need to manually create a new bullet:
	 * let bullet = me.pool.pull("bullet", x, y, direction);
	 * // ...
	 * // params aren't a fixed number
	 * // when we need new enemy we can add more params, that the object construct requires:
	 * let enemy = me.pool.pull("enemy", x, y, direction, speed, power, life);
	 * // ...
	 * // when we want to destroy existing object, the remove
	 * // function will ensure the object can then be reallocated later
	 * app.world.removeChild(enemy);
	 * app.world.removeChild(bullet);
	 */
	pull(name, ...args) {
		warnOnce("pull");
		const className = this.objectClass[name];
		if (className) {
			const proto = className["class"];
			const poolArray = className.pool;
			let obj;

			if (poolArray && (obj = poolArray.pop())) {
				// poolable object must implement a `onResetEvent` method
				obj.onResetEvent.apply(obj, args);
				this.instance_counter--;
			} else {
				// create a new instance
				obj = new (proto.bind.apply(proto, [proto, ...args]))();
				if (poolArray) {
					obj.className = name;
				}
			}
			return obj;
		}
		throw new Error("Cannot instantiate object of type '" + name + "'");
	}

	/**
	 * purge the object pool from any inactive object <br>
	 * Object pooling must be enabled for this function to work<br>
	 * note: this will trigger the garbage collector
	 */
	purge() {
		for (const className in this.objectClass) {
			if (this.objectClass[className]) {
				this.objectClass[className].pool = [];
			}
		}
		this.instance_counter = 0;
	}

	/**
	 * Push back an object instance into the object pool <br>
	 * Object pooling for the object class must be enabled,
	 * and object must have been instantiated using {@link pull},
	 * otherwise this function won't work
	 *
	 * Reports failure by RETURNING FALSE. It used to throw by default, and
	 * nothing at the call site made that visible: a class that was never
	 * registered, or registered without recycling, aborted whatever was
	 * running. Both of the internal uses removed in 20.7.0 failed that way,
	 * inside a `destroy()` that had already recycled other state, which left
	 * a half-torn-down object to die later somewhere unrelated. Pass
	 * `throwOnError` to opt back in where a missed registration is a bug you
	 * want to hear about immediately.
	 * @param {object} obj - instance to be recycled
	 * @param {boolean} [throwOnError=false] - throw an exception instead of returning false
	 * @throws when the object cannot be recycled AND `throwOnError` is true
	 * @returns {boolean} true if the object was successfully recycled in the object pool
	 */
	push(obj, throwOnError = false) {
		warnOnce("push");
		if (!this.poolable(obj)) {
			if (throwOnError === true) {
				throw new Error("me.pool: object " + obj + " cannot be recycled");
			} else {
				return false;
			}
		}

		// store back the object instance for later recycling
		this.objectClass[obj.className].pool.push(obj);
		this.instance_counter++;

		return true;
	}

	/**
	 * Check if an object with the provided name is registered
	 * @param {string} name - of the registered object class
	 * @returns {boolean} true if the classname is registered
	 */
	exists(name) {
		return name in this.objectClass;
	}

	/**
	 * Check if an object is poolable
	 * (was properly registered with the recycling feature enable)
	 * @see register
	 * @param {object} obj - object to be checked
	 * @returns {boolean} true if the object is poolable
	 * @example
	 * if (!me.pool.poolable(myCherryEntity)) {
	 *     // object was not properly registered
	 * }
	 */
	poolable(obj) {
		const className = obj.className;
		return (
			typeof className !== "undefined" &&
			typeof obj.onResetEvent === "function" &&
			className in this.objectClass &&
			typeof this.objectClass[className].pool !== "undefined"
		);
	}

	/**
	 * returns the amount of object instance currently in the pool
	 * @returns {number} amount of object instance
	 */
	getInstanceCount() {
		return this.instance_counter + getTotalPoolSize();
	}
}

/**
 * a default global ObjectPool instance
 * @namespace pool
 * @see ObjectPool
 * @example
 * // register our bullet object into the object pool
 * pool.register("bullet", BulletEntity, true);
 * // ...
 * // when we need to manually create a new bullet:
 * let bullet = pool.pull("bullet", x, y, direction, velocity);
 * // ...
 * // when we want to destroy existing object, the remove
 * // function will ensure the object can then be reallocated later
 * game.world.removeChild(bullet);
 */
const pool = new ObjectPool();

export default pool;
