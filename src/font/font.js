/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 * Font / Bitmap font
 *
 * ASCII Table
 * http://www.asciitable.com/ 
 * [ !"#$%&'()*+'-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_'abcdefghijklmnopqrstuvwxyz]
 *
 * -> first char " " 32d (0x20);
 */

(function($, undefined)
{
	
	/**
	 * a generic system font object.
	 * @class
	 *	@extends Object
	 * @memberOf me
	 * @constructor
    *	@param {String} font
	 * @param {int} size
	 * @param {String} color
	 * @param {String} [align="top"]
	 */
	Font = Object.extend(
   /** @scope me.Font.prototype */
	{
		// alignement constants
		ALIGN :  {	LEFT		:	"left",
						CENTER	:	"center",
						RIGHT		:	"right"
					},
					
		// font properties
		font	 : null,
		height : null,
		color	 : null,
		align  : null,
	
      /** @private */
		init: function(font, size, color, align)
		{
			
			// font name and type
			this.set(font, size, color, align);
		},
	
		/**
		 * make the font bold
		 */
		bold : function ()
		{
			this.font	= "bold "+ this.font;
		},

		/**
		 * make the font italic
		 */
		italic : function ()
		{
			this.font	= "italic "+ this.font;
		},
		
		/**
		 * Change the font settings
		 *	@param {String} font
       * @param {int} size
       * @param {String} color
       * @param {String} [align="top"]
       */
		set : function (font, size, color, align)
		{
			// font name and type
			this.font	= ""+ size +"px " + font;
			this.height = size;
			this.color	= color;
			this.align  = align || "top";
		},
		
		/**
		 *	measure the given test width
		 *	@param {String} text
       * @return {int} width
	    */
		measureText : function (context, text)
		{
			// draw the text
			context.font			= this.font;
			context.fillStyle		= this.color;
			context.textBaseLine = this.align;
			dim						= context.measureText(text);
			dim.height				= this.height;
			
			return dim;
		},
		
		/**
		 * draw a text at the specified coord
		 *	@param {Context} context 2D Context
       * @param {String} text
       *	@param {int} x
       * @param {int} y
		 */
      draw : function (context, text, x, y)
		{
			// draw the text
			context.font			= this.font;
			context.fillStyle		= this.color;
			context.textBaseLine = this.align;
			context.fillText(text, ~~x, ~~y);
		}
	});
	
	/**
	 * a bitpmap font object
	 * @class
	 *	@extends me.Font
	 * @memberOf me
	 * @constructor
    *	@param {String} font
	 * @param {int} size
	 * @param {int} [scale="1.0"]
	 * @param {String} [firstChar="0x20"]

	 */
   BitmapFont = Font.extend(
  /** @scope me.BitmapFont.prototype */
	{
		// character size;
		size		 : null,
		// font scale;
		sSize		 : null,
		// first char in the ascii table
		scale		 : 1.0,
		// first char in the ascii table
		firstChar : 0x20,

		
		/** @private */
		init: function(font, size, scale, firstChar)
		{
			// font name and type
			this.parent(font, null, null);
		
			// character size;
			this.size		= new me.Vector2d(size, 0);
			// font scale;
			this.sSize		= new me.Vector2d();

			// first char in the ascii table
			this.scale = scale || 1.0;
			
			// first char in the ascii table
			this.firstChar = firstChar || 0x20;
				
			// load the font metrics
			this.loadFontMetrics(font);
			
			// set a default alignement
			this.align = this.ALIGN.RIGHT
			
		},

		/**
		 *	Load the font metrics
		 * @private	
       */
		loadFontMetrics : function (font)
		{
			this.font = me.loader.getImage(font);
			
			// some cheap metrics
			//this.size.x = passed arguements;
			this.size.y = this.font.height || 0;
			
			this.sSize.copy(this.size);
			this.sSize.x *= this.scale;
			this.sSize.y *= this.scale;
		},
		
		/**
		 *	change the font settings
		 *	@param {String} align
       * @param {int} scale
	    */
		set : function (align, scale)
		{
			this.align = align;
			// updated scaled Size
			if (scale)
			{
				this.sSize.copy(this.size);
				this.sSize.x *= this.scale;
				this.sSize.y *= this.scale;
			}
		},
		
		/**
		 *	measure the given test width
		 *	@param {String} text
       * @return {int} width
	    */
		measureText : function (text)
		{
			return {width:text.length * this.sSize.x,height:this.sSize.y};
		},

		
		/**
		 * draw a text at the specified coord
		 *	@param {Context} context 2D Context
       * @param {String} text
       *	@param {int} x
       * @param {int} y
		 */
      draw : function (context, text, x, y)
		{
			// make sure it's a text parameter
			if( typeof(text) != 'string' )
					text = text.toString();
			
			// adjust pos if right alig
			if(this.align==this.ALIGN.RIGHT)
			{
				x-= text.length * this.sSize.x;
			}
			
			for(var i=0;i<text.length;i++)
			{
				context.drawImage(this.font,
										(text.charCodeAt(i) - this.firstChar) * this.size.x, 0,
										this.sSize.x,this.sSize.y,
										~~x, ~~y,
										this.size.x,this.size.y);
				x+=this.sSize.x;
			}
		
		}
	});

	/*---------------------------------------------------------*/
	// expose our stuff to the global scope
	/*---------------------------------------------------------*/
	$.me.Font						= Font;
	$.me.BitmapFont				= BitmapFont;
/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);	


