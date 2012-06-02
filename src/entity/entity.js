/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, undefined) {
	// some ref shortcut
	var MIN = Math.min;

	/**
	 * me.ObjectSettings contains the object attributes defined in Tiled<br>
	 * and is created by the engine and passed as parameter to the corresponding object when loading a level<br>
	 * the field marked Mandatory are to be defined either in Tiled, or in the before calling the parent constructor
	 * <img src="object_properties.png"/><br>
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.ObjectSettings = {
		/**
		 * object entity name<br>
		 * as defined in the Tiled Object Properties
		 * @public
		 * @type {String}
		 * @name me.ObjectSettings#name
		 */
		name : null,

		/**
		 * image ressource name to be loaded<br>
		 * MANDATORY<br>
		 * (in case of TiledObject, this field is automatically set)
		 * @public
		 * @type {String}
		 * @name me.ObjectSettings#image
		 */
		image : null,
		
		/**
		 * specify a transparent color for the image in rgb format (rrggb or #rrggb)<br>
		 * OPTIONAL<br>
		 * (using this option will imply processing time on the image)
		 * @public
		 * @type {String}
		 * @name me.ObjectSettings#transparent_color
		 */
		transparent_color : null,
		
		/**
		 * width of a single sprite in the spritesheet<br>
		 * MANDATORY<br>
		 * (in case of TiledObject, this field is automatically set)
		 * @public
		 * @type {Int}
		 * @name me.ObjectSettings#spritewidth
		 */
		spritewidth : null,
		
		/**
		 * height of a single sprite in the spritesheet<br>
		 * OPTIONAL<br>
		 * if not specified the value will be set to the corresponding image height<br>
		 * (in case of TiledObject, this field is automatically set)
		 * @public
		 * @type {Int}
		 * @name me.ObjectSettings#spriteheight
		 */
		spriteheight : null,


		/**
		 * custom type for collision detection<br>
		 * OPTIONAL
		 * @public
		 * @type {String}
		 * @name me.ObjectSettings#type
		 */
		type : 0,

		/**
		 * Enable collision detection for this object<br>
		 * OPTIONAL
		 * @public
		 * @type {Boolean}
		 * @name me.ObjectSettings#collidable
		 */
		collidable : false
	};


	/**
	 * a pool of object entity <br>
	 * this object is used by the engine to instanciate object defined in the map<br>
	 * which means, that on level loading the engine will try to instanciate every object<br>
	 * found in the map, based on the user defined name in each Object Properties<br>
	 * <img src="object_properties.png"/><br>
	 * There is no constructor function for me.entityPool, this is a static object
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.entityPool = (function() {
		// hold public stuff in our singletong
		var obj = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
		---------------------------------------------*/
		var entityClass = {};

		/*---------------------------------------------
			
			PUBLIC STUFF
				
		---------------------------------------------*/

		/*---
		
			init
			
			---*/

		obj.init = function() {
			// add default entity object 
			obj.add("me.LevelEntity", me.LevelEntity);
			obj.add("me.ObjectEntity", me.ObjectEntity);
			obj.add("me.CollectableEntity", me.CollectableEntity);
			obj.add("me.InvisibleEntity", me.InvisibleEntity);
		};

		/**
		 * add an object to the pool
		 * @name me.entityPool#add
		 * @public
		 * @function
		 * @param {String} className as defined in the Name fied of the Object Properties (in Tiled)
		 * @param {Object} object corresponding Object to be instanciated
		 * @example
		 * // add our users defined entities in the entity pool
		 * me.entityPool.add("playerspawnpoint", PlayerEntity);
		 * me.entityPool.add("cherryentity", CherryEntity);
		 * me.entityPool.add("heartentity", HeartEntity);
		 * me.entityPool.add("starentity", StarEntity);
		 */
		obj.add = function(className, entityObj) {
			entityClass[className.toLowerCase()] = entityObj;
		};

		/**
		 *	return a new instance of the requested object
		 * @private	
		 */

		obj.newIstanceOf = function(prop) {
			if (!entityClass[prop.name.toLowerCase()]) {
				alert("cannot instance entity of type '" + prop.name
						+ "': Class not found!");
				return null;
			}
			// i should pass the entity ownProperty instead of the object itself
			return new entityClass[prop.name.toLowerCase()](prop.x, prop.y, prop);
		};

		// return our object
		return obj;

	})();


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
	 * mySprite = new SpriteObject (100, 100, me.loader.getImage("mySpriteImage"));
	 */
	me.SpriteObject = me.Rect
			.extend(
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
				 * a flag that can prevent the object to be destroyed<br>
				 * if set to false, the objet won't be destroy when calling me.game.remove(obj)<br>
				 * default value : true
				 * @public
				 * @type Boolean
				 * @name me.SpriteObject#autodestroy
				 */
				autodestroy : true,

				/**
				 * the visible state of the object<br>
				 * default value : true
				 * @public
				 * @type Boolean
				 * @name me.SpriteObject#visible
				 */
				visible : true,
				
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

				// image reference
				image : null,

				// create a a default collision rectangle
				// this object is useless here, but low level
				// function like flipX need to take this in account
				collisionBox : null,
				
				// to manage the flickering effect
				flickering : false,
				flickerTimer : -1,
				flickercb : null,
				flickerState : false,


				// a reference to the game vp 
				vp : null,

				/**
				 * @ignore 
				 */
				init : function(x, y, image, spritewidth, spriteheight) {

					// call the parent constructor
					this.parent(new me.Vector2d(x, y), 
								spritewidth  || image.width, 
								spriteheight || image.height);

					// cache image reference
					this.image = image;

					// scale factor of the object
					this.scale = new me.Vector2d(1.0, 1.0);

					// create a a default collision rectangle
					this.collisionBox = new me.Rect(this.pos, this.width, this.height);

					// get a reference to the current viewport
					this.vp = me.game.viewport;

					// set the default sprite index & offset
					this.offset = new me.Vector2d(0, 0);
					
					// set the default anchor point (middle of the sprite)
					this.anchorPoint = new me.Vector2d(0.5, 0.5);
					
					// sprite count (line, col)
					this.spritecount = new me.Vector2d(~~(this.image.width / this.width), 
													   ~~(this.image.height / this.height));
				},
				
				/**
				 *	specify a transparent color
				 *	@param {String} color color key in rgb format (rrggb or #rrggb)
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

						// flip the collision box
						this.collisionBox.flipX(this.width);
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

						// flip the collision box
						this.collisionBox.flipY(this.height);

					}
				},

				/**
				 *	Resize the object around his center<br>
				 *  Note : This won't resize the corresponding collision box
				 *	@param {Boolean} ratio scaling ratio
				 */
				resize : function(ratio)
				{	
					if (ratio > 0) {
						this.scale.x = this.scale.x < 0.0 ? -ratio : ratio;
						this.scale.y = this.scale.y < 0.0 ? -ratio : ratio;
						// set the scaleFlag
						this.scaleFlag = ((this.scale.x!= 1.0)  || (this.scale.y!= 1.0))
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
					
					var xpos = ~~(this.pos.x - this.vp.pos.x), ypos = ~~(this.pos.y - this.vp.pos.y);

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

					if ((this.scaleFlag) || (this.angle!==0)) {
						// restore the transform matrix to the normal one
						context.setTransform(1, 0, 0, 1, 0, 0);
					}

					if (me.debug.renderHitBox) {
						// draw the sprite rectangle
						this.parent(context, "blue");
						// draw the collisionBox
						this.collisionBox.draw(context, "red");
					}
				},

				/**
				 * Destroy function<br>
				 * object is only removed if the autodestroy flag is set (to be removed, useless)
				 * @private
				 */
				destroy : function() {
					// if object can be destroyed
					if (this.autodestroy) {
						// call the destroy notification function
						this.onDestroyEvent();
					}
					return this.autodestroy;
				},

				/**
				 * OnDestroy Notification function<br>
				 * Called by engine before deleting the object
				 */
				onDestroyEvent : function() {
					;// to be extended !
				}

			});
	/************************************************************************************/
	/*                                                                                  */
	/*      a generic object entity                                                     */
	/*                                                                                  */
	/************************************************************************************/
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
	me.AnimationSheet = me.SpriteObject
			.extend(
			/** @scope me.AnimationSheet.prototype */
			{
				// count the fps and manage animation change
				fpscount : 0,

				/**
				 * animation cycling speed<br>
				 * default value : me.sys.fps / 10;
				 * @public
				 * @type Number
				 * @name me.AnimationSheet#animationspeed
				 */
				animationspeed : 0,

				/** @private */
				init : function(x, y, image, spritewidth, spriteheight) {
					// hold all defined animation
					this.anim = [];

					// a flag to reset animation
					this.resetAnim = null;

					// default animation sequence
					this.current = null;

					// call the constructor
					this.parent(x, y, image, spritewidth, spriteheight);
					
					// if one single image, disable animation
					if ((this.spritecount.x * this.spritecount.y) == 1) {
						// override setAnimationFrame with an empty function
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
						this.anim[name].frame[i] = new me.Vector2d(this.width * (frame[i] % this.spritecount.x), 
																   this.height * ~~(frame[i] / this.spritecount.x));
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
					if (this.visible && (this.fpscount++ > this.animationspeed)) {
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

	/************************************************************************************/
	/*                                                                                  */
	/*      a generic object entity                                                     */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * a Generic Object Entity<br>
	 * Object Properties (settings) are to be defined in Tiled, <br> 
	 * or when calling the parent constructor
	 * 
	 * @class
	 * @extends me.AnimationSheet
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.ObjectSettings} settings Object Properties as defined in Tiled <br> <img src="object_properties.png"/>
	 */
	me.ObjectEntity = me.AnimationSheet
			.extend(
			/** @scope me.ObjectEntity.prototype */
			{
			   /**
				* Entity "Game Unique Identifier"<br>
				* @public
				* @type String
				* @name me.ObjectEntity#GUID
				*/
				GUID : null,
			
				// default type of the object (null)
				type : 0,

				// flag to enable/disable collision detection on this object
				collidable : false,

				/** @private */
				init : function(x, y, settings) {
					this.parent(x, y, 
								(typeof settings.image == "string") ? me.loader.getImage(settings.image) : settings.image, 
								settings.spritewidth, 
								settings.spriteheight);
					
					// check for user defined transparent color
					if (settings.transparent_color) {
						this.setTransparency(settings.transparent_color);
					}
					
					// set the object GUID value
					this.GUID = me.utils.createGUID();
					
					// set the object entity name
					this.name = settings.name?settings.name.toLowerCase():"";
					
					// adjust initial coordinates (should be bottom left ones when in a tiled world)
					this.pos.set(x, me.game.currentLevel?y + me.game.currentLevel.tileheight - this.height:y);

					/**
					 * entity current velocity<br>
					 * @public
					 * @type me.Vector2d
					 * @name me.ObjectEntity#vel
					 */
					this.vel = new me.Vector2d();

					/**
					 * entity current acceleration<br>
					 * @public
					 * @type me.Vector2d
					 * @name me.ObjectEntity#accel
					 */
					this.accel = new me.Vector2d();
					
					/**
					 * entity current friction<br>
					 * @public
					 * @type me.Vector2d
					 * @name me.ObjectEntity#friction
					 */
					this.friction = new me.Vector2d();
					
					/**
					 * max velocity (to limit entity velocity)<br>
					 * @public
					 * @type me.Vector2d
					 * @name me.ObjectEntity#maxVel
					 */
					this.maxVel = new me.Vector2d(1000,1000);

					// some default contants
					/**
					 * Default gravity value of the entity<br>
					 * default value : 0.98 (earth gravity)<br>
					 * to be set to 0 for RPG, shooter, etc...
					 * @public
					 * @type Number
					 * @name me.ObjectEntity#gravity
					 */
					this.gravity = (me.sys.gravity!=undefined)?me.sys.gravity:0.98;

					// just to identify our object
					this.isEntity = true;

					// dead state :)
					/**
					 * dead/living state of the entity<br>
					 * default value : true
					 * @public
					 * @type Boolean
					 * @name me.ObjectEntity#alive
					 */
					this.alive = true;

					// some usefull variable
					
					/**
					 * falling state of the object<br>
					 * true if the object is falling<br>
					 * false if the object is standing on something<br>
					 * (!) READ ONLY property
					 * @public
					 * @type Boolean
					 * @name me.ObjectEntity#falling
					 */
					this.falling = false;
					/**
					 * jumping state of the object<br>
					 * equal true if the entity is jumping<br>
					 * (!) READ ONLY property
					 * @public
					 * @type Boolean
					 * @name me.ObjectEntity#jumping
					 */
					this.jumping = true;

					// some usefull slope variable
					this.slopeY = 0;
					/**
					 * equal true if the entity is standing on a slope<br>
					 * (!) READ ONLY property
					 * @public
					 * @type Boolean
					 * @name me.ObjectEntity#onslope
					 */
					this.onslope = false;
					/**
					 * equal true if the entity is on a ladder<br>
					 * (!) READ ONLY property
					 * @public
					 * @type Boolean
					 * @name me.ObjectEntity#onladder
					 */
					this.onladder = false;

					// to enable collision detection
					this.collidable = settings.collidable || false;
					//this.collectable = false;

					this.type = settings.type || 0;

					
					// ref to the collision map
					this.collisionMap = me.game.collisionMap;
					
					// to know if our object can break tiles
					/**
					 * Define if an entity can go through breakable tiles<br>
					 * default value : false<br>
					 * @public
					 * @type Boolean
					 * @name me.ObjectEntity#canBreakTile
					 */
					this.canBreakTile = false;
					
					/**
					 * a callback when an entity break a tile<br>
					 * @public
					 * @type Function
					 * @name me.ObjectEntity#onTileBreak
					 */
					this.onTileBreak = null;
				},

				/**
				 * specify the size of the hit box for collision detection<br>
				 * (allow to have a specific size for each object)<br>
				 * e.g. : object with resized collision box :<br>
				 * <img src="me.Rect.colpos.png"/>
				 * @param {int} x x offset (specify -1 to not change the width)
				 * @param {int} w width of the hit box
				 * @param {int} y y offset (specify -1 to not change the height)
				 * @param {int} h height of the hit box
				 */
				updateColRect : function(x, w, y, h) {
					this.collisionBox.adjustSize(x, w, y, h);
				},

				/**
				 * collision detection
				 * @private	 
				 */
				checkCollision : function(obj) {
					var res = this.collisionBox.collideVsAABB(obj.collisionBox);

					if (res.x != 0 || res.y != 0) {
						// notify the object
						this.onCollision(res, obj);
						// return the type (deprecated)
						res.type = this.type;
						// return a reference of the colliding object
						res.obj  = this;
						return res;
					}
					return null;
				},

				/**
				 * onCollision Event function<br>
				 * called by the game manager when the object collide with shtg<br>
				 * by default, if the object type is Collectable, the destroy function is called
				 * @param {me.Vector2d} res collision vector
				 * @param {me.ObjectEntity} obj the other object that hit this object
				 * @protected
				 */
				onCollision : function(res, obj) {
					// destroy the object if collectable
					if (this.collidable
							&& (this.type == me.game.COLLECTABLE_OBJECT))
						me.game.remove(this);
				},

				/**
				 * set the entity default velocity<br>
				 * note : velocity is by default limited to the same value, see setMaxVelocity if needed<br>
				 * @param {Int} x velocity on x axis
				 * @param {Int} y velocity on y axis
				 * @protected
				 */

				setVelocity : function(x, y) {
					this.accel.x = (x != 0) ? x : this.accel.x;
					this.accel.y = (y != 0) ? y : this.accel.y;
					
					// limit by default to the same max value
					this.setMaxVelocity(x,y);
				},
				
				/**
				 * cap the entity velocity to the specified value<br>
				 * @param {Int} x max velocity on x axis
				 * @param {Int} y max velocity on y axis
				 * @protected
				 */
				setMaxVelocity : function(x, y) {
					this.maxVel.x = x;
					this.maxVel.y = y;
				},

				/**
				 * set the entity default friction<br>
				 * @param {Int} x horizontal friction
				 * @param {Int} y vertical friction
				 * @protected
				 */
				setFriction : function(x, y) {
					this.friction.x = x || 0;
					this.friction.y = y || 0;
				},

				
				/**
				 * helper function for platform games: <br>
				 * make the entity move left of right<br>
				 * @param {Boolean} left will automatically flip horizontally the entity sprite
				 * @protected
				 * @example
				 * if (me.input.isKeyPressed('left'))
				 * {
				 *     this.doWalk(true);
				 * }
				 * else if (me.input.isKeyPressed('right'))
				 * {
				 *     this.doWalk(false);
				 * }
				 */
				doWalk : function(left) {
					this.flipX(left);
					this.vel.x += (left) ? -this.accel.x * me.timer.tick : this.accel.x * me.timer.tick;
				},

				/**
				 * helper function for platform games: <br>
				 * make the entity move up and down<br>
				 * only valid is the player is on a ladder
				 * @param {Boolean} up will automatically flip vertically the entity sprite
				 * @protected
				 * @example
				 * if (me.input.isKeyPressed('up'))
				 * {
				 *     this.doClimb(true);
				 * }
				 * else if (me.input.isKeyPressed('down'))
				 * {
				 *     this.doClimb(false);
				 * }
				 */
				doClimb : function(up) {
					// add the player x acceleration to the y velocity
					if (this.onladder) {
						this.vel.y = (up) ? -this.accel.x * me.timer.tick
								: this.accel.x * me.timer.tick;
						return true;
					}
					return false;
				},
				
								
				/**
				 * helper function for platform games: <br>
				 * make the entity jump<br>
				 * @protected
				 */
				doJump : function() {
					// only jump if standing
					if (!this.jumping && !this.falling) {
						this.vel.y = -this.maxVel.y * me.timer.tick;
						this.jumping = true;
						return true;
					}
					return false;
				},

				/**
				 * helper function for platform games: <br>
				 * force to the entity to jump (for double jump)<br>
				 * @protected
				 */
				forceJump : function() {
					this.jumping = this.falling = false;
					this.doJump();
				},
				
				
				/**
				 * return the distance to the specified entity
				 * @param {me.ObjectEntity} entity Entity 
				 * @return {float} distance
				 */
				distanceTo: function(o) 
				{
					// the Vector object also implements the same function, but
					// we have to use here the center of both object
					var dx = (this.pos.x + this.hWidth)  - (o.pos.x + o.hWidth); 
					var dy = (this.pos.y + this.hHeight) - (o.pos.y + o.hHeight);
					return Math.sqrt(dx*dx+dy*dy);
				},

				
				/** 
				 * handle the player movement on a slope
				 * and update vel value
				 * @private
				 */
				checkSlope : function(tile, left) {
										
					// first make the object stick to the tile
					this.pos.y = tile.pos.y - this.height;
					
					// normally the check should be on the object center point, 
					// but since the collision check is done on corner, we must do the same thing here
					if (left)
						this.slopeY = tile.height - (this.collisionBox.right + this.vel.x - tile.pos.x);
					else
						this.slopeY = (this.collisionBox.left + this.vel.x - tile.pos.x);
					
					// cancel y vel
					this.vel.y = 0;
					// set player position (+ workaround when entering/exiting slopes tile)
					this.pos.y += this.slopeY.clamp(0, tile.height);
					
				},
				
				/**
				 * compute the new velocity value
				 * @private
				 */
				computeVelocity : function(vel) {
				
					// apply gravity (if any)
					if (this.gravity) {
						// apply a constant gravity (if not on a ladder)
						vel.y += !this.onladder?(this.gravity * me.timer.tick):0;

						// check if falling / jumping
						this.falling = (vel.y > 0);
						this.jumping = this.falling?false:this.jumping;
					}
					
					// apply friction
					if (this.friction.x)
						vel.x = me.utils.applyFriction(vel.x,this.friction.x);
					if (this.friction.y)
						vel.y = me.utils.applyFriction(vel.y,this.friction.y);
					
					// cap velocity
					if (vel.y !=0)
						vel.y = vel.y.clamp(-this.maxVel.y,this.maxVel.y);
					if (vel.x !=0)
						vel.x = vel.x.clamp(-this.maxVel.x,this.maxVel.x);
				},

				
				
				/**
				 * handle the player movement, "trying" to update his position<br>
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
				 * else if(res.y != 0)
				 * {
				 *    // y axis
				 *    if (res.y<0)
				 *       console.log("y axis : top side !");
				 *    else
				 *       console.log("y axis : bottom side !");		
				 *		
				 *	  // display the tile type
				 *    console.log(res.yprop.type)
				 * }
				 *
				 * // check player status after collision check
				 * var updated = (this.vel.x!=0 || this.vel.y!=0);
				 */
				updateMovement : function() {

					this.computeVelocity(this.vel);
					
					// check for collision
					var collision = this.collisionMap.checkCollision(this.collisionBox, this.vel);

					// update some flags
					this.onslope  = collision.yprop.isSlope || collision.xprop.isSlope;
					// clear the ladder flag
					this.onladder = false;

					

					// y collision
					if (collision.y) {

						// going down, collision with the floor
						this.onladder = collision.yprop.isLadder;
						
						if (collision.y > 0) {
							if (collision.yprop.isSolid	|| (collision.yprop.isPlatform && (this.collisionBox.bottom - 1 <= collision.ytile.pos.y))) {
								// adjust position to the corresponding tile
								this.pos.y = ~~this.pos.y;
								this.vel.y = (this.falling) ?collision.ytile.pos.y - this.collisionBox.bottom: 0 ;
								this.falling = false;
							} 
							else if (collision.yprop.isSlope && !this.jumping) {
								// we stop falling
								this.checkSlope(collision.ytile, collision.yprop.isLeftSlope);
								this.falling = false;
							} 
							else if (collision.yprop.isBreakable) {
								if  (this.canBreakTile) {
									// remove the tile
									me.game.currentLevel.clearTile(collision.ytile.row,	collision.ytile.col);
									if (this.onTileBreak)
										this.onTileBreak();
								}
								else {
									// adjust position to the corresponding tile
									this.pos.y = ~~this.pos.y;
									this.vel.y = (this.falling) ?collision.ytile.pos.y - this.collisionBox.bottom: 0;
									this.falling = false;
								}
							}
						}
						// going up, collision with ceiling
						else if (collision.y < 0) {
							if (!collision.yprop.isPlatform	&& !collision.yprop.isLadder) {
								this.falling = true;
								// cancel the y velocity
								this.vel.y = 0;
							}
						}
					}
					
					// x collision
					if (collision.x) {
						
						this.onladder = collision.xprop.isLadder ;
						
						if (collision.xprop.isSlope && !this.jumping) {
							this.checkSlope(collision.xtile, collision.xprop.isLeftSlope);
							this.falling = false;
						} else {
							// can walk through the platform & ladder
							if (!collision.xprop.isPlatform && !collision.xprop.isLadder) {
								if (collision.xprop.isBreakable	&& this.canBreakTile) {
									// remove the tile
									me.game.currentLevel.clearTile(collision.xtile.row,	collision.xtile.col);
									if (this.onTileBreak) {
										this.onTileBreak();
									}
								} else {
									this.vel.x = 0;
								}
							}
						}
					}

					
					// update player position
					this.pos.add(this.vel);
					
					// returns the collision "vector"
					return collision;

				}

	});

	/************************************************************************************/
	/*                                                                                  */
	/*      a Collectable entity                                                        */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * @class
	 * @extends me.ObjectEntity
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.ObjectSettings} settings object settings
	 */
	me.CollectableEntity = me.ObjectEntity.extend(
	/** @scope me.CollectableEntity.prototype */
	{
		/** @private */
		init : function(x, y, settings) {
			// call the parent constructor
			this.parent(x, y, settings);

			// make it collidable
			this.collidable = true;
			this.type = me.game.COLLECTABLE_OBJECT;

		}
	});

	/************************************************************************************/
	/*                                                                                  */
	/*      a non visible entity                                                        */
	/*      NOT FINISHED                                                                */
	/************************************************************************************/
	/**
	 * @class
	 * @extends me.Rect
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the object
	 * @param {int} y the y coordinates of the object
	 * @param {me.ObjectSettings} settings object settings
	 */
	me.InvisibleEntity = me.Rect
			.extend(
			/** @scope me.InvisibleEntity.prototype */
			{
				
			   /**
				* Entity "Game Unique Identifier"<br>
				* @public
				* @type String
				* @name me.ObjectEntity#GUID
				*/
				GUID : null,
				
				// for z ordering
				z : 0,
				collisionBox : null,

				/** @private */
				init : function(x, y, settings) {
					// call the parent constructor
					this.parent(new me.Vector2d(x, y), settings.width, settings.height);

					// create a a default collision rectangle
					this.collisionBox = new me.Rect(this.pos, settings.width, settings.height);
					
					// set the object GUID value
					this.GUID = me.utils.createGUID();
					
					// set the object entity name
					this.name = settings.name?settings.name.toLowerCase():"";
					
					this.visible = true;

					this.collidable = true;

					// just to identify our object
					this.isEntity = true;

				},

				/**
				 * specify the size of the hit box for collision detection<br>
				 * (allow to have a specific size for each object)<br>
				 * e.g. : object with resized collision box :<br>
				 * <img src="me.Rect.colpos.png"/>
				 * @param {int} x x offset (specify -1 to not change the width)
				 * @param {int} w width of the hit box
				 * @param {int} y y offset (specify -1 to not change the height)
				 * @param {int} h height of the hit box
				 */
				updateColRect : function(x, w, y, h) {
					this.collisionBox.adjustSize(x, w, y, h);
				},

				/**
				 * collision detection
				 * @private	 
				 */
				checkCollision : function(obj) {
					var res = this.collisionBox.collideVsAABB(obj.collisionBox);

					if (res.x != 0 || res.y != 0) {
						// notify the object
						this.onCollision(res, obj);
						// return the type 
						res.type = this.type;
						// return a reference of the colliding object
						res.obj  = this;
						return res;
					}
					return null;
				},

				/**
				 * onCollision Event function<br>
				 * called by the game manager when the object collide with shtg<br>
				 * by default, if the object type is Collectable, the destroy function is called
				 * @param {me.Vector2d} res collision vector
				 * @param {me.ObjectEntity} obj the other object that hit this object
				 * @protected
				 */
				onCollision : function(res, obj) {
					// destroy the object if collectable
					if (this.collidable
							&& (this.type == me.game.COLLECTABLE_OBJECT))
						me.game.remove(this);
				},

				/**
				 * Destroy function
				 * @private
				 */
				destroy : function() {
					// call the destroy notification function
					this.onDestroyEvent();
					return true;
				},

				/**
				 * OnDestroy Notification function<br>
				 * Called by engine before deleting the object
				 */
				onDestroyEvent : function() {
					;// to be extended !
				},

				/** @private */
				update : function() {
					return false;
				},

				/** @private */
				draw : function(context) {
					if (me.debug.renderHitBox) {
						// draw the sprite rectangle
						context.strokeStyle = "blue";
						context.strokeRect(this.pos.x - me.game.viewport.pos.x,
								this.pos.y - me.game.viewport.pos.y,
								this.width, this.height);

						this.collisionBox.draw(context);
					}

				}
			});

	/************************************************************************************/
	/*                                                                                  */
	/*      a level entity                                                              */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * @class
	 * @extends me.InvisibleEntity
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the object
	 * @param {int} y the y coordinates of the object
	 * @param {me.ObjectSettings} settings object settings
	 */
	me.LevelEntity = me.InvisibleEntity.extend(
	/** @scope me.LevelEntity.prototype */
	{
		/** @private */
		init : function(x, y, settings) {
			this.parent(x, y, settings);

			this.nextlevel = settings.to;

			this.fade = settings.fade;
			this.duration = settings.duration;
			this.fading = false;

			// a temp variable
			this.gotolevel = settings.to;

		},

		/**
		 * @private
		 */
		onFadeComplete : function() {
			me.levelDirector.loadLevel(this.gotolevel);
			me.game.viewport.fadeOut(this.fade, this.duration);
		},

		/**
		 * go to the specified level
		 * @protected
		 */
		goTo : function(level) {
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

		/** @private */
		onCollision : function() {
			this.goTo();
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
