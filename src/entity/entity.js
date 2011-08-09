/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 * Entity Objects
 *
 * BIG WORK IN PROGRESS :):):)
 *
 */

(function($, undefined)
{
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
   ObjectSettings = 
   {  
      /**
       * image ressource name to be loaded<br>
       * MANDATORY<br>
       * (in case of TiledObject, this field is automatically set)
       * @public
       * @type {String}
       * @name me.ObjectSettings#image
       */
      image: null,
      /**
       * size of a single sprite in the spritesheet<br>
       * MANDATORY<br>
       * (in case of TiledObject, this field is automatically set)
       * @public
       * @type {Int}
       * @name me.ObjectSettings#spritewidth
       */
      spritewidth:null,
      
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
   me.ObjectSettings = ObjectSettings;
   
	/************************************************************************************/
	/*		a pool of entity																					*/
	/*    allowing to add new entity at runtime														*/
	/************************************************************************************/
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
	entityPool = (function()
	{
		// hold public stuff in our singletong
		var obj	= {};
		
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
			
		obj.init = function()
		{
			// add default entity object 
			obj.add ("me.LevelEntity", LevelEntity);
         obj.add ("me.ObjectEntity", ObjectEntity);
         obj.add ("me.CollectableEntity", CollectableEntity);
         obj.add ("me.InvisibleEntity", InvisibleEntity);
		};
		
		/**
		 * add an object to the pool
		 * @name me.entityPool#add
		 * @public
		 * @function
       *	@param {String} className as defined in the Name fied of the Object Properties (in Tiled)
       * @param {Object} object corresponding Object to be instanciated
		 * @example
       * // add our users defined entities in the entity pool
		 * me.entityPool.add("playerspawnpoint", PlayerEntity);
       * me.entityPool.add("cherryentity", CherryEntity);
       * me.entityPool.add("heartentity", HeartEntity);
       * me.entityPool.add("starentity", StarEntity);
       */	
		obj.add = function (className, entityObj)
		{
			entityClass[className.toLowerCase()] = entityObj;
		};
		
		/**
		 *	return a new instance of the requested object
		 * @private	
       */
			
		obj.newIstanceOf = function (prop)
		{
			if (!entityClass[prop.name])
			{
				alert("cannot instance entity of type '" + prop.name + "': Class not found!");
				return null;
			}
			// i should pass the entity ownProperty instead of the object itself
			return new entityClass[prop.name](prop.x, prop.y, prop);
		};
			
		// return our object
		return obj;

	})();
	// expose our object to our scope
	$.me.entityPool = entityPool;
	
	
	/************************************************************************/
   /*	a parallax layer object entity												   */
	/************************************************************************/
	/**
	 * @ignore
	 */
   ParallaxLayer = me.Rect.extend(
   {
      /**
       * @ignore 
       */
      init: function(imagesrc, speed, zOrder)
      {	
         // image..
         this.image =  me.loader.getImage(imagesrc);
         
         // call the parent constructor
         this.parent(new me.Vector2d(0,0), this.image.width, this.image.height);

         // base x offset within the image 
         this.baseOffset = 0;

         // z Index
         this.z = zOrder || 0;

         // layer scroll speed
         this.scrollspeed = speed;

         // link to the gameviewport width
         this.vp_width = me.game.viewport.width;
      },
				
      /*--
		
         draw the layer
		   x coordinate is the current base offset in the texture
		 
      --*/
      draw : function (context, x, y)
      {	
         // all this part should redone !
         var xpos			 = 0;
         var new_width   = MIN(this.width - x, this.vp_width);
         do
         {	
            context.drawImage(this.image, 
                              x,	0,
                              new_width, this.height, 
                              xpos, y, 
                              new_width, this.height);
			
            xpos			+= new_width ;
            x				= 0; // x_offset
            new_width	= MIN(this.width, this.vp_width - xpos);
         }
         while ( (xpos < this.vp_width));
      }
	      
	});
   /************************************************************************************/
   /*		a very basic & cheap parallax object entity												*/
   /*		to be rewritten, this code is not optimized at all	...								*/
   /************************************************************************************/
   /**
    * @constructor
    * @memberOf me
    *	@param {int} [z="0"] z order value for the parallax background
    */
   ParallaxBackgroundEntity = me.Rect.extend(
   {
      /**
		 * @ignore 
		 */
		init: function(z)
		{
         // call the parent constructor
         this.parent(new me.Vector2d(0,0), 0,0);
         
         // to identify the layer in the tilemap system
         this.name = "parallaxBackgroundEntity";

         this.visible = true;

         // z Index
         this.z = z || 0;

         // link to the gameviewport
         this.vp = me.game.viewport.pos;

         // hold the last x position (to track viewport change)
         this.lastx = this.vp.x;

         // hold all defined animation
         this.parallaxLayers = [];

         // keep track of background update (scroll)
         this.updated = true;
		},
      
      /**
       * add a layer to the parallax
       */
      addLayer : function (imagesrc, speed, zOrder)
      {	
         var idx = this.parallaxLayers.length;
         // create the new layer
			this.parallaxLayers.push(new ParallaxLayer(imagesrc, speed, zOrder));
         
         // check if new layer is bigger than the current rect size
         if (this.parallaxLayers[idx].width > this.width)
         {
            // and adjust rect size if necessary
            this.width = this.parallaxLayers[idx].width;
         }
         if (this.parallaxLayers[idx].height > this.height)
         {
            // and adjust rect size if necessary
            this.height = this.parallaxLayers[idx].height;
         }
      },
		
      /**
       * @private
       */
      clearTile : function (x, y)
      {
         ;// do nothing !
      },
		
      /**
       * this method is called by the @see me.game object
       * @protected
       */
      update : function ()
      {	
         return this.updated;
      },
		
      /**
       * override the default me.Rect get Rectangle definition
       * since the layer if a scrolling object
       * (is this correct?)
       * @return {me.Rect} new rectangle	
		 */
      
		getRect : function() 
		{
        return new me.Rect(this.vp.clone(), this.width, this.height);
		},

      
		/**
		 * draw the parallax object on the specified context
		 *	@param {context} context 2D Context
		 * @protected
		 */
		draw : function (context)
		{	
 			// last x pos of the viewport
			x = this.vp.x;
			
			if (x>this.lastx)
			{
				// going right
				for(var i=0, layer;layer = this.parallaxLayers[i++];)
				{
					// calculate the new basoffset
					layer.baseOffset = (layer.baseOffset + layer.scrollspeed * me.timer.tick) % layer.width ;
					// draw the layer
					layer.draw(context, ~~layer.baseOffset, 0);
					// save the last x pos
					this.lastx = x;
               // flag as updated
               this.updated = true;
				}
				return;
			}
			else if (x<this.lastx)
			{
				// going left
				for(var i=0, layer;layer = this.parallaxLayers[i++];)
				{
					// calculate the new basoffset
					layer.baseOffset = (layer.width + (layer.baseOffset - layer.scrollspeed * me.timer.tick)) % layer.width ;
					// draw the layer
					layer.draw(context, ~~layer.baseOffset, 0);
					// save the last x pos
					this.lastx = x;
               // flag as updated
               this.updated = true;
            }
				return;

			} 
			
			// else nothing changes
			for(var i=0, layer;layer = this.parallaxLayers[i++];)
			{	
				// draw the layer
				layer.draw(context, ~~layer.baseOffset, 0);
				// save the last x pos
				this.lastx = x;
            // flag as not updated
            this.updated = false;
			}
		}
      
	});
	// expose our object to me scope
	$.me.ParallaxBackgroundEntity	= ParallaxBackgroundEntity
   
   
	/**
	 * A Simple object to display static or animated sprite on screen.
    * @class
	 *	@extends me.Rect
	 * @memberOf me
	 * @constructor
	 *	@param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.loader#getImage} image reference to the Sprite Image
    * @param {int} [spritewidth] size of a single sprite inside the provided image
    * @example
    * // create a static Sprite Object
    * mySprite = new SpriteObject (100, 100, me.loader.getImage("mySpriteImage"));
	 * // create a animated Sprite Object
    * mySprite = new SpriteObject (100, 100, me.loader.getImage("mySpriteImage"), 64);
	 
    */
	SpriteObject = me.Rect.extend(
	/** @scope me.SpriteObject.prototype */
	{	
		// default pos & scale of the object
		//pos		: null,
		scale		: null,
		
		// just to keep track of when we flip
		lastflipX : false,
		lastflipY : false,
				
								
		// z position (for ordering display)
		z : 0,
		
		// offset of the sprite to be displayed
		currentSprite     : 0,
		currentSpriteOff	: 0,
      	
      // if true, image scaling is needed
		scaleFlag : false,
				
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
		
		// image reference
		image : null,
      
      // create a a default collision rectangle
		// this object is useless here, but low level
      // function like flipX need to take this in account
      collisionBox : null,
		
      // a reference to the game vp 
    	vp : null,
      
      // count the fps and manage animation change
		fpscount : 0,
      
      // animation cyling speed
		animationspeed : 0,

		/**
		 * @ignore 
		 */
		init: function(x, y, image, spritewidth)
		{	
         
         // call the parent constructor
         this.parent(new me.Vector2d(x, y), spritewidth || image.width, image.height);
         
         // cache image reference
			this.image = image;
         
         // #sprite in the image  
			this.spritecount = spritewidth? ~~(image.width / spritewidth):1;
                  
			// scale factor of the object
			this.scale	= new me.Vector2d(1.0, 1.0);
			
 			// create a a default collision rectangle
			this.collisionBox = new me.Rect(this.pos, this.width, this.height);
			
         // get a reference to the current viewport
			this.vp = me.game.viewport;
         
         // default animation speed
			this.animationspeed = me.sys.fps / 10;
         
         // set the current sprite index & offset
         this.currentSprite    = 0,
			this.currentSpriteOff = 0;
         
         
         // if one single image, disable animation
			if (this.image.width == spritewidth)
			{
				this.update = function (){return false;}
			}

		},
		
		
		/**
		 *	Flip object on horizontal axis
		 *	@param {Boolean} flip enable/disable flip
		 */
		flipX : function(flip)
		{
			if (flip != this.lastflipX)
			{
				this.lastflipX = flip;
				
				// invert the scale.x value
				this.scale.x = -this.scale.x;

				// set the scaleFlag
				this.scaleFlag = ((this.scale.x!= 1.0)  || (this.scale.y!= 1.0))
				
            // flip ourself
            //this.parent(this.width);
            
				// flip the collision box
				this.collisionBox.flipX(this.width);
			}
		},
			
		/**
		 *	Flip object on vertical axis
		 *	@param {Boolean} flip enable/disable flip
		 */
		flipY : function(flip)
		{
			if (flip != this.lastflipY)
			{
				this.lastflipY = flip;
				
				// invert the scale.x value
				this.scale.y = -this.scale.y;
				
				// set the scaleFlag
				this.scaleFlag = ((this.scale.x!= 1.0)  || (this.scale.y!= 1.0))
				
            // flip ourself
            //this.parent(this.height);
            
				// flip the collision box
				this.collisionBox.flipY(this.height);

			}
		},
		
		/*---
		
		  scale the object
		 
			NOT WORKING FOR NOW...
		 ---
		scale : function(x, y)
		{
			this.scale_x = this.scale_x < 0.0 ? -x : x;
			this.scale_y = this.scale_y < 0.0 ? -y : y;
			// set the scaleFlag
			this.scaleFlag = ((this.scale_x!= 1.0)  || (this.scale_y!= 1.0))
		};
		*/
      
      /**
		 * set the current sprite
		 * @private
		 */
		
		setCurrentSprite : function(s)
		{
			this.currentSprite = s;
			this.currentSpriteOff = this.width * s;
		},

		
		/**
       * sprite update (animation update)<br>
       * not to be called by the end user<br>
       * called by the game manager on each game loop
       * @protected
		 * @return true if object state changed (position, animation, etc...)
       **/
		update : function()
		{
			if (this.visible && (this.fpscount++ > this.animationspeed))
			{
				//this.setCurrentSprite(++this.currentSprite < this.spritecount ? this.currentSprite : 0);
				this.setCurrentSprite(++this.currentSprite % this.spritecount);
				this.fpscount = 0;
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
		draw : function (context)
		{	
			var xpos = this.pos.x - this.vp.pos.x,
				 ypos = this.pos.y - this.vp.pos.y;
			
			if (this.scaleFlag) 
			{
				context.scale(this.scale.x, this.scale.y);
				
				/*
				 ...??????
				context.translate( - this.width - ((this.width * this.scale_x)),
											 this.height -((this.height * this.scale_y)));
				*/
				
				xpos = (xpos * this.scale.x)-(this.scale.x<0?this.width:0);
				ypos = (ypos * this.scale.y)-(this.scale.y<0?this.height:0);
				
			}
			
			context.drawImage(this.image, 
									this.currentSpriteOff,	0, 
									this.width, this.height,
									~~xpos,     ~~ypos, 
									this.width, this.height);
				
				
			if (this.scaleFlag) 
			{	
				// restore the transform matrix to the normal one
				context.setTransform(1,0,0,1,0,0);
			}
			
			if (me.debug.renderHitBox)
			{
            
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
      destroy : function ()
      {
         // if object can be destroyed
         if (this.autodestroy)
         {
            // call the destroy notification function
            this.onDestroyEvent();
         }
         return this.autodestroy;
		},
		
		
      /**
       * OnDestroy Notification function<br>
       * Called by engine before deleting the object
       */
      onDestroyEvent : function ()
      {
         ;// to be extended !
      }
      
	});
	$.me.SpriteObject = SpriteObject;
		
	
	/************************************************************************************/
	/*																												*/
	/*		a generic object entity																			*/
	/*																												*/
	/************************************************************************************/
	/**
    * an object to manage animation
	 * @class
	 *	@extends me.SpriteObject
	 * @memberOf me
	 * @constructor
	 *	@param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.loader#getImage} Image reference of the animation sheet
	 * @param {int} spritewidth width of the sprite image
	 */
	AnimationSheet = me.SpriteObject.extend(
	/** @scope me.AnimationSheet.prototype */
	{	
		/** @private */
		init : function (x, y, image, spritewidth)
		{
			// hold all defined animation
			this.anim	  = [];
			
			// a flag to reset animation
			this.resetAnim = null;
			
			// default animation sequence
			this.current = null;
			
			// call the constructor
			this.parent(x, y , image, spritewidth);
			
         // if one single image, disable animation
			if (this.image.width == spritewidth)
			{
				this.update = function (){return false;}
			}
			else
			{
				// create a default animation sequence with all sprites
				this.addAnimation ("default", null);
				// set as default
				this.setCurrentAnimation("default");
			}
		},
		
		/**
       * add an animation
		 * @param {String} name animation id
       * @param {Int[]} frame list of sprite offset defining the animaton
       * @example
       * // walking animatin
       * this.addAnimation ("walk", [0,1,2,3,4,5]);
       * // eating animatin
       * this.addAnimation ("eat", [6,6]);
       * // rolling animatin
       * this.addAnimation ("roll", [7,8,9,10]);
       */
		addAnimation : function (name, frame)
		{
			this.anim[name] = {	
										name: null,
										frame:[],
										idx:0,
										length:0
									};
									
			if (frame == null)
			{
				// add them all
				for (var i=0; i < this.spritecount; i++)
				{
					// compute and add the offset of each frame
					//console.log(this.spriteWidth);
					this.anim[name].frame[i] = i * this.width;//spriteWidth
					//console.log(this.anim[name].frame[i]);
				}
				
			}
			else
			{
				var frameidx = 0;
				for (var i=0; i < frame.length; i++)
				{
					// compute and add the offset of each frame
					//console.log(frame[i]);
					this.anim[name].frame[frameidx] = frame[i] * this.width;//spriteWidth
					//console.log(this.anim[name].frame[frameidx]);
					frameidx++;
				}
			}
			this.anim[name].name	  = name;
			this.anim[name].length = this.anim[name].frame.length;
			
			// return the create sequence
			//return this.anim[name];
			
		},
		
		/**		
       * set the current animation
		 * @param {String} name animation id
       * @param {String} [onComplete] animation id to switch to when complete
       * @example
       * // set "walk" animation
       * this.setCurrentAnimation("walk");
       * // set "eat" animation, and switch to "walk" when complete
       * this.setCurrentAnimation("eat", "walk");
       **/
		
		setCurrentAnimation : function(name, resetAnim)
		{
			this.current = this.anim[name];
			this.resetAnim = resetAnim || null;
			this.currentSpriteOff = this.current.frame[this.current.idx];
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
		isCurrentAnimation : function(name)
		{
			return (this.current.name == name);
		},

		
		/**
		 * set the current sprite
		 * @private
		 */
		
		setCurrentSprite : function(s)
		{
			this.current.idx = s;
			this.currentSpriteOff = this.current.frame[s];
		},
		
		/**
		 * update the animation<br>
       * this is automatically called by the game manager {@link me.game}
		 * @protected
		 */
		update : function()
		{
			if (this.visible && (this.fpscount++ > this.animationspeed))
			{
				this.setCurrentSprite(++this.current.idx % this.current.length);
				
				if ((this.current.idx == 0) && this.resetAnim)
					this.setCurrentAnimation(this.resetAnim);
				
				this.fpscount = 0;
				return true;
			}
			return false;
		}
	});
	$.me.AnimationSheet	= AnimationSheet;

	/************************************************************************************/
	/*																												*/
	/*		a generic object entity																			*/
	/*																												*/
	/************************************************************************************/
	/**
    * a Generic Object Entity<br>
    * Object Properties (settings) are to be defined in Tiled, <br> 
    * or when calling the parent constructor
    * 
	 * @class
	 *	@extends me.AnimationSheet
	 * @memberOf me
	 * @constructor
	 *	@param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.ObjectSettings} settings Object Properties as defined in Tiled <br> <img src="object_properties.png"/>
	 */
	ObjectEntity = AnimationSheet.extend(
	/** @scope me.ObjectEntity.prototype */
	{	
      // default type of the object (null)
		type : 0,
      
      // flag to enable/disable collision detection on this object
		collidable : false,
      
		/** @private */
		init: function (x, y, settings)
		{	
         this.parent(x, y , (typeof settings.image == "string")?me.loader.getImage(settings.image):settings.image, settings.spritewidth);
			
			// adjust initial coordinates should be bottom left ones
			this.pos.set(x, y + me.game.currentLevel.tileheight - this.height);
			
			// velocity to be applied on player movement
			this.vel = new me.Vector2d();
			
			// default speed
			this.accel = new me.Vector2d();
			
			// some default contants
			this.gravity  = 0.98;
			
			// just to identify our object
			this.isEntity = true;
			
			// to know if our object can break tiles
			this.canBreakTile = false;
			
			// dead state :)
			this.alive = true;
			
			// some usefull jump variable
			this.falling = false;
			this.jumping = false;
			this.jumpspeed = 0;

			// some usefull slope variable
			this.slopeY		= 0; 
			this.onslope   = false;
			this.onladder  = false;
			
			// to enable collision detection
			this.collidable  = settings.collidable || false;
			//this.collectable = false;
         
         this.type = settings.type || 0;
			
			// to manage the flickering effect
			this.flickering = false;
			this.flickerTimer = -1;
			this.flickercb		= null;

			// ref to the collision map
			this.collisionMap = me.game.collisionMap;
			
			// a callback when the entity break a tile :) 
			this.onTileBreak = null;
		},
		
      /**
		 * specify the size of the hit box for collision detection<br>
		 * (allow to have a specific size for each object)<br>
       * e.g. : object with resized collision box :<br>
       * note : bottom of both rectangle MUST always be aligned !<br>
       * <img src="me.Rect.colpos.png"/>
		 *	@param {int} x x offset (specify -1 to not change the width)
		 * @param {int} w width of the hit box
		 * @param {int} y y offset (specify -1 to not change the height)
		 * @param {int} h height of the hit box
		 */
		updateColRect : function(x, w, y, h) 
		{
			this.collisionBox.adjustSize(x, w, y, h) ;
		},
      
     	/**
       * collision detection
		 * @private	 
       */
		checkCollision : function (obj) 
		{
			var res  = this.collisionBox.collideVsAABB(obj.collisionBox);
			
			if (res.x != 0 || res.y != 0)
			{
				// notify the object
				this.onCollision(res, obj);
				// return the type 
				res.type = this.type;
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
		onCollision : function (res, obj)
		{
			// destroy the object if collectable
			if (this.collidable && (this.type==me.game.COLLECTABLE_OBJECT))
				me.game.remove(this);
		},

      
     /**
		* set the player default velocity<br>
      * @param {Int} x velocity on x axis
      * @param {Int} y velocity on y axis
      * @protected
      */

		setVelocity : function (x, y)
		{
			this.accel.x = (x!=0) ? x : this.accel.x;
			this.accel.y = (x!=0) ? y : this.accel.y; 
		},

	  /**
		* make the player move left of right
      * @param {Boolean} left 
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
		doWalk : function (left)
		{
			this.flipX(left);
			this.vel.x = (left) ? -this.accel.x * me.timer.tick : this.accel.x * me.timer.tick ;
		},
		
		
     /**
		* make the player move up and down<br>
      * only valid is the player is on a ladder
      * @param {Boolean} up 
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
		doClimb : function (up)
		{
			// add the player x acceleration to the y velocity
			if (this.onladder)
			{
				this.vel.y = (up) ? -this.accel.x * me.timer.tick : this.accel.x * me.timer.tick ;
				return true;
			}
			return false;
		},

		
		/* -----

			make the player jump
			
		------			*/
		doJump : function ()
		{
			if (!this.jumping && !this.falling)
			{
				this.jumpspeed = this.accel.y;
				this.jumping	= true;
					
				// adjust y pos if on a slope tile
				if (this.onslope)
				{
					//this.pos.y -= this.slopeY;
					//console.log("jump on slope");
					//this.jumpspeed += this.slopeY;
				}
				return true;
			}
			return false;
		},
		
		/* -----

			force the player to jump
			
		------			*/
		forceJump : function ()
		{
			this.jumping = false;
			this.falling = false;
			this.doJump();	
		},
		
		
		/** 
		 * handle the player movement on a slope
		 *	and update vel value
		 * @private
		 */
		checkSlope : function (tile, left)
		{
		   // first make the object stick to the tile
         this.pos.y  = tile.pos.y - this.height;
         
         // normally the check should be on the object center point, but since the collision check is done
         // on corner, we must do the same thing here
         if (left)
            this.slopeY = tile.height - (this.collisionBox.right + this.vel.x - tile.pos.x);
         else  
            this.slopeY = (this.collisionBox.left  + this.vel.x - tile.pos.x);
         
         // some limit check, workaround when entering/exiting slopes tile
         this.slopeY = this.slopeY.clamp(0, tile.height);
         
         if ((this.vel.x!=0) || this.falling)
         {
            // apply it to vel.y
            this.vel.y = this.slopeY;
         }
         else
         {
            // apply to pos.y, so we don't indicate we actually change pos
            this.vel.y = 0;
            this.pos.y += this.slopeY;
         }
      },
			
	  /**
      * handle the player movement, "trying" to update his position<br>
      * @return {Boolean} <b>true<b> if player position has been updated
      * @example
      * // make the player move
      * if (me.input.isKeyPressed('left'))
      * {
      *     this.doWalk(true);
      * }
      * else if (me.input.isKeyPressed('right'))
      * {
      *     this.doWalk(false);
      * }
      * // update player position
      * this.updateMovement();
		*/
		updateMovement : function ()
		{
			
			// apply gravity on y axis
			if (this.jumping)
			{
				this.jumpspeed	-= this.gravity ;
				if ((this.jumpspeed < 0))// || !me.input.keyStatus('jump')) // jumping)
				{
					this.jumping = false;
					this.falling = true;
					this.vel.y = 0;
					//console.log("falling!");
				}
				else
				this.vel.y = -this.jumpspeed;
		
		//		console.log(this.jumpspeed);
			} 
			// else apply a constant gravity
			else if (!this.onladder)
			{
				//this.jumping = false
				this.falling = true;
				this.vel.y	+= (this.gravity * me.timer.tick);
			} 		
		
					
			// check for collision
			collision = this.collisionMap.checkCollision(this.collisionBox, this.vel);
			
			
			// update some flags
			this.onladder = collision.xprop.isLadder;
			this.onslope  = collision.yprop.isSlope || collision.xprop.isSlope;
			//console.log(this.onslope);
			
			
			// y collision
			if (collision.y)
			{
							
				// going down,
				// collision with the floor
				if (this.vel.y > 0)
				{
					// update the onslope flag
					//this.onslope = collision.yprop.isSlope

					if (collision.yprop.isSolid || (collision.yprop.isPlatform && (~~this.pos.y + this.height <= collision.ytile.pos.y)))
					{
						// round pos.y
						this.pos.y = ~~this.pos.y;
                  // adjust val to tile pos
                  this.vel.y = (this.falling)?collision.ytile.pos.y - this.pos.y - this.height:0;
                  
                  this.falling  = false;
					}
					else if (collision.yprop.isSlope && !this.jumping) // && this.falling
					{	
						// we stop falling
						//this.onslope = true;
						//console.log("yslope");
                  this.checkSlope(collision.ytile, collision.yprop.isLeftSlope);
						//this.onladder = false;
						this.falling  = false;
						//this.jumping  = false;
						//this.onslope  = true;
					}
					else if (collision.yprop.isBreakable)
					{
                  if (this.canBreakTile)
						{  
                     // remove the tile
                     me.game.currentLevel.clearTile(collision.ytile.row, collision.ytile.col);
                     if (this.onTileBreak)
                        this.onTileBreak();
                  }
                  else
                  {
                     // cancel vel and adjust to tile pos
                     // round pos.y
                     this.pos.y = ~~this.pos.y;
                     this.vel.y = (this.falling)?collision.ytile.pos.y - this.pos.y - this.height:0;
                     this.falling  = false;
                  }
               }
				}
				// going up
				// collision with ceiling
				else if (this.vel.y < 0)
				{
					if (!collision.yprop.isPlatform && !collision.yprop.isLadder)
					{
							this.jumping = false;
							this.falling = true;
							// cancel the y velocity
							this.vel.y = 0;
					}
				}
			}
			
			// x collision
			if (collision.x)
			{
				if (collision.xprop.isSlope && !this.jumping)
				{
               this.checkSlope(collision.xtile, collision.xprop.isLeftSlope);
               this.falling = false;
            }
				else 
				{
					// can walk through the platform & ladder
					if (!collision.xprop.isPlatform && !collision.xprop.isLadder)
					{
						if (collision.xprop.isBreakable && this.canBreakTile)
						{
							// remove the tile
							me.game.currentLevel.clearTile(collision.xtile.row, collision.xtile.col);
							if (this.onTileBreak)
							{
                       this.onTileBreak();
                     }
                  }
						else
						{
							this.vel.x = 0;
						}
					}
					// do we climb the ladder
					//this.onladder = collision.xprop.isLadder && (this.vel.x != 0);
					
				}
			}

			// -- THIS SHOULD NOT BE HERE --//
			// update the flickering
			this.updateFlickering();
			
			// check for other necessary updates
			if ((this.vel.x !=0) || (this.vel.y !=0))
			{
				// update player position
				this.pos.add(this.vel);
				
				// once applied cancel cumulative vel.y if onslope and !jumping or on ladder
				if ((this.onslope && !this.jumping) || this.onladder ) 
				{
					this.vel.y = 0;
				}
				
				// update objet animation
				//this.update();

				return true;
			}
			// nothing updated (that happens!)
			return false;

		},

		/**
		 * upate the object "flickering"
		 * @private
		 */
			
		updateFlickering : function ()
		{
			if(this.flickering)
			{
				this.flickerTimer -= me.timer.tick; // should be minus elapsed time;
							
				//console.log(this.flickerTimer);
				
				if(this.flickerTimer < 0)
				{
					if (this.flickercb)
					  this.flickercb();
					this.flicker(-1);
				}
				else
				{
					this.visible = !this.visible;
					return true;
				}
			}
			return false;
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
		flicker : function(duration, callback) 
		{ 
			this.flickerTimer = duration; 
			if (this.flickerTimer < 0) 
			{	
				this.flickering = false; 
				this.visible = true;
				this.flickercb	= null;
			}
			else if (!this.flickering)
			{ 
				this.flickercb	 = callback;
				this.flickering = true; 
			}
		}
      
    	});
	// expose our object to our scope
	$.me.ObjectEntity	= ObjectEntity;
	/************************************************************************************/
	/*																												*/
	/*		a Collectable entity																				*/
	/*																												*/
	/************************************************************************************/
	/**
	 * @class
	 *	@extends me.ObjectEntity
	 * @memberOf me
	 * @constructor
	 *	@param {int} x the x coordinates of the sprite object
	 * @param {int} y the y coordinates of the sprite object
	 * @param {me.ObjectSettings} settings object settings
	 */
	CollectableEntity = ObjectEntity.extend(
	/** @scope me.CollectableEntity.prototype */
	{	
		/** @private */
		init: function(x, y, settings)
		{
			// call the parent constructor
			this.parent(x, y, settings);

			// make it collidable
			this.collidable = true;
			this.type = me.game.COLLECTABLE_OBJECT;
		
		}
	});
	// expose our object to our scope	
	$.me.CollectableEntity = CollectableEntity;

	/************************************************************************************/
	/*																												*/
	/*		a non visible entity																				*/
	/*		NOT FINISHED																						*/
	/************************************************************************************/
	/**
	 * @class
	 *	@extends me.Rect
	 * @memberOf me
	 * @constructor
	 *	@param {int} x the x coordinates of the object
	 * @param {int} y the y coordinates of the object
	 * @param {me.ObjectSettings} settings object settings
	 */
	InvisibleEntity = me.Rect.extend(
	/** @scope me.InvisibleEntity.prototype */
	{	
		// for z ordering
      z : 0,
      collisionBox : null,
      
      
      /** @private */
		init: function(x, y, settings)
		{
			// call the parent constructor
			this.parent(new me.Vector2d(x, y), settings.width, settings.height);
			
			// create a a default collision rectangle
			this.collisionBox = new me.Rect(this.pos, settings.width, settings.height);
			
			this.visible  = true;

         this.collidable  = true;
		
			// just to identify our object
			this.isEntity = true;
         
         
		},
      
      /**
		 * specify the size of the hit box for collision detection<br>
		 * (allow to have a specific size for each object)<br>
       * e.g. : object with resized collision box :<br>
       * note : bottom of both rectangle MUST always be aligned !<br>
       * <img src="me.Rect.colpos.png"/>
		 *	@param {int} x x offset (specify -1 to not change the width)
		 * @param {int} w width of the hit box
		 * @param {int} y y offset (specify -1 to not change the height)
		 * @param {int} h height of the hit box
		 */
		updateColRect : function(x, w, y, h) 
		{
			this.collisionBox.adjustSize(x, w, y, h) ;
		},
      
      /**
       * collision detection
		 * @private	 
       */
		checkCollision : function (obj) 
		{
			var res  = this.collisionBox.collideVsAABB(obj.collisionBox);
			
			if (res.x != 0 || res.y != 0)
			{
				// notify the object
				this.onCollision(res, obj);
				// return the type 
				res.type = this.type;
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
		onCollision : function (res, obj)
		{
			// destroy the object if collectable
			if (this.collidable && (this.type==me.game.COLLECTABLE_OBJECT))
				me.game.remove(this);
		},

      /**
       * Destroy function
		 * @private
       */
      destroy : function ()
      {
         // call the destroy notification function
         this.onDestroyEvent();
         return true;
		},
		
      /**
       * OnDestroy Notification function<br>
       * Called by engine before deleting the object
       */
      onDestroyEvent : function ()
      {
         ;// to be extended !
      },


		/** @private */
		update : function(){return false;},

		/** @private */
		draw	: function(context)
		{  
			if (me.debug.renderHitBox)
			{
            // draw the sprite rectangle
            context.strokeStyle = "blue";
            context.strokeRect(this.pos.x - me.game.viewport.pos.x, 
                               this.pos.y - me.game.viewport.pos.y,
                               this.width, this.height);

				this.collisionBox.draw(context);
			}

		}
	});
	// expose our object to our scope
	$.me.InvisibleEntity	= InvisibleEntity;
	
	/************************************************************************************/
	/*																												*/
	/*		a level entity																						*/
	/*																												*/
	/************************************************************************************/
	/**
	 * @class
	 *	@extends me.InvisibleEntity
	 * @memberOf me
	 * @constructor
	 *	@param {int} x the x coordinates of the object
	 * @param {int} y the y coordinates of the object
	 * @param {me.ObjectSettings} settings object settings
	 */
	LevelEntity = InvisibleEntity.extend(
	/** @scope me.LevelEntity.prototype */
	{	
 		/** @private */
		init:function(x, y, settings)
		{
			this.parent(x, y, settings);
			
			this.nextlevel = settings.to;
         
         this.fade      = settings.fade;
         this.duration  = settings.duration;
         this.fading    = false;
         
         // a temp variable
         this.gotolevel = settings.to;
         
         
		},
		
      /**
       * @private
       */
      onFadeComplete: function()
      {
          me.levelDirector.loadLevel(this.gotolevel);
          me.game.viewport.fadeOut(this.fade, this.duration);
      },
 
		/**
       *	go to the specified level
		 * @protected
       */
		goTo : function(level) 
		{ 
			this.gotolevel = level || this.nextlevel;
			// load a level
			//console.log("going to : ", to);
			if (this.fade && this.duration)
         { 
            if (!this.fading)
            {
               this.fading = true;
               me.game.viewport.fadeIn(this.fade, this.duration, this.onFadeComplete.bind(this));
            }
         }
         else
         { 
            me.levelDirector.loadLevel(this.gotolevel);
         }
		},
		
		/** @private */
		onCollision : function()
		{
			this.goTo();
		}
	});
	// expose our object to our scope
	$.me.LevelEntity = LevelEntity;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);	


