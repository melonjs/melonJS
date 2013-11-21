/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * A Simple object to display a sprite on screen.
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {Number} x the x coordinates of the sprite object
	 * @param {Number} y the y coordinates of the sprite object
	 * @param {Image} image reference to the Sprite Image. See {@link me.loader#getImage}
	 * @param {Number} [spritewidth] sprite width
	 * @param {Number} [spriteheigth] sprite height
	 * @example
	 * // create a static Sprite Object
	 * mySprite = new me.SpriteObject (100, 100, me.loader.getImage("mySpriteImage"));
	 */
	me.SpriteObject = me.Renderable.extend(
	/** @scope me.SpriteObject.prototype */
	{
		// default scale ratio of the object
		/** @ignore */
		scale	   : null,

		// if true, image flipping/scaling is needed
		scaleFlag : false,

		// just to keep track of when we flip
		lastflipX : false,
		lastflipY : false,

		// z position (for ordering display)
		z : 0,

		// image offset
		offset : null,

		/**
		 * Set the angle (in Radians) of a sprite to rotate it <br>
		 * WARNING: rotating sprites decreases performances
		 * @public
		 * @type Number
		 * @name me.SpriteObject#angle
		 */
		angle: 0,

		/**
		 * Source rotation angle for pre-rotating the source image<br>
		 * Commonly used for TexturePacker
		 * @ignore
		 */
		_sourceAngle: 0,
		
		// image reference
		image : null,

		// to manage the flickering effect
		flickering : false,
		flickerTimer : -1,
		flickercb : null,
		flickerState : false,


		/**
		 * @ignore
		 */
		init : function(x, y, image, spritewidth, spriteheight) {

			// Used by the game engine to adjust visibility as the
			// sprite moves in and out of the viewport
			this.isSprite = true;

			// call the parent constructor
			this.parent(new me.Vector2d(x, y),
						spritewidth  || image.width,
						spriteheight || image.height);
						
			// cache image reference
			this.image = image;

			// scale factor of the object
			this.scale = new me.Vector2d(1.0, 1.0);
			this.lastflipX = this.lastflipY = false;
			this.scaleFlag = false;

			// set the default sprite index & offset
			this.offset = new me.Vector2d(0, 0);		
			
			// make it visible by default
			this.visible = true;
			
			// non persistent per default
			this.isPersistent = false;
			
			// and not flickering
			this.flickering = false;
		},

		/**
		 * specify a transparent color
		 * @name setTransparency
		 * @memberOf me.SpriteObject
		 * @function
		 * @deprecated Use PNG or GIF with transparency instead
		 * @param {String} color color key in "#RRGGBB" format
		 */
		setTransparency : function(col) {
			// remove the # if present
			col = (col.charAt(0) === "#") ? col.substring(1, 7) : col;
			// applyRGB Filter (return a context object)
			this.image = me.video.applyRGBFilter(this.image, "transparent", col.toUpperCase()).canvas;
		},

		/**
		 * return the flickering state of the object
		 * @name isFlickering
		 * @memberOf me.SpriteObject
		 * @function
		 * @return {Boolean}
		 */
		isFlickering : function() {
			return this.flickering;
		},


		/**
		 * make the object flicker
		 * @name flicker
		 * @memberOf me.SpriteObject
		 * @function
		 * @param {Number} duration expressed in frames
		 * @param {Function} callback Function to call when flickering ends
		 * @example
		 * // make the object flicker for 60 frame
		 * // and then remove it
		 * this.flicker(60, function()
		 * {
		 *    me.game.remove(this);
		 * });
		 */
		flicker : function(duration, callback) {
			this.flickerTimer = duration;
			if (this.flickerTimer < 0) {
				this.flickering = false;
				this.flickercb = null;
			} else if (!this.flickering) {
				this.flickercb = callback;
				this.flickering = true;
			}
		},


		/**
		 * Flip object on horizontal axis
		 * @name flipX
		 * @memberOf me.SpriteObject
		 * @function
		 * @param {Boolean} flip enable/disable flip
		 */
		flipX : function(flip) {
			if (flip !== this.lastflipX) {
				this.lastflipX = flip;

				// invert the scale.x value
				this.scale.x = -this.scale.x;

				// set the scaleFlag
				this.scaleFlag = this.scale.x !== 1.0 || this.scale.y !== 1.0;
			}
		},

		/**
		 * Flip object on vertical axis
		 * @name flipY
		 * @memberOf me.SpriteObject
		 * @function
		 * @param {Boolean} flip enable/disable flip
		 */
		flipY : function(flip) {
			if (flip !== this.lastflipY) {
				this.lastflipY = flip;

				// invert the scale.x value
				this.scale.y = -this.scale.y;

				// set the scaleFlag
				this.scaleFlag = this.scale.x !== 1.0 || this.scale.y !== 1.0;
			}
		},

		/**
		 * Resize the sprite around his center<br>
		 * @name resize
		 * @memberOf me.SpriteObject
		 * @function
		 * @param {Number} ratio scaling ratio
		 */
		resize : function(ratio) {
			if (ratio > 0) {
				this.scale.x = this.scale.x < 0.0 ? -ratio : ratio;
				this.scale.y = this.scale.y < 0.0 ? -ratio : ratio;
				// set the scaleFlag
				this.scaleFlag = this.scale.x !== 1.0 || this.scale.y !== 1.0;
			}
		},


		/**
		 * sprite update<br>
		 * not to be called by the end user<br>
		 * called by the game manager on each game loop
		 * @name update
		 * @memberOf me.SpriteObject
		 * @function
		 * @protected
		 * @return false
		 **/
		update : function() {
			//update the "flickering" state if necessary
			if (this.flickering) {
				this.flickerTimer -= me.timer.tick;
				if (this.flickerTimer < 0) {
					if (this.flickercb)
						this.flickercb();
					this.flicker(-1);
				}
				return true;
			}
			return false;
		},

		/**
		 * object draw<br>
		 * not to be called by the end user<br>
		 * called by the game manager on each game loop
		 * @name draw
		 * @memberOf me.SpriteObject
		 * @function
		 * @protected
		 * @param {Context2d} context 2d Context on which draw our object
		 **/
		draw : function(context) {

			// do nothing if we are flickering
			if (this.flickering) {
				this.flickerState = !this.flickerState;
				if (!this.flickerState) return;
			}

			// save the current the context
			context.save();
			
			// sprite alpha value
			context.globalAlpha *= this.getOpacity();
            
			// clamp position vector to pixel grid
			var xpos = ~~this.pos.x, ypos = ~~this.pos.y;

			var w = this.width, h = this.height;
			var angle = this.angle + this._sourceAngle;

			if ((this.scaleFlag) || (angle!==0)) {
				// calculate pixel pos of the anchor point
				var ax = w * this.anchorPoint.x, ay = h * this.anchorPoint.y;
				// translate to the defined anchor point
				context.translate(xpos + ax, ypos + ay);
				// scale
				if (this.scaleFlag)
					context.scale(this.scale.x, this.scale.y);
				if (angle!==0)
					context.rotate(angle);

				if (this._sourceAngle!==0) {
					// swap w and h for rotated source images
					w = this.height;
					h = this.width;
					
					xpos = -ay;
					ypos = -ax;
				}
				else {
					// reset coordinates back to upper left coordinates
					xpos = -ax;
					ypos = -ay;
				}
			}

			context.drawImage(this.image,
							this.offset.x, this.offset.y,
							w, h,
							xpos, ypos,
							w, h);

			
			// restore the context
			context.restore();
		},

		/**
		 * Destroy function<br>
		 * @ignore
		 */
		destroy : function() {
			this.onDestroyEvent.apply(this, arguments);
		},

		/**
		 * OnDestroy Notification function<br>
		 * Called by engine before deleting the object
		 * @name onDestroyEvent
		 * @memberOf me.SpriteObject
		 * @function
		 */
		onDestroyEvent : function() {
			// to be extended !
		}

	});
	

	/**
	 * an object to manage animation
	 * @class
	 * @extends me.SpriteObject
	 * @memberOf me
	 * @constructor
	 * @param {Number} x the x coordinates of the sprite object
	 * @param {Number} y the y coordinates of the sprite object
	 * @param {Image} image reference of the animation sheet
	 * @param {Number} spritewidth width of a single sprite within the spritesheet
	 * @param {Number} [spriteheight=image.height] height of a single sprite within the spritesheet
	 */
	me.AnimationSheet = me.SpriteObject.extend(
	/** @scope me.AnimationSheet.prototype */
	{		
		// Spacing and margin
		/** @ignore */
		spacing: 0,
		/** @ignore */
		margin: 0,

		/**
		 * pause and resume animation<br>
		 * default value : false;
		 * @public
		 * @type Boolean
		 * @name me.AnimationSheet#animationpause
		 */
		animationpause : false,

		/**
		 * animation cycling speed (delay between frame in ms)<br>
		 * default value : 100ms;
		 * @public
		 * @type Number
		 * @name me.AnimationSheet#animationspeed
		 */
		animationspeed : 100,

		/** @ignore */
		init : function(x, y, image, spritewidth, spriteheight, spacing, margin, atlas, atlasIndices) {
			// hold all defined animation
			this.anim = {};

			// a flag to reset animation
			this.resetAnim = null;

			// default animation sequence
			this.current = null;
						
			// default animation speed (ms)
			this.animationspeed = 100;

			// Spacing and margin
			this.spacing = spacing || 0;
			this.margin = margin || 0;

			// call the constructor
			this.parent(x, y, image, spritewidth, spriteheight, spacing, margin);
						
			// store the current atlas information
			this.textureAtlas = null;
			this.atlasIndices = null;
			
			// build the local textureAtlas
			this.buildLocalAtlas(atlas || undefined, atlasIndices || undefined);
			
			// create a default animation sequence with all sprites
			this.addAnimation("default", null);
			
			// set as default
			this.setCurrentAnimation("default");
		},
		
		/**
		 * build the local (private) atlas
		 * @ignore
		 */
		buildLocalAtlas : function (atlas, indices) {
			// reinitialze the atlas
			if (atlas !== undefined) {
				this.textureAtlas = atlas;
				this.atlasIndices = indices;
			} else {
				// regular spritesheet
				this.textureAtlas = [];
				// calculate the sprite count (line, col)
				var spritecount = new me.Vector2d(
					~~((this.image.width - this.margin) / (this.width + this.spacing)),
					~~((this.image.height - this.margin) / (this.height + this.spacing))
				);

				// build the local atlas
				for ( var frame = 0, count = spritecount.x * spritecount.y; frame < count ; frame++) {
					this.textureAtlas[frame] = {
						name: ''+frame,
						offset: new me.Vector2d(
							this.margin + (this.spacing + this.width) * (frame % spritecount.x),
							this.margin + (this.spacing + this.height) * ~~(frame / spritecount.x)
						),
						width: this.width,
						height: this.height,
						hWidth: this.width / 2,
						hHeight: this.height / 2,
						angle: 0
					};
				}
			}
		},

		/**
		 * add an animation <br>
		 * For fixed-sized cell sprite sheet, the index list must follow the logic as per the following example :<br>
		 * <img src="images/spritesheet_grid.png"/>
		 * @name addAnimation
		 * @memberOf me.AnimationSheet
		 * @function
		 * @param {String} name animation id
		 * @param {Number[]|String[]} index list of sprite index or name defining the animation
		 * @param {Number} [animationspeed] cycling speed for animation in ms (delay between each frame).
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
		 */
		addAnimation : function(name, index, animationspeed) {
			this.anim[name] = {
				name : name,
				frame : [],
				idx : 0,
				length : 0,
				animationspeed: animationspeed || this.animationspeed,
				nextFrame : 0
			};
			

			if (index == null) {
				index = [];
				var j = 0;
				// create a default animation with all frame
				this.textureAtlas.forEach(function() {
					index[j] = j++;
				});
			}

			// set each frame configuration (offset, size, etc..)
			for ( var i = 0 , len = index.length ; i < len; i++) {
				if (typeof(index[i]) === "number") {
					this.anim[name].frame[i] = this.textureAtlas[index[i]];
				} else { // string
					if (this.atlasIndices === null) {
						throw "melonjs: string parameters for addAnimation are only allowed for TextureAtlas ";
					} else {
						this.anim[name].frame[i] = this.textureAtlas[this.atlasIndices[index[i]]];
					}
				}
			}
			this.anim[name].length = this.anim[name].frame.length;
		},
		
		/**
		 * set the current animation
		 * @name setCurrentAnimation
		 * @memberOf me.AnimationSheet
		 * @function
		 * @param {String} name animation id
		 * @param {String|Function} [onComplete] animation id to switch to when complete, or callback
		 * @example
		 * // set "walk" animation
		 * this.setCurrentAnimation("walk");
		 *
		 * // set "eat" animation, and switch to "walk" when complete
		 * this.setCurrentAnimation("eat", "walk");
		 *
		 * // set "die" animation, and remove the object when finished
		 * this.setCurrentAnimation("die", (function () {
		 *    me.game.remove(this);
		 *	  return false; // do not reset to first frame
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
		 *	  return false; // do not reset to first frame
		 * }).bind(this));
		 **/
		setCurrentAnimation : function(name, resetAnim) {
			if (this.anim[name]) {
				this.current = this.anim[name];
				this.resetAnim = resetAnim || null;
				this.setAnimationFrame(this.current.idx); // or 0 ?
				this.current.nextFrame = me.timer.getTime() + this.current.animationspeed;
			} else {
				throw "melonJS: animation id '" + name + "' not defined";
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
		 *    // do something funny...
		 * }
		 */
		isCurrentAnimation : function(name) {
			return this.current.name === name;
		},

		/**
		 * force the current animation frame index.
		 * @name setAnimationFrame
		 * @memberOf me.AnimationSheet
		 * @function
		 * @param {Number} [index=0] animation frame index
		 * @example
		 * //reset the current animation to the first frame
		 * this.setAnimationFrame();
		 */
		setAnimationFrame : function(idx) {
			this.current.idx = (idx || 0) % this.current.length;
			var frame = this.current.frame[this.current.idx];
			this.offset = frame.offset;
			this.width = frame.width;
			this.height = frame.height;
			this.hWidth = frame.hWidth;
			this.hHeight = frame.hHeight;
			this._sourceAngle = frame.angle;
		},
		
		/**
		 * return the current animation frame index.
		 * @name getCurrentAnimationFrame
		 * @memberOf me.AnimationSheet
		 * @function
		 * @return {Number} current animation frame index
		 */
		getCurrentAnimationFrame : function() {
			return this.current.idx;
		},

		/**
		 * update the animation<br>
		 * this is automatically called by the game manager {@link me.game}
		 * @name update
		 * @memberOf me.AnimationSheet
		 * @function
		 * @protected
		 */
		update : function() {
			// update animation if necessary
			if (!this.animationpause && (me.timer.getTime() >= this.current.nextFrame)) {
				this.setAnimationFrame(++this.current.idx);
				

				// switch animation if we reach the end of the strip
				// and a callback is defined
				if (this.current.idx === 0 && this.resetAnim)  {
					// if string, change to the corresponding animation
					if (typeof this.resetAnim === "string")
						this.setCurrentAnimation(this.resetAnim);
					// if function (callback) call it
					else if (typeof this.resetAnim === "function" && this.resetAnim() === false) {
						this.current.idx = this.current.length - 1;
						this.setAnimationFrame(this.current.idx);
						this.parent();
						return false;
					}
				}
				
				// set next frame timestamp
				this.current.nextFrame = me.timer.getTime() + this.current.animationspeed;

				return this.parent() || true;
			}
			return this.parent();
		}
	});


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
