/* -----

	Drum Box Main Class 
	
	------									*/

var jsApp	=
{
	
	/* ---
	
		Initialize the jsApp
		
		---										*/
	onload: function()
	{
		
		if (!me.video.init('jsapp', 580, 320,	false, 1.0))
		{
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
         return;
		}
		
		// initialize the "sound engine"
		if (!me.audio.init("mp3,ogg"))
		{
			alert("Sorry but your browser does not support any of the requested audio format : " + me.audio.requestedFormat);
         return;
		}

		me.loader.onload = this.loaded.bind(this);
		
		// load all ressources		
		me.loader.preload(g_ressources);
		
		// display a loading screen
		me.state.change(me.state.LOADING);
	},
	
	
	/* ---
	
		callback when everything is loaded
		
		---										*/
	loaded: function ()
	{
		
		// initialize the interface
		InterfaceMngr.init(0,0, me.video.getWidth(), me.video.getHeight());
		
		// set the "Play/Ingame" Screen Object
		me.state.set(me.state.PLAY, this);
		
		// Enable Mouse Event Management
		me.input.enableMouseEvent(true, me.game.mouseEvent.bind(me.game));		
		
		// start the game
		me.state.change(me.state.PLAY);
		
	},

	reset: function()
	{	

	},

	
	/* ---
	
		 rendering loop
		
		---										*/
	onUpdateFrame: function()
	{
		
		// draw the interface
		InterfaceMngr.update();	
		
		// draw the interface
		InterfaceMngr.draw();		
				
		
		// draw our frame !
		me.video.blitSurface();
		
	},
	
	/* ---
	
		 action to perform when game is finished (state change)
		
		---										*/
	destroy: function()
	{

	}

}; // jsApp


//bootstrap :)
window.onReady(function() 
{
	jsApp.onload();
});
