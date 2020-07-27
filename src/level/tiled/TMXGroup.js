(function () {

    /**
     * TMX Group <br>
     * contains an object group definition as defined in Tiled. <br>
     * note : object group definition is translated into the virtual `me.game.world` using `me.Container`.
     * @see me.Container
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     */
    me.TMXGroup = me.Object.extend({
        /**
         * @ignore
         */
        init : function (map, data, z) {

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
            this.opacity = (visible === true) ? me.Math.clamp(+data.opacity || 1.0, 0.0, 1.0) : 0;

            // check if we have any user-defined properties
            me.TMXUtils.applyTMXProperties(this, data);

            // parse all child objects/layers
            var self = this;

            if (data.objects) {
                var _objects = data.objects;
                _objects.forEach(function (object) {
                    self.objects.push(new me.TMXObject(map, object, z));
                });
            }

            if (data.layers) {
                var _layers = data.layers;
                _layers.forEach(function (data) {
                    var layer = new me.TMXLayer(data, map.tilewidth, map.tileheight, map.orientation, map.tilesets, z++);
                    // set a renderer
                    layer.setRenderer(map.getRenderer());
                    // resize container accordingly
                    self.width = Math.max(self.width, layer.width);
                    self.height = Math.max(self.height, layer.height);
                    self.objects.push(layer);
                });
            }
        },

        /**
         * reset function
         * @ignore
         * @function
         */

        destroy : function () {
            // clear all allocated objects
            this.objects = null;
        },

        /**
         * return the object count
         * @ignore
         * @function
         */
        getObjectCount : function () {
            return this.objects.length;
        },

        /**
         * returns the object at the specified index
         * @ignore
         * @function
         */
        getObjectByIndex : function (idx) {
            return this.objects[idx];
        }
    });

})();
