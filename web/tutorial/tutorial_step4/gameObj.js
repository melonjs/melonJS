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
					
			// update animation
			if (updated)
			{
				// update objet animation
				this.parent(this);
			}
			return updated;
		}

	});

   /*****************************/
	/*									  */
	/*		a Coing entity		    */
	/*									  */
	/*****************************/
	var CoinEntity = me.CollectableEntity.extend(
	{	

		init: function (x, y, settings)
		{
			// call the parent constructor
			this.parent(x, y , settings);

			// animation speed		
			//this.animationspeed = 8;
			
			// bounding box
			//this.updateColRect(8,16,16,16);
		},		
			
		onDestroyEvent : function ()
		{
			// do something when collide
			//me.audio.play("cling", false);
			// give some score
			//me.game.HUD.updateItemValue("score", 250);
			
		}
		
	});
