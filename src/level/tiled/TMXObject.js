(function () {

    /**
     * a TMX Object defintion, as defined in Tiled. <br>
     * note : object definition are translated into the virtual `me.game.world` using `me.Entity`.
     * @see me.Entity
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     */
    me.TMXObject = me.Object.extend({
        /**
         * @ignore
         */
        init :  function (map, settings, z) {

            /**
             * point list in JSON format
             * @public
             * @type Object[]
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
            this.name = settings.name;

            /**
             * object x position
             * @public
             * @type Number
             * @name x
             * @memberOf me.TMXObject
             */
            this.x = +settings.x;

            /**
             * object y position
             * @public
             * @type Number
             * @name y
             * @memberOf me.TMXObject
             */
            this.y = +settings.y;

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
            this.width = +settings.width || 0;

            /**
             * object height
             * @public
             * @type Number
             * @name height
             * @memberOf me.TMXObject
             */
            this.height = +settings.height || 0;

            /**
             * object gid value
             * when defined the object is a tiled object
             * @public
             * @type Number
             * @name gid
             * @memberOf me.TMXObject
             */
            this.gid = +settings.gid || null;

            /**
             * object type
             * @public
             * @type String
             * @name type
             * @memberOf me.TMXObject
             */
            this.type = settings.type;

            /**
             * object text
             * @public
             * @type Object
             * @see http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text
             * @name type
             * @memberOf me.TMXObject
             */
            this.type = settings.type;

            /**
             * The rotation of the object in radians clockwise (defaults to 0)
             * @public
             * @type Number
             * @name rotation
             * @memberOf me.TMXObject
             */
            this.rotation = me.Math.degToRad(+settings.rotation || 0);

            /**
             * object unique identifier per level (Tiled 0.11.x+)
             * @public
             * @type Number
             * @name id
             * @memberOf me.TMXObject
             */
            this.id = +settings.id || undefined;

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
                if (typeof(settings.ellipse) !== "undefined") {
                    this.isEllipse = true;
                } else if (typeof(settings.polygon) !== "undefined") {
                    this.points = settings.polygon;
                    this.isPolygon = true;
                } else if (typeof(settings.polyline) !== "undefined") {
                    this.points = settings.polyline;
                    this.isPolyLine = true;
                }
            }



            // check for text information
            if (typeof settings.text !== "undefined") {
                // a text object
                this.text = settings.text;
                // normalize field name and default value the melonjs way
                this.text.font = settings.text.fontfamily || "sans-serif";
                this.text.size = settings.text.pixelsize || 16;
                this.text.fillStyle = settings.text.color || "#000000";
                this.text.textAlign = settings.text.halign || "left";
                this.text.textBaseline = settings.text.valign || "top";
                this.text.width = this.width;
                this.text.height = this.height;
                // set the object properties
                me.TMXUtils.applyTMXProperties(this.text, settings);
            } else {
                // set the object properties
                me.TMXUtils.applyTMXProperties(this, settings);
                // a standard object
                if (!this.shapes) {
                    // else define the object shapes if required
                    this.shapes = this.parseTMXShapes();
                }
            }

            // Adjust the Position to match Tiled
            if (!map.isEditor) {
                map.getRenderer().adjustPosition(this);
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

            if (tileset.isCollection === false) {
                // set width and height equal to tile size
                this.width = this.framewidth = tileset.tilewidth;
                this.height = this.frameheight = tileset.tileheight;
            }

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
                    p1 = new me.Vector2d(p[i].x, p[i].y);
                    p2 = new me.Vector2d(p[i + 1].x, p[i + 1].y);
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
