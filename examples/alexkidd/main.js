/* -----

	Game Main Class 
	
	------									*/

var jsApp	=
{
	
	/* ---
	
		Initialize the jsApp
		
		---										*/
	onload: function()
	{
		
		//me.debug.renderHitBox = true;
		
		if (!me.video.init('jsapp', 320, 240, true, 1.6))
		{
			alert("Sorry but your browser does not support html5 canvas. Please try with another one!");
         return;
		}
					
		// initialize the "sound engine"
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
      
		// set a fade transition effect
		me.state.transition("fade","#000000", 250);
		
		// add our player entity in the entity pool
		me.entityPool.add("playerspawnpoint", PlayerEntity);
			
		// enable the keyboard
		me.input.bindKey(me.input.KEY.LEFT,		"left");
		me.input.bindKey(me.input.KEY.RIGHT,	"right");
		me.input.bindKey(me.input.KEY.X,			"jump", true);
		
		// start the game
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
		me.levelDirector.loadLevel("zone1/1/p1");
	}
	
});


//bootstrap :)
window.onReady(function() 
{
	jsApp.onload();
});
