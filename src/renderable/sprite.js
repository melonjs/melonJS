/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * An object to display a fixed or animated sprite on screen.
     * @class
     * @extends me.Sprite
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the sprite object
     * @param {Number} y the y coordinates of the sprite object
     * @param {Object} settings Contains additional parameters for the animation sheet
     * @param {me.video.renderer.Texture|Image|String} settings.image reference to a texture, spritesheet image or to a texture atlas
     * @param {Number} [settings.framewidth] Width of a single frame within the spritesheet
     * @param {Number} [settings.frameheight] Height of a single frame within the spritesheet
     * @param {me.Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
     * @example
     * // create a standalone sprite, with anchor in the center
     * var sprite = new me.Sprite(0, 0, {
     *     image : "PlayerTexture",
     *     framewidth : 64,
     *     frameheight : 64,
     *     anchorPoint : new me.Vector2d(0.5, 0.5)
     * });
     */
    me.Sprite = me.Renderable.extend(
    /** @scope .prototype */
    {
        /** @ignore */
        init : function (x, y, settings) {

            /**
             * pause and resume animation<br>
             * default value : false;
             * @public
             * @type Boolean
             * @name me.Sprite#animationpause
             */
            this.animationpause = false;

            /**
             * animation cycling speed (delay between frame in ms)<br>
             * default value : 100ms;
             * @public
             * @type Number
             * @name me.Sprite#animationspeed
             */
            this.animationspeed = 100;

            /**
             * global offset for the position to draw from on the source image.
             * @public
             * @type me.Vector2d
             * @name offset
             * @memberOf me.Sprite
             */
            this.offset = new me.Vector2d();

            // hold all defined animation
            this.anim = {};

            // a flag to reset animation
            this.resetAnim = null;

            // current frame information
            // (reusing current, any better/cleaner place?)
            this.current = {
                //current frame texture offset
                offset : new me.Vector2d(),
                // current frame size
                width : 0,
                height : 0,
                // Source rotation angle for pre-rotating the source image
                angle : 0
            };

            // animation frame delta
            this.dt = 0;

            // keep track of when we flip
            this._flip = {
                lastX : false,
                lastY : false
            };

            if (typeof (settings.flipX) !== "undefined") {
                this._flip.lastX(!!settings.flipX);
            }
            if (typeof (settings.flipY) !== "undefined") {
                this._flip.lastY(!!settings.flipY);
            }

            // flicker settings
            this._flicker = {
                isFlickering : false,
                duration : 0,
                callback : null,
                state : false
            };

            // Used by the game engine to adjust visibility as the
            // sprite moves in and out of the viewport
            this.isSprite = true;

            // set the proper image/texture to use
            if (settings.image instanceof me.CanvasRenderer.prototype.Texture) {
                // use the texture from the texture Atlas
                this.image = settings.image.getTexture();
                this.textureAtlas = settings.image;
                // check for defined region
                if (typeof (settings.region) !== "undefined") {
                    // use a texture atlas
                    var region = settings.image.getRegion(settings.region);
                    if (region) {
                        // set the sprite region within the texture
                        this.setRegion(region);
                        settings.framewidth = settings.framewidth || region.width;
                        settings.frameheight = settings.frameheight || region.height;
                    } else {
                        // throw an error
                        throw new me.Renderable.Error("Texture - region for " + settings.region + " not found");
                    }
                }
            } else {
               // standard image or spritesheet
               this.image = me.utils.getImage(settings.image);
               settings.framewidth = settings.framewidth || this.image.width;
               settings.frameheight = settings.frameheight || this.image.height;
               this.textureAtlas = me.video.renderer.cache.get(this.image, settings).getAtlas();
            }
            // update the default "current" size
            this.current.width = settings.framewidth;
            this.current.height = settings.frameheight;

            // store/reset the current atlas information if specified
            if (typeof(settings.atlas) !== "undefined") {
                this.textureAtlas = settings.atlas;
                this.atlasIndices = settings.atlasIndices;
            } else {
                this.atlasIndices = null;
            }

            // call the super constructor
            this._super(me.Renderable, "init", [
                x, y,
                this.current.width,
                this.current.height
            ]);

            // set the default rotation angle is defined in the settings
            // * WARNING: rotating sprites decreases performance with Canvas Renderer
            if (typeof (settings.rotation) !== "undefined") {
                this.currentTransform.rotate(settings.rotation);
            }

            // update anchorPoint
            if (settings.anchorPoint) {
                this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
            }

            // for sprite, addAnimation will return !=0
            if (this.addAnimation("default", null) !== 0) {
                // set as default
                this.setCurrentAnimation("default");
            }
        },

        /**
         * return the flickering state of the object
         * @name isFlickering
         * @memberOf me.Sprite
         * @function
         * @return {Boolean}
         */
        isFlickering : function () {
            return this._flicker.isFlickering;
        },

        /**
         * make the object flicker
         * @name flicker
         * @memberOf me.Sprite
         * @function
         * @param {Number} duration expressed in milliseconds
         * @param {Function} callback Function to call when flickering ends
         * @example
         * // make the object flicker for 1 second
         * // and then remove it
         * this.flicker(1000, function () {
         *     me.game.world.removeChild(this);
         * });
         */
        flicker : function (duration, callback) {
            this._flicker.duration = duration;
            if (this._flicker.duration <= 0) {
                this._flicker.isFlickering = false;
                this._flicker.callback = null;
            }
            else if (!this._flicker.isFlickering) {
                this._flicker.callback = callback;
                this._flicker.isFlickering = true;
            }
        },

        /**
         * Flip object on horizontal axis
         * @name flipX
         * @memberOf me.Sprite
         * @function
         * @param {Boolean} flip enable/disable flip
         */
        flipX : function (flip) {
            if (flip !== this._flip.lastX) {
                console.warn("Deprecated: me.Sprite.flipX");
                this._flip.lastX = flip;
                // invert the scale.x value
                this.currentTransform.scaleX(-1);
            }
        },

        /**
         * Flip object on vertical axis
         * @name flipY
         * @memberOf me.Sprite
         * @function
         * @param {Boolean} flip enable/disable flip
         */
        flipY : function (flip) {
            if (flip !== this._flip.lastY) {
                console.warn("Deprecated: me.Sprite.flipY");
                this._flip.lastY = flip;
                // invert the scale.x value
                this.currentTransform.scaleY(-1);
            }
        },

        /**
         * add an animation <br>
         * For fixed-sized cell sprite sheet, the index list must follow the
         * logic as per the following example :<br>
         * <img src="images/spritesheet_grid.png"/>
         * @name addAnimation
         * @memberOf me.Sprite
         * @function
         * @param {String} name animation id
         * @param {Number[]|String[]|Object[]} index list of sprite index or name
         * defining the animation. Can also use objects to specify delay for each frame, see below
         * @param {Number} [animationspeed] cycling speed for animation in ms
         * @return {Number} frame amount of frame added to the animation
         * (delay between each frame).
         * @see me.Sprite#animationspeed
         * @example
         * // walking animation
         * this.addAnimation("walk", [ 0, 1, 2, 3, 4, 5 ]);
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
         */
        addAnimation : function (name, index, animationspeed) {
            this.anim[name] = {
                name : name,
                frames : [],
                idx : 0,
                length : 0
            };

            // # of frames
            var counter = 0;

            if (typeof (this.textureAtlas) !== "object") {
                return 0;
            }


            if (index == null) {
                index = [];
                // create a default animation with all frame
                Object.keys(this.textureAtlas).forEach(function (v, i) {
                    index[i] = i;
                });
            }

            // set each frame configuration (offset, size, etc..)
            for (var i = 0, len = index.length; i < len; i++) {
                var frame = index[i];
                var frameObject;
                if (typeof(frame) === "number" || typeof(frame) === "string") {
                    frameObject = {
                        name: frame,
                        delay: animationspeed || this.animationspeed
                    };
                }
                else {
                  frameObject = frame;
                }
                var frameObjectName = frameObject.name;
                if (typeof(frameObjectName) === "number") {
                    if (typeof (this.textureAtlas[frameObjectName]) !== "undefined") {
                        // TODO: adding the cache source coordinates add undefined entries in webGL mode
                        this.anim[name].frames[i] = Object.assign(
                            {},
                            this.textureAtlas[frameObjectName],
                            frameObject
                        );
                        counter++;
                    }
                } else { // string
                    if (this.atlasIndices === null) {
                        throw new me.Renderable.Error(
                            "string parameters for addAnimation are not allowed for standard spritesheet based Texture"
                        );
                    } else {
                        this.anim[name].frames[i] = Object.assign(
                            {},
                            this.textureAtlas[this.atlasIndices[frameObjectName]],
                            frameObject
                        );
                        counter++;
                    }
                }
            }
            this.anim[name].length = counter;

            return counter;
        },

        /**
         * set the current animation
         * this will always change the animation & set the frame to zero
         * @name setCurrentAnimation
         * @memberOf me.Sprite
         * @function
         * @param {String} name animation id
         * @param {String|Function} [onComplete] animation id to switch to when
         * complete, or callback
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
         **/
        setCurrentAnimation : function (name, resetAnim, _preserve_dt) {
            if (this.anim[name]) {
                this.current = this.anim[name];
                this.resetAnim = resetAnim || null;
                this.setAnimationFrame(this.current.idx);
                // XXX this should not be overwritten
                this.current.name = name;
                if (!_preserve_dt) {
                    this.dt = 0;
                }
            } else {
                throw new me.Renderable.Error("animation id '" + name + "' not defined");
            }
        },

        /**
         * return true if the specified animation is the current one.
         * @name isCurrentAnimation
         * @memberOf me.Sprite
         * @function
         * @param {String} name animation id
         * @return {Boolean}
         * @example
         * if (!this.isCurrentAnimation("walk")) {
         *     // do something funny...
         * }
         */
        isCurrentAnimation : function (name) {
            return this.current.name === name;
        },

        /**
         * change the current texture atlas region for this sprite
         * @see me.Texture.getRegion
         * @name setRegion
         * @memberOf me.Sprite
         * @function
         * @param {Object} region typically returned through me.Texture.getRegion()
         * @example
         * // change the sprite to "shadedDark13.png";
         * mySprite.setRegion(game.texture.getRegion("shadedDark13.png"));
         */
        setRegion : function (region) {
            // set the sprite offset within the texture
            this.current.offset.setV(region.offset);
            // set angle if defined
            this.current.angle = region.angle;
            // update the default "current" size
            this.current.width = region.width;
            this.current.height = region.height;
        },

        /**
         * force the current animation frame index.
         * @name setAnimationFrame
         * @memberOf me.Sprite
         * @function
         * @param {Number} [index=0] animation frame index
         * @example
         * // reset the current animation to the first frame
         * this.setAnimationFrame();
         */
        setAnimationFrame : function (idx) {
            this.current.idx = (idx || 0) % this.current.length;
            // XXX this should not be overwritten
            var name = this.current.name;
            var frame = this.getAnimationFrameObjectByIndex(this.current.idx);
            // copy all properties of the current frame into current
            Object.assign(this.current, frame);
            // XXX this should not be overwritten
            this.current.name = name;
            // set global anchortPoint if defined
            if (frame.anchorPoint) {
                this.anchorPoint.setV(frame.anchorPoint);
            }
        },

        /**
         * return the current animation frame index.
         * @name getCurrentAnimationFrame
         * @memberOf me.Sprite
         * @function
         * @return {Number} current animation frame index
         */
        getCurrentAnimationFrame : function () {
            return this.current.idx;
        },

        /**
         * Returns the frame object by the index.
         * @name getAnimationFrameObjectByIndex
         * @memberOf me.Sprite
         * @function
         * @private
         * @return {Number} if using number indices. Returns {Object} containing frame data if using texture atlas
         */
        getAnimationFrameObjectByIndex : function (id) {
            return this.current.frames[id];
        },

        /**
         * update the animation<br>
         * this is automatically called by the game manager {@link me.game}
         * @name update
         * @memberOf me.Sprite
         * @function
         * @protected
         * @param {Number} dt time since the last update in milliseconds.
         */
        update : function (dt) {
            var result = false;
            // Update animation if necessary
            if (!this.animationpause && this.current && this.current.length > 1) {
                var duration = this.getAnimationFrameObjectByIndex(this.current.idx).delay;
                this.dt += dt;
                while (this.dt >= duration) {
                    result = true;
                    this.dt -= duration;
                    this.setAnimationFrame(this.current.idx + 1);

                    // Switch animation if we reach the end of the strip and a callback is defined
                    if (this.current.idx === 0 && this.resetAnim)  {
                        // If string, change to the corresponding animation
                        if (typeof this.resetAnim === "string") {
                            this.setCurrentAnimation(this.resetAnim, null, true);
                        }
                        // Otherwise is must be callable
                        else if (this.resetAnim() === false) {
                            // Reset to last frame
                            this.setAnimationFrame(this.current.length - 1);

                            // Bail early without skipping any more frames.
                            this.dt %= duration;
                            break;
                        }
                    }
                    // Get next frame duration
                    duration = this.getAnimationFrameObjectByIndex(this.current.idx).delay;
                }
            }

            //update the "flickering" state if necessary
            if (this._flicker.isFlickering) {
                this._flicker.duration -= dt;
                if (this._flicker.duration < 0) {
                    if (typeof (this._flicker.callback) === "function") {
                        this._flicker.callback();
                    }
                    this.flicker(-1);
                }
                result = true;
            }

            return result;
        },

        /**
         * object draw<br>
         * not to be called by the end user<br>
         * called by the game manager on each game loop
         * @name draw
         * @memberOf me.Sprite
         * @function
         * @protected
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
         **/
        draw : function (renderer) {
            // do nothing if we are flickering
            if (this._flicker.isFlickering) {
                this._flicker.state = !this._flicker.state;
                if (!this._flicker.state) {
                    return;
                }
            }

            // the frame to draw
            var frame = this.current;

            // cache the current position and size
            var xpos = this.pos.x,
                ypos = this.pos.y;

            var w = frame.width,
                h = frame.height;

            // frame offset in the texture/atlas
            var frame_offset = frame.offset;
            var g_offset = this.offset;

            // save context
            renderer.save();

            // sprite alpha value
            renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

            // apply the renderable transformation matrix
            if (!this.currentTransform.isIdentity()) {
                renderer.transform(this.currentTransform);
            }

            // translate to the defined anchor point
            renderer.translate(
                - ( w * this.anchorPoint.x ),
                - ( h * this.anchorPoint.y )
            );

            // remove image's TexturePacker/ShoeBox rotation
            if (frame.angle !== 0) {
                renderer.translate(-xpos, -ypos);
                renderer.rotate(frame.angle);
                xpos -= h;
                w = frame.height;
                h = frame.width;
            }

            renderer.drawImage(
                this.image,
                g_offset.x + frame_offset.x, // sx
                g_offset.y + frame_offset.y, // sy
                w, h,                        // sw,sh
                xpos, ypos,                  // dx,dy
                w, h                         // dw,dh
            );

            // restore context
            renderer.restore();
        }
    });

    // for backward compatiblity
    me.AnimationSheet = me.Sprite;
})();
