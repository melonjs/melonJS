
// a collection of QUICK & DIRTY GUI Elements !


// global var to adjust the size of the various elements to the display
var g_GUI_DISPLAY_RATIO = 2.2 ;


/* ---
	
	a very ugly Panel :)
		
	---										*/
function Panel (color)
{
	this.color		= color;
	this.z			= 0;
	this.visible	= true;

	this.update = function()
	{
		// we don't use automatic animation here
		return false;
	}
		
	this.draw = function(context)
	{
		// where we just clear the surface !
		me.video.clearSurface(context, this.color);
	}
}


/* ---
	
	a simple Label object
		
	---										*/
function Label(x, y, text)
{	
	me.GUI_Object.call(this,x, y, me.loader.getImage("label_button"));
	
	this.displayWidth			=	168 / g_GUI_DISPLAY_RATIO; // size of sprite
	this.displayHeight		=	56	 / g_GUI_DISPLAY_RATIO;
		
	
	// specific variable to the Label object
	this.text			= text;
	this.font			= new me.Font("Arial", 14, "black", "center");
	//this.font.bold();
	this.y_adjust		= 18;
	this.isClickable	= false;

	
	this.draw = function (context)
	{
		// call the parent draw function;
		me.GUI_Object.prototype.draw.call(this, context);
		dim = this.font.measure(context, this.text);
		this.font.draw(context, this.text, this.pos.x + ((this.displayWidth - dim.width) / 2) , this.pos.y + this.y_adjust);

	}
	
	this.setText = function(text) 
	{
		this.text = text;
		this.text_xpos = 0;
	}
};
Label.prototype = new me.GUI_Object();

//------------------------------------------------- END OF 


/* ---
	
	a simple Header/Footer object
		
	---										*/

function Header(x, y, text)
{	
	me.GUI_Object.call(this,x, y, me.loader.getImage("header"));
	
	this.displayWidth			=	580; // size of sprite
	this.displayHeight		=	36;
	
	// specific variable to the Label object
	this.font			= new me.Font("Arial", 18, "white");
	this.font.bold();
	
	this.text			= text;
	//this.y_adjust		= 24;
	this.isClickable	= false;
	
	
	// the draw function
	this.draw = function(context) 
	{
		// call the parent draw function;
		me.GUI_Object.prototype.draw.call(this, context);
		dim = this.font.measure(context, this.text);
		this.font.draw(context, this.text, this.pos.x + ((this.displayWidth - dim.width) / 2) , this.pos.y + 14 + ((this.displayHeight - dim.height) / 2));
	}
}
Header.prototype = new me.GUI_Object();

//------------------------------------------------- END OF 

/* ---
	
	a simple Radio Button object
		
	---										*/
function RadioButton (x, y)
{
	me.GUI_Object.call(this, x, y, me.loader.getImage("radio_button"), 56);

	this.enable					= false;

	this.displayWidth			= 56	/ g_GUI_DISPLAY_RATIO; // size of sprite
	this.displayHeight		= 56	/ g_GUI_DISPLAY_RATIO;
	
	this.clicked = function() 
	{
		// change the state of the radio button
		if (this.enable)
			this.currentSpriteOff = 0;
		else
			this.currentSpriteOff = 56; // on 2 anyway

		this.enable = !this.enable;
		return true;
	}

}
RadioButton.prototype = new me.GUI_Object();

//------------------------------------------------- END OF 


/* ---
	
	a start/stop Button object
		
	---										*/
function enableButton (x, y, on_text, off_text, on_callback, off_callback)
{
	me.GUI_Object.call(this,x,y, me.loader.getImage("red_button"));
		
	this.displayWidth		= 168	/ g_GUI_DISPLAY_RATIO; // size of sprite
	this.displayHeight	= 56	/ g_GUI_DISPLAY_RATIO;
	
	
		// specific variable to the Label object
	this.font			= new me.Font("Arial", 14, "white", "center");
	this.font.bold();
	
	this.on_text		= on_text;
	this.off_text		= off_text;
	this.text			= on_text;
	this.y_adjust		= 18;

	this.on_callback		= on_callback;
	this.off_callback		= off_callback;

	this.clicked = function() 
	{
		// change the text on the button
		if (this.text == this.on_text)
		{
			this.text = this.off_text;
		}
		else
		{
			this.text = this.on_text;
		}

		// call the specified callback
		if (this.text == this.off_text)
			this.on_callback();
		else
			this.off_callback();
		
		return true;
	}
	
	this.draw = function(context) 
	{
		// call the parent draw function;
		me.GUI_Object.prototype.draw.call(this, context);
		dim = this.font.measure(context, this.text);
		this.font.draw(context, this.text, this.pos.x + ((this.displayWidth - dim.width) / 2) , this.pos.y + this.y_adjust);
	}
};
enableButton.prototype = new me.GUI_Object();
//------------------------------------------------- END OF 


/* ---
	
	a very ugly progress bar :)
		
	---										*/
function progressBar (x, y, width, height, maxcol)
{
	var progressObj =
	{	
		currentCol	:	1,
		maxcol		:	SoundEngine.MAXCOL,
		
		pos			: new me.Vector2d(x, y),
		z				: 0,
		visible		: true,
		width			: width,
		height		: height,
		
		invalidated : false,
		
		
		// beurk...
		bar_size		: [0,
							0,
							56 / g_GUI_DISPLAY_RATIO,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							
							12 + (56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO),
							
							12 + (56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO),
							
							12 + (56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO) + 3,
							(56 / g_GUI_DISPLAY_RATIO)
							
							
							],
		
		progress		: 0,
		
		isClickable	: false,
		
		setCurrentCol: function(col)
		{
			this.currentCol = col;
			this.invalidated = true;
		},
		
		

		update: function()
		{
			return this.invalidated;
		},
		
		draw: function(context)
		{
			context.strokeStyle = "red";
			context.strokeRect(this.pos.x, this.pos.y, this.width, this.height);
			
			if (this.invalidated)
			{
				if (this.currentCol == 1)
					this.progress = this.bar_size[this.currentCol];
				else
					this.progress += this.bar_size[this.currentCol];
					
				this.invalidated = false;
			}
			context.fillStyle = "red";
			context.fillRect( this.pos.x + this.progress, this.pos.y, 56 / g_GUI_DISPLAY_RATIO, this.height);
			
			
		}
		
		
	}
	return progressObj;
}
//------------------------------------------------- END OF 

/* ---
	
	draw a row of pattern
		
	---			*/
function patternRow (x, y, text, callback)
{
	// position of our pattern row
	this.pos = new me.Vector2d(x, y);
		
	// z position (for ordering display)
	this.z = 0;

	this.text				= text;
	
	this.ELEMENT_SPACE	= 3;
	
	this.displayHeight	= 0;
	
	this.isClickable		= true;
	
	this.callback			= callback;
		
	this.patternElements = new Array();
	
	this.updated = false;
	
	this.visible = true;
	
	this.init =  function()
	{
		var x = this.pos.x;
		
		this.patternElements[0] = new Label(x, this.pos.y, this.text);
		
		x += this.patternElements[0].displayWidth + this.ELEMENT_SPACE * 3;
		
		for (var i=1;i<SoundEngine.MAXCOL+1;i++)
		{
			this.patternElements[i] = new RadioButton(x, this.pos.y, this.callback);
			
			x += this.patternElements[i].displayWidth + this.ELEMENT_SPACE;
			// double space every four buttons
			if ((i % 4) == 0) 
				x += this.ELEMENT_SPACE *3;
		}
		
		// take the first element as a reference for the height
		this.displayHeight = this.patternElements[0].displayHeight;
		
	}

	this.mouseEvent = function (x, y)
	{
		// start at 1, as element 0 is a label
		for (var i=1;i<SoundEngine.MAXCOL+1;i++)
		{
			if (this.patternElements[i].mouseEvent(x,y) == true)
				this.updated = true;
		}
	}
	
	/*---
	
		Update function
	  ---*/
	
	this.update = function()
	{
		if (this.updated)
		{
			// clear the flag
			this.updated = false;
			return true;
		}
		return false;
	}

	
	this.draw = function (context)
	{
		
		for (var i=0;i<SoundEngine.MAXCOL+1;i++)
		{
			this.patternElements[i].draw(context);
		}

	}
	
}
//------------------------------------------------- END OF 