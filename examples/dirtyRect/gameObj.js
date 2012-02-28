/* -----

game object
   
------   */

/*------
   
   a player entity
   
 -------*/
var PlayerEntity = me.ObjectEntity.extend(
{	
   
   /* -----

   constructor
   
   ------ */
   
   init:function (x, y, settings)
   {
      // call the constructor
      this.parent(x, y , settings);
      
      // set the walking & jumping speed
      this.setVelocity(3, 15);
	  
	  // set the walking & jumping speed
      this.setFriction(0.3);
      
      // adjust the bounding box
      this.updateColRect(8,48, -1,0);
      
      // set the display to follow our position on both axis
      me.game.viewport.follow(this.pos, me.game.viewport.AXIS.HORIZONTAL);
   },

   /* -----
   
      update the player pos
      
      ------ */
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
     
	  if (me.input.isKeyPressed('jump'))
      {	
         this.doJump();
      }
      
      // check & update player movement
      this.updateMovement();
      
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
      if (this.vel.x!=0 || this.vel.y!=0)
      {
         // update objet animation
         this.parent(this);
		 return true;
      }
      return false;
   }

});

/*------
   
   a coin entity
   
 -------*/
var CoinEntity = me.CollectableEntity.extend(
{	
   init: function (x, y, settings)
   {
      // call the parent constructor
      this.parent(x, y , settings);
   },		
      
   onCollision : function ()
   {
      // give some score
      me.game.HUD.updateItemValue("score", 250);
	  //avoid further collision and delete it
	  this.collidable = false;
	  me.game.remove(this);

   }
   
});

/*------
   
   a score HUD item
   
 -------*/
var ScoreObject = me.HUD_Item.extend(
{	
   init: function(x, y)
   {
      // call the parent constructor
      this.parent(x, y);
      // create a font
      this.font = new me.BitmapFont("32x32_font", 32);
   },
   
   //	draw our score
   draw : function (context, x, y)
   {
      this.font.draw (context, this.value, this.pos.x +x, this.pos.y+y);
   }

});


