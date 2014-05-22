/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function () {

    /**
     * me.ObjectSettings contains the object attributes defined in Tiled<br>
     * and is created by the engine and passed as parameter to the corresponding
     * object when loading a level<br>
     * the field marked Mandatory are to be defined either in Tiled, or in the
     * before calling the parent constructor<br>
     * <img src="images/object_properties.png"/><br>
     * @class
     * @protected
     * @memberOf me
     */
    me.ObjectSettings = {
        /**
         * object entity name<br>
         * as defined in the Tiled Object Properties
         * @public
         * @property {String} name
         * @memberOf me.ObjectSettings
         */
        name : null,

        /**
         * image ressource name to be loaded<br>
         * (in case of TiledObject, this field is automatically set)
         * @public
         * @property {String} image
         * @memberOf me.ObjectSettings
         */
        image : null,

        /**
         * specify a transparent color for the image in rgb format (#rrggbb)<br>
         * (using this option will imply processing time on the image)
         * @public
         * @deprecated Use PNG or GIF with transparency instead
         * @property {String=} transparent_color
         * @memberOf me.ObjectSettings
         */
        transparent_color : null,

        /**
         * width of a single sprite in the spritesheet<br>
         * (in case of TiledObject, this field is automatically set)
         * @public
         * @property {Number=} spritewidth
         * @memberOf me.ObjectSettings
         */
        spritewidth : null,

        /**
         * height of a single sprite in the spritesheet<br>
         * if not specified the value will be set to the corresponding image height<br>
         * (in case of TiledObject, this field is automatically set)
         * @public
         * @property {Number=} spriteheight
         * @memberOf me.ObjectSettings
         */
        spriteheight : null,

        /**
         * custom type for collision detection
         * @public
         * @property {String=} type
         * @memberOf me.ObjectSettings
         */
        type : 0,

        /**
         * Enable collision detection for this object<br>
         * @public
         * @property {Boolean=} collidable
         * @memberOf me.ObjectSettings
         */
        collidable : true
    };

    /*
     * A generic object entity
     */

    /**
     * a Generic Object Entity<br>
     * Object Properties (settings) are to be defined in Tiled, <br>
     * or when calling the parent constructor
     *
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the sprite object
     * @param {Number} y the y coordinates of the sprite object
     * @param {me.ObjectSettings} settings Object Properties as defined in Tiled<br>
     * <img src="images/object_properties.png"/>
     */
    me.ObjectEntity = me.Renderable.extend(
    /** @scope me.ObjectEntity.prototype */
    {
        /** @ignore */
        init : function (x, y, settings) {
            /**
             * define the type of the object<br>
             * default value : none<br>
             * @public
             * @type String
             * @name type
             * @memberOf me.ObjectEntity
             */
            this.type = 0;

            /**
             * flag to enable collision detection for this object<br>
             * default value : true<br>
             * @public
             * @type Boolean
             * @name collidable
             * @memberOf me.ObjectEntity
             */
            this.collidable = true;

            /**
             * The collision shapes of the entity <br>
             * (note: only shape at index 0 is used in melonJS 1.0.x)
             * @type {me.Rect[]|me.PolyShape[]|me.Ellipse[]}
             * @name shapes
             * @memberOf me.ObjectEntity
             */
            this.shapes = [];

            /**
             * The current shape index
             * @ignore
             * @type Number
             * @name shapeIndex
             * @memberOf me.ObjectEntity
             */
            this.shapeIndex = 0;

            /**
             * The entity renderable object (if defined)
             * @public
             * @type me.Renderable
             * @name renderable
             * @memberOf me.ObjectEntity
             */
            this.renderable = null;

            // just to keep track of when we flip
            this.lastflipX = false;
            this.lastflipY = false;
                        
            // ensure mandatory properties are defined
            if ((typeof settings.width !== "number") || (typeof settings.height !== "number")) {
                throw "melonjs: height and width properties are mandatory when passing settings parameters to an object entity";
            }
            
            // call the super constructor
            this.pos = new me.Vector2d(x, y);
            this._super(me.Renderable, "init", [this.pos,
                        settings.width,
                        settings.height]);

            if (settings.image) {
                var image = typeof settings.image === "object" ? settings.image : me.loader.getImage(settings.image);
                this.renderable = new me.AnimationSheet(0, 0, {
                    "image" : image,
                    "spritewidth" : ~~settings.spritewidth,
                    "spriteheight" : ~~settings.spriteheight,
                    "spacing" : ~~settings.spacing,
                    "margin" : ~~settings.margin
                });

                // check for user defined transparent color
                if (settings.transparent_color) {
                    this.renderable.setTransparency(settings.transparent_color);
                }
            }

            // set the object entity name
            this.name = settings.name ? settings.name.toLowerCase() : "";

            /**
             * entity current velocity<br>
             * @public
             * @type me.Vector2d
             * @name vel
             * @memberOf me.ObjectEntity
             */
            if (typeof(this.vel) === "undefined") {
                this.vel = new me.Vector2d();
            }
            this.vel.set(0, 0);

            /**
             * entity current acceleration<br>
             * @public
             * @type me.Vector2d
             * @name accel
             * @memberOf me.ObjectEntity
             */
            if (typeof(this.accel) === "undefined") {
                this.accel = new me.Vector2d();
            }
            this.accel.set(0, 0);

            /**
             * entity current friction<br>
             * @public
             * @name friction
             * @memberOf me.ObjectEntity
             */
            if (typeof(this.friction) === "undefined") {
                this.friction = new me.Vector2d();
            }
            this.friction.set(0, 0);

            /**
             * max velocity (to limit entity velocity)<br>
             * @public
             * @type me.Vector2d
             * @name maxVel
             * @memberOf me.ObjectEntity
             */
            if (typeof(this.maxVel) === "undefined") {
                this.maxVel = new me.Vector2d();
            }
            this.maxVel.set(1000, 1000);

            // some default contants
            /**
             * Default gravity value of the entity<br>
             * default value : 0.98 (earth gravity)<br>
             * to be set to 0 for RPG, shooter, etc...<br>
             * Note: Gravity can also globally be defined through me.sys.gravity
             * @public
             * @see me.sys.gravity
             * @type Number
             * @name gravity
             * @memberOf me.ObjectEntity
             */
            this.gravity = typeof(me.sys.gravity) !== "undefined" ? me.sys.gravity : 0.98;

            /**
             * dead/living state of the entity<br>
             * default value : true
             * @public
             * @type Boolean
             * @name alive
             * @memberOf me.ObjectEntity
             */
            this.alive = true;

            /**
             * falling state of the object<br>
             * true if the object is falling<br>
             * false if the object is standing on something<br>
             * @readonly
             * @public
             * @type Boolean
             * @name falling
             * @memberOf me.ObjectEntity
             */
            this.falling = false;

            /**
             * jumping state of the object<br>
             * equal true if the entity is jumping<br>
             * @readonly
             * @public
             * @type Boolean
             * @name jumping
             * @memberOf me.ObjectEntity
             */
            this.jumping = true;

            // some usefull slope variable
            this.slopeY = 0;

            /**
             * equal true if the entity is standing on a slope<br>
             * @readonly
             * @public
             * @type Boolean
             * @name onslope
             * @memberOf me.ObjectEntity
             */
            this.onslope = false;

            /**
             * equal true if the entity is on a ladder<br>
             * @readonly
             * @public
             * @type Boolean
             * @name onladder
             * @memberOf me.ObjectEntity
             */
            this.onladder = false;
            /**
             * equal true if the entity can go down on a ladder<br>
             * @readonly
             * @public
             * @type Boolean
             * @name disableTopLadderCollision
             * @memberOf me.ObjectEntity
             */
            this.disableTopLadderCollision = false;

            // to enable collision detection
            this.collidable = (
                typeof(settings.collidable) !== "undefined" ?
                settings.collidable : true
            );

            // default objec type
            this.type = settings.type || 0;

            // default flip value
            this.lastflipX = this.lastflipY = false;

            // ref to the collision map
            this.collisionMap = me.game.collisionMap;

            /**
             * Define if an entity can go through breakable tiles<br>
             * default value : false<br>
             * @public
             * @type Boolean
             * @name canBreakTile
             * @memberOf me.ObjectEntity
             */
            this.canBreakTile = false;

            /**
             * a callback when an entity break a tile<br>
             * @public
             * @callback
             * @name onTileBreak
             * @memberOf me.ObjectEntity
             */
            this.onTileBreak = null;

            if (typeof (settings.getShape) === "function") {
                // add the given collision shape to the object
                this.addShape(settings.getShape());

                // ---- TODO : fix this bug, as it should not matter!
                if (this.getShape().shapeType === "PolyShape") {
                    this._bounds = this.getBounds();
                    this.resize(this._bounds.width, this._bounds.height);
                }
                // ----
            }
        },

        /**
         * add a collision shape to this entity
         * @name addShape
         * @memberOf me.ObjectEntity
         * @public
         * @function
         * @param {me.Rect|me.PolyShape|me.Ellipse} shape a shape object
         */
        addShape : function (shape) {
            this.shapes.push(shape);
        },

        /**
         * return the current collision shape for this entity
         * @name getShape
         * @memberOf me.ObjectEntity
         * @public
         * @function
         * @return {me.Rect|me.PolyShape|me.Ellipse} shape a shape object
         */
        getShape : function () {
            return this.shapes[this.shapeIndex];
        },

        /**
         * change the current collision shape for this entity
         * @name setShape
         * @memberOf me.ObjectEntity
         * @public
         * @function
         * @param {Number} index shape index
         */
        setShape : function (index) {
            if (typeof(this.shapes[index]) !== "undefined") {
                this.shapeIndex = index;
                return;
            }
            throw "melonJS (me.Entity): Shape (" + index + ") not defined";
        },

        /**
         * onCollision Event function<br>
         * called by the game manager when the object collide with shtg<br>
         * by default, if the object type is Collectable, the destroy function
         * is called
         * @name onCollision
         * @memberOf me.ObjectEntity
         * @function
         * @param {me.Vector2d} res collision vector
         * @param {me.ObjectEntity} obj the other object that hit this object
         * @protected
         */
        onCollision : function () {
            // destroy the object if collectable
            if (this.collidable && (this.type === me.game.COLLECTABLE_OBJECT)) {
                me.game.world.removeChild(this);
            }
        },

        /**
         * set the entity default velocity<br>
         * note : velocity is by default limited to the same value, see
         * setMaxVelocity if needed<br>
         * @name setVelocity
         * @memberOf me.ObjectEntity
         * @function
         * @param {Number} x velocity on x axis
         * @param {Number} y velocity on y axis
         * @protected
         */

        setVelocity : function (x, y) {
            this.accel.x = x !== 0 ? x : this.accel.x;
            this.accel.y = y !== 0 ? y : this.accel.y;

            // limit by default to the same max value
            this.setMaxVelocity(x, y);
        },

        /**
         * cap the entity velocity to the specified value<br>
         * @name setMaxVelocity
         * @memberOf me.ObjectEntity
         * @function
         * @param {Number} x max velocity on x axis
         * @param {Number} y max velocity on y axis
         * @protected
         */
        setMaxVelocity : function (x, y) {
            this.maxVel.x = x;
            this.maxVel.y = y;
        },

        /**
         * set the entity default friction<br>
         * @name setFriction
         * @memberOf me.ObjectEntity
         * @function
         * @param {Number} x horizontal friction
         * @param {Number} y vertical friction
         * @protected
         */
        setFriction : function (x, y) {
            this.friction.x = x || 0;
            this.friction.y = y || 0;
        },

        /**
         * Flip object on horizontal axis
         * @name flipX
         * @memberOf me.ObjectEntity
         * @function
         * @param {Boolean} flip enable/disable flip
         */
        flipX : function (flip) {
            if (flip !== this.lastflipX) {
                this.lastflipX = flip;
                if (this.renderable && this.renderable.flipX) {
                    // flip the animation
                    this.renderable.flipX(flip);
                }
                // flip the collision box
                if (this.shapes.length && (typeof this.getShape().flipX === "function")) {
                    this.getShape().flipX(this.width);
                }
            }
        },

        /**
         * Flip object on vertical axis
         * @name flipY
         * @memberOf me.ObjectEntity
         * @function
         * @param {Boolean} flip enable/disable flip
         */
        flipY : function (flip) {
            if (flip !== this.lastflipY) {
                this.lastflipY = flip;
                if (this.renderable  && this.renderable.flipY) {
                    // flip the animation
                    this.renderable.flipY(flip);
                }
                // flip the collision box
                if (this.shapes.length && (typeof this.getShape().flipY === "function")) {
                    this.getShape().flipY(this.height);
                }
            }
        },

        /**
         * return the distance to the specified entity
         * @name distanceTo
         * @memberOf me.ObjectEntity
         * @function
         * @param {me.ObjectEntity} entity Entity
         * @return {Number} distance
         */
        distanceTo: function (e) {
            // the me.Vector2d object also implements the same function, but
            // we have to use here the center of both entities
            var dx = (this.pos.x + this.hWidth)  - (e.pos.x + e.hWidth);
            var dy = (this.pos.y + this.hHeight) - (e.pos.y + e.hHeight);
            return Math.sqrt(dx * dx + dy * dy);
        },

        /**
         * return the distance to the specified point
         * @name distanceToPoint
         * @memberOf me.ObjectEntity
         * @function
         * @param {me.Vector2d} vector vector
         * @return {Number} distance
         */
        distanceToPoint: function (v) {
            // the me.Vector2d object also implements the same function, but
            // we have to use here the center of both entities
            var dx = (this.pos.x + this.hWidth)  - (v.x);
            var dy = (this.pos.y + this.hHeight) - (v.y);
            return Math.sqrt(dx * dx + dy * dy);
        },

        /**
         * return the angle to the specified entity
         * @name angleTo
         * @memberOf me.ObjectEntity
         * @function
         * @param {me.ObjectEntity} entity Entity
         * @return {Number} angle in radians
         */
        angleTo: function (e) {
            // the me.Vector2d object also implements the same function, but
            // we have to use here the center of both entities
            var ax = (e.pos.x + e.hWidth) - (this.pos.x + this.hWidth);
            var ay = (e.pos.y + e.hHeight) - (this.pos.y + this.hHeight);
            return Math.atan2(ay, ax);
        },


        /**
         * return the angle to the specified point
         * @name angleToPoint
         * @memberOf me.ObjectEntity
         * @function
         * @param {me.Vector2d} vector vector
         * @return {Number} angle in radians
         */
        angleToPoint: function (v) {
            // the me.Vector2d object also implements the same function, but
            // we have to use here the center of both entities
            var ax = (v.x) - (this.pos.x + this.hWidth);
            var ay = (v.y) - (this.pos.y + this.hHeight);
            return Math.atan2(ay, ax);
        },


        /**
         * adjust the given rect to the given slope tile
         * @ignore
         */
        checkSlope : function (rect, tile, left) {

            // first make the object stick to the tile
            rect.pos.y = tile.pos.y - rect.height;

            // normally the check should be on the object center point,
            // but since the collision check is done on corner, we must do the
            // same thing here
            if (left) {
                this.slopeY = tile.height - (
                    rect.right + this.vel.x - tile.pos.x
                );
            }
            else {
                this.slopeY = (rect.left + this.vel.x - tile.pos.x);
            }

            // cancel y vel
            this.vel.y = 0;
            // set player position (+ workaround when entering/exiting slopes tile)
            rect.pos.y += this.slopeY.clamp(0, tile.height);

        },

        /**
         * compute the new velocity value
         * @ignore
         */
        computeVelocity : function (vel) {

            // apply gravity (if any)
            if (this.gravity) {
                // apply a constant gravity (if not on a ladder)
                vel.y += !this.onladder ? (this.gravity * me.timer.tick) : 0;

                // check if falling / jumping
                this.falling = (vel.y > 0);
                this.jumping = (this.falling ? false : this.jumping);
            }

            // apply friction
            if (this.friction.x) {
                vel.x = me.utils.applyFriction(vel.x, this.friction.x);
            }
            if (this.friction.y) {
                vel.y = me.utils.applyFriction(vel.y, this.friction.y);
            }

            // cap velocity
            if (vel.y !== 0) {
                vel.y = vel.y.clamp(-this.maxVel.y, this.maxVel.y);
            }
            if (vel.x !== 0) {
                vel.x = vel.x.clamp(-this.maxVel.x, this.maxVel.x);
            }
        },

        /**
         * handle the player movement, "trying" to update his position<br>
         * @name updateMovement
         * @memberOf me.ObjectEntity
         * @function
         * @return {me.Vector2d} a collision vector
         * @example
         * // make the player move
         * if (me.input.isKeyPressed('left'))
         * {
         *     this.vel.x -= this.accel.x * me.timer.tick;
         * }
         * else if (me.input.isKeyPressed('right'))
         * {
         *     this.vel.x += this.accel.x * me.timer.tick;
         * }
         * // update player position
         * var res = this.updateMovement();
         *
         * // check for collision result with the environment
         * if (res.x != 0)
         * {
         *   // x axis
         *   if (res.x<0)
         *      console.log("x axis : left side !");
         *   else
         *      console.log("x axis : right side !");
         * }
         * else if (res.y != 0)
         * {
         *    // y axis
         *    if (res.y<0)
         *       console.log("y axis : top side !");
         *    else
         *       console.log("y axis : bottom side !");
         *
         *    // display the tile type
         *    console.log(res.yprop.type)
         * }
         *
         * // check player status after collision check
         * var updated = (this.vel.x!=0 || this.vel.y!=0);
         */
        updateMovement : function () {
            this.computeVelocity(this.vel);

            // Adjust position only on collidable object
            var collision;
            if (this.collidable) {
                // temporary stuff until ticket #103 is done
                // (this function will disappear anyway)
                // save the collision box offset
                this._bounds = this.getBounds(this._bounds);
                this.__offsetX = this._bounds.pos.x;
                this.__offsetY = this._bounds.pos.y;
                this._bounds.translateV(this.pos);

                // check for collision
                collision = this.collisionMap.checkCollision(this._bounds, this.vel);

                // update some flags
                this.onslope  = collision.yprop.isSlope || collision.xprop.isSlope;
                // clear the ladder flag
                this.onladder = false;
                var prop = collision.yprop;
                var tile = collision.ytile;

                // y collision
                if (collision.y) {
                    // going down, collision with the floor
                    this.onladder = prop.isLadder || prop.isTopLadder;

                    if (collision.y > 0) {
                        if (prop.isSolid ||
                            (prop.isPlatform && (this._bounds.bottom - 1 <= tile.pos.y)) ||
                            (prop.isTopLadder && !this.disableTopLadderCollision)) {

                            // adjust position to the corresponding tile
                            this._bounds.pos.y = ~~this._bounds.pos.y;
                            this.vel.y = (
                                this.falling ?
                                tile.pos.y - this._bounds.bottom : 0
                            );
                            this.falling = false;
                        }
                        else if (prop.isSlope && !this.jumping) {
                            // we stop falling
                            this.checkSlope(
                                this._bounds,
                                tile,
                                prop.isLeftSlope
                            );
                            this.falling = false;
                        }
                        else if (prop.isBreakable) {
                            if  (this.canBreakTile) {
                                // remove the tile
                                me.game.currentLevel.clearTile(
                                    tile.col,
                                    tile.row
                                );
                                if (this.onTileBreak) {
                                    this.onTileBreak();
                                }
                            }
                            else {
                                // adjust position to the corresponding tile
                                this._bounds.pos.y = ~~this._bounds.pos.y;
                                this.vel.y = (
                                    this.falling ?
                                    tile.pos.y - this._bounds.bottom : 0
                                );
                                this.falling = false;
                            }
                        }
                    }
                    // going up, collision with ceiling
                    else if (collision.y < 0) {
                        if (!prop.isPlatform && !prop.isLadder && !prop.isTopLadder) {
                            if (this.gravity) {
                                this.falling = true;
                            }
                            // cancel the y velocity
                            this.vel.y = 0;
                        }
                    }
                }
                prop = collision.xprop;
                tile = collision.xtile;

                // x collision
                if (collision.x) {
                    this.onladder = prop.isLadder || prop.isTopLadder;

                    if (prop.isSlope && !this.jumping) {
                        this.checkSlope(this._bounds, tile, prop.isLeftSlope);
                        this.falling = false;
                    }
                    else {
                        // can walk through the platform & ladder
                        if (!prop.isPlatform && !prop.isLadder && !prop.isTopLadder) {
                            if (prop.isBreakable && this.canBreakTile) {
                                // remove the tile
                                me.game.currentLevel.clearTile(tile.col, tile.row);
                                if (this.onTileBreak) {
                                    this.onTileBreak();
                                }
                            } else {
                                this.vel.x = 0;
                            }
                        }
                    }
                }

                // temporary stuff until ticket #103 is done (this function will disappear anyway)
                this.pos.set(
                    this._bounds.pos.x - this.__offsetX,
                    this._bounds.pos.y - this.__offsetY
                );
            }

            // update player position
            this.pos.add(this.vel);

            // returns the collision "vector"
            return collision;

        },

        /** @ignore */
        update : function (dt) {
            if (this.renderable) {
                return this.renderable.update(dt);
            }
            return false;
        },

        /**
         * returns the bounding box for this entity, the smallest rectangle
         * object completely containing the entity current shape.
         * @name getBounds
         * @memberOf me.ObjectEntity
         * @function
         * @param {me.Rect} [rect] an optional rectangle object to use when
         * returning the bounding rect(else returns a new object)
         * @return {me.Rect} new rectangle
         */
        getBounds : function (rect) {
            if (!this.shapes.length) {
                // create one if there is no default shape
                this.addShape(this._super(me.Renderable, "getBounds", [rect]).translate(-this.pos.x, -this.pos.y));
            }
            return this.getShape().getBounds(rect);
        },

        /**
         * object draw<br>
         * not to be called by the end user<br>
         * called by the game manager on each game loop
         * @name draw
         * @memberOf me.ObjectEntity
         * @function
         * @protected
         * @param {Context2d} context 2d Context on which draw our object
         **/
        draw : function (context) {
            // draw the sprite if defined
            if (this.renderable) {
                // translate the renderable position (relative to the entity)
                // and keeps it in the entity defined bounds
                var bounds = this;
                if (this.shapes.length && this.getShape().shapeType === "PolyShape") {
                    // use the corresponding bounding box
                    bounds = this.getBounds(this._bounds).translateV(this.pos);
                }
                var x = ~~(bounds.pos.x + (
                    this.anchorPoint.x * (bounds.width - this.renderable.width)
                ));
                var y = ~~(bounds.pos.y + (
                    this.anchorPoint.y * (bounds.height - this.renderable.height)
                ));
                context.translate(x, y);
                this.renderable.draw(context);
                context.translate(-x, -y);
            }
        },

        /**
         * Destroy function<br>
         * @ignore
         */
        destroy : function () {
            // free some property objects
            if (this.renderable) {
                this.renderable.destroy.apply(this.renderable, arguments);
                this.renderable = null;
            }
            this.onDestroyEvent.apply(this, arguments);
            this.shapes = [];
            this.shapeIndex = 0;
        },

        /**
         * OnDestroy Notification function<br>
         * Called by engine before deleting the object
         * @name onDestroyEvent
         * @memberOf me.ObjectEntity
         * @function
         */
        onDestroyEvent : function () {
            // to be extended !
        }


    });

    /*
     * A Collectable entity
     */

    /**
     * @class
     * @extends me.ObjectEntity
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the sprite object
     * @param {Number} y the y coordinates of the sprite object
     * @param {me.ObjectSettings} settings object settings
     */
    me.CollectableEntity = me.ObjectEntity.extend(
    /** @scope me.CollectableEntity.prototype */
    {
        /** @ignore */
        init : function (x, y, settings) {
            // call the super constructor
            this._super(me.ObjectEntity, "init", [x, y, settings]);
            this.type = me.game.COLLECTABLE_OBJECT;
        }
    });

    /*
     * A level entity
     */

    /**
     * @class
     * @extends me.ObjectEntity
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the object
     * @param {Number} y the y coordinates of the object
     * @param {me.ObjectSettings} settings object settings
     * @example
     * me.game.world.addChild(new me.LevelEntity(
     *     x, y, {
     *         "duration" : 250, // Fade duration (in ms)
     *         "color" : "#000", // Fade color
     *         "to" : "mymap2"   // TMX level to load
     *     }
     * ));
     */
    me.LevelEntity = me.ObjectEntity.extend(
    /** @scope me.LevelEntity.prototype */
    {
        /** @ignore */
        init : function (x, y, settings) {
            this._super(me.ObjectEntity, "init", [x, y, settings]);

            this.nextlevel = settings.to;

            this.fade = settings.fade;
            this.duration = settings.duration;
            this.fading = false;

            // a temp variable
            this.gotolevel = settings.to;
        },

        /**
         * @ignore
         */
        onFadeComplete : function () {
            me.levelDirector.loadLevel(this.gotolevel);
            me.game.viewport.fadeOut(this.fade, this.duration);
        },

        /**
         * go to the specified level
         * @name goTo
         * @memberOf me.LevelEntity
         * @function
         * @param {String} [level=this.nextlevel] name of the level to load
         * @protected
         */
        goTo : function (level) {
            this.gotolevel = level || this.nextlevel;
            // load a level
            //console.log("going to : ", to);
            if (this.fade && this.duration) {
                if (!this.fading) {
                    this.fading = true;
                    me.game.viewport.fadeIn(this.fade, this.duration,
                            this.onFadeComplete.bind(this));
                }
            } else {
                me.levelDirector.loadLevel(this.gotolevel);
            }
        },

        /** @ignore */
        onCollision : function () {
            this.goTo();
        }
    });
})();
