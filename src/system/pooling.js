var objectClass = {};
var instance_counter = 0;

/**
 * This object is used for object pooling - a technique that might speed up your game if used properly.<br>
 * If some of your classes will be instantiated and removed a lot at a time, it is a
 * good idea to add the class to this object pool. A separate pool for that class
 * will be created, which will reuse objects of the class. That way they won't be instantiated
 * each time you need a new one (slowing your game), but stored into that pool and taking one
 * already instantiated when you need it.<br><br>
 * This object is also used by the engine to instantiate objects defined in the map,
 * which means, that on level loading the engine will try to instantiate every object
 * found in the map, based on the user defined name in each Object Properties<br>
 * <img src="images/object_properties.png"/><br>
 * @namespace me.pool
 * @memberof me
 */

var pool = {

    /**
     * register an object to the pool. <br>
     * Pooling must be set to true if more than one such objects will be created. <br>
     * (Note: for an object to be poolable, it must implements a `onResetEvent` method)
     * @function me.pool.register
     * @param {string} className as defined in the Name field of the Object Properties (in Tiled)
     * @param {object} classObj corresponding Class to be instantiated
     * @param {boolean} [recycling=false] enables object recycling for the specified class
     * @example
     * // implement CherryEntity
     * class CherryEntity extends Spritesheet {
     *    onResetEvent() {
     *        // reset object mutable properties
     *        this.lifeBar = 100;
     *    }
     * };
     * // add our users defined entities in the object pool and enable object recycling
     * me.pool.register("cherryentity", CherryEntity, true);
     */
     register(className, classObj, recycling = false) {
         if (typeof (classObj) !== "undefined") {
             objectClass[className] = {
                 "class" : classObj,
                 "pool" : (recycling ? [] : undefined)
             };
         } else {
             throw new Error("Cannot register object '" + className + "', invalid class");
         }
     },

    /**
     * Pull a new instance of the requested object (if added into the object pool)
     * @function me.pool.pull
     * @param {string} name as used in {@link me.pool.register}
     * @param {object} [...arguments] arguments to be passed when instantiating/reinitializing the object
     * @returns {object} the instance of the requested object
     * @example
     * me.pool.register("bullet", BulletEntity, true);
     * me.pool.register("enemy", EnemyEntity, true);
     * // ...
     * // when we need to manually create a new bullet:
     * var bullet = me.pool.pull("bullet", x, y, direction);
     * // ...
     * // params aren't a fixed number
     * // when we need new enemy we can add more params, that the object construct requires:
     * var enemy = me.pool.pull("enemy", x, y, direction, speed, power, life);
     * // ...
     * // when we want to destroy existing object, the remove
     * // function will ensure the object can then be reallocated later
     * me.game.world.removeChild(enemy);
     * me.game.world.removeChild(bullet);
     */
    pull(name) {
        var args = new Array(arguments.length);
        for (var i = 0; i < arguments.length; i++) {
            args[i] = arguments[i];
        }
        var className = objectClass[name];
        if (className) {
            var proto = className["class"],
                poolArray = className.pool,
                obj;

            if (poolArray && ((obj = poolArray.pop()))) {
                // pull an existing instance from the pool
                args.shift();
                // call the object onResetEvent function if defined
                if (typeof(obj.onResetEvent) === "function") {
                    obj.onResetEvent.apply(obj, args);
                }
                instance_counter--;
            }
            else {
                // create a new instance
                args[0] = proto;
                obj = new (proto.bind.apply(proto, args))();
                if (poolArray) {
                    obj.className = name;
                }
            }
            return obj;
        }
        throw new Error("Cannot instantiate object of type '" + name + "'");
    },

    /**
     * purge the object pool from any inactive object <br>
     * Object pooling must be enabled for this function to work<br>
     * note: this will trigger the garbage collector
     * @function me.pool.purge
     */
    purge() {
        for (var className in objectClass) {
            if (objectClass[className]) {
                objectClass[className].pool = [];
            }
        }
        instance_counter = 0;
    },

    /**
     * Push back an object instance into the object pool <br>
     * Object pooling for the object class must be enabled,
     * and object must have been instantiated using {@link me.pool#pull},
     * otherwise this function won't work
     * @function me.pool.push
     * @throws will throw an error if the object cannot be recycled
     * @param {object} obj instance to be recycled
     * @param {boolean} [throwOnError=true] throw an exception if the object cannot be recycled
     * @returns {boolean} true if the object was successfully recycled in the object pool
     */
    push(obj, throwOnError = true) {
        if (!this.poolable(obj)) {
            if (throwOnError === true ) {
                throw new Error("me.pool: object " + obj + " cannot be recycled");
            } else {
                return false;
            }
        }

        // store back the object instance for later recycling
        objectClass[obj.className].pool.push(obj);
        instance_counter++;

        return true;
    },

    /**
     * Check if an object with the provided name is registered
     * @function me.pool.exists
     * @param {string} name of the registered object class
     * @returns {boolean} true if the classname is registered
     */
    exists(name) {
        return name in objectClass;
    },

    /**
     * Check if an object is poolable
     * (was properly registered with the recycling feature enable)
     * @function me.pool.poolable
     * @see me.pool.register
     * @param {object} obj object to be checked
     * @returns {boolean} true if the object is poolable
     * @example
     * if (!me.pool.poolable(myCherryEntity)) {
     *     // object was not properly registered
     * }
     */
    poolable(obj) {
        var className = obj.className;
        return (typeof className !== "undefined") &&
                (typeof obj.onResetEvent === "function") &&
                (className in objectClass) &&
                (objectClass[className].pool !== "undefined");

    },

    /**
     * returns the amount of object instance currently in the pool
     * @function me.pool.getInstanceCount
     * @returns {number} amount of object instance
     */
    getInstanceCount() {
        return instance_counter;
    }
};

export default pool;
