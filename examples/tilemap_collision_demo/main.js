/* -----

	main 
	
	------*/

var jsApp	=
{
	
	/* ---
	
		Initialize the application
		
		---										*/
	onload: function()
	{
		//me.debug.renderHitBox = true;
		
		// init the video
		if (!me.video.init('jsapp', 480, 320, false, 1.0))
		{
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
         return;
		}
		
				
		// initialize the "sound engine"
		me.audio.init("mp3,ogg");
		
		//me.audio.disable();
		
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
		
		// set the fade transition effect
		me.state.transition("fade","#FFFFFF", 250);
		
		// add our player entity in the entity pool
		me.entityPool.add("playerspawnpoint", PlayerEntity);
		// add our player entity in the entity pool
		me.entityPool.add("emeraldentity", EmeraldEntity);
		// add our enemy entity in the entity pool
		me.entityPool.add("enemyentity", EnemyEntity);
			
		// switch to PLAY state
		me.state.change(me.state.PLAY);
		
	}
}; // jsApp

/* game initialization */
var PlayScreen = me.ScreenObject.extend(
{
   // we just defined what to be done on reset
   // no need to do somehting else
	onResetEvent: function()
	{	
		// load a level
		me.levelDirector.loadLevel("map1");
		
		// add a default HUD to the game mngr
		me.game.addHUD(0,0,480,30);
		
		// add a new HUD item 
		me.game.HUD.addItem("score", new ScoreObject(470,10));
		
		// make sure everyhting is in the right order
		me.game.sort();
		
		// play some music
		me.audio.playTrack("DST-GameForest");
	}

});



//bootstrap :)
window.onReady(function() 
{
	jsApp.onload();
});
