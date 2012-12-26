/* -----

	main 
	
	------*/
	

var game = {

	// game assets
	assets : [	
		{name: "tileset",		type:"image",	src: "data/gfx/tileset.png"},
		{name: "atasci40",		type:"image",	src: "data/gfx/atascii_40px.png"},
		{name: "player_sheet",	type:"image",	src: "data/gfx/player_sheet.png"},
		{name: "slime_sheet",	type:"image",	src: "data/gfx/slime_sheet.png"},
		{name: "fly_sheet",		type:"image",	src: "data/gfx/fly_sheet.png"},
		{name: "coin_sheet",	type:"image",	src: "data/gfx/coin_sheet.png"},
		{name: "background",	type:"image",	src: "data/gfx/background.png"},
		{name: "cling",			type: "audio",	src: "data/audio/",	channel : 2},
		{name: "die",			type: "audio",	src: "data/audio/",	channel : 1},
		{name: "enemykill",		type: "audio",	src: "data/audio/",	channel : 1},
		{name: "jump",			type: "audio",	src: "data/audio/",	channel : 2},
		{name: "DST-GameForest",type: "audio",	src: "data/audio/",	channel : 1},
		{name: "map1",			type: "tmx",	src: "data/map/map1.tmx"},
		{name: "map2",			type: "tmx",	src: "data/map/map2.tmx"}
	],
	
	/* ---
	
		Initialize the application
		
		---										*/
	onload: function()
	{
		// init the video
		if (!me.video.init('screen', 800, 600, true, 'auto')) {
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
			return;
		}
		// disable interpolation when scaling
		me.video.setImageSmoothing(false);
		
		// install the debug panel plugin
		me.plugin.register(debugPanel, "debug");
		
		//me.debug.renderHitBox = true;
		
		// initialize the "sound engine"
		me.audio.init("mp3,ogg");
		
		// set all ressources to be loaded
		me.loader.onload = this.loaded.bind(this);
		
		// set all ressources to be loaded
		me.loader.preload(game.assets);
		
		// load everything & display a loading screen
		me.state.change(me.state.LOADING);
	},
	
	
	/* ---
	
		callback when everything is loaded
		
		---										*/
	loaded: function ()	{
		// set the "Play/Ingame" Screen Object
		me.state.set(me.state.PLAY, new PlayScreen());
		
		// set the fade transition effect
		me.state.transition("fade","#FFFFFF", 250);
		
		// add our player entity in the entity pool
		me.entityPool.add("mainPlayer", PlayerEntity);
		// add our enemy entity in the entity pool
		me.entityPool.add("SlimeEntity", PathEnemyEntity);
		me.entityPool.add("FlyEntity", PathEnemyEntity);
		me.entityPool.add("CoinEntity", CoinEntity);
		
		// switch to PLAY state
		me.state.change(me.state.PLAY);
	}
};

/* game initialization */
var PlayScreen = me.ScreenObject.extend( {
	// we just defined what to be done on reset
	// no need to do somehting else
	onResetEvent: function() {	
		// load a level
		me.levelDirector.loadLevel("map1");
		
		// add a default HUD to the game mngr
		me.game.addHUD(0,560,800,40);
		
		// add a new HUD item 
		me.game.HUD.addItem("score", new ScoreObject(790,00));
		
		// play some music
		me.audio.playTrack("DST-GameForest");

	}

});

 /* Bootstrap */
window.onReady(function onReady() {
	game.onload();
});
