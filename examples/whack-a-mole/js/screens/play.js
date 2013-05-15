game.PlayScreen = me.ScreenObject.extend({
	/**	
	 *  action to perform on state change
	 */
	onResetEvent: function() {	
      me.game.reset();
		// add the background & foreground
		// add the foreground
		var background_sprite10 = new me.SpriteObject (0, 0,   me.loader.getImage("background"));
		var grass_upper_1	    = new me.SpriteObject (0, 0,   me.loader.getImage("grass_upper"));
		
		var background_sprite11 = new me.SpriteObject (0, 127, me.loader.getImage("background"));
		var grass_lower_1       = new me.SpriteObject (0, 127, me.loader.getImage("grass_lower"));
		
		var background_sprite20 = new me.SpriteObject (0, 255, me.loader.getImage("background"));
		var grass_upper_2       = new me.SpriteObject (0, 255, me.loader.getImage("grass_upper"));
		
		var background_sprite21 = new me.SpriteObject (0, 383, me.loader.getImage("background"));
		var grass_lower_2       = new me.SpriteObject (0, 383, me.loader.getImage("grass_lower"));
		
		var background_sprite30 = new me.SpriteObject (0, 511, me.loader.getImage("background"));
		var grass_upper_3       = new me.SpriteObject (0, 511, me.loader.getImage("grass_upper"));
		
		var background_sprite31 = new me.SpriteObject (0, 639, me.loader.getImage("background"));
		var grass_lower_3       = new me.SpriteObject (0, 639, me.loader.getImage("grass_lower"));
		
		// instantiate teh mole Manager 
		var moleManager = new game.MoleManager(0, 0);
			
		// add all objects
		me.game.add (background_sprite10, 0);
		me.game.add (background_sprite11, 0);
		me.game.add (background_sprite20, 0);
		me.game.add (background_sprite21, 0);
		me.game.add (background_sprite30, 0);
		me.game.add (background_sprite31, 0);
		
		me.game.add (grass_upper_1, 10);
		me.game.add (grass_lower_1, 20);
		me.game.add (grass_upper_2, 30);
		me.game.add (grass_lower_2, 40);
		me.game.add (grass_upper_3, 50);
		me.game.add (grass_lower_3, 60);
		me.game.add (moleManager, 0);
		
		// make sure everything is sorted
		me.game.sort();
		
		// start the main soundtrack
		me.audio.playTrack("whack");
	},
	
	
	/**	
	 *  action to perform when leaving this screen (state change)
	 */
	onDestroyEvent: function() {
	  me.audio.stopTrack();
	}
});
