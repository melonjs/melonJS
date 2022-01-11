import Vector2d from "./../math/vector2.js";
import { renderer } from "./../video/video.js";
import pool from "./../system/pooling.js";
import loader from "./../loader/loader.js";
import {Texture } from "./../video/texture.js";
import Renderable from "./renderable.js";


/**
 * @classdesc
 * An object to display a fixed or animated sprite on screen.
 * @class Sprite
 * @augments me.Renderable
 * @memberof me
 * @param {number} x the x coordinates of the sprite object
 * @param {number} y the y coordinates of the sprite object
 * @param {object} settings Configuration parameters for the Sprite object
 * @param {me.Renderer.Texture|HTMLImageElement|HTMLCanvasElement|string} settings.image reference to a texture, spritesheet image or to a texture atlas
 * @param {string} [settings.name=""] name of this object
 * @param {string} [settings.region] region name of a specific region to use when using a texture atlas, see {@link me.Renderer.Texture}
 * @param {number} [settings.framewidth] Width of a single frame within the spritesheet
 * @param {number} [settings.frameheight] Height of a single frame within the spritesheet
 * @param {string|me.Color} [settings.tint] a tint to be applied to this sprite
 * @param {number} [settings.flipX] flip the sprite on the horizontal axis
 * @param {number} [settings.flipY] flip the sprite on the vertical axis
 * @param {me.Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
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
 * game.texture = new me.video.renderer.Texture(
 *     me.loader.getJSON("texture"),
 *     me.loader.getImage("texture")
 * );
 * var sprite = new me.Sprite(0, 0, {
 *     image : game.texture,
 *     region : "npc2.png",
 * });
 */

class Sprite extends Renderable {

    /**
     * @ignore
     */
    constructor(x, y, settings) {

        // call the super constructor
        super(x, y, 0, 0);

        /**
         * pause and resume animation
         * @public
         * @type {boolean}
         * @default false
         * @name me.Sprite#animationpause
         */
        this.animationpause = false;

        /**
         * animation cycling speed (delay between frame in ms)
         * @public
         * @type {number}
         * @default 100
         * @name me.Sprite#animationspeed
         */
        this.animationspeed = 100;

        /**
         * global offset for the position to draw from on the source image.
         * @public
         * @type {me.Vector2d}
         * @default <0.0,0.0>
         * @name offset
         * @memberof me.Sprite#
         */
        this.offset = pool.pull("Vector2d", 0, 0);

        /**
         * The source texture object this sprite object is using
         * @public
         * @type {me.Renderer.Texture}
         * @name source
         * @memberof me.Sprite#
         */
        this.source = null;

        // hold all defined animation
        this.anim = {};

        // a flag to reset animation
        this.resetAnim = undefined;

        // current frame information
        // (reusing current, any better/cleaner place?)
        this.current = {
            // the current animation name
            name : "default",
            // length of the current animation name
            length : 0,
            //current frame texture offset
            offset : new Vector2d(),
            // current frame size
            width : 0,
            height : 0,
            // Source rotation angle for pre-rotating the source image
            angle : 0,
            // current frame index
            idx : 0
        };

        // animation frame delta
        this.dt = 0;

        // flicker settings
        this._flicker = {
            isFlickering : false,
            duration : 0,
            callback : null,
            state : false
        };

        // set the proper image/texture to use
        if (settings.image instanceof Texture) {
            this.source = settings.image;
            this.image = this.source.getTexture();
            this.textureAtlas = settings.image;
            // check for defined region
            if (typeof (settings.region) !== "undefined") {
                // use a texture atlas
                var region = this.source.getRegion(settings.region);
                if (region) {
                    // set the sprite region within the texture
                    this.setRegion(region);
                    // update the default "current" frame size
                    this.current.width = settings.framewidth || region.width;
                    this.current.height = settings.frameheight || region.height;
                } else {
                    // throw an error
                    throw new Error("Texture - region for " + settings.region + " not found");
                }
            }
        } else {
            // HTMLImageElement/Canvas or {string}
            this.image = (typeof settings.image === "object") ? settings.image : loader.getImage(settings.image);
            // throw an error if image ends up being null/undefined
            if (!this.image) {
                throw new Error("me.Sprite: '" + settings.image + "' image/texture not found!");
            }
            // update the default "current" frame size
            this.current.width = settings.framewidth = settings.framewidth || this.image.width;
            this.current.height = settings.frameheight = settings.frameheight || this.image.height;
            this.source = renderer.cache.get(this.image, settings);
            this.textureAtlas = this.source.getAtlas();
        }

        // store/reset the current atlas information if specified
        if (typeof(settings.atlas) !== "undefined") {
            this.textureAtlas = settings.atlas;
            this.atlasIndices = settings.atlasIndices;
        }

        // resize based on the active frame
        this.width = this.current.width;
        this.height = this.current.height;

        // apply flip flags if specified
        if (typeof (settings.flipX) !== "undefined") {
            this.flipX(!!settings.flipX);
        }
        if (typeof (settings.flipY) !== "undefined") {
            this.flipY(!!settings.flipY);
        }

        // set the default rotation angle is defined in the settings
        // * WARNING: rotating sprites decreases performance with Canvas Renderer
        if (typeof (settings.rotation) !== "undefined") {
            this.rotate(settings.rotation);
        }

        // update anchorPoint
        if (settings.anchorPoint) {
            this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
        }

        if (typeof (settings.tint) !== "undefined") {
            this.tint.setColor(settings.tint);
        }

        // set the sprite name if specified
        if (typeof (settings.name) === "string") {
            this.name = settings.name;
        }

        // displaying order
        if (typeof settings.z !== "undefined") {
            this.pos.z = settings.z;
        };

        // for sprite, addAnimation will return !=0
        if (this.addAnimation("default", null) !== 0) {
            // set as default
            this.setCurrentAnimation("default");
        }

        // enable currentTransform for me.Sprite based objects
        this.autoTransform = true;
    }

    /**
     * return the flickering state of the object
     * @name isFlickering
     * @memberof me.Sprite.prototype
     * @function
     * @returns {boolean}
     */
    isFlickering() {
        return this._flicker.isFlickering;
    }

    /**
     * make the object flicker
     * @name flicker
     * @memberof me.Sprite.prototype
     * @function
     * @param {number} duration expressed in milliseconds
     * @param {Function} callback Function to call when flickering ends
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // make the object flicker for 1 second
     * // and then remove it
     * this.flicker(1000, function () {
     *     me.game.world.removeChild(this);
     * });
     */
    flicker(duration, callback) {
        this._flicker.duration = duration;
        if (this._flicker.duration <= 0) {
            this._flicker.isFlickering = false;
            this._flicker.callback = null;
        }
        else if (!this._flicker.isFlickering) {
            this._flicker.callback = callback;
            this._flicker.isFlickering = true;
        }
        return this;
    }

    /**
     * add an animation <br>
     * For fixed-sized cell sprite sheet, the index list must follow the
     * logic as per the following example :<br>
     * <img src="images/spritesheet_grid.png"/>
     * @name addAnimation
     * @memberof me.Sprite.prototype
     * @function
     * @param {string} name animation id
     * @param {number[]|string[]|object[]} index list of sprite index or name
     * defining the animation. Can also use objects to specify delay for each frame, see below
     * @param {number} [animationspeed] cycling speed for animation in ms
     * @returns {number} frame amount of frame added to the animation (delay between each frame).
     * @see me.Sprite#animationspeed
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
    addAnimation(name, index, animationspeed) {
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
                if (this.source.getFormat().includes("Spritesheet")) {
                    throw new Error(
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
    }

    /**
     * set the current animation
     * this will always change the animation & set the frame to zero
     * @name setCurrentAnimation
     * @memberof me.Sprite.prototype
     * @function
     * @param {string} name animation id
     * @param {string|Function} [resetAnim] animation id to switch to when complete, or callback
     * @param {boolean} [preserve_dt=false] if false will reset the elapsed time counter since last frame
     * @returns {me.Sprite} Reference to this object for method chaining
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
    setCurrentAnimation(name, resetAnim, preserve_dt) {
        if (this.anim[name]) {
            this.current.name = name;
            this.current.length = this.anim[this.current.name].length;
            if (typeof resetAnim === "string") {
                this.resetAnim = this.setCurrentAnimation.bind(this, resetAnim, null, true);
            } else if (typeof resetAnim === "function") {
                this.resetAnim = resetAnim;
            } else {
                this.resetAnim = undefined;
            }
            this.setAnimationFrame(this.current.idx);
            if (!preserve_dt) {
                this.dt = 0;
            }
            this.isDirty = true;
        } else {
            throw new Error("animation id '" + name + "' not defined");
        }
        return this;
    }

    /**
     * reverse the given or current animation if none is specified
     * @name reverseAnimation
     * @memberof me.Sprite.prototype
     * @function
     * @param {string} [name] animation id
     * @returns {me.Sprite} Reference to this object for method chaining
     * @see me.Sprite#animationspeed
     */
    reverseAnimation(name) {
        if (typeof name !== "undefined" && typeof this.anim[name] !== "undefined") {
            this.anim[name].frames.reverse();
        } else {
            this.anim[this.current.name].frames.reverse();
        }
        this.isDirty = true;
        return this;
    }

    /**
     * return true if the specified animation is the current one.
     * @name isCurrentAnimation
     * @memberof me.Sprite.prototype
     * @function
     * @param {string} name animation id
     * @returns {boolean}
     * @example
     * if (!this.isCurrentAnimation("walk")) {
     *     // do something funny...
     * }
     */
    isCurrentAnimation(name) {
        return this.current.name === name;
    }

    /**
     * change the current texture atlas region for this sprite
     * @see me.Texture.getRegion
     * @name setRegion
     * @memberof me.Sprite.prototype
     * @function
     * @param {object} region typically returned through me.Texture.getRegion()
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // change the sprite to "shadedDark13.png";
     * mySprite.setRegion(game.texture.getRegion("shadedDark13.png"));
     */
    setRegion(region) {
        // set the source texture for the given region
        this.image = this.source.getTexture(region);
        // set the sprite offset within the texture
        this.current.offset.setV(region.offset);
        // set angle if defined
        this.current.angle = region.angle;
        // update the default "current" size
        this.width = this.current.width = region.width;
        this.height = this.current.height = region.height;
        // set global anchortPoint if defined
        if (region.anchorPoint) {
            this.anchorPoint.set(
                this._flip.x && region.trimmed === true ? 1 - region.anchorPoint.x : region.anchorPoint.x,
                this._flip.y && region.trimmed === true ? 1 - region.anchorPoint.y : region.anchorPoint.y
            );
        }
        this.isDirty = true;
        return this;
    }

    /**
     * force the current animation frame index.
     * @name setAnimationFrame
     * @memberof me.Sprite.prototype
     * @function
     * @param {number} [idx=0] animation frame index
     * @returns {me.Sprite} Reference to this object for method chaining
     * @example
     * // reset the current animation to the first frame
     * this.setAnimationFrame();
     */
    setAnimationFrame(idx) {
        this.current.idx = (idx || 0) % this.current.length;
        return this.setRegion(this.getAnimationFrameObjectByIndex(this.current.idx));
    }

    /**
     * return the current animation frame index.
     * @name getCurrentAnimationFrame
     * @memberof me.Sprite.prototype
     * @function
     * @returns {number} current animation frame index
     */
    getCurrentAnimationFrame() {
        return this.current.idx;
    }

    /**
     * Returns the frame object by the index.
     * @name getAnimationFrameObjectByIndex
     * @memberof me.Sprite.prototype
     * @function
     * @ignore
     * @param {number} id the frame id
     * @returns {number} if using number indices. Returns {object} containing frame data if using texture atlas
     */
    getAnimationFrameObjectByIndex(id) {
        return this.anim[this.current.name].frames[id];
    }

    /**
     * update function. <br>
     * automatically called by the game manager {@link me.game}
     * @name update
     * @memberof me.Sprite.prototype
     * @function
     * @protected
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean} true if the Sprite is dirty
     */
    update(dt) {
        // Update animation if necessary
        if (!this.animationpause && this.current && this.current.length > 0) {
            var duration = this.getAnimationFrameObjectByIndex(this.current.idx).delay;
            this.dt += dt;
            while (this.dt >= duration) {
                this.isDirty = true;
                this.dt -= duration;

                var nextFrame = (this.current.length > 1? this.current.idx+1: this.current.idx);
                this.setAnimationFrame(nextFrame);

                // Switch animation if we reach the end of the strip and a callback is defined
                if (this.current.idx === 0 && typeof this.resetAnim === "function") {
                    // Otherwise is must be callable
                    if (this.resetAnim() === false) {
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

        // update the sprite bounding box
        /*
        if (this.isDirty === true && !this.currentTransform.isIdentity()) {
            this.getBounds().clear();
            this.getBounds().addFrame(
                0,
                0,
                this.current.width,
                this.current.height,
                this.currentTransform
            );
            this.updateBoundsPos(this.pos.x, this.pos.y);
        }
        */

        //update the "flickering" state if necessary
        if (this._flicker.isFlickering) {
            this._flicker.duration -= dt;
            if (this._flicker.duration < 0) {
                if (typeof (this._flicker.callback) === "function") {
                    this._flicker.callback();
                }
                this.flicker(-1);
            }
            this.isDirty = true;
        }

        return this.isDirty;
    }

    /**
     * Destroy function<br>
     * @ignore
     */
    destroy() {
        pool.push(this.offset);
        this.offset = undefined;
        super.destroy();
    }

    /**
     * sprite draw. <br>
     * automatically called by the game manager {@link me.game}
     * @name draw
     * @memberof me.Sprite.prototype
     * @function
     * @protected
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    draw(renderer) {
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
    }
};

export default Sprite;
