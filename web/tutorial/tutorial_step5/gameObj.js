/* -----

	game object
		
	------			*/

	/*************************/
	/*								 */
	/*		a player entity	 */
	/*								 */
	/*************************/
	var PlayerEntity = me.ObjectEntity.extend(
	{	
      
      /* -----

			constructor
			
		  ------			*/
		
		init:function (x, y, settings)
		{
			// call the constructor
			this.parent(x, y , settings);
			
			// set the walking & jumping speed
			this.setVelocity(3, 15);
         
         // adjust the bounding box
			this.updateColRect(8,48, -1,0);
			
			// set the display to follow our position on both axis
			me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
			
		},
	
		/* -----

			update the player pos
			
		  ------			*/
		update : function ()
		{
				
			if (me.input.isKeyPressed('left'))
			{
				this.doWalk(true);
			}
			else if (me.input.isKeyPressed('right'))
			{
				this.doWalk(false);
			}
			else
			{
				this.vel.x = 0;
			}
			if (me.input.isKeyPressed('jump'))
			{	
				this.doJump();
			}
			
			// check & update player movement
			updated = this.updateMovement();
         
         // check for collision
         res = me.game.collide(this);
         
         if (res)
         {
            if (res.type == me.game.ENEMY_OBJECT)
            {
               if ((res.y>0) && !this.jumping)
               {
                  // bounce
                  this.forceJump();
               }
               else
               {
                  // let's flicker in case we touched an enemy
                  this.flicker(45);
               }
            }
         }
         
					
			// update animation
			if (updated)
			{
				// update objet animation
				this.parent(this);
			}
			return updated;
		}

	});

   /***************************/
	/*							      */
	/*		a Coin entity		   */
	/*								   */
	/***************************/
	var CoinEntity = me.CollectableEntity.extend(
	{	

		init: function (x, y, settings)
		{
			// call the parent constructor
			this.parent(x, y , settings);
		},		
			
		onDestroyEvent : function ()
		{
			// do something when collected
		}
		
	});

	/************************************************************************************/
	/*																												*/
	/*		an enemy Entity																					*/
	/*																												*/
	/************************************************************************************/
	var EnemyEntity = me.ObjectEntity.extend(
	{	
		init: function (x, y, settings)
		{
			// define this here instead of tiled
			settings.image = "wheelie_right";
			settings.spritewidth = 64;
			
			// call the parent constructor
			this.parent(x, y , settings);
			
			this.startX = x;
			this.endX   = x+settings.width - settings.spritewidth; // size of sprite
			
			
			// make him start from the right
			this.pos.x = x + settings.width - settings.spritewidth;
			this.walkLeft = true;

         // walking & jumping speed
			this.setVelocity(4, 6);
			
         // make it collidable
			this.collidable = true;
			this.type = me.game.ENEMY_OBJECT;
			
			// bounding box
			//this.updateColRect(-1,0,4,20);
			
		},
		
		// call by the engine when colliding with another object
      // obj parameter corresponds to the other object (typically the player)	touching this one 
		onCollision : function (res, obj)
		{
				
			// res.y >0 means touched by something on the bottom
			// which mean at top position for this one
			if (this.alive && (res.y > 0) && obj.falling)
			{
		      this.flicker(45);
			}
		},

		
		// manage the enemy movement
		update : function ()
		{
			// do nothing if not visible
			if (!this.visible && !this.flickering)
				return false;
				
			if (this.alive)
			{
				if (this.walkLeft && this.pos.x <= this.startX)
				{
					this.walkLeft = false;
				}
				else if (!this.walkLeft && this.pos.x >= this.endX)
				{
					this.walkLeft = true;
				}
				
				//console.log(this.walkLeft);
				this.doWalk(this.walkLeft);
			}
			else
			{
				this.vel.x = 0;
			}
			// check & update movement
			updated = this.updateMovement();
				
			if (updated)
			{
				// update the object animation
				this.parent();
			}
			return updated;
		}
	});
	

