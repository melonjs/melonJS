/*!
 * 
 *   melonJS
 *   http://www.melonjs.org
 *		
 *   Step by step game creation tutorial
 *
 **/

// game resources
var g_resources= [  
                     // our level tileset
                     {name: "area01_level_tiles",  type:"image",	src: "data/area01_tileset/area01_level_tiles.png"},
                     // our levels
                     {name: "area01",              type: "tmx",	src: "data/area01.tmx"},
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
                      // title screen
                     {name: "title_screen",        type:"image",	src: "data/GUI/title_screen.png"},
                  ]; 


var jsApp	= 
{	
   /* ---
	
      Initialize the jsApp
         
      ---			*/
   onload: function()
   {
		
      // enable the dirtyRect feature
      me.sys.dirtyRegion = true;
      
      // some debug (draw the dirty area, if true)
      me.debug.renderDirty = false;
      
      
      // init the video
      if (!me.video.init('jsapp', 1024, 768, true, 'auto', false))
      {
         alert("Sorry but your browser does not support html 5 canvas.");
         return;
      }
		
	   // initialize the "audio"
      me.audio.init("mp3,ogg");
		
      // set all resources to be loaded
      me.loader.onload = this.loaded.bind(this);
		
      // set all resources to be loaded
      me.loader.preload(g_resources);

      // load everything & display a loading screen
      me.state.change(me.state.LOADING);
   },
	
	
   /* ---

         callback when everything is loaded
 
      --- */
   loaded: function ()
   {
      // set the "Play/Ingame" Screen Object
      me.state.set(me.state.MENU, new TitleScreen());
      
      // set the "Play/Ingame" Screen Object
      me.state.set(me.state.PLAY, new PlayScreen());
      
      // set a global fading transition for the screen
		me.state.transition("fade", "#FFFFFF", 250);
      
      // add our Player entity & Coin in the entity pool
      me.entityPool.add("mainPlayer", PlayerEntity);
      me.entityPool.add("CoinEntity", CoinEntity);
      
      // enable the keyboard
      me.input.bindKey(me.input.KEY.LEFT,    "left");
      me.input.bindKey(me.input.KEY.RIGHT,   "right");
      me.input.bindKey(me.input.KEY.X,       "jump", true);
      
      // switch to our menu !
      me.state.change(me.state.MENU);
	}

}; // jsApp

/* the in game stuff*/
var PlayScreen = me.ScreenObject.extend(
{

   onResetEvent: function()
   {	
      // load a level
      me.levelDirector.loadLevel("area01");
      
      // add a default HUD to the game mngr
      me.game.addHUD(850,0,174,50);
		
      // add a new HUD item 
      me.game.HUD.addItem("score", new ScoreObject(170,10));
   },
	
	
   /* ---

      action to perform when game is finished (state change)

   ---	*/
   onDestroyEvent: function()
   {  
      // remove the HUD
      me.game.disableHUD();
   }

});


//bootstrap :)
window.onReady(function() 
{
	jsApp.onload();
});
