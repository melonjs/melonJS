/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * A pool of Object entity <br>
     * This object is used for object pooling - a technique that might speed up your game
     * if used properly. <br>
     * If some of your classes will be instantiated and removed a lot at a time, it is a
     * good idea to add the class to this entity pool. A separate pool for that class
     * will be created, which will reuse objects of the class. That way they won't be instantiated
     * each time you need a new one (slowing your game), but stored into that pool and taking one
     * already instantiated when you need it.<br><br>
     * This object is also used by the engine to instantiate objects defined in the map,
     * which means, that on level loading the engine will try to instantiate every object
     * found in the map, based on the user defined name in each Object Properties<br>
     * <img src="images/object_properties.png"/><br>
     * @namespace me.pool
     * @memberOf me
     */
    me.pool = (function () {
        // hold public stuff in our singleton
        var api = {};

        var entityClass = {};

        /*
         * PUBLIC STUFF
         */

        /**
         * Constructor
         * @ignore
         */
        api.init = function () {
            // add default entity object
            api.register("me.Entity", me.Entity);
            api.register("me.CollectableEntity", me.CollectableEntity);
            api.register("me.LevelEntity", me.LevelEntity);
            api.register("me.Tween", me.Tween, true);
            api.register("me.Color", me.Color, true);
            api.register("me.Particle", me.Particle, true);
            api.register("me.Sprite", me.Sprite);
            api.register("me.Vector2d", me.Vector2d, true);
            api.register("me.Glyph", me.Glyph, true);
            api.register("me.Matrix2d", me.Matrix2d, true);
        };

        /**
         * register an object to the pool. <br>
         * Pooling must be set to true if more than one such objects will be created. <br>
         * (note) If pooling is enabled, you shouldn't instantiate objects with `new`.
         * See examples in {@link me.pool#pull}
         * @name register
         * @memberOf me.pool
         * @public
         * @function
         * @param {String} className as defined in the Name field of the Object Properties (in Tiled)
         * @param {Object} class corresponding Class to be instantiated
         * @param {Boolean} [objectPooling=false] enables object pooling for the specified class
         * - speeds up the game by reusing existing objects
         * @example
         * // add our users defined entities in the entity pool
         * me.pool.register("playerspawnpoint", PlayerEntity);
         * me.pool.register("cherryentity", CherryEntity, true);
         * me.pool.register("heartentity", HeartEntity, true);
         * me.pool.register("starentity", StarEntity, true);
         */
         api.register = function (className, classObj, pooling) {
             if (typeof (classObj) !== "undefined") {
                 entityClass[className] = {
                     "class" : classObj,
                     "pool" : (pooling ? [] : undefined)
                 };
             } else {
                 throw new me.Error("Cannot register object '" + className + "', invalid class");
             }
         };

        /**
         * Pull a new instance of the requested object (if added into the object pool)
         * @name pull
         * @memberOf me.pool
         * @public
         * @function
         * @param {String} className as used in {@link me.pool.register}
         * @param {} [arguments...] arguments to be passed when instantiating/reinitializing the object
         * @return {Object} the instance of the requested object
         * @example
         * me.pool.register("player", PlayerEntity);
         * var player = me.pool.pull("player");
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
        api.pull = function (name) {
            var args = new Array(arguments.length);
            for (var i = 0; i < arguments.length; i++) {
                args[i] = arguments[i];
            }
            var entity = entityClass[name];
            if (entity) {
                var proto = entity["class"],
                    pool = entity.pool,
                    obj;

                if (pool && ((obj = pool.pop()))) {
                    args.shift();
                    // call the object onResetEvent function if defined
                    if (typeof(obj.onResetEvent) === "function") {
                        obj.onResetEvent.apply(obj, args);
                    }
                    else {
                        obj.init.apply(obj, args);
                    }
                }
                else {
                    args[0] = proto;
                    obj = new (proto.bind.apply(proto, args))();
                    if (pool) {
                        obj.className = name;
                    }
                }
                return obj;
            }

            throw new me.Error("Cannot instantiate entity of type '" + name + "'");
        };

        /**
         * purge the entity pool from any inactive object <br>
         * Object pooling must be enabled for this function to work<br>
         * note: this will trigger the garbage collector
         * @name purge
         * @memberOf me.pool
         * @public
         * @function
         */
        api.purge = function () {
            for (var className in entityClass) {
                if (entityClass[className]) {
                    entityClass[className].pool = [];
                }
            }
        };

        /**
         * Push back an object instance into the entity pool <br>
         * Object pooling for the object class must be enabled,
         * and object must have been instantiated using {@link me.pool#pull},
         * otherwise this function won't work
         * @name push
         * @memberOf me.pool
         * @public
         * @function
         * @param {Object} instance to be recycled
         */
        api.push = function (obj) {
            var name = obj.className;
            if (typeof(name) === "undefined" || !entityClass[name]) {
                // object is not registered, don't do anything
                return;
            }
            // store back the object instance for later recycling
            entityClass[name].pool.push(obj);
        };

        /**
         * Check if an object with the provided name is registered
         * @name exists
         * @memberOf me.pool
         * @public
         * @function
         * @param {String} name of the registered object
         * @return {Boolean} true if the classname is registered
         */
        api.exists = function (name) {
            return name in entityClass;
        };

        // return our object
        return api;
    })();
})();
