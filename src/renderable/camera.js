/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	// some ref shortcut
	var MIN = Math.min, MAX = Math.max;

	/**
	 * a camera/viewport Object
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {Number} minX start x offset
	 * @param {Number} minY start y offset
	 * @param {Number} maxX end x offset
	 * @param {Number} maxY end y offset
	 * @param {Number} [realw] real world width limit
	 * @param {Number} [realh] real world height limit
	 */
	me.Viewport = me.Renderable.extend(
	/** @scope me.Viewport.prototype */ {

		/**
		 * Axis definition :<br>
		 * <p>
		 * AXIS.NONE<br>
		 * AXIS.HORIZONTAL<br>
		 * AXIS.VERTICAL<br>
		 * AXIS.BOTH
		 * </p>
		 * @public
		 * @constant
		 * @type enum
		 * @name AXIS
		 * @memberOf me.Viewport
		 */
		AXIS : {
			NONE : 0,
			HORIZONTAL : 1,
			VERTICAL : 2,
			BOTH : 3
		},
 
        /**
		 * Camera bounds 
		 * @public
		 * @constant
		 * @type me.Rect
		 * @name bounds
		 * @memberOf me.Viewport
		 */
		bounds : null,

		// camera deadzone
		deadzone : null,

		// target to follow
		target : null,

		// axis to follow
		follow_axis : 0,

		// shake parameters
		shaking : false,
		_shake : null,
		// fade parameters
		_fadeIn : null,
		_fadeOut : null,

		// cache the screen rendering position
		screenX : 0,
		screenY : 0,

		/** @ignore */
		init : function(minX, minY, maxX, maxY, realw, realh) {
			// viewport coordinates
			this.parent(new me.Vector2d(minX, minY), maxX - minX, maxY - minY);

			// real worl limits
			this.bounds = new me.Rect(new me.Vector2d(), realw||this.width, realh||this.height);

			// offset for shake effect
			this.offset = new me.Vector2d();

			// target to follow
			this.target = null;

			// default value follow 
			this.follow_axis = this.AXIS.NONE;

			// shake variables
			this._shake = {
				intensity : 0,
				duration : 0,
				axis : this.AXIS.BOTH,
				onComplete : null
			};

			// flash variables
			this._fadeOut = {
				color : null,
				duration : 0,
				tween : null
			};
			// fade variables
			this._fadeIn = {
				color : null,
				duration : 0,
				tween : null
			};

			// set a default deadzone
			this.setDeadzone(this.width / 6, this.height / 6);
		},

		// -- some private function ---

		/** @ignore */
		_followH : function(target) {
			var _x = this.pos.x;
			if ((target.x - this.pos.x) > (this.deadzone.right)) {
				this.pos.x = ~~MIN((target.x) - (this.deadzone.right), this.bounds.width - this.width);
			}
			else if ((target.x - this.pos.x) < (this.deadzone.pos.x)) {
				this.pos.x = ~~MAX((target.x) - this.deadzone.pos.x, this.bounds.pos.x);
			}
			return (_x !== this.pos.x);
		},

		/** @ignore */
		_followV : function(target) {
			var _y = this.pos.y;
			if ((target.y - this.pos.y) > (this.deadzone.bottom)) {
				this.pos.y = ~~MIN((target.y) - (this.deadzone.bottom),	this.bounds.height - this.height);
			}
			else if ((target.y - this.pos.y) < (this.deadzone.pos.y)) {
				this.pos.y = ~~MAX((target.y) - this.deadzone.pos.y, this.bounds.pos.y);
			}
			return (_y !== this.pos.y);
		},

		// -- public function ---

		/**
		 * reset the viewport to specified coordinates
		 * @name reset
		 * @memberOf me.Viewport
		 * @function
		 * @param {Number} [x=0]
		 * @param {Number} [y=0]
		 */
		reset : function(x, y) {
			// reset the initial viewport position to 0,0
			this.pos.x = x || 0;
			this.pos.y = y || 0;

			// reset the target
			this.target = null;

			// reset default axis value for follow 
			this.follow_axis = null;

		},

		/**
		 * Change the deadzone settings
		 * @name setDeadzone
		 * @memberOf me.Viewport
		 * @function
		 * @param {Number} w deadzone width
		 * @param {Number} h deadzone height
		 */
		setDeadzone : function(w, h) {
            
            if (this.deadzone === null) {
                this.deadzone = new me.Rect(new me.Vector2d(), 0, 0);
            }
            
            // reusing the old code for now...
            this.deadzone.pos.set(
                ~~((this.width - w) / 2),
                ~~((this.height - h) / 2 - h * 0.25)
            );
            this.deadzone.resize(w, h);

			// force a camera update
			this.updateTarget();

		},

		/**
		 * set the viewport to follow the specified entity
		 * @name follow
		 * @memberOf me.Viewport
		 * @function
		 * @param {me.ObjectEntity|me.Vector2d} target ObjectEntity or Position Vector to follow
		 * @param {me.Viewport#AXIS} [axis=AXIS.BOTH] Which axis to follow
		 */
		follow : function(target, axis) {
			if (target instanceof me.ObjectEntity)
				this.target = target.pos;
			else if (target instanceof me.Vector2d)
				this.target = target;
			else
				throw "melonJS: invalid target for viewport.follow";
			// if axis is null, camera is moved on target center
			this.follow_axis = (typeof(axis) === "undefined" ? this.AXIS.BOTH : axis);
			
			// force a camera update
			this.updateTarget();
		},

		/**
		 * move the viewport position by the specified offset
		 * @name move
		 * @memberOf me.Viewport
		 * @function
		 * @param {Number} x
		 * @param {Number} y
		 * @example
		 * // Move the viewport up by four pixels
		 * me.game.viewport.move(0, -4);
		 */
		move : function(x, y) {
			var newx = ~~(this.pos.x + x);
			var newy = ~~(this.pos.y + y);
			
			this.pos.x = newx.clamp(this.bounds.pos.x, this.bounds.width - this.width);
			this.pos.y = newy.clamp(this.bounds.pos.y, this.bounds.height - this.height);

			//publish the corresponding message
			me.event.publish(me.event.VIEWPORT_ONCHANGE, [this.pos]);
		},

		/** @ignore */
		updateTarget : function() {
			var updated = false;
			
			if (this.target) {
				switch (this.follow_axis) {
					case this.AXIS.NONE:
						//this.focusOn(this.target);
						break;

					case this.AXIS.HORIZONTAL:
						updated = this._followH(this.target);
						break;

					case this.AXIS.VERTICAL:
						updated = this._followV(this.target);
						break;

					case this.AXIS.BOTH:
						updated = this._followH(this.target);
						updated = this._followV(this.target) || updated;
						break;

					default:
						break;
					}
			}

			return updated;
		},

		/** @ignore */
		update : function( dt ) {
			
			var updated = this.updateTarget();
			
			if (this.shaking === true) {
				this._shake.duration -= dt;
				if (this._shake.duration <= 0) {
					this.shaking = false;
					this.offset.setZero();
					if (typeof(this._shake.onComplete) === "function") {
						this._shake.onComplete();
					}
				}
				else {
					if (this._shake.axis === this.AXIS.BOTH ||
						this._shake.axis === this.AXIS.HORIZONTAL) {
						this.offset.x = (Math.random() - 0.5) * this._shake.intensity;
					}
					if (this._shake.axis === this.AXIS.BOTH ||
						this._shake.axis === this.AXIS.VERTICAL) {
						this.offset.y = (Math.random() - 0.5) * this._shake.intensity;
					}
				}
				// updated!
				updated = true;
			}

			if (updated === true) {
				//publish the corresponding message
				me.event.publish(me.event.VIEWPORT_ONCHANGE, [this.pos]);
			}

			// check for fade/flash effect
			if ((this._fadeIn.tween!=null) || (this._fadeOut.tween!=null)) {
				updated = true;
			}

			return updated;
		},

		/**
		 * shake the camera 
		 * @name shake
		 * @memberOf me.Viewport
		 * @function
		 * @param {Number} intensity maximum offset that the screen can be moved while shaking
		 * @param {Number} duration expressed in milliseconds
		 * @param {me.Viewport#AXIS} [axis=AXIS.BOTH] specify on which axis you want the shake effect (AXIS.HORIZONTAL, AXIS.VERTICAL, AXIS.BOTH)
		 * @param {Function} [onComplete] callback once shaking effect is over
		 * @example
		 * // shake it baby !
		 * me.game.viewport.shake(10, 500, me.game.viewport.AXIS.BOTH);
		 */
		shake : function(intensity, duration, axis, onComplete) {
			if (this.shaking)
				return;

			this.shaking = true;

			this._shake = {
				intensity : intensity,
				duration : duration,
				axis : axis || this.AXIS.BOTH,
				onComplete : onComplete || null
			};
		},

		/**
		 * fadeOut(flash) effect<p>
		 * screen is filled with the specified color and slowly goes back to normal
		 * @name fadeOut
		 * @memberOf me.Viewport
		 * @function
		 * @param {String} color a CSS color value
		 * @param {Number} [duration=1000] expressed in milliseconds
		 * @param {Function} [onComplete] callback once effect is over
		 */
		fadeOut : function(color, duration, onComplete) {
			this._fadeOut.color = me.entityPool.newInstanceOf("me.Color").parseHex(color);
			this._fadeOut.color.alpha = 1.0;
			this._fadeOut.duration = duration || 1000; // convert to ms
			this._fadeOut.tween = me.entityPool.newInstanceOf("me.Tween", this._fadeOut.color).to({alpha: 0.0}, this._fadeOut.duration ).onComplete(onComplete||null);
			this._fadeOut.tween.start();
		},

		/**
		 * fadeIn effect <p>
		 * fade to the specified color
		 * @name fadeIn
		 * @memberOf me.Viewport
		 * @function
		 * @param {String} color a CSS color value
		 * @param {Number} [duration=1000] expressed in milliseconds
		 * @param {Function} [onComplete] callback once effect is over
		 */
		fadeIn : function(color, duration, onComplete) {
			this._fadeIn.color = me.entityPool.newInstanceOf("me.Color").parseHex(color);
			this._fadeIn.color.alpha = 0.0;
			this._fadeIn.duration = duration || 1000; //convert to ms
			this._fadeIn.tween = me.entityPool.newInstanceOf("me.Tween", this._fadeIn.color).to({alpha: 1.0}, this._fadeIn.duration ).onComplete(onComplete||null);
			this._fadeIn.tween.start();
		},

		/**
		 * return the viewport width
		 * @name getWidth
		 * @memberOf me.Viewport
		 * @function
		 * @return {Number}
		 */
		getWidth : function() {
			return this.width;
		},

		/**
		 * return the viewport height
		 * @name getHeight
		 * @memberOf me.Viewport
		 * @function
		 * @return {Number}
		 */
		getHeight : function() {
			return this.height;
		},

		/**
		 *	set the viewport around the specified entity<p>
		 * <b>BROKEN !!!!</b>
		 * @deprecated
		 * @ignore
		 * @param {Object} 
		 */
		focusOn : function(target) {
			// BROKEN !! target x and y should be the center point
			this.pos.x = target.x - this.width * 0.5;
			this.pos.y = target.y - this.height * 0.5;
		},

		/**
		 * check if the specified rectangle is in the viewport
		 * @name isVisible
		 * @memberOf me.Viewport
		 * @function
		 * @param {me.Rect} rect
		 * @return {Boolean}
		 */
		isVisible : function(rect) {
			return rect.overlaps(this);
		},

		/**
		 * convert the given "local" (screen) coordinates into world coordinates
		 * @name localToWorld
		 * @memberOf me.Viewport
		 * @function
		 * @param {Number} x
		 * @param {Number} y
		 * @return {me.Vector2d}
		 */
		localToWorld : function(x, y) {
			return (new me.Vector2d(x,y)).add(this.pos).sub(me.game.currentLevel.pos);
		},
		
		/**
		 * convert the given world coordinates into "local" (screen) coordinates
		 * @name worldToLocal
		 * @memberOf me.Viewport
		 * @function
		 * @param {Number} x
		 * @param {Number} y
		 * @return {me.Vector2d}
		 */
		worldToLocal : function(x, y) {
			return (new me.Vector2d(x,y)).sub(this.pos).add(me.game.currentLevel.pos);
		},
		
		/**
		 * render the camera effects
		 * @ignore
		 */
		draw : function(context) {
			
			// fading effect
			if (this._fadeIn.tween) {
				me.video.clearSurface(context, this._fadeIn.color.toRGBA());
				// remove the tween if over
				if (this._fadeIn.color.alpha === 1.0) {
					me.entityPool.freeInstance(this._fadeIn.tween);
					this._fadeIn.tween = null;
					me.entityPool.freeInstance(this._fadeIn.color);
					this._fadeIn.color = null;
				}
			}
			
			// flashing effect
			if (this._fadeOut.tween) {
				me.video.clearSurface(context, this._fadeOut.color.toRGBA());
				// remove the tween if over
				if (this._fadeOut.color.alpha === 0.0) {
					me.entityPool.freeInstance(this._fadeOut.tween);
					this._fadeOut.tween = null;
					me.entityPool.freeInstance(this._fadeOut.color);
					this._fadeOut.color = null;
				}
			}
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
