/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	// some ref shortcut
	var MIN = Math.min, MAX = Math.max;

	/************************************************************************************/
	/*		a viewport/camera entity																		*/
	/************************************************************************************/
	/**
	 * a camera/viewport Object
	 * @class
	 * @extends me.Rect
	 * @memberOf me
	 * @constructor
	 * @param {int} minX start x offset
	 * @param {int} minY start y offset
	 * @param {int} maxX end x offset
	 * @param {int} maxY end y offset
	 * @param {int} [realw] real world width limit
	 * @param {int} [realh] real world height limit
	 */
	me.Viewport = me.Rect
			.extend(
			/** @scope me.Viewport.prototype */
			{

				/**
				 *	Axis constant
				 * @public
				 * @type enum
				 */
				AXIS : {
					NONE : 0,
					HORIZONTAL : 1,
					VERTICAL : 2,
					BOTH : 3
				},

				// world limit
				limits : null,

				// target to follow
				target : null,

				// axis to follow
				follow_axis : 0,

				// shake parameters
				_shake : null,
				// fade parameters
				_fadeIn : null,
				_fadeOut : null,

				// cache some values
				_deadwidth : 0,
				_deadheight : 0,
				_limitwidth : 0,
				_limitheight : 0,

				/** @private */
				init : function(minX, minY, maxX, maxY, realw, realh) {
					// viewport coordinates
					this.parent(new me.Vector2d(minX, minY), maxX - minX, maxY - minY);

					// real worl limits
					this.limits = new me.Vector2d(realw||this.width, realh||this.height);

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
						color : 0,
						alpha : 0.0,
						duration : 0,
						tween : null
					};
					// fade variables
					this._fadeIn = {
						color : 0,
						alpha : 1.0,
						duration : 0,
						tween : null
					};

					// set a default deadzone
					this.setDeadzone(this.width / 6, this.height / 6);
				},

				// -- some private function ---

				/** @private */
				_followH : function(target) {
					if ((target.x - this.pos.x) > (this._deadwidth)) {
						this.pos.x = ~~MIN((target.x) - (this._deadwidth), this._limitwidth);
						return true;
					}
					else if ((target.x - this.pos.x) < (this.deadzone.x)) {
						this.pos.x = ~~MAX((target.x) - this.deadzone.x, 0);
						return true;
					}
					return false;
				},

				/** @private */
				_followV : function(target) {
					if ((target.y - this.pos.y) > (this._deadheight)) {
						this.pos.y = ~~MIN((target.y) - (this._deadheight),	this._limitheight);
						return true;
					}
					else if ((target.y - this.pos.y) < (this.deadzone.y)) {
						this.pos.y = ~~MAX((target.y) - this.deadzone.y, 0);
						return true;
					}
					return false;
				},

				// -- public function ---

				/**
				 * reset the viewport to specified coordinates
				 * @param {int} x
				 * @param {int} y
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
				 * @param {int} w deadzone width
				 * @param {int} h deadzone height
				 */
				setDeadzone : function(w, h) {
					this.deadzone = new me.Vector2d(~~((this.width - w) / 2),
							~~((this.height - h) / 2 - h * 0.25));
					// cache some value
					this._deadwidth = this.width - this.deadzone.x;
					this._deadheight = this.height - this.deadzone.y;

					// force a camera update
					this.update(true);

				},

				/**
				 * set the viewport bound (real world limit)
				 * @param {int} w real world width
				 * @param {int} h real world height
				 */
				setBounds : function(w, h) {
					this.limits.set(w, h);
					// cache some value
					this._limitwidth = this.limits.x - this.width;
					this._limitheight = this.limits.y - this.height;

				},

				/**
				 * set the viewport to follow the specified entity
				 * @param {Object} Object ObjectEntity or Position Vector to follow
				 * @param {axis} [axis="AXIS.BOTH"] AXIS.HORIZONTAL, AXIS.VERTICAL, AXIS.BOTH
				 */

				follow : function(target, axis) {
					if (target instanceof me.ObjectEntity)
						this.target = target.pos;
					else if (target instanceof me.Vector2d)
						this.target = target;
					else
						throw "melonJS: invalid target for viewport.follow";
					// if axis is null, camera is moved on target center
					this.follow_axis = axis || this.AXIS.BOTH;
					
					// force a camera update
					this.update(true);
				},

				/**
				 * move the viewport to the specified coordinates
				 * @param {int} x
				 * @param {int} y
				 */

				move : function(x, y) {
					var newx = ~~(this.pos.x + x);
					var newy = ~~(this.pos.y + y);
					
					this.pos.x = newx.clamp(0,this._limitwidth);
					this.pos.y = newy.clamp(0,this._limitheight);
				},

				/** @private */
				update : function(updateTarget) {

					if (this.target && updateTarget) {
						switch (this.follow_axis) {
						case this.AXIS.NONE:
							//this.focusOn(this.target);
							break;

						case this.AXIS.HORIZONTAL:
							updateTarget = this._followH(this.target);
							break;

						case this.AXIS.VERTICAL:
							updateTarget = this._followV(this.target);
							break;

						case this.AXIS.BOTH:
							updateTarget = this._followH(this.target);
							updateTarget = this._followV(this.target) || updateTarget;
							break;

						default:
							break;
						}
					}

					if (this._shake.duration > 0) {
						this._shake.duration -= me.timer.tick;
						if (this._shake.duration < 0) {
							if (this._shake.onComplete)
								this._shake.onComplete();
						} else {
							if ((this._shake.axis == this.AXIS.BOTH)
									|| (this._shake.axis == this.AXIS.HORIZONTAL)) {
								var shakex = (Math.random() * this._shake.intensity);

								if (this.pos.x + this.width + shakex < this.limits.x)
									this.pos.x += ~~shakex;
								else
									this.pos.x -= ~~shakex;
							}
							if ((this._shake.axis == this.AXIS.BOTH)
									|| (this._shake.axis == this.AXIS.VERTICAL)) {
								var shakey = (Math.random() * this._shake.intensity);

								if (this.pos.y + this.height + shakey < this.limits.y)
									this.pos.y += ~~shakey;
								else
									this.pos.y -= ~~shakey;

							}
							// updated!
							updateTarget = true;
						}
					}

					// check for fade/flash effect
					if ((this._fadeIn.tween!=null) || (this._fadeOut.tween!=null)) {
						updateTarget = true;
					}

					// return same value that the one given
					// so that we only force it to true
					// if we used any effect (e.g. shake, fading, etc...)
					return updateTarget;
				},

				/**
				 * shake the camera 
				 * @param {int} intensity maximum offset that the screen can be moved while shaking
				 * @param {int} duration expressed in frame
				 * @param {axis} axis specify on which axis you want the shake effect (AXIS.HORIZONTAL, AXIS.VERTICAL, AXIS.BOTH)
				 * @param {function} [onComplete] callback once shaking effect is over
				 * @example
				 * // shake it baby !
				 * me.game.viewport.shake(10, 30, me.game.viewport.AXIS.BOTH);
				 */

				shake : function(intensity, duration, axis, onComplete) {
					// make sure we have a default value for axis
					axis = axis || this.AXIS.BOTH;

					// some limit test
					if (axis == this.AXIS.BOTH) {
						if (this.width == this.limits.x)
							axis = this.AXIS.VERTICAL;
						else if (this.height == this.limits.y)
							axis = this.AXIS.HORIZONTAL;
					}
					if ((axis == this.AXIS.HORIZONTAL)
							&& (this.width == this.limits.x))
						return;

					if ((axis == this.AXIS.VERTICAL)
							&& (this.height == this.limits.y))
						return;

					this._shake.intensity = intensity;
					this._shake.duration = duration;
					this._shake.axis = axis;
					this._shake.onComplete = onComplete || null;
				},

				/**
				 * fadeOut(flash) effect<p>
				 * screen is filled with the specified color and slowy goes back to normal
				 * @param {string} color in #rrggbb format
				 * @param {Int} [duration="1000"] in ms
				 * @param {function} [onComplete] callback once effect is over
				 */

				fadeOut : function(color, duration, onComplete) {
					this._fadeOut.color = color;
					this._fadeOut.duration = duration || 1000; // convert to ms
					this._fadeOut.alpha = 1.0;
					this._fadeOut.tween = new me.Tween(this._fadeOut).to({alpha: 0.0}, this._fadeOut.duration ).onComplete(onComplete||null);
					this._fadeOut.tween.start();
				},

				/**
				 * fadeIn effect <p>
				 * fade to the specified color
				 * @param {string} color in #rrggbb format
				 * @param {int} [duration="1000"] in ms
				 * @param {function} [onComplete] callback once effect is over
				 */

				fadeIn : function(color, duration, onComplete) {
					this._fadeIn.color = color;
					this._fadeIn.duration = duration || 1000; //convert to ms
					this._fadeIn.alpha = 0.0;
					this._fadeIn.tween = new me.Tween(this._fadeIn).to({alpha: 1.0}, this._fadeIn.duration ).onComplete(onComplete||null);
					this._fadeIn.tween.start();
				},

				/**
				 *	return the viewport width
				 * @return {int}
				 */
				getWidth : function() {
					return this.width;
				},

				/**
				 *	return the viewport height
				 * @return {int}
				 */
				getHeight : function() {
					return this.height;
				},

				/**
				 *	set the viewport around the specified entity<p>
				 * <b>BROKEN !!!!</b>
				 * @private
				 * @param {Object} 
				 */
				focusOn : function(target) {
					// BROKEN !! target x and y should be the center point
					this.pos.x = target.x - this.width * 0.5;
					this.pos.y = target.y - this.height * 0.5;
				},

				/**
				 *	check if the specified rectange is in the viewport
				 * @param {me.Rect} rect
				 * @return {boolean}
				 */
				isVisible : function(rect) {
					return rect.overlaps(this);
				},

				/**
				 *	render the camera effects
				 * @private
				 */
				draw : function(context) {
					
					// fading effect
					if (this._fadeIn.tween) {
						context.globalAlpha = this._fadeIn.alpha;
						me.video.clearSurface(context, me.utils.HexToRGB(this._fadeIn.color));
						// set back full opacity
						context.globalAlpha = 1.0;
						// remove the tween if over
						if (this._fadeIn.alpha==1.0)
							this._fadeIn.tween = null;
					}
					
					// flashing effect
					if (this._fadeOut.tween) {
						context.globalAlpha = this._fadeOut.alpha;
						me.video.clearSurface(context, me.utils.HexToRGB(this._fadeOut.color));
						// set back full opacity
						context.globalAlpha = 1.0;
						// remove the tween if over
						if (this._fadeOut.alpha==0.0)
							this._fadeOut.tween = null;
					}
				}

			});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
