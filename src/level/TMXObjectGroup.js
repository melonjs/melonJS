/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function (TMXConstants) {

    /**
     * TMX Object Group <br>
     * contains the object group definition as defined in Tiled. <br>
     * note : object group definition is translated into the virtual `me.game.world` using `me.Container`.
     * @see me.Container
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     */
    me.TMXObjectGroup = Object.extend({
        init : function (name, tmxObjGroup, orientation, tilesets, z) {
            /**
             * group name
             * @public
             * @type String
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.name = name;

            /**
             * group width
             * @public
             * @type Number
             * @name width
             * @memberOf me.TMXObjectGroup
             */
            this.width = tmxObjGroup[TMXConstants.TMX_TAG_WIDTH];

            /**
             * group height
             * @public
             * @type Number
             * @name height
             * @memberOf me.TMXObjectGroup
             */
            this.height = tmxObjGroup[TMXConstants.TMX_TAG_HEIGHT];

            /**
             * group z order
             * @public
             * @type Number
             * @name z
             * @memberOf me.TMXObjectGroup
             */
            this.z = z;

            /**
             * group objects list definition
             * @see me.TMXObject
             * @public
             * @type Array
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.objects = [];

            var visible = typeof(tmxObjGroup[TMXConstants.TMX_TAG_VISIBLE]) !== "undefined" ? tmxObjGroup[TMXConstants.TMX_TAG_VISIBLE] : true;

            this.opacity = (visible === true) ? (+tmxObjGroup[TMXConstants.TMX_TAG_OPACITY] || 1.0).clamp(0.0, 1.0) : 0;

            // check if we have any user-defined properties
            me.TMXUtils.applyTMXProperties(this, tmxObjGroup);

            // parse all objects
            // (under `objects` for XML converted map, under `object` for native json map)
            var _objects = tmxObjGroup.objects || tmxObjGroup.object;
            var self = this;
            if (Array.isArray(_objects) === true) {
                // JSON native format
                _objects.forEach(function (tmxObj) {
                    self.objects.push(new me.TMXObject(tmxObj, orientation, tilesets, z));
                });
            }
            else if (_objects) {
                self.objects.push(new me.TMXObject(_objects, orientation, tilesets, z));
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
     * note : object definition are translated into the virtual `me.game.world` using `me.Entity`.
     * @see me.Entity
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     */
    me.TMXObject = Object.extend({
        init :  function (tmxObj, orientation, tilesets, z) {

            /**
             * object point list (for Polygon and PolyLine)
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
            this.name = tmxObj[TMXConstants.TMX_TAG_NAME];

            /**
             * object x position
             * @public
             * @type Number
             * @name x
             * @memberOf me.TMXObject
             */
            this.x = +tmxObj[TMXConstants.TMX_TAG_X];

            /**
             * object y position
             * @public
             * @type Number
             * @name y
             * @memberOf me.TMXObject
             */
            this.y = +tmxObj[TMXConstants.TMX_TAG_Y];

            /**
             * object z order
             * @public
             * @type Number
             * @name z
             * @memberOf me.TMXObject
             */
            this.z = +z;

            /**
             * object width
             * @public
             * @type Number
             * @name width
             * @memberOf me.TMXObject
             */
            this.width = +tmxObj[TMXConstants.TMX_TAG_WIDTH] || 0;

            /**
             * object height
             * @public
             * @type Number
             * @name height
             * @memberOf me.TMXObject
             */
            this.height = +tmxObj[TMXConstants.TMX_TAG_HEIGHT] || 0;

            /**
             * object gid value
             * when defined the object is a tiled object
             * @public
             * @type Number
             * @name gid
             * @memberOf me.TMXObject
             */
            this.gid = +tmxObj[TMXConstants.TMX_TAG_GID] || null;

            /**
             * object type
             * @public
             * @type String
             * @name type
             * @memberOf me.TMXObject
             */
            this.type = tmxObj[TMXConstants.TMX_TAG_TYPE];

            /**
             * The rotation of the object in radians clockwise (defaults to 0)
             * @public
             * @type Number
             * @name rotation
             * @memberOf me.TMXObject
             */
            this.rotation = Number.prototype.degToRad(+(tmxObj[TMXConstants.TMX_ROTATION] || 0));

            /**
             * object orientation (orthogonal or isometric)
             * @public
             * @type String
             * @name orientation
             * @memberOf me.TMXObject
             */
            this.orientation = orientation;

            /*
             * if true, the object is an Ellipse
             * @public
             * @type Boolean
             * @name isEllipse
             * @memberOf me.TMXObject
             */
            this.isEllipse = false;

            /**
             * if true, the object is a Polygon
             * @public
             * @type Boolean
             * @name isPolygon
             * @memberOf me.TMXObject
             */
            this.isPolygon = false;
            /**
             * if true, the object is a PolyLine
             * @public
             * @type Boolean
             * @name isPolyLine
             * @memberOf me.TMXObject
             */
            this.isPolyLine = false;

            // check if the object has an associated gid
            if (typeof this.gid === "number") {
                this.setImage(this.gid, tilesets);
            }
            else {
                if (typeof(tmxObj[TMXConstants.TMX_TAG_ELLIPSE]) !== "undefined") {
                    this.isEllipse = true;
                }
                else {
                    var points = tmxObj[TMXConstants.TMX_TAG_POLYGON];
                    if (typeof(points) !== "undefined") {
                        this.isPolygon = true;
                    }
                    else {
                        points = tmxObj[TMXConstants.TMX_TAG_POLYLINE];
                        if (typeof(points) !== "undefined") {
                            this.isPolyLine = true;
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
                                self.points.push(new me.Vector2d(+point.x, +point.y));
                            });
                        }
                    }
                }
            }

            // Adjust the Position to match Tiled
            me.game.tmxRenderer.adjustPosition(this);

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

            // set a generic name if not defined or the empty string
            if (!this.name) {
                this.name = "TileObject";
            }
        },

        /**
         * return a list of shapes for a TMX object
         * @name getTMXShapes
         * @memberOf me.TMXObject
         * @private
         * @function
         * @return {me.Polygon[]|me.Line[]|me.Ellipse[]} a list of shape objects
         */
        getTMXShapes : function () {
            var i = 0;
            var shapes = [];

            // add an ellipse shape
            if (this.isEllipse === true) {
                // ellipse coordinates are the center position, so set default to the corresonding radius
                shapes.push((new me.Ellipse(
                    this.width / 2,
                    this.height / 2,
                    this.width,
                    this.height
                )).rotate(this.rotation));
            }

            // add a polygon
            else if (this.isPolygon === true) {
                shapes.push((new me.Polygon(0, 0, this.points)).rotate(this.rotation));
            }

            // add a polyline
            else if (this.isPolyLine === true) {
                var p = this.points;
                var p1, p2;
                var segments = p.length - 1;
                for (i = 0; i < segments; i++) {
                    // clone the value before, as [i + 1]
                    // is reused later by the next segment
                    p1 = p[i];
                    p2 = p[i + 1].clone();
                    if (this.rotation !== 0) {
                        p1 = p1.rotate(this.rotation);
                        p2 = p2.rotate(this.rotation);
                    }
                    shapes.push(new me.Line(0, 0, [ p1, p2 ]));
                }
            }

            // it's a rectangle, returns a polygon object anyway
            else {
                shapes.push((new me.Polygon(
                    0, 0, [
                        new me.Vector2d(), new me.Vector2d(this.width, 0),
                        new me.Vector2d(this.width, this.height), new me.Vector2d(0, this.height)
                    ]
                )).rotate(this.rotation));
            }

            // Apply isometric projection
            if (this.orientation === "isometric") {
                for (i = 0; i < shapes.length; i++) {
                    shapes[i].rotate(Math.PI / 4).scale(Math.SQRT2, Math.SQRT1_2);
                }
            }

            return shapes;
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
})(me.TMXConstants);
