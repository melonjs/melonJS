/* -----

	a collection of quick & dirty GUI elements
		
	------									*/

var InterfaceMngr =
{	
	
	// keep a reference to the row patterns for the Sound Engine
	patternRows			:	new Array(),
	
	patternProgress   :	null,
	

	/* ---
	
		Initialize required stuff...
		---									*/
		
	init: function(x,y, width, height)
	{	
		
		// Build the Interface
		
		me.game.init(x,y, width, height);
		me.game.reset();
		
		me.game.add(new Panel("grey"), -1);
				
		me.game.add(new Header(0,0, "A Shitty Tiny HTML5 DrumBox !"), 0);
		
		me.game.add(new enableButton(4, 44, "Start", "Stop", SoundEngine.play.bind(SoundEngine), SoundEngine.stop.bind(SoundEngine)), 0);
		
		patternProgress = new progressBar( 14 + (168 / g_GUI_DISPLAY_RATIO),	56, 
													  ((56 / g_GUI_DISPLAY_RATIO) * 16) + 68 , 10, 
													  SoundEngine.MAXCOL);
		
		me.game.add(patternProgress, 0);
		
		var y = 76;
		
		var row_count = 0;
		for (var i=0;i<g_ressources.length;i++)
		{
			
			if (g_ressources[i].type == "audio")
			{
				this.patternRows[row_count] = new patternRow(4, y, g_ressources[i].name);//, this.onRadioButtonClick.bind(this));
				this.patternRows[row_count].init();
			
				me.game.add(this.patternRows[row_count], 0);
			
				y += this.patternRows[row_count].displayHeight;
				
				row_count++;
			}
		};
		
		
		// use the header as a footer :)
		me.game.add(new Header(0,height - 36, ""), 0);
		
		// sort the damn whole thing
		me.game.sort();
	},
	
	
	/* ---
	
		update the progress bar
		
		---									*/
	setCurrentCol: function(col)
	{
	
		patternProgress.setCurrentCol(col);
	},
	
	
	/* ---
	
		update the GUI
		---									*/
		
	update: function()
	{
		// update our sprites
		me.game.update();
		
		
			
	},
	
	/* ---
	
		draw the GUI
		---									*/
		
	draw: function()
	{
		//me.game.repaint();
		me.game.draw();
	}
}