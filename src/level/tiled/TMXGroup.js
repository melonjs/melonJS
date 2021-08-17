import { applyTMXProperties } from "./TMXUtils.js";
import TMXObject from "./TMXObject.js";
import TMXLayer from "./TMXLayer.js";
import { clamp } from "./../../math/math.js";

/**
 * @classdesc
 * object group definition as defined in Tiled.
 * (group definition is translated into the virtual `me.game.world` using `me.Container`)
 * @class TMXGroup
 * @constructor
 * @ignore
 */
export default class TMXGroup {

    constructor(map, data, z) {

        /**
         * group name
         * @public
         * @type String
         * @name name
         * @memberOf me.TMXGroup
         */
        this.name = data.name;

        /**
         * group width
         * @public
         * @type Number
         * @name width
         * @memberOf me.TMXGroup
         */
        this.width = data.width || 0;

        /**
         * group height
         * @public
         * @type Number
         * @name height
         * @memberOf me.TMXGroup
         */
        this.height = data.height || 0;

        /**
         * tint color
         * @public
         * @type String
         * @name tintcolor
         * @memberOf me.TMXGroup
         */
        this.tintcolor = data.tintcolor;

        /**
         * group z order
         * @public
         * @type Number
         * @name z
         * @memberOf me.TMXGroup
         */
        this.z = z;

        /**
         * group objects list definition
         * @see me.TMXObject
         * @public
         * @type Array
         * @name name
         * @memberOf me.TMXGroup
         */
        this.objects = [];

        var visible = typeof(data.visible) !== "undefined" ? data.visible : true;
        this.opacity = (visible === true) ? clamp(+data.opacity || 1.0, 0.0, 1.0) : 0;

        // check if we have any user-defined properties
        applyTMXProperties(this, data);

        // parse all child objects/layers
        var self = this;

        if (data.objects) {
            var _objects = data.objects;
            _objects.forEach(function (object) {
                object.tintcolor = self.tintcolor;
                self.objects.push(new TMXObject(map, object, z));
            });
        }

        if (data.layers) {
            var _layers = data.layers;
            _layers.forEach(function (data) {
                var layer = new TMXLayer(map, data, map.tilewidth, map.tileheight, map.orientation, map.tilesets, z++);
                // set a renderer
                layer.setRenderer(map.getRenderer());
                // resize container accordingly
                self.width = Math.max(self.width, layer.width);
                self.height = Math.max(self.height, layer.height);
                self.objects.push(layer);
            });
        }
    }

    /**
     * reset function
     * @ignore
     * @function
     */

    destroy() {
        // clear all allocated objects
        this.objects = null;
    }

    /**
     * return the object count
     * @ignore
     * @function
     */
    getObjectCount() {
        return this.objects.length;
    }

    /**
     * returns the object at the specified index
     * @ignore
     * @function
     */
    getObjectByIndex(idx) {
        return this.objects[idx];
    }
};
