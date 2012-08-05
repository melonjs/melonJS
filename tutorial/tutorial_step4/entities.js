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
			this.updateMovement();
					
			// update animation
			if (this.vel.x!=0 || this.vel.y!=0)
			{
				// update objet animation
				this.parent(this);
				return true;
			}
			return false;
		}

	});

   /*****************************/
	/*							*/
	/*		a Coin entity		*/
	/*							*/
	/*****************************/
	var CoinEntity = me.CollectableEntity.extend(
	{	

		init: function (x, y, settings)
		{
			// call the parent constructor
			this.parent(x, y , settings);
		},		
			
		onDestroyEvent : function ()
		{
			// do something 
		}
		
	});
