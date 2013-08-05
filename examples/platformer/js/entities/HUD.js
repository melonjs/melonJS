
/**
 * a HUD container and child items
 */

game.HUD = {};
 
game.HUD.Container = me.EntityContainer.extend({

	init: function() {
		// call the constructor
		this.parent();
		
		// persistent across level change
		this.isPersitent = false;
		
		// non collidable
		this.collidable = false;
		
		// make sure our object is always draw first
		this.z = 9999;
		
		// add our child score object at position
		this.addChild(new game.HUD.ScoreItem());
	}
});

/** 
 * a basic HUD item to display score
 */
game.HUD.ScoreItem = me.Renderable.extend( {	
	/** 
	 * constructor
	 */
	init: function(x, y) {
		
		// call the parent constructor 
		// (size does not matter here)
		this.parent(new me.Vector2d(790, 560), 10, 10); 
		
		// create a font
		this.font = new me.BitmapFont("atascii", {x:24});
		this.font.alignText = "bottom";
		this.font.set("right", 1.6);
		
		// make sure we use screen coordinates
		this.floating = true;
	},
	
	/**
	 * draw the score
	 */
	draw : function (context) {
		this.font.draw (context, game.data.score, this.pos.x, this.pos.y);
	}
});
