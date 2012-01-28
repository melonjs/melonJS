/* -----

	game object
		
	------			*/

	/************************************************************************************/
	/*																					*/
	/*			a player entity															*/
	/*																					*/
	/************************************************************************************/
	var PlayerEntity = me.ObjectEntity.extend(
	{	

		init:function (x, y, settings)
		{
			// define this here, since not defined in tiled
			settings.image = "alexkidd";
			settings.transparent_color = "#ff00ff";
			settings.spritewidth = 17;
			settings.spriteheight = 26;
			
			// call the constructor
			this.parent(x, y , settings);
			
			// set the walking & jumping speed
			this.setVelocity(2.5, 12);
			
			// add friction
			this.setFriction(0.5);
			
			// adjust the bounding box
			this.updateColRect(1,14, -1,0);
						
			// set the display to follow our position on both axis
			me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
         
			// adjust the deadzone
			me.game.viewport.setDeadzone( me.game.viewport.width/6,  me.game.viewport.height/4);
			
			// standing animation
			this.addAnimation ("stand",  [9]);
			// walking animation
			this.addAnimation ("walk",  [1,2,3,0]);
			
			// set default one
			this.setCurrentAnimation("stand");

			
		},
	
		
		/* -----

			update the player pos
			
		------			*/
		update : function ()
		{
				
			if (me.input.isKeyPressed('left')) {
				this.vel.x -= this.accel.x * me.timer.tick;
				this.setCurrentAnimation("walk");
				this.flipX(true);
			}
			else if (me.input.isKeyPressed('right')) {
				this.vel.x += this.accel.x * me.timer.tick;
				this.setCurrentAnimation("walk");
				this.flipX(false);
			}
			else {
				this.setCurrentAnimation("stand");
			}
			
			if (me.input.isKeyPressed('jump')) {	
				this.vel.y = -this.maxVel.y * me.timer.tick;
				this.setCurrentAnimation("walk");
			}
			
			// check & update player movement
			this.updateMovement();
			
			// check for collision with other entities
			me.game.collide(this);
			
			// update animation
			if (this.vel.x!=0 ||this.vel.y!=0)
			{
				// update objet animation
				this.parent(this);
				return true;
			}
			return false;
		}

	});