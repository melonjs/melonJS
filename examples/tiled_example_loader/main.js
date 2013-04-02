/* -----

	TileD loader 
	
	------					*/

var jsApp	=
{
	
	/* ---
	
		Initialize the jsApp
		
		---			*/
	onload: function()
	{
		
		if (!me.video.init('jsapp', 800, 480))
		{
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
			return;
		}
	
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
		me.state.set(me.state.PLAY, this);

		// enable the keyboard (to navigate in the map)
		me.input.bindKey(me.input.KEY.LEFT,	 "left");
		me.input.bindKey(me.input.KEY.RIGHT, "right");
		me.input.bindKey(me.input.KEY.UP,	 "up");
		me.input.bindKey(me.input.KEY.DOWN,	 "down");
		me.input.bindKey(me.input.KEY.ENTER, "enter");

		// start the game
		me.state.change(me.state.PLAY);
		
	},

	reset: function()
	{	
		me.game.reset();
		// load a level
		me.levelDirector.loadLevel("village");		
	},

	
	/* ---
	
		 rendering loop
		
		---										*/
	onUpdateFrame: function()
	{
	
		// navigate the map :)
		if (me.input.isKeyPressed('left'))
		{
			me.game.viewport.move(-(me.game.currentLevel.tilewidth/2),0);
			// force redraw
			me.game.repaint();
			
		}
		else if (me.input.isKeyPressed('right'))
      {
			me.game.viewport.move(me.game.currentLevel.tilewidth/2,0);		
			// force redraw
			me.game.repaint();
		}
				
		if (me.input.isKeyPressed('up'))
		{
			me.game.viewport.move(0,-(me.game.currentLevel.tileheight/2));
			// force redraw
			me.game.repaint();
		}
		else if (me.input.isKeyPressed('down'))
      {
			me.game.viewport.move(0,me.game.currentLevel.tileheight/2);
			// force redraw
			me.game.repaint();
		}

		if (me.input.isKeyPressed('enter')) {
			me.game.viewport.shake(16, 500);
		}

		// update the frame counter
		me.timer.update();

		// update our sprites
		me.game.update();
	
		// draw the rest of the game
		me.game.draw();
	},
	
	/* ---
	
		 change the current level 
		 using the listbox current value in the HTML file
		
		---										*/
	changelevel: function()
	{
		var level_id = document.getElementById("level_name").value;
		switch (level_id)
		{
			case "1":
				level = "village";
				break;
			case "2":
				level = "desert";
				break;
			case "3":
				level = "sewers";
				break;
			case "4":
				level = "cute";
				break;
			case "5":
				level = "isometric";
				break;
			case "6":
				level = "perspective";
				break;
			default:
				return;
		};
		
		// reset everything
		me.game.reset();
		
		// load the new level
		me.levelDirector.loadLevel(level);		


	}

}; // jsApp


//bootstrap :)
window.onReady(function() 
{
	jsApp.onload();
});
