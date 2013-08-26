/**
 * main
 */
var game = {

	/** 
	 * object where to store game global data
	 */
	data : {
		// score
		score : 0
	},
	
	/**
	 *
	 * Initialize the application
	 */
	onload: function() {
	
		// init the video
		if (!me.video.init('screen', 800, 600, true, 'auto')) {
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
			return;
		}

		// add "#debug" to the URL to enable the debug Panel
		if (document.location.hash === "#debug") {
			window.onReady(function () {
				me.plugin.register.defer(debugPanel, "debug");
			});
		}
		
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
	loaded: function ()	{
	
		// set the "Play/Ingame" Screen Object
		me.state.set(me.state.PLAY, new game.PlayScreen());
		
		// set the fade transition effect
		me.state.transition("fade","#FFFFFF", 250);
		
		// add our player entity in the entity pool
		me.entityPool.add("mainPlayer", game.PlayerEntity);
		// add our enemy entity in the entity pool
		me.entityPool.add("SlimeEntity", game.SlimeEnemyEntity);
		me.entityPool.add("FlyEntity", game.FlyEnemyEntity);
		me.entityPool.add("CoinEntity", game.CoinEntity);
		
		// load the texture atlas file
		// this will be used by object entities later
		game.texture = new me.TextureAtlas(me.loader.getJSON("texture"), me.loader.getImage("texture"));
		
		// switch to PLAY state
		me.state.change(me.state.PLAY);
	}
};

