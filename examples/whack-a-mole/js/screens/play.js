game.PlayScreen = me.ScreenObject.extend({
	/**	
	 *  action to perform on state change
	 */
	onResetEvent: function() {	
      	
      	me.game.reset();
		
		// add the background & foreground
		// add the foreground
		var background_sprite10 = new me.Sprite (0, 0,   me.loader.getImage("background"));
		var grass_upper_1	    = new me.Sprite (0, 0,   me.loader.getImage("grass_upper"));
		
		var background_sprite11 = new me.Sprite (0, 127, me.loader.getImage("background"));
		var grass_lower_1       = new me.Sprite (0, 127, me.loader.getImage("grass_lower"));
		
		var background_sprite20 = new me.Sprite (0, 255, me.loader.getImage("background"));
		var grass_upper_2       = new me.Sprite (0, 255, me.loader.getImage("grass_upper"));
		
		var background_sprite21 = new me.Sprite (0, 383, me.loader.getImage("background"));
		var grass_lower_2       = new me.Sprite (0, 383, me.loader.getImage("grass_lower"));
		
		var background_sprite30 = new me.Sprite (0, 511, me.loader.getImage("background"));
		var grass_upper_3       = new me.Sprite (0, 511, me.loader.getImage("grass_upper"));
		
		var background_sprite31 = new me.Sprite (0, 639, me.loader.getImage("background"));
		var grass_lower_3       = new me.Sprite (0, 639, me.loader.getImage("grass_lower"));
		
		// instantiate teh mole Manager 
		var moleManager = new game.MoleManager(0, 0);
			
		// add all objects
		me.game.world.addChild (background_sprite10, 0);
		me.game.world.addChild (background_sprite11, 0);
		me.game.world.addChild (background_sprite20, 0);
		me.game.world.addChild (background_sprite21, 0);
		me.game.world.addChild (background_sprite30, 0);
		me.game.world.addChild (background_sprite31, 0);
		
		me.game.world.addChild (grass_upper_1, 10);
		me.game.world.addChild (grass_lower_1, 20);
		me.game.world.addChild (grass_upper_2, 30);
		me.game.world.addChild (grass_lower_2, 40);
		me.game.world.addChild (grass_upper_3, 50);
		me.game.world.addChild (grass_lower_3, 60);
		me.game.world.addChild (moleManager, 0);
		
		// add our HUD (scores/hiscore)
        this.HUD = new game.HUD.Container();
		me.game.world.addChild(this.HUD);

		// start the main soundtrack
		me.audio.playTrack("whack");
	},
	
	
	/**	
	 *  action to perform when leaving this screen (state change)
	 */
	onDestroyEvent: function() {
        // remove the HUD from the game world
        me.game.world.removeChild(this.HUD);

        // stop some music
        me.audio.stopTrack();
	}
});
