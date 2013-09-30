/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013 melonJS
 * http://www.melonjs.org
 *
 */

(function(window) {
    
    /** 
     * A singleton object to access the device local Storage area
     * @example
     * // Initialize "score" and "lives" with default values
     * me.save.init({ score : 0, lives : 3 });
     *
     * // Save score
     * me.save.score = 31337;
     *
     * // Load lives
     * console.log(me.save.lives);
     *
     * // Also supports complex objects thanks to JSON backend
     * me.save.complexObject = { a : "b", c : [ 1, 2, 3, "d" ], e : { f : [{}] } };
     *
     * // Print all
     * console.log(JSON.stringify(me.save));
     * @namespace me.save
     * @memberOf me
     */

    me.save = (function () {
        // Variable to hold the object data
        var data = {};

        // Load previous data
        var keys = JSON.parse(localStorage.getItem("me.save")) || [];
        keys.forEach(function (key) {
            data[key] = JSON.parse(localStorage.getItem("me.save." + key));
        });

        // a fucntion to check if the given key is a reserved word
        function isReserved (key) {
            return (key === "add" || key === "delete");
        }

        // Public API
        var api = {

            /**
             * add new keys to localStorage and set them to the given default values 
             * @name add
             * @memberOf me.save
             * @function
             * @param {Object} props key and corresponding values
             * @example
             * // Initialize "score" and "lives" with default values
             * me.save.init({ score : 0, lives : 3 });
             */
            add : function (props) {
                Object.keys(props).forEach(function (key) {
                    if (isReserved(key)) return;

                    (function (prop) {
                        Object.defineProperty(api, prop, {
                            enumerable : true,
                            get : function () {
                                return data[prop];
                            },
                            set : function (value) {
                                // don't overwrite if it was already defined
                                if (typeof data[prop] !== undefined) {
                                    data[prop] = value;
                                    localStorage.setItem("me.save." + prop, JSON.stringify(data[prop]));
                                }
                            }
                        });
                    })(key);

                    // Set default value for key
                    if (!(key in data)) {
                        api[key] = props[key];
                    }
                });
            },

            /**
             * remove a key from localStorage 
             * @name delete
             * @memberOf me.save
             * @function
             * @param {String} key key to be removed
             * @example
             * // remove the "hiscore" key from localStorage
             * me.save.delete("score");
             */
            delete : function (key) {
                if (isReserved(key)) return;
                localStorage.removeItem("me.save." + key);
            }
        };

        return api;

    })();
})(window);
