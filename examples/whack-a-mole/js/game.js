/**
 * Whack-A-Mole
 * Freely reused from the Cocos2d Whack-a-mole Tutorial 
 * http://maniacdev.com/2011/01/tutorial-cocos2d-example-whack-a-mole-game/
 * Original version by Ray Wenderlich, the creator of the Space Game Starter 
 * Kit and co-author of the Learning Cocos2D book, as part of an excellent set 
 * of iOS tutorials on how to create a whack-a-mole game using the open source 
 * iPhone game engine Cocos2D.
 **/
var game = {

	/**
	 * some Initialization
	 */
	onload: function() {
		
		// enable dirtyRegion
		me.sys.dirtyRegion = true;
		
		// we don't need the default 60fps for a whack-a-mole !
		me.sys.fps = 30;
		
		// debug flags
		//me.debug.renderDirty = true;
		//me.debug.renderHitBox = true;
		
		// initialize the video
		if (!me.video.init('screen', 1024, 768, true ,'auto')) {
			alert("Sorry but your browser does not support html5 canvas. Please try with another one!");
			return;
		};
					
		// initialize the "sound engine"
		me.audio.init("mp3,ogg");
		
		// set all ressources to be loaded
		me.loader.onload = this.loaded.bind(this);
		// set all ressources to be loaded		
		me.loader.preload(game.resources);
		
		// load everything & display a loading screen
		me.state.change(me.state.LOADING);
	},
	
	
	/** 
	 * callback when everything is loaded
	 */
	loaded: function () {
		
		// set the "Play/Ingame" Screen Object
		me.state.set(me.state.PLAY, new game.PlayScreen());
      
		// set a fade transition effect
		me.state.transition("fade","#000000", 250);
		
		// start the game
		me.state.change(me.state.PLAY);
	}

}; // game


