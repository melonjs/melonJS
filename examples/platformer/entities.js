/* -----

game object
	
------ */

/************************************************************************************/
/*																					*/
/*		a player entity																*/
/*																					*/
/************************************************************************************/
var PlayerEntity = me.ObjectEntity.extend({	
	init: function(x, y, settings) {
		// call the constructor
		this.parent(x, y , settings);
		
		// walking & jumping speed
		this.setVelocity(3, 15);
		
		this.setFriction(0.4,0);
		
		// update the hit box
		this.updateColRect(20,32, -1,0);
		
		this.dying = false;
		
		this.mutipleJump = 1;
	
		// set the display around our position
		me.game.viewport.follow(this, me.game.viewport.AXIS.HORIZONTAL);
				
		// enable keyboard
		me.input.bindKey(me.input.KEY.LEFT,	 "left");
		me.input.bindKey(me.input.KEY.RIGHT, "right");
		me.input.bindKey(me.input.KEY.X,	"jump", true);
		me.input.bindKey(me.input.KEY.UP,	"up");
		me.input.bindKey(me.input.KEY.DOWN,	"down");

		// walking animatin
		this.addAnimation ("walk",  [0,2,1]);
		
		// set default one
		this.setCurrentAnimation("walk");
	},
	
	/* -----

		update the player pos
		
	------			*/
	update : function () {
		
		if (me.input.isKeyPressed('left'))	{
			this.vel.x -= this.accel.x * me.timer.tick;
			this.flipX(true);
		} else if (me.input.isKeyPressed('right')) {
			this.vel.x += this.accel.x * me.timer.tick;
			this.flipX(false);
		}
		
		if (me.input.isKeyPressed('jump')) {
			
			// reset the dblJump flag if off the ground
			this.mutipleJump = (this.vel.y === 0)?1:this.mutipleJump;
			
			if (this.mutipleJump<=2) {
				// easy 'math' for double jump
				this.vel.y -= (this.maxVel.y * this.mutipleJump++) * me.timer.tick;
				me.audio.play("jump", false);
			}
		}
			
		// check for collision with environment
		this.updateMovement();
		
		// check if we felt into a hole
		if (this.pos.y + this.height > me.game.currentLevel.realheight) {
			// if yes reset the game
			me.game.remove(this);
			me.game.viewport.fadeIn('#fff', 150, function(){
				me.audio.play("die", false);
				me.levelDirector.reloadLevel();
				me.game.viewport.fadeOut('#fff', 150);
			});
			
		}
		
		// check for collision with sthg
		var res = me.game.collide(this);

		if (res) {
			switch (res.obj.type) {	
				case me.game.ENEMY_OBJECT : {
					if ((res.y>0) && this.falling) {
						// jump
						this.vel.y -= this.maxVel.y * me.timer.tick;
					} else {
						this.hurt();
					}
					break;
				}
				
				case "spikeObject" :{
					// jump & die
					this.vel.y -= this.maxVel.y * me.timer.tick;
					this.hurt();
					break;
				}

				default : break;
			}
		}
		
		// check if we moved
		if (this.vel.x!=0 || this.vel.y!=0 || this.isFlickering()) {
			this.parent();
			return true;
		}
		
		return false;
	},

	
	/**
	 * ouch
	 */
	hurt : function () {
		if (!this.flickering)
		{
			this.flicker(45);
			// flash the screen
			me.game.viewport.fadeIn("#FFFFFF", 75);
			me.audio.play("die", false);
		}
	}
});

/**
 * a coin (collectable) entiry
 */
var CoinEntity = me.CollectableEntity.extend({	
	/** 
	 * constructor
	 */
	init: function (x, y, settings) {
		// define this here instead of tiled
		settings.image = "coin_sheet";
		settings.spritewidth = 35;
		
		// call the parent constructor
		this.parent(x, y , settings);

		// animation speed		
		this.animationspeed = 8;
		
		// bounding box
		//this.updateColRect(8,16,16,16);
		
		// walking animatin
		this.addAnimation("spin", [0,1,2,3]);
		
		this.setCurrentAnimation("spin");
		
	},		
	
	/** 
	 * collision handling
	 */
	onCollision : function () {
		// do something when collide
		me.audio.play("cling", false);
		// give some score
		me.game.HUD.updateItemValue("score", 250);
		
		//avoid further collision and delete it
		this.collidable = false;
		me.game.remove(this);
	}
	
});

/**
 * An enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
var PathEnemyEntity = me.ObjectEntity.extend({	
	/**
	 * constructor
	 */
	init: function (x, y, settings) {
		// call the parent constructor
		this.parent(x, y , settings);
		
		// apply gravity setting if specified
		this.gravity = settings.gravity || me.sys.gravity;
		
		// set start/end position
		this.startX = x;
		this.endX   = x + settings.width - settings.spritewidth
		this.pos.x  = x + settings.width - settings.spritewidth;
		
		this.walkLeft = false;

		// walking & jumping speed
		this.setVelocity(settings.velX || 1, settings.velY || 6);
		
		// make it collidable
		this.collidable = true;
		this.type = me.game.ENEMY_OBJECT;
	
		// custom animation speed ?
		if (settings.animationspeed) {
			this,animationspeed = settings.animationspeed; 
		}
		
		// walking animatin
		this.addAnimation ("walk", [0,1]);
		// dead animatin
		this.addAnimation ("dead", [2]);
		
		// set default one
		this.setCurrentAnimation("walk");
	},
		
	
	/**
	 * manage the enemy movement
	 */
	update : function () {
		// do nothing if not visible
		if (!this.inViewport) {
			return false;
		}
		
		if (this.alive)	{
			if (this.walkLeft && this.pos.x <= this.startX) {
				this.vel.x = this.accel.x * me.timer.tick;
				this.walkLeft = false;
				this.flipX(true);
			} else if (!this.walkLeft && this.pos.x >= this.endX) {
				this.vel.x = -this.accel.x * me.timer.tick;
				this.walkLeft = true;
				this.flipX(false);
			}
		} else {
			this.vel.x = 0;
		}
		
		// check & update movement
		this.updateMovement();
		
		// call the parent function
		this.parent();
		// return true if we moved of if flickering
		return (this.vel.x != 0 || this.vel.y != 0 || this.isFlickering());
	},
	
	/**
	 * collision handle
	 */
	onCollision : function (res, obj) {
		// res.y >0 means touched by something on the bottom
		// which mean at top position for this one
		if (this.alive && (res.y > 0) && obj.falling) {
			// make it dead
			this.alive = false;
			// and not collidable anymore
			this.collidable = false;
			// set dead animation
			this.setCurrentAnimation("dead");
			// make it flicker and call destroy once timer finished
			this.flicker(45, function(){me.game.remove(this)});
			// dead sfx
			me.audio.play("enemykill", false);
			// give some score
			me.game.HUD.updateItemValue("score", 150);
		}
	}

});

/** 
 * a GUI object 
 * display score on screen
 */
var ScoreObject = me.HUD_Item.extend( {	
	/** 
	 * constructor
	 */
	init: function(x, y) {
		// call the parent constructor
		this.parent(x, y);
		// create a font
		this.font = new me.BitmapFont("atasci40", {x:40});
	},
	/**
	 * draw the score
	 */
	draw : function (context, x, y) {
		this.font.draw (context, this.value, this.pos.x +x, this.pos.y+y);
	}
});
