/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {

    /**
     * TMX Object Group <br>
     * contains the object group definition as defined in Tiled. <br>
     * note : object group definition is translated into the virtual `me.game.world` using `me.ObjectContainer`.
     * @see me.ObjectContainer
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     */
    me.TMXObjectGroup = Object.extend({
        init : function (name, tmxObjGroup, tilesets, z) {
            /**
             * group name
             * @public
             * @type String
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.name = null;

            /**
             * group width
             * @public
             * @type Number
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.width = 0;

            /**
             * group height
             * @public
             * @type Number
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.height = 0;

            /**
             * group z order
             * @public
             * @type Number
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.z = 0;

            /**
             * group objects list definition
             * @see me.TMXObject
             * @public
             * @type Array
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.objects = [];
            var self = this;
            this.name    = name;
            this.width   = tmxObjGroup[me.TMX_TAG_WIDTH];
            this.height  = tmxObjGroup[me.TMX_TAG_HEIGHT];
            this.z       = z;
            this.objects = [];

            var visible = typeof(tmxObjGroup[me.TMX_TAG_VISIBLE]) !== "undefined" ? tmxObjGroup[me.TMX_TAG_VISIBLE] : true;

            this.opacity = (visible === true) ? parseFloat(tmxObjGroup[me.TMX_TAG_OPACITY] || 1.0).clamp(0.0, 1.0) : 0;

            // check if we have any user-defined properties
            me.TMXUtils.applyTMXProperties(this, tmxObjGroup);

            // parse all objects
            // (under `objects` for XML converted map, under `object` for native json map)
            var _objects = tmxObjGroup.objects || tmxObjGroup.object;
            if (Array.isArray(_objects) === true) {
                // JSON native format
                _objects.forEach(function (tmxObj) {
                    self.objects.push(new me.TMXObject(tmxObj, tilesets, z));
                });
            } else {
                self.objects.push(new me.TMXObject(_objects, tilesets, z));
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

    /**
     * a TMX Object defintion, as defined in Tiled. <br>
     * note : object definition are translated into the virtual `me.game.world` using `me.ObjectEntity`.
     * @see me.ObjectEntity
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     */
    me.TMXObject = Object.extend({
        init :  function (tmxObj, tilesets, z) {

            /**
             * object point list (for polygone and polyline)
             * @public
             * @type Vector2d[]
             * @name points
             * @memberOf me.TMXObject
             */
            this.points = undefined;
            /**
             * object name
             * @public
             * @type String
             * @name name
             * @memberOf me.TMXObject
             */
            this.name = tmxObj[me.TMX_TAG_NAME];
            /**
             * object x position
             * @public
             * @type Number
             * @name x
             * @memberOf me.TMXObject
             */
            this.x = parseInt(tmxObj[me.TMX_TAG_X], 10);
            /**
             * object y position
             * @public
             * @type Number
             * @name y
             * @memberOf me.TMXObject
             */
            this.y = parseInt(tmxObj[me.TMX_TAG_Y], 10);
            /**
             * object z order
             * @public
             * @type Number
             * @name z
             * @memberOf me.TMXObject
             */
            this.z = parseInt(z, 10);

            /**
             * object width
             * @public
             * @type Number
             * @name width
             * @memberOf me.TMXObject
             */
            this.width = parseInt(tmxObj[me.TMX_TAG_WIDTH] || 0, 10);

            /**
             * object height
             * @public
             * @type Number
             * @name height
             * @memberOf me.TMXObject
             */
            this.height = parseInt(tmxObj[me.TMX_TAG_HEIGHT] || 0, 10);

            /**
             * object gid value
             * when defined the object is a tiled object
             * @public
             * @type Number
             * @name gid
             * @memberOf me.TMXObject
             */
            this.gid = parseInt(tmxObj[me.TMX_TAG_GID], 10) || null;

            /**
             * object type
             * @public
             * @type String
             * @name type
             * @memberOf me.TMXObject
             */
            this.type = tmxObj[me.TMX_TAG_TYPE];

            this.isEllipse = false;
            /**
             * if true, the object is a polygone
             * @public
             * @type Boolean
             * @name isPolygon
             * @memberOf me.TMXObject
             */
            this.isPolygon = false;
            /**
             * f true, the object is a polygone
             * @public
             * @type Boolean
             * @name isPolyline
             * @memberOf me.TMXObject
             */
            this.isPolyline = false;

            // check if the object has an associated gid
            if (this.gid) {
                this.setImage(this.gid, tilesets);
            }
            else {
                if (typeof(tmxObj[me.TMX_TAG_ELLIPSE]) !== "undefined") {
                    this.isEllipse = true;
                }
                else {
                    var points = tmxObj[me.TMX_TAG_POLYGON];
                    if (typeof(points) !== "undefined") {
                        this.isPolygon = true;
                    }
                    else {
                        points = tmxObj[me.TMX_TAG_POLYLINE];
                        if (typeof(points) !== "undefined") {
                            this.isPolyline = true;
                        }
                    }
                    if (typeof(points) !== "undefined") {
                        this.points = [];
                        if (typeof(points.points) !== "undefined") {
                            // get a point array
                            points = points.points.split(" ");
                            // and normalize them into an array of vectors
                            for (var i = 0, v; i < points.length; i++) {
                                v = points[i].split(",");
                                this.points.push(new me.Vector2d(+v[0], +v[1]));
                            }
                        }
                        else {
                            // already an object (native json format)
                            var self = this;
                            points.forEach(function (point) {
                                self.points.push(new me.Vector2d(parseInt(point.x, 10), parseInt(point.y, 10)));
                            });
                        }
                    }
                }
            }

            // Adjust the Position to match Tiled
            me.game.renderer.adjustPosition(this);

            // set the object properties
            me.TMXUtils.applyTMXProperties(this, tmxObj);
        },

        /**
         * set the object image (for Tiled Object)
         * @ignore
         * @function
         */
        setImage : function (gid, tilesets) {
            // get the corresponding tileset
            var tileset = tilesets.getTilesetByGid(this.gid);

            // set width and height equal to tile size
            this.width = tileset.tilewidth;
            this.height = tileset.tileheight;

            // force spritewidth size
            this.spritewidth = this.width;

            // the object corresponding tile

            var tmxTile = new me.Tile(this.x, this.y, tileset.tilewidth, tileset.tileheight, this.gid);

            // get the corresponding tile into our object
            this.image = tileset.getTileImage(tmxTile);

            // set a generic name if not defined
            if (typeof (this.name) === "undefined") {
                this.name = "TileObject";
            }
        },

        /**
         * return the corresponding shape object
         * @name getShape
         * @memberOf me.TMXObject
         * @public
         * @function
         * @return {me.Rect|me.PolyShape|me.Ellipse} shape a shape object
         */
        getShape : function () {
            // add an ellipse shape
            if (this.isEllipse === true) {
                return new me.Ellipse(new me.Vector2d(0, 0), this.width, this.height);
            }

            // add a polyshape
            if ((this.isPolygon === true) || (this.isPolyline === true)) {
                return new me.PolyShape(new me.Vector2d(0, 0), this.points, this.isPolygon);
            }

            // it's a rectangle
            return new me.Rect(new me.Vector2d(0, 0), this.width, this.height);
        },
        /**
         * getObjectPropertyByName
         * @ignore
         * @function
         */
        getObjectPropertyByName : function (name) {
            return this[name];
        }
    });
})();