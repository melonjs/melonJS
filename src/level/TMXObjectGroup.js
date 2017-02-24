/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
     * note : object group definition is translated into the virtual `me.game.world` using `me.Container`.
     * @see me.Container
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     */
    me.TMXObjectGroup = me.Object.extend({
        /**
         * @ignore
         */
        init : function (map, data, z) {

            /**
             * group name
             * @public
             * @type String
             * @name name
             * @memberOf me.TMXObjectGroup
             */
            this.name = data.name;

            /**
             * group width
             * @public
             * @type Number
             * @name width
             * @memberOf me.TMXObjectGroup
             */
            this.width = data.width;

            /**
             * group height
             * @public
             * @type Number
             * @name height
             * @memberOf me.TMXObjectGroup
             */
            this.height = data.height;

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

            var visible = typeof(data.visible) !== "undefined" ? data.visible : true;
            this.opacity = (visible === true) ? (+data.opacity || 1.0).clamp(0.0, 1.0) : 0;

            // check if we have any user-defined properties
            me.TMXUtils.applyTMXProperties(this, data);

            // parse all objects
            var _objects = data.objects;
            if (_objects) {
                var self = this;
                _objects.forEach(function (tmxObj) {
                    //self.objects.push(new me.TMXObject(tmxObj, map.orientation, map.tilesets, z));
                    self.objects.push(new me.TMXObject(map, tmxObj, z));
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

    /**
     * a TMX Object defintion, as defined in Tiled. <br>
     * note : object definition are translated into the virtual `me.game.world` using `me.Entity`.
     * @see me.Entity
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     */
    me.TMXObject = me.Object.extend({
        /**
         * @ignore
         */
        init :  function (map, tmxObj, z) {

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
            this.name = tmxObj.name;

            /**
             * object x position
             * @public
             * @type Number
             * @name x
             * @memberOf me.TMXObject
             */
            this.x = +tmxObj.x;

            /**
             * object y position
             * @public
             * @type Number
             * @name y
             * @memberOf me.TMXObject
             */
            this.y = +tmxObj.y;

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
            this.width = +tmxObj.width || 0;

            /**
             * object height
             * @public
             * @type Number
             * @name height
             * @memberOf me.TMXObject
             */
            this.height = +tmxObj.height || 0;

            /**
             * object gid value
             * when defined the object is a tiled object
             * @public
             * @type Number
             * @name gid
             * @memberOf me.TMXObject
             */
            this.gid = +tmxObj.gid || null;

            /**
             * object type
             * @public
             * @type String
             * @name type
             * @memberOf me.TMXObject
             */
            this.type = tmxObj.type;

            /**
             * The rotation of the object in radians clockwise (defaults to 0)
             * @public
             * @type Number
             * @name rotation
             * @memberOf me.TMXObject
             */
            this.rotation = Number.prototype.degToRad(+tmxObj.rotation || 0);

            /**
             * object unique identifier per level (Tiled 0.11.x+)
             * @public
             * @type Number
             * @name id
             * @memberOf me.TMXObject
             */
            this.id = +tmxObj.id || undefined;

            /**
             * object orientation (orthogonal or isometric)
             * @public
             * @type String
             * @name orientation
             * @memberOf me.TMXObject
             */
            this.orientation = map.orientation;

            /**
             * the collision shapes defined for this object
             * @public
             * @type Array
             * @name shapes
             * @memberOf me.TMXObject
             */
            this.shapes = undefined;

            /**
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
                this.setTile(map.tilesets);
            }
            else {
                if (typeof(tmxObj.ellipse) !== "undefined") {
                    this.isEllipse = true;
                }
                else {
                    var points = tmxObj.polygon;
                    if (typeof(points) !== "undefined") {
                        this.isPolygon = true;
                    }
                    else {
                        points = tmxObj.polyline;
                        if (typeof(points) !== "undefined") {
                            this.isPolyLine = true;
                        }
                    }
                    if (typeof(points) !== "undefined") {
                        this.points = [];
                        var self = this;
                        points.forEach(function (point) {
                            self.points.push(new me.Vector2d(point.x, point.y));
                        });
                    }
                }
            }

            // Adjust the Position to match Tiled
            map.getRenderer().adjustPosition(this);

            // set the object properties
            me.TMXUtils.applyTMXProperties(this, tmxObj);

            // define the object shapes if required
            if (!this.shapes) {
                this.shapes = this.parseTMXShapes();
            }
        },

        /**
         * set the object image (for Tiled Object)
         * @ignore
         * @function
         */
        setTile : function (tilesets) {
            // get the corresponding tileset
            var tileset = tilesets.getTilesetByGid(this.gid);

            // set width and height equal to tile size
            this.width = this.framewidth = tileset.tilewidth;
            this.height = this.frameheight = tileset.tileheight;

            // the object corresponding tile object
            this.tile = new me.Tile(this.x, this.y, this.gid, tileset);
        },

        /**
         * parses the TMX shape definition and returns a corresponding array of me.Shape object
         * @name parseTMXShapes
         * @memberOf me.TMXObject
         * @private
         * @function
         * @return {me.Polygon[]|me.Line[]|me.Ellipse[]} an array of shape objects
         */
        parseTMXShapes : function () {
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
                    shapes[i].toIso();
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
})();
