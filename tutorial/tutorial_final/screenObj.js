/* -----

	gameScreens
		
	------			*/


/*---------------------------------------------------------------------

	A title screen

  ---------------------------------------------------------------------	*/

var TitleScreen = me.ScreenObject.extend(
{
	init : function()
	{
		this.parent(true);
		
		// title screen image
		this.title         = null;
		
		this.font          =  null;
		this.scrollerfont  =  null;
		this.scrollertween = null;
		
		this.scroller = "A SMALL STEP BY STEP TUTORIAL FOR GAME CREATION WITH MELONJS       ";
		this.scrollerpos = 600;
	},
	/* ---
		reset function
	   ----*/
	
	onResetEvent : function()
	{
		if (this.title == null)
		{
			// init stuff if not yet done
			this.title = me.loader.getImage("title_screen");
			// font to display the menu items
			this.font = new me.BitmapFont("32x32_font", 32);
			this.font.set("left");
			
			// set the scroller
			this.scrollerfont = new me.BitmapFont("32x32_font", 32);
			this.scrollerfont.set("left");
						
		}
      
		// reset to default value
		this.scrollerpos = 640;
		
		// a tween to animate the arrow
		this.scrollertween = new me.Tween(this).to({scrollerpos: -2200 }, 10000).onComplete(this.scrollover.bind(this)).start();
		
		// enable the keyboard
		me.input.bindKey(me.input.KEY.ENTER, "enter", true);
      
		// play something
		me.audio.play("cling");
		
	},
	
	
	// some callback for the tween objects
	scrollover : function()
	{
		// reset to default value
		this.scrollerpos = 640;
		this.scrollertween.to({scrollerpos: -2200 }, 10000).onComplete(this.scrollover.bind(this)).start();
	},
		
	/*---
		
		update function
		 ---*/
		
	update : function()
	{
		// enter pressed ?
		if (me.input.isKeyPressed('enter'))
		{
			me.state.change(me.state.PLAY);
		}
		return true;
	},

	
	/*---
	
		the manu drawing function
	  ---*/
	
	draw : function(context)
	{
		context.drawImage(this.title, 0,0);
		
		this.font.draw (context, "PRESS ENTER TO PLAY",	 20, 240);
		this.scrollerfont.draw(context, this.scroller, this.scrollerpos, 440);
	},
	
	/*---
	
		the manu drawing function
	  ---*/
	
	onDestroyEvent : function()
	{
		me.input.unbindKey(me.input.KEY.ENTER);
		
		//just in case
		this.scrollertween.stop();
   },

});

