/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * ASCII Table
 * http://www.asciitable.com/ 
 * [ !"#$%&'()*+'-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_'abcdefghijklmnopqrstuvwxyz]
 *
 * -> first char " " 32d (0x20);
 */

(function($, undefined) {

	/**
	 * a generic system font object.
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {String} font
	 * @param {int} size
	 * @param {String} color
	 * @param {String} [align="top"]
	 */
	me.Font = Object.extend(
	/** @scope me.Font.prototype */
	{
		// alignement constants
		ALIGN : {
			LEFT : "left",
			CENTER : "center",
			RIGHT : "right"
		},

		// font properties
		font : null,
		height : null,
		color : null,
		align : null,

		/** @private */
		init : function(font, size, color, align) {

			// font name and type
			this.set(font, size, color, align);
		},

		/**
		 * make the font bold
		 */
		bold : function() {
			this.font = "bold " + this.font;
		},

		/**
		 * make the font italic
		 */
		italic : function() {
			this.font = "italic " + this.font;
		},

		/**
		 * Change the font settings
		 * @param {String} font
		 * @param {int} size
		 * @param {String} color
		 * @param {String} [align="top"]
		 */
		set : function(font, size, color, align) {
			// font name and type
			this.font = "" + size + "px " + font;
			this.height = size;
			this.color = color;
			this.align = align || "top";
		},

		/**
		 * FIX ME !
		 * @private
		 */
		getRect : function() {
			return new me.Rect(new Vector2d(0, 0), 0, 0);
		},

		/**
		 * measure the given test width
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @return {int} width
		 */
		measureText : function(context, text) {
			// draw the text
			context.font = this.font;
			context.fillStyle = this.color;
			context.textBaseLine = this.align;
			var dim = context.measureText(text);
			dim.height = this.height;

			return dim;
		},

		/**
		 * draw a text at the specified coord
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @param {int} x
		 * @param {int} y
		 */
		draw : function(context, text, x, y) {
			// draw the text
			context.font = this.font;
			context.fillStyle = this.color;
			context.textBaseLine = this.align;
			context.fillText(text, ~~x, ~~y);
		}
	});

	/**
	 * a bitpmap font object
	 * @class
	 * @extends me.Font
	 * @memberOf me
	 * @constructor
	 * @param {String} font
	 * @param {int/Object} size either an int value, or an object like {x:16,y:16}
	 * @param {int} [scale="1.0"]
	 * @param {String} [firstChar="0x20"]

	 */
	me.BitmapFont = me.Font.extend(
	/** @scope me.BitmapFont.prototype */
	{
		// character size;
		size : null,
		// font scale;
		sSize : null,
		// first char in the ascii table
		firstChar : 0x20,
		
		// #char per row
		charCount : 0,

		/** @private */
		init : function(font, size, scale, firstChar) {
			// font name and type
			this.parent(font, null, null);

			// font characters size;
			this.size = new me.Vector2d();
			
			// font scaled size;
			this.sSize = new me.Vector2d();

			// first char in the ascii table
			this.firstChar = firstChar || 0x20;

			// load the font metrics
			this.loadFontMetrics(font, size);

			// set a default alignement
			this.align = this.ALIGN.RIGHT
			
			// resize if necessary
			if (scale) { 
				this.resize(scale);
			}

		},

		/**
		 * Load the font metrics
		 * @private	
		 */
		loadFontMetrics : function(font, size) {
			this.font = me.loader.getImage(font);

			// some cheap metrics
			this.size.x = size.x || size;
			this.size.y = size.y || this.font.height;
			this.sSize.copy(this.size);
			
			// #char per row  
			this.charCount = ~~(this.font.width / this.size.x);
		},

		/**
		 * change the font settings
		 * @param {String} align ("left", "center", "right")
		 * @param {int} [scale]
		 */
		set : function(align, scale) {
			this.align = align;
			// updated scaled Size
			if (scale) {
				this.resize(scale);
			}
		},
		
		/**
		 * change the font display size
		 * @param {int} scale ratio
		 */
		resize : function(scale) {
			// updated scaled Size
			this.sSize.copy(this.size);
			this.sSize.x *= scale;
			this.sSize.y *= scale;
		},

		/**
		 * measure the given test width
		 * @param {String} text
		 * @return {int} width
		 */
		measureText : function(text) {
			return {
				width : text.length * this.sSize.x,
				height : this.sSize.y
			};
		},

		/**
		 * draw a text at the specified coord
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @param {int} x
		 * @param {int} y
		 */
		draw : function(context, text, x, y) {
			// make sure it's a text parameter
			if (typeof (text) != 'string')
				text = text.toString();

			// adjust pos if right alig
			if (this.align == this.ALIGN.RIGHT) {
				x -= text.length * this.sSize.x;
			}
			// draw the text
			for ( var i = 0; i < text.length; i++) {
				// calculate the char index
				var idx = text.charCodeAt(i) - this.firstChar;
				// draw it
				context.drawImage(this.font,
						this.size.x * (idx % this.charCount), 
						this.size.y * ~~(idx / this.charCount), 
						this.size.x, this.size.y, 
						~~x, ~~y, 
						this.sSize.x, this.sSize.y);
				x += this.sSize.x;
			}

		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
