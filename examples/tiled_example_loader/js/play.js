game.PlayScreen = me.ScreenObject.extend({
	

	/**
	 * constructor
	 */
	init : function() {

		this.parent(true);

		this.isPersistent = true;
	},

	/**	
	 *  action to perform on state change
	 */
	onResetEvent: function() {

		// load a level
		me.levelDirector.loadLevel("village");
	},

	/**
	 * update function
	 */
	update: function(time) {
	
		// navigate the map :)
		if (me.input.isKeyPressed('left')) 
		{
			me.game.viewport.move(-(me.game.currentLevel.tilewidth/2),0);
			
		} else if (me.input.isKeyPressed('right')) {
			
			me.game.viewport.move(me.game.currentLevel.tilewidth/2,0);		
		}
				
		if (me.input.isKeyPressed('up')) {
			
			me.game.viewport.move(0,-(me.game.currentLevel.tileheight/2));

		} else if (me.input.isKeyPressed('down')) {
			
			me.game.viewport.move(0,me.game.currentLevel.tileheight/2);
		}

		if (me.input.isKeyPressed('enter')) {
			
			me.game.viewport.shake(16, 500);
		}

		return true;
	},

	/**	
	 *  action to perform when leaving this screen (state change)
	 */
	onDestroyEvent: function() {

	}
});
