/* -----

	main 
	
	------*/
	

var game = {

	// game assets
	assets : [	
		{name: "tileset",		type:"image",	src: "data/gfx/tileset.png"},
		{name: "atascii",		type:"image",	src: "data/gfx/atascii_24px.png"},
		{name: "background",	type:"image",	src: "data/gfx/background.png"},
		{name: "cling",			type: "audio",	src: "data/audio/",	channel : 2},
		{name: "die",			type: "audio",	src: "data/audio/",	channel : 1},
		{name: "enemykill",		type: "audio",	src: "data/audio/",	channel : 1},
		{name: "jump",			type: "audio",	src: "data/audio/",	channel : 2},
		{name: "DST-GameForest",type: "audio",	src: "data/audio/",	channel : 1},
		// level map
		{name: "map1",			type: "tmx",	src: "data/map/map1.json"},
		{name: "map2",			type: "tmx",	src: "data/map/map2.tmx"},
		// texturePacker
		{name: "texture",		type: "tps",	src: "data/gfx/texture.json"},
		{name: "texture",		type:"image",	src: "data/gfx/texture.png"}
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
		//me.plugin.register(debugPanel, "debug");
		
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
		me.entityPool.add("SlimeEntity", SlimeEnemyEntity);
		me.entityPool.add("FlyEntity", FlyEnemyEntity);
		me.entityPool.add("CoinEntity", CoinEntity);
		
		// load the texture atlas file
		// this will be used by object entities later
		game.texture = new me.TextureAtlas(me.loader.getAtlas("texture"), me.loader.getImage("texture"));
		
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
