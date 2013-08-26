/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * me.ObjectSettings contains the object attributes defined in Tiled<br>
	 * and is created by the engine and passed as parameter to the corresponding object when loading a level<br>
	 * the field marked Mandatory are to be defined either in Tiled, or in the before calling the parent constructor<br>
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
		 * @type String
		 * @name name
		 * @memberOf me.ObjectSettings
		 */
		name : null,

		/**
		 * image ressource name to be loaded<br>
		 * MANDATORY<br>
		 * (in case of TiledObject, this field is automatically set)
		 * @public
		 * @type String
		 * @name image
		 * @memberOf me.ObjectSettings
		 */
		image : null,

		/**
		 * specify a transparent color for the image in rgb format (#rrggbb)<br>
		 * OPTIONAL<br>
		 * (using this option will imply processing time on the image)
		 * @public
		 * @deprecated Use PNG or GIF with transparency instead
		 * @type String
		 * @name transparent_color
		 * @memberOf me.ObjectSettings
		 */
		transparent_color : null,

		/**
		 * width of a single sprite in the spritesheet<br>
		 * MANDATORY<br>
		 * (in case of TiledObject, this field is automatically set)
		 * @public
		 * @type Int
		 * @name spritewidth
		 * @memberOf me.ObjectSettings
		 */
		spritewidth : null,

		/**
		 * height of a single sprite in the spritesheet<br>
		 * OPTIONAL<br>
		 * if not specified the value will be set to the corresponding image height<br>
		 * (in case of TiledObject, this field is automatically set)
		 * @public
		 * @type Int
		 * @name spriteheight
		 * @memberOf me.ObjectSettings
		 */
		spriteheight : null,


		/**
		 * custom type for collision detection<br>
		 * OPTIONAL
		 * @public
		 * @type String
		 * @name type
		 * @memberOf me.ObjectSettings
		 */
		type : 0,

		/**
		 * Enable collision detection for this object<br>
		 * OPTIONAL
		 * @public
		 * @type Boolean
		 * @name collidable
		 * @memberOf me.ObjectSettings
		 */
		collidable : true
	};


	/**
	 * A pool of Object entity <br>
	 * This object is used for object pooling - a technique that might speed up your game
	 * if used properly. <br>
	 * If some of your classes will be instantiated and removed a lot at a time, it is a
	 * good idea to add the class to this entity pool. A separate pool for that class
	 * will be created, which will reuse objects of the class. That way they won't be instantiated
	 * each time you need a new one (slowing your game), but stored into that pool and taking one
	 * already instantiated when you need it.<br><br>
	 * This object is also used by the engine to instantiate objects defined in the map,
	 * which means, that on level loading the engine will try to instantiate every object
	 * found in the map, based on the user defined name in each Object Properties<br>
	 * <img src="images/object_properties.png"/><br>
	 * There is no constructor function for me.entityPool, this is a static object
	 * @namespace me.entityPool
	 * @memberOf me
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
			obj.add("me.ObjectEntity", me.ObjectEntity);
			obj.add("me.CollectableEntity", me.CollectableEntity);
			obj.add("me.LevelEntity", me.LevelEntity);
		};

		/**
		 * Add an object to the pool. <br>
		 * Pooling must be set to true if more than one such objects will be created. <br>
		 * (note) If pooling is enabled, you shouldn't instantiate objects with `new`.
		 * See examples in {@link me.entityPool#newInstanceOf}
		 * @name add
		 * @memberOf me.entityPool
		 * @public
		 * @function
		 * @param {String} className as defined in the Name field of the Object Properties (in Tiled)
		 * @param {Object} class corresponding Class to be instantiated
		 * @param {Boolean} [objectPooling=false] enables object pooling for the specified class
		 * - speeds up the game by reusing existing objects
		 * @example
		 * // add our users defined entities in the entity pool
		 * me.entityPool.add("playerspawnpoint", PlayerEntity);
		 * me.entityPool.add("cherryentity", CherryEntity, true);
		 * me.entityPool.add("heartentity", HeartEntity, true);
		 * me.entityPool.add("starentity", StarEntity, true);
		 */
		obj.add = function(className, entityObj, pooling) {
			if (!pooling) {
				entityClass[className.toLowerCase()] = {
					"class" : entityObj,
					"pool" : undefined
				};
				return;
			}

			entityClass[className.toLowerCase()] = {
				"class" : entityObj,
				"pool" : [],
				"active" : []
			};
		};

		/**
		 * Return a new instance of the requested object (if added into the object pool)
		 * @name newInstanceOf
		 * @memberOf me.entityPool
		 * @public
		 * @function
		 * @param {String} className as used in {@link me.entityPool#add}
		 * @param {} [arguments...] arguments to be passed when instantiating/reinitializing the object
		 * @example
		 * me.entityPool.add("player", PlayerEntity);
		 * var player = me.entityPool.newInstanceOf("player");
		 * @example
		 * me.entityPool.add("bullet", BulletEntity, true);
		 * me.entityPool.add("enemy", EnemyEntity, true);
		 * // ...
		 * // when we need to manually create a new bullet:
		 * var bullet = me.entityPool.newInstanceOf("bullet", x, y, direction);
		 * // ...
		 * // params aren't a fixed number
		 * // when we need new enemy we can add more params, that the object construct requires:
		 * var enemy = me.entityPool.newInstanceOf("enemy", x, y, direction, speed, power, life);
		 * // ...
		 * // when we want to destroy existing object, the remove 
		 * // function will ensure the object can then be reallocated later
		 * me.game.remove(enemy);
		 * me.game.remove(bullet);
		 */

		obj.newInstanceOf = function(data) {
			var name = typeof data === 'string' ? data.toLowerCase() : undefined;
			if (name && entityClass[name]) {
				if (!entityClass[name]['pool']) {
					var proto = entityClass[name]["class"];
					arguments[0] = proto;
					return new (proto.bind.apply(proto, arguments))();
				}
				
				var obj, entity = entityClass[name], proto = entity["class"];
				if (entity["pool"].length > 0) {
					obj = entity["pool"].pop();
					obj.init.apply(obj, Array.prototype.slice.call(arguments, 1));
				} else {
					arguments[0] = proto;
					obj = new (proto.bind.apply(proto, arguments))();
					obj.className = name;
				}

				entity["active"].push(obj);
				return obj;
			}

			// Tile objects can be created with a GID attribute;
			// The TMX parser will use it to create the image property.
			var settings = arguments[3];
			if (settings && settings.image) {
				return new me.SpriteObject(settings.x, settings.y, settings.image);
			}

			if (name) {
				console.error("Cannot instantiate entity of type '" + data + "': Class not found!");
			}
			return null;
		};

		/**
		 * purge the entity pool from any inactive object <br>
		 * Object pooling must be enabled for this function to work<br>
		 * note: this will trigger the garbage collector
		 * @name purge
		 * @memberOf me.entityPool
		 * @public
		 * @function
		 */
		obj.purge = function() {
			for (className in entityClass) {
				entityClass[className]["pool"] = [];
			}
		};

		/**
		 * Remove object from the entity pool <br>
		 * Object pooling for the object class must be enabled,
		 * and object must have been instantiated using {@link me.entityPool#newInstanceOf},
		 * otherwise this function won't work
		 * @name freeInstance
		 * @memberOf me.entityPool
		 * @public
		 * @function
		 * @param {Object} instance to be removed 
		 */
		obj.freeInstance = function(obj) {

			var name = obj.className;
			if (!name || !entityClass[name]) {
				return;
			}

			var notFound = true;
			for (var i = 0, len = entityClass[name]["active"].length; i < len; i++) {
				if (entityClass[name]["active"][i] === obj) {
					notFound = false;
					entityClass[name]["active"].splice(i, 1);
					break;
				}
			}

			if (notFound) {
				return;
			}

			entityClass[name]["pool"].push(obj);
		};

		// return our object
		return obj;

	})();


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
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.ObjectSettings} settings Object Properties as defined in Tiled <br> <img src="images/object_properties.png"/>
	 */
	me.ObjectEntity = me.Renderable.extend(
	/** @scope me.ObjectEntity.prototype */ {
	
	   /**
		* Entity "Game Unique Identifier"<br>
		* @public
		* @type String
		* @name GUID
		* @memberOf me.ObjectEntity
		*/
		GUID : null,

		/**
		 * define the type of the object<br>
		 * default value : none<br>
		 * @public
		 * @type String
		 * @name type
		 * @memberOf me.ObjectEntity
		 */
		type : 0,

		/**
		 * flag to enable collision detection for this object<br>
		 * default value : true<br>
		 * @public
		 * @type Boolean
		 * @name collidable
		 * @memberOf me.ObjectEntity
		 */
		collidable : true,
		
		
		/**
		 * Entity collision Box<br>
		 * @public
		 * @type me.Rect
		 * @name collisionBox
		 * @memberOf me.ObjectEntity
		 */
		collisionBox : null,

		/**
		 * The entity renderable object (if defined)
		 * @public
		 * @type me.Renderable
		 * @name renderable
		 * @memberOf me.ObjectEntity
		 */
		renderable : null,
		
		// just to keep track of when we flip
		lastflipX : false,
		lastflipY : false,
		
		
		/** @ignore */
		init : function(x, y, settings) {
			
			// call the parent constructor
			this.parent(new me.Vector2d(x, y),
						~~settings.spritewidth  || ~~settings.width,
						~~settings.spriteheight || ~~settings.height);
			
			if (settings.image) {
				var image = (typeof settings.image == "string") ? me.loader.getImage(settings.image) : settings.image
				this.renderable = new me.AnimationSheet(0, 0, image,
														~~settings.spritewidth,
														~~settings.spriteheight,
														~~settings.spacing,
														~~settings.margin);
				
				// check for user defined transparent color
				if (settings.transparent_color) {
					this.renderable.setTransparency(settings.transparent_color);
				}
			}

			// set the object GUID value
			this.GUID = me.utils.createGUID();

			// set the object entity name
			this.name = settings.name?settings.name.toLowerCase():"";

			/**
			 * entity current velocity<br>
			 * @public
			 * @type me.Vector2d
			 * @name vel
			 * @memberOf me.ObjectEntity
			 */
			this.vel = new me.Vector2d();

			/**
			 * entity current acceleration<br>
			 * @public
			 * @type me.Vector2d
			 * @name accel
			 * @memberOf me.ObjectEntity
			 */
			this.accel = new me.Vector2d();

			/**
			 * entity current friction<br>
			 * @public
			 * @name friction
			 * @memberOf me.ObjectEntity
			 */
			this.friction = new me.Vector2d();

			/**
			 * max velocity (to limit entity velocity)<br>
			 * @public
			 * @type me.Vector2d
			 * @name maxVel
			 * @memberOf me.ObjectEntity
			 */
			this.maxVel = new me.Vector2d(1000,1000);

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
			this.gravity = (me.sys.gravity!=undefined)?me.sys.gravity:0.98;

			// just to identify our object
			this.isEntity = true;
			
			// dead state :)
			/**
			 * dead/living state of the entity<br>
			 * default value : true
			 * @public
			 * @type Boolean
			 * @name alive
			 * @memberOf me.ObjectEntity
			 */
			this.alive = true;
			
			// make sure it's visible by default
			this.visible = true;
			
			// and also non floating by default
			this.floating = false;
			
			// and non persistent per default
			this.isPersistent = false;

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
			this.collidable = typeof(settings.collidable) !== "undefined" ?	settings.collidable : true;
			
			// default objec type
			this.type = settings.type || 0;
			
			// default flip value
			this.lastflipX = this.lastflipY = false;
			
			// ref to the collision map
			this.collisionMap = me.game.collisionMap;
			
			// create a a default collision rectangle
			this.collisionBox = new me.Rect(this.pos, this.width, this.height);
			
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
		},

		/**
		 * specify the size of the hit box for collision detection<br>
		 * (allow to have a specific size for each object)<br>
		 * e.g. : object with resized collision box :<br>
		 * <img src="images/me.Rect.colpos.png"/>
		 * @name updateColRect
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {int} x x offset (specify -1 to not change the width)
		 * @param {int} w width of the hit box
		 * @param {int} y y offset (specify -1 to not change the height)
		 * @param {int} h height of the hit box
		 */
		updateColRect : function(x, w, y, h) {
			this.collisionBox.adjustSize(x, w, y, h);
		},

		/**
		 * onCollision Event function<br>
		 * called by the game manager when the object collide with shtg<br>
		 * by default, if the object type is Collectable, the destroy function is called
		 * @name onCollision
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {me.Vector2d} res collision vector
		 * @param {me.ObjectEntity} obj the other object that hit this object
		 * @protected
		 */
		onCollision : function(res, obj) {
			// destroy the object if collectable
			if (this.collidable	&& (this.type == me.game.COLLECTABLE_OBJECT))
				me.game.remove(this);
		},

		/**
		 * set the entity default velocity<br>
		 * note : velocity is by default limited to the same value, see setMaxVelocity if needed<br>
		 * @name setVelocity
		 * @memberOf me.ObjectEntity
		 * @function
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
		 * @name setMaxVelocity
		 * @memberOf me.ObjectEntity
		 * @function
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
		 * @name setFriction
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {Int} x horizontal friction
		 * @param {Int} y vertical friction
		 * @protected
		 */
		setFriction : function(x, y) {
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
		flipX : function(flip) {
			if (flip != this.lastflipX) {
				this.lastflipX = flip;
				if (this.renderable && this.renderable.flipX) {
					// flip the animation
					this.renderable.flipX(flip);
				}
				// flip the collision box
				this.collisionBox.flipX(this.width);
			}
		},

		/**
		 * Flip object on vertical axis
		 * @name flipY
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {Boolean} flip enable/disable flip
		 */
		flipY : function(flip) {
			if (flip != this.lastflipY) {
				this.lastflipY = flip;
				if (this.renderable  && this.renderable.flipY) {
					// flip the animation
					this.renderable.flipY(flip);
				}
				// flip the collision box
				this.collisionBox.flipY(this.height);
			}
		},


		/**
		 * helper function for platform games: <br>
		 * make the entity move left of right<br>
		 * @name doWalk
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {Boolean} left will automatically flip horizontally the entity sprite
		 * @protected
		 * @deprecated
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
		 * @name doClimb
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {Boolean} up will automatically flip vertically the entity sprite
		 * @protected
		 * @deprecated
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
				this.disableTopLadderCollision = !up;
				return true;
			}
			return false;
		},


		/**
		 * helper function for platform games: <br>
		 * make the entity jump<br>
		 * @name doJump
		 * @memberOf me.ObjectEntity
		 * @function
		 * @protected
		 * @deprecated
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
		 * @name forceJump
		 * @memberOf me.ObjectEntity
		 * @function
		 * @protected
		 * @deprecated
		 */
		forceJump : function() {
			this.jumping = this.falling = false;
			this.doJump();
		},


		/**
		 * return the distance to the specified entity
		 * @name distanceTo
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {me.ObjectEntity} entity Entity
		 * @return {float} distance
		 */
		distanceTo: function(e)
		{
			// the me.Vector2d object also implements the same function, but
			// we have to use here the center of both entities
			var dx = (this.pos.x + this.hWidth)  - (e.pos.x + e.hWidth);
			var dy = (this.pos.y + this.hHeight) - (e.pos.y + e.hHeight);
			return Math.sqrt(dx*dx+dy*dy);
		},
		
		/**
		 * return the distance to the specified point
		 * @name distanceToPoint
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {me.Vector2d} vector vector
		 * @return {float} distance
		 */
		distanceToPoint: function(v)
		{
			// the me.Vector2d object also implements the same function, but
			// we have to use here the center of both entities
			var dx = (this.pos.x + this.hWidth)  - (v.x);
			var dy = (this.pos.y + this.hHeight) - (v.y);
			return Math.sqrt(dx*dx+dy*dy);
		},
		
		/**
		 * return the angle to the specified entity
		 * @name angleTo
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {me.ObjectEntity} entity Entity
		 * @return {Number} angle in radians
		 */
		angleTo: function(e)
		{
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
		angleToPoint: function(v)
		{
			// the me.Vector2d object also implements the same function, but
			// we have to use here the center of both entities
			var ax = (v.x) - (this.pos.x + this.hWidth);
			var ay = (v.y) - (this.pos.y + this.hHeight);
			return Math.atan2(ay, ax);
		},


		/**
		 * handle the player movement on a slope
		 * and update vel value
		 * @ignore
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
		 * @ignore
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
		 * else if(res.y != 0)
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
		updateMovement : function() {

			this.computeVelocity(this.vel);
			
			// Adjust position only on collidable object
			if (this.collidable) {
				// check for collision
				var collision = this.collisionMap.checkCollision(this.collisionBox, this.vel);

				// update some flags
				this.onslope  = collision.yprop.isSlope || collision.xprop.isSlope;
				// clear the ladder flag
				this.onladder = false;



				// y collision
				if (collision.y) {
					// going down, collision with the floor
					this.onladder = collision.yprop.isLadder || collision.yprop.isTopLadder;

					if (collision.y > 0) {
						if (collision.yprop.isSolid	|| 
							(collision.yprop.isPlatform && (this.collisionBox.bottom - 1 <= collision.ytile.pos.y)) ||
							(collision.yprop.isTopLadder && !this.disableTopLadderCollision)) {
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
								me.game.currentLevel.clearTile(collision.ytile.col, collision.ytile.row);
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
						if (!collision.yprop.isPlatform	&& !collision.yprop.isLadder && !collision.yprop.isTopLadder) {
							this.falling = true;
							// cancel the y velocity
							this.vel.y = 0;
						}
					}
				}

				// x collision
				if (collision.x) {

					this.onladder = collision.xprop.isLadder || collision.yprop.isTopLadder;

					if (collision.xprop.isSlope && !this.jumping) {
						this.checkSlope(collision.xtile, collision.xprop.isLeftSlope);
						this.falling = false;
					} else {
						// can walk through the platform & ladder
						if (!collision.xprop.isPlatform && !collision.xprop.isLadder && !collision.xprop.isTopLadder) {
							if (collision.xprop.isBreakable	&& this.canBreakTile) {
								// remove the tile
								me.game.currentLevel.clearTile(collision.xtile.col, collision.xtile.row);
								if (this.onTileBreak) {
									this.onTileBreak();
								}
							} else {
								this.vel.x = 0;
							}
						}
					}
				}
			}

			// update player position
			this.pos.add(this.vel);

			// returns the collision "vector"
			return collision;

		},
		
		/**
		 * Checks if this entity collides with others entities.
		 * @public
		 * @name collide
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (if multiple collision){@link me.Rect#collideVsAABB}
		 * @example
		 * // update player movement
		 * this.updateMovement();
		 *
		 * // check for collision with other objects
		 * res = this.collide();
		 *
		 * // check if we collide with an enemy :
		 * if (res && (res.obj.type == me.game.ENEMY_OBJECT))
		 * {
		 *   if (res.x != 0)
		 *   {
		 *      // x axis
		 *      if (res.x<0)
		 *         console.log("x axis : left side !");
		 *      else
		 *         console.log("x axis : right side !");
		 *   }
		 *   else
		 *   {
		 *      // y axis
		 *      if (res.y<0)
		 *         console.log("y axis : top side !");
		 *      else
		 *         console.log("y axis : bottom side !");
		 *   }
		 * }
		 */
		collide : function(multiple) {
			return me.game.collide(this, multiple || false);
		},

		/**
		 * Checks if the specified entity collides with others entities of the specified type.
		 * @public
		 * @name collideType
		 * @memberOf me.ObjectEntity
		 * @function
		 * @param {String} type Entity type to be tested for collision
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
		 */
		collideType : function(type, multiple) {
			return me.game.collideType(this, type, multiple || false);
		},
		
		/** @ignore */
		update : function() {
			if (this.renderable) {
				return this.renderable.update();
			}
			return false;
		},
		
		/**
		 * @ignore	
		 */
		getRect : function() {
			if (this.renderable) {
				// translate the renderable position since its 
				// position is relative to this entity
				return this.renderable.getRect().translateV(this.pos);
			}
			return null;
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
		draw : function(context) {
			// draw the sprite if defined
			if (this.renderable) {
				// translate the renderable position (relative to the entity)
				// and keeps it in the entity defined bounds
				// anyway to optimize this ?
				var x = ~~(this.pos.x + (this.anchorPoint.x * (this.width - this.renderable.width)));
				var y = ~~(this.pos.y + (this.anchorPoint.y * (this.height - this.renderable.height)));
				context.translate(x, y);
				this.renderable.draw(context);
				context.translate(-x, -y);
			}
		},
		
		/**
		 * Destroy function<br>
		 * @ignore
		 */
		destroy : function() {
			// free some property objects
			if (this.renderable) {
				this.renderable.destroy.apply(this.renderable, arguments);
				this.renderable = null;
			}
			this.onDestroyEvent.apply(this, arguments);
			this.pos = null;
			this.collisionBox = null;
		},

		/**
		 * OnDestroy Notification function<br>
		 * Called by engine before deleting the object
		 * @name onDestroyEvent
		 * @memberOf me.ObjectEntity
		 * @function
		 */
		onDestroyEvent : function() {
			;// to be extended !
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
		/** @ignore */
		init : function(x, y, settings) {
			// call the parent constructor
			this.parent(x, y, settings);

			this.type = me.game.COLLECTABLE_OBJECT;

		}
	});

	/************************************************************************************/
	/*                                                                                  */
	/*      a level entity                                                              */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * @class
	 * @extends me.ObjectEntity
	 * @memberOf me
	 * @constructor
	 * @param {int} x the x coordinates of the object
	 * @param {int} y the y coordinates of the object
	 * @param {me.ObjectSettings} settings object settings
	 */
	me.LevelEntity = me.ObjectEntity.extend(
	/** @scope me.LevelEntity.prototype */
	{
		/** @ignore */
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
		 * @ignore
		 */
		onFadeComplete : function() {
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

		/** @ignore */
		onCollision : function() {
			this.goTo();
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
