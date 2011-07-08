/* -----

	Sound Engine is maybe too much.. as there is almost no logic except starting or stopping stuff...
	
		
	------									*/

var SoundEngine =
{	
	bpm			: 120,
	
	playing		: false,
	
	timerId		: null,

	// hold the current col of the patterns
	currentCol	: 1,
	MAXCOL		: 16,

	currentRow	: 0,
	
	/* ---
	
		play the pattern as defined in the interface
		---				*/

	playPattern: function()
	{	
	
		// check for Interface for the checkedbutton
		// it's a bit nasty to check the GUI I guess....
		for (var row=0;row<InterfaceMngr.patternRows.length;row++)
		{	
			
			var pattern = InterfaceMngr.patternRows[row].patternElements;
			if ((pattern[SoundEngine.currentCol].isClickable) && (pattern[SoundEngine.currentCol].enable))
			{	
				me.audio.play(InterfaceMngr.patternRows[row].text, false);
			}
			// update the GUI progress bar
			InterfaceMngr.setCurrentCol(SoundEngine.currentCol);
		}
		
		// increment current row
		SoundEngine.currentCol++;
		if (SoundEngine.currentCol > SoundEngine.MAXCOL)
			SoundEngine.currentCol = 1;
		
		// yes it's not the way it should be :)
		SoundEngine.timerId = setTimeout(this.playPattern.bind(this),60000/SoundEngine.bpm);
	},

	
		
	/* ---
	
		play....
		---									*/
		
	play: function()
	{	
		if (SoundEngine.playing == false)
		{
			SoundEngine.playPattern();
			SoundEngine.playing = true;
		}
	},
	
	
	/* ---
	
		stop ! 
		---									*/
		
	stop: function()
	{
		if (SoundEngine.playing == true)
		{
			if (SoundEngine.timerId)
				clearTimeout(SoundEngine.timerId);
		
			SoundEngine.playing = false;
		}
	}
}