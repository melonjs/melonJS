

/**
 * a HUD container and child items
 */

game.HUD = game.HUD || {};

 
game.HUD.Container = me.ObjectContainer.extend({

	init: function() {
		// call the constructor
		this.parent();
		
		// persistent across level change
		this.isPersistent = true;
		
		// non collidable
		this.collidable = false;
		
		// make sure our object is always draw first
		this.z = Infinity;

		// give a name
		this.name = "HUD";
		
		// add our child score object at position
		this.addChild(new game.HUD.ScoreItem("score", "left", 10, 10));

		// add our child score object at position
		this.addChild(new game.HUD.ScoreItem("hiscore", "right", (me.video.getWidth() - 10), 10));
	}
});


/** 
 * a basic HUD item to display score
 */
game.HUD.ScoreItem = me.Renderable.extend( {	
	/** 
	 * constructor
	 */
	init: function(score, align, x, y) {
		
		// call the parent constructor 
		// (size does not matter here)
		this.parent(new me.Vector2d(x, y), 10, 10); 
		
		// create a font
		this.font = new me.BitmapFont("atascii", {x:24});
		this.font.alignText = "bottom";
		this.font.set(align, 1.2);

		// ref to the score variable
		this.scoreRef = score;

		// make sure we use screen coordinates
		this.floating = true;
	},

	/**
	 * draw the score
	 */
	draw : function (context) {
		this.font.draw (context, game.data[this.scoreRef], this.pos.x, this.pos.y);
	}

});
