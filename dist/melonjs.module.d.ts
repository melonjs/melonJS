declare module "utils/string" {
    /**
     * a collection of string utility functions
     * @namespace utils.string
     */
    /**
     * converts the first character of the given string to uppercase
     * @public
     * @memberof utils.string
     * @name capitalize
     * @param {string} str the string to be capitalized
     * @returns {string} the capitalized string
     */
    export function capitalize(str: string): string;
    /**
     * returns true if the given string contains a numeric integer or float value
     * @public
     * @memberof utils.string
     * @name isNumeric
     * @param {string} str the string to be tested
     * @returns {boolean} true if string contains only digits
     */
    export function isNumeric(str: string): boolean;
    /**
     * returns true if the given string contains a true or false
     * @public
     * @memberof utils.string
     * @name isBoolean
     * @param {string} str the string to be tested
     * @returns {boolean} true if the string is either true or false
     */
    export function isBoolean(str: string): boolean;
    /**
     * convert a string to the corresponding hexadecimal value
     * @public
     * @memberof utils.string
     * @name toHex
     * @param {string} str the string to be converted
     * @returns {string} the converted hexadecimal value
     */
    export function toHex(str: string): string;
    /**
     * returns true if the given string is a data url in the `data:[<mediatype>][;base64],<data>` format.
     * (this will not test the validity of the Data or Base64 encoding)
     * @public
     * @memberof utils.string
     * @name isDataUrl
     * @param {string} str the string (url) to be tested
     * @returns {boolean} true if the string is a data url
     */
    export function isDataUrl(str: string): boolean;
}
declare module "utils/agent" {
    /**
     * Get a vendor-prefixed property
     * @public
     * @name prefixed
     * @param {string} name Property name
     * @param {object} [obj=globalThis] Object or element reference to access
     * @returns {string} Value of property
     * @memberof utils.agent
     */
    export function prefixed(name: string, obj?: object): string;
    /**
     * Set a vendor-prefixed property
     * @public
     * @name setPrefixed
     * @param {string} name Property name
     * @param {string} value Property value
     * @param {object} [obj=globalThis] Object or element reference to access
     * @returns {boolean} true if one of the vendor-prefixed property was found
     * @memberof utils.agent
     */
    export function setPrefixed(name: string, value: string, obj?: object): boolean;
}
declare module "math/math" {
    /**
     * returns true if the given value is a power of two
     * @public
     * @memberof Math
     * @name isPowerOfTwo
     * @param {number} val
     * @returns {boolean}
     */
    export function isPowerOfTwo(val: number): boolean;
    /**
     * returns the next power of two for the given value
     * @public
     * @memberof Math
     * @name nextPowerOfTwo
     * @param {number} val
     * @returns {boolean}
     */
    export function nextPowerOfTwo(val: number): boolean;
    /**
     * Converts an angle in degrees to an angle in radians
     * @public
     * @memberof Math
     * @name degToRad
     * @param {number} angle angle in degrees
     * @returns {number} corresponding angle in radians
     * @example
     * // convert a specific angle
     * me.Math.degToRad(60); // return 1.0471...
     */
    export function degToRad(angle: number): number;
    /**
     * Converts an angle in radians to an angle in degrees.
     * @public
     * @memberof Math
     * @name radToDeg
     * @param {number} radians angle in radians
     * @returns {number} corresponding angle in degrees
     * @example
     * // convert a specific angle
     * me.Math.radToDeg(1.0471975511965976); // return 60
     */
    export function radToDeg(radians: number): number;
    /**
     * clamp the given value
     * @public
     * @memberof Math
     * @name clamp
     * @param {number} val the value to clamp
     * @param {number} low lower limit
     * @param {number} high higher limit
     * @returns {number} clamped value
     */
    export function clamp(val: number, low: number, high: number): number;
    /**
     * return a random integer between min (included) and max (excluded)
     * @public
     * @memberof Math
     * @name random
     * @param {number} min minimum value.
     * @param {number} max maximum value.
     * @returns {number} random value
     * @example
     * // Print a random number; one of 5, 6, 7, 8, 9
     * console.log(me.Math.random(5, 10) );
     */
    export function random(min: number, max: number): number;
    /**
     * return a random float between min, max (exclusive)
     * @public
     * @memberof Math
     * @name randomFloat
     * @param {number} min minimum value.
     * @param {number} max maximum value.
     * @returns {number} random value
     * @example
     * // Print a random number; one of 5, 6, 7, 8, 9
     * console.log(me.Math.randomFloat(5, 10) );
     */
    export function randomFloat(min: number, max: number): number;
    /**
     * return a weighted random between min, max (exclusive)
     * @public
     * @memberof Math
     * @name weightedRandom
     * @param {number} min minimum value.
     * @param {number} max maximum value.
     * @returns {number} random value
     * @example
     * // Print a random number; one of 5, 6, 7, 8, 9
     * console.log(me.Math.weightedRandom(5, 10) );
     */
    export function weightedRandom(min: number, max: number): number;
    /**
     * round a value to the specified number of digit
     * @public
     * @memberof Math
     * @name round
     * @param {number} num value to be rounded.
     * @param {number} [dec=0] number of decimal digit to be rounded to.
     * @returns {number} rounded value
     * @example
     * // round a specific value to 2 digits
     * me.Math.round(10.33333, 2); // return 10.33
     */
    export function round(num: number, dec?: number): number;
    /**
     * check if the given value is close to the expected one
     * @public
     * @memberof Math
     * @name toBeCloseTo
     * @param {number} expected value to be compared with.
     * @param {number} actual actual value to compare
     * @param {number} [precision=2] float precision for the comparison
     * @returns {boolean} if close to
     * @example
     * // test if the given value is close to 10
     * if (me.Math.toBeCloseTo(10, value)) {
     *     // do something
     * }
     */
    export function toBeCloseTo(expected: number, actual: number, precision?: number): boolean;
    /**
     * a collection of math utility functions
     * @namespace Math
     */
    /**
     * constant to convert from degrees to radians
     * @public
     * @type {number}
     * @name DEG_TO_RAD
     * @memberof Math
     */
    export const DEG_TO_RAD: number;
    /**
     * constant to convert from radians to degrees
     * @public
     * @type {number}
     * @name RAD_TO_DEG
     * @memberof Math
     */
    export const RAD_TO_DEG: number;
    /**
     * constant equals to 2 times pi
     * @public
     * @type {number}
     * @name TAU
     * @memberof Math
     */
    export const TAU: number;
    /**
     * constant equals to half pi
     * @public
     * @type {number}
     * @name ETA
     * @memberof Math
     */
    export const ETA: number;
    /**
     * the difference between 1 and the smallest floating point number greater than 1
     * @public
     * @type {number}
     * @name EPSILON
     * @memberof Math
     */
    export const EPSILON: number;
}
declare module "utils/array" {
    /**
     * a collection of array utility functions
     * @namespace utils.array
     */
    /**
     * Remove the specified object from the given Array
     * @public
     * @memberof utils.array
     * @name remove
     * @param {Array} arr array from which to remove an object
     * @param {object} obj to be removed
     * @returns {Array} the modified Array
     * var arr = [ "foo", "bar", "baz" ];
     * // remove "foo" from the array
     * me.utils.array.remove(arr, "foo");
     */
    export function remove(arr: any[], obj: object): any[];
    /**
     * return a random array element
     * @public
     * @memberof utils.array
     * @name random
     * @param {Array} arr array to pick a element
     * @returns {any} random member of array
     * @example
     * // Select a random array element
     * var arr = [ "foo", "bar", "baz" ];
     * console.log(me.utils.array.random(arr));
     */
    export function random(arr: any[]): any;
    /**
     * return a weighted random array element, favoring the earlier entries
     * @public
     * @memberof utils.array
     * @name weightedRandom
     * @param {Array} arr array to pick a element
     * @returns {any} random member of array
     */
    export function weightedRandom(arr: any[]): any;
}
declare module "utils/file" {
    /**
     * return the base name of the file without path info
     * @public
     * @memberof utils.file
     * @name getBasename
     * @param  {string} path path containing the filename
     * @returns {string} the base name without path information.
     */
    export function getBasename(path: string): string;
    /**
     * return the extension of the file in the given path
     * @public
     * @memberof utils.file
     * @name getExtension
     * @param  {string} path path containing the filename
     * @returns {string} filename extension.
     */
    export function getExtension(path: string): string;
}
declare module "utils/function" {
    /**
     * a collection of utility functions
     * @namespace utils.function
     */
    /**
     * Executes a function as soon as the interpreter is idle (stack empty).
     * @public
     * @memberof utils.function
     * @name defer
     * @param {Function} func The function to be deferred.
     * @param {object} thisArg The value to be passed as the this parameter to the target function when the deferred function is called
     * @param {...*} args Optional additional arguments to carry for the function.
     * @returns {number} id that can be used to clear the deferred function using
     * clearTimeout
     * @example
     * // execute myFunc() when the stack is empty,
     * // with the current context and [1, 2, 3] as parameter
     * me.utils.function.defer(myFunc, this, 1, 2, 3);
     */
    export function defer(func: Function, thisArg: object, ...args: any[]): number;
    /**
     * returns a function that, when invoked will only be triggered at most
     * once during a given window of time
     * @public
     * @memberof utils.function
     * @name throttle
     * @param {Function} fn the function to be throttled.
     * @param {number} delay The delay in ms
     * @param {no_trailing} no_trailing disable the execution on the trailing edge
     * @returns {Function} the function that will be throttled
     */
    export function throttle(fn: Function, delay: number, no_trailing: any): Function;
}
declare module "system/pooling" {
    export default pool;
    var pool: ObjectPool;
    /**
     * @classdesc
     * Object pooling - a technique that might speed up your game if used properly.<br>
     * If some of your classes will be instantiated and removed a lot at a time, it is a
     * good idea to add the class to this object pool. A separate pool for that class
     * will be created, which will reuse objects of the class. That way they won't be instantiated
     * each time you need a new one (slowing your game), but stored into that pool and taking one
     * already instantiated when you need it.<br><br>
     * This technique is also used by the engine to instantiate objects defined in the map,
     * which means, that on level loading the engine will try to instantiate every object
     * found in the map, based on the user defined name in each Object Properties<br>
     * <img src="images/object_properties.png"/><br>
     * @see {@link pool} the default global instance of ObjectPool
     */
    class ObjectPool {
        objectClass: {};
        instance_counter: number;
        /**
         * register an object to the pool. <br>
         * Pooling must be set to true if more than one such objects will be created. <br>
         * (Note: for an object to be poolable, it must implements a `onResetEvent` method)
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
        register(className: string, classObj: object, recycling?: boolean): void;
        /**
         * Pull a new instance of the requested object (if added into the object pool)
         * @param {string} name as used in {@link pool.register}
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
        pull(name: string, ...args: any[]): object;
        /**
         * purge the object pool from any inactive object <br>
         * Object pooling must be enabled for this function to work<br>
         * note: this will trigger the garbage collector
         */
        purge(): void;
        /**
         * Push back an object instance into the object pool <br>
         * Object pooling for the object class must be enabled,
         * and object must have been instantiated using {@link pool#pull},
         * otherwise this function won't work
         * @throws will throw an error if the object cannot be recycled
         * @param {object} obj instance to be recycled
         * @param {boolean} [throwOnError=true] throw an exception if the object cannot be recycled
         * @returns {boolean} true if the object was successfully recycled in the object pool
         */
        push(obj: object, throwOnError?: boolean): boolean;
        /**
         * Check if an object with the provided name is registered
         * @param {string} name of the registered object class
         * @returns {boolean} true if the classname is registered
         */
        exists(name: string): boolean;
        /**
         * Check if an object is poolable
         * (was properly registered with the recycling feature enable)
         * @see register
         * @param {object} obj object to be checked
         * @returns {boolean} true if the object is poolable
         * @example
         * if (!me.pool.poolable(myCherryEntity)) {
         *     // object was not properly registered
         * }
         */
        poolable(obj: object): boolean;
        /**
         * returns the amount of object instance currently in the pool
         * @returns {number} amount of object instance
         */
        getInstanceCount(): number;
    }
}
declare module "math/vector2" {
    export default Vector2d;
    /**
     * @classdesc
     * a generic 2D Vector Object
     */
    class Vector2d {
        /**
         * @param {number} [x=0] x value of the vector
         * @param {number} [y=0] y value of the vector
         */
        constructor(x?: number, y?: number);
        /**
         * @ignore
         */
        onResetEvent(x?: number, y?: number): Vector2d;
        x: any;
        y: any;
        /**
         * @ignore
         */
        _set(x: any, y: any): Vector2d;
        /**
         * set the Vector x and y properties to the given values<br>
         * @name set
         * @memberof Vector2d
         * @param {number} x
         * @param {number} y
         * @returns {Vector2d} Reference to this object for method chaining
         */
        set(x: number, y: number): Vector2d;
        /**
         * set the Vector x and y properties to 0
         * @name setZero
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        setZero(): Vector2d;
        /**
         * set the Vector x and y properties using the passed vector
         * @name setV
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        setV(v: Vector2d): Vector2d;
        /**
         * Add the passed vector to this vector
         * @name add
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        add(v: Vector2d): Vector2d;
        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        sub(v: Vector2d): Vector2d;
        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberof Vector2d
         * @param {number} x
         * @param {number} [y=x]
         * @returns {Vector2d} Reference to this object for method chaining
         */
        scale(x: number, y?: number): Vector2d;
        /**
         * Convert this vector into isometric coordinate space
         * @name toIso
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        toIso(): Vector2d;
        /**
         * Convert this vector into 2d coordinate space
         * @name to2d
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        to2d(): Vector2d;
        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        scaleV(v: Vector2d): Vector2d;
        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberof Vector2d
         * @param {number} n the value to divide the vector by
         * @returns {Vector2d} Reference to this object for method chaining
         */
        div(n: number): Vector2d;
        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        abs(): Vector2d;
        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberof Vector2d
         * @param {number} low
         * @param {number} high
         * @returns {Vector2d} new me.Vector2d
         */
        clamp(low: number, high: number): Vector2d;
        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberof Vector2d
         * @param {number} low
         * @param {number} high
         * @returns {Vector2d} Reference to this object for method chaining
         */
        clampSelf(low: number, high: number): Vector2d;
        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        minV(v: Vector2d): Vector2d;
        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        maxV(v: Vector2d): Vector2d;
        /**
         * Floor the vector values
         * @name floor
         * @memberof Vector2d
         * @returns {Vector2d} new me.Vector2d
         */
        floor(): Vector2d;
        /**
         * Floor this vector values
         * @name floorSelf
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        floorSelf(): Vector2d;
        /**
         * Ceil the vector values
         * @name ceil
         * @memberof Vector2d
         * @returns {Vector2d} new me.Vector2d
         */
        ceil(): Vector2d;
        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        ceilSelf(): Vector2d;
        /**
         * Negate the vector values
         * @name negate
         * @memberof Vector2d
         * @returns {Vector2d} new me.Vector2d
         */
        negate(): Vector2d;
        /**
         * Negate this vector values
         * @name negateSelf
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        negateSelf(): Vector2d;
        /**
         * Copy the x,y values of the passed vector to this one
         * @name copy
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {Vector2d} Reference to this object for method chaining
         */
        copy(v: Vector2d): Vector2d;
        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberof Vector2d
         * @method
         * @param {Vector2d} v
         * @returns {boolean}
         */
        /**
         * return true if this vector is equal to the given values
         * @name equals
         * @memberof Vector2d
         * @param {number} x
         * @param {number} y
         * @returns {boolean}
         */
        equals(...args: any[]): boolean;
        /**
         * normalize this vector (scale the vector so that its magnitude is 1)
         * @name normalize
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        normalize(): Vector2d;
        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction)
         * @name perp
         * @memberof Vector2d
         * @returns {Vector2d} Reference to this object for method chaining
         */
        perp(): Vector2d;
        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof Vector2d
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around
         * @returns {Vector2d} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): Vector2d;
        /**
         * return the dot product of this vector and the passed one
         * @name dot
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {number} The dot product.
         */
        dot(v: Vector2d): number;
        /**
         * return the cross product of this vector and the passed one
         * @name cross
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {number} The cross product.
         */
        cross(v: Vector2d): number;
        /**
         * return the square length of this vector
         * @name length2
         * @memberof Vector2d
         * @returns {number} The length^2 of this vector.
         */
        length2(): number;
        /**
         * return the length (magnitude) of this vector
         * @name length
         * @memberof Vector2d
         * @returns {number} the length of this vector
         */
        length(): number;
        /**
         * Linearly interpolate between this vector and the given one.
         * @name lerp
         * @memberof Vector2d
         * @param {Vector2d} v
         * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
         * @returns {Vector2d} Reference to this object for method chaining
         */
        lerp(v: Vector2d, alpha: number): Vector2d;
        /**
         * interpolate the position of this vector towards the given one by the given maximum step.
         * @name moveTowards
         * @memberof Vector2d
         * @param {Vector2d} target
         * @param {number} step the maximum step per iteration (Negative values will push the vector away from the target)
         * @returns {Vector2d} Reference to this object for method chaining
         */
        moveTowards(target: Vector2d, step: number): Vector2d;
        /**
         * return the distance between this vector and the passed one
         * @name distance
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {number}
         */
        distance(v: Vector2d): number;
        /**
         * return the angle between this vector and the passed one
         * @name angle
         * @memberof Vector2d
         * @param {Vector2d} v
         * @returns {number} angle in radians
         */
        angle(v: Vector2d): number;
        /**
         * project this vector on to another vector.
         * @name project
         * @memberof Vector2d
         * @param {Vector2d} v The vector to project onto.
         * @returns {Vector2d} Reference to this object for method chaining
         */
        project(v: Vector2d): Vector2d;
        /**
         * Project this vector onto a vector of unit length.<br>
         * This is slightly more efficient than `project` when dealing with unit vectors.
         * @name projectN
         * @memberof Vector2d
         * @param {Vector2d} v The unit vector to project onto.
         * @returns {Vector2d} Reference to this object for method chaining
         */
        projectN(v: Vector2d): Vector2d;
        /**
         * return a clone copy of this vector
         * @name clone
         * @memberof Vector2d
         * @returns {Vector2d} new me.Vector2d
         */
        clone(): Vector2d;
        /**
         * convert the object to a string representation
         * @name toString
         * @memberof Vector2d
         * @returns {string}
         */
        toString(): string;
    }
}
declare module "math/color" {
    export default Color;
    /**
     * @classdesc
     * A color manipulation object.
     */
    class Color {
        /**
         * @param {number} [r=0] red component or array of color components
         * @param {number} [g=0] green component
         * @param {number} [b=0] blue component
         * @param {number} [alpha=1.0] alpha value
         */
        constructor(r?: number, g?: number, b?: number, alpha?: number);
        /**
         * @ignore
         */
        onResetEvent(r?: number, g?: number, b?: number, alpha?: number): Color;
        glArray: Float32Array;
        set r(arg: number);
        /**
         * Color Red Component [0 .. 255]
         * @type {number}
         */
        get r(): number;
        set g(arg: number);
        /**
         * Color Green Component [0 .. 255]
         * @type {number}
         */
        get g(): number;
        set b(arg: number);
        /**
         * Color Blue Component [0 .. 255]
         * @type {number}
         */
        get b(): number;
        set alpha(arg: number);
        /**
         * Color Alpha Component [0.0 .. 1.0]
         * @type {number}
         */
        get alpha(): number;
        /**
         * Set this color to the specified value.
         * @param {number} r red component [0 .. 255]
         * @param {number} g green component [0 .. 255]
         * @param {number} b blue component [0 .. 255]
         * @param {number} [alpha=1.0] alpha value [0.0 .. 1.0]
         * @returns {Color} Reference to this object for method chaining
         */
        setColor(r: number, g: number, b: number, alpha?: number): Color;
        /**
         * set this color to the specified HSV value
         * @param {number} h hue (a value from 0 to 1)
         * @param {number} s saturation (a value from 0 to 1)
         * @param {number} v value (a value from 0 to 1)
         * @returns {Color} Reference to this object for method chaining
         */
        setHSV(h: number, s: number, v: number): Color;
        /**
         * set this color to the specified HSL value
         * @param {number} h hue (a value from 0 to 1)
         * @param {number} s saturation (a value from 0 to 1)
         * @param {number} l lightness (a value from 0 to 1)
         * @returns {Color} Reference to this object for method chaining
         */
        setHSL(h: number, s: number, l: number): Color;
        /**
         * Create a new copy of this color object.
         * @returns {Color} Reference to the newly cloned object
         */
        clone(): Color;
        /**
         * Copy a color object or CSS color into this one.
         * @param {Color|string} color
         * @returns {Color} Reference to this object for method chaining
         */
        copy(color: Color | string): Color;
        /**
         * Blend this color with the given one using addition.
         * @param {Color} color
         * @returns {Color} Reference to this object for method chaining
         */
        add(color: Color): Color;
        /**
         * Darken this color value by 0..1
         * @param {number} scale
         * @returns {Color} Reference to this object for method chaining
         */
        darken(scale: number): Color;
        /**
         * Linearly interpolate between this color and the given one.
         * @param {Color} color
         * @param {number} alpha with alpha = 0 being this color, and alpha = 1 being the given one.
         * @returns {Color} Reference to this object for method chaining
         */
        lerp(color: Color, alpha: number): Color;
        /**
         * Lighten this color value by 0..1
         * @param {number} scale
         * @returns {Color} Reference to this object for method chaining
         */
        lighten(scale: number): Color;
        /**
         * Generate random r,g,b values for this color object
         * @param {number} [min=0] minimum value for the random range
         * @param {number} [max=255] maxmium value for the random range
         * @returns {Color} Reference to this object for method chaining
         */
        random(min?: number, max?: number): Color;
        /**
         * Return true if the r,g,b,a values of this color are equal with the
         * given one.
         * @param {Color} color
         * @returns {boolean}
         */
        equals(color: Color): boolean;
        /**
         * Parse a CSS color string and set this color to the corresponding
         * r,g,b values
         * @param {string} cssColor
         * @returns {Color} Reference to this object for method chaining
         */
        parseCSS(cssColor: string): Color;
        /**
         * Parse an RGB or RGBA CSS color string
         * @param {string} rgbColor
         * @returns {Color} Reference to this object for method chaining
         */
        parseRGB(rgbColor: string): Color;
        /**
         * Parse a Hex color ("#RGB", "#RGBA" or "#RRGGBB", "#RRGGBBAA" format) and set this color to
         * the corresponding r,g,b,a values
         * @param {string} hexColor
         * @param {boolean} [argb = false] true if format is #ARGB, or #AARRGGBB (as opposed to #RGBA or #RGGBBAA)
         * @returns {Color} Reference to this object for method chaining
         */
        parseHex(hexColor: string, argb?: boolean): Color;
        /**
         * Pack this color into a Uint32 ARGB representation
         * @param {number} [alpha=1.0] alpha value [0.0 .. 1.0]
         * @returns {number}
         */
        toUint32(alpha?: number): number;
        /**
         * return an array representation of this object
         * @returns {Float32Array}
         */
        toArray(): Float32Array;
        /**
         * return the color in "#RRGGBB" format
         * @returns {string}
         */
        toHex(): string;
        /**
         * Get the color in "#RRGGBBAA" format
         * @returns {string}
         */
        toHex8(alpha?: number): string;
        /**
         * Get the color in "rgb(R,G,B)" format
         * @returns {string}
         */
        toRGB(): string;
        /**
         * Get the color in "rgba(R,G,B,A)" format
         * @param {number} [alpha=1.0] alpha value [0.0 .. 1.0]
         * @returns {string}
         */
        toRGBA(alpha?: number): string;
    }
}
declare module "math/matrix3" {
    export default Matrix3d;
    /**
     * @classdesc
     * a 4x4 Matrix3d Object
     */
    class Matrix3d {
        /**
         * @param {(Matrix3d|...number)} args An instance of me.Matrix3d to copy from, or individual Matrix components (See {@link Matrix3d.setTransform}). If not arguments are given, the matrix will be set to Identity.
         */
        constructor(...args: any[]);
        /**
         * @ignore
         */
        onResetEvent(...args: any[]): void;
        val: Float32Array;
        /**
         * tx component of the matrix
         * @public
         * @type {number}
         * @name tx
         * @memberof Matrix3d
         */
        public get tx(): number;
        /**
         * ty component of the matrix
         * @public
         * @type {number}
         * @name ty
         * @memberof Matrix3d
         */
        public get ty(): number;
        /**
         * ty component of the matrix
         * @public
         * @type {number}
         * @name tz
         * @memberof Matrix3d
         */
        public get tz(): number;
        /**
         * reset the transformation matrix to the identity matrix (no transformation).<br>
         * the identity matrix and parameters position : <br>
         * <img src="images/identity-matrix_2x.png"/>
         * @name identity
         * @memberof Matrix3d
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        identity(): Matrix3d;
        /**
         * set the matrix to the specified value
         * @name setTransform
         * @memberof Matrix3d
         * @param {number} m00
         * @param {number} m01
         * @param {number} m02
         * @param {number} m03
         * @param {number} m10
         * @param {number} m11
         * @param {number} m12
         * @param {number} m13
         * @param {number} m20
         * @param {number} m21
         * @param {number} m22
         * @param {number} m23
         * @param {number} m30
         * @param {number} m31
         * @param {number} m32
         * @param {number} m33
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        setTransform(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number): Matrix3d;
        /**
         * Copies over the values from another me.Matrix3d.
         * @name copy
         * @memberof Matrix3d
         * @param {Matrix3d} m the matrix object to copy from
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        copy(m: Matrix3d): Matrix3d;
        /**
         * Copies over the upper-left 2x2 values from the given me.Matrix2d
         * @name fromMat2d
         * @memberof Matrix3d
         * @param {Matrix2d} m the matrix object to copy from
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        fromMat2d(m: Matrix2d): Matrix2d;
        /**
         * multiply both matrix
         * @name multiply
         * @memberof Matrix3d
         * @param {Matrix3d} m Other matrix
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        multiply(m: Matrix3d): Matrix3d;
        /**
         * Transpose the value of this matrix.
         * @name transpose
         * @memberof Matrix3d
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        transpose(): Matrix3d;
        /**
         * invert this matrix, causing it to apply the opposite transformation.
         * @name invert
         * @memberof Matrix3d
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        invert(): Matrix3d;
        /**
         * apply the current transform to the given 2d or 3d vector
         * @name apply
         * @memberof Matrix3d
         * @param {Vector2d|Vector3d} v the vector object to be transformed
         * @returns {Vector2d|Vector3d} result vector object.
         */
        apply(v: Vector2d | Vector3d): Vector2d | Vector3d;
        /**
         * apply the inverted current transform to the given 2d or 3d vector
         * @name applyInverse
         * @memberof Matrix3d
         * @param {Vector2d|Vector3d} v the vector object to be transformed
         * @returns {Vector2d|Vector3d} result vector object.
         */
        applyInverse(v: Vector2d | Vector3d): Vector2d | Vector3d;
        /**
         * generate an orthogonal projection matrix, with the result replacing the current matrix
         * <img src="images/glOrtho.gif"/><br>
         * @name ortho
         * @memberof Matrix3d
         * @param {number} left farthest left on the x-axis
         * @param {number} right farthest right on the x-axis
         * @param {number} bottom farthest down on the y-axis
         * @param {number} top farthest up on the y-axis
         * @param {number} near distance to the near clipping plane along the -Z axis
         * @param {number} far distance to the far clipping plane along the -Z axis
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix3d;
        /**
         * scale the matrix
         * @name scale
         * @memberof Matrix3d
         * @param {number} x a number representing the abscissa of the scaling vector.
         * @param {number} [y=x] a number representing the ordinate of the scaling vector.
         * @param {number} [z=0] a number representing the depth vector
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        scale(x: number, y?: number, z?: number): Matrix3d;
        /**
         * adds a 2D scaling transformation.
         * @name scaleV
         * @memberof Matrix3d
         * @param {Vector2d|Vector3d} v scaling vector
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        scaleV(v: Vector2d | Vector3d): Matrix3d;
        /**
         * specifies a 2D scale operation using the [sx, 1] scaling vector
         * @name scaleX
         * @memberof Matrix3d
         * @param {number} x x scaling vector
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        scaleX(x: number): Matrix3d;
        /**
         * specifies a 2D scale operation using the [1,sy] scaling vector
         * @name scaleY
         * @memberof Matrix3d
         * @param {number} y y scaling vector
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        scaleY(y: number): Matrix3d;
        /**
         * rotate this matrix (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof Matrix3d
         * @param {number} angle Rotation angle in radians.
         * @param {Vector3d} v the axis to rotate around
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        rotate(angle: number, v: Vector3d): Matrix3d;
        /**
         * translate the matrix position using the given vector
         * @name translate
         * @memberof Matrix3d
         * @method
         * @param {number} x a number representing the abscissa of the vector.
         * @param {number} [y=x] a number representing the ordinate of the vector.
         * @param {number} [z=0] a number representing the depth of the vector
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        /**
         * translate the matrix by a vector on the horizontal and vertical axis
         * @name translateV
         * @memberof Matrix3d
         * @param {Vector2d|Vector3d} v the vector to translate the matrix by
         * @returns {Matrix3d} Reference to this object for method chaining
         */
        translate(...args: any[]): Matrix3d;
        /**
         * returns true if the matrix is an identity matrix.
         * @name isIdentity
         * @memberof Matrix3d
         * @returns {boolean}
         */
        isIdentity(): boolean;
        /**
         * return true if the two matrices are identical
         * @name equals
         * @memberof Matrix3d
         * @param {Matrix3d} m the other matrix
         * @returns {boolean} true if both are equals
         */
        equals(m: Matrix3d): boolean;
        /**
         * Clone the Matrix
         * @name clone
         * @memberof Matrix3d
         * @returns {Matrix3d}
         */
        clone(): Matrix3d;
        /**
         * return an array representation of this Matrix
         * @name toArray
         * @memberof Matrix3d
         * @returns {Float32Array}
         */
        toArray(): Float32Array;
        /**
         * convert the object to a string representation
         * @name toString
         * @memberof Matrix3d
         * @returns {string}
         */
        toString(): string;
    }
}
declare module "math/matrix2" {
    export default Matrix2d;
    /**
     * @classdesc
     * a Matrix2d Object.<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     */
    class Matrix2d {
        /**
         * @param {(Matrix2d|Matrix3d|...number)} args an instance of me.Matrix2d or me.Matrix3d to copy from, or individual matrix components (See {@link Matrix2d.setTransform}). If not arguments are given, the matrix will be set to Identity.
         */
        constructor(...args: any[]);
        /**
         * @ignore
         */
        onResetEvent(...args: any[]): Matrix2d;
        val: Float32Array;
        /**
         * tx component of the matrix
         * @public
         * @type {number}
         * @see Matrix2d.translate
         * @name tx
         * @memberof Matrix2d
         */
        public get tx(): number;
        /**
         * ty component of the matrix
         * @public
         * @type {number}
         * @see Matrix2d.translate
         * @name ty
         * @memberof Matrix2d
         */
        public get ty(): number;
        /**
         * reset the transformation matrix to the identity matrix (no transformation).<br>
         * the identity matrix and parameters position : <br>
         * <img src="images/identity-matrix_2x.png"/>
         * @name identity
         * @memberof Matrix2d
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        identity(): Matrix2d;
        /**
         * set the matrix to the specified value
         * @name setTransform
         * @memberof Matrix2d
         * @param {number} a
         * @param {number} b
         * @param {number} c
         * @param {number} d
         * @param {number} e
         * @param {number} f
         * @param {number} [g=0]
         * @param {number} [h=0]
         * @param {number} [i=1]
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        setTransform(...args: any[]): Matrix2d;
        /**
         * Copies over the values from another me.Matrix2d.
         * @name copy
         * @memberof Matrix2d
         * @param {Matrix2d} m the matrix object to copy from
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        copy(m: Matrix2d): Matrix2d;
        /**
         * Copies over the upper-left 3x3 values from the given me.Matrix3d
         * @name fromMat3d
         * @memberof Matrix2d
         * @param {Matrix3d} m the matrix object to copy from
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        fromMat3d(m: Matrix3d): Matrix2d;
        /**
         * multiply both matrix
         * @name multiply
         * @memberof Matrix2d
         * @param {Matrix2d} m the other matrix
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        multiply(m: Matrix2d): Matrix2d;
        /**
         * Transpose the value of this matrix.
         * @name transpose
         * @memberof Matrix2d
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        transpose(): Matrix2d;
        /**
         * invert this matrix, causing it to apply the opposite transformation.
         * @name invert
         * @memberof Matrix2d
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        invert(): Matrix2d;
        /**
         * apply the current transform to the given 2d or 3d vector
         * @name apply
         * @memberof Matrix2d
         * @param {Vector2d|Vector3d} v the vector object to be transformed
         * @returns {Vector2d|Vector3d} result vector object.
         */
        apply(v: Vector2d | Vector3d): Vector2d | Vector3d;
        /**
         * apply the inverted current transform to the given 2d vector
         * @name applyInverse
         * @memberof Matrix2d
         * @param {Vector2d} v the vector object to be transformed
         * @returns {Vector2d} result vector object.
         */
        applyInverse(v: Vector2d): Vector2d;
        /**
         * scale the matrix
         * @name scale
         * @memberof Matrix2d
         * @param {number} x a number representing the abscissa of the scaling vector.
         * @param {number} [y=x] a number representing the ordinate of the scaling vector.
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        scale(x: number, y?: number): Matrix2d;
        /**
         * adds a 2D scaling transformation.
         * @name scaleV
         * @memberof Matrix2d
         * @param {Vector2d} v scaling vector
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        scaleV(v: Vector2d): Matrix2d;
        /**
         * specifies a 2D scale operation using the [sx, 1] scaling vector
         * @name scaleX
         * @memberof Matrix2d
         * @param {number} x x scaling vector
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        scaleX(x: number): Matrix2d;
        /**
         * specifies a 2D scale operation using the [1,sy] scaling vector
         * @name scaleY
         * @memberof Matrix2d
         * @param {number} y y scaling vector
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        scaleY(y: number): Matrix2d;
        /**
         * rotate the matrix (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof Matrix2d
         * @param {number} angle Rotation angle in radians.
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        rotate(angle: number): Matrix2d;
        /**
         * translate the matrix position on the horizontal and vertical axis
         * @name translate
         * @memberof Matrix2d
         * @method
         * @param {number} x the x coordindates to translate the matrix by
         * @param {number} y the y coordindates to translate the matrix by
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        /**
         * translate the matrix by a vector on the horizontal and vertical axis
         * @name translateV
         * @memberof Matrix2d
         * @param {Vector2d} v the vector to translate the matrix by
         * @returns {Matrix2d} Reference to this object for method chaining
         */
        translate(...args: any[]): Matrix2d;
        /**
         * returns true if the matrix is an identity matrix.
         * @name isIdentity
         * @memberof Matrix2d
         * @returns {boolean}
         */
        isIdentity(): boolean;
        /**
         * return true if the two matrices are identical
         * @name equals
         * @memberof Matrix2d
         * @param {Matrix2d} m the other matrix
         * @returns {boolean} true if both are equals
         */
        equals(m: Matrix2d): boolean;
        /**
         * Clone the Matrix
         * @name clone
         * @memberof Matrix2d
         * @returns {Matrix2d}
         */
        clone(): Matrix2d;
        /**
         * return an array representation of this Matrix
         * @name toArray
         * @memberof Matrix2d
         * @returns {Float32Array}
         */
        toArray(): Float32Array;
        /**
         * convert the object to a string representation
         * @name toString
         * @memberof Matrix2d
         * @returns {string}
         */
        toString(): string;
    }
    import Matrix3d from "math/matrix3";
}
declare module "system/event" {
    /**
     * calls each of the listeners registered for a given event.
     * @function event.emit
     * @param {string|symbol} eventName The event name.
     * @param {object} [...arguments] arguments to be passed to all listeners
     * @returns {boolean} true if the event had listeners, false otherwise.
     * @example
     * me.event.emit("event-name", a, b, c);
     */
    export function emit(eventName: string | symbol, ...args: any[]): boolean;
    /**
     * Add a listener for a given event.
     * @function event.on
     * @param {string|symbol} eventName The event name.
     * @param {Function} listener The listener function.
     * @param {*} [context=this] The context to invoke the listener with.
     * @returns {EventEmitter} `this`.
     * @public
     * @example
     * me.event.on("event-name", myFunction, this);
     */
    export function on(eventName: string | symbol, listener: Function, context?: any): EventEmitter;
    /**
     * Add a one-time listener for a given event.
     * @function event.once
     * @param {string|symbol} eventName The event name.
     * @param {Function} listener The listener function.
     * @param {*} [context=this] The context to invoke the listener with.
     * @returns {EventEmitter} `this`.
     * @public
     * @example
     * me.event.once("event-name", myFunction, this);
     */
    export function once(eventName: string | symbol, listener: Function, context?: any): EventEmitter;
    /**
     * remove the given listener for a given event.
     * @function event.off
     * @param {string|symbol} eventName The event name.
     * @param {Function} listener The listener function.
     * @returns {EventEmitter} `this`.
     * @public
     * @example
     * me.event.off("event-name", myFunction);
     */
    export function off(eventName: string | symbol, listener: Function): EventEmitter;
    /**
     * event when the DOM is Ready is booting
     * @public
     * @constant
     * @type {string}
     * @name DOM_READY
     * @memberof event
     * @see event.on
     */
    export const DOM_READY: string;
    /**
     * event when the system is booting
     * @public
     * @constant
     * @type {string}
     * @name BOOT
     * @memberof event
     * @see event.on
     */
    export const BOOT: string;
    /**
     * event when the game is paused <br>
     * Data passed : none <br>
     * @public
     * @constant
     * @type {string}
     * @name STATE_PAUSE
     * @memberof event
     * @see event.on
     */
    export const STATE_PAUSE: string;
    /**
     * event for when the game is resumed <br>
     * Data passed : {number} time in ms the game was paused
     * @public
     * @constant
     * @type {string}
     * @name STATE_RESUME
     * @memberof event
     * @see event.on
     */
    export const STATE_RESUME: string;
    /**
     * event when the game is stopped <br>
     * Data passed : none <br>
     * @public
     * @constant
     * @type {string}
     * @name STATE_STOP
     * @memberof event
     * @see event.on
     */
    export const STATE_STOP: string;
    /**
     * event for when the game is restarted <br>
     * Data passed : {number} time in ms the game was stopped
     * @public
     * @constant
     * @type {string}
     * @name STATE_RESTART
     * @memberof event
     * @see event.on
     */
    export const STATE_RESTART: string;
    /**
     * event for when the changing to a different stage
     * @public
     * @constant
     * @type {string}
     * @name STATE_CHANGE
     * @memberof event
     * @see event.on
     */
    export const STATE_CHANGE: string;
    /**
     * event for when the video is initialized<br>
     * Data passed : none <br>
     * @public
     * @constant
     * @type {string}
     * @name VIDEO_INIT
     * @memberof event
     * @see video.init
     * @see event.on
     */
    export const VIDEO_INIT: string;
    /**
     * event for when the game manager is initialized <br>
     * Data passed : none <br>
     * @public
     * @constant
     * @type {string}
     * @name GAME_INIT
     * @memberof event
     * @see event.on
     */
    export const GAME_INIT: string;
    /**
     * event for when the game manager is resetted <br>
     * Data passed : none <br>
     * @public
     * @constant
     * @type {string}
     * @name GAME_RESET
     * @memberof event
     * @see event.on
     */
    export const GAME_RESET: string;
    /**
     * event for when the engine is about to start a new game loop
     * Data passed : {number} time the current time stamp
     * @public
     * @constant
     * @type {string}
     * @name GAME_BEFORE_UPDATE
     * @memberof event
     * @see event.on
     */
    export const GAME_BEFORE_UPDATE: string;
    /**
     * event for the end of the update loop
     * Data passed : {number} time the current time stamp
     * @public
     * @constant
     * @type {string}
     * @name GAME_AFTER_UPDATE
     * @memberof event
     * @see event.on
     */
    export const GAME_AFTER_UPDATE: string;
    /**
     * Event for when the game is updated (will be impacted by frame skip, frame interpolation and pause/resume state) <br>
     * Data passed : {number} time the current time stamp
     * @public
     * @constant
     * @type {string}
     * @name GAME_UPDATE
     * @memberof event
     * @see event.on
     */
    export const GAME_UPDATE: string;
    /**
     * Event for the end of the draw loop
     * Data passed : {number} time the current time stamp
     * @public
     * @constant
     * @type {string}
     * @name GAME_BEFORE_DRAW
     * @memberof event
     * @see event.on
     */
    export const GAME_BEFORE_DRAW: string;
    /**
     * Event for the start of the draw loop
     * Data passed : {number} time the current time stamp
     * @public
     * @constant
     * @type {string}
     * @name GAME_AFTER_DRAW
     * @memberof event
     * @see event.on
     */
    export const GAME_AFTER_DRAW: string;
    /**
     * Event for when a level is loaded <br>
     * Data passed : {string} Level Name
     * @public
     * @constant
     * @type {string}
     * @name LEVEL_LOADED
     * @memberof event
     * @see event.on
     */
    export const LEVEL_LOADED: string;
    /**
     * Event for when everything has loaded <br>
     * Data passed : none <br>
     * @public
     * @constant
     * @type {string}
     * @name LOADER_COMPLETE
     * @memberof event
     * @see event.on
     */
    export const LOADER_COMPLETE: string;
    /**
     * Event for displaying a load progress indicator <br>
     * Data passed : {number} [0 .. 1], {Resource} resource object<br>
     * @public
     * @constant
     * @type {string}
     * @name LOADER_PROGRESS
     * @memberof event
     * @see event.on
     */
    export const LOADER_PROGRESS: string;
    /**
     * Event for pressing a binded key <br>
     * Data passed : {string} user-defined action, {number} keyCode,
     * {boolean} edge state <br>
     * Edge-state is for detecting "locked" key bindings. When a locked key
     * is pressed and held, the first event will have the third argument
     * set true. Subsequent events will continue firing with the third
     * argument set false.
     * @public
     * @constant
     * @type {string}
     * @name KEYDOWN
     * @memberof event
     * @see event.on
     * @example
     * me.input.bindKey(me.input.KEY.X, "jump", true); // Edge-triggered
     * me.input.bindKey(me.input.KEY.Z, "shoot"); // Level-triggered
     * me.event.on(me.event.KEYDOWN, (action, keyCode, edge) => {
     *   // Checking bound keys
     *   if (action === "jump") {
     *       if (edge) {
     *           this.doJump();
     *       }
     *
     *       // Make character fall slower when holding the jump key
     *       this.vel.y = this.body.gravity;
     *   }
     * });
     */
    export const KEYDOWN: string;
    /**
     * Event for releasing a binded key <br>
     * Data passed : {string} user-defined action, {number} keyCode
     * @public
     * @constant
     * @type {string}
     * @name KEYUP
     * @memberof event
     * @see event.on
     * @example
     * me.event.on(me.event.KEYUP, (action, keyCode) => {
     *   // Checking unbound keys
     *   if (keyCode == me.input.KEY.ESC) {
     *       if (me.state.isPaused()) {
     *           me.state.resume();
     *       }
     *       else {
     *           me.state.pause();
     *       }
     *   }
     * });
     */
    export const KEYUP: string;
    /**
     * Event for when a gamepad is connected <br>
     * Data passed : {object} gamepad object
     * @public
     * @constant
     * @type {string}
     * @name GAMEPAD_CONNECTED
     * @memberof event
     * @see event.on
     */
    export const GAMEPAD_CONNECTED: string;
    /**
     * Event for when a gamepad is disconnected <br>
     * Data passed : {object} gamepad object
     * @public
     * @constant
     * @type {string}
     * @name GAMEPAD_DISCONNECTED
     * @memberof event
     * @see event.on
     */
    export const GAMEPAD_DISCONNECTED: string;
    /**
     * Event for when gamepad button/axis state is updated <br>
     * Data passed : {number} index <br>
     * Data passed : {string} type : "axes" or "buttons" <br>
     * Data passed : {number} button <br>
     * Data passed : {number} current.value <br>
     * Data passed : {boolean} current.pressed
     * @public
     * @constant
     * @type {string}
     * @name GAMEPAD_UPDATE
     * @memberof event
     * @see event.on
     */
    export const GAMEPAD_UPDATE: string;
    /**
     * Event for pointermove events on the screen area <br>
     * Data passed : {me.Pointer} a Pointer object
     * @public
     * @constant
     * @type {string}
     * @name POINTERMOVE
     * @memberof event
     * @see event.on
     */
    export const POINTERMOVE: string;
    /**
     * Event for onPointerLockChange event <br>
     * Data passed : {boolean} pointer lock status (true/false)
     * @public
     * @constant
     * @type {string}
     * @name POINTERLOCKCHANGE
     * @memberof event
     * @see event.on
     */
    export const POINTERLOCKCHANGE: string;
    /**
     * Event for dragstart events on a Draggable entity <br>
     * Data passed:
     * {object} the drag event <br>
     * {object} the Draggable entity
     * @public
     * @constant
     * @type {string}
     * @name DRAGSTART
     * @memberof event
     * @see event.on
     */
    export const DRAGSTART: string;
    /**
     * Event for dragend events on a Draggable entity <br>
     * Data passed:
     * {object} the drag event <br>
     * {object} the Draggable entity
     * @public
     * @constant
     * @type {string}
     * @name DRAGEND
     * @memberof event
     * @see event.on
     */
    export const DRAGEND: string;
    /**
     * Event for when the (browser) window is resized <br>
     * Data passed : {Event} Event object
     * @public
     * @constant
     * @type {string}
     * @name WINDOW_ONRESIZE
     * @memberof event
     * @see event.on
     */
    export const WINDOW_ONRESIZE: string;
    /**
     * Event for when the canvas is resized <br>
     * (this usually follows a WINDOW_ONRESIZE event).<br>
     * Data passed : {number} canvas width <br>
     * Data passed : {number} canvas height
     * @public
     * @constant
     * @type {string}
     * @name CANVAS_ONRESIZE
     * @memberof event
     * @see event.on
     */
    export const CANVAS_ONRESIZE: string;
    /**
     * Event for when the viewport is resized <br>
     * (this usually follows a WINDOW_ONRESIZE event, when using the `flex` scaling mode is used and after the viewport was updated).<br>
     * Data passed : {number} viewport width <br>
     * Data passed : {number} viewport height <br>
     * Data passed : {Camera2d} a reference to the camera viewport being resized
     * @public
     * @constant
     * @type {string}
     * @name VIEWPORT_ONRESIZE
     * @memberof event
     * @see event.on
     */
    export const VIEWPORT_ONRESIZE: string;
    /**
     * Event for when the device is rotated <br>
     * Data passed : {Event} Event object <br>
     * @public
     * @constant
     * @type {string}
     * @name WINDOW_ONORIENTATION_CHANGE
     * @memberof event
     * @see event.on
     */
    export const WINDOW_ONORIENTATION_CHANGE: string;
    /**
     * Event for when the (browser) window is scrolled <br>
     * Data passed : {Event} Event object
     * @public
     * @constant
     * @type {string}
     * @name WINDOW_ONSCROLL
     * @memberof event
     * @see event.on
     */
    export const WINDOW_ONSCROLL: string;
    /**
     * Event for when the viewport position is updated <br>
     * Data passed : {me.Vector2d} viewport position vector
     * @public
     * @constant
     * @type {string}
     * @name VIEWPORT_ONCHANGE
     * @memberof event
     * @see event.on
     */
    export const VIEWPORT_ONCHANGE: string;
    /**
     * Event for when the current context is lost <br>
     * Data passed : {me.Renderer} the current renderer instance
     * @public
     * @constant
     * @type {string}
     * @name WEBGL_ONCONTEXT_LOST
     * @memberof event
     * @see event.on
     */
    export const ONCONTEXT_LOST: string;
    /**
     * Event for when the current context is restored <br>
     * Data passed : {me.Renderer} the current renderer instance`
     * @public
     * @constant
     * @type {string}
     * @name ONCONTEXT_RESTORED
     * @memberof event
     * @see event.on
     */
    export const ONCONTEXT_RESTORED: string;
}
declare module "system/save" {
    export default save;
    namespace save {
        /**
         * Add new keys to localStorage and set them to the given default values if they do not exist
         * @name add
         * @memberof save
         * @param {object} props key and corresponding values
         * @example
         * // Initialize "score" and "lives" with default values
         * me.save.add({ score : 0, lives : 3 });
         * // get or set the value through me.save
         * me.save.score = 1000;
         */
        function add(props: any): void;
        /**
         * Add new keys to localStorage and set them to the given default values if they do not exist
         * @name add
         * @memberof save
         * @param {object} props key and corresponding values
         * @example
         * // Initialize "score" and "lives" with default values
         * me.save.add({ score : 0, lives : 3 });
         * // get or set the value through me.save
         * me.save.score = 1000;
         */
        function add(props: any): void;
        /**
         * Remove a key from localStorage
         * @name remove
         * @memberof save
         * @param {string} key key to be removed
         * @example
         * // Remove the "score" key from localStorage
         * me.save.remove("score");
         */
        function remove(key: string): void;
        /**
         * Remove a key from localStorage
         * @name remove
         * @memberof save
         * @param {string} key key to be removed
         * @example
         * // Remove the "score" key from localStorage
         * me.save.remove("score");
         */
        function remove(key: string): void;
    }
}
declare module "system/dom" {
    export function DOMContentLoaded(fn: any): void;
}
declare module "system/platform" {
    /**
     * The device platform type
     * @namespace platform
     * @memberof device
     * @property {string} ua the user agent string for the current device
     * @property {boolean} iOS `true` if the device is an iOS platform
     * @property {boolean} android `true` if the device is an Android platform
     * @property {boolean} android2 `true` if the device is an Android 2.x platform
     * @property {boolean} linux `true` if the device is a Linux platform
     * @property {boolean} chromeOS `true` if the device is running on ChromeOS.
     * @property {boolean} wp `true` if the device is a Windows Phone platform
     * @property {boolean} BlackBerry`true` if the device is a BlackBerry platform
     * @property {boolean} Kindle`true` if the device is a Kindle platform
     * @property {boolean} ejecta `true` if running under Ejecta
     * @property {boolean} isWeixin `true` if running under Wechat
     * @property {boolean} nodeJS `true` if running under node.js
     * @property {boolean} isMobile `true` if a mobile device
     */
    export const ua: string;
    export const iOS: boolean;
    export const android: boolean;
    export const android2: boolean;
    export const linux: boolean;
    export const chromeOS: boolean;
    export const wp: boolean;
    export const BlackBerry: boolean;
    export const Kindle: boolean;
    export const ejecta: boolean;
    export const isWeixin: boolean;
    export const nodeJS: boolean;
    export const isMobile: boolean;
}
declare module "system/device" {
    /**
     * used by [un]watchDeviceOrientation()
     */
    export function onDeviceRotate(e: any): void;
    /**
    * specify a function to execute when the Device is fully loaded and ready
    * @function onReady
    * @memberof device
    * @public
    * @param {Function} fn the function to be executed
    * @example
    * // small game skeleton
    * var game = {
    *    // called by the me.device.onReady function
    *    onload = function () {
    *       // init video
    *       if (!me.video.init('screen', 640, 480, true)) {
    *          alert("Sorry but your browser does not support html 5 canvas.");
    *          return;
    *       }
    *
    *       // initialize the "audio"
    *       me.audio.init("mp3,ogg");
    *
    *       // set callback for ressources loaded event
    *       me.loader.onload = this.loaded.bind(this);
    *
    *       // set all ressources to be loaded
    *       me.loader.preload(game.assets);
    *
    *       // load everything & display a loading screen
    *       me.state.change(me.state.LOADING);
    *    };
    *
    *    // callback when everything is loaded
    *    loaded = function () {
    *       // define stuff
    *       // ....
    *
    *       // change to the menu screen
    *       me.state.change(me.state.PLAY);
    *    }
    * }; // game
    *
    * // "bootstrap"
    * me.device.onReady(function () {
    *    game.onload();
    * });
    */
    export function onReady(fn: Function): void;
    /**
     * enable/disable swipe on WebView.
     * @function enableSwipe
     * @memberof device
     * @public
     * @param {boolean} [enable=true] enable or disable swipe.
     */
    export function enableSwipe(enable?: boolean): void;
    /**
     * Returns true if the browser/device is in full screen mode.
     * @function isFullscreen
     * @memberof device
     * @public
     * @returns {boolean}
     */
    export function isFullscreen(): boolean;
    /**
     * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
     * @function requestFullscreen
     * @memberof device
     * @public
     * @param {object} [element=default canvas object] the element to be set in full-screen mode.
     * @example
     * // add a keyboard shortcut to toggle Fullscreen mode on/off
     * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
     * me.event.on(me.event.KEYDOWN, function (action, keyCode, edge) {
     *    // toggle fullscreen on/off
     *    if (action === "toggleFullscreen") {
     *       me.device.requestFullscreen();
     *    } else {
     *       me.device.exitFullscreen();
     *    }
     * });
     */
    export function requestFullscreen(element?: object): void;
    /**
     * Exit fullscreen mode. Requires fullscreen support from the browser/device.
     * @function exitFullscreen
     * @memberof device
     * @public
     */
    export function exitFullscreen(): void;
    /**
     * Return a string representing the orientation of the device screen.
     * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
     * @function getScreenOrientation
     * @memberof device
     * @public
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
     * @returns {string} the screen orientation
     */
    export function getScreenOrientation(): string;
    /**
     * locks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function lockOrientation
     * @memberof device
     * @public
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @param {string|string[]} orientation The orientation into which to lock the screen.
     * @returns {boolean} true if the orientation was unsuccessfully locked
     */
    export function lockOrientation(orientation: string | string[]): boolean;
    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function unlockOrientation
     * @memberof device
     * @public
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @returns {boolean} true if the orientation was unsuccessfully unlocked
     */
    export function unlockOrientation(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function isPortrait
     * @memberof device
     * @public
     * @returns {boolean}
     */
    export function isPortrait(): boolean;
    /**
     * return true if the device screen orientation is in Portrait mode
     * @function isLandscape
     * @memberof device
     * @public
     * @returns {boolean}
     */
    export function isLandscape(): boolean;
    /**
     * return the device storage
     * @function getStorage
     * @memberof device
     * @public
     * @see save
     * @param {string} [type="local"]
     * @returns {object} a reference to the device storage
     */
    export function getStorage(type?: string): object;
    /**
     * return the parent DOM element for the given parent name or HTMLElement object
     * @function getParentElement
     * @memberof device
     * @public
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the parent Element
     */
    export function getParentElement(element: string | HTMLElement): HTMLElement;
    /**
     * return the DOM element for the given element name or HTMLElement object
     * @function getElement
     * @memberof device
     * @public
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the corresponding DOM Element or null if not existing
     */
    export function getElement(element: string | HTMLElement): HTMLElement;
    /**
     * returns the size of the given HTMLElement and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @function getElementBounds
     * @memberof device
     * @public
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the element relatively to the viewport
     */
    export function getElementBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns the size of the given HTMLElement Parent and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @function getParentBounds
     * @memberof device
     * @public
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the given element parent relative to the viewport
     */
    export function getParentBounds(element: string | HTMLElement): DOMRect;
    /**
     * returns true if the device supports WebGL
     * @function isWebGLSupported
     * @memberof device
     * @public
     * @param {object} [options] context creation options
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @returns {boolean} true if WebGL is supported
     */
    export function isWebGLSupported(options?: {
        failIfMajorPerformanceCaveat?: boolean;
    }): boolean;
    /**
     * return the highest precision format supported by this device for GL Shaders
     * @function getMaxShaderPrecision
     * @memberof device
     * @public
     * @param {WebGLRenderingContext} gl
     * @returns {boolean} "lowp", "mediump", or "highp"
     */
    export function getMaxShaderPrecision(gl: WebGLRenderingContext): boolean;
    /**
     * Makes a request to bring this device window to the front.
     * @function focus
     * @memberof device
     * @public
     * @example
     *  if (clicked) {
     *    me.device.focus();
     *  }
     */
    export function focus(): void;
    /**
     * Enable monitor of the device accelerator to detect the amount of physical force of acceleration the device is receiving.
     * (one some device a first user gesture will be required before calling this function)
     * @function watchAccelerometer
     * @memberof device
     * @public
     * @see device.accelerationX
     * @see device.accelerationY
     * @see device.accelerationZ
     * @link {http://www.mobilexweb.com/samples/ball.html}
     * @link {http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5}
     * @returns {boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device accelerometer event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchAccelerometer() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device accelerometer event
     *     }
     * });
     */
    export function watchAccelerometer(): boolean;
    /**
     * unwatch Accelerometor event
     * @function unwatchAccelerometer
     * @memberof device
     * @public
     */
    export function unwatchAccelerometer(): void;
    /**
     * Enable monitor of the device orientation to detect the current orientation of the device as compared to the Earth coordinate frame.
     * (one some device a first user gesture will be required before calling this function)
     * @function watchDeviceOrientation
     * @memberof device
     * @public
     * @see device.alpha
     * @see device.beta
     * @see device.gamma
     * @returns {boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device orientation event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchDeviceOrientation() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device orientation event
     *     }
     * });
     */
    export function watchDeviceOrientation(): boolean;
    /**
     * unwatch Device orientation event
     * @function unwatchDeviceOrientation
     * @memberof device
     * @public
     */
    export function unwatchDeviceOrientation(): void;
    /**
     * the vibrate method pulses the vibration hardware on the device, <br>
     * If the device doesn't support vibration, this method has no effect. <br>
     * If a vibration pattern is already in progress when this method is called,
     * the previous pattern is halted and the new one begins instead.
     * @function vibrate
     * @memberof device
     * @public
     * @param {number|number[]} pattern pattern of vibration and pause intervals
     * @example
     * // vibrate for 1000 ms
     * me.device.vibrate(1000);
     * // or alternatively
     * me.device.vibrate([1000]);
     * // vibrate for 50 ms, be still for 100 ms, and then vibrate for 150 ms:
     * me.device.vibrate([50, 100, 150]);
     * // cancel any existing vibrations
     * me.device.vibrate(0);
     */
    export function vibrate(pattern: number | number[]): void;
    /**
     * the device platform type
     * @name platform
     * @memberof device
     * @readonly
     * @public
     * @type {device.platform}
     */
    export let platform: device.platform;
    /**
     * True if the browser supports Touch Events
     * @name touchEvent
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const touchEvent: boolean;
    /**
     * True if the browser supports Pointer Events
     * @name pointerEvent
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const pointerEvent: boolean;
    /**
     * Touch capabilities (support either Touch or Pointer events)
     * @name touch
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const touch: boolean;
    /**
     * the maximum number of simultaneous touch contact points are supported by the current device.
     * @name maxTouchPoints
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @example
     * if (me.device.maxTouchPoints > 1) {
     *     // device supports multi-touch
     * }
     */
    export const maxTouchPoints: number;
    /**
     * W3C standard wheel events
     * @name wheel
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const wheel: boolean;
    /**
     * Browser pointerlock api support
     * @name hasPointerLockSupport
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const hasPointerLockSupport: boolean;
    /**
     * Browser device orientation
     * @name hasDeviceOrientation
     * @memberof device
     * @readonly
     * @public
     * @type {boolean}
     */
    export const hasDeviceOrientation: boolean;
    /**
     * Supports the ScreenOrientation API
     * @name screenOrientation
     * @memberof device
     * @see https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/onchange
     * @type {boolean}
     * @readonly
     * @public
     */
    export const screenOrientation: boolean;
    /**
     * Browser accelerometer capabilities
     * @name hasAccelerometer
     * @memberof device
     * @readonly
     * @public
     * @type {boolean}
     */
    export const hasAccelerometer: boolean;
    /**
     * Browser full screen support
     * @name hasFullscreenSupport
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const hasFullscreenSupport: boolean;
    /**
     * Device WebAudio Support
     * @name hasWebAudio
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const hasWebAudio: boolean;
    /**
     * Device HTML5Audio Support
     * @name hasHTML5Audio
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const hasHTML5Audio: boolean;
    /**
     * Returns true if the browser/device has audio capabilities.
     * @name sound
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const sound: boolean;
    /**
     * Browser Local Storage capabilities <br>
     * (this flag will be set to false if cookies are blocked)
     * @name localStorage
     * @memberof device
     * @readonly
     * @public
     * @type {boolean}
     */
    export const localStorage: boolean;
    /**
     * equals to true if the device browser supports OffScreenCanvas.
     * @name offscreenCanvas
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const offscreenCanvas: boolean;
    /**
     * Browser Base64 decoding capability
     * @name nativeBase64
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const nativeBase64: boolean;
    /**
     * a string representing the preferred language of the user, usually the language of the browser UI.
     * (will default to "en" if the information is not available)
     * @name language
     * @memberof device
     * @type {string}
     * @readonly
     * @public
     * @see http://www.w3schools.com/tags/ref_language_codes.asp
     */
    export const language: string;
    /**
     * Ratio of the resolution in physical pixels to the resolution in CSS pixels for the current display device.
     * @name devicePixelRatio
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     */
    export const devicePixelRatio: number;
    /**
     * equals to true if a mobile device.
     * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone | Kindle)
     * @name isMobile
     * @memberof device
     * @type {boolean}
     * @readonly
     * @public
     */
    export const isMobile: boolean;
    /**
     * contains the g-force acceleration along the x-axis.
     * @name accelerationX
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @see device.watchAccelerometer
     */
    export let accelerationX: number;
    /**
     * contains the g-force acceleration along the y-axis.
     * @name accelerationY
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @see device.watchAccelerometer
     */
    export let accelerationY: number;
    /**
     * contains the g-force acceleration along the z-axis.
     * @name accelerationZ
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @see device.watchAccelerometer
     */
    export let accelerationZ: number;
    /**
     * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
     * @name gamma
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @see device.watchDeviceOrientation
     */
    export let gamma: number;
    /**
     * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
     * @name beta
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @see device.watchDeviceOrientation
     */
    export let beta: number;
    /**
     * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis.
     * The z-axis is perpendicular to the phone, facing out from the center of the screen.
     * @name alpha
     * @memberof device
     * @type {number}
     * @readonly
     * @public
     * @see device.watchDeviceOrientation
     */
    export let alpha: number;
    /**
     * Specify whether to pause the game when losing focus
     * @name pauseOnBlur
     * @memberof device
     * @type {boolean}
     * @public
     * @default true
     */
    export let pauseOnBlur: boolean;
    /**
     * Specify whether to unpause the game when gaining focus
     * @name resumeOnFocus
     * @memberof device
     * @type {boolean}
     * @public
     * @default true
     */
    export let resumeOnFocus: boolean;
    /**
     * Specify whether to automatically bring the window to the front
     * @name autoFocus
     * @memberof device
     * @type {boolean}
     * @public
     * @default true
     */
    export let autoFocus: boolean;
    /**
     * Specify whether to stop the game when losing focus or not.
     * The engine restarts on focus if this is enabled.
     * @name stopOnBlur
     * @memberof device
     * @type {boolean}
     * @public
     * @default false
     */
    export let stopOnBlur: boolean;
}
declare module "video/webgl/utils/uniforms" {
    /**
     * @ignore
     */
    export function extractUniforms(gl: any, shader: any): {};
}
declare module "video/webgl/utils/attributes" {
    /**
     * @ignore
     */
    export function extractAttributes(gl: any, shader: any): {};
}
declare module "video/webgl/utils/program" {
    /**
     * Compile GLSL into a shader object
     * @ignore
     */
    export function compileProgram(gl: any, vertex: any, fragment: any, attributes: any): any;
}
declare module "video/webgl/utils/precision" {
    /**
     * set precision for the fiven shader source
     * won't do anything if the precision is already specified
     * @ignore
     */
    export function setPrecision(src: any, precision: any): any;
}
declare module "video/webgl/utils/string" {
    /**
     * clean the given source from space, comments, etc...
     * @ignore
     */
    export function minify(src: any): any;
}
declare module "video/webgl/glshader" {
    export default GLShader;
    /**
     * @classdesc
     * a base GL Shader object
     */
    class GLShader {
        /**
         * @param {WebGLRenderingContext} gl the current WebGL rendering context
         * @param {string} vertex a string containing the GLSL source code to set
         * @param {string} fragment a string containing the GLSL source code to set
         * @param {string} [precision=auto detected] float precision ('lowp', 'mediump' or 'highp').
         * @see https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/GLSL_Shaders
         * @example
         * // create a basic shader
         * var myShader = new me.GLShader(
         *    // WebGL rendering context
         *    gl,
         *    // vertex shader
         *    [
         *        "void main() {",
         *        "    gl_Position = doMathToMakeClipspaceCoordinates;",
         *        "}"
         *    ].join("\n"),
         *    // fragment shader
         *    [
         *        "void main() {",
         *        "    gl_FragColor = doMathToMakeAColor;",
         *        "}"
         *    ].join("\n")
         *  )
         * // use the shader
         * myShader.bind();
         */
        constructor(gl: WebGLRenderingContext, vertex: string, fragment: string, precision?: string);
        /**
         * the active gl rendering context
         * @type {WebGLRenderingContext}
         */
        gl: WebGLRenderingContext;
        /**
         * the vertex shader source code
         * @type {string}
         */
        vertex: string;
        /**
         * the fragment shader source code
         * @type {string}
         */
        fragment: string;
        /**
         * the location attributes of the shader
         * @type {GLint[]}
         */
        attributes: GLint[];
        /**
         * a reference to the shader program (once compiled)
         * @type {WebGLProgram}
         */
        program: WebGLProgram;
        /**
         * the uniforms of the shader
         * @type {object}
         */
        uniforms: object;
        /**
         * Installs this shader program as part of current rendering state
         */
        bind(): void;
        /**
         * returns the location of an attribute variable in this shader program
         * @param {string} name the name of the attribute variable whose location to get.
         * @returns {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
         */
        getAttribLocation(name: string): GLint;
        /**
         * Set the uniform to the given value
         * @param {string} name the uniform name
         * @param {object|Float32Array} value the value to assign to that uniform
         * @example
         * myShader.setUniform("uProjectionMatrix", this.projectionMatrix);
         */
        setUniform(name: string, value: object | Float32Array): void;
        /**
         * activate the given vertex attribute for this shader
         * @param {WebGLRenderingContext} gl the current WebGL rendering context
         * @param {object[]} attributes an array of vertex attributes
         * @param {number} vertexByteSize the size of a single vertex in bytes
         */
        setVertexAttributes(gl: WebGLRenderingContext, attributes: object[], vertexByteSize: number): void;
        /**
         * destroy this shader objects resources (program, attributes, uniforms)
         */
        destroy(): void;
    }
}
declare module "video/webgl/buffer/vertex" {
    export default VertexArrayBuffer;
    /**
     * @classdesc
     * a Vertex Buffer object
     * @class VertexArrayBuffer
     * @ignore
     */
    class VertexArrayBuffer {
        constructor(vertex_size: any, vertex_per_quad: any);
        vertexSize: any;
        quadSize: any;
        maxVertex: number;
        vertexCount: number;
        buffer: ArrayBuffer;
        bufferF32: Float32Array;
        bufferU32: Uint32Array;
        /**
         * clear the vertex array buffer
         * @ignore
         */
        clear(): void;
        /**
         * return true if full
         * @ignore
         */
        isFull(vertex?: any): boolean;
        /**
         * resize the vertex buffer, retaining its original contents
         * @ignore
         */
        resize(): VertexArrayBuffer;
        /**
         * push a new vertex to the buffer
         * @ignore
         */
        push(x: any, y: any, u: any, v: any, tint: any): VertexArrayBuffer;
        /**
         * return a reference to the data in Float32 format
         * @ignore
         */
        toFloat32(begin: any, end: any): Float32Array;
        /**
         * return a reference to the data in Uint32 format
         * @ignore
         */
        toUint32(begin: any, end: any): Uint32Array;
        /**
         * return the size of the vertex in vertex
         * @ignore
         */
        length(): number;
        /**
         * return true if empty
         * @ignore
         */
        isEmpty(): boolean;
    }
}
declare module "video/webgl/webgl_compositor" {
    export default WebGLCompositor;
    /**
     * @classdesc
     * A WebGL Compositor object. This class handles all of the WebGL state<br>
     * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
     */
    class WebGLCompositor {
        /**
         * @param {WebGLRenderer} renderer the current WebGL renderer session
         */
        constructor(renderer: WebGLRenderer);
        /**
         * Initialize the compositor
         * @ignore
         */
        init(renderer: any): void;
        currentTextureUnit: any;
        boundTextures: any[];
        renderer: any;
        gl: any;
        color: any;
        viewMatrix: any;
        /**
         * a reference to the active WebGL shader
         * @type {GLShader}
         */
        activeShader: GLShader;
        /**
         * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
         * @type {number}
         * @default gl.TRIANGLES
         */
        mode: number;
        /**
         * an array of vertex attribute properties
         * @see WebGLCompositor.addAttribute
         * @type {Array}
         */
        attributes: any[];
        /**
         * the size of a single vertex in bytes
         * (will automatically be calculated as attributes definitions are added)
         * @see WebGLCompositor.addAttribute
         * @type {number}
         */
        vertexByteSize: number;
        /**
         * the size of a single vertex in floats
         * (will automatically be calculated as attributes definitions are added)
         * @see WebGLCompositor.addAttribute
         * @type {number}
         */
        vertexSize: number;
        primitiveShader: GLShader;
        quadShader: GLShader;
        vertexBuffer: VertexArrayBuffer;
        /**
         * Reset compositor internal state
         * @ignore
         */
        reset(): void;
        /**
         * add vertex attribute property definition to the compositor
         * @param {string} name name of the attribute in the vertex shader
         * @param {number} size number of components per vertex attribute. Must be 1, 2, 3, or 4.
         * @param {GLenum} type data type of each component in the array
         * @param {boolean} normalized whether integer data values should be normalized into a certain range when being cast to a float
         * @param {number} offset offset in bytes of the first component in the vertex attribute array
         */
        addAttribute(name: string, size: number, type: GLenum, normalized: boolean, offset: number): void;
        /**
         * Sets the viewport
         * @param {number} x x position of viewport
         * @param {number} y y position of viewport
         * @param {number} w width of viewport
         * @param {number} h height of viewport
         */
        setViewport(x: number, y: number, w: number, h: number): void;
        /**
         * Create a WebGL texture from an image
         * @param {number} unit Destination texture unit
         * @param {Image|HTMLCanvasElement|ImageData|Uint8Array[]|Float32Array[]} image Source image
         * @param {number} filter gl.LINEAR or gl.NEAREST
         * @param {string} [repeat="no-repeat"] Image repeat behavior (see {@link ImageLayer#repeat})
         * @param {number} [w] Source image width (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {number} [h] Source image height (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {boolean} [premultipliedAlpha=true] Multiplies the alpha channel into the other color channels
         * @param {boolean} [mipmap=true] Whether mipmap levels should be generated for this texture
         * @returns {WebGLTexture} a WebGL texture
         */
        createTexture2D(unit: number, image: (new (width?: number, height?: number) => HTMLImageElement) | HTMLCanvasElement | ImageData | Uint8Array[] | Float32Array[], filter: number, repeat?: string, w?: number, h?: number, b?: number, premultipliedAlpha?: boolean, mipmap?: boolean): WebGLTexture;
        /**
         * delete the given WebGL texture
         * @param {WebGLTexture} [texture] a WebGL texture to delete
         * @param {number} [unit] Texture unit to delete
         */
        deleteTexture2D(texture?: WebGLTexture): void;
        /**
         * returns the WebGL texture associated to the given texture unit
         * @param {number} unit Texture unit to which a texture is bound
         * @returns {WebGLTexture} texture a WebGL texture
         */
        getTexture2D(unit: number): WebGLTexture;
        /**
         * assign the given WebGL texture to the current batch
         * @param {WebGLTexture} texture a WebGL texture
         * @param {number} unit Texture unit to which the given texture is bound
         */
        bindTexture2D(texture: WebGLTexture, unit: number): void;
        /**
         * unbind the given WebGL texture, forcing it to be reuploaded
         * @param {WebGLTexture} [texture] a WebGL texture
         * @param {number} [unit] a WebGL texture
         * @returns {number} unit the unit number that was associated with the given texture
         */
        unbindTexture2D(texture?: WebGLTexture, unit?: number): number;
        /**
         * @ignore
         */
        uploadTexture(texture: any, w: any, h: any, b: any, force?: boolean): any;
        /**
         * set/change the current projection matrix
         * @param {Matrix3d} matrix
         */
        setProjection(matrix: Matrix3d): void;
        /**
         * Select the shader to use for compositing
         * @see GLShader
         * @param {GLShader} shader a reference to a GLShader instance
         */
        useShader(shader: GLShader): void;
        /**
         * Add a textured quad
         * @param {TextureAtlas} texture Source texture atlas
         * @param {number} x Destination x-coordinate
         * @param {number} y Destination y-coordinate
         * @param {number} w Destination width
         * @param {number} h Destination height
         * @param {number} u0 Texture UV (u0) value.
         * @param {number} v0 Texture UV (v0) value.
         * @param {number} u1 Texture UV (u1) value.
         * @param {number} v1 Texture UV (v1) value.
         * @param {number} tint tint color to be applied to the texture in UINT32 (argb) format
         */
        addQuad(texture: TextureAtlas, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, tint: number): void;
        /**
         * Flush batched texture operations to the GPU
         * @param {number} [mode=gl.TRIANGLES] the GL drawing mode
         */
        flush(mode?: number): void;
        /**
         * Draw an array of vertices
         * @param {GLenum} mode primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
         * @param {Vector2d[]} verts vertices
         * @param {number} [vertexCount=verts.length] amount of points defined in the points array
         */
        drawVertices(mode: GLenum, verts: Vector2d[], vertexCount?: number): void;
        /**
         * Clear the frame buffer
         * @param {number} [alpha = 0.0] - the alpha value used when clearing the framebuffer
         */
        clear(alpha?: number): void;
        /**
         * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
         * @param {number} [r = 0] - the red color value used when the color buffers are cleared
         * @param {number} [g = 0] - the green color value used when the color buffers are cleared
         * @param {number} [b = 0] - the blue color value used when the color buffers are cleared
         * @param {number} [a = 0] - the alpha color value used when the color buffers are cleared
         */
        clearColor(r?: number, g?: number, b?: number, a?: number): void;
    }
    import GLShader from "video/webgl/glshader";
    import VertexArrayBuffer from "video/webgl/buffer/vertex";
    import Vector2d from "math/vector2";
}
declare module "geometries/poly" {
    export default Polygon;
    /**
     * @classdesc
     * a polygon Object.<br>
     * Please do note that melonJS implements a simple Axis-Aligned Boxes collision algorithm, which requires all polygons used for collision to be convex with all vertices defined with clockwise winding.
     * A polygon is convex when all line segments connecting two points in the interior do not cross any edge of the polygon
     * (which means that all angles are less than 180 degrees), as described here below : <br>
     * <center><img src="images/convex_polygon.png"/></center><br>
     *
     * A polygon's `winding` is clockwise if its vertices (points) are declared turning to the right. The image above shows COUNTERCLOCKWISE winding.
     */
    class Polygon {
        /**
         * @param {number} x origin point of the Polygon
         * @param {number} y origin point of the Polygon
         * @param {Vector2d[]} points array of vector defining the Polygon
         */
        constructor(x: number, y: number, points: Vector2d[]);
        /**
         * origin point of the Polygon
         * @public
         * @type {Vector2d}
         * @name pos
         * @memberof Polygon
         */
        public pos: Vector2d;
        /**
         * Array of points defining the Polygon <br>
         * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
         * @public
         * @type {Vector2d[]}
         * @name points
         * @memberof Polygon
         */
        public points: Vector2d[];
        /**
         * The edges here are the direction of the `n`th edge of the polygon, relative to
         * the `n`th point. If you want to draw a given edge from the edge value, you must
         * first translate to the position of the starting point.
         * @ignore
         */
        edges: any[];
        /**
         * a list of indices for all vertices composing this polygon (@see earcut)
         * @ignore
         */
        indices: any[];
        /**
         * The normals here are the direction of the normal for the `n`th edge of the polygon, relative
         * to the position of the `n`th point. If you want to draw an edge normal, you must first
         * translate to the position of the starting point.
         * @ignore
         */
        normals: any[];
        shapeType: string;
        /** @ignore */
        onResetEvent(x: any, y: any, points: any): void;
        /**
         * set new value to the Polygon
         * @name setShape
         * @memberof Polygon
         * @param {number} x position of the Polygon
         * @param {number} y position of the Polygon
         * @param {Vector2d[]|number[]} points array of vector or vertice defining the Polygon
         * @returns {Polygon} this instance for objecf chaining
         */
        setShape(x: number, y: number, points: Vector2d[] | number[]): Polygon;
        /**
         * set the vertices defining this Polygon
         * @name setVertices
         * @memberof Polygon
         * @param {Vector2d[]} vertices array of vector or vertice defining the Polygon
         * @returns {Polygon} this instance for objecf chaining
         */
        setVertices(vertices: Vector2d[]): Polygon;
        /**
         * apply the given transformation matrix to this Polygon
         * @name transform
         * @memberof Polygon
         * @param {Matrix2d} m the transformation matrix
         * @returns {Polygon} Reference to this object for method chaining
         */
        transform(m: Matrix2d): Polygon;
        /**
         * apply an isometric projection to this shape
         * @name toIso
         * @memberof Polygon
         * @returns {Polygon} Reference to this object for method chaining
         */
        toIso(): Polygon;
        /**
         * apply a 2d projection to this shape
         * @name to2d
         * @memberof Polygon
         * @returns {Polygon} Reference to this object for method chaining
         */
        to2d(): Polygon;
        /**
         * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof Polygon
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around
         * @returns {Polygon} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): Polygon;
        /**
         * Scale this Polygon by the given scalar.
         * @name scale
         * @memberof Polygon
         * @param {number} x
         * @param {number} [y=x]
         * @returns {Polygon} Reference to this object for method chaining
         */
        scale(x: number, y?: number): Polygon;
        /**
         * Scale this Polygon by the given vector
         * @name scaleV
         * @memberof Polygon
         * @param {Vector2d} v
         * @returns {Polygon} Reference to this object for method chaining
         */
        scaleV(v: Vector2d): Polygon;
        /**
         * Computes the calculated collision polygon.
         * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
         * @name recalc
         * @memberof Polygon
         * @returns {Polygon} Reference to this object for method chaining
         */
        recalc(): Polygon;
        /**
         * returns a list of indices for all triangles defined in this polygon
         * @name getIndices
         * @memberof Polygon
         * @returns {Array} an array of vertex indices for all triangles forming this polygon.
         */
        getIndices(): any[];
        /**
         * Returns true if the vertices composing this polygon form a convex shape (vertices must be in clockwise order).
         * @name isConvex
         * @memberof Polygon
         * @returns {boolean} true if the vertices are convex, false if not, null if not computable
         */
        isConvex(): boolean;
        /**
         * translate the Polygon by the specified offset
         * @name translate
         * @memberof Polygon
         * @method
         * @param {number} x x offset
         * @param {number} y y offset
         * @returns {Polygon} this Polygon
         */
        /**
         * translate the Polygon by the specified vector
         * @name translate
         * @memberof Polygon
         * @param {Vector2d} v vector offset
         * @returns {Polygon} Reference to this object for method chaining
         */
        translate(...args: any[]): Polygon;
        /**
         * Shifts the Polygon to the given position vector.
         * @name shift
         * @memberof Polygon
         * @method
         * @param {Vector2d} position
         */
        /**
         * Shifts the Polygon to the given x, y position.
         * @name shift
         * @memberof Polygon
         * @param {number} x
         * @param {number} y
         */
        shift(...args: any[]): void;
        /**
         * Returns true if the polygon contains the given point.
         * (Note: it is highly recommended to first do a hit test on the corresponding <br>
         *  bounding rect, as the function can be highly consuming with complex shapes)
         * @name contains
         * @memberof Polygon
         * @method
         * @param {Vector2d} point
         * @returns {boolean} true if contains
         */
        /**
         * Returns true if the polygon contains the given point. <br>
         * (Note: it is highly recommended to first do a hit test on the corresponding <br>
         *  bounding rect, as the function can be highly consuming with complex shapes)
         * @name contains
         * @memberof Polygon
         * @param  {number} x x coordinate
         * @param  {number} y y coordinate
         * @returns {boolean} true if contains
         */
        contains(...args: any[]): boolean;
        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberof Polygon
         * @returns {Bounds} this shape bounding box Rectangle object
         */
        getBounds(): Bounds;
        _bounds: any;
        /**
         * update the bounding box for this shape.
         * @ignore
         * @name updateBounds
         * @memberof Polygon
         * @returns {Bounds} this shape bounding box Rectangle object
         */
        updateBounds(): Bounds;
        /**
         * clone this Polygon
         * @name clone
         * @memberof Polygon
         * @returns {Polygon} new Polygon
         */
        clone(): Polygon;
    }
    import Vector2d from "math/vector2";
}
declare module "geometries/rectangle" {
    export default Rect;
    /**
     * @classdesc
     * a rectangle Object
     * @augments Polygon
     */
    class Rect extends Polygon {
        /**
         * @param {number} x position of the Rectangle
         * @param {number} y position of the Rectangle
         * @param {number} w width of the rectangle
         * @param {number} h height of the rectangle
         */
        constructor(x: number, y: number, w: number, h: number);
        /** @ignore */
        onResetEvent(x: any, y: any, w: any, h: any): void;
        /**
         * set new value to the rectangle shape
         * @name setShape
         * @memberof Rect
         * @param {number} x position of the Rectangle
         * @param {number} y position of the Rectangle
         * @param {number|Vector2d[]} w width of the rectangle, or an array of vector defining the rectangle
         * @param {number} [h] height of the rectangle, if a numeral width parameter is specified
         * @returns {Rect} this rectangle
         */
        setShape(x: number, y: number, w: number | Vector2d[], h?: number, ...args: any[]): Rect;
        /**
         * left coordinate of the Rectangle
         * @public
         * @type {number}
         * @name left
         * @memberof Rect
         */
        public get left(): number;
        /**
         * right coordinate of the Rectangle
         * @public
         * @type {number}
         * @name right
         * @memberof Rect
         */
        public get right(): number;
        /**
         * top coordinate of the Rectangle
         * @public
         * @type {number}
         * @name top
         * @memberof Rect
         */
        public get top(): number;
        /**
         * bottom coordinate of the Rectangle
         * @public
         * @type {number}
         * @name bottom
         * @memberof Rect
         */
        public get bottom(): number;
        public set width(arg: number);
        /**
         * width of the Rectangle
         * @public
         * @type {number}
         * @name width
         * @memberof Rect
         */
        public get width(): number;
        public set height(arg: number);
        /**
         * height of the Rectangle
         * @public
         * @type {number}
         * @name height
         * @memberof Rect
         */
        public get height(): number;
        public set centerX(arg: number);
        /**
         * absolute center of this rectangle on the horizontal axis
         * @public
         * @type {number}
         * @name centerX
         * @memberof Rect
         */
        public get centerX(): number;
        public set centerY(arg: number);
        /**
         * absolute center of this rectangle on the vertical axis
         * @public
         * @type {number}
         * @name centerY
         * @memberof Rect
         */
        public get centerY(): number;
        /**
         * center the rectangle position around the given coordinates
         * @name centerOn
         * @memberof Rect
         * @param {number} x the x coordinate around which to center this rectangle
         * @param {number} y the y coordinate around which to center this rectangle
         * @returns {Rect} this rectangle
         */
        centerOn(x: number, y: number): Rect;
        /**
         * resize the rectangle
         * @name resize
         * @memberof Rect
         * @param {number} w new width of the rectangle
         * @param {number} h new height of the rectangle
         * @returns {Rect} this rectangle
         */
        resize(w: number, h: number): Rect;
        /**
         * scale the rectangle
         * @name scale
         * @memberof Rect
         * @param {number} x a number representing the abscissa of the scaling vector.
         * @param {number} [y=x] a number representing the ordinate of the scaling vector.
         * @returns {Rect} this rectangle
         */
        scale(x: number, y?: number): Rect;
        /**
         * clone this rectangle
         * @name clone
         * @memberof Rect
         * @returns {Rect} new rectangle
         */
        clone(): Rect;
        /**
         * copy the position and size of the given rectangle into this one
         * @name copy
         * @memberof Rect
         * @param {Rect} rect Source rectangle
         * @returns {Rect} new rectangle
         */
        copy(rect: Rect): Rect;
        /**
         * merge this rectangle with another one
         * @name union
         * @memberof Rect
         * @param {Rect} rect other rectangle to union with
         * @returns {Rect} the union(ed) rectangle
         */
        union(rect: Rect): Rect;
        /**
         * check if this rectangle is intersecting with the specified one
         * @name overlaps
         * @memberof Rect
         * @param {Rect} rect
         * @returns {boolean} true if overlaps
         */
        overlaps(rect: Rect): boolean;
        /**
         * check if this rectangle is identical to the specified one
         * @name equals
         * @memberof Rect
         * @param {Rect} rect
         * @returns {boolean} true if equals
         */
        equals(rect: Rect): boolean;
        /**
         * determines whether all coordinates of this rectangle are finite numbers.
         * @name isFinite
         * @memberof Rect
         * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
         */
        isFinite(): boolean;
        /**
         * Returns a polygon whose edges are the same as this box.
         * @name toPolygon
         * @memberof Rect
         * @returns {Polygon} a new Polygon that represents this rectangle.
         */
        toPolygon(): Polygon;
    }
    import Polygon from "geometries/poly";
}
declare module "geometries/roundrect" {
    export default RoundRect;
    /**
     * @classdesc
     * a rectangle object with rounded corners
     * @augments Rect
     */
    class RoundRect extends Rect {
        /**
         * @param {number} x position of the rounded rectangle
         * @param {number} y position of the rounded rectangle
         * @param {number} width the rectangle width
         * @param {number} height the rectangle height
         * @param {number} [radius=20] the radius of the rounded corner
         */
        constructor(x: number, y: number, width: number, height: number, radius?: number);
        public set radius(arg: number);
        /**
         * the radius of the rounded corner
         * @public
         * @type {number}
         * @default 20
         * @name radius
         * @memberof RoundRect
         */
        public get radius(): number;
        /** @ignore */
        onResetEvent(x: any, y: any, w: any, h: any, radius: any): void;
        _radius: number;
        /**
         * copy the position, size and radius of the given rounded rectangle into this one
         * @name copy
         * @memberof RoundRect
         * @param {RoundRect} rrect source rounded rectangle
         * @returns {RoundRect} new rectangle
         */
        copy(rrect: RoundRect): RoundRect;
        /**
         * check if this RoundRect is identical to the specified one
         * @name equals
         * @memberof RoundRect
         * @param {RoundRect} rrect
         * @returns {boolean} true if equals
         */
        equals(rrect: RoundRect): boolean;
        /**
         * clone this RoundRect
         * @name clone
         * @memberof RoundRect
         * @returns {RoundRect} new RoundRect
         */
        clone(): RoundRect;
    }
    import Rect from "geometries/rectangle";
}
declare module "geometries/ellipse" {
    export default Ellipse;
    /**
     * @classdesc
     * an ellipse Object
     */
    class Ellipse {
        /**
         * @param {number} x the center x coordinate of the ellipse
         * @param {number} y the center y coordinate of the ellipse
         * @param {number} w width (diameter) of the ellipse
         * @param {number} h height (diameter) of the ellipse
         */
        constructor(x: number, y: number, w: number, h: number);
        /**
         * the center coordinates of the ellipse
         * @public
         * @type {Vector2d}
         * @name pos
         * @memberof Ellipse
         */
        public pos: Vector2d;
        /**
         * The bounding rectangle for this shape
         * @private
         */
        private _bounds;
        /**
         * Maximum radius of the ellipse
         * @public
         * @type {number}
         * @name radius
         * @memberof Ellipse
         */
        public radius: number;
        /**
         * Pre-scaled radius vector for ellipse
         * @public
         * @type {Vector2d}
         * @name radiusV
         * @memberof Ellipse
         */
        public radiusV: Vector2d;
        /**
         * Radius squared, for pythagorean theorom
         * @public
         * @type {Vector2d}
         * @name radiusSq
         * @memberof Ellipse
         */
        public radiusSq: Vector2d;
        /**
         * x/y scaling ratio for ellipse
         * @public
         * @type {Vector2d}
         * @name ratio
         * @memberof Ellipse
         */
        public ratio: Vector2d;
        shapeType: string;
        /** @ignore */
        onResetEvent(x: any, y: any, w: any, h: any): void;
        /**
         * set new value to the Ellipse shape
         * @name setShape
         * @memberof Ellipse
         * @param {number} x the center x coordinate of the ellipse
         * @param {number} y the center y coordinate of the ellipse
         * @param {number} w width (diameter) of the ellipse
         * @param {number} h height (diameter) of the ellipse
         * @returns {Ellipse} this instance for objecf chaining
         */
        setShape(x: number, y: number, w: number, h: number): Ellipse;
        /**
         * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof Ellipse
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around
         * @returns {Ellipse} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): Ellipse;
        /**
         * Scale this Ellipse by the specified scalar.
         * @name scale
         * @memberof Ellipse
         * @param {number} x
         * @param {number} [y=x]
         * @returns {Ellipse} Reference to this object for method chaining
         */
        scale(x: number, y?: number): Ellipse;
        /**
         * Scale this Ellipse by the specified vector.
         * @name scale
         * @memberof Ellipse
         * @param {Vector2d} v
         * @returns {Ellipse} Reference to this object for method chaining
         */
        scaleV(v: Vector2d): Ellipse;
        /**
         * apply the given transformation matrix to this ellipse
         * @name transform
         * @memberof Ellipse
         * @param {Matrix2d} matrix the transformation matrix
         * @returns {Polygon} Reference to this object for method chaining
         */
        transform(matrix: Matrix2d): Polygon;
        /**
         * translate the circle/ellipse by the specified offset
         * @name translate
         * @memberof Ellipse
         * @method
         * @param {number} x x offset
         * @param {number} y y offset
         * @returns {Ellipse} this ellipse
         */
        /**
         * translate the circle/ellipse by the specified vector
         * @name translate
         * @memberof Ellipse
         * @param {Vector2d} v vector offset
         * @returns {Ellipse} this ellipse
         */
        translate(...args: any[]): Ellipse;
        /**
         * check if this circle/ellipse contains the specified point
         * @name contains
         * @method
         * @memberof Ellipse
         * @param {Vector2d} point
         * @returns {boolean} true if contains
         */
        /**
         * check if this circle/ellipse contains the specified point
         * @name contains
         * @memberof Ellipse
         * @param  {number} x x coordinate
         * @param  {number} y y coordinate
         * @returns {boolean} true if contains
         */
        contains(...args: any[]): boolean;
        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberof Ellipse
         * @returns {Bounds} this shape bounding box Rectangle object
         */
        getBounds(): Bounds;
        /**
         * clone this Ellipse
         * @name clone
         * @memberof Ellipse
         * @returns {Ellipse} new Ellipse
         */
        clone(): Ellipse;
    }
}
declare module "geometries/line" {
    export default Line;
    /**
     * @classdesc
     * a line segment Object
     * @augments Polygon
     * @param {number} x origin point of the Line
     * @param {number} y origin point of the Line
     * @param {Vector2d[]} points array of vectors defining the Line
     */
    class Line extends Polygon {
    }
    import Polygon from "geometries/poly";
}
declare module "physics/bounds" {
    export default Bounds;
    /**
     * @classdesc
     * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
     */
    class Bounds {
        /**
         * @param {Vector2d[]} [vertices] an array of me.Vector2d points
         */
        constructor(vertices?: Vector2d[]);
        _center: Vector2d;
        /**
         * @ignore
         */
        onResetEvent(vertices: any): void;
        min: {
            x: number;
            y: number;
        };
        max: {
            x: number;
            y: number;
        };
        /**
         * reset the bound
         * @name clear
         * @memberof Bounds
         */
        clear(): void;
        /**
         * sets the bounds to the given min and max value
         * @name setMinMax
         * @memberof Bounds
         * @param {number} minX
         * @param {number} minY
         * @param {number} maxX
         * @param {number} maxY
         */
        setMinMax(minX: number, minY: number, maxX: number, maxY: number): void;
        public set x(arg: number);
        /**
         * x position of the bound
         * @public
         * @type {number}
         * @name x
         * @memberof Bounds
         */
        public get x(): number;
        public set y(arg: number);
        /**
         * y position of the bounds
         * @public
         * @type {number}
         * @name y
         * @memberof Bounds
         */
        public get y(): number;
        public set width(arg: number);
        /**
         * width of the bounds
         * @public
         * @type {number}
         * @name width
         * @memberof Bounds
         */
        public get width(): number;
        public set height(arg: number);
        /**
         * width of the bounds
         * @public
         * @type {number}
         * @name width
         * @memberof Bounds
         */
        public get height(): number;
        /**
         * left coordinate of the bound
         * @public
         * @type {number}
         * @name left
         * @memberof Bounds
         */
        public get left(): number;
        /**
         * right coordinate of the bound
         * @public
         * @type {number}
         * @name right
         * @memberof Bounds
         */
        public get right(): number;
        /**
         * top coordinate of the bound
         * @public
         * @type {number}
         * @name top
         * @memberof Bounds
         */
        public get top(): number;
        /**
         * bottom coordinate of the bound
         * @public
         * @type {number}
         * @name bottom
         * @memberof Bounds
         */
        public get bottom(): number;
        /**
         * center position of the bound on the x axis
         * @public
         * @type {number}
         * @name centerX
         * @memberof Bounds
         */
        public get centerX(): number;
        /**
         * center position of the bound on the y axis
         * @public
         * @type {number}
         * @name centerY
         * @memberof Bounds
         */
        public get centerY(): number;
        /**
         * return the center position of the bound
         * @public
         * @type {Vector2d}
         * @name center
         * @memberof Bounds
         */
        public get center(): Vector2d;
        /**
         * Updates bounds using the given vertices
         * @name update
         * @memberof Bounds
         * @param {Vector2d[]} vertices an array of me.Vector2d points
         */
        update(vertices: Vector2d[]): void;
        /**
         * add the given vertices to the bounds definition.
         * @name add
         * @memberof Bounds
         * @param {Vector2d[]} vertices an array of me.Vector2d points
         * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
         */
        add(vertices: Vector2d[], clear?: boolean): void;
        /**
         * add the given bounds to the bounds definition.
         * @name addBounds
         * @memberof Bounds
         * @param {Bounds} bounds
         * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
         */
        addBounds(bounds: Bounds, clear?: boolean): void;
        /**
         * add the given point to the bounds definition.
         * @name addPoint
         * @memberof Bounds
         * @param {Vector2d|Point} point the point to be added to the bounds
         * @param {Matrix2d} [m] an optional transform to apply to the given point (only if the given point is a vector)
         */
        addPoint(point: Vector2d | Point, m?: Matrix2d): void;
        /**
         * add the given quad coordinates to this bound definition, multiplied by the given matrix
         * @name addFrame
         * @memberof Bounds
         * @param {number} x0 - left X coordinates of the quad
         * @param {number} y0 - top Y coordinates of the quad
         * @param {number} x1 - right X coordinates of the quad
         * @param {number} y1 - bottom y coordinates of the quad
         * @param {Matrix2d} [m] an optional transform to apply to the given frame coordinates
         */
        addFrame(x0: number, y0: number, x1: number, y1: number, m?: Matrix2d): void;
        /**
         * Returns true if the bounds contains the given point.
         * @name contains
         * @memberof Bounds
         * @method
         * @param {Vector2d} point
         * @returns {boolean} True if the bounds contain the point, otherwise false
         */
        /**
         * Returns true if the bounds contains the given point.
         * @name contains
         * @memberof Bounds
         * @param {number} x
         * @param {number} y
         * @returns {boolean} True if the bounds contain the point, otherwise false
         */
        contains(...args: any[]): boolean;
        /**
         * Returns true if the two bounds intersect.
         * @name overlaps
         * @memberof Bounds
         * @param {Bounds|Rect} bounds
         * @returns {boolean} True if the bounds overlap, otherwise false
         */
        overlaps(bounds: Bounds | Rect): boolean;
        /**
         * determines whether all coordinates of this bounds are finite numbers.
         * @name isFinite
         * @memberof Bounds
         * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
         */
        isFinite(): boolean;
        /**
         * Translates the bounds by the given vector.
         * @name translate
         * @memberof Bounds
         * @method
         * @param {Vector2d} vector
         */
        /**
         * Translates the bounds by x on the x axis, and y on the y axis
         * @name translate
         * @memberof Bounds
         * @param {number} x
         * @param {number} y
         */
        translate(...args: any[]): void;
        /**
         * Shifts the bounds to the given position vector.
         * @name shift
         * @memberof Bounds
         * @method
         * @param {Vector2d} position
         */
        /**
         * Shifts the bounds to the given x, y position.
         * @name shift
         * @memberof Bounds
         * @param {number} x
         * @param {number} y
         */
        shift(...args: any[]): void;
        /**
         * clone this bounds
         * @name clone
         * @memberof Bounds
         * @returns {Bounds}
         */
        clone(): Bounds;
        /**
         * Returns a polygon whose edges are the same as this bounds.
         * @name toPolygon
         * @memberof Bounds
         * @returns {Polygon} a new Polygon that represents this bounds.
         */
        toPolygon(): Polygon;
    }
    import Vector2d from "math/vector2";
}
declare module "geometries/path2d" {
    export default Path2D;
    /**
     * @classdesc
     * a simplified path2d implementation, supporting only one path
     */
    class Path2D {
        /**
         * the points defining the current path
         * @public
         * @type {Vector2d[]}
         * @name points
         * @memberof Path2D#
         */
        public points: Vector2d[];
        /**
         * space between interpolated points for quadratic and bezier curve approx. in pixels.
         * @public
         * @type {number}
         * @name arcResolution
         * @default 5
         * @memberof Path2D#
         */
        public arcResolution: number;
        vertices: any[];
        /**
         * begin a new path
         * @name beginPath
         * @memberof Path2D
         */
        beginPath(): void;
        /**
         * causes the point of the pen to move back to the start of the current path.
         * It tries to draw a straight line from the current point to the start.
         * If the shape has already been closed or has only one point, this function does nothing.
         * @name closePath
         * @memberof Path2D
         */
        closePath(): void;
        /**
         * triangulate the shape defined by this path into an array of triangles
         * @name triangulatePath
         * @memberof Path2D
         * @returns {Vector2d[]}
         */
        triangulatePath(): Vector2d[];
        /**
         * moves the starting point of the current path to the (x, y) coordinates.
         * @name moveTo
         * @memberof Path2D
         * @param {number} x the x-axis (horizontal) coordinate of the point.
         * @param {number} y the y-axis (vertical) coordinate of the point.
         */
        moveTo(x: number, y: number): void;
        /**
         * connects the last point in the current patch to the (x, y) coordinates with a straight line.
         * @name lineTo
         * @memberof Path2D
         * @param {number} x the x-axis coordinate of the line's end point.
         * @param {number} y the y-axis coordinate of the line's end point.
         */
        lineTo(x: number, y: number): void;
        /**
         * adds an arc to the current path which is centered at (x, y) position with the given radius,
         * starting at startAngle and ending at endAngle going in the given direction by counterclockwise (defaulting to clockwise).
         * @name arc
         * @memberof Path2D
         * @param {number} x the horizontal coordinate of the arc's center.
         * @param {number} y the vertical coordinate of the arc's center.
         * @param {number} radius the arc's radius. Must be positive.
         * @param {number} startAngle the angle at which the arc starts in radians, measured from the positive x-axis.
         * @param {number} endAngle the angle at which the arc ends in radians, measured from the positive x-axis.
         * @param {boolean} [anticlockwise=false] an optional boolean value. If true, draws the arc counter-clockwise between the start and end angles.
         */
        arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
        /**
         * adds a circular arc to the path with the given control points and radius, connected to the previous point by a straight line.
         * @name arcTo
         * @memberof Path2D
         * @param {number} x1 the x-axis coordinate of the first control point.
         * @param {number} y1 the y-axis coordinate of the first control point.
         * @param {number} x2 the x-axis coordinate of the second control point.
         * @param {number} y2 the y-axis coordinate of the second control point.
         * @param {number} radius the arc's radius. Must be positive.
         */
        arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
        /**
         * adds an elliptical arc to the path which is centered at (x, y) position with the radii radiusX and radiusY
         * starting at startAngle and ending at endAngle going in the given direction by counterclockwise.
         * @name ellipse
         * @memberof Path2D
         * @param {number} x the x-axis (horizontal) coordinate of the ellipse's center.
         * @param {number} y the  y-axis (vertical) coordinate of the ellipse's center.
         * @param {number} radiusX the ellipse's major-axis radius. Must be non-negative.
         * @param {number} radiusY the ellipse's minor-axis radius. Must be non-negative.
         * @param {number} rotation the rotation of the ellipse, expressed in radians.
         * @param {number} startAngle the angle at which the ellipse starts, measured clockwise from the positive x-axis and expressed in radians.
         * @param {number} endAngle the angle at which the ellipse ends, measured clockwise from the positive x-axis and expressed in radians.
         * @param {boolean} [anticlockwise=false] an optional boolean value which, if true, draws the ellipse counterclockwise (anticlockwise).
         */
        ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
        /**
         * creates a path for a rectangle at position (x, y) with a size that is determined by width and height.
         * @name rect
         * @memberof Path2D
         * @param {number} x the x-axis coordinate of the rectangle's starting point.
         * @param {number} y the y-axis coordinate of the rectangle's starting point.
         * @param {number} width the rectangle's width. Positive values are to the right, and negative to the left.
         * @param {number} height the rectangle's height. Positive values are down, and negative are up.
         */
        rect(x: number, y: number, width: number, height: number): void;
        /**
         * adds an rounded rectangle to the current path.
         * @name roundRect
         * @memberof Path2D
         * @param {number} x the x-axis coordinate of the rectangle's starting point.
         * @param {number} y the y-axis coordinate of the rectangle's starting point.
         * @param {number} width the rectangle's width. Positive values are to the right, and negative to the left.
         * @param {number} height the rectangle's height. Positive values are down, and negative are up.
         * @param {number} radius the arc's radius to draw the borders. Must be positive.
         */
        roundRect(x: number, y: number, width: number, height: number, radius: number): void;
    }
}
declare module "geometries/point" {
    export default Point;
    /**
     * @classdesc
     * represents a point in a 2d space
     */
    class Point {
        constructor(x?: number, y?: number);
        /**
         * the position of the point on the horizontal axis
         * @public
         * @type {Number}
         * @default 0
         */
        public x: number;
        /**
         * the position of the point on the vertical axis
         * @public
         * @type {Number}
         * @default 0
         */
        public y: number;
        /** @ignore */
        onResetEvent(x?: number, y?: number): void;
        /**
         * set the Point x and y properties to the given values
         * @param {number} x
         * @param {number} y
         * @returns {Point} Reference to this object for method chaining
         */
        set(x?: number, y?: number): Point;
        /**
         * return true if the two points are the same
         * @name equals
         * @memberof Point
         * @method
         * @param {Point} point
         * @returns {boolean}
         */
        /**
         * return true if this point is equal to the given values
         * @name equals
         * @memberof Point
         * @param {number} x
         * @param {number} y
         * @returns {boolean}
         */
        equals(...args: any[]): boolean;
        /**
         * clone this Point
         * @name clone
         * @returns {Point} new Point
         */
        clone(): Point;
    }
}
declare module "video/renderer" {
    export default Renderer;
    /**
     * @classdesc
     * a base renderer object
     */
    class Renderer {
        /**
         * @param {object} options The renderer parameters
         * @param {number} options.width The width of the canvas without scaling
         * @param {number} options.height The height of the canvas without scaling
         * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
         * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
         * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
         * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas
         * @param {boolean} [options.premultipliedAlpha=true] in WebGL, whether the renderer will assume that colors have premultiplied alpha when canvas transparency is enabled
         * @param {boolean} [options.blendMode="normal"] the default blend mode to use ("normal", "multiply")
         * @param {boolean} [options.subPixel=false] Whether to enable subpixel rendering (performance hit when enabled)
         * @param {boolean} [options.verbose=false] Enable the verbose mode that provides additional details as to what the renderer is doing
         * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
         * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
         */
        constructor(options: {
            width: number;
            height: number;
            canvas?: HTMLCanvasElement;
            antiAlias?: boolean;
            failIfMajorPerformanceCaveat?: boolean;
            transparent?: boolean;
            premultipliedAlpha?: boolean;
            blendMode?: boolean;
            subPixel?: boolean;
            verbose?: boolean;
            zoomX?: number;
            zoomY?: number;
        });
        /**
         * The given constructor options
         * @public
         * @type {object}
         */
        public settings: object;
        /**
         * true if the current rendering context is valid
         * @default true
         * @type {boolean}
         */
        isContextValid: boolean;
        /**
         * The Path2D instance used by the renderer to draw primitives
         * @type {Path2D}
         */
        path2D: Path2D;
        /**
         * @ignore
         */
        currentScissor: Int32Array;
        /**
         * @ignore
         */
        maskLevel: number;
        /**
         * @ignore
         */
        currentBlendMode: string;
        canvas: any;
        currentColor: Color;
        currentTint: Color;
        projectionMatrix: Matrix3d;
        uvOffset: number;
        /**
         * prepare the framebuffer for drawing a new frame
         */
        clear(): void;
        /**
         * render the main framebuffer on screen
         */
        flush(): void;
        /**
         * Reset context state
         */
        reset(): void;
        /**
         * return a reference to the canvas which this renderer draws to
         * @returns {HTMLCanvasElement}
         */
        getCanvas(): HTMLCanvasElement;
        /**
         * return a reference to this renderer canvas corresponding Context
         * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
         */
        getContext(): CanvasRenderingContext2D | WebGLRenderingContext;
        /**
         * returns the current blend mode for this renderer
         * @returns {string} blend mode
         */
        getBlendMode(): string;
        /**
         * Returns the 2D Context object of the given Canvas<br>
         * Also configures anti-aliasing and blend modes based on constructor options.
         * @param {HTMLCanvasElement} canvas
         * @param {boolean} [transparent=true] use false to disable transparency
         * @returns {CanvasRenderingContext2D}
         */
        getContext2d(canvas: HTMLCanvasElement, transparent?: boolean): CanvasRenderingContext2D;
        /**
         * return the width of the system Canvas
         * @returns {number}
         */
        getWidth(): number;
        /**
         * return the height of the system Canvas
         * @returns {number} height of the system Canvas
         */
        getHeight(): number;
        /**
         * get the current fill & stroke style color.
         * @returns {Color} current global color
         */
        getColor(): Color;
        /**
         * return the current global alpha
         * @returns {number}
         */
        globalAlpha(): number;
        /**
         * check if the given rect or bounds overlaps with the renderer screen coordinates
         * @param {Rect|Bounds} bounds
         * @returns {boolean} true if overlaps
         */
        overlaps(bounds: Rect | Bounds): boolean;
        /**
         * resizes the system canvas
         * @param {number} width new width of the canvas
         * @param {number} height new height of the canvas
         */
        resize(width: number, height: number): void;
        /**
         * enable/disable image smoothing (scaling interpolation) for the given context
         * @param {CanvasRenderingContext2D} context
         * @param {boolean} [enable=false]
         */
        setAntiAlias(context: CanvasRenderingContext2D, enable?: boolean): void;
        /**
         * set/change the current projection matrix (WebGL only)
         * @param {Matrix3d} matrix
         */
        setProjection(matrix: Matrix3d): void;
        /**
         * stroke the given shape
         * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape a shape object to stroke
         * @param {boolean} [fill=false] fill the shape with the current color if true
         */
        stroke(shape: Rect | RoundRect | Polygon | Line | Ellipse, fill?: boolean): void;
        /**
         * fill the given shape
         * @name fill
         * @memberof Renderer
         * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape a shape object to fill
         */
        fill(shape: Rect | RoundRect | Polygon | Line | Ellipse): void;
        /**
         * tint the given image or canvas using the given color
         * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src the source image to be tinted
         * @param {Color|string} color the color that will be used to tint the image
         * @param {string} [mode="multiply"] the composition mode used to tint the image
         * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas element representing the tinted image
         */
        tint(src: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas, color: Color | string, mode?: string): HTMLCanvasElement | OffscreenCanvas;
        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * Mask are not preserved through renderer context save and restore.
         * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] the shape defining the mask to be applied
         * @param {boolean} [invert=false] either the given shape should define what is visible (default) or the opposite
         */
        setMask(mask?: Rect | RoundRect | Polygon | Line | Ellipse): void;
        /**
         * disable (remove) the rendering mask set through setMask.
         * @see Renderer#setMask
         */
        clearMask(): void;
        /**
         * set a coloring tint for sprite based renderables
         * @param {Color} tint the tint color
         * @param {number} [alpha] an alpha value to be applied to the tint
         */
        setTint(tint: Color, alpha?: number): void;
        /**
         * clear the rendering tint set through setTint.
         * @see Renderer#setTint
         */
        clearTint(): void;
        /**
         * @ignore
         */
        drawFont(): void;
    }
    import Path2D from "geometries/path2d";
    import Color from "math/color";
    import Matrix3d from "math/matrix3";
    import Rect from "geometries/rectangle";
    import Bounds from "physics/bounds";
    import RoundRect from "geometries/roundrect";
    import Polygon from "geometries/poly";
    import Line from "geometries/line";
    import Ellipse from "geometries/ellipse";
}
declare module "audio/audio" {
    /**
     * Initialize and configure the audio support.<br>
     * melonJS supports a wide array of audio codecs that have varying browser support :
     * <i> ("mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac")</i>.<br>
     * For a maximum browser coverage the recommendation is to use at least two of them,
     * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
     * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
     * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
     * So if you want webm to be used before mp3, you need to put the audio format in that order.
     * @function audio.init
     * @param {string} [format="mp3"] audio format to prioritize
     * @returns {boolean} Indicates whether audio initialization was successful
     * @example
     * // initialize the "sound engine", giving "webm" as default desired audio format, and "mp3" as a fallback
     * if (!me.audio.init("webm,mp3")) {
     *     alert("Sorry but your browser does not support html 5 audio !");
     *     return;
     * }
     */
    export function init(format?: string): boolean;
    /**
     * check if the given audio format is supported
     * @function audio.hasFormat
     * @param {string} codec audio format : "mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac"
     * @returns {boolean} return true if the given audio format is supported
     */
    export function hasFormat(codec: string): boolean;
    /**
     * check if audio (HTML5 or WebAudio) is supported
     * @function audio.hasAudio
     * @returns {boolean} return true if audio (HTML5 or WebAudio) is supported
     */
    export function hasAudio(): boolean;
    /**
     * enable audio output <br>
     * only useful if audio supported and previously disabled through
     * @function audio.enable
     * @see audio#disable
     */
    export function enable(): void;
    /**
     * disable audio output
     * @function audio.disable
     */
    export function disable(): void;
    /**
     * Load an audio file.<br>
     * <br>
     * sound item must contain the following fields :<br>
     * - name    : name of the sound<br>
     * - src     : source path<br>
     * @ignore
     */
    export function load(sound: any, html5: any, onload_cb: any, onerror_cb: any): number;
    /**
     * play the specified sound
     * @function audio.play
     * @param {string} sound_name audio clip name - case sensitive
     * @param {boolean} [loop=false] loop audio
     * @param {Function} [onend] Function to call when sound instance ends playing.
     * @param {number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
     * @returns {number} the sound instance ID.
     * @example
     * // play the "cling" audio clip
     * me.audio.play("cling");
     * // play & repeat the "engine" audio clip
     * me.audio.play("engine", true);
     * // play the "gameover_sfx" audio clip and call myFunc when finished
     * me.audio.play("gameover_sfx", false, myFunc);
     * // play the "gameover_sfx" audio clip with a lower volume level
     * me.audio.play("gameover_sfx", false, null, 0.5);
     */
    export function play(sound_name: string, loop?: boolean, onend?: Function, volume?: number): number;
    /**
     * Fade a currently playing sound between two volumee.
     * @function audio.fade
     * @param {string} sound_name audio clip name - case sensitive
     * @param {number} from Volume to fade from (0.0 to 1.0).
     * @param {number} to Volume to fade to (0.0 to 1.0).
     * @param {number} duration Time in milliseconds to fade.
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will fade.
     */
    export function fade(sound_name: string, from: number, to: number, duration: number, id?: number): void;
    /**
     * get/set the position of playback for a sound.
     * @function audio.seek
     * @param {string} sound_name audio clip name - case sensitive
     * @param {number} [seek] the position to move current playback to (in seconds).
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will changed.
     * @returns {number} return the current seek position (if no extra parameters were given)
     * @example
     * // return the current position of the background music
     * var current_pos = me.audio.seek("dst-gameforest");
     * // set back the position of the background music to the beginning
     * me.audio.seek("dst-gameforest", 0);
     */
    export function seek(sound_name: string, ...args: any[]): number;
    /**
     * get or set the rate of playback for a sound.
     * @function audio.rate
     * @param {string} sound_name audio clip name - case sensitive
     * @param {number} [rate] playback rate : 0.5 to 4.0, with 1.0 being normal speed.
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will be changed.
     * @returns {number} return the current playback rate (if no extra parameters were given)
     * @example
     * // get the playback rate of the background music
     * var rate = me.audio.rate("dst-gameforest");
     * // speed up the playback of the background music
     * me.audio.rate("dst-gameforest", 2.0);
     */
    export function rate(sound_name: string, ...args: any[]): number;
    /**
     * stop the specified sound on all channels
     * @function audio.stop
     * @param {string} [sound_name] audio clip name (case sensitive). If none is passed, all sounds are stopped.
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will stop.
     * @example
     * me.audio.stop("cling");
     */
    export function stop(sound_name?: string, id?: number): void;
    /**
     * pause the specified sound on all channels<br>
     * this function does not reset the currentTime property
     * @function audio.pause
     * @param {string} sound_name audio clip name - case sensitive
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will pause.
     * @example
     * me.audio.pause("cling");
     */
    export function pause(sound_name: string, id?: number): void;
    /**
     * resume the specified sound on all channels<br>
     * @function audio.resume
     * @param {string} sound_name audio clip name - case sensitive
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will resume.
     * @example
     * // play a audio clip
     * var id = me.audio.play("myClip");
     * ...
     * // pause it
     * me.audio.pause("myClip", id);
     * ...
     * // resume
     * me.audio.resume("myClip", id);
     */
    export function resume(sound_name: string, id?: number): void;
    /**
     * play the specified audio track<br>
     * this function automatically set the loop property to true<br>
     * and keep track of the current sound being played.
     * @function audio.playTrack
     * @param {string} sound_name audio track name - case sensitive
     * @param {number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
     * @returns {number} the sound instance ID.
     * @example
     * me.audio.playTrack("awesome_music");
     */
    export function playTrack(sound_name: string, volume?: number): number;
    /**
     * stop the current audio track
     * @function audio.stopTrack
     * @see audio#playTrack
     * @example
     * // play a awesome music
     * me.audio.playTrack("awesome_music");
     * // stop the current music
     * me.audio.stopTrack();
     */
    export function stopTrack(): void;
    /**
     * pause the current audio track
     * @function audio.pauseTrack
     * @example
     * me.audio.pauseTrack();
     */
    export function pauseTrack(): void;
    /**
     * resume the previously paused audio track
     * @function audio.resumeTrack
     * @example
     * // play an awesome music
     * me.audio.playTrack("awesome_music");
     * // pause the audio track
     * me.audio.pauseTrack();
     * // resume the music
     * me.audio.resumeTrack();
     */
    export function resumeTrack(): void;
    /**
     * returns the current track Id
     * @function audio.getCurrentTrack
     * @returns {string} audio track name
     */
    export function getCurrentTrack(): string;
    /**
     * set the default global volume
     * @function audio.setVolume
     * @param {number} volume Float specifying volume (0.0 - 1.0 values accepted).
     */
    export function setVolume(volume: number): void;
    /**
     * get the default global volume
     * @function audio.getVolume
     * @returns {number} current volume value in Float [0.0 - 1.0] .
     */
    export function getVolume(): number;
    /**
     * mute or unmute the specified sound, but does not pause the playback.
     * @function audio.mute
     * @param {string} sound_name audio clip name - case sensitive
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will mute.
     * @param {boolean} [mute=true] True to mute and false to unmute
     * @example
     * // mute the background music
     * me.audio.mute("awesome_music");
     */
    export function mute(sound_name: string, id?: number, mute?: boolean): void;
    /**
     * unmute the specified sound
     * @function audio.unmute
     * @param {string} sound_name audio clip name
     * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will unmute.
     */
    export function unmute(sound_name: string, id?: number): void;
    /**
     * mute all audio
     * @function audio.muteAll
     */
    export function muteAll(): void;
    /**
     * unmute all audio
     * @function audio.unmuteAll
     */
    export function unmuteAll(): void;
    /**
     * Returns true if audio is muted globally.
     * @function audio.muted
     * @returns {boolean} true if audio is muted globally
     */
    export function muted(): boolean;
    /**
     * unload specified audio track to free memory
     * @function audio.unload
     * @param {string} sound_name audio track name - case sensitive
     * @returns {boolean} true if unloaded
     * @example
     * me.audio.unload("awesome_music");
     */
    export function unload(sound_name: string): boolean;
    /**
     * unload all audio to free memory
     * @function audio.unloadAll
     * @example
     * me.audio.unloadAll();
     */
    export function unloadAll(): void;
    /**
     * Specify either to stop on audio loading error or not<br>
     * if true, melonJS will throw an exception and stop loading<br>
     * if false, melonJS will disable sounds and output a warning message
     * in the console<br>
     * @name stopOnAudioError
     * @type {boolean}
     * @default true
     * @memberof audio
     */
    export let stopOnAudioError: boolean;
}
declare module "math/observable_vector2" {
    export default ObservableVector2d;
    /**
     * @classdesc
     * A Vector2d object that provide notification by executing the given callback when the vector is changed.
     * @augments Vector2d
     */
    class ObservableVector2d extends Vector2d {
        /**
         * @param {number} x x value of the vector
         * @param {number} y y value of the vector
         * @param {object} settings additional required parameters
         * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
         * @param {Function} [settings.scope] the value to use as this when calling onUpdate
         */
        constructor(x: number, y: number, settings: {
            onUpdate: Function;
            scope?: Function;
        });
        /**
         * @ignore
         */
        onResetEvent(x: number, y: number, settings: any): ObservableVector2d;
        public set x(arg: number);
        /**
         * x value of the vector
         * @public
         * @type {number}
         * @name x
         * @memberof ObservableVector2d
         */
        public get x(): number;
        _x: any;
        public set y(arg: number);
        /**
         * y value of the vector
         * @public
         * @type {number}
         * @name y
         * @memberof ObservableVector2d
         */
        public get y(): number;
        _y: any;
        /** @ignore */
        _set(x: any, y: any): ObservableVector2d;
        /**
         * set the vector value without triggering the callback
         * @name setMuted
         * @memberof ObservableVector2d
         * @param {number} x x value of the vector
         * @param {number} y y value of the vector
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        setMuted(x: number, y: number): ObservableVector2d;
        /**
         * set the callback to be executed when the vector is changed
         * @name setCallback
         * @memberof ObservableVector2d
         * @param {Function} fn callback
         * @param {Function} [scope=null] scope
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        setCallback(fn: Function, scope?: Function): ObservableVector2d;
        onUpdate: Function;
        scope: Function;
        /**
         * Add the passed vector to this vector
         * @name add
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        add(v: ObservableVector2d): ObservableVector2d;
        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        sub(v: ObservableVector2d): ObservableVector2d;
        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberof ObservableVector2d
         * @param {number} x
         * @param {number} [y=x]
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        scale(x: number, y?: number): ObservableVector2d;
        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        scaleV(v: ObservableVector2d): ObservableVector2d;
        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberof ObservableVector2d
         * @param {number} n the value to divide the vector by
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        div(n: number): ObservableVector2d;
        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        abs(): ObservableVector2d;
        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberof ObservableVector2d
         * @param {number} low
         * @param {number} high
         * @returns {ObservableVector2d} new me.ObservableVector2d
         */
        clamp(low: number, high: number): ObservableVector2d;
        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberof ObservableVector2d
         * @param {number} low
         * @param {number} high
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        clampSelf(low: number, high: number): ObservableVector2d;
        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        minV(v: ObservableVector2d): ObservableVector2d;
        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        maxV(v: ObservableVector2d): ObservableVector2d;
        /**
         * Floor the vector values
         * @name floor
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} new me.ObservableVector2d
         */
        floor(): ObservableVector2d;
        /**
         * Floor this vector values
         * @name floorSelf
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        floorSelf(): ObservableVector2d;
        /**
         * Ceil the vector values
         * @name ceil
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} new me.ObservableVector2d
         */
        ceil(): ObservableVector2d;
        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        ceilSelf(): ObservableVector2d;
        /**
         * Negate the vector values
         * @name negate
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} new me.ObservableVector2d
         */
        negate(): ObservableVector2d;
        /**
         * Negate this vector values
         * @name negateSelf
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        negateSelf(): ObservableVector2d;
        /**
         * Copy the x,y values of the passed vector to this one
         * @name copy
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        copy(v: ObservableVector2d): ObservableVector2d;
        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {boolean}
         */
        equals(v: ObservableVector2d): boolean;
        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction)
         * @name perp
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        perp(): ObservableVector2d;
        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof ObservableVector2d
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): ObservableVector2d;
        /**
         * return the dot product of this vector and the passed one
         * @name dot
         * @memberof ObservableVector2d
         * @param {Vector2d|ObservableVector2d} v
         * @returns {number} The dot product.
         */
        dot(v: Vector2d | ObservableVector2d): number;
        /**
         * return the cross product of this vector and the passed one
         * @name cross
         * @memberof ObservableVector2d
         * @param {Vector2d|ObservableVector2d} v
         * @returns {number} The cross product.
         */
        cross(v: Vector2d | ObservableVector2d): number;
        /**
         * Linearly interpolate between this vector and the given one.
         * @name lerp
         * @memberof ObservableVector2d
         * @param {Vector2d|ObservableVector2d} v
         * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        lerp(v: Vector2d | ObservableVector2d, alpha: number): ObservableVector2d;
        /**
         * interpolate the position of this vector towards the given one while nsure that the distance never exceeds the given step.
         * @name moveTowards
         * @memberof ObservableVector2d
         * @param {Vector2d|ObservableVector2d} target
         * @param {number} step the maximum step per iteration (Negative values will push the vector away from the target)
         * @returns {ObservableVector2d} Reference to this object for method chaining
         */
        moveTowards(target: Vector2d | ObservableVector2d, step: number): ObservableVector2d;
        /**
         * return the distance between this vector and the passed one
         * @name distance
         * @memberof ObservableVector2d
         * @param {ObservableVector2d} v
         * @returns {number}
         */
        distance(v: ObservableVector2d): number;
        /**
         * return a clone copy of this vector
         * @name clone
         * @memberof ObservableVector2d
         * @returns {ObservableVector2d} new me.ObservableVector2d
         */
        clone(): ObservableVector2d;
        /**
         * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
         * @name toVector2d
         * @memberof ObservableVector2d
         * @returns {Vector2d} new me.Vector2d
         */
        toVector2d(): Vector2d;
    }
    import Vector2d from "math/vector2";
}
declare module "math/vector3" {
    export default Vector3d;
    /**
     * @classdesc
     * a generic 3D Vector Object
     */
    class Vector3d {
        /**
         * @param {number} [x=0] x value of the vector
         * @param {number} [y=0] y value of the vector
         * @param {number} [z=0] z value of the vector
         */
        constructor(x?: number, y?: number, z?: number);
        /**
         * @ignore
         */
        onResetEvent(x?: number, y?: number, z?: number): Vector3d;
        x: any;
        y: any;
        z: any;
        /**
         * @ignore
         */
        _set(x: any, y: any, z?: number): Vector3d;
        /**
         * set the Vector x and y properties to the given values<br>
         * @name set
         * @memberof Vector3d
         * @param {number} x
         * @param {number} y
         * @param {number} [z=0]
         * @returns {Vector3d} Reference to this object for method chaining
         */
        set(x: number, y: number, z?: number): Vector3d;
        /**
         * set the Vector x and y properties to 0
         * @name setZero
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        setZero(): Vector3d;
        /**
         * set the Vector x and y properties using the passed vector
         * @name setV
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        setV(v: Vector2d | Vector3d): Vector3d;
        /**
         * Add the passed vector to this vector
         * @name add
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        add(v: Vector2d | Vector3d): Vector3d;
        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        sub(v: Vector2d | Vector3d): Vector3d;
        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberof Vector3d
         * @param {number} x
         * @param {number} [y=x]
         * @param {number} [z=1]
         * @returns {Vector3d} Reference to this object for method chaining
         */
        scale(x: number, y?: number, z?: number): Vector3d;
        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        scaleV(v: Vector2d | Vector3d): Vector3d;
        /**
         * Convert this vector into isometric coordinate space
         * @name toIso
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        toIso(): Vector3d;
        /**
         * Convert this vector into 2d coordinate space
         * @name to2d
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        to2d(): Vector3d;
        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberof Vector3d
         * @param {number} n the value to divide the vector by
         * @returns {Vector3d} Reference to this object for method chaining
         */
        div(n: number): Vector3d;
        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        abs(): Vector3d;
        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberof Vector3d
         * @param {number} low
         * @param {number} high
         * @returns {Vector3d} new me.Vector3d
         */
        clamp(low: number, high: number): Vector3d;
        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberof Vector3d
         * @param {number} low
         * @param {number} high
         * @returns {Vector3d} Reference to this object for method chaining
         */
        clampSelf(low: number, high: number): Vector3d;
        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        minV(v: Vector2d | Vector3d): Vector3d;
        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        maxV(v: Vector2d | Vector3d): Vector3d;
        /**
         * Floor the vector values
         * @name floor
         * @memberof Vector3d
         * @returns {Vector3d} new me.Vector3d
         */
        floor(): Vector3d;
        /**
         * Floor this vector values
         * @name floorSelf
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        floorSelf(): Vector3d;
        /**
         * Ceil the vector values
         * @name ceil
         * @memberof Vector3d
         * @returns {Vector3d} new me.Vector3d
         */
        ceil(): Vector3d;
        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        ceilSelf(): Vector3d;
        /**
         * Negate the vector values
         * @name negate
         * @memberof Vector3d
         * @returns {Vector3d} new me.Vector3d
         */
        negate(): Vector3d;
        /**
         * Negate this vector values
         * @name negateSelf
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        negateSelf(): Vector3d;
        /**
         * Copy the components of the given vector into this one
         * @name copy
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        copy(v: Vector2d | Vector3d): Vector3d;
        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberof Vector3d
         * @method
         * @param {Vector2d|Vector3d} v
         * @returns {boolean}
         */
        /**
         * return true if this vector is equal to the given values
         * @name equals
         * @memberof Vector3d
         * @param {number} x
         * @param {number} y
         * @param {number} [z]
         * @returns {boolean}
         */
        equals(...args: any[]): boolean;
        /**
         * normalize this vector (scale the vector so that its magnitude is 1)
         * @name normalize
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        normalize(): Vector3d;
        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
         * @name perp
         * @memberof Vector3d
         * @returns {Vector3d} Reference to this object for method chaining
         */
        perp(): Vector3d;
        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
         * @name rotate
         * @memberof Vector3d
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
         * @returns {Vector3d} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): Vector3d;
        /**
         * return the dot product of this vector and the passed one
         * @name dot
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {number} The dot product.
         */
        dot(v: Vector2d | Vector3d): number;
        /**
         * calculate the cross product of this vector and the passed one
         * @name cross
         * @memberof Vector3d
         * @param {Vector3d} v
         * @returns {Vector3d} Reference to this object for method chaining
         */
        cross(v: Vector3d): Vector3d;
        /**
         * return the square length of this vector
         * @name length2
         * @memberof Vector3d
         * @returns {number} The length^2 of this vector.
         */
        length2(): number;
        /**
         * return the length (magnitude) of this vector
         * @name length
         * @memberof Vector3d
         * @returns {number} the length of this vector
         */
        length(): number;
        /**
         * Linearly interpolate between this vector and the given one.
         * @name lerp
         * @memberof Vector3d
         * @param {Vector3d} v
         * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
         * @returns {Vector3d} Reference to this object for method chaining
         */
        lerp(v: Vector3d, alpha: number): Vector3d;
        /**
         * interpolate the position of this vector on the x and y axis towards the given one by the given maximum step.
         * @name moveTowards
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} target
         * @param {number} step the maximum step per iteration (Negative values will push the vector away from the target)
         * @returns {Vector3d} Reference to this object for method chaining
         */
        moveTowards(target: Vector2d | Vector3d, step: number): Vector3d;
        /**
         * return the distance between this vector and the passed one
         * @name distance
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {number}
         */
        distance(v: Vector2d | Vector3d): number;
        /**
         * return the angle between this vector and the passed one
         * @name angle
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v
         * @returns {number} angle in radians
         */
        angle(v: Vector2d | Vector3d): number;
        /**
         * project this vector on to another vector.
         * @name project
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v The vector to project onto.
         * @returns {Vector3d} Reference to this object for method chaining
         */
        project(v: Vector2d | Vector3d): Vector3d;
        /**
         * Project this vector onto a vector of unit length.<br>
         * This is slightly more efficient than `project` when dealing with unit vectors.
         * @name projectN
         * @memberof Vector3d
         * @param {Vector2d|Vector3d} v The unit vector to project onto.
         * @returns {Vector3d} Reference to this object for method chaining
         */
        projectN(v: Vector2d | Vector3d): Vector3d;
        /**
         * return a clone copy of this vector
         * @name clone
         * @memberof Vector3d
         * @returns {Vector3d} new me.Vector3d
         */
        clone(): Vector3d;
        /**
         * convert the object to a string representation
         * @name toString
         * @memberof Vector3d
         * @returns {string}
         */
        toString(): string;
    }
}
declare module "math/observable_vector3" {
    export default ObservableVector3d;
    /**
     * @classdesc
     * A Vector3d object that provide notification by executing the given callback when the vector is changed.
     * @augments Vector3d
     */
    class ObservableVector3d extends Vector3d {
        /**
         * @param {number} x x value of the vector
         * @param {number} y y value of the vector
         * @param {number} z z value of the vector
         * @param {object} settings additional required parameters
         * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
         * @param {object} [settings.scope] the value to use as this when calling onUpdate
         */
        constructor(x: number, y: number, z: number, settings: {
            onUpdate: Function;
            scope?: object;
        });
        /**
         * @ignore
         */
        onResetEvent(x: number, y: number, z: number, settings: any): ObservableVector3d;
        public set x(arg: number);
        /**
         * x value of the vector
         * @public
         * @type {number}
         * @name x
         * @memberof ObservableVector3d
         */
        public get x(): number;
        _x: any;
        public set y(arg: number);
        /**
         * y value of the vector
         * @public
         * @type {number}
         * @name y
         * @memberof ObservableVector3d
         */
        public get y(): number;
        _y: any;
        public set z(arg: number);
        /**
         * z value of the vector
         * @public
         * @type {number}
         * @name z
         * @memberof ObservableVector3d
         */
        public get z(): number;
        _z: any;
        /**
         * @ignore
         */
        _set(x: any, y: any, z: any): ObservableVector3d;
        /**
         * set the vector value without triggering the callback
         * @name setMuted
         * @memberof ObservableVector3d
         * @param {number} x x value of the vector
         * @param {number} y y value of the vector
         * @param {number} [z=0] z value of the vector
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        setMuted(x: number, y: number, z?: number): ObservableVector3d;
        /**
         * set the callback to be executed when the vector is changed
         * @name setCallback
         * @memberof ObservableVector3d
         * @param {Function} fn callback
         * @param {Function} [scope=null] scope
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        setCallback(fn: Function, scope?: Function): ObservableVector3d;
        onUpdate: Function;
        scope: Function;
        /**
         * Add the passed vector to this vector
         * @name add
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        add(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        sub(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberof ObservableVector3d
         * @param {number} x
         * @param {number} [y=x]
         * @param {number} [z=1]
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        scale(x: number, y?: number, z?: number): ObservableVector3d;
        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        scaleV(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberof ObservableVector3d
         * @param {number} n the value to divide the vector by
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        div(n: number): ObservableVector3d;
        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        abs(): ObservableVector3d;
        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberof ObservableVector3d
         * @param {number} low
         * @param {number} high
         * @returns {ObservableVector3d} new me.ObservableVector3d
         */
        clamp(low: number, high: number): ObservableVector3d;
        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberof ObservableVector3d
         * @param {number} low
         * @param {number} high
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        clampSelf(low: number, high: number): ObservableVector3d;
        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        minV(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        maxV(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
        /**
         * Floor the vector values
         * @name floor
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} new me.ObservableVector3d
         */
        floor(): ObservableVector3d;
        /**
         * Floor this vector values
         * @name floorSelf
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        floorSelf(): ObservableVector3d;
        /**
         * Ceil the vector values
         * @name ceil
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} new me.ObservableVector3d
         */
        ceil(): ObservableVector3d;
        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        ceilSelf(): ObservableVector3d;
        /**
         * Negate the vector values
         * @name negate
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} new me.ObservableVector3d
         */
        negate(): ObservableVector3d;
        /**
         * Negate this vector values
         * @name negateSelf
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        negateSelf(): ObservableVector3d;
        /**
         * Copy the components of the given vector into this one
         * @name copy
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        copy(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberof ObservableVector3d
         * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
         * @returns {boolean}
         */
        equals(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): boolean;
        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction)
         * @name perp
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        perp(): ObservableVector3d;
        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberof ObservableVector3d
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): ObservableVector3d;
        /**
         * calculate the cross product of this vector and the passed one
         * @name cross
         * @memberof ObservableVector3d
         * @param {Vector3d|ObservableVector3d} v
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        cross(v: Vector3d | ObservableVector3d): ObservableVector3d;
        /**
         * Linearly interpolate between this vector and the given one.
         * @name lerp
         * @memberof ObservableVector3d
         * @param {Vector3d|ObservableVector3d} v
         * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        lerp(v: Vector3d | ObservableVector3d, alpha: number): ObservableVector3d;
        /**
         * interpolate the position of this vector on the x and y axis towards the given one while ensure that the distance never exceeds the given step.
         * @name moveTowards
         * @memberof ObservableVector3d
         * @param {Vector2d|ObservableVector2d|Vector3d|ObservableVector3d} target
         * @param {number} step the maximum step per iteration (Negative values will push the vector away from the target)
         * @returns {ObservableVector3d} Reference to this object for method chaining
         */
        moveTowards(target: Vector2d | ObservableVector2d | Vector3d | ObservableVector3d, step: number): ObservableVector3d;
        /**
         * return a clone copy of this vector
         * @name clone
         * @memberof ObservableVector3d
         * @returns {ObservableVector3d} new me.ObservableVector3d
         */
        clone(): ObservableVector3d;
        /**
         * return a `me.Vector3d` copy of this `me.ObservableVector3d` object
         * @name toVector3d
         * @memberof ObservableVector3d
         * @returns {Vector3d} new me.Vector3d
         */
        toVector3d(): Vector3d;
    }
    import Vector3d from "math/vector3";
}
declare module "input/keyboard" {
    /**
     * enable keyboard event
     * @ignore
     */
    export function initKeyboardEvent(): void;
    /**
     * return the key press status of the specified action
     * @name isKeyPressed
     * @memberof input
     * @public
     * @param {string} action user defined corresponding action
     * @returns {boolean} true if pressed
     * @example
     * if (me.input.isKeyPressed('left')) {
     *    //do something
     * }
     * else if (me.input.isKeyPressed('right')) {
     *    //do something else...
     * }
     */
    export function isKeyPressed(action: string): boolean;
    /**
     * return the key status of the specified action
     * @name keyStatus
     * @memberof input
     * @public
     * @param {string} action user defined corresponding action
     * @returns {boolean} down (true) or up(false)
     */
    export function keyStatus(action: string): boolean;
    /**
     * trigger the specified key (simulated) event <br>
     * @name triggerKeyEvent
     * @memberof input
     * @public
     * @param {number} keycode (See {@link input.KEY})
     * @param {boolean} [status=false] true to trigger a key down event, or false for key up event
     * @param {number} [mouseButton] the mouse button to trigger
     * @example
     * // trigger a key press
     * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
     */
    export function triggerKeyEvent(keycode: number, status?: boolean, mouseButton?: number): void;
    /**
     * associate a user defined action to a keycode
     * @name bindKey
     * @memberof input
     * @public
     * @param {number} keycode (See {@link input.KEY})
     * @param {string} action user defined corresponding action
     * @param {boolean} [lock=false] cancel the keypress event once read
     * @param {boolean} [preventDefault=input.preventDefault] prevent default browser action
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.LEFT,  "left");
     * me.input.bindKey(me.input.KEY.RIGHT, "right");
     * me.input.bindKey(me.input.KEY.X,     "jump", true);
     * me.input.bindKey(me.input.KEY.F1,    "options", true, true);
     */
    export function bindKey(keycode: number, action: string, lock?: boolean, preventDefault?: boolean): void;
    /**
     * return the action associated with the given keycode
     * @name getBindingKey
     * @memberof input
     * @public
     * @param {number} keycode (See {@link input.KEY})
     * @returns {string} user defined associated action
     */
    export function getBindingKey(keycode: number): string;
    /**
     * unlock a key manually
     * @name unlockKey
     * @memberof input
     * @public
     * @param {string} action user defined corresponding action
     * @example
     * // Unlock jump when touching the ground
     * if (!this.falling && !this.jumping) {
     *     me.input.unlockKey("jump");
     * }
     */
    export function unlockKey(action: string): void;
    /**
     * unbind the defined keycode
     * @name unbindKey
     * @memberof input
     * @public
     * @param {number} keycode (See {@link input.KEY})
     * @example
     * me.input.unbindKey(me.input.KEY.LEFT);
     */
    export function unbindKey(keycode: number): void;
    /**
     * the default target element for keyboard events (usually the window element in which the game is running)
     * @public
     * @type {EventTarget}
     * @name keyBoardEventTarget
     * @memberof input
     */
    export const keyBoardEventTarget: EventTarget;
    /**
     * *
     */
    export type KEY = number;
    export namespace KEY {
        const BACKSPACE: number;
        const TAB: number;
        const ENTER: number;
        const SHIFT: number;
        const CTRL: number;
        const ALT: number;
        const PAUSE: number;
        const CAPS_LOCK: number;
        const ESC: number;
        const SPACE: number;
        const PAGE_UP: number;
        const PAGE_DOWN: number;
        const END: number;
        const HOME: number;
        const LEFT: number;
        const UP: number;
        const RIGHT: number;
        const DOWN: number;
        const PRINT_SCREEN: number;
        const INSERT: number;
        const DELETE: number;
        const NUM0: number;
        const NUM1: number;
        const NUM2: number;
        const NUM3: number;
        const NUM4: number;
        const NUM5: number;
        const NUM6: number;
        const NUM7: number;
        const NUM8: number;
        const NUM9: number;
        const A: number;
        const B: number;
        const C: number;
        const D: number;
        const E: number;
        const F: number;
        const G: number;
        const H: number;
        const I: number;
        const J: number;
        const K: number;
        const L: number;
        const M: number;
        const N: number;
        const O: number;
        const P: number;
        const Q: number;
        const R: number;
        const S: number;
        const T: number;
        const U: number;
        const V: number;
        const W: number;
        const X: number;
        const Y: number;
        const Z: number;
        const WINDOW_KEY: number;
        const NUMPAD0: number;
        const NUMPAD1: number;
        const NUMPAD2: number;
        const NUMPAD3: number;
        const NUMPAD4: number;
        const NUMPAD5: number;
        const NUMPAD6: number;
        const NUMPAD7: number;
        const NUMPAD8: number;
        const NUMPAD9: number;
        const MULTIPLY: number;
        const ADD: number;
        const SUBSTRACT: number;
        const DECIMAL: number;
        const DIVIDE: number;
        const F1: number;
        const F2: number;
        const F3: number;
        const F4: number;
        const F5: number;
        const F6: number;
        const F7: number;
        const F8: number;
        const F9: number;
        const F10: number;
        const F11: number;
        const F12: number;
        const TILDE: number;
        const NUM_LOCK: number;
        const SCROLL_LOCK: number;
        const SEMICOLON: number;
        const PLUS: number;
        const COMMA: number;
        const MINUS: number;
        const PERIOD: number;
        const FORWAND_SLASH: number;
        const GRAVE_ACCENT: number;
        const OPEN_BRACKET: number;
        const BACK_SLASH: number;
        const CLOSE_BRACKET: number;
        const SINGLE_QUOTE: number;
    }
}
declare module "input/pointer" {
    export default Pointer;
    /**
     * @classdesc
     * a pointer object, representing a single finger on a touch enabled device.
     * @class Pointer
     * @augments Bounds
     */
    class Pointer extends Bounds {
        /**
         * @ignore
         */
        constructor(x?: number, y?: number, w?: number, h?: number);
        /**
         * constant for left button
         * @public
         * @type {number}
         * @name LEFT
         * @memberof Pointer
         */
        public LEFT: number;
        /**
         * constant for middle button
         * @public
         * @type {number}
         * @name MIDDLE
         * @memberof Pointer
         */
        public MIDDLE: number;
        /**
         * constant for right button
         * @public
         * @type {number}
         * @name RIGHT
         * @memberof Pointer
         */
        public RIGHT: number;
        /**
         * the originating Event Object
         * @public
         * @type {PointerEvent|TouchEvent|MouseEvent}
         * @name event
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
         * @see https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
         * @memberof Pointer
         */
        public event: PointerEvent | TouchEvent | MouseEvent;
        /**
         * a string containing the event's type.
         * @public
         * @type {string}
         * @name type
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/type
         * @memberof Pointer
         */
        public type: string;
        /**
         * the button property indicates which button was pressed on the mouse to trigger the event.
         * @public
         * @type {number}
         * @name button
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
         * @memberof Pointer
         */
        public button: number;
        /**
         * indicates whether or not the pointer device that created the event is the primary pointer.
         * @public
         * @type {boolean}
         * @name isPrimary
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
         * @memberof Pointer
         */
        public isPrimary: boolean;
        /**
         * the horizontal coordinate at which the event occurred, relative to the left edge of the entire document.
         * @public
         * @type {number}
         * @name pageX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageX
         * @memberof Pointer
         */
        public pageX: number;
        /**
         * the vertical coordinate at which the event occurred, relative to the left edge of the entire document.
         * @public
         * @type {number}
         * @name pageY
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/pageY
         * @memberof Pointer
         */
        public pageY: number;
        /**
         * the horizontal coordinate within the application's client area at which the event occurred
         * @public
         * @type {number}
         * @name clientX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
         * @memberof Pointer
         */
        public clientX: number;
        /**
         * the vertical coordinate within the application's client area at which the event occurred
         * @public
         * @type {number}
         * @name clientY
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
         * @memberof Pointer
         */
        public clientY: number;
        /**
         * the difference in the X coordinate of the pointer since the previous move event
         * @public
         * @type {number}
         * @name movementX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
         * @memberof Pointer
         */
        public movementX: number;
        /**
         * the difference in the Y coordinate of the pointer since the previous move event
         * @public
         * @type {number}
         * @name movementY
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementY
         * @memberof Pointer
         */
        public movementY: number;
        /**
         * an unsigned long representing the unit of the delta values scroll amount
         * @public
         * @type {number}
         * @name deltaMode
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
         * @memberof Pointer
         */
        public deltaMode: number;
        /**
         * a double representing the horizontal scroll amount in the Wheel Event deltaMode unit.
         * @public
         * @type {number}
         * @name deltaX
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaX
         * @memberof Pointer
         */
        public deltaX: number;
        /**
         * a double representing the vertical scroll amount in the Wheel Event deltaMode unit.
         * @public
         * @type {number}
         * @name deltaY
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
         * @memberof Pointer
         */
        public deltaY: number;
        /**
         * a double representing the scroll amount in the z-axis, in the Wheel Event deltaMode unit.
         * @public
         * @type {number}
         * @name deltaZ
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaZ
         * @memberof Pointer
         */
        public deltaZ: number;
        /**
         * Event normalized X coordinate within the game canvas itself<br>
         * <img src="images/event_coord.png"/>
         * @public
         * @type {number}
         * @name gameX
         * @memberof Pointer
         */
        public gameX: number;
        /**
         * Event normalized Y coordinate within the game canvas itself<br>
         * <img src="images/event_coord.png"/>
         * @public
         * @type {number}
         * @name gameY
         * @memberof Pointer
         */
        public gameY: number;
        /**
         * Event X coordinate relative to the viewport
         * @public
         * @type {number}
         * @name gameScreenX
         * @memberof Pointer
         */
        public gameScreenX: number;
        /**
         * Event Y coordinate relative to the viewport
         * @public
         * @type {number}
         * @name gameScreenY
         * @memberof Pointer
         */
        public gameScreenY: number;
        /**
         * Event X coordinate relative to the map
         * @public
         * @type {number}
         * @name gameWorldX
         * @memberof Pointer
         */
        public gameWorldX: number;
        /**
         * Event Y coordinate relative to the map
         * @public
         * @type {number}
         * @name gameWorldY
         * @memberof Pointer
         */
        public gameWorldY: number;
        /**
         * Event X coordinate relative to the holding container
         * @public
         * @type {number}
         * @name gameLocalX
         * @memberof Pointer
         */
        public gameLocalX: number;
        /**
         * Event Y coordinate relative to the holding container
         * @public
         * @type {number}
         * @name gameLocalY
         * @memberof Pointer
         */
        public gameLocalY: number;
        /**
         * The unique identifier of the contact for a touch, mouse or pen
         * @public
         * @type {number}
         * @name pointerId
         * @memberof Pointer
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
         */
        public pointerId: number;
        /**
         * true if not originally a pointer event
         * @public
         * @type {boolean}
         * @name isNormalized
         * @memberof Pointer
         */
        public isNormalized: boolean;
        /**
         * true if the pointer is currently locked
         * @public
         * @type {boolean}
         * @name locked
         * @memberof Pointer
         */
        public locked: boolean;
        bind: number[];
        /**
         * initialize the Pointer object using the given Event Object
         * @name Pointer#set
         * @private
         * @param {Event} event the original Event object
         * @param {number} [pageX=0] the horizontal coordinate at which the event occurred, relative to the left edge of the entire document
         * @param {number} [pageY=0] the vertical coordinate at which the event occurred, relative to the left edge of the entire document
         * @param {number} [clientX=0] the horizontal coordinate within the application's client area at which the event occurred
         * @param {number} [clientY=0] the vertical coordinate within the application's client area at which the event occurred
         * @param {number} [pointerId=1] the Pointer, Touch or Mouse event Id (1)
         */
        private setEvent;
    }
    import Bounds from "physics/bounds";
}
declare module "input/pointerevent" {
    /**
     * Translate the specified x and y values from the global (absolute)
     * coordinate to local (viewport) relative coordinate.
     * @name globalToLocal
     * @memberof input
     * @public
     * @param {number} x the global x coordinate to be translated.
     * @param {number} y the global y coordinate to be translated.
     * @param {Vector2d} [v] an optional vector object where to set the translated coordinates
     * @returns {Vector2d} A vector object with the corresponding translated coordinates
     * @example
     * onMouseEvent : function (pointer) {
     *    // convert the given into local (viewport) relative coordinates
     *    var pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
     *    // do something with pos !
     * };
     */
    export function globalToLocal(x: number, y: number, v?: Vector2d): Vector2d;
    /**
     * enable/disable all gestures on the given element.<br>
     * by default melonJS will disable browser handling of all panning and zooming gestures.
     * @name setTouchAction
     * @memberof input
     * @see https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
     * @public
     * @param {HTMLCanvasElement} element
     * @param {string} [value="none"]
     */
    export function setTouchAction(element: HTMLCanvasElement, value?: string): void;
    /**
     * Associate a pointer event to a keycode<br>
     * Left button – 0
     * Middle button – 1
     * Right button – 2
     * @name bindPointer
     * @memberof input
     * @public
     * @param {number} [button=input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
     * @param {input.KEY} keyCode
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.X, "shoot");
     * // map the left button click on the X key (default if the button is not specified)
     * me.input.bindPointer(me.input.KEY.X);
     * // map the right button click on the X key
     * me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.X);
     */
    export function bindPointer(...args: any[]): void;
    /**
     * unbind the defined keycode
     * @name unbindPointer
     * @memberof input
     * @public
     * @param {number} [button=input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
     * @example
     * me.input.unbindPointer(me.input.pointer.LEFT);
     */
    export function unbindPointer(button?: number): void;
    /**
     * allows registration of event listeners on the object target. <br>
     * melonJS will pass a me.Pointer object to the defined callback.
     * @see Pointer
     * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
     * @name registerPointerEvent
     * @memberof input
     * @public
     * @param {string} eventType The event type for which the object is registering <br>
     * melonJS currently supports: <br>
     * <ul>
     *   <li><code>"pointermove"</code></li>
     *   <li><code>"pointerdown"</code></li>
     *   <li><code>"pointerup"</code></li>
     *   <li><code>"pointerenter"</code></li>
     *   <li><code>"pointerover"</code></li>
     *   <li><code>"pointerleave"</code></li>
     *   <li><code>"pointercancel"</code></li>
     *   <li><code>"wheel"</code></li>
     * </ul>
     * @param {Rect|Polygon|Line|Ellipse} region a shape representing the region to register on
     * @param {Function} callback methods to be called when the event occurs.
     * Returning `false` from the defined callback will prevent the event to be propagated to other objects
     * @example
     *  // onActivate function
     *  onActivateEvent: function () {
     *     // register on the 'pointerdown' event
     *     me.input.registerPointerEvent('pointerdown', this, this.pointerDown.bind(this));
     *  },
     *
     *  // pointerDown event callback
     *  pointerDown: function (pointer) {
     *    // do something
     *    ....
     *    // don"t propagate the event to other objects
     *    return false;
     *  },
     */
    export function registerPointerEvent(eventType: string, region: Rect | Polygon | Line | Ellipse, callback: Function): void;
    /**
     * allows the removal of event listeners from the object target.
     * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
     * @name releasePointerEvent
     * @memberof input
     * @public
     * @param {string} eventType The event type for which the object was registered. See {@link input.registerPointerEvent}
     * @param {Rect|Polygon|Line|Ellipse} region the registered region to release for this event
     * @param {Function} [callback="all"] if specified unregister the event only for the specific callback
     * @example
     * // release the registered region on the 'pointerdown' event
     * me.input.releasePointerEvent('pointerdown', this);
     */
    export function releasePointerEvent(eventType: string, region: Rect | Polygon | Line | Ellipse, callback?: Function): void;
    /**
     * allows the removal of all registered event listeners from the object target.
     * @name releaseAllPointerEvents
     * @memberof input
     * @public
     * @param {Rect|Polygon|Line|Ellipse} region the registered region to release event from
     * @example
     * // release all registered event on the
     * me.input.releaseAllPointerEvents(this);
     */
    export function releaseAllPointerEvents(region: Rect | Polygon | Line | Ellipse): void;
    /**
     * request for the pointer to be locked on the parent DOM element.
     * (Must be called in a click event or an event that requires user interaction)
     * @name requestPointerLock
     * @memberof input
     * @public
     * @returns {boolean} return true if the request was successfully submitted
     * @example
     * // register on the pointer lock change event
     * event.on(event.POINTERLOCKCHANGE, (locked)=> {
     *     console.log("pointer lock: " + locked);
     * });
     * // request for pointer lock
     * me.input.requestPointerLock();
     */
    export function requestPointerLock(): boolean;
    /**
     * Initiates an exit from pointer lock state
     * @name exitPointerLock
     * @memberof input
     * @public
     * @returns {boolean} return true if the request was successfully submitted
     */
    export function exitPointerLock(): boolean;
    /**
     * the default target element for pointer events (usually the canvas element in which the game is rendered)
     * @public
     * @type {EventTarget}
     * @name pointerEventTarget
     * @memberof input
     */
    export const pointerEventTarget: EventTarget;
    /**
     * Pointer information (current position and size)
     * @public
     * @type {Rect}
     * @name pointer
     * @memberof input
     */
    export const pointer: Rect;
    /**
     * indicates if the pointer is currently locked
     * @public
     * @type {boolean}
     * @name locked
     * @memberof input
     */
    export const locked: boolean;
    /**
     * time interval for event throttling in milliseconds<br>
     * default value : "1000/me.timer.maxfps" ms<br>
     * set to 0 ms to disable the feature
     * @public
     * @type {number}
     * @name throttlingInterval
     * @memberof input
     */
    export const throttlingInterval: number;
    import Rect from "geometries/rectangle";
}
declare module "input/gamepad" {
    /**
     * Associate a gamepad event to a keycode
     * @name bindGamepad
     * @memberof input
     * @public
     * @param {number} index Gamepad index
     * @param {object} button Button/Axis definition
     * @param {string} button.type "buttons" or "axes"
     * @param {number} button.code button or axis code id (See {@link input.GAMEPAD.BUTTONS}, {@link input.GAMEPAD.AXES})
     * @param {number} [button.threshold=1] value indicating when the axis should trigger the keycode (e.g. -0.5 or 0.5)
     * @param {number} keyCode (See {@link input.KEY})
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.X, "shoot");
     * ...
     * // map the lower face button on the first gamepad to the X key
     * me.input.bindGamepad(0, {type:"buttons", code: me.input.GAMEPAD.BUTTONS.FACE_1}, me.input.KEY.X);
     * // map the left axis value on the first gamepad to the LEFT key
     * me.input.bindGamepad(0, {type:"axes", code: me.input.GAMEPAD.AXES.LX, threshold: -0.5}, me.input.KEY.LEFT);
     */
    export function bindGamepad(index: number, button: {
        type: string;
        code: number;
        threshold?: number;
    }, keyCode: number): void;
    /**
     * unbind the defined keycode
     * @name unbindGamepad
     * @memberof input
     * @public
     * @param {number} index Gamepad index
     * @param {number} button (See {@link input.GAMEPAD.BUTTONS})
     * @example
     * me.input.unbindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1);
     */
    export function unbindGamepad(index: number, button: number): void;
    /**
     * Set deadzone for analog gamepad inputs<br>
     * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
     * @name setGamepadDeadzone
     * @memberof input
     * @public
     * @param {number} value Deadzone value
     */
    export function setGamepadDeadzone(value: number): void;
    export namespace GAMEPAD {
        namespace AXES {
            const LX: number;
            const LY: number;
            const RX: number;
            const RY: number;
            const EXTRA_1: number;
            const EXTRA_2: number;
            const EXTRA_3: number;
            const EXTRA_4: number;
        }
        namespace BUTTONS {
            export const FACE_1: number;
            export const FACE_2: number;
            export const FACE_3: number;
            export const FACE_4: number;
            export const L1: number;
            export const R1: number;
            export const L2: number;
            export const R2: number;
            export const SELECT: number;
            export const BACK: number;
            export const START: number;
            export const FORWARD: number;
            export const L3: number;
            export const R3: number;
            export const UP: number;
            export const DOWN: number;
            export const LEFT: number;
            export const RIGHT: number;
            export const HOME: number;
            const EXTRA_1_1: number;
            export { EXTRA_1_1 as EXTRA_1 };
            const EXTRA_2_1: number;
            export { EXTRA_2_1 as EXTRA_2 };
            const EXTRA_3_1: number;
            export { EXTRA_3_1 as EXTRA_3 };
            const EXTRA_4_1: number;
            export { EXTRA_4_1 as EXTRA_4 };
        }
    }
    /**
     * Firefox reports different ids for gamepads depending on the platform:
     * - Windows: vendor and product codes contain leading zeroes
     * - Mac: vendor and product codes are sparse (no leading zeroes)
     *
     * This function normalizes the id to support both formats
     * @ignore
     */
    export function setGamepadMapping(id: any, mapping: any): void;
}
declare module "input/input" {
    /**
     * @namespace input
     */
    /**
     * specify if melonJS should prevent all default browser action on registered events.
     * @public
     * @type {boolean}
     * @default true
     * @name preventDefault
     * @memberof input
     */
    export const preventDefault: boolean;
    export * from "input/pointerevent";
    export * from "input/keyboard";
    export * from "input/gamepad";
}
declare module "renderable/renderable" {
    export default Renderable;
    /**
     * @classdesc
     * A base class for renderable objects.
     * @augments Rect
     */
    class Renderable extends Rect {
        /**
         * to identify the object as a renderable object
         * @ignore
         */
        isRenderable: boolean;
        /**
         * If true then physic collision and input events will not impact this renderable
         * @type {boolean}
         * @default true
         */
        isKinematic: boolean;
        /**
         * the renderable physic body
         * @type {Body}
         * @example
         *  // define a new Player Class
         *  class PlayerEntity extends me.Sprite {
         *      // constructor
         *      constructor(x, y, settings) {
         *          // call the parent constructor
         *          super(x, y , settings);
         *
         *          // define a basic walking animation
         *          this.addAnimation("walk",  [...]);
         *          // define a standing animation (using the first frame)
         *          this.addAnimation("stand",  [...]);
         *          // set the standing animation as default
         *          this.setCurrentAnimation("stand");
         *
         *          // add a physic body
         *          this.body = new me.Body(this);
         *          // add a default collision shape
         *          this.body.addShape(new me.Rect(0, 0, this.width, this.height));
         *          // configure max speed, friction, and initial force to be applied
         *          this.body.setMaxVelocity(3, 15);
         *          this.body.setFriction(0.4, 0);
         *          this.body.force.set(3, 0);
         *
         *          // set the display to follow our position on both axis
         *          me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
         *      }
         *
         *      ...
         *
         * }
         */
        body: Body;
        /**
         * the renderable default transformation matrix
         * @type {Matrix2d}
         */
        currentTransform: Matrix2d;
        /**
         * (G)ame (U)nique (Id)entifier" <br>
         * a GUID will be allocated for any renderable object added <br>
         * to an object container (including the `me.game.world` container)
         * @type {string}
         */
        GUID: string;
        /**
         * an event handler that is called when the renderable leave or enter a camera viewport
         * @type {Function}
         * @default undefined
         * @example
         * this.onVisibilityChange = function(inViewport) {
         *     if (inViewport === true) {
         *         console.log("object has entered the in a camera viewport!");
         *     }
         * };
         */
        onVisibilityChange: Function;
        /**
         * Whether the renderable object will always update, even when outside of the viewport<br>
         * @type {boolean}
         * @default false
         */
        alwaysUpdate: boolean;
        /**
         * Whether to update this object when the game is paused.
         * @type {boolean}
         * @default false
         */
        updateWhenPaused: boolean;
        /**
         * make the renderable object persistent over level changes<br>
         * @type {boolean}
         * @default false
         */
        isPersistent: boolean;
        /**
         * If true, this renderable will be rendered using screen coordinates,
         * as opposed to world coordinates. Use this, for example, to define UI elements.
         * @type {boolean}
         * @default false
         */
        floating: boolean;
        /**
         * The anchor point is used for attachment behavior, and/or when applying transformations.<br>
         * The coordinate system places the origin at the top left corner of the frame (0, 0) and (1, 1) means the bottom-right corner<br>
         * <img src="images/anchor_point.png"/><br>
         * a Renderable's anchor point defaults to (0.5,0.5), which corresponds to the center position.<br>
         * <br>
         * <i><b>Note:</b> Object created through Tiled will have their anchorPoint set to (0, 0) to match Tiled Level editor implementation.
         * To specify a value through Tiled, use a json expression like `json:{"x":0.5,"y":0.5}`. </i>
         * @type {ObservableVector2d}
         * @default <0.5,0.5>
         */
        anchorPoint: ObservableVector2d;
        /**
         * When enabled, an object container will automatically apply
         * any defined transformation before calling the child draw method.
         * @type {boolean}
         * @default true
         * @example
         * // enable "automatic" transformation when the object is activated
         * onActivateEvent: function () {
         *     // reset the transformation matrix
         *     this.currentTransform.identity();
         *     // ensure the anchor point is the renderable center
         *     this.anchorPoint.set(0.5, 0.5);
         *     // enable auto transform
         *     this.autoTransform = true;
         *     ....
         * }
         */
        autoTransform: boolean;
        /**
         * Define the renderable opacity<br>
         * Set to zero if you do not wish an object to be drawn
         * @see Renderable#setOpacity
         * @see Renderable#getOpacity
         * @type {number}
         * @default 1.0
         */
        alpha: number;
        /**
         * a reference to the parent object that contains this renderable
         * @type {Container|Entity}
         * @default undefined
         */
        ancestor: Container | Entity;
        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * @type {Rect|RoundRect|Polygon|Line|Ellipse}
         * @default undefined
         * @example
         * // apply a mask in the shape of a Star
         * myNPCSprite.mask = new me.Polygon(myNPCSprite.width / 2, 0, [
         *    // draw a star
         *    {x: 0, y: 0},
         *    {x: 14, y: 30},
         *    {x: 47, y: 35},
         *    {x: 23, y: 57},
         *    {x: 44, y: 90},
         *    {x: 0, y: 62},
         *    {x: -44, y: 90},
         *    {x: -23, y: 57},
         *    {x: -47, y: 35},
         *    {x: -14, y: 30}
         * ]);
         */
        mask: Rect | RoundRect | Polygon | Line | Ellipse;
        /**
         * the blend mode to be applied to this renderable (see renderer setBlendMode for available blend mode)
         * @type {string}
         * @default "normal"
         * @see CanvasRenderer#setBlendMode
         * @see WebGLRenderer#setBlendMode
         */
        blendMode: string;
        /**
         * The name of the renderable
         * @type {string}
         * @default ""
         */
        name: string;
        /**
         * Position of the Renderable relative to its parent container
         * @public
         * @type {ObservableVector3d}
         */
        public pos: ObservableVector3d;
        /**
         * when true the renderable will be redrawn during the next update cycle
         * @type {boolean}
         * @default false
         */
        isDirty: boolean;
        _flip: {
            x: boolean;
            y: boolean;
        };
        _inViewport: boolean;
        /**
         * Whether the renderable object is floating, or contained in a floating container
         * @see Renderable#floating
         * @type {boolean}
         */
        get isFloating(): boolean;
        set tint(arg: Color);
        /**
         * define a tint for this renderable. a (255, 255, 255) r, g, b value will remove the tint effect.
         * @type {Color}
         * @default (255, 255, 255)
         * @example
         * // add a red tint to this renderable
         * this.tint.setColor(255, 128, 128);
         * // remove the tint
         * this.tint.setColor(255, 255, 255);
         */
        get tint(): Color;
        _tint: any;
        set inViewport(arg: boolean);
        /**
         * Whether the renderable object is visible and within the viewport
         * @type {boolean}
         * @default false
         */
        get inViewport(): boolean;
        /**
         * returns true if this renderable is flipped on the horizontal axis
         * @public
         * @see Renderable#flipX
         * @type {boolean}
         */
        public get isFlippedX(): boolean;
        /**
         * returns true if this renderable is flipped on the vertical axis
         * @public
         * @see Renderable#flipY
         * @type {boolean}
         */
        public get isFlippedY(): boolean;
        /**
         * get the renderable alpha channel value<br>
         * @returns {number} current opacity value between 0 and 1
         */
        getOpacity(): number;
        /**
         * set the renderable alpha channel value<br>
         * @param {number} alpha opacity value between 0.0 and 1.0
         */
        setOpacity(alpha: number): void;
        /**
         * flip the renderable on the horizontal axis (around the center of the renderable)
         * @see Matrix2d#scaleX
         * @param {boolean} [flip=true] `true` to flip this renderable.
         * @returns {Renderable} Reference to this object for method chaining
         */
        flipX(flip?: boolean): Renderable;
        /**
         * flip the renderable on the vertical axis (around the center of the renderable)
         * @see Matrix2d#scaleY
         * @param {boolean} [flip=true] `true` to flip this renderable.
         * @returns {Renderable} Reference to this object for method chaining
         */
        flipY(flip?: boolean): Renderable;
        /**
         * multiply the renderable currentTransform with the given matrix
         * @see Renderable#currentTransform
         * @param {Matrix2d} m the transformation matrix
         * @returns {Renderable} Reference to this object for method chaining
         */
        transform(m: Matrix2d): Renderable;
        /**
         * return the angle to the specified target
         * @param {Renderable|Vector2d|Vector3d} target
         * @returns {number} angle in radians
         */
        angleTo(target: Renderable | Vector2d | Vector3d): number;
        /**
         * return the distance to the specified target
         * @param {Renderable|Vector2d|Vector3d} target
         * @returns {number} distance
         */
        distanceTo(target: Renderable | Vector2d | Vector3d): number;
        /**
         * Rotate this renderable towards the given target.
         * @param {Renderable|Vector2d|Vector3d} target the renderable or position to look at
         * @returns {Renderable} Reference to this object for method chaining
         */
        lookAt(target: Renderable | Vector2d | Vector3d): Renderable;
        /**
         * Rotate this renderable by the specified angle (in radians).
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v] an optional point to rotate around
         * @returns {Renderable} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): Renderable;
        /**
         * scale the renderable around his anchor point.  Scaling actually applies changes
         * to the currentTransform member wich is used by the renderer to scale the object
         * when rendering.  It does not scale the object itself.  For example if the renderable
         * is an image, the image.width and image.height properties are unaltered but the currentTransform
         * member will be changed.
         * @param {number} x a number representing the abscissa of the scaling vector.
         * @param {number} [y=x] a number representing the ordinate of the scaling vector.
         * @returns {Renderable} Reference to this object for method chaining
         */
        scale(x: number, y?: number): Renderable;
        /**
         * scale the renderable around his anchor point
         * @param {Vector2d} v scaling vector
         * @returns {Renderable} Reference to this object for method chaining
         */
        scaleV(v: Vector2d): Renderable;
        /**
         * update function (automatically called by melonJS).
         * @param {number} dt time since the last update in milliseconds.
         * @returns {boolean} true if the renderable is dirty
         */
        update(dt: number): boolean;
        /**
         * update the renderable's bounding rect (private)
         * @ignore
         */
        updateBoundsPos(newX: any, newY: any): void;
        /**
         * return the renderable absolute position in the game world
         * @returns {Vector2d}
         */
        getAbsolutePosition(): Vector2d;
        _absPos: any;
        /**
         * called when the anchor point value is changed
         * @private
         * @param {number} x the new X value to be set for the anchor
         * @param {number} y the new Y value to be set for the anchor
         */
        private onAnchorUpdate;
        /**
         * Prepare the rendering context before drawing (automatically called by melonJS).
         * This will apply any defined transforms, anchor point, tint or blend mode and translate the context accordingly to this renderable position.
         * @see Renderable#draw
         * @see Renderable#postDraw
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer object
         */
        preDraw(renderer: CanvasRenderer | WebGLRenderer): void;
        /**
         * Draw this renderable (automatically called by melonJS).
         * All draw operations for renderable are made respectively
         * to the position or transforms set or applied by the preDraw method.
         * The main draw loop will first call preDraw() to prepare the context for drawing the renderable,
         * then draw() to draw the renderable, and finally postDraw() to clear the context.
         * If you override this method, be mindful about the drawing logic; for example if you draw a shape
         * from the draw method, you should make sure that your draw it at the 0, 0 coordinates.
         * @see Renderable#preDraw
         * @see Renderable#postDraw
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer instance
         * @param {Camera2d} [viewport] the viewport to (re)draw
         */
        draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: Camera2d): void;
        /**
         * restore the rendering context after drawing (automatically called by melonJS).
         * @see Renderable#preDraw
         * @see Renderable#draw
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer object
         */
        postDraw(renderer: CanvasRenderer | WebGLRenderer): void;
        /**
         * onCollision callback, triggered in case of collision,
         * when this renderable body is colliding with another one
         * @param {ResponseObject} response the collision response object
         * @param {Renderable} other the other renderable touching this one (a reference to response.a or response.b)
         * @returns {boolean} true if the object should respond to the collision (its position and velocity will be corrected)
         * @example
         * // colision handler
         * onCollision(response) {
         *     if (response.b.body.collisionType === me.collision.types.ENEMY_OBJECT) {
         *         // makes the other object solid, by substracting the overlap vector to the current position
         *         this.pos.sub(response.overlapV);
         *         this.hurt();
         *         // not solid
         *         return false;
         *     }
         *     // Make the object solid
         *     return true;
         * },
         */
        onCollision(response: ResponseObject, other: Renderable): boolean;
        /**
         * Destroy function<br>
         * @ignore
         */
        destroy(...args: any[]): void;
        /**
         * OnDestroy Notification function<br>
         * Called by engine before deleting the object
         */
        onDestroyEvent(): void;
    }
    import Rect from "geometries/rectangle";
    import ObservableVector2d from "math/observable_vector2";
    import Container from "renderable/container";
    import ObservableVector3d from "math/observable_vector3";
    import Color from "math/color";
}
declare module "physics/sat" {
    /**
     * Checks whether polygons collide.
     * @ignore
     * @param {Renderable} a a reference to the object A.
     * @param {Polygon} polyA a reference to the object A Polygon to be tested
     * @param {Renderable} b a reference to the object B.
     * @param {Polygon} polyB a reference to the object B Polygon to be tested
     * @param {Response=} response Response object (optional) that will be populated if they intersect.
     * @returns {boolean} true if they intersect, false if they don't.
     */
    export function testPolygonPolygon(a: Renderable, polyA: Polygon, b: Renderable, polyB: Polygon, response?: Response | undefined): boolean;
    /**
     * Check if two Ellipse collide.
     * @ignore
     * @param {Renderable} a a reference to the object A.
     * @param {Ellipse} ellipseA a reference to the object A Ellipse to be tested
     * @param {Renderable} b a reference to the object B.
     * @param {Ellipse} ellipseB a reference to the object B Ellipse to be tested
     * @param {Response=} response Response object (optional) that will be populated if
     *   the circles intersect.
     * @returns {boolean} true if the circles intersect, false if they don't.
     */
    export function testEllipseEllipse(a: Renderable, ellipseA: Ellipse, b: Renderable, ellipseB: Ellipse, response?: Response | undefined): boolean;
    /**
     * Check if a polygon and an ellipse collide.
     * @ignore
     * @param {Renderable} a a reference to the object A.
     * @param {Polygon} polyA a reference to the object A Polygon to be tested
     * @param {Renderable} b a reference to the object B.
     * @param {Ellipse} ellipseB a reference to the object B Ellipse to be tested
     * @param {Response=} response Response object (optional) that will be populated if they intersect.
     * @returns {boolean} true if they intersect, false if they don't.
     */
    export function testPolygonEllipse(a: Renderable, polyA: Polygon, b: Renderable, ellipseB: Ellipse, response?: Response | undefined): boolean;
    /**
     * Check if an ellipse and a polygon collide. <br>
     * **NOTE:** This is slightly less efficient than testPolygonEllipse as it just
     * runs testPolygonEllipse and reverses the response at the end.
     * @ignore
     * @param {Renderable} a a reference to the object A.
     * @param {Ellipse} ellipseA a reference to the object A Ellipse to be tested
     * @param {Renderable} b a reference to the object B.
     * @param {Polygon} polyB a reference to the object B Polygon to be tested
     * @param {Response=} response Response object (optional) that will be populated if
     *   they intersect.
     * @returns {boolean} true if they intersect, false if they don't.
     */
    export function testEllipsePolygon(a: Renderable, ellipseA: Ellipse, b: Renderable, polyB: Polygon, response?: Response | undefined): boolean;
}
declare module "physics/response" {
    /**
     * @classdesc
     * An object representing the result of an intersection.
     * @property {Renderable} a The first object participating in the intersection
     * @property {Renderable} b The second object participating in the intersection
     * @property {number} overlap Magnitude of the overlap on the shortest colliding axis
     * @property {Vector2d} overlapV The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If this vector is subtracted from the position of a, a and b will no longer be colliding
     * @property {Vector2d} overlapN The shortest colliding axis (unit-vector)
     * @property {boolean} aInB Whether the first object is entirely inside the second
     * @property {boolean} bInA Whether the second object is entirely inside the first
     * @property {number} indexShapeA The index of the colliding shape for the object a body
     * @property {number} indexShapeB The index of the colliding shape for the object b body
     * @name ResponseObject
     * @public
     */
    export default class ResponseObject {
        a: any;
        b: any;
        overlapN: Vector2d;
        overlapV: Vector2d;
        aInB: boolean;
        bInA: boolean;
        indexShapeA: number;
        indexShapeB: number;
        overlap: number;
        /**
         * Set some values of the response back to their defaults. <br>
         * Call this between tests if you are going to reuse a single <br>
         * Response object for multiple intersection tests <br>
         * (recommended as it will avoid allocating extra memory) <br>
         * @name clear
         * @public
         * @returns {object} this object for chaining
         */
        public clear(): object;
    }
    import Vector2d from "math/vector2";
}
declare module "physics/detector" {
    /**
     * find all the collisions for the specified object
     * @name collisionCheck
     * @ignore
     * @param {Renderable} objA object to be tested for collision
     * @param {ResponseObject} [response] a user defined response object that will be populated if they intersect.
     * @returns {boolean} in case of collision, false otherwise
     */
    export function collisionCheck(objA: Renderable, response?: ResponseObject): boolean;
    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @ignore
     * @param {Line} line line to be tested for collision
     * @param {Array.<Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @returns {Array.<Renderable>} an array of intersecting physic objects
     * @example
     *    // define a line accross the viewport
     *    var ray = new me.Line(
     *        // absolute position of the line
     *        0, 0, [
     *        // starting point relative to the initial position
     *        new me.Vector2d(0, 0),
     *        // ending point
     *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
     *    ]);
     *
     *    // check for collition
     *    result = me.collision.rayCast(ray);
     *
     *    if (result.length > 0) {
     *        // ...
     *    }
     */
    export function rayCast(line: Line, result?: Array<Renderable>): Array<Renderable>;
    import ResponseObject from "physics/response";
}
declare module "physics/collision" {
    export default collision;
    namespace collision {
        const maxChildren: number;
        const maxDepth: number;
        namespace types {
            const NO_OBJECT: number;
            const PLAYER_OBJECT: number;
            const NPC_OBJECT: number;
            const ENEMY_OBJECT: number;
            const COLLECTABLE_OBJECT: number;
            const ACTION_OBJECT: number;
            const PROJECTILE_OBJECT: number;
            const WORLD_SHAPE: number;
            const USER: number;
            const ALL_OBJECT: number;
        }
        /**
         * Checks for object colliding with the given line
         * @name rayCast
         * @memberof collision
         * @public
         * @param {Line} line line to be tested for collision
         * @param {Array.<Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
         * @returns {Array.<Renderable>} an array of intersecting physic objects
         * @example
         *    // define a line accross the viewport
         *    var ray = new me.Line(
         *        // absolute position of the line
         *        0, 0, [
         *        // starting point relative to the initial position
         *        new me.Vector2d(0, 0),
         *        // ending point
         *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
         *    ]);
         *
         *    // check for collition
         *    result = me.collision.rayCast(ray);
         *
         *    if (result.length > 0) {
         *        // ...
         *    }
         */
        function rayCast(line: Line, result?: Renderable[]): Renderable[];
        /**
         * Checks for object colliding with the given line
         * @name rayCast
         * @memberof collision
         * @public
         * @param {Line} line line to be tested for collision
         * @param {Array.<Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
         * @returns {Array.<Renderable>} an array of intersecting physic objects
         * @example
         *    // define a line accross the viewport
         *    var ray = new me.Line(
         *        // absolute position of the line
         *        0, 0, [
         *        // starting point relative to the initial position
         *        new me.Vector2d(0, 0),
         *        // ending point
         *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
         *    ]);
         *
         *    // check for collition
         *    result = me.collision.rayCast(ray);
         *
         *    if (result.length > 0) {
         *        // ...
         *    }
         */
        function rayCast(line: Line, result?: Renderable[]): Renderable[];
    }
}
declare module "physics/body" {
    export default Body;
    /**
     * @classdesc
     * a Generic Physic Body Object with some physic properties and behavior functionality, to as a member of a Renderable.
     * @see Renderable.body
     */
    class Body {
        /**
         * @param {Renderable} ancestor the parent object this body is attached to
         * @param {Rect|Rect[]|Polygon|Polygon[]|Line|Line[]|Ellipse|Ellipse[]|Point|Point[]|Bounds|Bounds[]|object} [shapes] a initial shape, list of shapes, or JSON object defining the body
         * @param {Function} [onBodyUpdate] callback for when the body is updated (e.g. add/remove shapes)
         */
        constructor(ancestor: Renderable, shapes?: Rect | Rect[] | Polygon | Polygon[] | Line | Line[] | Ellipse | Ellipse[] | Point | Point[] | Bounds | Bounds[] | object, onBodyUpdate?: Function);
        /**
         * a reference to the parent object that contains this body,
         * or undefined if it has not been added to one.
         * @public
         * @type {Renderable}
         * @default undefined
         */
        public ancestor: Renderable;
        /**
         * The AABB bounds box reprensenting this body
         * @public
         * @type {Bounds}
         */
        public bounds: Bounds;
        /**
         * The collision shapes of the body
         * @ignore
         * @type {Polygon[]|Line[]|Ellipse[]|Point|Point[]}
         */
        shapes: Polygon[] | Line[] | Ellipse[] | Point | Point[];
        /**
         * The body collision mask, that defines what should collide with what.<br>
         * (by default will collide with all entities)
         * @ignore
         * @type {number}
         * @default collision.types.ALL_OBJECT
         * @see collision.types
         */
        collisionMask: number;
        /**
         * define the collision type of the body for collision filtering
         * @public
         * @type {number}
         * @default collision.types.ENEMY_OBJECT
         * @see collision.types
         * @example
         * // set the body collision type
         * body.collisionType = me.collision.types.PLAYER_OBJECT;
         */
        public collisionType: number;
        /**
         * The current velocity of the body.
         * See to apply a force if you need to modify a body velocity
         * @see Body.force
         * @public
         * @type {Vector2d}
         * @default <0,0>
         */
        public vel: Vector2d;
        /**
         * body force to apply to this the body in the current step.
         * (any positive or negative force will be cancelled after every world/body update cycle)
         * @public
         * @type {Vector2d}
         * @default <0,0>
         * @see Body.setMaxVelocity
         * @example
         * // define a default maximum acceleration, initial force and friction
         * this.body.force.set(1, 0);
         * this.body.friction.set(0.4, 0);
         * this.body.setMaxVelocity(3, 15);
         *
         * // apply a postive or negative force when pressing left of right key
         * update(dt) {
         *     if (me.input.isKeyPressed("left"))    {
         *          this.body.force.x = -this.body.maxVel.x;
         *      } else if (me.input.isKeyPressed("right")) {
         *         this.body.force.x = this.body.maxVel.x;
         *     }
         * }
         */
        public force: Vector2d;
        /**
         * body friction
         * @public
         * @type {Vector2d}
         * @default <0,0>
         */
        public friction: Vector2d;
        /**
         * the body bouciness level when colliding with other solid bodies :
         * a value of 0 will not bounce, a value of 1 will fully rebound.
         * @public
         * @type {number}
         * @default 0
         */
        public bounce: number;
        /**
         * the body mass
         * @public
         * @type {number}
         * @default 1
         */
        public mass: number;
        /**
         * max velocity (to limit body velocity)
         * @public
         * @type {Vector2d}
         * @default <490,490>
         */
        public maxVel: Vector2d;
        /**
         * Either this body is a static body or not.
         * A static body is completely fixed and can never change position or angle.
         * @readonly
         * @public
         * @type {boolean}
         * @default false
         */
        public readonly isStatic: boolean;
        /**
         * The degree to which this body is affected by the world gravity
         * @public
         * @see World.gravity
         * @type {number}
         * @default 1.0
         */
        public gravityScale: number;
        /**
         * If true this body won't be affected by the world gravity
         * @public
         * @see World.gravity
         * @type {boolean}
         * @default false
         */
        public ignoreGravity: boolean;
        /**
         * falling state of the body<br>
         * true if the object is falling<br>
         * false if the object is standing on something<br>
         * @readonly
         * @public
         * @type {boolean}
         * @default false
         */
        public readonly falling: boolean;
        /**
         * jumping state of the body<br>
         * equal true if the body is jumping<br>
         * @readonly
         * @public
         * @type {boolean}
         * @default false
         */
        public readonly jumping: boolean;
        onBodyUpdate: Function;
        /**
         * set the body as a static body
         * static body do not move automatically and do not check againt collision with others
         * @param {boolean} [isStatic=true]
         */
        setStatic(isStatic?: boolean): void;
        /**
         * add a collision shape to this body <br>
         * (note: me.Rect objects will be converted to me.Polygon before being added)
         * @param {Rect|Polygon|Line|Ellipse|Point|Point[]|Bounds|object} shape a shape or JSON object
         * @returns {number} the shape array length
         * @example
         * // add a rectangle shape
         * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
         * // add a shape from a JSON object
         * this.body.addShape(me.loader.getJSON("shapesdef").banana);
         */
        addShape(shape: Rect | Polygon | Line | Ellipse | Point | Point[] | Bounds | object): number;
        /**
         * set the body vertices to the given one
         * @param {Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
         * @param {number} [index=0] the shape object for which to set the vertices
         * @param {boolean} [clear=true] either to reset the body definition before adding the new vertices
         */
        setVertices(vertices: Vector2d[], index?: number, clear?: boolean): void;
        /**
         * add the given vertices to the body shape
         * @param {Vector2d[]} vertices an array of me.Vector2d points defining a convex hull
         * @param {number} [index=0] the shape object for which to set the vertices
         */
        addVertices(vertices: Vector2d[], index?: number): void;
        /**
         * add collision mesh based on a JSON object
         * (this will also apply any physic properties defined in the given JSON file)
         * @param {object} json a JSON object as exported from a Physics Editor tool
         * @param {string} [id] an optional shape identifier within the given the json object
         * @see https://www.codeandweb.com/physicseditor
         * @returns {number} how many shapes were added to the body
         * @example
         * // define the body based on the banana shape
         * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
         * // or ...
         * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
         */
        fromJSON(json: object, id?: string): number;
        /**
         * return the collision shape at the given index
         * @param {number} [index=0] the shape object at the specified index
         * @returns {Polygon|Line|Ellipse} shape a shape object if defined
         */
        getShape(index?: number): Polygon | Line | Ellipse;
        /**
         * returns the AABB bounding box for this body
         * @returns {Bounds} bounding box Rectangle object
         */
        getBounds(): Bounds;
        /**
         * remove the specified shape from the body shape list
         * @param {Polygon|Line|Ellipse} shape a shape object
         * @returns {number} the shape array length
         */
        removeShape(shape: Polygon | Line | Ellipse): number;
        /**
         * remove the shape at the given index from the body shape list
         * @param {number} index the shape object at the specified index
         * @returns {number} the shape array length
         */
        removeShapeAt(index: number): number;
        /**
         * By default all physic bodies are able to collide with all other bodies, <br>
         * but it's also possible to specify 'collision filters' to provide a finer <br>
         * control over which body can collide with each other.
         * @see collision.types
         * @param {number} [bitmask = collision.types.ALL_OBJECT] the collision mask
         * @example
         * // filter collision detection with collision shapes, enemies and collectables
         * body.setCollisionMask(me.collision.types.WORLD_SHAPE | me.collision.types.ENEMY_OBJECT | me.collision.types.COLLECTABLE_OBJECT);
         * ...
         * // disable collision detection with all other objects
         * body.setCollisionMask(me.collision.types.NO_OBJECT);
         */
        setCollisionMask(bitmask?: number): void;
        /**
         * define the collision type of the body for collision filtering
         * @see collision.types
         * @param {number} type the collision type
         * @example
         * // set the body collision type
         * body.collisionType = me.collision.types.PLAYER_OBJECT;
         */
        setCollisionType(type: number): void;
        /**
         * the built-in function to solve the collision response
         * @param {object} response the collision response object (see {@link ResponseObject})
         */
        respondToCollision(response: object): void;
        /**
         * The forEach() method executes a provided function once per body shape element. <br>
         * the callback function is invoked with three arguments: <br>
         *    - The current element being processed in the array <br>
         *    - The index of element in the array. <br>
         *    - The array forEach() was called upon. <br>
         * @param {Function} callback fnction to execute on each element
         * @param {object} [thisArg] value to use as this(i.e reference Object) when executing callback.
         * @example
         * // iterate through all shapes of the physic body
         * mySprite.body.forEach((shape) => {
         *    shape.doSomething();
         * });
         * mySprite.body.forEach((shape, index) => { ... });
         * mySprite.body.forEach((shape, index, array) => { ... });
         * mySprite.body.forEach((shape, index, array) => { ... }, thisArg);
         */
        forEach(callback: Function, thisArg?: object, ...args: any[]): void;
        /**
         * Returns true if the any of the shape composing the body contains the given point.
         * @method Body#contains
         * @param {Vector2d} point
         * @returns {boolean} true if contains
         */
        /**
         * Returns true if the any of the shape composing the body contains the given point.
         * @param  {number} x x coordinate
         * @param  {number} y y coordinate
         * @returns {boolean} true if contains
         */
        contains(...args: any[]): boolean;
        /**
         * Rotate this body (counter-clockwise) by the specified angle (in radians).
         * Unless specified the body will be rotated around its center point
         * @param {number} angle The angle to rotate (in radians)
         * @param {Vector2d|ObservableVector2d} [v=Body.getBounds().center] an optional point to rotate around
         * @returns {Body} Reference to this object for method chaining
         */
        rotate(angle: number, v?: Vector2d | ObservableVector2d): Body;
        /**
         * cap the body velocity (body.maxVel property) to the specified value<br>
         * @param {number} x max velocity on x axis
         * @param {number} y max velocity on y axis
         */
        setMaxVelocity(x: number, y: number): void;
        /**
         * set the body default friction
         * @param {number} x horizontal friction
         * @param {number} y vertical friction
         */
        setFriction(x?: number, y?: number): void;
        /**
         * Updates the parent's position as well as computes the new body's velocity based
         * on the values of force/friction.  Velocity chages are proportional to the
         * me.timer.tick value (which can be used to scale velocities).  The approach to moving the
         * parent renderable is to compute new values of the Body.vel property then add them to
         * the parent.pos value thus changing the postion the amount of Body.vel each time the
         * update call is made. <br>
         * Updates to Body.vel are bounded by maxVel (which defaults to viewport size if not set) <br>
         * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the constructor arguments.
         * @protected
         * @param {number} dt time since the last update in milliseconds.
         * @returns {boolean} true if resulting velocity is different than 0
         */
        protected update(dt: number): boolean;
        /**
         * Destroy function<br>
         * @ignore
         */
        destroy(): void;
    }
    import Bounds from "physics/bounds";
    import Polygon from "geometries/poly";
    import Ellipse from "geometries/ellipse";
    import Point from "geometries/point";
    import Rect from "geometries/rectangle";
}
declare module "renderable/container" {
    export default Container;
    /**
     * @classdesc
     * Container represents a collection of child objects
     * @augments Renderable
     */
    class Container extends Renderable {
        /**
         * @param {number} [x=0] position of the container (accessible via the inherited pos.x property)
         * @param {number} [y=0] position of the container (accessible via the inherited pos.y property)
         * @param {number} [width=game.viewport.width] width of the container
         * @param {number} [height=game.viewport.height] height of the container
         */
        constructor(x?: number, y?: number, width?: number, height?: number, root?: boolean);
        /**
         * keep track of pending sort
         * @ignore
         */
        pendingSort: any;
        /**
         * whether the container is the root of the scene
         * @public
         * @type {boolean}
         * @default false
         * @name root
         * @memberof Container
         */
        public root: boolean;
        /**
         * The array of children of this container.
         * @ignore
         */
        children: any[];
        /**
         * The property of the child object that should be used to sort on <br>
         * value : "x", "y", "z"
         * @public
         * @type {string}
         * @default me.game.sortOn
         * @name sortOn
         * @memberof Container
         */
        public sortOn: string;
        /**
         * Specify if the children list should be automatically sorted when adding a new child
         * @public
         * @type {boolean}
         * @default true
         * @name autoSort
         * @memberof Container
         */
        public autoSort: boolean;
        /**
         * Specify if the children z index should automatically be managed by the parent container
         * @public
         * @type {boolean}
         * @default true
         * @name autoDepth
         * @memberof Container
         */
        public autoDepth: boolean;
        /**
         * Specify if the container draw operation should clip his children to its own bounds
         * @public
         * @type {boolean}
         * @default false
         * @name clipping
         * @memberof Container
         */
        public clipping: boolean;
        /**
         * a callback to be extended, triggered after a child has been added or removed
         * @name onChildChange
         * @memberof Container#
         * @param {number} index added or removed child index
         */
        onChildChange: (index: number) => void;
        /**
         * Specify if the container bounds should automatically take in account
         * all child bounds when updated (this is expensive and disabled by default,
         * only enable if necessary)
         * @public
         * @type {boolean}
         * @default false
         * @name enableChildBoundsUpdate
         * @memberof Container
         */
        public enableChildBoundsUpdate: boolean;
        /**
         * define a background color for this container
         * @public
         * @type {Color}
         * @name backgroundColor
         * @default (0, 0, 0, 0.0)
         * @memberof Container
         * @example
         * // add a red background color to this container
         * this.backgroundColor.setColor(255, 0, 0);
         */
        public backgroundColor: Color;
        /**
         * Used by the debug panel plugin
         * @ignore
         */
        drawCount: number;
        /**
         * reset the container, removing all childrens, and reseting transforms.
         * @name reset
         * @memberof Container
         */
        reset(): void;
        /**
         * Add a child to the container <br>
         * if auto-sort is disable, the object will be appended at the bottom of the list.
         * Adding a child to the container will automatically remove it from its other container.
         * Meaning a child can only have one parent.  This is important if you add a renderable
         * to a container then add it to the me.game.world container it will move it out of the
         * orginal container. Then when the me.game.world.reset() is called the renderable
         * will not be in any container. <br>
         * if the given child implements a onActivateEvent method, that method will be called
         * once the child is added to this container.
         * @name addChild
         * @memberof Container
         * @param {Renderable} child
         * @param {number} [z] forces the z index of the child to the specified value
         * @returns {Renderable} the added child
         */
        addChild(child: Renderable, z?: number): Renderable;
        /**
         * Add a child to the container at the specified index<br>
         * (the list won't be sorted after insertion)
         * @name addChildAt
         * @memberof Container
         * @param {Renderable} child
         * @param {number} index
         * @returns {Renderable} the added child
         */
        addChildAt(child: Renderable, index: number): Renderable;
        /**
         * The forEach() method executes a provided function once per child element. <br>
         * the callback function is invoked with three arguments: <br>
         *    - The current element being processed in the array <br>
         *    - The index of element in the array. <br>
         *    - The array forEach() was called upon. <br>
         * @name forEach
         * @memberof Container
         * @param {Function} callback fnction to execute on each element
         * @param {object} [thisArg] value to use as this(i.e reference Object) when executing callback.
         * @example
         * // iterate through all children of the root container
         * me.game.world.forEach((child) => {
         *    // do something with the child
         *    child.doSomething();
         * });
         * me.game.world.forEach((child, index) => { ... });
         * me.game.world.forEach((child, index, array) => { ... });
         * me.game.world.forEach((child, index, array) => { ... }, thisArg);
         */
        forEach(callback: Function, thisArg?: object, ...args: any[]): void;
        /**
         * Swaps the position (z-index) of 2 children
         * @name swapChildren
         * @memberof Container
         * @param {Renderable} child
         * @param {Renderable} child2
         */
        swapChildren(child: Renderable, child2: Renderable): void;
        /**
         * Returns the Child at the specified index
         * @name getChildAt
         * @memberof Container
         * @param {number} index
         * @returns {Renderable} the child at the specified index
         */
        getChildAt(index: number): Renderable;
        /**
         * Returns the index of the given Child
         * @name getChildIndex
         * @memberof Container
         * @param {Renderable} child
         * @returns {number} index
         */
        getChildIndex(child: Renderable): number;
        /**
         * Returns the next child within the container or undefined if none
         * @name getNextChild
         * @memberof Container
         * @param {Renderable} child
         * @returns {Renderable} child
         */
        getNextChild(child: Renderable): Renderable;
        /**
         * Returns true if contains the specified Child
         * @name hasChild
         * @memberof Container
         * @param {Renderable} child
         * @returns {boolean}
         */
        hasChild(child: Renderable): boolean;
        /**
         * return the child corresponding to the given property and value.<br>
         * note : avoid calling this function every frame since
         * it parses the whole object tree each time
         * @name getChildByProp
         * @memberof Container
         * @public
         * @param {string} prop Property name
         * @param {string|RegExp|number|boolean} value Value of the property
         * @returns {Renderable[]} Array of childs
         * @example
         * // get the first child object called "mainPlayer" in a specific container :
         * var ent = myContainer.getChildByProp("name", "mainPlayer");
         *
         * // or query the whole world :
         * var ent = me.game.world.getChildByProp("name", "mainPlayer");
         *
         * // partial property matches are also allowed by using a RegExp.
         * // the following matches "redCOIN", "bluecoin", "bagOfCoins", etc :
         * var allCoins = me.game.world.getChildByProp("name", /coin/i);
         *
         * // searching for numbers or other data types :
         * var zIndex10 = me.game.world.getChildByProp("z", 10);
         * var inViewport = me.game.world.getChildByProp("inViewport", true);
         */
        public getChildByProp(prop: string, value: string | RegExp | number | boolean): Renderable[];
        /**
         * returns the list of childs with the specified class type
         * @name getChildByType
         * @memberof Container
         * @public
         * @param {object} classType
         * @returns {Renderable[]} Array of children
         */
        public getChildByType(classType: object): Renderable[];
        /**
         * returns the list of childs with the specified name<br>
         * as defined in Tiled (Name field of the Object Properties)<br>
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         * @name getChildByName
         * @memberof Container
         * @public
         * @param {string|RegExp|number|boolean} name child name
         * @returns {Renderable[]} Array of children
         */
        public getChildByName(name: string | RegExp | number | boolean): Renderable[];
        /**
         * return the child corresponding to the specified GUID<br>
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         * @name getChildByGUID
         * @memberof Container
         * @public
         * @param {string|RegExp|number|boolean} guid child GUID
         * @returns {Renderable} corresponding child or null
         */
        public getChildByGUID(guid: string | RegExp | number | boolean): Renderable;
        /**
         * return all child in this container
         * @name getChildren
         * @memberof Container
         * @public
         * @returns {Renderable[]} an array of renderable object
         */
        public getChildren(): Renderable[];
        /**
         * update the bounding box for this shape.
         * @ignore
         * @name updateBounds
         * @memberof Renderable
         * @returns {Bounds} this shape bounding box Rectangle object
         */
        updateBounds(forceUpdateChildBounds?: boolean): Bounds;
        /**
         * Checks if this container is root or if it's attached to the root container.
         * @private
         * @name isAttachedToRoot
         * @memberof Container
         * @returns {boolean}
         */
        private isAttachedToRoot;
        /**
         * update the cointainer's bounding rect (private)
         * @ignore
         * @name updateBoundsPos
         * @memberof Container
         */
        updateBoundsPos(newX: any, newY: any): Bounds;
        /**
         * @ignore
         */
        onActivateEvent(): void;
        /**
         * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed. <br>
         * if the given child implements a onDeactivateEvent() method, that method will be called once the child is removed from this container.
         * @name removeChild
         * @memberof Container
         * @public
         * @param {Renderable} child
         * @param {boolean} [keepalive=false] true to prevent calling child.destroy()
         */
        public removeChild(child: Renderable, keepalive?: boolean): void;
        /**
         * Removes (and optionally destroys) a child from the container.<br>
         * (removal is immediate and unconditional)<br>
         * Never use keepalive=true with objects from {@link pool}. Doing so will create a memory leak.
         * @name removeChildNow
         * @memberof Container
         * @param {Renderable} child
         * @param {boolean} [keepalive=False] True to prevent calling child.destroy()
         */
        removeChildNow(child: Renderable, keepalive?: boolean): void;
        /**
         * Automatically set the specified property of all childs to the given value
         * @name setChildsProperty
         * @memberof Container
         * @param {string} prop property name
         * @param {object} value property value
         * @param {boolean} [recursive=false] recursively apply the value to child containers if true
         */
        setChildsProperty(prop: string, value: object, recursive?: boolean): void;
        /**
         * Move the child in the group one step forward (z depth).
         * @name moveUp
         * @memberof Container
         * @param {Renderable} child
         */
        moveUp(child: Renderable): void;
        /**
         * Move the child in the group one step backward (z depth).
         * @name moveDown
         * @memberof Container
         * @param {Renderable} child
         */
        moveDown(child: Renderable): void;
        /**
         * Move the specified child to the top(z depth).
         * @name moveToTop
         * @memberof Container
         * @param {Renderable} child
         */
        moveToTop(child: Renderable): void;
        /**
         * Move the specified child the bottom (z depth).
         * @name moveToBottom
         * @memberof Container
         * @param {Renderable} child
         */
        moveToBottom(child: Renderable): void;
        /**
         * Manually trigger the sort of all the childs in the container</p>
         * @name sort
         * @memberof Container
         * @public
         * @param {boolean} [recursive=false] recursively sort all containers if true
         */
        public sort(recursive?: boolean): void;
        /**
         * @ignore
         */
        onDeactivateEvent(): void;
        /**
         * Z Sorting function
         * @ignore
         */
        _sortZ(a: any, b: any): number;
        /**
         * Reverse Z Sorting function
         * @ignore
         */
        _sortReverseZ(a: any, b: any): number;
        /**
         * X Sorting function
         * @ignore
         */
        _sortX(a: any, b: any): number;
        /**
         * Y Sorting function
         * @ignore
         */
        _sortY(a: any, b: any): number;
    }
    import Renderable from "renderable/renderable";
}
declare module "physics/quadtree" {
    export default QuadTree;
    /**
     * @classdesc
     * a QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
     * @see game.world.broadphase
     */
    class QuadTree {
        /**
         * @param {World} world the physic world this QuadTree belongs to
         * @param {Bounds} bounds bounds of the node
         * @param {number} [max_objects=4] max objects a node can hold before splitting into 4 subnodes
         * @param {number} [max_levels=4] total max levels inside root Quadtree
         * @param {number} [level] deepth level, required for subnodes
         */
        constructor(world: World, bounds: Bounds, max_objects?: number, max_levels?: number, level?: number);
        world: World;
        bounds: Bounds;
        max_objects: number;
        max_levels: number;
        level: number;
        objects: any[];
        nodes: any[];
        split(): void;
        getIndex(item: any): number;
        /**
         * Insert the given object container into the node.
         * @name insertContainer
         * @memberof QuadTree
         * @param {Container} container group of objects to be added
         */
        insertContainer(container: Container): void;
        /**
         * Insert the given object into the node. If the node
         * exceeds the capacity, it will split and add all
         * objects to their corresponding subnodes.
         * @name insert
         * @memberof QuadTree
         * @param {object} item object to be added
         */
        insert(item: object): void;
        /**
         * Return all objects that could collide with the given object
         * @name retrieve
         * @memberof QuadTree
         * @param {object} item object to be checked against
         * @param {object} [fn] a sorting function for the returned array
         * @returns {object[]} array with all detected objects
         */
        retrieve(item: object, fn?: object): object[];
        /**
         * Remove the given item from the quadtree.
         * (this function won't recalculate the impacted node)
         * @name remove
         * @memberof QuadTree
         * @param {object} item object to be removed
         * @returns {boolean} true if the item was found and removed.
         */
        remove(item: object): boolean;
        /**
         * return true if the node is prunable
         * @name isPrunable
         * @memberof QuadTree
         * @returns {boolean} true if the node is prunable
         */
        isPrunable(): boolean;
        /**
         * return true if the node has any children
         * @name hasChildren
         * @memberof QuadTree
         * @returns {boolean} true if the node has any children
         */
        hasChildren(): boolean;
        /**
         * clear the quadtree
         * @name clear
         * @memberof QuadTree
         * @param {Bounds} [bounds=this.bounds] the bounds to be cleared
         */
        clear(bounds?: Bounds): void;
    }
    import Container from "renderable/container";
}
declare module "physics/world" {
    export default World;
    /**
     * @classdesc
     * an object representing the physic world, and responsible for managing and updating all childs and physics
     * @augments Container
     */
    class World extends Container {
        /**
         * @param {number} [x=0] position of the container (accessible via the inherited pos.x property)
         * @param {number} [y=0] position of the container (accessible via the inherited pos.y property)
         * @param {number} [width=game.viewport.width] width of the container
         * @param {number} [height=game.viewport.height] height of the container
         */
        constructor(x?: number, y?: number, width?: number, height?: number);
        /**
         * the application (game) this physic world belong to
         * @public
         * @type {Application}
         */
        public app: Application;
        /**
         * the rate at which the game world is updated,
         * may be greater than or lower than the display fps
         * @public
         * @type {Vector2d}
         * @default 60
         * @name fps
         * @memberof World
         * @see timer.maxfps
         */
        public fps: Vector2d;
        /**
         * world gravity
         * @public
         * @type {Vector2d}
         * @default <0,0.98>
         * @name gravity
         * @memberof World
         */
        public gravity: Vector2d;
        /**
         * Specify the rendering method for tile layers. <br>
         * if false visible part of the layers are rendered dynamically,<br>
         * if true the entire layers are first rendered into an offscreen canvas.<br>
         * the "best" rendering method depends of your game
         * (amount of layer, layer size, amount of tiles per layer, etc.)<br>
         * note : rendering method is also configurable per layer by adding this
         * property to your layer (in Tiled).
         * @type {boolean}
         * @default false
         * @memberof World
         */
        preRender: boolean;
        /**
         * the active physic bodies in this simulation
         * @name bodies
         * @memberof World
         * @public
         * @type {Set<Body>}
         */
        public bodies: Set<Body>;
        /**
         * the instance of the game world quadtree used for broadphase
         * @name broadphase
         * @memberof World
         * @public
         * @type {QuadTree}
         */
        public broadphase: QuadTree;
        /**
         * Add a physic body to the game world
         * @name addBody
         * @memberof World
         * @see Container.addChild
         * @param {Body} body
         * @returns {World} this game world
         */
        addBody(body: Body): World;
        /**
         * Remove a physic body from the game world
         * @name removeBody
         * @memberof World
         * @see Container.removeChild
         * @param {Body} body
         * @returns {World} this game world
         */
        removeBody(body: Body): World;
        /**
         * Apply gravity to the given body
         * @name bodyApplyVelocity
         * @memberof World
         * @private
         * @param {Body} body
         */
        private bodyApplyGravity;
    }
    import Container from "renderable/container";
    import Vector2d from "math/vector2";
    import QuadTree from "physics/quadtree";
}
declare module "application/application" {
    export default Application;
    /**
     * @classdesc
     * An Application represents a single melonJS game.
     * An Application is responsible for updating (each frame) all the related object status and draw them.
     * @see game
     */
    class Application {
        /**
         * a reference to the current active stage "default" camera
         * @public
         * @type {Camera2d}
         */
        public viewport: Camera2d;
        /**
         * a reference to the game world, <br>
         * a world is a virtual environment containing all the game objects
         * @public
         * @type {World}
         */
        public world: World;
        /**
         * when true, all objects will be added under the root world container.<br>
         * When false, a `me.Container` object will be created for each corresponding groups
         * @public
         * @type {boolean}
         * @default true
         */
        public mergeGroup: boolean;
        /**
         * Specify the property to be used when sorting renderables.
         * Accepted values : "x", "y", "z"
         * @public
         * @type {string}
         * @default "z"
         */
        public sortOn: string;
        /**
         * Last time the game update loop was executed. <br>
         * Use this value to implement frame prediction in drawing events,
         * for creating smooth motion while running game update logic at
         * a lower fps.
         * @public
         * @type {DOMHighResTimeStamp}
         * @name lastUpdate
         * @memberof Application
         */
        public lastUpdate: DOMHighResTimeStamp;
        isDirty: boolean;
        isAlwaysDirty: boolean;
        frameCounter: number;
        frameRate: number;
        accumulator: number;
        accumulatorMax: number;
        accumulatorUpdateDelta: number;
        stepSize: number;
        updateDelta: number;
        lastUpdateStart: number;
        updateAverageDelta: number;
        /**
         * init the game instance (create a physic world, update starting time, etc..)
         */
        init(): void;
        /**
         * reset the game Object manager
         * destroy all current objects
         */
        reset(): void;
        /**
         * Fired when a level is fully loaded and all renderable instantiated. <br>
         * Additionnaly the level id will also be passed to the called function.
         * @example
         * // call myFunction () everytime a level is loaded
         * me.game.onLevelLoaded = this.myFunction.bind(this);
         */
        onLevelLoaded(): void;
        /**
         * Update the renderer framerate using the system config variables.
         * @see timer.maxfps
         * @see World.fps
         */
        updateFrameRate(): void;
        /**
         * Returns the parent container of the specified Child in the game world
         * @param {Renderable} child
         * @returns {Container}
         */
        getParentContainer(child: Renderable): Container;
        /**
         * force the redraw (not update) of all objects
         */
        repaint(): void;
        /**
         * update all objects related to this game active scene/stage
         * @param {number} time current timestamp as provided by the RAF callback
         * @param {Stage} stage the current stage
         */
        update(time: number, stage: Stage): void;
        /**
         * draw the active scene/stage associated to this game
         * @param {Stage} stage the current stage
         */
        draw(stage: Stage): void;
    }
    import World from "physics/world";
}
declare module "game" {
    export default game;
    /**
     * game is a default instance of a melonJS Application and represents your current game,
     * it contains all the objects, tilemap layers, current viewport, collision map, etc...<br>
     * @namespace game
     * @see Application
     */
    let game: Application;
    import Application from "application/application";
}
declare module "camera/camera2d" {
    export default Camera2d;
    /**
     * @classdesc
     * a 2D orthographic camera
     * @augments Renderable
     */
    class Camera2d extends Renderable {
        /**
         * Axis definition
         * @enum {number}
         * @property {number} NONE no axis
         * @property {number} HORIZONTAL horizontal axis only
         * @property {number} VERTICAL vertical axis only
         * @property {number} BOTH both axis
         * @readonly
         * @name AXIS
         * @memberof Camera2d
         */
        readonly AXIS: {
            NONE: number;
            HORIZONTAL: number;
            VERTICAL: number;
            BOTH: number;
        };
        /**
         * Camera bounds
         * @public
         * @type {Bounds}
         * @name bounds
         * @memberof Camera2d
         */
        public bounds: Bounds;
        /**
         * enable or disable damping
         * @private
         * @default true
         */
        private smoothFollow;
        /**
         * Camera damping for smooth transition [0 .. 1].
         * 1 being the maximum value and will snap the camera to the target position
         * @public
         * @type {number}
         * @name damping
         * @default 1.0
         * @memberof Camera2d
         */
        public damping: number;
        /**
         * the closest point relative to the camera
         * @public
         * @type {number}
         * @name near
         * @default -1000
         * @memberof Camera2d
         */
        public near: number;
        /**
         * the furthest point relative to the camera.
         * @public
         * @type {number}
         * @name far
         * @default 1000
         * @memberof Camera2d
         */
        public far: number;
        /**
         * the default camera projection matrix
         * (2d cameras use an orthographic projection by default).
         * @public
         * @type {Matrix3d}
         * @name projectionMatrix
         * @memberof Camera2d
         */
        public projectionMatrix: Matrix3d;
        /**
         * the invert camera transform used to unproject points
         * @ignore
         * @type {Matrix2d}
         * @name invCurrentTransform
         * @memberof Camera2d
         */
        invCurrentTransform: Matrix2d;
        offset: Vector2d;
        target: Vector2d | ObservableVector3d;
        follow_axis: number;
        _shake: {
            intensity: number;
            duration: number;
            axis: number;
            onComplete: any;
        };
        _fadeOut: {
            color: any;
            tween: any;
        };
        _fadeIn: {
            color: any;
            tween: any;
        };
        /** @ignore */
        _updateProjectionMatrix(): void;
        /** @ignore */
        _followH(target: any): number;
        /** @ignore */
        _followV(target: any): number;
        /**
         * reset the camera position to specified coordinates
         * @name reset
         * @memberof Camera2d
         * @param {number} [x=0]
         * @param {number} [y=0]
         */
        reset(x?: number, y?: number): void;
        /**
         * change the deadzone settings.
         * the "deadzone" defines an area within the current camera in which
         * the followed renderable can move without scrolling the camera.
         * @name setDeadzone
         * @see Camera2d.follow
         * @memberof Camera2d
         * @param {number} w deadzone width
         * @param {number} h deadzone height
         */
        setDeadzone(w: number, h: number): void;
        deadzone: Rect;
        /**
         * resize the camera
         * @name resize
         * @memberof Camera2d
         * @param {number} w new width of the camera
         * @param {number} h new height of the camera
         * @returns {Camera2d} this camera
         */
        resize(w: number, h: number): Camera2d;
        /**
         * set the camera boundaries (set to the world limit by default).
         * the camera is bound to the given coordinates and cannot move/be scrolled outside of it.
         * @name setBounds
         * @memberof Camera2d
         * @param {number} x world left limit
         * @param {number} y world top limit
         * @param {number} w world width limit
         * @param {number} h world height limit
         */
        setBounds(x: number, y: number, w: number, h: number): void;
        /**
         * set the camera to follow the specified renderable. <br>
         * (this will put the camera center around the given target)
         * @name follow
         * @memberof Camera2d
         * @param {Renderable|Vector2d} target renderable or position vector to follow
         * @param {number} [axis=me.game.viewport.AXIS.BOTH] Which axis to follow (see {@link Camera2d.AXIS})
         * @param {number} [damping=1] default damping value
         * @example
         * // set the camera to follow this renderable on both axis, and enable damping
         * me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH, 0.1);
         */
        follow(target: Renderable | Vector2d, axis?: number, damping?: number): void;
        /**
         * unfollow the current target
         * @name unfollow
         * @memberof Camera2d
         */
        unfollow(): void;
        /**
         * move the camera upper-left position by the specified offset.
         * @name move
         * @memberof Camera2d
         * @see Camera2d.focusOn
         * @param {number} x
         * @param {number} y
         * @example
         * // Move the camera up by four pixels
         * me.game.viewport.move(0, -4);
         */
        move(x: number, y: number): void;
        /**
         * move the camera upper-left position to the specified coordinates
         * @name moveTo
         * @memberof Camera2d
         * @see Camera2d.focusOn
         * @param {number} x
         * @param {number} y
         */
        moveTo(x: number, y: number): void;
        /** @ignore */
        updateTarget(): void;
        /** @ignore */
        update(dt: any): boolean;
        /**
         * shake the camera
         * @name shake
         * @memberof Camera2d
         * @param {number} intensity maximum offset that the screen can be moved
         * while shaking
         * @param {number} duration expressed in milliseconds
         * @param {number} [axis=me.game.viewport.AXIS.BOTH] specify on which axis to apply the shake effect (see {@link Camera2d.AXIS})
         * @param {Function} [onComplete] callback once shaking effect is over
         * @param {boolean} [force] if true this will override the current effect
         * @example
         * // shake it baby !
         * me.game.viewport.shake(10, 500, me.game.viewport.AXIS.BOTH);
         */
        shake(intensity: number, duration: number, axis?: number, onComplete?: Function, force?: boolean): void;
        /**
         * fadeOut(flash) effect<p>
         * screen is filled with the specified color and slowly goes back to normal
         * @name fadeOut
         * @memberof Camera2d
         * @param {Color|string} color a CSS color value
         * @param {number} [duration=1000] expressed in milliseconds
         * @param {Function} [onComplete] callback once effect is over
         * @example
         * // fade the camera to white upon dying, reload the level, and then fade out back
         * me.game.viewport.fadeIn("#fff", 150, function() {
         *     me.audio.play("die", false);
         *     me.level.reload();
         *     me.game.viewport.fadeOut("#fff", 150);
         * });
         */
        fadeOut(color: Color | string, duration?: number, onComplete?: Function): void;
        /**
         * fadeIn effect <p>
         * fade to the specified color
         * @name fadeIn
         * @memberof Camera2d
         * @param {Color|string} color a CSS color value
         * @param {number} [duration=1000] expressed in milliseconds
         * @param {Function} [onComplete] callback once effect is over
         * @example
         * // flash the camera to white for 75ms
         * me.game.viewport.fadeIn("#FFFFFF", 75);
         */
        fadeIn(color: Color | string, duration?: number, onComplete?: Function): void;
        /**
         * set the camera position around the specified object
         * @name focusOn
         * @memberof Camera2d
         * @param {Renderable} target the renderable to focus the camera on
         */
        focusOn(target: Renderable): void;
        /**
         * check if the specified renderable is in the camera
         * @name isVisible
         * @memberof Camera2d
         * @param {Renderable} obj to be checked against
         * @param {boolean} [floating = obj.floating] if visibility check should be done against screen coordinates
         * @returns {boolean}
         */
        isVisible(obj: Renderable, floating?: boolean): boolean;
        /**
         * convert the given "local" (screen) coordinates into world coordinates
         * @name localToWorld
         * @memberof Camera2d
         * @param {number} x
         * @param {number} y
         * @param {number} [v] an optional vector object where to set the
         * converted value
         * @returns {Vector2d}
         */
        localToWorld(x: number, y: number, v?: number): Vector2d;
        /**
         * convert the given world coordinates into "local" (screen) coordinates
         * @name worldToLocal
         * @memberof Camera2d
         * @param {number} x
         * @param {number} y
         * @param {number} [v] an optional vector object where to set the
         * converted value
         * @returns {Vector2d}
         */
        worldToLocal(x: number, y: number, v?: number): Vector2d;
        /**
         * render the camera effects
         * @ignore
         */
        drawFX(renderer: any): void;
        /**
         * draw all object visibile in this viewport
         * @ignore
         */
        draw(renderer: any, container: any): void;
    }
    import Renderable from "renderable/renderable";
    import Matrix3d from "math/matrix3";
    import Matrix2d from "math/matrix2";
    import Vector2d from "math/vector2";
    import ObservableVector3d from "math/observable_vector3";
    import Rect from "geometries/rectangle";
}
declare module "state/stage" {
    export default Stage;
    /**
     * @classdesc
     * a default "Stage" object.
     * every "stage" object (title screen, credits, ingame, etc...) to be managed
     * through the state manager must inherit from this base class.
     * @see state
     */
    class Stage {
        /**
         * @param {object} [settings] The stage` parameters
         * @param {Camera2d[]} [settings.cameras=[new me.Camera2d()]] a list of cameras (experimental)
         * @param {Function} [settings.onResetEvent] called by the state manager when reseting the object
         * @param {Function} [settings.onDestroyEvent] called by the state manager before switching to another state
         */
        constructor(settings?: {
            cameras?: Camera2d[];
            onResetEvent?: Function;
            onDestroyEvent?: Function;
        });
        /**
         * The list of active cameras in this stage.
         * Cameras will be renderered based on this order defined in this list.
         * Only the "default" camera will be resized when the window or canvas is resized.
         * @public
         * @type {Map<Camera2d>}
         * @name cameras
         * @memberof Stage
         */
        public cameras: Map<Camera2d, any>;
        /**
         * The list of active lights in this stage.
         * (Note: Canvas Renderering mode will only properly support one light per stage)
         * @public
         * @type {Map<Light2d>}
         * @name lights
         * @memberof Stage
         * @see Light2d
         * @see Stage.ambientLight
         * @example
         * // create a white spot light
         * var whiteLight = new me.Light2d(0, 0, 140, "#fff", 0.7);
         * // and add the light to this current stage
         * this.lights.set("whiteLight", whiteLight);
         * // set a dark ambient light
         * this.ambientLight.parseCSS("#1117");
         * // make the light follow the mouse
         * me.input.registerPointerEvent("pointermove", me.game.viewport, (event) => {
         *    whiteLight.centerOn(event.gameX, event.gameY);
         * });
         */
        public lights: Map<Light2d, any>;
        /**
         * an ambient light that will be added to the stage rendering
         * @public
         * @type {Color}
         * @name ambientLight
         * @memberof Stage
         * @default "#000000"
         * @see Light2d
         */
        public ambientLight: Color;
        /**
         * The given constructor options
         * @public
         * @name settings
         * @memberof Stage
         * @type {object}
         */
        public settings: object;
        /**
         * Object reset function
         * @ignore
         */
        reset(...args: any[]): void;
        /**
         * update function
         * @name update
         * @memberof Stage
         * @ignore
         * @param {number} dt time since the last update in milliseconds.
         * @returns {boolean}
         */
        update(dt: number): boolean;
        /**
         * draw the current stage
         * @name draw
         * @memberof Stage
         * @ignore
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer object
         */
        draw(renderer: CanvasRenderer | WebGLRenderer): void;
        /**
         * destroy function
         * @ignore
         */
        destroy(...args: any[]): void;
        /**
         * onResetEvent function<br>
         * called by the state manager when reseting the object
         * this is typically where you will load a level, add renderables, etc...
         * @name onResetEvent
         * @memberof Stage
         * @param {object} [...arguments] optional arguments passed when switching state
         * @see state#change
         */
        onResetEvent(...args: any[]): void;
        /**
         * onDestroyEvent function<br>
         * called by the state manager before switching to another state
         * @name onDestroyEvent
         * @memberof Stage
         */
        onDestroyEvent(...args: any[]): void;
    }
    import Camera2d from "camera/camera2d";
    import Color from "math/color";
}
declare module "loader/loadingscreen" {
    export default DefaultLoadingScreen;
    /**
     * a default loading screen
     * @ignore
     */
    class DefaultLoadingScreen extends Stage {
        /**
         * call when the loader is resetted
         * @ignore
         */
        onResetEvent(): void;
        /**
         * Called by engine before deleting the object
         * @ignore
         */
        onDestroyEvent(): void;
    }
    import Stage from "state/stage";
}
declare module "state/state" {
    export default state;
    namespace state {
        const LOADING: number;
        const MENU: number;
        const READY: number;
        const PLAY: number;
        const GAMEOVER: number;
        const GAME_END: number;
        const SCORE: number;
        const CREDITS: number;
        const SETTINGS: number;
        const DEFAULT: number;
        const USER: number;
        /**
         * Stop the current stage.
         * @name stop
         * @memberof state
         * @public
         * @param {boolean} [pauseTrack=false] pause current track on screen stop.
         */
        function stop(pauseTrack?: boolean): void;
        /**
         * Stop the current stage.
         * @name stop
         * @memberof state
         * @public
         * @param {boolean} [pauseTrack=false] pause current track on screen stop.
         */
        function stop(pauseTrack?: boolean): void;
        /**
         * pause the current stage
         * @name pause
         * @memberof state
         * @public
         * @param {boolean} [music=false] pause current music track on screen pause
         */
        function pause(music?: boolean): void;
        /**
         * pause the current stage
         * @name pause
         * @memberof state
         * @public
         * @param {boolean} [music=false] pause current music track on screen pause
         */
        function pause(music?: boolean): void;
        /**
         * Restart the current stage from a full stop.
         * @name restart
         * @memberof state
         * @public
         * @param {boolean} [music=false] resume current music track on screen resume
         */
        function restart(music?: boolean): void;
        /**
         * Restart the current stage from a full stop.
         * @name restart
         * @memberof state
         * @public
         * @param {boolean} [music=false] resume current music track on screen resume
         */
        function restart(music?: boolean): void;
        /**
         * resume the current stage
         * @name resume
         * @memberof state
         * @public
         * @param {boolean} [music=false] resume current music track on screen resume
         */
        function resume(music?: boolean): void;
        /**
         * resume the current stage
         * @name resume
         * @memberof state
         * @public
         * @param {boolean} [music=false] resume current music track on screen resume
         */
        function resume(music?: boolean): void;
        /**
         * return the running state of the state manager
         * @name isRunning
         * @memberof state
         * @public
         * @returns {boolean} true if a "process is running"
         */
        function isRunning(): boolean;
        /**
         * return the running state of the state manager
         * @name isRunning
         * @memberof state
         * @public
         * @returns {boolean} true if a "process is running"
         */
        function isRunning(): boolean;
        /**
         * Return the pause state of the state manager
         * @name isPaused
         * @memberof state
         * @public
         * @returns {boolean} true if the game is paused
         */
        function isPaused(): boolean;
        /**
         * Return the pause state of the state manager
         * @name isPaused
         * @memberof state
         * @public
         * @returns {boolean} true if the game is paused
         */
        function isPaused(): boolean;
        /**
         * associate the specified state with a Stage
         * @name set
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @param {Stage} stage Instantiated Stage to associate with state ID
         * @param {boolean} [start = false] if true the state will be changed immediately after adding it.
         * @example
         * class MenuButton extends me.GUI_Object {
         *     onClick() {
         *         // Change to the PLAY state when the button is clicked
         *         me.state.change(me.state.PLAY);
         *         return true;
         *     }
         * };
         *
         * class MenuScreen extends me.Stage {
         *     onResetEvent() {
         *         // Load background image
         *         me.game.world.addChild(
         *             new me.ImageLayer(0, 0, {
         *                 image : "bg",
         *                 z: 0 // z-index
         *             }
         *         );
         *
         *         // Add a button
         *         me.game.world.addChild(
         *             new MenuButton(350, 200, { "image" : "start" }),
         *             1 // z-index
         *         );
         *
         *         // Play music
         *         me.audio.playTrack("menu");
         *     }
         *
         *     onDestroyEvent() {
         *         // Stop music
         *         me.audio.stopTrack();
         *     }
         * };
         *
         * me.state.set(me.state.MENU, new MenuScreen());
         */
        function set(state: number, stage: Stage, start?: boolean): void;
        /**
         * associate the specified state with a Stage
         * @name set
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @param {Stage} stage Instantiated Stage to associate with state ID
         * @param {boolean} [start = false] if true the state will be changed immediately after adding it.
         * @example
         * class MenuButton extends me.GUI_Object {
         *     onClick() {
         *         // Change to the PLAY state when the button is clicked
         *         me.state.change(me.state.PLAY);
         *         return true;
         *     }
         * };
         *
         * class MenuScreen extends me.Stage {
         *     onResetEvent() {
         *         // Load background image
         *         me.game.world.addChild(
         *             new me.ImageLayer(0, 0, {
         *                 image : "bg",
         *                 z: 0 // z-index
         *             }
         *         );
         *
         *         // Add a button
         *         me.game.world.addChild(
         *             new MenuButton(350, 200, { "image" : "start" }),
         *             1 // z-index
         *         );
         *
         *         // Play music
         *         me.audio.playTrack("menu");
         *     }
         *
         *     onDestroyEvent() {
         *         // Stop music
         *         me.audio.stopTrack();
         *     }
         * };
         *
         * me.state.set(me.state.MENU, new MenuScreen());
         */
        function set(state: number, stage: Stage, start?: boolean): void;
        /**
         * returns the stage associated with the specified state
         * (or the current one if none is specified)
         * @name set
         * @memberof state
         * @public
         * @param {number} [state] State ID (see constants)
         * @returns {Stage}
         */
        function get(state?: number): Stage;
        /**
         * returns the stage associated with the specified state
         * (or the current one if none is specified)
         * @name set
         * @memberof state
         * @public
         * @param {number} [state] State ID (see constants)
         * @returns {Stage}
         */
        function get(state?: number): Stage;
        /**
         * return a reference to the current stage<br>
         * useful to call a object specific method
         * @name current
         * @memberof state
         * @public
         * @returns {Stage}
         */
        function current(): Stage;
        /**
         * return a reference to the current stage<br>
         * useful to call a object specific method
         * @name current
         * @memberof state
         * @public
         * @returns {Stage}
         */
        function current(): Stage;
        /**
         * specify a global transition effect
         * @name transition
         * @memberof state
         * @public
         * @param {string} effect (only "fade" is supported for now)
         * @param {Color|string} color a CSS color value
         * @param {number} [duration=1000] expressed in milliseconds
         */
        function transition(effect: string, color: any, duration?: number): void;
        /**
         * specify a global transition effect
         * @name transition
         * @memberof state
         * @public
         * @param {string} effect (only "fade" is supported for now)
         * @param {Color|string} color a CSS color value
         * @param {number} [duration=1000] expressed in milliseconds
         */
        function transition(effect: string, color: any, duration?: number): void;
        /**
         * enable/disable transition for a specific state (by default enabled for all)
         * @name setTransition
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @param {boolean} enable
         */
        function setTransition(state: number, enable: boolean): void;
        /**
         * enable/disable transition for a specific state (by default enabled for all)
         * @name setTransition
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @param {boolean} enable
         */
        function setTransition(state: number, enable: boolean): void;
        /**
         * change the game/app state
         * @name change
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @param {boolean} forceChange if true the state will be changed immediately
         * @param {object} [...arguments] extra arguments to be passed to the reset functions
         * @example
         * // The onResetEvent method on the play screen will receive two args:
         * // "level_1" and the number 3
         * me.state.change(me.state.PLAY, "level_1", 3);
         */
        function change(state: number, forceChange: boolean, ...args: any[]): void;
        /**
         * change the game/app state
         * @name change
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @param {boolean} forceChange if true the state will be changed immediately
         * @param {object} [...arguments] extra arguments to be passed to the reset functions
         * @example
         * // The onResetEvent method on the play screen will receive two args:
         * // "level_1" and the number 3
         * me.state.change(me.state.PLAY, "level_1", 3);
         */
        function change(state: number, forceChange: boolean, ...args: any[]): void;
        /**
         * return true if the specified state is the current one
         * @name isCurrent
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @returns {boolean} true if the specified state is the current one
         */
        function isCurrent(state: number): boolean;
        /**
         * return true if the specified state is the current one
         * @name isCurrent
         * @memberof state
         * @public
         * @param {number} state State ID (see constants)
         * @returns {boolean} true if the specified state is the current one
         */
        function isCurrent(state: number): boolean;
    }
    import Stage from "state/stage";
}
declare module "level/tiled/TMXUtils" {
    /**
     * decompress zlib/gzip data (NOT IMPLEMENTED)
     * @ignore
     * @name decompress
     * @param  {number[]} data Array of bytes
     * @param  {string} format compressed data format ("gzip","zlib")
     */
    export function decompress(): void;
    /**
     * Decode a CSV encoded array into a binary array
     * @ignore
     * @name decodeCSV
     * @param  {string} input CSV formatted data (only numbers, everything else will be converted to NaN)
     * @returns {number[]} Decoded data
     */
    export function decodeCSV(input: string): number[];
    /**
     * Decode a base64 encoded string into a byte array
     * @ignore
     * @name decodeBase64AsArray
     * @param {string} input Base64 encoded data
     * @param {number} [bytes] number of bytes per array entry
     * @returns {Uint32Array} Decoded data
     */
    export function decodeBase64AsArray(input: string, bytes?: number): Uint32Array;
    /**
     * Decode the given data
     * @ignore
     */
    export function decode(data: any, encoding: any, compression: any): any;
    /**
     * Normalize TMX format to Tiled JSON format
     * @ignore
     */
    export function normalize(obj: any, item: any): void;
    /**
     * Parse a XML TMX object and returns the corresponding javascript object
     * @ignore
     */
    export function parse(xml: any): {
        text: string;
    };
    /**
     * Apply TMX Properties to the given object
     * @ignore
     */
    export function applyTMXProperties(obj: any, data: any): void;
}
declare module "level/tiled/TMXTile" {
    export default Tile;
    /**
     * @classdesc
     * a basic tile object
     * @augments Bounds
     */
    class Tile extends Bounds {
        /**
         * @param {number} x x index of the Tile in the map
         * @param {number} y y index of the Tile in the map
         * @param {number} gid tile gid
         * @param {TMXTileset} tileset the corresponding tileset object
         */
        constructor(x: number, y: number, gid: number, tileset: TMXTileset);
        /**
         * tileset
         * @public
         * @type {TMXTileset}
         * @name Tile#tileset
         */
        public tileset: TMXTileset;
        /**
         * the tile transformation matrix (if defined)
         * @ignore
         */
        currentTransform: Matrix2d;
        col: number;
        row: number;
        /**
         * tileId
         * @public
         * @type {number}
         * @name Tile#tileId
         */
        public tileId: number;
        /**
         * True if the tile is flipped horizontally<br>
         * @public
         * @type {boolean}
         * @name Tile#flipX
         */
        public flippedX: boolean;
        /**
         * True if the tile is flipped vertically<br>
         * @public
         * @type {boolean}
         * @name Tile#flippedY
         */
        public flippedY: boolean;
        /**
         * True if the tile is flipped anti-diagonally<br>
         * @public
         * @type {boolean}
         * @name Tile#flippedAD
         */
        public flippedAD: boolean;
        /**
         * Global flag that indicates if the tile is flipped<br>
         * @public
         * @type {boolean}
         * @name Tile#flipped
         */
        public flipped: boolean;
        /**
         * set the transformation matrix for this tile
         * @ignore
         */
        setTileTransform(transform: any): void;
        /**
         * return a renderable object for this Tile object
         * @name Tile#getRenderable
         * @public
         * @param {object} [settings] see {@link Sprite}
         * @returns {Renderable} a me.Sprite object
         */
        public getRenderable(settings?: object): Renderable;
    }
    import Bounds from "physics/bounds";
    import Matrix2d from "math/matrix2";
}
declare module "video/canvas/canvas_renderer" {
    export default CanvasRenderer;
    /**
     * @classdesc
     * a canvas renderer object
     * @augments Renderer
     */
    class CanvasRenderer extends Renderer {
        /**
         * @param {object} options The renderer parameters
         * @param {number} options.width The width of the canvas without scaling
         * @param {number} options.height The height of the canvas without scaling
         * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
         * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing
         * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
         * @param {boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
         * @param {boolean} [options.textureSeamFix=true] enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
         * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
         * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
         */
        constructor(options: {
            width: number;
            height: number;
            canvas?: HTMLCanvasElement;
            antiAlias?: boolean;
            transparent?: boolean;
            subPixel?: boolean;
            textureSeamFix?: boolean;
            zoomX?: number;
            zoomY?: number;
        });
        context: CanvasRenderingContext2D;
        cache: TextureCache;
        /**
         * Reset the canvas transform to identity
         * @name resetTransform
         * @memberof CanvasRenderer
         */
        resetTransform(): void;
        /**
         * set a blend mode for the given context. <br>
         * Supported blend mode between Canvas and WebGL remderer : <br>
         * - "normal" : this is the default mode and draws new content on top of the existing content <br>
         * <img src="images/normal-blendmode.png" width="510"/> <br>
         * - "multiply" : the pixels of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result. <br>
         * <img src="images/multiply-blendmode.png" width="510"/> <br>
         * - "additive or lighter" : where both content overlap the color is determined by adding color values. <br>
         * <img src="images/lighter-blendmode.png" width="510"/> <br>
         * - "screen" : The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply) <br>
         * <img src="images/screen-blendmode.png" width="510"/> <br>
         * @name setBlendMode
         * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
         * @memberof CanvasRenderer
         * @param {string} [mode="normal"] blend mode : "normal", "multiply", "lighter, "additive", "screen"
         * @param {CanvasRenderingContext2D} [context]
         */
        setBlendMode(mode?: string, context?: CanvasRenderingContext2D): void;
        /**
         * Clears the main framebuffer with the given color
         * @name clearColor
         * @memberof CanvasRenderer
         * @param {Color|string} [color="#000000"] CSS color.
         * @param {boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
         */
        clearColor(color?: Color | string, opaque?: boolean): void;
        /**
         * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
         * @name clearRect
         * @memberof CanvasRenderer
         * @param {number} x x axis of the coordinate for the rectangle starting point.
         * @param {number} y y axis of the coordinate for the rectangle starting point.
         * @param {number} width The rectangle's width.
         * @param {number} height The rectangle's height.
         */
        clearRect(x: number, y: number, width: number, height: number): void;
        /**
         * Create a pattern with the specified repetition
         * @name createPattern
         * @memberof CanvasRenderer
         * @param {Image} image Source image
         * @param {string} repeat Define how the pattern should be repeated
         * @returns {CanvasPattern}
         * @see ImageLayer#repeat
         * @example
         * var tileable   = renderer.createPattern(image, "repeat");
         * var horizontal = renderer.createPattern(image, "repeat-x");
         * var vertical   = renderer.createPattern(image, "repeat-y");
         * var basic      = renderer.createPattern(image, "no-repeat");
         */
        createPattern(image: new (width?: number, height?: number) => HTMLImageElement, repeat: string): CanvasPattern;
        /**
         * Draw an image onto the main using the canvas api
         * @name drawImage
         * @memberof CanvasRenderer
         * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
         * @param {number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
         * @param {number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
         * @param {number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
         * @param {number} sh The height of the sub-rectangle of the source image to draw into the destination context.
         * @param {number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
         * @param {number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
         * @param {number} dw The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
         * @param {number} dh The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
         * @example
         * // Position the image on the canvas:
         * renderer.drawImage(image, dx, dy);
         * // Position the image on the canvas, and specify width and height of the image:
         * renderer.drawImage(image, dx, dy, dWidth, dHeight);
         * // Clip the image and position the clipped part on the canvas:
         * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
         */
        drawImage(image: new (width?: number, height?: number) => HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
        /**
         * Draw a pattern within the given rectangle.
         * @name drawPattern
         * @memberof CanvasRenderer
         * @param {CanvasPattern} pattern Pattern object
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @see CanvasRenderer#createPattern
         */
        drawPattern(pattern: CanvasPattern, x: number, y: number, width: number, height: number): void;
        /**
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * @name strokeArc
         * @memberof CanvasRenderer
         * @param {number} x arc center point x-axis
         * @param {number} y arc center point y-axis
         * @param {number} radius
         * @param {number} start start angle in radians
         * @param {number} end end angle in radians
         * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean, fill?: boolean): void;
        /**
         * Fill an arc at the specified coordinates with given radius, start and end points
         * @name fillArc
         * @memberof CanvasRenderer
         * @param {number} x arc center point x-axis
         * @param {number} y arc center point y-axis
         * @param {number} radius
         * @param {number} start start angle in radians
         * @param {number} end end angle in radians
         * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean): void;
        /**
         * Stroke an ellipse at the specified coordinates with given radius
         * @name strokeEllipse
         * @memberof CanvasRenderer
         * @param {number} x ellipse center point x-axis
         * @param {number} y ellipse center point y-axis
         * @param {number} w horizontal radius of the ellipse
         * @param {number} h vertical radius of the ellipse
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean): void;
        /**
         * Fill an ellipse at the specified coordinates with given radius
         * @name fillEllipse
         * @memberof CanvasRenderer
         * @param {number} x ellipse center point x-axis
         * @param {number} y ellipse center point y-axis
         * @param {number} w horizontal radius of the ellipse
         * @param {number} h vertical radius of the ellipse
         */
        fillEllipse(x: number, y: number, w: number, h: number): void;
        /**
         * Stroke a line of the given two points
         * @name strokeLine
         * @memberof CanvasRenderer
         * @param {number} startX the start x coordinate
         * @param {number} startY the start y coordinate
         * @param {number} endX the end x coordinate
         * @param {number} endY the end y coordinate
         */
        strokeLine(startX: number, startY: number, endX: number, endY: number): void;
        /**
         * Fill a line of the given two points
         * @name fillLine
         * @memberof CanvasRenderer
         * @param {number} startX the start x coordinate
         * @param {number} startY the start y coordinate
         * @param {number} endX the end x coordinate
         * @param {number} endY the end y coordinate
         */
        fillLine(startX: number, startY: number, endX: number, endY: number): void;
        /**
         * Stroke the given me.Polygon on the screen
         * @name strokePolygon
         * @memberof CanvasRenderer
         * @param {Polygon} poly the shape to draw
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokePolygon(poly: Polygon, fill?: boolean): void;
        /**
         * Fill the given me.Polygon on the screen
         * @name fillPolygon
         * @memberof CanvasRenderer
         * @param {Polygon} poly the shape to draw
         */
        fillPolygon(poly: Polygon): void;
        /**
         * Stroke a rectangle at the specified coordinates
         * @name strokeRect
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeRect(x: number, y: number, width: number, height: number, fill?: boolean): void;
        /**
         * Draw a filled rectangle at the specified coordinates
         * @name fillRect
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        fillRect(x: number, y: number, width: number, height: number): void;
        /**
         * Stroke a rounded rectangle at the specified coordinates
         * @name strokeRoundRect
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @param {number} radius
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeRoundRect(x: number, y: number, width: number, height: number, radius: number, fill?: boolean): void;
        /**
         * Draw a rounded filled rectangle at the specified coordinates
         * @name fillRoundRect
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @param {number} radius
         */
        fillRoundRect(x: number, y: number, width: number, height: number, radius: number): void;
        /**
         * Stroke a Point at the specified coordinates
         * @name strokePoint
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         */
        strokePoint(x: number, y: number): void;
        /**
         * Draw a a point at the specified coordinates
         * @name fillPoint
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        fillPoint(x: number, y: number): void;
        /**
         * return a reference to the font 2d Context
         * @ignore
         */
        getFontContext(): CanvasRenderingContext2D | WebGLRenderingContext;
        /**
         * save the canvas context
         * @name save
         * @memberof CanvasRenderer
         */
        save(): void;
        /**
         * restores the canvas context
         * @name restore
         * @memberof CanvasRenderer
         */
        restore(): void;
        /**
         * rotates the canvas context
         * @name rotate
         * @memberof CanvasRenderer
         * @param {number} angle in radians
         */
        rotate(angle: number): void;
        /**
         * scales the canvas context
         * @name scale
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         */
        scale(x: number, y: number): void;
        /**
         * Set the current fill & stroke style color.
         * By default, or upon reset, the value is set to #000000.
         * @name setColor
         * @memberof CanvasRenderer
         * @param {Color|string} color css color value
         */
        setColor(color: Color | string): void;
        /**
         * Set the global alpha
         * @name setGlobalAlpha
         * @memberof CanvasRenderer
         * @param {number} alpha 0.0 to 1.0 values accepted.
         */
        setGlobalAlpha(alpha: number): void;
        /**
         * Return the global alpha
         * @name getGlobalAlpha
         * @memberof CanvasRenderer
         * @returns {number} global alpha value
         */
        getGlobalAlpha(): number;
        /**
         * Set the line width on the context
         * @name setLineWidth
         * @memberof CanvasRenderer
         * @param {number} width Line width
         */
        setLineWidth(width: number): void;
        /**
         * Reset (overrides) the renderer transformation matrix to the
         * identity one, and then apply the given transformation matrix.
         * @name setTransform
         * @memberof CanvasRenderer
         * @param {Matrix2d} mat2d Matrix to transform by
         */
        setTransform(mat2d: Matrix2d): void;
        /**
         * Multiply given matrix into the renderer tranformation matrix
         * @name transform
         * @memberof CanvasRenderer
         * @param {Matrix2d} mat2d Matrix to transform by
         */
        transform(mat2d: Matrix2d): void;
        /**
         * Translates the context to the given position
         * @name translate
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         */
        translate(x: number, y: number): void;
        /**
         * clip the given region from the original canvas. Once a region is clipped,
         * all future drawing will be limited to the clipped region.
         * You can however save the current region using the save(),
         * and restore it (with the restore() method) any time in the future.
         * (<u>this is an experimental feature !</u>)
         * @name clipRect
         * @memberof CanvasRenderer
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        clipRect(x: number, y: number, width: number, height: number): void;
        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * Mask are not preserved through renderer context save and restore.
         * @name setMask
         * @memberof CanvasRenderer
         * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] the shape defining the mask to be applied
         * @param {boolean} [invert=false] either the given shape should define what is visible (default) or the opposite
         */
        setMask(mask?: Rect | RoundRect | Polygon | Line | Ellipse, invert?: boolean): void;
    }
    import Renderer from "video/renderer";
    import TextureCache from "video/texture/cache";
    import Color from "math/color";
    import Rect from "geometries/rectangle";
    import RoundRect from "geometries/roundrect";
    import Ellipse from "geometries/ellipse";
}
declare module "level/tiled/TMXLayer" {
    export default TMXLayer;
    /**
     * @classdesc
     * a TMX Tile Layer Object
     * Tiled QT 0.7.x format
     * @augments Renderable
     */
    class TMXLayer extends Renderable {
        /**
         * @param {object} map layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
         * @param {object} data layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
         * @param {number} tilewidth width of each tile in pixels
         * @param {number} tileheight height of each tile in pixels
         * @param {string} orientation "isometric" or "orthogonal"
         * @param {TMXTilesetGroup} tilesets tileset as defined in Tiled
         * @param {number} z z-index position
         */
        constructor(map: object, data: object, tilewidth: number, tileheight: number, orientation: string, tilesets: TMXTilesetGroup, z: number);
        tilewidth: any;
        tileheight: any;
        orientation: string;
        /**
         * The Layer corresponding Tilesets
         * @public
         * @type {TMXTilesetGroup}
         * @name TMXLayer#tilesets
         */
        public tilesets: TMXTilesetGroup;
        tileset: any;
        maxTileSize: {
            width: number;
            height: number;
        };
        /**
         * All animated tilesets in this layer
         * @ignore
         * @type {TMXTileset[]}
         * @name TMXLayer#animatedTilesets
         */
        animatedTilesets: TMXTileset[];
        /**
         * Layer contains tileset animations
         * @public
         * @type {boolean}
         * @name TMXLayer#isAnimated
         */
        public isAnimated: boolean;
        /**
         * the order in which tiles on orthogonal tile layers are rendered.
         * (valid values are "left-down", "left-up", "right-down", "right-up")
         * @public
         * @type {string}
         * @default "right-down"
         * @name TMXLayer#renderorder
         */
        public renderorder: string;
        /**
         * the layer class
         * @public
         * @type {string}
         * @name class
         * @name TMXLayer#class
         */
        public class: string;
        name: any;
        cols: number;
        rows: number;
        preRender: boolean;
        onActivateEvent(): void;
        canvasRenderer: CanvasRenderer;
        onDeactivateEvent(): void;
        /**
         * Set the TMX renderer for this layer object
         * @name setRenderer
         * @memberof TMXLayer
         * @public
         * @param {TMXRenderer} renderer
         * @example
         * // use the parent map default renderer
         * var layer = new me.TMXLayer(...);
         * layer.setRenderer(map.getRenderer());
         */
        public setRenderer(renderer: TMXRenderer): void;
        renderer: TMXRenderer;
        /**
         * Return the layer current renderer object
         * @name getRenderer
         * @memberof TMXLayer
         * @public
         * @returns {TMXRenderer} renderer
         */
        public getRenderer(): TMXRenderer;
        /**
         * Return the TileId of the Tile at the specified position
         * @name getTileId
         * @memberof TMXLayer
         * @public
         * @param {number} x X coordinate (in world/pixels coordinates)
         * @param {number} y Y coordinate (in world/pixels coordinates)
         * @returns {number} TileId or null if there is no Tile at the given position
         */
        public getTileId(x: number, y: number): number;
        /**
         * Return the Tile object at the specified position
         * @name getTile
         * @memberof TMXLayer
         * @public
         * @param {number} x X coordinate (in world/pixels coordinates)
         * @param {number} y Y coordinate (in world/pixels coordinates)
         * @returns {Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
         * @example
         * // get the TMX Map Layer called "Front layer"
         * var layer = me.game.world.getChildByName("Front Layer")[0];
         * // get the tile object corresponding to the latest pointer position
         * var tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
         */
        public getTile(x: number, y: number): Tile;
        /**
         * assign the given Tile object to the specified position
         * @name getTile
         * @memberof TMXLayer
         * @public
         * @param {Tile} tile the tile object to be assigned
         * @param {number} x x coordinate (in world/pixels coordinates)
         * @param {number} y y coordinate (in world/pixels coordinates)
         * @returns {Tile} the tile object
         */
        public setTile(tile: Tile, x: number, y: number): Tile;
        /**
         * return a new the Tile object corresponding to the given tile id
         * @name setTile
         * @memberof TMXLayer
         * @public
         * @param {number} tileId tileId
         * @param {number} x X coordinate (in world/pixels coordinates)
         * @param {number} y Y coordinate (in world/pixels coordinates)
         * @returns {Tile} the tile object
         */
        public getTileById(tileId: number, x: number, y: number): Tile;
        /**
         * Return the Tile object at the specified tile coordinates
         * @name cellAt
         * @memberof TMXLayer
         * @public
         * @param {number} x x position of the tile (in Tile unit)
         * @param {number} y x position of the tile (in Tile unit)
         * @param {number} [boundsCheck=true] check first if within the layer bounds
         * @returns {Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
         * @example
         * // return the first tile at offset 0, 0
         * var tile = layer.cellAt(0, 0);
         */
        public cellAt(x: number, y: number, boundsCheck?: number): Tile;
        /**
         * clear the tile at the specified position
         * @name clearTile
         * @memberof TMXLayer
         * @public
         * @param {number} x X coordinate (in map coordinates: row/column)
         * @param {number} y Y coordinate (in map coordinates: row/column)
         * @example
         * me.game.world.getChildByType(me.TMXLayer).forEach(function(layer) {
         *     // clear all tiles at the given x,y coordinates
         *     layer.clearTile(x, y);
         * });
         */
        public clearTile(x: number, y: number): void;
        /**
         * update animations in a tileset layer
         * @ignore
         */
        update(dt: any): boolean;
        /**
         * draw a tileset layer
         * @ignore
         */
        draw(renderer: any, rect: any): void;
    }
    import Renderable from "renderable/renderable";
    import CanvasRenderer from "video/canvas/canvas_renderer";
    import Tile from "level/tiled/TMXTile";
}
declare module "level/tiled/renderer/TMXRenderer" {
    export default TMXRenderer;
    /**
     * @classdesc
     * The map renderer base class
     */
    class TMXRenderer {
        /**
         * @param {number} cols width of the tilemap in tiles
         * @param {number} rows height of the tilemap in tiles
         * @param {number} tilewidth width of each tile in pixels
         * @param {number} tileheight height of each tile in pixels
         */
        constructor(cols: number, rows: number, tilewidth: number, tileheight: number);
        cols: number;
        rows: number;
        tilewidth: number;
        tileheight: number;
        bounds: Bounds;
        /**
         * return true if the renderer can render the specified map or layer
         * @name TMXRenderer#canRender
         * @public
         * @param {TMXTileMap|TMXLayer} component TMX Map or Layer
         * @returns {boolean}
         */
        public canRender(component: TMXTileMap | TMXLayer): boolean;
        /**
         * return the bounding rect for this map renderer
         * @name TMXRenderer#getBounds
         * @public
         * @param {TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
         * @returns {Bounds}
         */
        public getBounds(layer?: TMXLayer): Bounds;
        /**
         * return the tile position corresponding to the specified pixel
         * @name TMXRenderer#pixelToTileCoords
         * @public
         * @param {number} x X coordinate
         * @param {number} y Y coordinate
         * @param {Vector2d} [v] an optional vector object where to put the return values
         * @returns {Vector2d}
         */
        public pixelToTileCoords(x: number, y: number, v?: Vector2d): Vector2d;
        /**
         * return the pixel position corresponding of the specified tile
         * @name TMXRenderer#tileToPixelCoords
         * @public
         * @param {number} col tile horizontal position
         * @param {number} row tile vertical position
         * @param {Vector2d} [v] an optional vector object where to put the return values
         * @returns {Vector2d}
         */
        public tileToPixelCoords(col: number, row: number, v?: Vector2d): Vector2d;
        /**
         * draw the given tile at the specified layer
         * @name TMXRenderer#drawTile
         * @public
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer object
         * @param {number} x X coordinate where to draw the tile
         * @param {number} y Y coordinate where to draw the tile
         * @param {Tile} tile the tile object to draw
         */
        public drawTile(renderer: CanvasRenderer | WebGLRenderer, x: number, y: number, tile: Tile): void;
        /**
         * draw the given TMX Layer for the given area
         * @name TMXRenderer#drawTileLayer
         * @public
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer object
         * @param {TMXLayer} layer a TMX Layer object
         * @param {Rect} rect the area of the layer to draw
         */
        public drawTileLayer(renderer: CanvasRenderer | WebGLRenderer, layer: TMXLayer, rect: Rect): void;
    }
    import Bounds from "physics/bounds";
    import TMXLayer from "level/tiled/TMXLayer";
}
declare module "level/tiled/renderer/TMXOrthogonalRenderer" {
    export default TMXOrthogonalRenderer;
    /**
     * @classdesc
     * an Orthogonal Map Renderder
     * @augments TMXRenderer
     */
    class TMXOrthogonalRenderer extends TMXRenderer {
        /**
         * @param {TMXTileMap} map the TMX map
         */
        constructor(map: TMXTileMap);
        /**
         * return true if the renderer can render the specified layer
         * @ignore
         */
        canRender(layer: any): boolean;
        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords(x: any, y: any, v: any): any;
        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords(x: any, y: any, v: any): any;
        /**
         * fix the position of Objects to match
         * the way Tiled places them
         * @ignore
         */
        adjustPosition(obj: any): void;
        /**
         * draw the tile map
         * @ignore
         */
        drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
        /**
         * draw the tile map
         * @ignore
         */
        drawTileLayer(renderer: any, layer: any, rect: any): void;
    }
    import TMXRenderer from "level/tiled/renderer/TMXRenderer";
}
declare module "level/tiled/renderer/TMXIsometricRenderer" {
    export default TMXIsometricRenderer;
    /**
     * @classdesc
     * an Isometric Map Renderder
     * @augments TMXRenderer
     */
    class TMXIsometricRenderer extends TMXRenderer {
        /**
         * @param {TMXTileMap} map the TMX map
         */
        constructor(map: TMXTileMap);
        hTilewidth: number;
        hTileheight: number;
        originX: number;
        /**
         * return true if the renderer can render the specified layer
         * @ignore
         */
        canRender(layer: any): boolean;
        /**
         * return the bounding rect for this map renderer
         * @name TMXIsometricRenderer#getBounds
         * @public
         * @param {TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
         * @returns {Bounds}
         */
        public getBounds(layer?: TMXLayer): Bounds;
        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords(x: any, y: any, v: any): any;
        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords(x: any, y: any, v: any): any;
        /**
         * fix the position of Objects to match
         * the way Tiled places them
         * @ignore
         */
        adjustPosition(obj: any): void;
        /**
         * draw the tile map
         * @ignore
         */
        drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
        /**
         * draw the tile map
         * @ignore
         */
        drawTileLayer(renderer: any, layer: any, rect: any): void;
    }
    import TMXRenderer from "level/tiled/renderer/TMXRenderer";
    import TMXLayer from "level/tiled/TMXLayer";
}
declare module "level/tiled/renderer/TMXHexagonalRenderer" {
    export default TMXHexagonalRenderer;
    /**
     * @classdesc
     * an Hexagonal Map Renderder
     * @augments TMXRenderer
     */
    class TMXHexagonalRenderer extends TMXRenderer {
        /**
         * @param {TMXTileMap} map the TMX map
         */
        constructor(map: TMXTileMap);
        hexsidelength: any;
        staggerX: boolean;
        staggerEven: boolean;
        sidelengthx: any;
        sidelengthy: any;
        sideoffsetx: number;
        sideoffsety: number;
        columnwidth: any;
        rowheight: any;
        centers: Vector2d[];
        /**
         * return true if the renderer can render the specified layer
         * @ignore
         */
        canRender(layer: any): boolean;
        /**
         * return the bounding rect for this map renderer
         * @name TMXHexagonalRenderer#getBounds
         * @public
         * @param {TMXLayer} [layer] calculate the bounding rect for a specific layer (will return a new bounds object)
         * @returns {Bounds}
         */
        public getBounds(layer?: TMXLayer): Bounds;
        /**
         * @ignore
         */
        doStaggerX(x: any): number;
        /**
         * @ignore
         */
        doStaggerY(y: any): number;
        /**
         * @ignore
         */
        topLeft(x: any, y: any, v: any): any;
        /**
         * @ignore
         */
        topRight(x: any, y: any, v: any): any;
        /**
         * @ignore
         */
        bottomLeft(x: any, y: any, v: any): any;
        /**
         * @ignore
         */
        bottomRight(x: any, y: any, v: any): any;
        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords(x: any, y: any, v: any): any;
        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords(x: any, y: any, v: any): any;
        /**
         * fix the position of Objects to match
         * the way Tiled places them
         * @ignore
         */
        adjustPosition(obj: any): void;
        /**
         * draw the tile map
         * @ignore
         */
        drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
        /**
         * draw the tile map
         * @ignore
         */
        drawTileLayer(renderer: any, layer: any, rect: any): void;
    }
    import TMXRenderer from "level/tiled/renderer/TMXRenderer";
    import Vector2d from "math/vector2";
    import TMXLayer from "level/tiled/TMXLayer";
}
declare module "level/tiled/renderer/TMXStaggeredRenderer" {
    export default TMXStaggeredRenderer;
    /**
     * @classdesc
     * a Staggered Map Renderder
     * @augments TMXHexagonalRenderer
     */
    class TMXStaggeredRenderer extends TMXHexagonalRenderer {
    }
    import TMXHexagonalRenderer from "level/tiled/renderer/TMXHexagonalRenderer";
}
declare module "level/tiled/TMXTileset" {
    export default TMXTileset;
    /**
     * @classdesc
     * a TMX Tile Set Object
     */
    class TMXTileset {
        /**
         *  @param {object} tileset tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
         */
        constructor(tileset: object);
        TileProperties: any[];
        imageCollection: HTMLImageElement[];
        firstgid: number;
        lastgid: number;
        name: any;
        tilewidth: number;
        tileheight: number;
        spacing: number;
        margin: number;
        tileoffset: Vector2d;
        /**
         * Tileset contains animated tiles
         * @public
         * @type {boolean}
         * @name TMXTileset#isAnimated
         */
        public isAnimated: boolean;
        /**
         * true if the tileset is a "Collection of Image" Tileset
         * @public
         * @type {boolean}
         * @name TMXTileset#isCollection
         */
        public isCollection: boolean;
        /**
         * the tileset class
         * @public
         * @type {boolean}
         * @name TMXTileset#class
         */
        public class: boolean;
        /**
         * Tileset animations
         * @private
         */
        private animations;
        /**
         * Remember the last update timestamp to prevent too many animation updates
         * @private
         */
        private _lastUpdate;
        image: HTMLImageElement;
        texture: any;
        atlas: any;
        /**
         * return the tile image from a "Collection of Image" tileset
         * @name TMXTileset#getTileImage
         * @public
         * @param {number} gid
         * @returns {Image} corresponding image or undefined
         */
        public getTileImage(gid: number): new (width?: number, height?: number) => HTMLImageElement;
        /**
         * set the tile properties
         * @ignore
         */
        setTileProperty(gid: any, prop: any): void;
        /**
         * return true if the gid belongs to the tileset
         * @name TMXTileset#contains
         * @public
         * @param {number} gid
         * @returns {boolean}
         */
        public contains(gid: number): boolean;
        /**
         * Get the view (local) tile ID from a GID, with animations applied
         * @name TMXTileset#getViewTileId
         * @public
         * @param {number} gid Global tile ID
         * @returns {number} View tile ID
         */
        public getViewTileId(gid: number): number;
        /**
         * return the properties of the specified tile
         * @name TMXTileset#getTileProperties
         * @public
         * @param {number} tileId
         * @returns {object}
         */
        public getTileProperties(tileId: number): object;
        update(dt: any): boolean;
        drawTile(renderer: any, dx: any, dy: any, tmxTile: any): void;
    }
    import Vector2d from "math/vector2";
}
declare module "level/tiled/TMXTilesetGroup" {
    export default TMXTilesetGroup;
    /**
     * @classdesc
     * an object containing all tileset
     */
    class TMXTilesetGroup {
        tilesets: any[];
        length: number;
        /**
         * add a tileset to the tileset group
         * @name TMXTilesetGroup#add
         * @public
         * @param {TMXTileset} tileset
         */
        public add(tileset: TMXTileset): void;
        /**
         * return the tileset at the specified index
         * @name TMXTilesetGroup#getTilesetByIndex
         * @public
         * @param {number} i
         * @returns {TMXTileset} corresponding tileset
         */
        public getTilesetByIndex(i: number): TMXTileset;
        /**
         * return the tileset corresponding to the specified id <br>
         * will throw an exception if no matching tileset is found
         * @name TMXTilesetGroup#getTilesetByGid
         * @public
         * @param {number} gid
         * @returns {TMXTileset} corresponding tileset
         */
        public getTilesetByGid(gid: number): TMXTileset;
    }
}
declare module "level/tiled/TMXObject" {
    /**
     * @classdesc
     * a TMX Object defintion, as defined in Tiled
     * (Object definition is translated into the virtual `me.game.world` using `me.Renderable`)
     * @ignore
     */
    export default class TMXObject {
        constructor(map: any, settings: any, z: any);
        /**
         * point list in JSON format
         * @public
         * @type {object[]}
         * @name points
         * @memberof TMXObject
         */
        public points: object[];
        /**
         * object name
         * @public
         * @type {string}
         * @name name
         * @memberof TMXObject
         */
        public name: string;
        /**
         * object x position
         * @public
         * @type {number}
         * @name x
         * @memberof TMXObject
         */
        public x: number;
        /**
         * object y position
         * @public
         * @type {number}
         * @name y
         * @memberof TMXObject
         */
        public y: number;
        /**
         * object z order
         * @public
         * @type {number}
         * @name z
         * @memberof TMXObject
         */
        public z: number;
        /**
         * object width
         * @public
         * @type {number}
         * @name width
         * @memberof TMXObject
         */
        public width: number;
        /**
         * object height
         * @public
         * @type {number}
         * @name height
         * @memberof TMXObject
         */
        public height: number;
        /**
         * object gid value
         * when defined the object is a tiled object
         * @public
         * @type {number}
         * @name gid
         * @memberof TMXObject
         */
        public gid: number;
        /**
         * tint color
         * @public
         * @type {string}
         * @name tintcolor
         * @memberof TMXObject
         */
        public tintcolor: string;
        /**
         * object type
         * @public
         * @type {string}
         * @deprecated since Tiled 1.9
         * @see https://docs.mapeditor.org/en/stable/reference/tmx-changelog/#tiled-1-9
         * @name type
         * @memberof TMXObject
         */
        public type: string;
        /**
         * the object class
         * @public
         * @type {string}
         * @name class
         * @memberof TMXObject
         */
        public class: string;
        /**
         * object text
         * @public
         * @type {object}
         * @see http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text
         * @name text
         * @memberof TMXObject
         */
        public text: object;
        /**
         * The rotation of the object in radians clockwise (defaults to 0)
         * @public
         * @type {number}
         * @name rotation
         * @memberof TMXObject
         */
        public rotation: number;
        /**
         * object unique identifier per level (Tiled 0.11.x+)
         * @public
         * @type {number}
         * @name id
         * @memberof TMXObject
         */
        public id: number;
        /**
         * object orientation (orthogonal or isometric)
         * @public
         * @type {string}
         * @name orientation
         * @memberof TMXObject
         */
        public orientation: string;
        /**
         * the collision shapes defined for this object
         * @public
         * @type {object[]}
         * @name shapes
         * @memberof TMXObject
         */
        public shapes: object[];
        /**
         * if true, the object is an Ellipse
         * @public
         * @type {boolean}
         * @name isEllipse
         * @memberof TMXObject
         */
        public isEllipse: boolean;
        /**
         * if true, the object is a Point
         * @public
         * @type {boolean}
         * @name isPoint
         * @memberof TMXObject
         */
        public isPoint: boolean;
        /**
         * if true, the object is a Polygon
         * @public
         * @type {boolean}
         * @name isPolygon
         * @memberof TMXObject
         */
        public isPolygon: boolean;
        /**
         * if true, the object is a PolyLine
         * @public
         * @type {boolean}
         * @name isPolyLine
         * @memberof TMXObject
         */
        public isPolyLine: boolean;
        /**
         * set the object image (for Tiled Object)
         * @ignore
         */
        setTile(tilesets: any): void;
        framewidth: any;
        frameheight: any;
        tile: Tile;
        /**
         * parses the TMX shape definition and returns a corresponding array of me.Shape object
         * @name parseTMXShapes
         * @memberof TMXObject
         * @private
         * @returns {Polygon[]|Line[]|Ellipse[]} an array of shape objects
         */
        private parseTMXShapes;
        /**
         * getObjectPropertyByName
         * @ignore
         */
        getObjectPropertyByName(name: any): any;
    }
    import Tile from "level/tiled/TMXTile";
}
declare module "level/tiled/TMXGroup" {
    /**
     * @classdesc
     * object group definition as defined in Tiled.
     * (group definition is translated into the virtual `me.game.world` using `me.Container`)
     * @ignore
     */
    export default class TMXGroup {
        constructor(map: any, data: any, z: any);
        /**
         * group name
         * @public
         * @type {string}
         * @name name
         * @memberof TMXGroup
         */
        public name: string;
        /**
         * group width
         * @public
         * @type {number}
         * @name width
         * @memberof TMXGroup
         */
        public width: number;
        /**
         * group height
         * @public
         * @type {number}
         * @name height
         * @memberof TMXGroup
         */
        public height: number;
        /**
         * tint color
         * @public
         * @type {string}
         * @name tintcolor
         * @memberof TMXGroup
         */
        public tintcolor: string;
        /**
         * the group class
         * @public
         * @type {string}
         * @name class
         * @memberof TMXGroup
         */
        public class: string;
        /**
         * group z order
         * @public
         * @type {number}
         * @name z
         * @memberof TMXGroup
         */
        public z: number;
        /**
         * group objects list definition
         * @see TMXObject
         * @public
         * @type {object[]}
         * @name name
         * @memberof TMXGroup
         */
        public objects: object[];
        opacity: number;
        /**
         * reset function
         * @ignore
         */
        destroy(): void;
        /**
         * return the object count
         * @ignore
         */
        getObjectCount(): number;
        /**
         * returns the object at the specified index
         * @ignore
         */
        getObjectByIndex(idx: any): any;
    }
}
declare module "level/tiled/TMXTileMap" {
    export default TMXTileMap;
    /**
     * @classdesc
     * a TMX Tile Map Object
     * Tiled QT +0.7.x format
     */
    class TMXTileMap {
        /**
         * @param {string} levelId name of TMX map
         * @param {object} data TMX map in JSON format
         * @example
         * // create a new level object based on the TMX JSON object
         * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
         * // add the level to the game world container
         * level.addTo(me.game.world, true);
         */
        constructor(levelId: string, data: object);
        /**
         * the level data (JSON)
         * @ignore
         */
        data: any;
        /**
         * name of the tilemap
         * @public
         * @type {string}
         * @name TMXTileMap#name
         */
        public name: string;
        /**
         * width of the tilemap in tiles
         * @public
         * @type {number}
         * @name TMXTileMap#cols
         */
        public cols: number;
        /**
         * height of the tilemap in tiles
         * @public
         * @type {number}
         * @name TMXTileMap#rows
         */
        public rows: number;
        /**
         * Tile width
         * @public
         * @type {number}
         * @name TMXTileMap#tilewidth
         */
        public tilewidth: number;
        /**
         * Tile height
         * @public
         * @type {number}
         * @name TMXTileMap#tileheight
         */
        public tileheight: number;
        /**
         * is the map an infinite map
         * @public
         * @type {number}
         * @default 0
         * @name TMXTileMap#infinite
         */
        public infinite: number;
        /**
         * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered” and “hexagonal”.
         * @public
         * @type {string}
         * @default "orthogonal"
         * @name TMXTileMap#orientation
         */
        public orientation: string;
        /**
         * the order in which tiles on orthogonal tile layers are rendered.
         * (valid values are "left-down", "left-up", "right-down", "right-up")
         * @public
         * @type {string}
         * @default "right-down"
         * @name TMXTileMap#renderorder
         */
        public renderorder: string;
        /**
         * the TMX format version
         * @public
         * @type {string}
         * @name TMXTileMap#version
         */
        public version: string;
        /**
         * The Tiled version used to save the file (since Tiled 1.0.1).
         * @public
         * @type {string}
         * @name TMXTileMap#tiledversion
         */
        public tiledversion: string;
        /**
         * The map class.
         * @public
         * @type {string}
         * @name TMXTileMap#class
         */
        public class: string;
        tilesets: TMXTilesetGroup;
        layers: any[];
        objectGroups: any[];
        isEditor: boolean;
        nextobjectid: number;
        hexsidelength: number;
        staggeraxis: any;
        staggerindex: any;
        bounds: any;
        width: any;
        height: any;
        backgroundcolor: any;
        initialized: boolean;
        /**
         * Return the map default renderer
         * @name getRenderer
         * @memberof TMXTileMap
         * @public
         * @returns {TMXRenderer} a TMX renderer
         */
        public getRenderer(): TMXRenderer;
        renderer: TMXOrthogonalRenderer | TMXIsometricRenderer | TMXHexagonalRenderer;
        /**
         * return the map bounding rect
         * @name TMXRenderer#getBounds
         * @public
         * @returns {Bounds}
         */
        public getBounds(): Bounds;
        /**
         * parse the map
         * @ignore
         */
        readMapObjects(data: any): void;
        /**
         * add all the map layers and objects to the given container.
         * note : this will not automatically update the camera viewport
         * @name TMXTileMap#addTo
         * @public
         * @param {Container} container target container
         * @param {boolean} [flatten=true] if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
         * @param {boolean} [setViewportBounds=false] if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
         * @example
         * // create a new level object based on the TMX JSON object
         * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
         * // add the level to the game world container
         * level.addTo(me.game.world, true, true);
         */
        public addTo(container: Container, flatten?: boolean, setViewportBounds?: boolean): void;
        /**
         * return an Array of instantiated objects, based on the map object definition
         * @name TMXTileMap#getObjects
         * @public
         * @param {boolean} [flatten=true] if true, flatten all objects into the returned array.
         * when false, a `me.Container` object will be created for each corresponding groups
         * @returns {Renderable[]} Array of Objects
         */
        public getObjects(flatten?: boolean): Renderable[];
        /**
         * return all the existing layers
         * @name TMXTileMap#getLayers
         * @public
         * @returns {TMXLayer[]} Array of Layers
         */
        public getLayers(): TMXLayer[];
        /**
         * destroy function, clean all allocated objects
         * @name TMXTileMap#destroy
         * @public
         */
        public destroy(): void;
    }
    import TMXTilesetGroup from "level/tiled/TMXTilesetGroup";
    import TMXOrthogonalRenderer from "level/tiled/renderer/TMXOrthogonalRenderer";
    import TMXIsometricRenderer from "level/tiled/renderer/TMXIsometricRenderer";
    import TMXHexagonalRenderer from "level/tiled/renderer/TMXHexagonalRenderer";
    import Container from "renderable/container";
    import Renderable from "renderable/renderable";
    import TMXLayer from "level/tiled/TMXLayer";
}
declare module "level/level" {
    export default level;
    namespace level {
        /**
         * add a level into the game manager (usually called by the preloader)
         * @name add
         * @memberof level
         * @public
         * @param {string} format level format (only "tmx" supported)
         * @param {string} levelId the level id (or name)
         * @param {Function} [callback] a function to be called once the level is loaded
         * @returns {boolean} true if the level was loaded
         */
        function add(format: string, levelId: string, callback?: Function): boolean;
        /**
         * add a level into the game manager (usually called by the preloader)
         * @name add
         * @memberof level
         * @public
         * @param {string} format level format (only "tmx" supported)
         * @param {string} levelId the level id (or name)
         * @param {Function} [callback] a function to be called once the level is loaded
         * @returns {boolean} true if the level was loaded
         */
        function add(format: string, levelId: string, callback?: Function): boolean;
        /**
         * load a level into the game manager<br>
         * (will also create all level defined entities, etc..)
         * @name load
         * @memberof level
         * @public
         * @param {string} levelId level id
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
         * @returns {boolean} true if the level was successfully loaded
         * @example
         * // the game assets to be be preloaded
         * // TMX maps
         * var resources = [
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
         * var levelContainer = new me.Container();
         * me.level.load("a4_level2", {container:levelContainer});
         * // add a simple transformation
         * levelContainer.currentTransform.translate(levelContainer.width / 2, levelContainer.height / 2 );
         * levelContainer.currentTransform.rotate(0.05);
         * levelContainer.currentTransform.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
         * // add it to the game world
         * me.game.world.addChild(levelContainer);
         */
        function load(levelId: string, options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
            setViewportBounds?: boolean;
        }): boolean;
        /**
         * load a level into the game manager<br>
         * (will also create all level defined entities, etc..)
         * @name load
         * @memberof level
         * @public
         * @param {string} levelId level id
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
         * @returns {boolean} true if the level was successfully loaded
         * @example
         * // the game assets to be be preloaded
         * // TMX maps
         * var resources = [
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
         * var levelContainer = new me.Container();
         * me.level.load("a4_level2", {container:levelContainer});
         * // add a simple transformation
         * levelContainer.currentTransform.translate(levelContainer.width / 2, levelContainer.height / 2 );
         * levelContainer.currentTransform.rotate(0.05);
         * levelContainer.currentTransform.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
         * // add it to the game world
         * me.game.world.addChild(levelContainer);
         */
        function load(levelId: string, options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
            setViewportBounds?: boolean;
        }): boolean;
        /**
         * return the current level id<br>
         * @name getCurrentLevelId
         * @memberof level
         * @public
         * @returns {string}
         */
        function getCurrentLevelId(): string;
        /**
         * return the current level id<br>
         * @name getCurrentLevelId
         * @memberof level
         * @public
         * @returns {string}
         */
        function getCurrentLevelId(): string;
        /**
         * return the current level definition.
         * for a reference to the live instantiated level,
         * rather use the container in which it was loaded (e.g. me.game.world)
         * @name getCurrentLevel
         * @memberof level
         * @public
         * @returns {TMXTileMap}
         */
        function getCurrentLevel(): TMXTileMap;
        /**
         * return the current level definition.
         * for a reference to the live instantiated level,
         * rather use the container in which it was loaded (e.g. me.game.world)
         * @name getCurrentLevel
         * @memberof level
         * @public
         * @returns {TMXTileMap}
         */
        function getCurrentLevel(): TMXTileMap;
        /**
         * reload the current level
         * @name reload
         * @memberof level
         * @public
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @returns {object} the current level
         */
        function reload(options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
        }): any;
        /**
         * reload the current level
         * @name reload
         * @memberof level
         * @public
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @returns {object} the current level
         */
        function reload(options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
        }): any;
        /**
         * load the next level
         * @name next
         * @memberof level
         * @public
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @returns {boolean} true if the next level was successfully loaded
         */
        function next(options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
        }): boolean;
        /**
         * load the next level
         * @name next
         * @memberof level
         * @public
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @returns {boolean} true if the next level was successfully loaded
         */
        function next(options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
        }): boolean;
        /**
         * load the previous level<br>
         * @name previous
         * @memberof level
         * @public
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @returns {boolean} true if the previous level was successfully loaded
         */
        function previous(options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
        }): boolean;
        /**
         * load the previous level<br>
         * @name previous
         * @memberof level
         * @public
         * @param {object} [options] additional optional parameters
         * @param {Container} [options.container=game.world] container in which to load the specified level
         * @param {Function} [options.onLoaded=game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=game.mergeGroup] if true, flatten all objects into the given container
         * @returns {boolean} true if the previous level was successfully loaded
         */
        function previous(options?: {
            container?: Container;
            onLoaded?: Function;
            flatten?: boolean;
        }): boolean;
        /**
         * return the amount of level preloaded
         * @name levelCount
         * @memberof level
         * @public
         * @returns {number} the amount of level preloaded
         */
        function levelCount(): number;
        /**
         * return the amount of level preloaded
         * @name levelCount
         * @memberof level
         * @public
         * @returns {number} the amount of level preloaded
         */
        function levelCount(): number;
    }
    import TMXTileMap from "level/tiled/TMXTileMap";
}
declare module "loader/loader" {
    export default loader;
    namespace loader {
        const nocache: string;
        const onload: any;
        const onProgress: any;
        const crossOrigin: string;
        const withCredentials: boolean;
        /**
         * just increment the number of already loaded resources
         * @ignore
         */
        function onResourceLoaded(res: any): void;
        /**
         * just increment the number of already loaded resources
         * @ignore
         */
        function onResourceLoaded(res: any): void;
        /**
         * on error callback for image loading
         * @ignore
         */
        function onLoadingError(res: any): never;
        /**
         * on error callback for image loading
         * @ignore
         */
        function onLoadingError(res: any): never;
        /**
         * enable the nocache mechanism
         * @ignore
         */
        function setNocache(enable: any): void;
        /**
         * enable the nocache mechanism
         * @ignore
         */
        function setNocache(enable: any): void;
        /**
         * change the default baseURL for the given asset type.<br>
         * (this will prepend the asset URL and must finish with a '/')
         * @name setBaseURL
         * @memberof loader
         * @public
         * @param {string} type  "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
         * @param {string} [url="./"] default base URL
         * @example
         * // change the base URL relative address for audio assets
         * me.loader.setBaseURL("audio", "data/audio/");
         * // change the base URL absolute address for all object types
         * me.loader.setBaseURL("*", "http://myurl.com/")
         */
        function setBaseURL(type: string, url?: string): void;
        /**
         * change the default baseURL for the given asset type.<br>
         * (this will prepend the asset URL and must finish with a '/')
         * @name setBaseURL
         * @memberof loader
         * @public
         * @param {string} type  "*", "audio", binary", "image", "json", "js", "tmx", "tsx"
         * @param {string} [url="./"] default base URL
         * @example
         * // change the base URL relative address for audio assets
         * me.loader.setBaseURL("audio", "data/audio/");
         * // change the base URL absolute address for all object types
         * me.loader.setBaseURL("*", "http://myurl.com/")
         */
        function setBaseURL(type: string, url?: string): void;
        /**
         * set all the specified game resources to be preloaded.
         * @name preload
         * @memberof loader
         * @public
         * @param {object[]} res
         * @param {string} res.name internal name of the resource
         * @param {string} res.type  "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
         * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
         * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
         * @param {Function} [onload=loader.onload] function to be called when all resources are loaded
         * @param {boolean} [switchToLoadState=true] automatically switch to the loading screen
         * @example
         * game_resources = [
         *   // PNG tileset
         *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
         *   // PNG packed texture
         *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
         *   // PNG base64 encoded image
         *   {name: "texture", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."}
         *   // TSX file
         *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"},
         *   // TMX level (XML & JSON)
         *   {name: "map1", type: "tmx", src: "data/map/map1.json"},
         *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"},
         *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}},
         *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}},
         *   // audio resources
         *   {name: "bgmusic", type: "audio",  src: "data/audio/"},
         *   {name: "cling",   type: "audio",  src: "data/audio/"},
         *   // base64 encoded audio resources
         *   {name: "band",   type: "audio",  src: "data:audio/wav;base64,..."},
         *   // binary file
         *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
         *   // JSON file (used for texturePacker)
         *   {name: "texture", type: "json", src: "data/gfx/texture.json"},
         *   // JavaScript file
         *   {name: "plugin", type: "js", src: "data/js/plugin.js"},
         *   // Font Face
         *   { name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')" }
         * ];
         * ...
         * // set all resources to be loaded
         * me.loader.preload(game.resources, this.loaded.bind(this));
         */
        function preload(res: {
            name: string;
            type: string;
            src: string;
            stream?: boolean;
        }[], onload?: Function, switchToLoadState?: boolean): void;
        /**
         * set all the specified game resources to be preloaded.
         * @name preload
         * @memberof loader
         * @public
         * @param {object[]} res
         * @param {string} res.name internal name of the resource
         * @param {string} res.type  "audio", binary", "image", "json","js", "tmx", "tsx", "fontface"
         * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
         * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
         * @param {Function} [onload=loader.onload] function to be called when all resources are loaded
         * @param {boolean} [switchToLoadState=true] automatically switch to the loading screen
         * @example
         * game_resources = [
         *   // PNG tileset
         *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
         *   // PNG packed texture
         *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
         *   // PNG base64 encoded image
         *   {name: "texture", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."}
         *   // TSX file
         *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"},
         *   // TMX level (XML & JSON)
         *   {name: "map1", type: "tmx", src: "data/map/map1.json"},
         *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"},
         *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}},
         *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}},
         *   // audio resources
         *   {name: "bgmusic", type: "audio",  src: "data/audio/"},
         *   {name: "cling",   type: "audio",  src: "data/audio/"},
         *   // base64 encoded audio resources
         *   {name: "band",   type: "audio",  src: "data:audio/wav;base64,..."},
         *   // binary file
         *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
         *   // JSON file (used for texturePacker)
         *   {name: "texture", type: "json", src: "data/gfx/texture.json"},
         *   // JavaScript file
         *   {name: "plugin", type: "js", src: "data/js/plugin.js"},
         *   // Font Face
         *   { name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')" }
         * ];
         * ...
         * // set all resources to be loaded
         * me.loader.preload(game.resources, this.loaded.bind(this));
         */
        function preload(res: {
            name: string;
            type: string;
            src: string;
            stream?: boolean;
        }[], onload?: Function, switchToLoadState?: boolean): void;
        /**
         * Load a single resource (to be used if you need to load additional resource during the game)
         * @name load
         * @memberof loader
         * @public
         * @param {object} res
         * @param {string} res.name internal name of the resource
         * @param {string} res.type  "audio", binary", "image", "json", "tmx", "tsx"
         * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
         * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
         * @param {Function} [onload] function to be called when the resource is loaded
         * @param {Function} [onerror] function to be called in case of error
         * @returns {number} the amount of corresponding resource to be preloaded
         * @example
         * // load an image asset
         * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
         * // load a base64 image asset
         *  me.loader.load({name: "avatar", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."};
         * // start loading music
         * me.loader.load({
         *     name   : "bgmusic",
         *     type   : "audio",
         *     src    : "data/audio/"
         * }, function () {
         *     me.audio.play("bgmusic");
         * });
         */
        function load(res: {
            name: string;
            type: string;
            src: string;
            stream?: boolean;
        }, onload?: Function, onerror?: Function): number;
        /**
         * Load a single resource (to be used if you need to load additional resource during the game)
         * @name load
         * @memberof loader
         * @public
         * @param {object} res
         * @param {string} res.name internal name of the resource
         * @param {string} res.type  "audio", binary", "image", "json", "tmx", "tsx"
         * @param {string} res.src  path and/or file name of the resource (for audio assets only the path is required)
         * @param {boolean} [res.stream] Set to true to force HTML5 Audio, which allows not to wait for large file to be downloaded before playing.
         * @param {Function} [onload] function to be called when the resource is loaded
         * @param {Function} [onerror] function to be called in case of error
         * @returns {number} the amount of corresponding resource to be preloaded
         * @example
         * // load an image asset
         * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
         * // load a base64 image asset
         *  me.loader.load({name: "avatar", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."};
         * // start loading music
         * me.loader.load({
         *     name   : "bgmusic",
         *     type   : "audio",
         *     src    : "data/audio/"
         * }, function () {
         *     me.audio.play("bgmusic");
         * });
         */
        function load(res: {
            name: string;
            type: string;
            src: string;
            stream?: boolean;
        }, onload?: Function, onerror?: Function): number;
        /**
         * unload specified resource to free memory
         * @name unload
         * @memberof loader
         * @public
         * @param {object} res
         * @param {string} res.name internal name of the resource
         * @param {string} res.type  "audio", binary", "image", "json", "tmx", "tsx"
         * @returns {boolean} true if unloaded
         * @example me.loader.unload({name: "avatar",  type:"image"});
         */
        function unload(res: {
            name: string;
            type: string;
        }): boolean;
        /**
         * unload specified resource to free memory
         * @name unload
         * @memberof loader
         * @public
         * @param {object} res
         * @param {string} res.name internal name of the resource
         * @param {string} res.type  "audio", binary", "image", "json", "tmx", "tsx"
         * @returns {boolean} true if unloaded
         * @example me.loader.unload({name: "avatar",  type:"image"});
         */
        function unload(res: {
            name: string;
            type: string;
        }): boolean;
        /**
         * unload all resources to free memory
         * @name unloadAll
         * @memberof loader
         * @public
         * @example me.loader.unloadAll();
         */
        function unloadAll(): void;
        /**
         * unload all resources to free memory
         * @name unloadAll
         * @memberof loader
         * @public
         * @example me.loader.unloadAll();
         */
        function unloadAll(): void;
        /**
         * return the specified TMX/TSX object
         * @name getTMX
         * @memberof loader
         * @public
         * @param {string} elt name of the tmx/tsx element ("map1");
         * @returns {object} requested element or null if not found
         */
        function getTMX(elt: string): any;
        /**
         * return the specified TMX/TSX object
         * @name getTMX
         * @memberof loader
         * @public
         * @param {string} elt name of the tmx/tsx element ("map1");
         * @returns {object} requested element or null if not found
         */
        function getTMX(elt: string): any;
        /**
         * return the specified Binary object
         * @name getBinary
         * @memberof loader
         * @public
         * @param {string} elt name of the binary object ("ymTrack");
         * @returns {object} requested element or null if not found
         */
        function getBinary(elt: string): any;
        /**
         * return the specified Binary object
         * @name getBinary
         * @memberof loader
         * @public
         * @param {string} elt name of the binary object ("ymTrack");
         * @returns {object} requested element or null if not found
         */
        function getBinary(elt: string): any;
        /**
         * return the specified Image Object
         * @name getImage
         * @memberof loader
         * @public
         * @param {string} image name of the Image element ("tileset-platformer");
         * @returns {HTMLImageElement} requested element or null if not found
         */
        function getImage(image: string): HTMLImageElement;
        /**
         * return the specified Image Object
         * @name getImage
         * @memberof loader
         * @public
         * @param {string} image name of the Image element ("tileset-platformer");
         * @returns {HTMLImageElement} requested element or null if not found
         */
        function getImage(image: string): HTMLImageElement;
        /**
         * return the specified JSON Object
         * @name getJSON
         * @memberof loader
         * @public
         * @param {string} elt name of the json file to load
         * @returns {object}
         */
        function getJSON(elt: string): any;
        /**
         * return the specified JSON Object
         * @name getJSON
         * @memberof loader
         * @public
         * @param {string} elt name of the json file to load
         * @returns {object}
         */
        function getJSON(elt: string): any;
    }
}
declare module "renderable/sprite" {
    export default Sprite;
    /**
     * @classdesc
     * An object to display a fixed or animated sprite on screen.
     * @augments Renderable
     */
    class Sprite extends Renderable {
        /**
         * @param {number} x the x coordinates of the sprite object
         * @param {number} y the y coordinates of the sprite object
         * @param {object} settings Configuration parameters for the Sprite object
         * @param {HTMLImageElement|HTMLCanvasElement|TextureAtlas|string} settings.image reference to spritesheet image, a texture atlas or to a texture atlas
         * @param {string} [settings.name=""] name of this object
         * @param {string} [settings.region] region name of a specific region to use when using a texture atlas, see {@link TextureAtlas}
         * @param {number} [settings.framewidth] Width of a single frame within the spritesheet
         * @param {number} [settings.frameheight] Height of a single frame within the spritesheet
         * @param {string|Color} [settings.tint] a tint to be applied to this sprite
         * @param {number} [settings.flipX] flip the sprite on the horizontal axis
         * @param {number} [settings.flipY] flip the sprite on the vertical axis
         * @param {Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
         * @example
         * // create a single sprite from a standalone image, with anchor in the center
         * var sprite = new me.Sprite(0, 0, {
         *     image : "PlayerTexture",
         *     framewidth : 64,
         *     frameheight : 64,
         *     anchorPoint : new me.Vector2d(0.5, 0.5)
         * });
         *
         * // create a single sprite from a packed texture
         * game.texture = new me.TextureAtlas(
         *     me.loader.getJSON("texture"),
         *     me.loader.getImage("texture")
         * );
         * var sprite = new me.Sprite(0, 0, {
         *     image : game.texture,
         *     region : "npc2.png",
         * });
         */
        constructor(x: number, y: number, settings: {
            image: HTMLImageElement | HTMLCanvasElement | TextureAtlas | string;
            name?: string;
            region?: string;
            framewidth?: number;
            frameheight?: number;
            tint?: string | Color;
            flipX?: number;
            flipY?: number;
            anchorPoint?: Vector2d;
        });
        /**
         * pause and resume animation
         * @public
         * @type {boolean}
         * @default false
         * @name Sprite#animationpause
         */
        public animationpause: boolean;
        /**
         * animation cycling speed (delay between frame in ms)
         * @public
         * @type {number}
         * @default 100
         * @name Sprite#animationspeed
         */
        public animationspeed: number;
        /**
         * global offset for the position to draw from on the source image.
         * @public
         * @type {Vector2d}
         * @default <0.0,0.0>
         * @name offset
         * @memberof Sprite#
         */
        public offset: Vector2d;
        /**
         * The source texture object this sprite object is using
         * @public
         * @type {TextureAtlas}
         * @name source
         * @memberof Sprite#
         */
        public source: TextureAtlas;
        anim: {};
        resetAnim: any;
        current: {
            name: string;
            length: number;
            offset: any;
            width: number;
            height: number;
            angle: number;
            idx: number;
        };
        dt: number;
        _flicker: {
            isFlickering: boolean;
            duration: number;
            callback: any;
            state: boolean;
        };
        image: HTMLCanvasElement | HTMLImageElement;
        textureAtlas: any;
        atlasIndices: any;
        /**
         * return the flickering state of the object
         * @name isFlickering
         * @memberof Sprite
         * @returns {boolean}
         */
        isFlickering(): boolean;
        /**
         * make the object flicker
         * @name flicker
         * @memberof Sprite
         * @param {number} duration expressed in milliseconds
         * @param {Function} callback Function to call when flickering ends
         * @returns {Sprite} Reference to this object for method chaining
         * @example
         * // make the object flicker for 1 second
         * // and then remove it
         * this.flicker(1000, function () {
         *     me.game.world.removeChild(this);
         * });
         */
        flicker(duration: number, callback: Function): Sprite;
        /**
         * add an animation <br>
         * For fixed-sized cell sprite sheet, the index list must follow the
         * logic as per the following example :<br>
         * <img src="images/spritesheet_grid.png"/>
         * @name addAnimation
         * @memberof Sprite
         * @param {string} name animation id
         * @param {number[]|string[]|object[]} index list of sprite index or name
         * defining the animation. Can also use objects to specify delay for each frame, see below
         * @param {number} [animationspeed] cycling speed for animation in ms
         * @returns {number} frame amount of frame added to the animation (delay between each frame).
         * @see Sprite#animationspeed
         * @example
         * // walking animation
         * this.addAnimation("walk", [ 0, 1, 2, 3, 4, 5 ]);
         * // standing animation
         * this.addAnimation("stand", [ 11, 12 ]);
         * // eating animation
         * this.addAnimation("eat", [ 6, 6 ]);
         * // rolling animation
         * this.addAnimation("roll", [ 7, 8, 9, 10 ]);
         * // slower animation
         * this.addAnimation("roll", [ 7, 8, 9, 10 ], 200);
         * // or get more specific with delay for each frame. Good solution instead of repeating:
         * this.addAnimation("turn", [{ name: 0, delay: 200 }, { name: 1, delay: 100 }])
         * // can do this with atlas values as well:
         * this.addAnimation("turn", [{ name: "turnone", delay: 200 }, { name: "turntwo", delay: 100 }])
         * // define an dying animation that stop on the last frame
         * this.addAnimation("die", [{ name: 3, delay: 200 }, { name: 4, delay: 100 }, { name: 5, delay: Infinity }])
         * // set the standing animation as default
         * this.setCurrentAnimation("stand");
         */
        addAnimation(name: string, index: number[] | string[] | object[], animationspeed?: number): number;
        /**
         * set the current animation
         * this will always change the animation & set the frame to zero
         * @name setCurrentAnimation
         * @memberof Sprite
         * @param {string} name animation id
         * @param {string|Function} [resetAnim] animation id to switch to when complete, or callback
         * @param {boolean} [preserve_dt=false] if false will reset the elapsed time counter since last frame
         * @returns {Sprite} Reference to this object for method chaining
         * @example
         * // set "walk" animation
         * this.setCurrentAnimation("walk");
         *
         * // set "walk" animation if it is not the current animation
         * if (this.isCurrentAnimation("walk")) {
         *     this.setCurrentAnimation("walk");
         * }
         *
         * // set "eat" animation, and switch to "walk" when complete
         * this.setCurrentAnimation("eat", "walk");
         *
         * // set "die" animation, and remove the object when finished
         * this.setCurrentAnimation("die", (function () {
         *    me.game.world.removeChild(this);
         *    return false; // do not reset to first frame
         * }).bind(this));
         *
         * // set "attack" animation, and pause for a short duration
         * this.setCurrentAnimation("die", (function () {
         *    this.animationpause = true;
         *
         *    // back to "standing" animation after 1 second
         *    setTimeout(function () {
         *        this.setCurrentAnimation("standing");
         *    }, 1000);
         *
         *    return false; // do not reset to first frame
         * }).bind(this));
         */
        setCurrentAnimation(name: string, resetAnim?: string | Function, preserve_dt?: boolean): Sprite;
        /**
         * reverse the given or current animation if none is specified
         * @name reverseAnimation
         * @memberof Sprite
         * @param {string} [name] animation id
         * @returns {Sprite} Reference to this object for method chaining
         * @see Sprite#animationspeed
         */
        reverseAnimation(name?: string): Sprite;
        /**
         * return true if the specified animation is the current one.
         * @name isCurrentAnimation
         * @memberof Sprite
         * @param {string} name animation id
         * @returns {boolean}
         * @example
         * if (!this.isCurrentAnimation("walk")) {
         *     // do something funny...
         * }
         */
        isCurrentAnimation(name: string): boolean;
        /**
         * change the current texture atlas region for this sprite
         * @see Texture.getRegion
         * @name setRegion
         * @memberof Sprite
         * @param {object} region typically returned through me.Texture.getRegion()
         * @returns {Sprite} Reference to this object for method chaining
         * @example
         * // change the sprite to "shadedDark13.png";
         * mySprite.setRegion(game.texture.getRegion("shadedDark13.png"));
         */
        setRegion(region: object): Sprite;
        /**
         * force the current animation frame index.
         * @name setAnimationFrame
         * @memberof Sprite
         * @param {number} [idx=0] animation frame index
         * @returns {Sprite} Reference to this object for method chaining
         * @example
         * // reset the current animation to the first frame
         * this.setAnimationFrame();
         */
        setAnimationFrame(idx?: number): Sprite;
        /**
         * return the current animation frame index.
         * @name getCurrentAnimationFrame
         * @memberof Sprite
         * @returns {number} current animation frame index
         */
        getCurrentAnimationFrame(): number;
        /**
         * Returns the frame object by the index.
         * @name getAnimationFrameObjectByIndex
         * @memberof Sprite
         * @ignore
         * @param {number} id the frame id
         * @returns {number} if using number indices. Returns {object} containing frame data if using texture atlas
         */
        getAnimationFrameObjectByIndex(id: number): number;
        /**
         * Destroy function<br>
         * @ignore
         */
        destroy(): void;
    }
    import Renderable from "renderable/renderable";
    import { TextureAtlas } from "video/texture/atlas";
    import Color from "math/color";
}
declare module "video/texture/atlas" {
    /**
     * create a simple 1 frame texture atlas based on the given parameters
     * @ignore
     */
    export function createAtlas(width: any, height: any, name?: string, repeat?: string): {
        meta: {
            app: string;
            size: {
                w: any;
                h: any;
            };
            repeat: string;
            image: string;
        };
        frames: {
            filename: string;
            frame: {
                x: number;
                y: number;
                w: any;
                h: any;
            };
        }[];
    };
    /**
     * @classdesc
     * A Texture atlas class, currently supports : <br>
     * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export (standard and multipack texture atlas) <br>
     * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
     * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
     * - [Free Texture Packer]{@link http://free-tex-packer.com/app/} : through JSON export (standard and multipack texture atlas) <br>
     * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx, anchorPoint:me.Vector2d} object
     * );
     */
    export class TextureAtlas {
        /**
         * @param {object|object[]} atlases atlas information. See {@link loader.getJSON}
         * @param {HTMLImageElement|HTMLCanvasElement|string|HTMLImageElement[]|HTMLCanvasElement[]|string[]} [src=atlas.meta.image] Image source
         * @param {boolean} [cache=false] Use true to skip caching this Texture
         * @example
         * // create a texture atlas from a JSON Object
         * game.texture = new me.TextureAtlas(
         *     me.loader.getJSON("texture")
         * );
         *
         * // create a texture atlas from a multipack JSON Object
         * game.texture = new me.TextureAtlas([
         *     me.loader.getJSON("texture-0"),
         *     me.loader.getJSON("texture-1"),
         *     me.loader.getJSON("texture-2")
         * ]);
         *
         * // create a texture atlas for a spritesheet with an anchorPoint in the center of each frame
         * game.texture = new me.TextureAtlas(
         *     {
         *         framewidth : 32,
         *         frameheight : 32,
         *         anchorPoint : new me.Vector2d(0.5, 0.5)
         *     },
         *     me.loader.getImage("spritesheet")
         */
        constructor(atlases: object | object[], src?: HTMLImageElement | HTMLCanvasElement | string | HTMLImageElement[] | HTMLCanvasElement[] | string[], cache?: boolean);
        /**
         * to identify the atlas format (e.g. texture packer)
         * @ignore
         */
        format: string;
        /**
         * the texture source(s) itself
         * @type {Map}
         * @ignore
         */
        sources: Map<any, any>;
        /**
         * the atlas dictionnaries
         * @type {Map}
         * @ignore
         */
        atlases: Map<any, any>;
        repeat: any;
        /**
         * build an atlas from the given data
         * @ignore
         */
        parse(data: any): {};
        /**
         * build an atlas from the given spritesheet
         * @ignore
         */
        parseFromSpriteSheet(data: any): {};
        /**
         * return the default or specified atlas dictionnary
         * @param {string} [name] atlas name in case of multipack textures
         * @returns {object}
         */
        getAtlas(name?: string): object;
        /**
         * return the format of the atlas dictionnary
         * @returns {string} will return "texturepacker", or "ShoeBox", or "melonJS", or "Spritesheet (fixed cell size)"
         */
        getFormat(): string;
        /**
         * return the source texture for the given region (or default one if none specified)
         * @param {object} [region] region name in case of multipack textures
         * @returns {HTMLImageElement|HTMLCanvasElement}
         */
        getTexture(region?: object): HTMLImageElement | HTMLCanvasElement;
        /**
         * add a region to the atlas
         * @param {string} name region mame
         * @param {number} x x origin of the region
         * @param {number} y y origin of the region
         * @param {number} w width of the region
         * @param {number} h height of the region
         * @returns {object} the created region
         */
        addRegion(name: string, x: number, y: number, w: number, h: number): object;
        /**
         * return a normalized region (or frame) information for the specified sprite name
         * @param {string} name name of the sprite
         * @param {string} [atlas] name of a specific atlas where to search for the region
         * @returns {object}
         */
        getRegion(name: string, atlas?: string): object;
        /**
         * return the uvs mapping for the given region
         * @param {object} name region (or frame) name
         * @returns {Float32Array} region Uvs
         */
        getUVs(name: object): Float32Array;
        /**
         * add uvs mapping for the given region
         * @param {object} atlas the atlas dictionnary where the region is define
         * @param {object} name region (or frame) name
         * @param {number} w the width of the region
         * @param {number} h the height of the region
         * @returns {Float32Array} the created region UVs
         */
        addUVs(atlas: object, name: object, w: number, h: number): Float32Array;
        /**
         * Create a sprite object using the first region found using the specified name
         * @param {string} name name of the sprite
         * @param {object} [settings] Additional settings passed to the {@link Sprite} contructor
         * @param {boolean} [nineSlice=false] if true returns a 9-slice sprite
         * @returns {Sprite|NineSliceSprite}
         * @example
         * // create a new texture object under the `game` namespace
         * game.texture = new me.TextureAtlas(
         *    me.loader.getJSON("texture"),
         *    me.loader.getImage("texture")
         * );
         * ...
         * ...
         * // create a new "coin" sprite
         * var sprite = game.texture.createSpriteFromName("coin.png");
         * // set the renderable position to bottom center
         * sprite.anchorPoint.set(0.5, 1.0);
         * ...
         * ...
         * // create a 9-slice sprite
         * var dialogPanel = game.texture.createSpriteFromName(
         *    "rpg_dialo.png",
         *    // width & height are mandatory for 9-slice sprites
         *    { width: this.width, height: this.height },
         *    true
         * );
         */
        createSpriteFromName(name: string, settings?: object, nineSlice?: boolean): Sprite | NineSliceSprite;
        /**
         * Create an animation object using the first region found using all specified names
         * @param {string[]|number[]} names list of names for each sprite
         * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
         * @param {object} [settings] Additional settings passed to the {@link Sprite} contructor
         * @returns {Sprite}
         * @example
         * // create a new texture object under the `game` namespace
         * game.texture = new me.TextureAtlas(
         *     me.loader.getJSON("texture"),
         *     me.loader.getImage("texture")
         * );
         *
         * // create a new Animated Sprite
         * var sprite = game.texture.createAnimationFromName([
         *     "walk0001.png", "walk0002.png", "walk0003.png",
         *     "walk0004.png", "walk0005.png", "walk0006.png",
         *     "walk0007.png", "walk0008.png", "walk0009.png",
         *     "walk0010.png", "walk0011.png"
         * ]);
         *
         * // define an additional basic walking animation
         * sprite.addAnimation ("simple_walk", [0,2,1]);
         * // you can also use frame name to define your animation
         * sprite.addAnimation ("speed_walk", ["walk0007.png", "walk0008.png", "walk0009.png", "walk0010.png"]);
         * // set the default animation
         * sprite.setCurrentAnimation("simple_walk");
         * // set the renderable position to bottom center
         * sprite.anchorPoint.set(0.5, 1.0);
         */
        createAnimationFromName(names: string[] | number[], settings?: object): Sprite;
    }
    import Sprite from "renderable/sprite";
}
declare module "video/texture/cache" {
    export default TextureCache;
    /**
     * a basic texture cache object
     * @ignore
     */
    class TextureCache {
        /**
         * @ignore
         */
        constructor(max_size: any);
        cache: ArrayMultimap<any, any>;
        tinted: Map<any, any>;
        units: Map<any, any>;
        max_size: any;
        /**
         * @ignore
         */
        clear(): void;
        length: number;
        /**
         * @ignore
         */
        validate(): void;
        /**
         * @ignore
         */
        get(image: any, atlas: any): any;
        /**
         * @ignore
         */
        delete(image: any): void;
        /**
         * @ignore
         */
        tint(src: any, color: any): any;
        /**
         * @ignore
         */
        set(image: any, texture: any): boolean;
        /**
         * @ignore
         */
        getUnit(texture: any): any;
    }
    import { ArrayMultimap } from "@teppeis/multimaps";
}
declare module "video/webgl/webgl_renderer" {
    export default WebGLRenderer;
    /**
     * @classdesc
     * a WebGL renderer object
     * @augments Renderer
     */
    class WebGLRenderer extends Renderer {
        /**
         * @param {object} options The renderer parameters
         * @param {number} options.width The width of the canvas without scaling
         * @param {number} options.height The height of the canvas without scaling
         * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
         * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing
         * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
         * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas
         * @param {boolean} [options.premultipliedAlpha=true] in WebGL, whether the renderer will assume that colors have premultiplied alpha when canvas transparency is enabled
         * @param {boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
         * @param {boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
         * @param {string} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
         * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
         * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
         * @param {WebGLCompositor} [options.compositor] A class that implements the compositor API
         */
        constructor(options: {
            width: number;
            height: number;
            canvas?: HTMLCanvasElement;
            antiAlias?: boolean;
            failIfMajorPerformanceCaveat?: boolean;
            transparent?: boolean;
            premultipliedAlpha?: boolean;
            subPixel?: boolean;
            preferWebGL1?: boolean;
            powerPreference?: string;
            zoomX?: number;
            zoomY?: number;
            compositor?: WebGLCompositor;
        });
        /**
         * The WebGL version used by this renderer (1 or 2)
         * @type {number}
         * @default 1
         * @readonly
         */
        readonly WebGLVersion: number;
        /**
         * The vendor string of the underlying graphics driver.
         * @type {string}
         * @default null
         * @readonly
         */
        readonly GPUVendor: string;
        /**
         * The renderer string of the underlying graphics driver.
         * @type {string}
         * @default null
         * @readonly
         */
        readonly GPURenderer: string;
        /**
         * The WebGL context
         * @name gl
         * @type {WebGLRenderingContext}
         */
        context: WebGLRenderingContext;
        gl: WebGLRenderingContext;
        /**
         * Maximum number of texture unit supported under the current context
         * @type {number}
         * @readonly
         */
        readonly maxTextures: number;
        /**
         * @ignore
         */
        _colorStack: any[];
        /**
         * @ignore
         */
        _matrixStack: any[];
        /**
         * @ignore
         */
        _scissorStack: any[];
        /**
         * @ignore
         */
        _blendStack: any[];
        /**
         * The current transformation matrix used for transformations on the overall scene
         * @type {Matrix2d}
         */
        currentTransform: Matrix2d;
        /**
         * The current compositor used by the renderer
         * @type {WebGLCompositor}
         */
        currentCompositor: WebGLCompositor;
        /**
         * The list of active compositors
         * @type {Map<WebGLCompositor>}
         */
        compositors: Map<WebGLCompositor, any>;
        cache: TextureCache;
        /**
         * set the active compositor for this renderer
         * @param {WebGLCompositor|string} compositor a compositor name or instance
         */
        setCompositor(compositor?: WebGLCompositor | string): void;
        /**
         * Reset the gl transform to identity
         */
        resetTransform(): void;
        /**
         * @ignore
         */
        createFontTexture(cache: any): void;
        /**
         * @ignore
         */
        fontContext2D: CanvasRenderingContext2D;
        /**
         * @ignore
         */
        fontTexture: TextureAtlas;
        /**
         * Create a pattern with the specified repetition
         * @param {Image} image Source image
         * @param {string} repeat Define how the pattern should be repeated
         * @returns {TextureAtlas}
         * @see ImageLayer#repeat
         * @example
         * var tileable   = renderer.createPattern(image, "repeat");
         * var horizontal = renderer.createPattern(image, "repeat-x");
         * var vertical   = renderer.createPattern(image, "repeat-y");
         * var basic      = renderer.createPattern(image, "no-repeat");
         */
        createPattern(image: new (width?: number, height?: number) => HTMLImageElement, repeat: string): TextureAtlas;
        /**
         * set/change the current projection matrix (WebGL only)
         * @param {Matrix3d} matrix
         */
        setProjection(matrix: Matrix3d): void;
        /**
         * Clears the gl context with the given color.
         * @param {Color|string} [color="#000000"] CSS color.
         * @param {boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
         */
        clearColor(color?: Color | string, opaque?: boolean): void;
        /**
         * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
         * @param {number} x x axis of the coordinate for the rectangle starting point.
         * @param {number} y y axis of the coordinate for the rectangle starting point.
         * @param {number} width The rectangle's width.
         * @param {number} height The rectangle's height.
         */
        clearRect(x: number, y: number, width: number, height: number): void;
        /**
         * @ignore
         */
        drawFont(bounds: any): void;
        /**
         * Draw an image to the gl context
         * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
         * @param {number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
         * @param {number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
         * @param {number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
         * @param {number} sh The height of the sub-rectangle of the source image to draw into the destination context.
         * @param {number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
         * @param {number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
         * @param {number} dw The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
         * @param {number} dh The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
         * @example
         * // Position the image on the canvas:
         * renderer.drawImage(image, dx, dy);
         * // Position the image on the canvas, and specify width and height of the image:
         * renderer.drawImage(image, dx, dy, dWidth, dHeight);
         * // Clip the image and position the clipped part on the canvas:
         * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
         */
        drawImage(image: new (width?: number, height?: number) => HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
        /**
         * Draw a pattern within the given rectangle.
         * @param {TextureAtlas} pattern Pattern object
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @see WebGLRenderer#createPattern
         */
        drawPattern(pattern: TextureAtlas, x: number, y: number, width: number, height: number): void;
        /**
         * Returns the WebGL Context object of the given canvas element
         * @param {HTMLCanvasElement} canvas
         * @param {boolean} [transparent=false] use true to enable transparency
         * @returns {WebGLRenderingContext}
         */
        getContextGL(canvas: HTMLCanvasElement, transparent?: boolean): WebGLRenderingContext;
        /**
         * Returns the WebGLContext instance for the renderer
         * return a reference to the system 2d Context
         * @returns {WebGLRenderingContext}
         */
        getContext(): WebGLRenderingContext;
        /**
         * set a blend mode for the given context. <br>
         * Supported blend mode between Canvas and WebGL remderer : <br>
         * - "normal" : this is the default mode and draws new content on top of the existing content <br>
         * <img src="images/normal-blendmode.png" width="510"/> <br>
         * - "multiply" : the pixels of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result. <br>
         * <img src="images/multiply-blendmode.png" width="510"/> <br>
         * - "additive or lighter" : where both content overlap the color is determined by adding color values. <br>
         * <img src="images/lighter-blendmode.png" width="510"/> <br>
         * - "screen" : The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply) <br>
         * <img src="images/screen-blendmode.png" width="510"/> <br>
         * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
         * @param {string} [mode="normal"] blend mode : "normal", "multiply", "lighter", "additive", "screen"
         * @param {WebGLRenderingContext} [gl]
         */
        setBlendMode(mode?: string, gl?: WebGLRenderingContext): void;
        currentBlendMode: any;
        /**
         * return a reference to the font 2d Context
         * @ignore
         */
        getFontContext(): CanvasRenderingContext2D;
        /**
         * restores the canvas context
         */
        restore(): void;
        /**
         * saves the canvas context
         */
        save(): void;
        /**
         * rotates the uniform matrix
         * @param {number} angle in radians
         */
        rotate(angle: number): void;
        /**
         * scales the uniform matrix
         * @param {number} x
         * @param {number} y
         */
        scale(x: number, y: number): void;
        /**
         * not used by this renderer?
         * @ignore
         */
        setAntiAlias(context: any, enable: any): void;
        /**
         * Set the global alpha
         * @param {number} alpha 0.0 to 1.0 values accepted.
         */
        setGlobalAlpha(alpha: number): void;
        /**
         * Return the global alpha
         * @returns {number} global alpha value
         */
        getGlobalAlpha(): number;
        /**
         * Set the current fill & stroke style color.
         * By default, or upon reset, the value is set to #000000.
         * @param {Color|string} color css color string.
         */
        setColor(color: Color | string): void;
        /**
         * Set the line width
         * @param {number} width Line width
         */
        setLineWidth(width: number): void;
        /**
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * @param {number} x arc center point x-axis
         * @param {number} y arc center point y-axis
         * @param {number} radius
         * @param {number} start start angle in radians
         * @param {number} end end angle in radians
         * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
         * @param {boolean} [fill=false]
         */
        strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean, fill?: boolean): void;
        /**
         * Fill an arc at the specified coordinates with given radius, start and end points
         * @param {number} x arc center point x-axis
         * @param {number} y arc center point y-axis
         * @param {number} radius
         * @param {number} start start angle in radians
         * @param {number} end end angle in radians
         * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean): void;
        /**
         * Stroke an ellipse at the specified coordinates with given radius
         * @param {number} x ellipse center point x-axis
         * @param {number} y ellipse center point y-axis
         * @param {number} w horizontal radius of the ellipse
         * @param {number} h vertical radius of the ellipse
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean): void;
        /**
         * Fill an ellipse at the specified coordinates with given radius
         * @param {number} x ellipse center point x-axis
         * @param {number} y ellipse center point y-axis
         * @param {number} w horizontal radius of the ellipse
         * @param {number} h vertical radius of the ellipse
         */
        fillEllipse(x: number, y: number, w: number, h: number): void;
        /**
         * Stroke a line of the given two points
         * @param {number} startX the start x coordinate
         * @param {number} startY the start y coordinate
         * @param {number} endX the end x coordinate
         * @param {number} endY the end y coordinate
         */
        strokeLine(startX: number, startY: number, endX: number, endY: number): void;
        /**
         * Fill a line of the given two points
         * @param {number} startX the start x coordinate
         * @param {number} startY the start y coordinate
         * @param {number} endX the end x coordinate
         * @param {number} endY the end y coordinate
         */
        fillLine(startX: number, startY: number, endX: number, endY: number): void;
        /**
         * Stroke a me.Polygon on the screen with a specified color
         * @param {Polygon} poly the shape to draw
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokePolygon(poly: Polygon, fill?: boolean): void;
        /**
         * Fill a me.Polygon on the screen
         * @param {Polygon} poly the shape to draw
         */
        fillPolygon(poly: Polygon): void;
        /**
         * Draw a stroke rectangle at the specified coordinates
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeRect(x: number, y: number, width: number, height: number, fill?: boolean): void;
        /**
         * Draw a filled rectangle at the specified coordinates
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        fillRect(x: number, y: number, width: number, height: number): void;
        /**
         * Stroke a rounded rectangle at the specified coordinates
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @param {number} radius
         * @param {boolean} [fill=false] also fill the shape with the current color if true
         */
        strokeRoundRect(x: number, y: number, width: number, height: number, radius: number, fill?: boolean): void;
        /**
         * Draw a rounded filled rectangle at the specified coordinates
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         * @param {number} radius
         */
        fillRoundRect(x: number, y: number, width: number, height: number, radius: number): void;
        /**
         * Stroke a Point at the specified coordinates
         * @param {number} x
         * @param {number} y
         */
        strokePoint(x: number, y: number): void;
        /**
         * Draw a a point at the specified coordinates
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        fillPoint(x: number, y: number): void;
        /**
         * Reset (overrides) the renderer transformation matrix to the
         * identity one, and then apply the given transformation matrix.
         * @param {Matrix2d} mat2d Matrix to transform by
         */
        setTransform(mat2d: Matrix2d): void;
        /**
         * Multiply given matrix into the renderer tranformation matrix
         * @param {Matrix2d} mat2d Matrix to transform by
         */
        transform(mat2d: Matrix2d): void;
        /**
         * Translates the uniform matrix by the given coordinates
         * @param {number} x
         * @param {number} y
         */
        translate(x: number, y: number): void;
        /**
         * clip the given region from the original canvas. Once a region is clipped,
         * all future drawing will be limited to the clipped region.
         * You can however save the current region using the save(),
         * and restore it (with the restore() method) any time in the future.
         * (<u>this is an experimental feature !</u>)
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        clipRect(x: number, y: number, width: number, height: number): void;
        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * Mask are not preserved through renderer context save and restore.
         * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] a shape defining the mask to be applied
         * @param {boolean} [invert=false] either the given shape should define what is visible (default) or the opposite
         */
        setMask(mask?: Rect | RoundRect | Polygon | Line | Ellipse, invert?: boolean): void;
    }
    import Renderer from "video/renderer";
    import Matrix2d from "math/matrix2";
    import WebGLCompositor from "video/webgl/webgl_compositor";
    import TextureCache from "video/texture/cache";
    import { TextureAtlas } from "video/texture/atlas";
    import Color from "math/color";
}
declare module "video/video" {
    /**
     * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
     * melonJS support various scaling mode, that can be enabled <u>once the scale option is set to <b>`auto`</b></u> : <br>
     *  - <i><b>`fit`</b></i> : Letterboxed; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-fit.png"/></center><br>
     *  - <i><b>`fill-min`</b></i> : Canvas is resized to fit minimum design resolution; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-fill-min.png"/></center><br>
     *  - <i><b>`fill-max`</b></i> : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-fill-max.png"/></center><br>
     *  - <i><b>`flex`</b><</i> : Canvas width & height is resized to fit; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-flex.png"/></center><br>
     *  - <i><b>`flex-width`</b></i> : Canvas width is resized to fit; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-flex-width.png"/></center><br>
     *  - <i><b>`flex-height`</b></i> : Canvas height is resized to fit; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-flex-height.png"/></center><br>
     *  - <i><b>`stretch`</b></i> : Canvas is resized to fit; content is scaled to screen aspect ratio
     * <center><img src="images/scale-stretch.png"/></center><br>
     * @function video.init
     * @param {number} width The width of the canvas viewport
     * @param {number} height The height of the canvas viewport
     * @param {object} [options] The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
     * @param {string|HTMLElement} [options.parent=document.body] the DOM parent element to hold the canvas in the HTML file
     * @param {number} [options.renderer=video.AUTO] renderer to use (me.video.CANVAS, me.video.WEBGL, me.video.AUTO)
     * @param {number|string} [options.scale=1.0] enable scaling of the canvas ('auto' for automatic scaling)
     * @param {string} [options.scaleMethod="fit"] screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
     * @param {boolean} [options.preferWebGL1=false] if true the renderer will only use WebGL 1
     * @param {string} [options.powerPreference="default"] a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
     * @param {boolean} [options.transparent=false] whether to allow transparent pixels in the front buffer (screen).
     * @param {boolean} [options.antiAlias=false] whether to enable or not video scaling interpolation
     * @param {boolean} [options.consoleHeader=true] whether to display melonJS version and basic device information in the console
     * @returns {boolean} false if initialization failed (canvas not supported)
     * @example
     * // init the video with a 640x480 canvas
     * me.video.init(640, 480, {
     *     parent : "screen",
     *     renderer : me.video.AUTO,
     *     scale : "auto",
     *     scaleMethod : "fit"
     * });
     */
    export function init(width: number, height: number, options?: {
        parent?: string | HTMLElement;
        renderer?: number;
        scale?: number | string;
        scaleMethod?: string;
        preferWebGL1?: boolean;
        powerPreference?: string;
        transparent?: boolean;
        antiAlias?: boolean;
        consoleHeader?: boolean;
    }): boolean;
    /**
     * Create and return a new Canvas element
     * @function video.createCanvas
     * @param {number} width width
     * @param {number} height height
     * @param {boolean} [returnOffscreenCanvas=false] will return an OffscreenCanvas if supported
     * @returns {HTMLCanvasElement|OffscreenCanvas}
     */
    export function createCanvas(width: number, height: number, returnOffscreenCanvas?: boolean): HTMLCanvasElement | OffscreenCanvas;
    /**
     * return a reference to the parent DOM element holding the main canvas
     * @function video.getParent
     * @returns {HTMLElement}
     */
    export function getParent(): HTMLElement;
    /**
     * scale the "displayed" canvas by the given scalar.
     * this will modify the size of canvas element directly.
     * Only use this if you are not using the automatic scaling feature.
     * @function video.scale
     * @see video.init
     * @param {number} x x scaling multiplier
     * @param {number} y y scaling multiplier
     */
    export function scale(x: number, y: number): void;
    /**
     * Select the HTML5 Canvas renderer
     * @name CANVAS
     * @memberof video
     * @constant
     */
    export const CANVAS: 0;
    /**
     * Select the WebGL renderer
     * @name WEBGL
     * @memberof video
     * @constant
     */
    export const WEBGL: 1;
    /**
     * Auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
     * @name AUTO
     * @memberof video
     * @constant
     */
    export const AUTO: 2;
    /**
     * the parent container of the main canvas element
     * @ignore
     * @type {HTMLElement}
     * @readonly
     * @name parent
     * @memberof video
     */
    export let parent: HTMLElement;
    /**
     * the scaling ratio to be applied to the display canvas
     * @name scaleRatio
     * @type {Vector2d}
     * @default <1,1>
     * @memberof video
     */
    export let scaleRatio: Vector2d;
    /**
     * A reference to the active Canvas or WebGL active renderer renderer
     * @name renderer
     * @type {CanvasRenderer|WebGLRenderer}
     * @memberof video
     */
    export let renderer: CanvasRenderer | WebGLRenderer;
    import Vector2d from "math/vector2";
    import CanvasRenderer from "video/canvas/canvas_renderer";
    import WebGLRenderer from "video/webgl/webgl_renderer";
}
declare module "utils/utils" {
    export default utils;
    namespace utils {
        export { agentUtils as agent };
        export { arrayUtils as array };
        export { fileUtils as file };
        export { stringUtils as string };
        export { fnUtils as function };
        export function getPixels(image: HTMLCanvasElement | HTMLImageElement): ImageData;
        export function checkVersion(first: string, second?: string): number;
        export function getUriFragment(url?: string): any;
        export function resetGUID(base: any, index?: number): void;
        export function createGUID(index?: number): string;
    }
    import * as agentUtils from "utils/agent";
    import * as arrayUtils from "utils/array";
    import * as fileUtils from "utils/file";
    import * as stringUtils from "utils/string";
    import * as fnUtils from "utils/function";
}
declare module "system/timer" {
    export default timer;
    const timer: Timer;
    /**
     * @classdesc
     * a Timer class to manage timing related function (FPS, Game Tick, Time...)
     * @see {@link timer} the default global timer instance
     */
    class Timer {
        /**
         * Last game tick value. <br>
         * Use this value to scale velocities during frame drops due to slow hardware or when setting an FPS limit.
         * This feature is disabled by default (Enable interpolation to use it).
         * @public
         * @see interpolation
         * @See maxfps
         * @type {number}
         * @name tick
         */
        public tick: number;
        /**
         * Last measured fps rate.<br>
         * This feature is disabled by default, unless the debugPanel is enabled/visible.
         * @public
         * @type {number}
         * @name fps
         */
        public fps: number;
        /**
         * Set the maximum target display frame per second
         * @public
         * @see tick
         * @type {number}
         * @default 60
         */
        public maxfps: number;
        /**
         * Enable/disable frame interpolation
         * @see tick
         * @type {boolean}
         * @default false
         */
        interpolation: boolean;
        framecount: number;
        framedelta: number;
        last: number;
        now: number;
        delta: number;
        step: number;
        minstep: number;
        timers: any[];
        timerId: number;
        /**
         * reset time (e.g. usefull in case of pause)
         * @ignore
         */
        reset(): void;
        /**
         * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
         * @param {Function} fn the function you want to execute after delay milliseconds.
         * @param {number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
         * @param {boolean} [pauseable=true] respects the pause state of the engine.
         * @param {...*} args optional parameters which are passed through to the function specified by fn once the timer expires.
         * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
         * @example
         * // set a timer to call "myFunction" after 1000ms
         * me.timer.setTimeout(myFunction, 1000);
         * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
         * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
         */
        setTimeout(fn: Function, delay: number, pauseable?: boolean, ...args: any[]): number;
        /**
         * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
         * @param {Function} fn the function to execute
         * @param {number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
         * @param {boolean} [pauseable=true] respects the pause state of the engine.
         * @param {...*} args optional parameters which are passed through to the function specified by fn once the timer expires.
         * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
         * @example
         * // set a timer to call "myFunction" every 1000ms
         * me.timer.setInterval(myFunction, 1000);
         * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
         * me.timer.setInterval(myFunction, 1000, true, param1, param2);
         */
        setInterval(fn: Function, delay: number, pauseable?: boolean, ...args: any[]): number;
        /**
         * Clears the delay set by me.timer.setTimeout().
         * @param {number} timeoutID ID of the timeout to be cleared
         */
        clearTimeout(timeoutID: number): void;
        /**
         * Clears the Interval set by me.timer.setInterval().
         * @param {number} intervalID ID of the interval to be cleared
         */
        clearInterval(intervalID: number): void;
        /**
         * Return the current timestamp in milliseconds <br>
         * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
         * @returns {number}
         */
        getTime(): number;
        /**
         * Return elapsed time in milliseconds since the last update
         * @returns {number}
         */
        getDelta(): number;
        /**
         * compute the actual frame time and fps rate
         * @ignore
         */
        countFPS(): void;
        /**
         * update
         * @ignore
         */
        update(time: any): void;
        /**
         * clear Timers
         * @ignore
         */
        clearTimer(timerId: any): void;
        /**
         * update timers
         * @ignore
         */
        updateTimers(): void;
    }
}
declare module "polyfill/requestAnimationFrame" {
    export {};
}
declare module "polyfill/index" {
    export {};
}
declare module "plugin/plugin" {
    /**
     * This namespace is a container for all registered plugins.
     * @see plugin.register
     * @namespace plugins
     */
    export const plugins: {};
    /**
     * @namespace plugin
     */
    export const plugin: any;
}
declare module "tweens/easing" {
    /**
     * *
     */
    export type Easing = Function;
    /**
     * Easing Function :<br>
     * <p>
     * Easing.Linear.None<br>
     * Easing.Quadratic.In<br>
     * Easing.Quadratic.Out<br>
     * Easing.Quadratic.InOut<br>
     * Easing.Cubic.In<br>
     * Easing.Cubic.Out<br>
     * Easing.Cubic.InOut<br>
     * Easing.Quartic.In<br>
     * Easing.Quartic.Out<br>
     * Easing.Quartic.InOut<br>
     * Easing.Quintic.In<br>
     * Easing.Quintic.Out<br>
     * Easing.Quintic.InOut<br>
     * Easing.Sinusoidal.In<br>
     * Easing.Sinusoidal.Out<br>
     * Easing.Sinusoidal.InOut<br>
     * Easing.Exponential.In<br>
     * Easing.Exponential.Out<br>
     * Easing.Exponential.InOut<br>
     * Easing.Circular.In<br>
     * Easing.Circular.Out<br>
     * Easing.Circular.InOut<br>
     * Easing.Elastic.In<br>
     * Easing.Elastic.Out<br>
     * Easing.Elastic.InOut<br>
     * Easing.Back.In<br>
     * Easing.Back.Out<br>
     * Easing.Back.InOut<br>
     * Easing.Bounce.In<br>
     * Easing.Bounce.Out<br>
     * Easing.Bounce.InOut
     * </p>
     * @public
     * @constant
     * @enum {Function}
     * @name Easing
     * @memberof Tween
     */
    export let Easing: any;
}
declare module "tweens/interpolation" {
    /**
     * *
     */
    export type Interpolation = Function;
    /**
     * Interpolation Function :<br>
     * <p>
     * Interpolation.Linear<br>
     * Interpolation.Bezier<br>
     * Interpolation.CatmullRom
     * </p>
     * @public
     * @constant
     * @enum {Function}
     * @name Interpolation
     * @memberof Tween
     */
    export let Interpolation: any;
}
declare module "tweens/tween" {
    export default Tween;
    /**
     * @classdesc
     * Javascript Tweening Engine<p>
     * Super simple, fast and easy to use tweening engine which incorporates optimised Robert Penner's equation<p>
     * <a href="https://github.com/sole/Tween.js">https://github.com/sole/Tween.js</a><p>
     * author sole / http://soledadpenades.com<br>
     * author mr.doob / http://mrdoob.com<br>
     * author Robert Eisele / http://www.xarg.org<br>
     * author Philippe / http://philippe.elsass.me<br>
     * author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html<br>
     * author Paul Lewis / http://www.aerotwist.com/<br>
     * author lechecacharro<br>
     * author Josh Faul / http://jocafa.com/
     */
    class Tween {
        static get Easing(): any;
        static get Interpolation(): any;
        /**
         * @param {object} object object on which to apply the tween
         * @example
         * // add a tween to change the object pos.x and pos.y variable to 200 in 3 seconds
         * tween = new me.Tween(myObject.pos).to({
         *       x: 200,
         *       y: 200,
         *    }, {
         *       duration: 3000,
         *       easing: me.Tween.Easing.Bounce.Out,
         *       autoStart : true
         * }).onComplete(myFunc);
         */
        constructor(object: object);
        /**
         * reset the tween object to default value
         * @ignore
         */
        onResetEvent(object: any): void;
        /**
         * @ignore
         */
        setProperties(object: any): void;
        _object: any;
        _valuesStart: {};
        _valuesEnd: any;
        _valuesStartRepeat: {};
        _duration: any;
        _repeat: number;
        _yoyo: boolean;
        _reversed: any;
        _delayTime: number;
        _startTime: any;
        _easingFunction: any;
        _interpolationFunction: any;
        _chainedTweens: IArguments | any[];
        _onStartCallback: Function;
        _onStartCallbackFired: boolean;
        _onUpdateCallback: Function;
        _onCompleteCallback: Function;
        _tweenTimeTracker: any;
        isPersistent: boolean;
        updateWhenPaused: boolean;
        isRenderable: boolean;
        /**
         * @ignore
         */
        _resumeCallback(elapsed: any): void;
        /**
         * subscribe to the resume event when added
         * @ignore
         */
        onActivateEvent(): void;
        /**
         * Unsubscribe when tween is removed
         * @ignore
         */
        onDeactivateEvent(): void;
        /**
         * object properties to be updated and duration
         * @name to
         * @memberof Tween
         * @public
         * @param {object} properties hash of properties
         * @param {object|number} [options] object of tween properties, or a duration if a numeric value is passed
         * @param {number} [options.duration] tween duration
         * @param {Tween.Easing} [options.easing] easing function
         * @param {number} [options.delay] delay amount expressed in milliseconds
         * @param {boolean} [options.yoyo] allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
         * @param {number} [options.repeat] amount of times the tween should be repeated
         * @param {Tween.Interpolation} [options.interpolation] interpolation function
         * @param {boolean} [options.autoStart] allow this tween to start automatically. Otherwise call me.Tween.start().
         * @returns {Tween} this instance for object chaining
         */
        public to(properties: object, options?: object | number): Tween;
        /**
         * start the tween
         * @name start
         * @memberof Tween
         * @public
         * @param {number} [time] the current time when the tween was started
         * @returns {Tween} this instance for object chaining
         */
        public start(time?: number): Tween;
        /**
         * stop the tween
         * @name stop
         * @memberof Tween
         * @public
         * @returns {Tween} this instance for object chaining
         */
        public stop(): Tween;
        /**
         * delay the tween
         * @name delay
         * @memberof Tween
         * @public
         * @param {number} amount delay amount expressed in milliseconds
         * @returns {Tween} this instance for object chaining
         */
        public delay(amount: number): Tween;
        /**
         * Repeat the tween
         * @name repeat
         * @memberof Tween
         * @public
         * @param {number} times amount of times the tween should be repeated
         * @returns {Tween} this instance for object chaining
         */
        public repeat(times: number): Tween;
        /**
         * Allows the tween to bounce back to their original value when finished.
         * To be used together with repeat to create endless loops.
         * @name yoyo
         * @memberof Tween
         * @public
         * @see Tween#repeat
         * @param {boolean} yoyo
         * @returns {Tween} this instance for object chaining
         */
        public yoyo(yoyo: boolean): Tween;
        /**
         * set the easing function
         * @name easing
         * @memberof Tween
         * @public
         * @param {Tween.Easing} easing easing function
         * @returns {Tween} this instance for object chaining
         */
        public easing(easing: any): Tween;
        /**
         * set the interpolation function
         * @name interpolation
         * @memberof Tween
         * @public
         * @param {Tween.Interpolation} interpolation interpolation function
         * @returns {Tween} this instance for object chaining
         */
        public interpolation(interpolation: any): Tween;
        /**
         * chain the tween
         * @name chain
         * @memberof Tween
         * @public
         * @param {...Tween} chainedTween Tween(s) to be chained
         * @returns {Tween} this instance for object chaining
         */
        public chain(...args: Tween[]): Tween;
        /**
         * onStart callback
         * @name onStart
         * @memberof Tween
         * @public
         * @param {Function} onStartCallback callback
         * @returns {Tween} this instance for object chaining
         */
        public onStart(onStartCallback: Function): Tween;
        /**
         * onUpdate callback
         * @name onUpdate
         * @memberof Tween
         * @public
         * @param {Function} onUpdateCallback callback
         * @returns {Tween} this instance for object chaining
         */
        public onUpdate(onUpdateCallback: Function): Tween;
        /**
         * onComplete callback
         * @name onComplete
         * @memberof Tween
         * @public
         * @param {Function} onCompleteCallback callback
         * @returns {Tween} this instance for object chaining
         */
        public onComplete(onCompleteCallback: Function): Tween;
        /** @ignore */
        update(dt: any): boolean;
    }
}
declare module "video/texture/canvas_texture" {
    export default CanvasTexture;
    /**
     * Creates a Canvas Texture of the given size
     */
    class CanvasTexture {
        /**
         * @param {number} width the desired width of the canvas
         * @param {number} height the desired height of the canvas
         * @param {object} attributes The attributes to create both the canvas and context
         * @param {boolean} [attributes.context="2d"] the context type to be created ("2d", "webgl", "webgl2")
         * @param {boolean} [attributes.offscreenCanvas=false] will create an offscreenCanvas if true instead of a standard canvas
         * @param {boolean} [attributes.willReadFrequently=false] Indicates whether or not a lot of read-back operations are planned
         * @param {boolean} [attributes.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
         */
        constructor(width: number, height: number, attributes?: {
            context?: boolean;
            offscreenCanvas?: boolean;
            willReadFrequently?: boolean;
            antiAlias?: boolean;
        });
        /**
         * the canvas created for this CanvasTexture
         * @type {HTMLCanvasElement|OffscreenCanvas}
         */
        canvas: HTMLCanvasElement | OffscreenCanvas;
        /**
         * the rendering context of this CanvasTexture
         * @type {CanvasRenderingContext2D}
         */
        context: CanvasRenderingContext2D;
        /**
         * @ignore
         */
        onResetEvent(width: any, height: any): void;
        /**
         * Clears the content of the canvas texture
         */
        clear(): void;
        /**
         * enable/disable image smoothing (scaling interpolation)
         * @param {boolean} [enable=false]
         */
        setAntiAlias(enable?: boolean): void;
        /**
         * Resizes the canvas texture to the given width and height.
         * @param {number} width the desired width
         * @param {number} height the desired height
         */
        resize(width: number, height: number): void;
        /**
         * @ignore
         */
        destroy(): void;
        public set width(arg: number);
        /**
         * The width of this canvas texture in pixels
         * @public
         * @type {number}
         */
        public get width(): number;
        public set height(arg: number);
        /**
         * The height of this canvas texture in pixels
         * @public
         * @type {number}
         */
        public get height(): number;
    }
}
declare module "text/textstyle" {
    /**
     * apply the current text style to the given context
     * @ignore
     */
    export default function setContextStyle(context: any, style: any, stroke?: boolean): void;
}
declare module "text/textmetrics" {
    export default TextMetrics;
    /**
     * @classdesc
     * a Text Metrics object that contains helper for text manipulation
     * @augments Bounds
     */
    class TextMetrics extends Bounds {
        /**
         * @param {Text|BitmapText} ancestor the parent object that contains this TextMetrics object
         */
        constructor(ancestor: Text | BitmapText);
        /**
         * a reference to the parent object that contains this TextMetrics object
         * @public
         * @type {Renderable}
         * @default undefined
         */
        public ancestor: Renderable;
        /**
         * Returns the height of a segment of inline text in CSS pixels.
         * @returns {number} the height of a segment of inline text in CSS pixels.
         */
        lineHeight(): number;
        /**
         * Returns the width of the given segment of inline text in CSS pixels.
         * @param {string} text the text to be measured
         * @param {CanvasRenderingContext2D} [context] reference to an active 2d context for canvas rendering
         * @returns {number} the width of the given segment of inline text in CSS pixels.
         */
        lineWidth(text: string, context?: CanvasRenderingContext2D): number;
        /**
         * measure the given text size in CSS pixels
         * @param {string} text the text to be measured
         * @param {CanvasRenderingContext2D} [context] reference to an active 2d context for canvas rendering
         * @returns {TextMetrics} this
         */
        measureText(text: string, context?: CanvasRenderingContext2D): TextMetrics;
        /**
         * wrap the given text based on the given width
         * @param {string|string[]} text the text to be wrapped
         * @param {number} width maximum width of one segment of text in css pixel
         * @param {CanvasRenderingContext2D} [context] reference to an active 2d context for canvas rendering
         * @returns {string[]} an array of string representing wrapped text
         */
        wordWrap(text: string | string[], width: number, context?: CanvasRenderingContext2D): string[];
    }
    import Bounds from "physics/bounds";
    import Text from "text/text";
}
declare module "text/text" {
    export default Text;
    /**
     * @classdesc
     * a generic system font object.
     * @augments Renderable
     */
    class Text extends Renderable {
        /**
         * @param {number} x position of the text object
         * @param {number} y position of the text object
         * @param {object} settings the text configuration
         * @param {string} settings.font a CSS family font name
         * @param {number|string} settings.size size, or size + suffix (px, em, pt)
         * @param {Color|string} [settings.fillStyle="#000000"] a CSS color value
         * @param {Color|string} [settings.strokeStyle="#000000"] a CSS color value
         * @param {number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
         * @param {string} [settings.textAlign="left"] horizontal text alignment
         * @param {string} [settings.textBaseline="top"] the text baseline
         * @param {number} [settings.lineHeight=1.0] line spacing height
         * @param {Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
         * @param {boolean} [settings.offScreenCanvas=false] whether to draw the font to an individual "cache" texture first
         * @param {number} [settings.wordWrapWidth] the maximum length in CSS pixel for a single segment of text
         * @param {(string|string[])} [settings.text=""] a string, or an array of strings
         * @example
         * var font = new me.Text(0, 0, {font: "Arial", size: 8, fillStyle: this.color});
         */
        constructor(x: number, y: number, settings: {
            font: string;
            size: number | string;
            fillStyle?: Color | string;
            strokeStyle?: Color | string;
            lineWidth?: number;
            textAlign?: string;
            textBaseline?: string;
            lineHeight?: number;
            anchorPoint?: Vector2d;
            offScreenCanvas?: boolean;
            wordWrapWidth?: number;
            text?: (string | string[]);
        });
        /** @ignore */
        onResetEvent(x: any, y: any, settings: any): void;
        fillStyle: any;
        strokeStyle: any;
        /**
         * sets the current line width, in pixels, when drawing stroke
         * @public
         * @type {number}
         * @default 1
         */
        public lineWidth: number;
        /**
         * Set the default text alignment (or justification),<br>
         * possible values are "left", "right", and "center".<br>
         * @public
         * @type {string}
         * @default "left"
         */
        public textAlign: string;
        /**
         * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
         * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
         * @public
         * @type {string}
         * @default "top"
         */
        public textBaseline: string;
        /**
         * Set the line spacing height (when displaying multi-line strings). <br>
         * Current font height will be multiplied with this value to set the line height.
         * @public
         * @type {number}
         * @default 1.0
         */
        public lineHeight: number;
        /**
         * whether to draw the font to a indidividual offscreen canvas texture first <br>
         * Note: this will improve performances when using WebGL, but will impact
         * memory consumption as every text element will have its own canvas texture
         * @public
         * @type {boolean}
         * @default false
         */
        public offScreenCanvas: boolean;
        /**
         * the maximum length in CSS pixel for a single segment of text.
         * (use -1 to disable word wrapping)
         * @public
         * @type {number}
         * @default -1
         */
        public wordWrapWidth: number;
        /**
         * the text to be displayed
         * @private
         */
        private _text;
        /**
         * the font size (in px)
         * @public
         * @type {number}
         * @default 10
         */
        public fontSize: number;
        canvasTexture: any;
        metrics: TextMetrics;
        /**
         * make the font bold
         * @returns {Text} this object for chaining
         */
        bold(): Text;
        font: any;
        /**
         * make the font italic
         * @returns {Text} this object for chaining
         */
        italic(): Text;
        /**
         * set the font family and size
         * @param {string} font a CSS font name
         * @param {number|string} [size=10] size in px, or size + suffix (px, em, pt)
         * @returns {Text} this object for chaining
         * @example
         * font.setFont("Arial", 20);
         * font.setFont("Arial", "1.5em");
         */
        setFont(font: string, size?: number | string): Text;
        /**
         * change the text to be displayed
         * @param {number|string|string[]} value a string, or an array of strings
         * @returns {Text} this object for chaining
         */
        setText(value?: number | string | string[]): Text;
        glTextureUnit: any;
        /**
         * measure the given text size in pixels
         * @param {CanvasRenderer|WebGLRenderer} renderer reference to the active renderer
         * @param {string} [text] the text to be measured
         * @returns {TextMetrics} a TextMetrics object defining the dimensions of the given piece of text
         */
        measureText(renderer: CanvasRenderer | WebGLRenderer, text?: string): TextMetrics;
        /**
         * draw a text at the specified coord
         * @param {CanvasRenderer|WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {string} [text]
         * @param {number} [x]
         * @param {number} [y]
         * @param {boolean} [stroke=false] draw stroke the the text if true
         */
        draw(renderer: CanvasRenderer | WebGLRenderer, text?: string, x?: number, y?: number, stroke?: boolean): void;
        /**
         * draw a stroke text at the specified coord, as defined <br>
         * by the `lineWidth` and `fillStroke` properties. <br>
         * Note : using drawStroke is not recommended for performance reasons
         * @param {CanvasRenderer|WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {string} text
         * @param {number} x
         * @param {number} y
         */
        drawStroke(renderer: CanvasRenderer | WebGLRenderer, text: string, x: number, y: number): void;
        /**
         * @ignore
         */
        _drawFont(context: any, text: any, x: any, y: any, stroke?: boolean): TextMetrics;
        /**
         * Destroy function
         * @ignore
         */
        destroy(): void;
    }
    import Renderable from "renderable/renderable";
    import TextMetrics from "text/textmetrics";
    import WebGLRenderer from "video/webgl/webgl_renderer";
    import Color from "math/color";
}
declare module "text/bitmaptext" {
    export default BitmapText;
    /**
     * @classdesc
     * a bitmap font object
     * @augments Renderable
     */
    class BitmapText extends Renderable {
        /**
         * @param {number} x position of the text object
         * @param {number} y position of the text object
         * @param {object} settings the text configuration
         * @param {string|Image} settings.font a font name to identify the corresponing source image
         * @param {string} [settings.fontData=settings.font] the bitmap font data corresponding name, or the bitmap font data itself
         * @param {number} [settings.size] size a scaling ratio
         * @param {Color|string} [settings.fillStyle] a CSS color value used to tint the bitmapText (@see BitmapText.tint)
         * @param {number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
         * @param {string} [settings.textAlign="left"] horizontal text alignment
         * @param {string} [settings.textBaseline="top"] the text baseline
         * @param {number} [settings.lineHeight=1.0] line spacing height
         * @param {Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
         * @param {number} [settings.wordWrapWidth] the maximum length in CSS pixel for a single segment of text
         * @param {(string|string[])} [settings.text] a string, or an array of strings
         * @example
         * // Use me.loader.preload or me.loader.load to load assets
         * me.loader.preload([
         *     { name: "arial", type: "binary" src: "data/font/arial.fnt" },
         *     { name: "arial", type: "image" src: "data/font/arial.png" },
         * ])
         * // Then create an instance of your bitmap font:
         * var myFont = new me.BitmapText(x, y, {font:"arial", text:"Hello"});
         * // two possibilities for using "myFont"
         * // either call the draw function from your Renderable draw function
         * myFont.draw(renderer, "Hello!", 0, 0);
         * // or just add it to the word container
         * me.game.world.addChild(myFont);
         */
        constructor(x: number, y: number, settings: {
            font: string | (new (width?: number, height?: number) => HTMLImageElement);
            fontData?: string;
            size?: number;
            fillStyle?: Color | string;
            lineWidth?: number;
            textAlign?: string;
            textBaseline?: string;
            lineHeight?: number;
            anchorPoint?: Vector2d;
            wordWrapWidth?: number;
            text?: (string | string[]);
        });
        /**
         * Set the default text alignment (or justification),<br>
         * possible values are "left", "right", and "center".
         * @public
         * @type {string}
         * @default "left"
         */
        public textAlign: string;
        /**
         * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
         * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
         * @public
         * @type {string}
         * @default "top"
         */
        public textBaseline: string;
        /**
         * Set the line spacing height (when displaying multi-line strings). <br>
         * Current font height will be multiplied with this value to set the line height.
         * @public
         * @type {number}
         * @default 1.0
         */
        public lineHeight: number;
        /**
         * the maximum length in CSS pixel for a single segment of text.
         * (use -1 to disable word wrapping)
         * @public
         * @type {number}
         * @default -1
         */
        public wordWrapWidth: number;
        /**
         * the text to be displayed
         * @private
         */
        private _text;
        /**
         * scaled font size
         * @private
         */
        private fontScale;
        /**
         * font image
         * @private
         */
        private fontImage;
        /**
         * font data
         * @private
         */
        private fontData;
        public set fillStyle(arg: Color);
        /**
         * defines the color used to tint the bitmap text
         * @public
         * @type {Color}
         * @see Renderable#tint
         */
        public get fillStyle(): Color;
        metrics: TextMetrics;
        /**
         * change the font settings
         * @param {string} textAlign ("left", "center", "right")
         * @param {number} [scale]
         * @returns {BitmapText} this object for chaining
         */
        set(textAlign: string, scale?: number): BitmapText;
        /**
         * change the text to be displayed
         * @param {number|string|string[]} value a string, or an array of strings
         * @returns {BitmapText} this object for chaining
         */
        setText(value?: number | string | string[]): BitmapText;
        /**
         * change the font display size
         * @param {number} scale ratio
         * @returns {BitmapText} this object for chaining
         */
        resize(scale: number): BitmapText;
        /**
         * measure the given text size in pixels
         * @param {string} [text]
         * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
         */
        measureText(text?: string): TextMetrics;
        /**
         * draw the bitmap font
         * @param {CanvasRenderer|WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {string} [text]
         * @param {number} [x]
         * @param {number} [y]
         */
        draw(renderer: CanvasRenderer | WebGLRenderer, text?: string, x?: number, y?: number): void;
        /**
         * Destroy function
         * @ignore
         */
        destroy(): void;
    }
    import Renderable from "renderable/renderable";
    import Color from "math/color";
    import TextMetrics from "text/textmetrics";
}
declare module "text/glyph" {
    export default Glyph;
    /**
     * a glyph representing a single character in a font
     * @ignore
     */
    class Glyph {
        id: number;
        x: number;
        y: number;
        width: number;
        height: number;
        u: number;
        v: number;
        u2: number;
        v2: number;
        xoffset: number;
        yoffset: number;
        xadvance: number;
        fixedWidth: boolean;
        /**
         * @ignore
         */
        getKerning(ch: any): any;
        /**
         * @ignore
         */
        setKerning(ch: any, value: any): void;
        kerning: {};
    }
}
declare module "text/bitmaptextdata" {
    export default BitmapTextData;
    /**
     * Class for storing relevant data from the font file.
     * @ignore
     */
    class BitmapTextData {
        /**
         * @param {string} data - The bitmap font data pulled from the resource loader using me.loader.getBinary()
         */
        constructor(data: string);
        /**
         * @ignore
         */
        onResetEvent(data: any): void;
        padTop: number;
        padRight: number;
        padBottom: number;
        padLeft: number;
        lineHeight: number;
        capHeight: any;
        descent: any;
        /**
         * The map of glyphs, each key is a char code.
         * @name glyphs
         * @type {object}
         * @memberof BitmapTextData
         */
        glyphs: object;
        /**
         * This parses the font data text and builds a map of glyphs containing the data for each character
         * @name parse
         * @memberof BitmapTextData
         * @param {string} fontData
         */
        parse(fontData: string): void;
    }
}
declare module "renderable/colorlayer" {
    export default ColorLayer;
    /**
     * @classdesc
     * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
     * @augments Renderable
     */
    class ColorLayer extends Renderable {
        /**
         * @param {string} name Layer name
         * @param {Color|string} color CSS color
         * @param {number} [z = 0] z-index position
         */
        constructor(name: string, color: Color | string, z?: number);
        /**
         * the layer color component
         * @public
         * @type {Color}
         * @name color
         * @memberof ColorLayer#
         */
        public color: Color;
        onResetEvent(name: any, color: any, z?: number): void;
        /**
         * Destroy function
         * @ignore
         */
        destroy(): void;
    }
    import Renderable from "renderable/renderable";
}
declare module "renderable/imagelayer" {
    export default ImageLayer;
    /**
     * @classdesc
     * a generic Image Layer Object
     * @augments Renderable
     */
    class ImageLayer {
        /**
         * @param {number} x x coordinate
         * @param {number} y y coordinate
         * @param {object} settings ImageLayer properties
         * @param {HTMLImageElement|HTMLCanvasElement|string} settings.image Image reference. See {@link loader.getImage}
         * @param {string} [settings.name="me.ImageLayer"] layer name
         * @param {number} [settings.z=0] z-index position
         * @param {number|Vector2d} [settings.ratio=1.0] Scrolling ratio to be applied. See {@link ImageLayer#ratio}
         * @param {string} [settings.repeat='repeat'] define if and how an Image Layer should be repeated (accepted values are 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'). See {@link ImageLayer#repeat}
         * @param {number|Vector2d} [settings.anchorPoint=0.0] Image origin. See {@link ImageLayer#anchorPoint}
         * @example
         * // create a repetitive background pattern on the X axis using the citycloud image asset
         * me.game.world.addChild(new me.ImageLayer(0, 0, {
         *     image:"citycloud",
         *     repeat :"repeat-x"
         * }), 1);
         */
        constructor(x: number, y: number, settings: {
            image: HTMLImageElement | HTMLCanvasElement | string;
            name?: string;
            z?: number;
            ratio?: number | Vector2d;
            repeat?: string;
            anchorPoint?: number | Vector2d;
        });
        floating: boolean;
        /**
         * Define the image scrolling ratio<br>
         * Scrolling speed is defined by multiplying the viewport delta position by the specified ratio.
         * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
         * To specify a value through Tiled, use one of the following format : <br>
         * - a number, to change the value for both axis <br>
         * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
         * @public
         * @type {Vector2d}
         * @default <1.0,1.0>
         * @name ImageLayer#ratio
         */
        public ratio: Vector2d;
        public set repeat(arg: string);
        /**
         * Define if and how an Image Layer should be repeated.<br>
         * By default, an Image Layer is repeated both vertically and horizontally.<br>
         * Acceptable values : <br>
         * - 'repeat' - The background image will be repeated both vertically and horizontally <br>
         * - 'repeat-x' - The background image will be repeated only horizontally.<br>
         * - 'repeat-y' - The background image will be repeated only vertically.<br>
         * - 'no-repeat' - The background-image will not be repeated.<br>
         * @public
         * @type {string}
         * @default 'repeat'
         * @name ImageLayer#repeat
         */
        public get repeat(): string;
        _repeat: string;
        repeatX: boolean;
        repeatY: boolean;
        onActivateEvent(): void;
        /**
         * resize the Image Layer to match the given size
         * @name resize
         * @memberof ImageLayer
         * @param {number} w new width
         * @param {number} h new height
         */
        resize(w: number, h: number): any;
        /**
         * createPattern function
         * @ignore
         */
        createPattern(): void;
        _pattern: CanvasPattern | import("index").TextureAtlas;
        /**
         * updateLayer function
         * @ignore
         */
        updateLayer(vpos: any): void;
        isDirty: boolean;
        /**
         * override the default predraw function
         * as repeat and anchor are managed directly in the draw method
         * @ignore
         */
        preDraw(renderer: any): void;
        /**
         * draw this ImageLayer (automatically called by melonJS)
         * @name draw
         * @memberof ImageLayer
         * @protected
         * @param {CanvasRenderer|WebGLRenderer} renderer a renderer instance
         * @param {Camera2d} [viewport] the viewport to (re)draw
         */
        protected draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: Camera2d): void;
        onDeactivateEvent(): void;
        /**
         * Destroy function<br>
         * @ignore
         */
        destroy(): void;
    }
}
declare module "renderable/nineslicesprite" {
    export default NineSliceSprite;
    /**
     * @classdesc
     * A NineSliceSprite is similar to a Sprite, but it uses 9-slice scaling to strech its inner area to fit the size of the Renderable,
     * by proportionally scaling a sprite by splitting it in a grid of nine parts (with only parts 1, 3, 7, 9 not being scaled). <br>
     * <img src="images/9-slice-scaling.png"/><br>
     * @see https://en.wikipedia.org/wiki/9-slice_scaling
     * @augments Sprite
     */
    class NineSliceSprite extends Sprite {
        /**
         * @param {number} x the x coordinates of the sprite object
         * @param {number} y the y coordinates of the sprite object
         * @param {object} settings Configuration parameters for the Sprite object
         * @param {number} settings.width the width of the Renderable over which the sprite needs to be stretched
         * @param {number} settings.height the height of the Renderable over which the sprite needs to be stretched
         * @param {number} [settings.insetx] the width of a corner over which the sprite is unscaled (default is a quarter of the sprite width)
         * @param {number} [settings.insety] the height of a corner over which the sprite is unscaled (default is a quarter of the sprite height)
         * @param {HTMLImageElement|HTMLCanvasElement|TextureAtlas|string} settings.image reference to spritesheet image, a texture atlas or to a texture atlas
         * @param {string} [settings.name=""] name of this object
         * @param {string} [settings.region] region name of a specific region to use when using a texture atlas, see {@link TextureAtlas}
         * @param {number} [settings.framewidth] Width of a single frame within the spritesheet
         * @param {number} [settings.frameheight] Height of a single frame within the spritesheet
         * @param {string|Color} [settings.tint] a tint to be applied to this sprite
         * @param {number} [settings.flipX] flip the sprite on the horizontal axis
         * @param {number} [settings.flipY] flip the sprite on the vertical axis
         * @param {Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
         * @example
         * this.panelSprite = new me.NineSliceSprite(0, 0, {
         *     image : game.texture,
         *     region : "grey_panel",
         *     width : this.width,
         *     height : this.height
         * });
         */
        constructor(x: number, y: number, settings: {
            width: number;
            height: number;
            insetx?: number;
            insety?: number;
            image: HTMLImageElement | HTMLCanvasElement | TextureAtlas | string;
            name?: string;
            region?: string;
            framewidth?: number;
            frameheight?: number;
            tint?: string | Color;
            flipX?: number;
            flipY?: number;
            anchorPoint?: Vector2d;
        });
        nss_width: number;
        nss_height: number;
        insetx: number;
        insety: number;
        /**
         * @ignore
         */
        draw(renderer: any): void;
    }
    import Sprite from "renderable/sprite";
}
declare module "renderable/ui/uibaseelement" {
    export default UIBaseElement;
    /**
     * @classdesc
     * This is a basic clickable container which you can use in your game UI.
     * Use this for example if you want to display a button which contains
     * text and images.
     * @augments Container
     */
    class UIBaseElement extends Container {
        /**
         *
         * @param {number} x The x position of the container
         * @param {number} y The y position of the container
         * @param {number} w width of the container (default: viewport width)
         * @param {number} h height of the container (default: viewport height)
         */
        constructor(x: number, y: number, w: number, h: number);
        /**
         * object can be clicked or not
         * @type {boolean}
         */
        isClickable: boolean;
        /**
         * Tap and hold threshold timeout in ms
         * @type {number}
         * @default 250
         */
        holdThreshold: number;
        /**
         * object can be tap and hold
         * @type {boolean}
         * @default false
         */
        isHoldable: boolean;
        /**
         * true if the pointer is over the object
         * @type {boolean}
         * @default false
         */
        hover: boolean;
        holdTimeout: number;
        released: boolean;
        /**
         * function callback for the pointerdown event
         * @ignore
         */
        clicked(event: any): boolean;
        dirty: boolean;
        /**
         * function called when the object is pressed (to be extended)
         * @param {Pointer} event the event object
         * @returns {boolean} return false if we need to stop propagating the event
         */
        onClick(event: Pointer): boolean;
        /**
         * function callback for the pointerEnter event
         * @ignore
         */
        enter(event: any): void;
        /**
         * function called when the pointer is over the object
         * @param {Pointer} event the event object
         */
        onOver(event: Pointer): void;
        /**
         * function callback for the pointerLeave event
         * @ignore
         */
        leave(event: any): void;
        /**
         * function called when the pointer is leaving the object area
         * @param {Pointer} event the event object
         */
        onOut(event: Pointer): void;
        /**
         * function callback for the pointerup event
         * @ignore
         */
        release(event: any): boolean;
        /**
         * function called when the object is pressed and released (to be extended)
         * @returns {boolean} return false if we need to stop propagating the event
         */
        onRelease(): boolean;
        /**
         * function callback for the tap and hold timer event
         * @ignore
         */
        hold(): void;
        /**
         * function called when the object is pressed and held<br>
         * to be extended <br>
         */
        onHold(): void;
    }
    import Container from "renderable/container";
}
declare module "renderable/ui/uitextbutton" {
    export default UITextButton;
    /**
     * @classdesc
     * This is a basic base text button which you can use in your Game UI.
     * @augments UIBaseElement
     */
    class UITextButton extends UIBaseElement {
        /**
         * A Text Button with an outlined background border, filled with background color.
         * It uses a RoundRect as background and changes the background color on hovering over.
         * The background will be drawn with 0.5 opacity, so that the background of the button is
         * slightly shining through.
         * @param {number} x x pos of the button
         * @param {number} y y pos of the button
         * @param {string} [settings.font] The name of the BitmapText font to use
         * @param {number} [settings.size] The scale factor of the font (default: 1)
         * @param {string} [settings.text] The text to display (default: 'click me')
         * @param {string} [settings.bindKey] The key to bind the action to (default: none)
         * @param {string} [settings.backgroundColor] The css value of a background color
         * @param {string} [settings.hoverColor] The css value of a color to be used if the pointer hovers over the button
         * @param {string} [settings.borderStrokeColor] The css value of a color to be used to draw the border
         * @param {boolean} [settings.offScreenCanvas] Weather to use an offScreen canvas or not
         * @param {string} [settings.fillStyle] The css value of a tint color to be used to tint the text
         * @param {number} [settings.borderWidth] Width of the button
         * @param {number} [settings.borderHeight] Height of the button
         * @example
         * // Create a new Button
         * class PlayButton extends BaseTextButton {
         *      constructor(x,y) {
         *          super(x,y, {
         *              font: 'my-font',
         *              text: 'Play',
         *              // if you omit the next two, size is calculated by the size of the text
         *              borderWidth: 200,
         *              borderHeight: 20,
         *          });
         *      }
         *
         *      onClick(){
         *          state.change(state.PLAY);
         *      }
         * }
         *
         * game.world.addChild(new PlayButton(15,200));
         */
        constructor(x: number, y: number, settings: any);
        font: BitmapText;
        dimensions: import("text/textmetrics").default;
        border: RoundRect;
        settings: any;
        draw(renderer: any): void;
    }
    import UIBaseElement from "renderable/ui/uibaseelement";
    import BitmapText from "text/bitmaptext";
    import RoundRect from "geometries/roundrect";
}
declare module "renderable/ui/uispriteelement" {
    export default UISpriteElement;
    /**
     * @classdesc
     *  This is a basic sprite based button which you can use in your Game UI.
     * @augments Sprite
     */
    class UISpriteElement extends Sprite {
        /**
         * @param {number} x the x coordinate of the GUI Object
         * @param {number} y the y coordinate of the GUI Object
         * @param {object} settings See {@link Sprite}
         * @example
         * // create a basic GUI Object
         * class myButton extends UISpriteElement {
         *    constructor(x, y) {
         *       var settings = {}
         *       settings.image = "button";
         *       settings.framewidth = 100;
         *       settings.frameheight = 50;
         *       // super constructor
         *       super(x, y, settings);
         *       // define the object z order
         *       this.pos.z = 4;
         *    }
         *
         *    // output something in the console
         *    // when the object is clicked
         *    onClick:function (event) {
         *       console.log("clicked!");
         *       // don't propagate the event
         *       return false;
         *    }
         * });
         *
         * // add the object at pos (10,10)
         * me.game.world.addChild(new myButton(10,10));
         */
        constructor(x: number, y: number, settings: object);
        /**
         * object can be clicked or not
         * @type {boolean}
         * @default true
         */
        isClickable: boolean;
        /**
         * Tap and hold threshold timeout in ms
         * @type {number}
         * @default 250
         */
        holdThreshold: number;
        /**
         * object can be tap and hold
         * @type {boolean}
         * @default false
         */
        isHoldable: boolean;
        /**
         * true if the pointer is over the object
         * @type {boolean}
         * @default false
         */
        hover: boolean;
        holdTimeout: number;
        released: boolean;
        /**
         * function callback for the pointerdown event
         * @ignore
         */
        clicked(event: any): boolean;
        dirty: boolean;
        /**
         * function called when the object is pressed (to be extended)
         * @param {Pointer} event the event object
         * @returns {boolean} return false if we need to stop propagating the event
         */
        onClick(event: Pointer): boolean;
        /**
         * function callback for the pointerEnter event
         * @ignore
         */
        enter(event: any): void;
        /**
         * function called when the pointer is over the object
         * @param {Pointer} event the event object
         */
        onOver(event: Pointer): void;
        /**
         * function callback for the pointerLeave event
         * @ignore
         */
        leave(event: any): void;
        /**
         * function called when the pointer is leaving the object area
         * @param {Pointer} event the event object
         */
        onOut(event: Pointer): void;
        /**
         * function callback for the pointerup event
         * @ignore
         */
        release(event: any): boolean;
        /**
         * function called when the object is pressed and released (to be extended)
         * @returns {boolean} return false if we need to stop propagating the event
         */
        onRelease(): boolean;
        /**
         * function callback for the tap and hold timer event
         * @ignore
         */
        hold(): void;
        /**
         * function called when the object is pressed and held<br>
         * to be extended <br>
         */
        onHold(): void;
        /**
         * function called when added to the game world or a container
         * @ignore
         */
        onActivateEvent(): void;
        /**
         * function called when removed from the game world or a container
         * @ignore
         */
        onDeactivateEvent(): void;
    }
    import Sprite from "renderable/sprite";
}
declare module "renderable/collectable" {
    export default Collectable;
    /**
     * @classdesc
     * a basic collectable helper class for immovable object (e.g. a coin)
     * @augments Sprite
     */
    class Collectable extends Sprite {
        /**
         * @param {number} x the x coordinates of the collectable
         * @param {number} y the y coordinates of the collectable
         * @param {object} settings See {@link Sprite}
         */
        constructor(x: number, y: number, settings: object);
        name: any;
        type: any;
        id: any;
        body: Body;
    }
    import Sprite from "renderable/sprite";
    import Body from "physics/body";
}
declare module "renderable/trigger" {
    export default Trigger;
    /**
     * @classdesc
     * trigger an event when colliding with another object
     * @augments Renderable
     */
    class Trigger extends Renderable {
        /**
         * @param {number} x the x coordinates of the trigger area
         * @param {number} y the y coordinates of the trigger area
         * @param {number} [settings.width] width of the trigger area
         * @param {number} [settings.height] height of the trigger area
         * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] collision shape(s) that will trigger the event
         * @param {string} [settings.duration] Fade duration (in ms)
         * @param {string|Color} [settings.color] Fade color
         * @param {string} [settings.event="level"] the type of event to trigger (only "level" supported for now)
         * @param {string} [settings.to] level to load if level trigger
         * @param {string|Container} [settings.container] Target container. See {@link level.load}
         * @param {Function} [settings.onLoaded] Level loaded callback. See {@link level.load}
         * @param {boolean} [settings.flatten] Flatten all objects into the target container. See {@link level.load}
         * @param {boolean} [settings.setViewportBounds] Resize the viewport to match the level. See {@link level.load}
         * @example
         * me.game.world.addChild(new me.Trigger(
         *     x, y, {
         *         shapes: [new me.Rect(0, 0, 100, 100)],
         *         "duration" : 250,
         *         "color" : "#000",
         *         "to" : "mymap2"
         *     }
         * ));
         */
        constructor(x: number, y: number, settings: any);
        fade: any;
        duration: any;
        fading: boolean;
        type: any;
        id: any;
        gotolevel: any;
        triggerSettings: {
            event: string;
        };
        body: Body;
        /**
         * @ignore
         */
        getTriggerSettings(): {
            event: string;
        };
        /**
         * @ignore
         */
        onFadeComplete(): void;
        /**
         * trigger this event
         * @name triggerEvent
         * @memberof Trigger
         * @protected
         */
        protected triggerEvent(): void;
    }
    import Renderable from "renderable/renderable";
    import Body from "physics/body";
}
declare module "renderable/light2d" {
    export default Light2d;
    /**
     * @classdesc
     * A 2D point light.
     * Note: this is a very experimental and work in progress feature, that provides a simple spot light effect.
     * The light effect is best rendered in WebGL, as they are few limitations when using the Canvas Renderer
     * (multiple lights are not supported, alpha component of the ambient light is ignored)
     * @see stage.lights
     */
    class Light2d extends Renderable {
        /**
         * @param {number} x - The horizontal position of the light.
         * @param {number} y - The vertical position of the light.
         * @param {number} radiusX - The horizontal radius of the light.
         * @param {number} [radiusY=radiusX] - The vertical radius of the light.
         * @param {Color|string} [color="#FFF"] the color of the light
         * @param {number} [intensity=0.7] - The intensity of the light.
         */
        constructor(x: number, y: number, radiusX: number, radiusY?: number, color?: Color | string, intensity?: number);
        /**
         * the color of the light
         * @type {Color}
         * @default "#FFF"
         */
        color: Color;
        /**
         * The horizontal radius of the light
         * @type {number}
         */
        radiusX: number;
        /**
         * The vertical radius of the light
         * @type {number}
         */
        radiusY: number;
        /**
         * The intensity of the light
         * @type {number}
         * @default 0.7
         */
        intensity: number;
        /** @ignore */
        visibleArea: any;
        /** @ignore */
        texture: any;
        /**
         * returns a geometry representing the visible area of this light
         * @name getVisibleArea
         * @memberof Light2d
         * @returns {Ellipse} the light visible mask
         */
        getVisibleArea(): Ellipse;
        /**
         * Destroy function<br>
         * @ignore
         */
        destroy(): void;
    }
    import Renderable from "renderable/renderable";
}
declare module "renderable/dragndrop" {
    /**
     * @classdesc
     * A Draggable base object
     * @see DropTarget
     * @augments Renderable
     */
    export class Draggable extends Renderable {
        dragging: boolean;
        dragId: any;
        grabOffset: Vector2d;
        /**
         * Initializes the events the modules needs to listen to
         * It translates the pointer events to me.events
         * in order to make them pass through the system and to make
         * this module testable. Then we subscribe this module to the
         * transformed events.
         * @name initEvents
         * @memberof Draggable
         * @private
         */
        private initEvents;
        /**
         * Gets called when the user starts dragging the entity
         * @name dragStart
         * @memberof Draggable
         * @param {object} e the pointer event
         * @returns {boolean} false if the object is being dragged
         */
        dragStart(e: object): boolean;
        /**
         * Gets called when the user drags this entity around
         * @name dragMove
         * @memberof Draggable
         * @param {object} e the pointer event
         */
        dragMove(e: object): void;
        /**
         * Gets called when the user stops dragging the entity
         * @name dragEnd
         * @memberof Draggable
         * @returns {boolean} false if the object stopped being dragged
         */
        dragEnd(): boolean;
        /**
         * Destructor
         * @name destroy
         * @memberof Draggable
         * @ignore
         */
        destroy(): void;
    }
    /**
     * @classdesc
     * a base drop target object
     * @see Draggable
     * @augments Renderable
     */
    export class DropTarget extends Renderable {
        /**
         * constant for the overlaps method
         * @public
         * @constant
         * @type {string}
         * @name CHECKMETHOD_OVERLAP
         * @memberof DropTarget
         */
        public CHECKMETHOD_OVERLAP: string;
        /**
         * constant for the contains method
         * @public
         * @constant
         * @type {string}
         * @name CHECKMETHOD_CONTAINS
         * @memberof DropTarget
         */
        public CHECKMETHOD_CONTAINS: string;
        /**
         * the checkmethod we want to use
         * @public
         * @constant
         * @type {string}
         * @name checkMethod
         * @default "overlaps"
         * @memberof DropTarget
         */
        public checkMethod: string;
        /**
         * Sets the collision method which is going to be used to check a valid drop
         * @name setCheckMethod
         * @memberof DropTarget
         * @param {string} checkMethod the checkmethod (defaults to CHECKMETHOD_OVERLAP)
         */
        setCheckMethod(checkMethod: string): void;
        /**
         * Checks if a dropped entity is dropped on the current entity
         * @name checkOnMe
         * @memberof DropTarget
         * @param {object} e the triggering event
         * @param {Draggable} draggable the draggable object that is dropped
         */
        checkOnMe(e: object, draggable: Draggable): void;
        /**
         * Gets called when a draggable entity is dropped on the current entity
         * @name drop
         * @memberof DropTarget
         * @param {Draggable} draggable the draggable object that is dropped
         */
        drop(draggable: Draggable): void;
        /**
         * Destructor
         * @name destroy
         * @memberof DropTarget
         * @ignore
         */
        destroy(): void;
    }
    import Renderable from "renderable/renderable";
    import Vector2d from "math/vector2";
}
declare module "particles/settings" {
    export default ParticleEmitterSettings;
    namespace ParticleEmitterSettings {
        const width: number;
        const height: number;
        const image: HTMLCanvasElement;
        const textureSize: number;
        const tint: string;
        const totalParticles: number;
        const angle: number;
        const angleVariation: number;
        const minLife: number;
        const maxLife: number;
        const speed: number;
        const speedVariation: number;
        const minRotation: number;
        const maxRotation: number;
        const minStartScale: number;
        const maxStartScale: number;
        const minEndScale: number;
        const maxEndScale: number;
        const gravity: number;
        const wind: number;
        const followTrajectory: boolean;
        const textureAdditive: boolean;
        const blendMode: string;
        const onlyInViewport: boolean;
        const floating: boolean;
        const maxParticles: number;
        const frequency: number;
        const duration: number;
        const framesToSkip: number;
    }
}
declare module "particles/emitter" {
    export default ParticleEmitter;
    /**
     * @classdesc
     * Particle Emitter Object.
     * @augments Container
     */
    class ParticleEmitter extends Container {
        /**
         * @param {number} x x position of the particle emitter
         * @param {number} y y position of the particle emitter
         * @param {ParticleEmitterSettings} [settings=ParticleEmitterSettings] the settings for the particle emitter.
         * @example
         * // Create a particle emitter at position 100, 100
         * var emitter = new ParticleEmitter(100, 100, {
         *     width: 16,
         *     height : 16,
         *     tint: "#f00",
         *     totalParticles: 32,
         *     angle: 0,
         *     angleVariation: 6.283185307179586,
         *     maxLife: 5,
         *     speed: 3
         * });
         *
         * // Add the emitter to the game world
         * me.game.world.addChild(emitter);
         *
         * // Launch all particles one time and stop, like a explosion
         * emitter.burstParticles();
         *
         * // Launch constantly the particles, like a fountain
         * emitter.streamParticles();
         *
         * // At the end, remove emitter from the game world
         * // call this in onDestroyEvent function
         * me.game.world.removeChild(emitter);
         */
        constructor(x: number, y: number, settings?: {
            width: number;
            height: number;
            image: HTMLCanvasElement;
            textureSize: number;
            tint: string;
            totalParticles: number;
            angle: number;
            angleVariation: number;
            minLife: number;
            maxLife: number;
            speed: number;
            speedVariation: number;
            minRotation: number;
            maxRotation: number;
            minStartScale: number;
            maxStartScale: number;
            minEndScale: number;
            maxEndScale: number;
            gravity: number;
            wind: number;
            followTrajectory: boolean;
            textureAdditive: boolean;
            blendMode: string;
            onlyInViewport: boolean;
            floating: boolean;
            maxParticles: number;
            frequency: number;
            duration: number;
            framesToSkip: number;
        });
        /**
         * the current (active) emitter settings
         * @public
         * @type {ParticleEmitterSettings}
         * @name settings
         * @memberof ParticleEmitter
         */
        public settings: {
            width: number;
            height: number;
            image: HTMLCanvasElement;
            textureSize: number;
            tint: string;
            totalParticles: number;
            angle: number;
            angleVariation: number;
            minLife: number;
            maxLife: number;
            speed: number;
            speedVariation: number;
            minRotation: number;
            maxRotation: number;
            minStartScale: number;
            maxStartScale: number;
            minEndScale: number;
            maxEndScale: number;
            gravity: number;
            wind: number;
            followTrajectory: boolean;
            textureAdditive: boolean;
            blendMode: string;
            onlyInViewport: boolean;
            floating: boolean;
            maxParticles: number;
            frequency: number;
            duration: number;
            framesToSkip: number;
        };
        /** @ignore */
        _stream: boolean;
        /** @ignore */
        _frequencyTimer: number;
        /** @ignore */
        _durationTimer: number;
        /** @ignore */
        _enabled: boolean;
        _updateCount: number;
        _dt: number;
        /**
         * Reset the emitter with particle emitter settings.
         * @param {ParticleEmitterSettings} settings [optional] object with emitter settings. See {@link ParticleEmitterSettings}
         */
        reset(settings?: {
            width: number;
            height: number;
            image: HTMLCanvasElement;
            textureSize: number;
            tint: string;
            totalParticles: number;
            angle: number;
            angleVariation: number;
            minLife: number;
            maxLife: number;
            speed: number;
            speedVariation: number;
            minRotation: number;
            maxRotation: number;
            minStartScale: number;
            maxStartScale: number;
            minEndScale: number;
            maxEndScale: number;
            gravity: number;
            wind: number;
            followTrajectory: boolean;
            textureAdditive: boolean;
            blendMode: string;
            onlyInViewport: boolean;
            floating: boolean;
            maxParticles: number;
            frequency: number;
            duration: number;
            framesToSkip: number;
        }): void;
        _defaultParticle: any;
        /**
         * returns a random point on the x axis within the bounds of this emitter
         * @returns {number}
         */
        getRandomPointX(): number;
        /**
         * returns a random point on the y axis within the bounds this emitter
         * @returns {number}
         */
        getRandomPointY(): number;
        /** @ignore */
        addParticles(count: any): void;
        /**
         * Emitter is of type stream and is launching particles
         * @returns {boolean} Emitter is Stream and is launching particles
         */
        isRunning(): boolean;
        /**
         * Launch particles from emitter constantly (e.g. for stream)
         * @param {number} duration [optional] time that the emitter releases particles in ms
         */
        streamParticles(duration: number): void;
        /**
         * Stop the emitter from generating new particles (used only if emitter is Stream)
         */
        stopStream(): void;
        /**
         * Launch all particles from emitter and stop (e.g. for explosion)
         * @param {number} total [optional] number of particles to launch
         */
        burstParticles(total: number): void;
        /**
         * @ignore
         */
        update(dt: any): boolean;
    }
    import Container from "renderable/container";
}
declare module "particles/particle" {
    export default Particle;
    /**
     * @classdesc
     * Single Particle Object.
     * @augments Renderable
     */
    class Particle extends Renderable {
        /**
         * @param {ParticleEmitter} emitter the particle emitter
         */
        constructor(emitter: ParticleEmitter);
        /**
         * @ignore
         */
        onResetEvent(emitter: any, newInstance?: boolean): void;
        vel: any;
        image: any;
        life: any;
        startLife: any;
        startScale: number;
        endScale: number;
        gravity: any;
        wind: any;
        followTrajectory: any;
        onlyInViewport: any;
        _deltaInv: number;
        angle: number;
        /**
         * @ignore
         */
        draw(renderer: any): void;
    }
    import Renderable from "renderable/renderable";
}
declare module "entity/entity" {
    export default Entity;
    /**
     * @classdesc
     * a Generic Object Entity
     * @augments Renderable
     * @see Renderable
     */
    class Entity extends Renderable {
        /**
         * @param {number} x the x coordinates of the entity object
         * @param {number} y the y coordinates of the entity object
         * @param {object} settings Entity properties, to be defined through Tiled or when calling the entity constructor
         * <img src="images/object_properties.png"/>
         * @param {number} settings.width the physical width the entity takes up in game
         * @param {number} settings.height the physical height the entity takes up in game
         * @param {string} [settings.name] object entity name
         * @param {string} [settings.id] object unique IDs
         * @param {Image|string} [settings.image] resource name of a spritesheet to use for the entity renderable component
         * @param {Vector2d} [settings.anchorPoint=0.0] Entity anchor point
         * @param {number} [settings.framewidth=settings.width] width of a single frame in the given spritesheet
         * @param {number} [settings.frameheight=settings.width] height of a single frame in the given spritesheet
         * @param {string} [settings.type] object type
         * @param {number} [settings.collisionMask] Mask collision detection for this object
         * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] the initial list of collision shapes (usually populated through Tiled)
         */
        constructor(x: number, y: number, settings: {
            width: number;
            height: number;
            name?: string;
            id?: string;
            image?: (new (width?: number, height?: number) => HTMLImageElement) | string;
            anchorPoint?: Vector2d;
            framewidth?: number;
            frameheight?: number;
            type?: string;
            collisionMask?: number;
            shapes?: Rect[] | Polygon[] | Line[] | Ellipse[];
        });
        /**
         * The array of renderable children of this entity.
         * @ignore
         */
        children: any[];
        public set renderable(arg: Renderable);
        /**
         * The entity renderable component (can be any objects deriving from me.Renderable, like me.Sprite for example)
         * @public
         * @type {Renderable}
         * @name renderable
         * @memberof Entity
         */
        public get renderable(): Renderable;
        /**
         * object type (as defined in Tiled)
         * @public
         * @type {string}
         * @name type
         * @memberof Entity
         */
        public type: string;
        /**
         * object unique ID (as defined in Tiled)
         * @public
         * @type {number}
         * @name id
         * @memberof Entity
         */
        public id: number;
        /**
         * dead/living state of the entity<br>
         * default value : true
         * @public
         * @type {boolean}
         * @name alive
         * @memberof Entity
         */
        public alive: boolean;
        body: Body;
        /** @ignore */
        update(dt: any): boolean;
        /**
         * update the bounds position when the body is modified
         * @ignore
         * @name onBodyUpdate
         * @memberof Entity
         * @param {Body} body the body whose bounds to update
         */
        onBodyUpdate(body: Body): void;
        preDraw(renderer: any): void;
        /**
         * onDeactivateEvent Notification function<br>
         * Called by engine before deleting the object
         * @name onDeactivateEvent
         * @memberof Entity
         */
        onDeactivateEvent(): void;
    }
    import Renderable from "renderable/renderable";
    import Body from "physics/body";
}
declare module "lang/deprecated" {
    /**
     * display a deprecation warning in the console
     * @ignore
     * @param {string} deprecated deprecated class,function or property name
     * @param {string} replacement the replacement class, function, or property name
     * @param {string} version the version since when the lass,function or property is deprecated
     */
    export function warning(deprecated: string, replacement: string, version: string): void;
    /**
     * @classdesc
     * Used to make a game entity draggable
     * @augments Entity
     * @deprecated since 10.5.0
     * @see Draggable
     */
    export class DraggableEntity {
        /**
         * @param {number} x the x coordinates of the draggable object
         * @param {number} y the y coordinates of the draggable object
         * @param {object} settings Entity properties (see {@link Entity})
         */
        constructor(x: number, y: number, settings: object);
    }
    /**
     * @classdesc
     * Used to make a game entity a droptarget
     * @augments Entity
     * @deprecated since 10.5.0
     * @see DropTarget
     */
    export class DroptargetEntity {
        /**
         * @param {number} x the x coordinates of the draggable object
         * @param {number} y the y coordinates of the draggable object
         * @param {object} settings Entity properties (see {@link Entity})
         */
        constructor(x: number, y: number, settings: object);
    }
    /**
     * @classdesc
     * A very basic object to manage GUI elements
     * @augments Sprite
     * @deprecated since 14.0.0
     * @see UISpriteElement
     */
    export class GUI_Object {
        /**
         * @param {number} x the x coordinate of the GUI Object
         * @param {number} y the y coordinate of the GUI Object
         * @param {object} settings See {@link Sprite}
         */
        constructor(x: number, y: number, settings: object);
    }
}
declare module "index" {
    /**
     * initialize the melonJS library.
     * this is automatically called unless me.skipAutoInit is set to true,
     * to allow asynchronous loaders to work.
     * @name boot
     * @see skipAutoInit
     * @public
     */
    export function boot(): void;
    /**
     * current melonJS version
     * @static
     * @constant
     * @name version
     * @type {string}
     */
    export const version: string;
    export * from "lang/deprecated";
    /**
     * a flag indicating that melonJS is fully initialized
     * @type {boolean}
     * @default false
     * @readonly
     */
    export const initialized: boolean;
    /**
     * disable melonJS auto-initialization
     * @type {boolean}
     * @default false
     * @see boot
     */
    export const skipAutoInit: boolean;
    import * as audio from "audio/audio";
    import collision from "physics/collision";
    import * as device from "system/device";
    import * as event from "system/event";
    import game from "game";
    import loader from "loader/loader";
    import level from "level/level";
    import * as input from "input/input";
    import * as Math from "math/math";
    import { plugin } from "plugin/plugin";
    import { plugins } from "plugin/plugin";
    import utils from "utils/utils";
    import save from "system/save";
    import timer from "system/timer";
    import pool from "system/pooling";
    import state from "state/state";
    import * as video from "video/video";
    import Color from "math/color";
    import Vector2d from "math/vector2";
    import Vector3d from "math/vector3";
    import ObservableVector2d from "math/observable_vector2";
    import ObservableVector3d from "math/observable_vector3";
    import Matrix2d from "math/matrix2";
    import Matrix3d from "math/matrix3";
    import Polygon from "geometries/poly";
    import Line from "geometries/line";
    import Ellipse from "geometries/ellipse";
    import Point from "geometries/point";
    import Rect from "geometries/rectangle";
    import RoundRect from "geometries/roundrect";
    import Tween from "tweens/tween";
    import QuadTree from "physics/quadtree";
    import GLShader from "video/webgl/glshader";
    import WebGLCompositor from "video/webgl/webgl_compositor";
    import Renderer from "video/renderer";
    import WebGLRenderer from "video/webgl/webgl_renderer";
    import CanvasRenderer from "video/canvas/canvas_renderer";
    import { TextureAtlas } from "video/texture/atlas";
    import Renderable from "renderable/renderable";
    import Body from "physics/body";
    import Bounds from "physics/bounds";
    import Text from "text/text";
    import BitmapText from "text/bitmaptext";
    import BitmapTextData from "text/bitmaptextdata";
    import ColorLayer from "renderable/colorlayer";
    import ImageLayer from "renderable/imagelayer";
    import Sprite from "renderable/sprite";
    import NineSliceSprite from "renderable/nineslicesprite";
    import UIBaseElement from "renderable/ui/uibaseelement";
    import UITextButton from "renderable/ui/uitextbutton";
    import UISpriteElement from "renderable/ui/uispriteelement";
    import Collectable from "renderable/collectable";
    import Trigger from "renderable/trigger";
    import Light2d from "renderable/light2d";
    import { Draggable } from "renderable/dragndrop";
    import { DropTarget } from "renderable/dragndrop";
    import TMXRenderer from "level/tiled/renderer/TMXRenderer";
    import TMXOrthogonalRenderer from "level/tiled/renderer/TMXOrthogonalRenderer";
    import TMXIsometricRenderer from "level/tiled/renderer/TMXIsometricRenderer";
    import TMXHexagonalRenderer from "level/tiled/renderer/TMXHexagonalRenderer";
    import TMXStaggeredRenderer from "level/tiled/renderer/TMXStaggeredRenderer";
    import Tile from "level/tiled/TMXTile";
    import TMXTileset from "level/tiled/TMXTileset";
    import TMXTilesetGroup from "level/tiled/TMXTilesetGroup";
    import TMXTileMap from "level/tiled/TMXTileMap";
    import TMXLayer from "level/tiled/TMXLayer";
    import Pointer from "input/pointer";
    import Stage from "state/stage";
    import Camera2d from "camera/camera2d";
    import Container from "renderable/container";
    import World from "physics/world";
    import ParticleEmitter from "particles/emitter";
    import ParticleEmitterSettings from "particles/settings";
    import Particle from "particles/particle";
    import Entity from "entity/entity";
    export { audio, collision, device, event, game, loader, level, input, Math, plugin, plugins, utils, save, timer, pool, state, video, Color, Vector2d, Vector3d, ObservableVector2d, ObservableVector3d, Matrix2d, Matrix3d, Polygon, Line, Ellipse, Point, Rect, RoundRect, Tween, QuadTree, GLShader, WebGLCompositor, Renderer, WebGLRenderer, CanvasRenderer, TextureAtlas, Renderable, Body, Bounds, Text, BitmapText, BitmapTextData, ColorLayer, ImageLayer, Sprite, NineSliceSprite, UIBaseElement, UITextButton, UISpriteElement, Collectable, Trigger, Light2d, Draggable, DropTarget, TMXRenderer, TMXOrthogonalRenderer, TMXIsometricRenderer, TMXHexagonalRenderer, TMXStaggeredRenderer, Tile, TMXTileset, TMXTilesetGroup, TMXTileMap, TMXLayer, Pointer, Stage, Camera2d, Container, World, ParticleEmitter, ParticleEmitterSettings, Particle, Entity };
}
