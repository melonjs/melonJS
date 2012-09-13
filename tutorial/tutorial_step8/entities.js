/* -----

	game object
		
	------			*/

	/*************************/
	/*						 */
	/*		a player entity	 */
	/*						 */
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
			me.game.viewport.follow(this.pos, me.game.viewport.AXIS.HORIZONTAL);
			
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
				if (this.doJump())
				{
					me.audio.play("jump");
				}
			}
			
			// check & update player movement
			this.updateMovement();
         
			// check for collision
			var res = me.game.collide(this);
			 
			if (res)
			{
				if (res.obj.type == me.game.ENEMY_OBJECT)
				{
				   if ((res.y>0) && !this.jumping)
				   {
					  // bounce
					   me.audio.play("stomp");
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
			if (this.vel.x!=0 || this.vel.y!=0)
			{
				// update object animation
				this.parent();
				return true;
			}
			return false;
		}

	});

   /****************************/
	/*                         */
	/*		a Coin entity	   */
	/*						   */
	/***************************/
	var CoinEntity = me.CollectableEntity.extend(
	{	

		init: function (x, y, settings)
		{
			// call the parent constructor
			this.parent(x, y , settings);
		},		
			
		onCollision : function ()
		{
			// do something when collide
			me.audio.play("cling");
			// give some score
			me.game.HUD.updateItemValue("score", 250);
			// make sure it cannot be collected "again"
			this.collidable = false;
			// remove it
			me.game.remove(this);
			
		}
		
	});

	/************************************************************************************/
	/*																					*/
	/*		an enemy Entity																*/
	/*																					*/
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
			this.updateColRect(4,56,8,56);
			
		},
		
			
		onCollision : function (res, obj)
		{
				
			// res.y >0 means touched by something on the bottom
			// which mean at top position for this one
			if (this.alive && (res.y > 0) && obj.falling)
			{
				// make it flicker
				this.flicker(45);
			}
		},

		
		// manage the enemy movement
		update : function ()
		{
			// do nothing if not visible
			if (!this.visible)
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
				this.doWalk(this.walkLeft);
			}
			else
			{
				this.vel.x = 0;
			}
			
			// check & update movement
			this.updateMovement();
			
			//update animation if necessary
			if (this.vel.x!=0 ||this.vel.y!=0)
			{
				// update the object animation
				this.parent();
				return true;
			}
			return false;
		}
	});
	
   /****************************/
	/*                         */
	/*		a score HUD Item   */
	/*						   */
	/***************************/

   
   var ScoreObject = me.HUD_Item.extend(
	{	
		init: function(x, y)
		{
         // call the parent constructor
			this.parent(x, y);
			// create a font
			this.font = new me.BitmapFont("32x32_font", 32);
		},
		/* -----

			draw our score
			
		------			*/
		draw : function (context, x, y)
		{
			this.font.draw (context, this.value, this.pos.x +x, this.pos.y+y);
		}
	
	});
