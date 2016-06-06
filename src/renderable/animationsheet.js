/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * an object to manage animation
     * @class
     * @extends me.Sprite
     * @memberOf me
     * @constructor
     * @param {Number} x the x coordinates of the sprite object
     * @param {Number} y the y coordinates of the sprite object
     * @param {Object} settings Contains additional parameters for the animation sheet
     * @param {me.video.renderer.Texture|Image|String} settings.image reference to a spritesheet image or to a texture atlas
     * @param {Number} [settings.framewidth] Width of a single frame within the spritesheet
     * @param {Number} [settings.frameheight] Height of a single frame within the spritesheet
     * @param {me.Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
     * @example
     * // standalone image, with anchor in the center
     * var animationSheet = new me.AnimationSheet(0, 0, {
     *     image : "animationsheet",
     *     framewidth : 64,
     *     frameheight : 64,
     *     anchorPoint : new me.Vector2d(0.5, 0.5)
     * });
     */
    me.AnimationSheet = me.Sprite.extend(
    /** @scope me.AnimationSheet.prototype */
    {
        /** @ignore */
        init : function (x, y, settings) {

            /**
             * pause and resume animation<br>
             * default value : false;
             * @public
             * @type Boolean
             * @name me.AnimationSheet#animationpause
             */
            this.animationpause = false;

            /**
             * animation cycling speed (delay between frame in ms)<br>
             * default value : 100ms;
             * @public
             * @type Number
             * @name me.AnimationSheet#animationspeed
             */
            this.animationspeed = 100;

            // hold all defined animation
            this.anim = {};

            // a flag to reset animation
            this.resetAnim = null;

            // default animation sequence
            this.current = null;

            // animation frame delta
            this.dt = 0;

            // default animation speed (ms)
            this.animationspeed = 100;

            // call the constructor
            this._super(me.Sprite, "init", [ x, y, settings ]);

            // store/reset the current atlas information if specified
            if (typeof(settings.atlas) !== "undefined") {
                this.textureAtlas = settings.atlas;
                this.atlasIndices = settings.atlasIndices;
            } else {
                // set the texture Atlas object from the given texture
                if (settings.image instanceof me.CanvasRenderer.prototype.Texture) {
                    this.textureAtlas = settings.image;
                } else {
                    // "regular" spritesheet
                    this.textureAtlas = me.video.renderer.cache.get(
                        me.utils.getImage(settings.image),
                        settings
                    ).getAtlas();
                }
                this.atlasIndices = null;
            }

            // create a default animation sequence with all sprites
            this.addAnimation("default", null);

            // set as default
            this.setCurrentAnimation("default");
        },

        /**
         * add an animation <br>
         * For fixed-sized cell sprite sheet, the index list must follow the
         * logic as per the following example :<br>
         * <img src="images/spritesheet_grid.png"/>
         * @name addAnimation
         * @memberOf me.AnimationSheet
         * @function
         * @param {String} name animation id
         * @param {Number[]|String[]|Object[]} index list of sprite index or name
         * defining the animation. Can also use objects to specify delay for each frame, see below
         * @param {Number} [animationspeed] cycling speed for animation in ms
         * (delay between each frame).
         * @see me.AnimationSheet#animationspeed
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

            if (index == null) {
                index = [];
                // create a default animation with all frame
                Object.keys(this.textureAtlas).forEach(function (v, i) {
                    index[i] = i;
                });
            }

            // # of frames
            var counter = 0;
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
        },

        /**
         * set the current animation
         * this will always change the animation & set the frame to zero
         * @name setCurrentAnimation
         * @memberOf me.AnimationSheet
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
         * @memberOf me.AnimationSheet
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
         * force the current animation frame index.
         * @name setAnimationFrame
         * @memberOf me.AnimationSheet
         * @function
         * @param {Number} [index=0] animation frame index
         * @example
         * // reset the current animation to the first frame
         * this.setAnimationFrame();
         */
        setAnimationFrame : function (idx) {
            this.current.idx = (idx || 0) % this.current.length;
            var frame = this.getAnimationFrameObjectByIndex(this.current.idx);
            this.offset = frame.offset;
            this.width = frame.width;
            this.height = frame.height;
            this._sourceAngle = frame.angle;
            if (frame.anchorPoint) {
                this.anchorPoint = frame.anchorPoint;
            }
        },

        /**
         * return the current animation frame index.
         * @name getCurrentAnimationFrame
         * @memberOf me.AnimationSheet
         * @function
         * @return {Number} current animation frame index
         */
        getCurrentAnimationFrame : function () {
            return this.current.idx;
        },

        /**
         * Returns the frame object by the index.
         * @name getAnimationFrameObjectByIndex
         * @memberOf me.AnimationSheet
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
         * @memberOf me.AnimationSheet
         * @function
         * @protected
         * @param {Number} dt time since the last update in milliseconds.
         */
        update : function (dt) {
            // Update animation if necessary
            if (this.animationpause || this.current.length <= 1) {
                return this._super(me.Sprite, "update", [ dt ]);
            }

            var duration = 0,
                result = false;

            this.dt += dt;
            duration = this.getAnimationFrameObjectByIndex(this.current.idx).delay;
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

            return this._super(me.Sprite, "update", [ dt ]) || result;
        }
    });
})();
