/*!
 * 
 *   melonJS
 *   http://www.melonjs.org
 *		
 *   Step by step game creation tutorial
 *
 **/

// game ressources
var g_ressources= [  
                     // our level tileset
                     {name: "area01_level_tiles",  type:"image",	src: "data/area01_tileset/area01_level_tiles.png"},
                     // our levels
                     {name: "area01",              type: "tmx",	src: "data/area01.tmx"},
                     {name: "area02",              type: "tmx",	src: "data/area02.tmx"},
                     // the main player spritesheet
                     {name: "gripe_run_right",     type:"image",	src: "data/sprite/gripe_run_right.png"},
                     // the parallax background
                     {name: "area01_bkg0",         type:"image",	src: "data/area01_parallax/area01_bkg0.png"},
                     {name: "area01_bkg1",         type:"image",	src: "data/area01_parallax/area01_bkg1.png"},
                     // the spinning coin spritesheet
                     {name: "spinning_coin_gold",  type:"image",	src: "data/sprite/spinning_coin_gold.png"},
                     // our enemty entity
                     {name: "wheelie_right",       type:"image",	src: "data/sprite/wheelie_right.png"},
                     // game font
                     {name: "32x32_font",          type:"image",	src: "data/sprite/32x32_font.png"},
                     // audio ressources
                     {name: "cling",            type: "audio",    src: "data/audio/",	channel : 2},
					 {name: "stomp",               type: "audio", src: "data/audio/",	channel : 1},
					 {name: "jump",                type: "audio", src: "data/audio/",	channel : 1},
					 {name: "dst-inertexponent",   type: "audio", src: "data/audio/",	channel : 1}
                  ]; 


var jsApp	= 
{	
	/* ---
	
		Initialize the jsApp
		
		---			*/
	onload: function()
	{
		
		//me.debug.renderHitBox = true;
      
		// init the video
		if (!me.video.init('jsapp', 640, 480, false, 1.0))
		{
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
			return;
		}
		
				
		// initialize the "audio"
		me.audio.init("mp3,ogg");
		
		// set all ressources to be loaded
		me.loader.onload = this.loaded.bind(this);
		
		// set all ressources to be loaded
		me.loader.preload(g_ressources);

		// load everything & display a loading screen
		me.state.change(me.state.LOADING);
	},
	
	
	/* ---
	
		callback when everything is loaded
		
		---										*/
	loaded: function ()
	{
		// set the "Play/Ingame" Screen Object
		me.state.set(me.state.PLAY, new PlayScreen());
      
		// add our player entity in the entity pool
		me.entityPool.add("mainPlayer", PlayerEntity);
		me.entityPool.add("CoinEntity", CoinEntity);
		me.entityPool.add("EnemyEntity", EnemyEntity);
      
			
		// enable the keyboard
		me.input.bindKey(me.input.KEY.LEFT,		"left");
		me.input.bindKey(me.input.KEY.RIGHT,	"right");
		me.input.bindKey(me.input.KEY.X,		"jump", true);
      
      // start the game 
		me.state.change(me.state.PLAY);
	}

}; // jsApp

/* the in game stuff*/
var PlayScreen = me.ScreenObject.extend(
{

	onResetEvent: function()
	{	
		// play the audio track
		me.audio.playTrack("DST-InertExponent");
      
		// load a level
		me.levelDirector.loadLevel("area01");
      
		// add a default HUD to the game mngr
		me.game.addHUD(0,430,640,60);
		
		// add a new HUD item 
		me.game.HUD.addItem("score", new ScoreObject(620,10));
		
		// make sure everyhting is in the right order
		me.game.sort();

	},
	
	
	/* ---
	
		 action to perform when game is finished (state change)
		
		---	*/
	onDestroyEvent: function()
	{  
      // remove the HUD
      me.game.disableHUD();
      
      // stop the current audio track
      me.audio.stopTrack();
   }

});


//bootstrap :)
window.onReady(function() 
{
	jsApp.onload();
});
