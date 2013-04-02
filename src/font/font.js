/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * ASCII Table
 * http://www.asciitable.com/ 
 * [ !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz]
 *
 * -> first char " " 32d (0x20);
 */

(function($) {

	/**
	 * a generic system font object.
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {String} font
	 * @param {int} size
	 * @param {String} color
	 * @param {String} [textAlign="left"] horizontal alignement
	 */
	me.Font = Object.extend(
	/** @scope me.Font.prototype */
	{

		// private font properties
		font : null,
		height : null,
		color : null,
		
		/**
		 * Set the default text alignment (or justification),<br>
		 * possible values are "left", "right", and "center".<br>
		 * Default value : "left"
		 * @public
		 * @type String
		 * @name me.Font#textAlign
		 */
		textAlign : "left",
		
		/**
		 * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
		 * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
		 * Default value : "top"
		 * @public
		 * @type String
		 * @name me.Font#textBaseline
		 */
		textBaseline : "top",
		
		/**
		 * Set the line height (when displaying multi-line strings). <br>
		 * Current font height will be multiplied with this value to set the line height.
		 * Default value : 1.0
		 * @public
		 * @type Number
		 * @name me.Font#lineHeight
		 */
		lineHeight : 1.0,

		/** @private */
		init : function(font, size, color, textAlign) {

			// font name and type
			this.set(font, size, color, textAlign);
			
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
		 * @param {int} size/{String} size + suffix (px, em, pt)
		 * @param {String} color
		 * @param {String} [textAlign] horizontal alignement
		 * @example
		 * font.set("Arial", 20, "white");
		 * font.set("Arial", "1.5em", "white");
		 */
		set : function(font, size, color, textAlign) {
			// font name and type
			var font_names = font.split(",");
			for (var i = 0; i < font_names.length; i++) {
				font_names[i] = "'" + font_names[i] + "'";
			}
			this.height = parseInt(size);
			if (typeof size === "number") {
				size = "" + size + "px"
			}
			this.font = size + " " + font_names.join(",");;
			this.color = color;
			if (textAlign) {
				this.textAlign = textAlign;
			}
		},

		/**
		 * FIX ME !
		 * @private
		 */
		getRect : function() {
			return new me.Rect(new Vector2d(0, 0), 0, 0);
		},

		/**
		 * measure the given text size in pixels
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @return {Object} returns an object, with two attributes: width (the width of the text) and height (the height of the text).
		 */
		measureText : function(context, text) {
			// draw the text
			context.font = this.font;
			context.fillStyle = this.color;
			context.textAlign = this.textAlign;
			context.textBaseline = this.textBaseline;

			var strings = (""+text).split("\n");
			var width = 0, height = 0;
			for (var i = 0; i < strings.length; i++) {
				width = Math.max(context.measureText(strings[i].trim()).width, width);
				height += this.height * this.lineHeight;
			}
			return {width: width, height: height};
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
			context.textAlign = this.textAlign;
			context.textBaseline = this.textBaseline;
			
			var strings = (""+text).split("\n");
			for (var i = 0; i < strings.length; i++) {
				// draw the string
				context.fillText(strings[i].trim(), ~~x, ~~y);
				// add leading space
				y += this.height * this.lineHeight;
			}
			
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
			this.textAlign = "left";
			this.textBaseline = "top";
			
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
		 * @param {String} textAlign ("left", "center", "right")
		 * @param {int} [scale]
		 */
		set : function(textAlign, scale) {
			this.textAlign = textAlign;
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
			this.sSize.setV(this.size);
			this.sSize.x *= scale;
			this.sSize.y *= scale;
		},

		/**
		 * measure the given text size in pixels
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @return {Object} returns an object, with two attributes: width (the width of the text) and height (the height of the text).
		 */
		measureText : function(context, text) {
			
			var strings = (""+text).split("\n");
			var width = 0, height = 0;
			for (var i = 0; i < strings.length; i++) {
				width = Math.max((strings[i].trim().length * this.sSize.x), width);
				height += this.sSize.y * this.lineHeight;
			}
			return {width: width, height: height};
		},

		/**
		 * draw a text at the specified coord
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @param {int} x
		 * @param {int} y
		 */
		draw : function(context, text, x, y) {
			var strings = (""+text).split("\n");
			var lX = x;
			var height = this.sSize.y * this.lineHeight;
			for (var i = 0; i < strings.length; i++) {
				var x = lX, y = y;
				var string = strings[i].trim();
				// adjust x pos based on alignment value
				var width = string.length * this.sSize.x;
				switch(this.textAlign) {
					case "right":
						x -= width;
						break;

					case "center":
						x -= width * 0.5;
						break;
						
					default : 
						break;
				};
				 
				// adjust y pos based on alignment value
				switch(this.textBaseline) {
					case "middle":
						y -= height * 0.5;
						break;

					case "ideographic":
					case "alphabetic":
					case "bottom":
						y -= height;
						break;
					
					default : 
						break;
				};
				
				// draw the string
				for ( var c = 0,len = string.length; c < len; c++) {
					// calculate the char index
					var idx = string.charCodeAt(c) - this.firstChar;
					// draw it
					context.drawImage(this.font,
							this.size.x * (idx % this.charCount), 
							this.size.y * ~~(idx / this.charCount), 
							this.size.x, this.size.y, 
							~~x, ~~y, 
							this.sSize.x, this.sSize.y);
					x += this.sSize.x;
				}
				// increment line
				y += height;
			}
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
