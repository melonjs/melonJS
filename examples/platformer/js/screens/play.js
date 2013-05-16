game.PlayScreen = me.ScreenObject.extend({
	/**	
	 *  action to perform on state change
	 */
	onResetEvent: function() {	
      // load a level
		me.levelDirector.loadLevel("map1");
		
		// add a default HUD to the game mngr
		me.game.addHUD(0,560,800,40);
		
		// add a new HUD item 
		me.game.HUD.addItem("score", new game.ScoreObject(790,00));
		
		// play some music
		me.audio.playTrack("DST-GameForest");
	}
});
