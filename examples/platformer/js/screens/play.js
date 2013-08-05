game.PlayScreen = me.ScreenObject.extend({
	/**	
	 *  action to perform on state change
	 */
	onResetEvent: function() {	
      // load a level
		me.levelDirector.loadLevel("map1");
		
		// reset the score
		game.data.score = 0;
		
		// add our HUD to the game world	
		this.HUDInstance = new game.HUD.Container();
		me.game.add(this.HUDInstance);
		
		// play some music
		me.audio.playTrack("DST-GameForest");
	},
	
	/**	
	 *  action to perform on state change
	 */
	onDestroyEvent: function() {	
		
		// toggle the `isPersistent` flag 
		// add remove our HUD from game world
		this.HUDInstance.isPersistent = false
		me.game.remove(this.HUDInstance);
		
		// stop some music
		me.audio.stopTrack("DST-GameForest");
	}
});
