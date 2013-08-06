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
		me.game.add(new game.HUD.Container());
		
		// play some music
		me.audio.playTrack("DST-GameForest");
	},
	
	/**	
	 *  action to perform on state change
	 */
	onDestroyEvent: function() {	
	
		// remove the HUD from the game world
		me.game.world.removeChild(me.game.world.getEntityByProp("name", "HUD")[0]);
		
		// stop some music
		me.audio.stopTrack("DST-GameForest");
	}
});
