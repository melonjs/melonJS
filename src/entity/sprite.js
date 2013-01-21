/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * A Simple object to display a sprite on screen.
	 * @class
	 * @extends me.Rect
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.loader#getImage} image reference to the Sprite Image
	 * @param {int} [spritewidth] sprite width
	 * @param {int} [spriteheigth] sprite height
	 * @example
	 * // create a static Sprite Object
	 * mySprite = new me.SpriteObject (100, 100, me.loader.getImage("mySpriteImage"));
	 */
	me.SpriteObject = me.Rect.extend(
	/** @scope me.SpriteObject.prototype */
	{
		// default scale ratio of the object
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
		 * the visible state of the object<br>
		 * default value : true
		 * @public
		 * @type Boolean
		 * @name me.SpriteObject#visible
		 */
		visible : true,

		/**
		 * Whether the object is visible and within the viewport<br>
		 * default value : false
		 * @public
		 * @readonly
		 * @type Boolean
		 * @name me.SpriteObject#inViewport
		 */
		inViewport : false,

		/**
		 * Set the angle (in Radians) of a sprite to rotate it <br>
		 * WARNING: rotating sprites decreases performances
		 * @public
		 * @type Number
		 * @name me.SpriteObject#angle
		 */
		angle: 0,

		/**
		 * Define the sprite anchor point<br>
		 * This is used when using rotation, or sprite flipping<br>
		 * with the default anchor point being the center of the sprite
		 * @public
		 * @type me.Vector2d
		 * @name me.SpriteObject#anchorPoint
		 */
		anchorPoint: null,
		
		/**
		 * Define the sprite opacity<br>
		 * @see me.SpriteObject#setOpacity
		 * @see me.SpriteObject#getOpacity 
		 * @public
		 * @type me.Vector2d
		 * @name me.SpriteObject#alpha
		 */
		alpha: 1.0,
		
		/**
		 * Define if a renderable follows screen coordinates (floating)<br>
		 * or the world coordinates (not floating)<br>
		 * default value : false
		 * @public
		 * @type Boolean
		 * @name me.SpriteObject#floating
		 */
		floating: false,

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
			this.lastflipX = this.lastflipY = false,
			this.scaleFlag = false;

			// set the default sprite index & offset
			this.offset = new me.Vector2d(0, 0);

			// set the default anchor point (middle of the sprite)
			this.anchorPoint = new me.Vector2d(0.5, 0.5);

			// ensure it's fully opaque by default
			this.alpha = 1.0;			
			
			// make it visible by default
			this.visible = true;
			
			// and not flickering
			this.flickering = false
		},

		/**
		 *	specify a transparent color
		 *	@param {String} color color key in rgb format (rrggbb or #rrggbb)
		 */
		setTransparency : function(col) {
			// remove the # if present
			col = (col.charAt(0) == "#") ? col.substring(1, 7) : col;
			// applyRGB Filter (return a context object)
			this.image = me.video.applyRGBFilter(this.image, "transparent", col.toUpperCase()).canvas;
		},

		/**
		 * return the flickering state of the object
		 * @return Boolean
		 */
		isFlickering : function() {
			return this.flickering;
		},


		/**
		 * make the object flicker
		 * @param {Int} duration
		 * @param {Function} callback
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
		 *	Flip object on horizontal axis
		 *	@param {Boolean} flip enable/disable flip
		 */
		flipX : function(flip) {
			if (flip != this.lastflipX) {
				this.lastflipX = flip;

				// invert the scale.x value
				this.scale.x = -this.scale.x;

				// set the scaleFlag
				this.scaleFlag = ((this.scale.x != 1.0) || (this.scale.y != 1.0))
			}
		},

		/**
		 *	Flip object on vertical axis
		 *	@param {Boolean} flip enable/disable flip
		 */
		flipY : function(flip) {
			if (flip != this.lastflipY) {
				this.lastflipY = flip;

				// invert the scale.x value
				this.scale.y = -this.scale.y;

				// set the scaleFlag
				this.scaleFlag = ((this.scale.x != 1.0) || (this.scale.y != 1.0))
			}
		},

		/**
		 *	Resize the sprite around his center<br>
		 *	@param {Boolean} ratio scaling ratio
		 */
		resize : function(ratio) {
			if (ratio > 0) {
				this.scale.x = this.scale.x < 0.0 ? -ratio : ratio;
				this.scale.y = this.scale.y < 0.0 ? -ratio : ratio;
				// set the scaleFlag
				this.scaleFlag = ((this.scale.x!= 1.0)  || (this.scale.y!= 1.0))
			}
		},

		/**
		 *	get the sprite alpha channel value<br>
		 *  @return current opacity value between 0 and 1
		 */
		getOpacity : function() {
			return this.alpha;
		},
		
		/**
		 *	set the sprite alpha channel value<br>
		 *	@param {alpha} alpha opacity value between 0 and 1
		 */
		setOpacity : function(alpha) {
			if (alpha) {
				this.alpha = alpha.clamp(0.0,1.0);
			}
		},

		/**
		 * sprite update<br>
		 * not to be called by the end user<br>
		 * called by the game manager on each game loop
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
			context.globalAlpha = this.alpha;

			// clamp position vector to pixel grid
			var xpos = ~~this.pos.x, ypos = ~~this.pos.y;
			
			if ((this.scaleFlag) || (this.angle!==0)) {
				// calculate pixel pos of the anchor point
				var ax = this.width * this.anchorPoint.x, ay = this.height * this.anchorPoint.y;
				// translate to the defined anchor point
				context.translate(xpos + ax, ypos + ay);
				// scale
				if (this.scaleFlag)
					context.scale(this.scale.x, this.scale.y);
				if (this.angle!==0)
					context.rotate(this.angle);
				// reset coordinates back to upper left coordinates
				xpos = -ax;
				ypos = -ay;
			}

			context.drawImage(this.image,
							this.offset.x, this.offset.y,
							this.width, this.height,
							xpos, ypos,
							this.width, this.height);

			
			// restore the context
			context.restore();
				
			if (me.debug.renderHitBox) {
				// draw the sprite rectangle
				this.parent(context, "blue");
			}
		},

		/**
		 * Destroy function<br>
		 * @private
		 */
		destroy : function() {
			this.onDestroyEvent.apply(this, arguments);
		},

		/**
		 * OnDestroy Notification function<br>
		 * Called by engine before deleting the object
		 */
		onDestroyEvent : function() {
			;// to be extended !
		}

	});
	

	/**
	 * an object to manage animation
	 * @class
	 * @extends me.SpriteObject
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.loader#getImage} Image reference of the animation sheet
	 * @param {int} spritewidth width of a single sprite within the spritesheet
	 * @param {int} [spriteheight] height of a single sprite within the spritesheet (value will be set to the image height if not specified)
	 */
	me.AnimationSheet = me.SpriteObject.extend(
	/** @scope me.AnimationSheet.prototype */
	{
		// count the fps and manage animation change
		fpscount : 0,
		
		// Spacing and margin
		spacing: 0,
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
		 * animation cycling speed<br>
		 * default value : me.sys.fps / 10;
		 * @public
		 * @type Number
		 * @name me.AnimationSheet#animationspeed
		 */
		animationspeed : 0,

		/** @private */
		init : function(x, y, image, spritewidth, spriteheight, spacing, margin) {
			// hold all defined animation
			this.anim = [];

			// a flag to reset animation
			this.resetAnim = null;

			// default animation sequence
			this.current = null;

			// Spacing and margin
			this.spacing = spacing || 0;
			this.margin = margin || 0;

			// call the constructor
			this.parent(x, y, image, spritewidth, spriteheight, spacing, margin);
			
			// sprite count (line, col)
			this.spritecount = new me.Vector2d(~~((this.image.width - this.margin) / (this.width + this.spacing)),
											   ~~((this.image.height - this.margin) / (this.height + this.spacing)));


			// if one single image, disable animation
			if ((this.spritecount.x * this.spritecount.y) == 1) {
				// override setAnimationFrame with an empty function
				/** @private */
				this.setAnimationFrame = function() {;};
			}

			// default animation speed
			this.animationspeed = me.sys.fps / 10;

			// create a default animation sequence with all sprites
			this.addAnimation("default", null);
			// set as default
			this.setCurrentAnimation("default");
		},

		/**
		 * add an animation <br>
		 * the index list must follow the logic as per the following example :<br>
		 * <img src="spritesheet_grid.png"/>
		 * @param {String} name animation id
		 * @param {Int[]} index list of sprite index defining the animaton
		 * @example
		 * // walking animatin
		 * this.addAnimation ("walk", [0,1,2,3,4,5]);
		 * // eating animatin
		 * this.addAnimation ("eat", [6,6]);
		 * // rolling animatin
		 * this.addAnimation ("roll", [7,8,9,10]);
		 */
		addAnimation : function(name, frame) {
			this.anim[name] = {
				name : name,
				frame : [],
				idx : 0,
				length : 0
			};

			if (frame == null) {
				frame = [];
				// create a default animation with all sprites in the spritesheet
				for ( var i = 0, count = this.spritecount.x * this.spritecount.y; i < count ; i++) {
					frame[i] = i;
				}
			}

			// compute and add the offset of each frame
			for ( var i = 0 , len = frame.length ; i < len; i++) {
				this.anim[name].frame[i] = new me.Vector2d(this.margin + (this.spacing + this.width) * (frame[i] % this.spritecount.x),
														   this.margin + (this.spacing + this.height) * ~~(frame[i] / this.spritecount.x));
			}
			this.anim[name].length = this.anim[name].frame.length;
		},

		/**
		 * set the current animation
		 * @param {String} name animation id
		 * @param {Object} [onComplete] animation id to switch to when complete, or callback
		 * @example
		 * // set "walk" animation
		 * this.setCurrentAnimation("walk");
		 * // set "eat" animation, and switch to "walk" when complete
		 * this.setCurrentAnimation("eat", "walk");
		 * // set "die" animation, and remove the object when finished
		 * this.setCurrentAnimation("die", function(){me.game.remove(this)});
		 **/

		setCurrentAnimation : function(name, resetAnim) {
			this.current = this.anim[name];
			this.resetAnim = resetAnim || null;
			this.setAnimationFrame(this.current.idx); // or 0 ?
		},

		/**
		 * return true if the specified animation is the current one.
		 * @param {String} name animation id
		 * @example
		 * if (!this.isCurrentAnimation("walk"))
		 * {
		 *    // do something horny...
		 * }
		 */
		isCurrentAnimation : function(name) {
			return (this.current.name == name);
		},

		/**
		 * force the current animation frame index.
		 * @param {int} [index=0]
		 * @example
		 * //reset the current animation to the first frame
		 * this.setAnimationFrame();
		 */
		setAnimationFrame : function(idx) {
			this.current.idx = (idx || 0) % this.current.length;
			this.offset = this.current.frame[this.current.idx];
		},

		/**
		 * update the animation<br>
		 * this is automatically called by the game manager {@link me.game}
		 * @protected
		 */
		update : function() {
			// call the parent function
			this.parent();
			// update animation if necessary
			if (this.visible && !this.animationpause && (this.fpscount++ > this.animationspeed)) {
				this.setAnimationFrame(++this.current.idx);
				this.fpscount = 0;

				// switch animation if we reach the end of the strip
				// and a callback is defined
				if ((this.current.idx == 0) && this.resetAnim)  {
					// if string, change to the corresponding animation
					if (typeof(this.resetAnim) == "string")
						this.setCurrentAnimation(this.resetAnim);
					// if function (callback) call it
					else if (typeof(this.resetAnim) == "function")
						this.resetAnim();
				}
				return true;
			}
			return false;
		}
	});


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
