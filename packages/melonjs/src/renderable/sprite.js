import { game } from "../application/application.ts";
import { getImage } from "./../loader/loader.js";
import { Color } from "../math/color.ts";
import { vector2dPool } from "../math/vector2d.ts";
import { on } from "../system/event.ts";
import { TextureAtlas } from "./../video/texture/atlas.js";
import Texture2d from "./../video/texture/texture2d.ts";
import FrameAnimation from "./frameAnimation.js";
import Renderable from "./renderable.js";

// flicker interval in ms (~15 flashes per second)
const FLICKER_INTERVAL_MS = 33;

/**
 * additional import for TypeScript
 * @import {Vector2d} from "../math/vector2d.js";
 * @import Renderer from "./../video/renderer.js";
 */

/**
 * An object to display a fixed or animated sprite on screen.
 * @category Game Objects
 */
export default class Sprite extends Renderable {
	/**
	 * @param {number} x - the x coordinates of the sprite object
	 * @param {number} y - the y coordinates of the sprite object
	 * @param {object} settings - Configuration parameters for the Sprite object
	 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|Texture2d|TextureAtlas|CompressedImage|string} settings.image - reference to a spritesheet image, a {@link Texture2d} asset (e.g. a {@link TextureAtlas}), a video element, a compressed texture, or a loader key
	 * @param {string} [settings.name=""] - name of this object
	 * @param {string} [settings.region] - region name of a specific region to use when using a texture atlas, see {@link TextureAtlas}
	 * @param {number} [settings.framewidth] - Width of a single frame within the spritesheet
	 * @param {number} [settings.frameheight] - Height of a single frame within the spritesheet
	 * @param {string|Color} [settings.tint] - a tint to be applied to this sprite
	 * @param {number} [settings.flipX] - flip the sprite on the horizontal axis
	 * @param {number} [settings.flipY] - flip the sprite on the vertical axis
	 * @param {Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] - Anchor point to draw the frame at (defaults to the center of the frame).
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|Texture2d|string} [settings.normalMap] - optional normal-map texture used for per-pixel lighting (SpriteIlluminator-style). Same layout/UVs as `settings.image`. When omitted (default), the sprite renders unlit and pays no extra cost. Ignored by the Canvas renderer. Note: `HTMLVideoElement` is intentionally not supported — normal maps encode static surface directions in RGB, and the engine caches the GL texture per image reference (a video would freeze on frame 0).
	 * @example
	 * // create a single sprite from a standalone image, with anchor in the center
	 * let sprite = new me.Sprite(0, 0, {
	 *     image : "PlayerTexture",
	 *     framewidth : 64,
	 *     frameheight : 64,
	 *     anchorPoint : new me.Vector2d(0.5, 0.5)
	 * });
	 *
	 * // create a single sprite from a packed texture
	 * mytexture = new me.TextureAtlas(
	 *     me.loader.getJSON("texture"),
	 *     me.loader.getImage("texture")
	 * );
	 * let sprite = new me.Sprite(0, 0, {
	 *     image : mytexture,
	 *     region : "npc2.png",
	 * });
	 *
	 * // create a video sprite
	 * let videoSprite = new me.Sprite(0, 0, {
	 *     image : me.loader.getVideo("bigbunny"),
	 *     anchorPoint : new me.Vector2d(0.5, 0.5)
	 * });
	 * // scale the video sprite
	 * videoSprite.scale(2);
	 * // start playing the video (if video is preloaded with `autoplay` set to false)
	 * videoSprite.play();
	 */
	constructor(x, y, settings) {
		// call the super constructor
		super(x, y, 0, 0);

		// the shared frame-animation engine — owns this sprite's animation state
		// (exposed via the `anim` / `current` / `animationspeed` / `animationpause`
		// accessors below) and calls back into `_applyFrame` on each frame change.
		// Created up front, before the texture is resolved, so the setup code can
		// use the accessors.
		this._frameAnim = new FrameAnimation(this, (region) => {
			this._applyFrame(region);
		});

		/**
		 * global offset for the position to draw from on the source image.
		 * @type {Vector2d}
		 * @default <0.0,0.0>
		 */
		this.offset = vector2dPool.get(0, 0);

		/**
		 * true if this is a video sprite (e.g. a HTMLVideoElement was passed as as source)
		 * @type {boolean}
		 * @default false
		 */
		this.isVideo = false;

		/**
		 * a callback fired when the end of a video or current animation was reached
		 * @type {Function}
		 * @default undefined
		 */
		// this.onended;

		/**
		 * The source texture object this sprite object is using
		 * @type {TextureAtlas}
		 */
		this.source = null;

		/**
		 * backing field for the `normalMap` accessor — see the getter/setter
		 * defined on the class for the public API and validation rules.
		 * @ignore
		 */
		this._normalMap = null;

		/**
		 * flicker settings
		 * @ignore
		 */
		this._flicker = {
			isFlickering: false,
			duration: 0,
			callback: null,
			elapsed: 0,
		};

		// set the proper image/texture to use
		if (settings.image instanceof TextureAtlas) {
			this.source = settings.image;
			this.image = this.source.getTexture();
			this.textureAtlas = settings.image;
			// check for defined region
			if (typeof settings.region !== "undefined") {
				// use a texture atlas
				const region = this.source.getRegion(settings.region);
				if (region) {
					// set the sprite region within the texture
					this.setRegion(region);
				} else {
					// throw an error
					throw new Error(
						"Texture - region for " + settings.region + " not found",
					);
				}
			}
		} else {
			// a non-atlas Texture2d (e.g. a procedural NoiseTexture2d) resolves
			// to its baked canvas; an HTMLImageElement/HTMLVideoElement/canvas
			// flows through as-is; a {string} is resolved as a loader key.
			if (settings.image instanceof Texture2d) {
				this.image = settings.image.getTexture();
			} else if (typeof settings.image === "object") {
				this.image = settings.image;
			} else {
				this.image = getImage(settings.image);
			}
			// throw an error if image ends up being null/undefined
			if (!this.image) {
				throw new Error(
					"me.Sprite: '" + settings.image + "' image/texture not found!",
				);
			}

			this.isVideo =
				globalThis.HTMLVideoElement &&
				this.image instanceof globalThis.HTMLVideoElement;

			if (this.isVideo) {
				this.width =
					this.current.width =
					settings.framewidth =
						settings.framewidth || this.image.videoWidth;
				this.height =
					this.current.height =
					settings.frameheight =
						settings.frameheight || this.image.videoHeight;
				// video specific parameter
				this.animationpause = this.image.autoplay !== true;
				if (this.animationpause) {
					this.image.pause();
				}

				/**
				 * pause the video when losing focus
				 * @ignore
				 */
				this.removeStatePauseListener = on("statePause", () => {
					this.image.pause();
				});

				// call the onended when the video has ended
				this.image.onended = () => {
					if (typeof this.onended === "function") {
						// prevent the video from restarting if video.loop is false
						if (!this.image.loop) {
							this.animationpause = true;
						}
						this.onended();
					}
				};
			} else {
				// update the default "current" frame size
				this.width =
					this.current.width =
					settings.framewidth =
						settings.framewidth || this.image.width;
				this.height =
					this.current.height =
					settings.frameheight =
						settings.frameheight || this.image.height;
				this.source = game.renderer.cache.get(this.image, settings);
				this.textureAtlas = this.source.getAtlas();
			}
		}

		// resolve the optional normal-map paired with this sprite (used by
		// the WebGL renderer's lit pipeline; silently ignored by Canvas).
		// When the source is a TextureAtlas, prefer its paired normal-map
		// over an explicit `settings.normalMap` (the atlas drove the layout).
		if (
			settings.image instanceof TextureAtlas &&
			typeof settings.image.getNormalTexture === "function"
		) {
			const fromAtlas = settings.image.getNormalTexture();
			if (fromAtlas) {
				this.normalMap = fromAtlas;
			}
		}
		if (
			this.normalMap === null &&
			typeof settings.normalMap !== "undefined" &&
			settings.normalMap !== null
		) {
			// strings are loader keys — resolve through getImage first.
			// Anything else flows straight to the setter, which validates
			// image-like shape and throws TypeError for invalid types
			// (boolean, number, function, etc.).
			if (typeof settings.normalMap === "string") {
				const resolved = getImage(settings.normalMap);
				if (!resolved) {
					throw new Error(
						"me.Sprite: '" +
							settings.normalMap +
							"' normal map image not found!",
					);
				}
				this.normalMap = resolved;
			} else {
				this.normalMap = settings.normalMap;
			}
		}

		// store/reset the current atlas information if specified
		if (typeof settings.atlas !== "undefined") {
			this.textureAtlas = settings.atlas;
			this.atlasIndices = settings.atlasIndices;
		}

		// apply flip flags if specified
		if (typeof settings.flipX !== "undefined") {
			this.flipX(!!settings.flipX);
		}
		if (typeof settings.flipY !== "undefined") {
			this.flipY(!!settings.flipY);
		}

		// set the default rotation angle is defined in the settings
		// * WARNING: rotating sprites decreases performance with Canvas Renderer
		if (typeof settings.rotation !== "undefined") {
			this.rotate(settings.rotation);
		}

		// update anchorPoint
		if (settings.anchorPoint) {
			this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
		}

		if (typeof settings.tint !== "undefined") {
			if (settings.tint instanceof Color) {
				this.tint.copy(settings.tint);
			} else {
				// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
				this.tint.parseCSS(settings.tint);
			}
		}

		// set the sprite name if specified
		if (typeof settings.name === "string") {
			this.name = settings.name;
		}

		// displaying order
		if (typeof settings.z !== "undefined") {
			this.pos.z = settings.z;
		}

		// add predefined animations if defined (e.g. aseprite)
		if (typeof settings.anims !== "undefined") {
			for (const anim in settings.anims) {
				this.addAnimation(
					settings.anims[anim].name,
					settings.anims[anim].index,
					settings.anims[anim].speed,
				);
			}
		}

		// addAnimation will return 0 if no texture atlas is defined
		if (!this.isVideo && this.addAnimation("default", null) !== 0) {
			// set as default
			this.setCurrentAnimation("default");
		}
	}

	/**
	 * defined animations, keyed by id (see {@link Sprite#addAnimation}).
	 * @type {object}
	 */
	get anim() {
		return this._frameAnim.anim;
	}

	/**
	 * current frame information (name / index / texture offset & size / trim).
	 * @type {object}
	 */
	get current() {
		return this._frameAnim.current;
	}

	/**
	 * elapsed time within the current animation frame, in milliseconds.
	 * @type {number}
	 */
	get dt() {
		return this._frameAnim.dt;
	}
	set dt(value) {
		this._frameAnim.dt = value;
	}

	/**
	 * animation cycling speed (delay between frames in ms).
	 * @type {number}
	 * @default 100
	 */
	get animationspeed() {
		return this._frameAnim.animationspeed;
	}
	set animationspeed(value) {
		this._frameAnim.animationspeed = value;
	}

	/**
	 * pause the frame animation, freezing the current frame.
	 * @type {boolean}
	 * @default false
	 */
	get animationpause() {
		return this._frameAnim.animationpause;
	}
	set animationpause(value) {
		this._frameAnim.animationpause = value;
	}

	/**
	 * The optional normal-map image paired with this sprite's color
	 * texture (SpriteIlluminator workflow). When set, the WebGL
	 * renderer's lit pipeline samples this texture for per-pixel
	 * lighting using `Stage._activeLights`. `null` when unlit.
	 * Setting any non-image value (or anything without numeric
	 * `width`/`height`) throws — assign `null` to clear.
	 *
	 * Silently ignored by the Canvas renderer.
	 * @type {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null}
	 */
	get normalMap() {
		return this._normalMap;
	}
	set normalMap(value) {
		if (value === null || value === undefined) {
			this._normalMap = null;
			return;
		}
		// a Texture2d asset (e.g. a procedural NoiseTexture2d) resolves to its
		// baked canvas, so it can be assigned directly like the `image` slot.
		if (value instanceof Texture2d) {
			value = value.getTexture();
		}
		if (
			typeof value !== "object" ||
			typeof value.width !== "number" ||
			typeof value.height !== "number"
		) {
			throw new TypeError(
				"Sprite.normalMap must be null or an image-like object with numeric width/height " +
					"(HTMLImageElement, HTMLCanvasElement, OffscreenCanvas, ImageBitmap)",
			);
		}
		// Explicitly reject HTMLVideoElement — it duck-types past the
		// width/height check, but the lit pipeline caches the GL texture
		// per image reference and never re-uploads. A video as a normal
		// map would silently freeze on frame 0; better a loud TypeError
		// at assignment time than a confusing visual bug at runtime.
		if (typeof value.videoWidth === "number") {
			throw new TypeError(
				"Sprite.normalMap does not support HTMLVideoElement (the lit pipeline caches the texture per image reference and would freeze on frame 0)",
			);
		}
		this._normalMap = value;
	}

	/**
	 * return the flickering state of the object
	 * @returns {boolean}
	 */
	isFlickering() {
		return this._flicker.isFlickering;
	}

	/**
	 * Play an animation, or resume the current animation / video. A shorthand:
	 * call with an animation id to switch to (and start) it, or with no argument
	 * to resume after {@link Sprite#pause}. Always clears the paused state. The
	 * options mirror {@link Sprite#setCurrentAnimation} and the 3D
	 * {@link GLTFModel#play}, so 2D and 3D animation share one API.
	 * @param {string} [name] - animation id to play; omit to just resume
	 * @param {string|Function|object} [options] - loop / chain / completion behavior (see {@link Sprite#setCurrentAnimation})
	 * @returns {Sprite} Reference to this object for method chaining
	 * @example
	 * sprite.play("walk");                  // switch to + play "walk"
	 * sprite.play("die", { loop: false });  // play once, hold the last frame
	 * sprite.pause();
	 * sprite.play();                        // resume
	 */
	play(name, options) {
		this.animationpause = false;
		// `name` only applies to frame animations; a video sprite just resumes
		if (name !== undefined && !this.isVideo) {
			this.setCurrentAnimation(name, options);
		}
		return this;
	}

	/**
	 * Pause the current animation or video, freezing the current frame. Resume
	 * with {@link Sprite#play}.
	 * @returns {Sprite} Reference to this object for method chaining
	 */
	pause() {
		this.animationpause = true;
		return this;
	}

	/**
	 * Stop the current animation or video and reset it to the first frame
	 * (paused). (Use {@link Sprite#pause} instead to freeze in place.)
	 * @returns {Sprite} Reference to this object for method chaining
	 */
	stop() {
		this.animationpause = true;
		if (this.isVideo) {
			// clear the frame-anim timer/hold flags too (parity with the legacy
			// unconditional reset), then rewind the video
			this._frameAnim.resetTimer();
			this.image.pause();
			this.image.currentTime = 0;
		} else {
			// rewind the frame animation to its first frame
			this._frameAnim.rewind();
		}
		return this;
	}

	/**
	 * make the object flicker
	 * @param {number} duration - expressed in milliseconds
	 * @param {Function} [callback] - Function to call when flickering ends
	 * @returns {Sprite} Reference to this object for method chaining
	 * @example
	 * // make the object flicker for 1 second
	 * // and then remove it
	 * this.flicker(1000, function () {
	 *     world.removeChild(this);
	 * });
	 */
	flicker(duration, callback = undefined) {
		this._flicker.duration = duration;
		if (this._flicker.duration <= 0) {
			this._flicker.isFlickering = false;
			this._flicker.callback = undefined;
			this._flicker.elapsed = 0;
		} else {
			this._flicker.callback = callback;
			this._flicker.elapsed = 0;
			this._flicker.isFlickering = true;
		}
		return this;
	}

	/**
	 * add an animation <br>
	 * For fixed-sized cell sprite sheet, the index list must follow the
	 * logic as per the following example :<br>
	 * <img src="images/spritesheet_grid.png"/>
	 * @param {string} name - animation id
	 * @param {number[]|string[]|object[]} index - list of sprite index or name defining the animation. Can also use objects to specify delay for each frame, see below
	 * @param {number} [animationspeed] - cycling speed for animation in ms
	 * @returns {number} frame amount of frame added to the animation (delay between each frame).
	 * @see Sprite#animationspeed
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
	 * // define a dying animation that stop on the last frame
	 * this.addAnimation("die", [{ name: 3, delay: 200 }, { name: 4, delay: 100 }, { name: 5, delay: Infinity }])
	 * // set the standing animation as default
	 * this.setCurrentAnimation("stand");
	 */
	addAnimation(name, index, animationspeed) {
		return this._frameAnim.addAnimation(name, index, animationspeed);
	}

	/**
	 * set the current animation
	 * this will always change the animation & set the frame to zero
	 * @param {string} name - animation id
	 * @param {string|Function} [resetAnim] - animation id to switch to when complete, or callback
	 * @param {boolean} [preserve_dt=false] - if false will reset the elapsed time counter since last frame
	 * @returns {Sprite} Reference to this object for method chaining
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
	 * this.setCurrentAnimation("die", () => {
	 *    world.removeChild(this);
	 *    return false; // do not reset to first frame
	 * });
	 *
	 * // set "attack" animation, and pause for a short duration
	 * this.setCurrentAnimation("die", () => {
	 *    this.animationpause = true;
	 *
	 *    // back to "standing" animation after 1 second
	 *    setTimeout(function () {
	 *        this.setCurrentAnimation("standing");
	 *    }, 1000);
	 *
	 *    return false; // do not reset to first frame
	 * });
	 */
	setCurrentAnimation(name, resetAnim, preserve_dt = false) {
		this._frameAnim.setCurrentAnimation(name, resetAnim, preserve_dt);
		return this;
	}

	/**
	 * reverse the given or current animation if none is specified
	 * @param {string} [name] - animation id
	 * @returns {Sprite} Reference to this object for method chaining
	 * @see Sprite#animationspeed
	 */
	reverseAnimation(name) {
		this._frameAnim.reverseAnimation(name);
		// reversing doesn't re-apply a frame, so mark dirty here (the host owns
		// its dirty flag)
		this.isDirty = true;
		return this;
	}

	/**
	 * return true if the specified animation is the current one.
	 * @param {string} name - animation id
	 * @returns {boolean}
	 * @example
	 * if (!this.isCurrentAnimation("walk")) {
	 *     // do something funny...
	 * }
	 */
	isCurrentAnimation(name) {
		return this._frameAnim.isCurrentAnimation(name);
	}

	/**
	 * the names of every animation defined on this sprite (via
	 * {@link Sprite#addAnimation}).
	 * @returns {string[]} the defined animation names
	 * @example
	 * sprite.addAnimation("walk", [0, 1, 2, 3]);
	 * sprite.addAnimation("idle", [4, 5]);
	 * sprite.getAnimationNames(); // ["walk", "idle"]
	 */
	getAnimationNames() {
		return this._frameAnim.getAnimationNames();
	}

	/**
	 * change the current texture atlas region for this sprite
	 * @see Texture.getRegion
	 * @param {object} region - typically returned through me.Texture.getRegion()
	 * @returns {Sprite} Reference to this object for method chaining
	 * @example
	 * // change the sprite to "shadedDark13.png";
	 * mySprite.setRegion(mytexture.getRegion("shadedDark13.png"));
	 */
	setRegion(region) {
		this._frameAnim.setRegion(region);
		return this;
	}

	/**
	 * Apply the current frame's texture region to this sprite's geometry: swap
	 * the source sub-texture, then resolve size / anchor (honoring trimming).
	 * Invoked by the shared {@link FrameAnimation} engine via `setRegion`.
	 * @param {object} region - the texture region object
	 * @ignore
	 */
	_applyFrame(region) {
		// set the source texture for the given region
		this.image = this.source.getTexture(region);

		if (region.trimmed && region.sourceSize) {
			// use the original untrimmed size for stable bounds across trimmed frames
			this.width = region.sourceSize.w;
			this.height = region.sourceSize.h;
			// recover the original pivot relative to sourceSize for stable anchor
			if (region.anchorPoint) {
				const pivotX =
					(region.trim.x + region.width * region.anchorPoint.x) / this.width;
				const pivotY =
					(region.trim.y + region.height * region.anchorPoint.y) / this.height;
				this.anchorPoint.setMuted(
					this._flip.x ? 1 - pivotX : pivotX,
					this._flip.y ? 1 - pivotY : pivotY,
				);
			}
		} else {
			this.width = region.width;
			this.height = region.height;
			if (region.anchorPoint) {
				this.anchorPoint.setMuted(
					this._flip.x && region.trimmed === true
						? 1 - region.anchorPoint.x
						: region.anchorPoint.x,
					this._flip.y && region.trimmed === true
						? 1 - region.anchorPoint.y
						: region.anchorPoint.y,
				);
			}
		}

		// update the sprite bounding box
		this.updateBounds();
		// the frame changed → this sprite needs a redraw (the host owns its
		// dirty flag; the FrameAnimation engine never sets it)
		this.isDirty = true;
	}

	/**
	 * force the current animation frame index.
	 * @param {number} [index=0] - animation frame index
	 * @returns {Sprite} Reference to this object for method chaining
	 * @example
	 * // reset the current animation to the first frame
	 * this.setAnimationFrame();
	 */
	setAnimationFrame(index = 0) {
		this._frameAnim.setAnimationFrame(index);
		return this;
	}

	/**
	 * return the current animation frame index.
	 * @returns {number} current animation frame index
	 */
	getCurrentAnimationFrame() {
		return this._frameAnim.getCurrentAnimationFrame();
	}

	/**
	 * Returns the frame object by the index.
	 * @ignore
	 * @param {number} id - the frame id
	 * @returns {number} if using number indices. Returns {object} containing frame data if using texture atlas
	 */
	getAnimationFrameObjectByIndex(id) {
		return this._frameAnim.getAnimationFrameObjectByIndex(id);
	}

	/**
	 * update function. <br>
	 * automatically called by the game manager {@link game}
	 * @protected
	 * @param {number} dt - time since the last update in milliseconds.
	 * @returns {boolean} true if the Sprite is dirty
	 */
	update(dt) {
		// play/pause video if necessary
		if (this.isVideo) {
			if (this.animationpause) {
				this.image.pause();
			} else if (this.image.paused) {
				this.image.play();
			}
			this.isDirty = !this.image.paused;
		} else {
			// advance the shared frame-animation engine; a frame change marks this
			// sprite dirty via `_applyFrame` (the engine owns no dirty flag)
			this._frameAnim.update(dt);
		}

		//update the "flickering" state if necessary
		if (this._flicker.isFlickering) {
			this._flicker.elapsed += dt;
			if (this._flicker.elapsed >= this._flicker.duration) {
				if (typeof this._flicker.callback === "function") {
					this._flicker.callback();
				}
				this.flicker(-1);
			}
			this.isDirty = true;
		}

		// `isDirty` is the single source of truth — sub-updates above set it,
		// `Renderable.update` returns it
		return super.update(dt);
	}

	/**
	 * Prepare the rendering context before drawing this sprite (automatically called by melonJS).
	 * Extends `Renderable.preDraw` to publish this sprite's `normalMap` (if any)
	 * on the renderer so the WebGL lit pipeline can pair it with the next
	 * `drawImage` call. Cleared back in `postDraw`.
	 * @param {Renderer} renderer - a renderer instance
	 */
	preDraw(renderer) {
		super.preDraw(renderer);
		// Route through the renderer's normal-map state slot — kept off
		// the public `drawImage` signature so material features can be
		// added without disturbing the API. The WebGL batcher reads
		// `currentNormalMap` from the renderer; Canvas ignores it.
		if (this._normalMap !== null) {
			renderer.currentNormalMap = this._normalMap;
		}
	}

	/**
	 * restore the rendering context after drawing this sprite (automatically called by melonJS).
	 * @param {Renderer} renderer - a renderer instance
	 */
	postDraw(renderer) {
		// Clear the slot so a subsequent un-lit sprite isn't accidentally lit.
		if (this._normalMap !== null) {
			renderer.currentNormalMap = null;
		}
		super.postDraw(renderer);
	}

	/**
	 * draw this sprite (automatically called by melonJS)
	 * @param {Renderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer) {
		// do nothing if we are flickering (time-based, frame-rate independent)
		if (
			this._flicker.isFlickering &&
			Math.floor(this._flicker.elapsed / FLICKER_INTERVAL_MS) % 2 !== 0
		) {
			return;
		}

		// the frame to draw
		const frame = this.current;

		// cache the current position and size
		let xpos = this.pos.x;
		let ypos = this.pos.y;

		let w = frame.width;
		let h = frame.height;

		// frame offset in the texture/atlas
		const frame_offset = frame.offset;
		const g_offset = this.offset;

		// remove image's TexturePacker/ShoeBox rotation
		if (frame.angle !== 0) {
			renderer.translate(-xpos, -ypos);
			renderer.rotate(frame.angle);
			xpos -= h;
			w = frame.height;
			h = frame.width;
			// apply trim in rotated space: (tx, ty) → (-ty, tx) for -π/2
			if (frame.trim) {
				xpos -= frame.trim.y;
				ypos += frame.trim.x;
			}
		} else if (frame.trim) {
			// apply trim offset for non-rotated trimmed sprites
			xpos += frame.trim.x;
			ypos += frame.trim.y;
		}

		renderer.drawImage(
			this.image,
			g_offset.x + frame_offset.x, // sx
			g_offset.y + frame_offset.y, // sy
			w,
			h, // sw,sh
			xpos,
			ypos, // dx,dy
			w,
			h, // dw,dh
		);
	}

	/**
	 * Destroy function<br>
	 * @ignore
	 */
	destroy() {
		// release the engine's pooled `current.offset`
		this._frameAnim.destroy();
		vector2dPool.release(this.offset);
		this.offset = undefined;
		if (this.isVideo) {
			this.removeStatePauseListener();
			this.image.onended = undefined;
			this.image.pause();
			this.image.currentTime = 0;
		}
		this.image = undefined;
		// drop the normal-map reference too — same precedent as `image`,
		// avoids holding a (possibly large) paired image alive after the
		// sprite is gone
		this._normalMap = null;
		super.destroy();
	}
}
