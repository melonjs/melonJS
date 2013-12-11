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
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {String} font a CSS font name
	 * @param {Number|String} size size, or size + suffix (px, em, pt)
	 * @param {String} fillStyle a CSS color value
	 * @param {String} [textAlign="left"] horizontal alignment
	 */
    me.Font = me.Renderable.extend(
    /** @scope me.Font.prototype */ {

		// private font properties
		/** @ignore */
		font : null,
        fontSize : null,
       
		/**
		 * defines the color used to draw the font.<br>
		 * Default value : "#000000"
		 * @public
		 * @type String
		 * @name me.Font#fillStyle
		 */
		fillStyle : "#000000",

		/**
		 * defines the color used to draw the font stroke.<br>
		 * Default value : "#000000"
		 * @public
		 * @type String
		 * @name me.Font#strokeStyle
		 */
		strokeStyle : "#000000",
        
		/**
		 * sets the current line width, in pixels, when drawing stroke
		 * Default value : 1
		 * @public
		 * @type Number
		 * @name me.Font#lineWidth 
		 */
		lineWidth  : 1,
		
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
		 * Set the line spacing height (when displaying multi-line strings). <br>
		 * Current font height will be multiplied with this value to set the line height.
		 * Default value : 1.0
		 * @public
		 * @type Number
		 * @name me.Font#lineHeight
		 */
		lineHeight : 1.0,
        
		/** @ignore */
		init : function(font, size, fillStyle, textAlign) {
            this.pos = new me.Vector2d();
            this.fontSize = new me.Vector2d();
            
			// font name and type
			this.set(font, size, fillStyle, textAlign);
			
            // parent constructor
            this.parent(this.pos, 0, this.fontSize.y);
		},

		/**
		 * make the font bold
		 * @name bold
		 * @memberOf me.Font
		 * @function
		 */
		bold : function() {
			this.font = "bold " + this.font;
		},

		/**
		 * make the font italic
		 * @name italic
		 * @memberOf me.Font
		 * @function
		 */
		italic : function() {
			this.font = "italic " + this.font;
		},

		/**
		 * Change the font settings
		 * @name set
		 * @memberOf me.Font
		 * @function
		 * @param {String} font a CSS font name
		 * @param {Number|String} size size, or size + suffix (px, em, pt)
		 * @param {String} fillStyle a CSS color value
		 * @param {String} [textAlign="left"] horizontal alignment
		 * @example
		 * font.set("Arial", 20, "white");
		 * font.set("Arial", "1.5em", "white");
		 */
		set : function(font, size, fillStyle, textAlign) {
			// font name and type
			var font_names = font.split(",").map(function (value) {
				value = value.trim();
				return (
					!/(^".*"$)|(^'.*'$)/.test(value)
				) ? '"' + value + '"' : value;
			});
			
            this.fontSize.y = parseInt(size, 10);
			this.height = this.fontSize.y;
            
            if (typeof size === "number") {
				size += "px";
			}
			this.font = size + " " + font_names.join(",");
			this.fillStyle = fillStyle;
			if (textAlign) {
				this.textAlign = textAlign;
			}
		},

		/**
		 * measure the given text size in pixels
		 * @name measureText
		 * @memberOf me.Font
		 * @function
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @return {Object} returns an object, with two attributes: width (the width of the text) and height (the height of the text).
		 */
		measureText : function(context, text) {
			// draw the text
			context.font = this.font;
			context.fillStyle = this.fillStyle;
			context.textAlign = this.textAlign;
			context.textBaseline = this.textBaseline;
            
            this.height = this.width = 0;
            
			var strings = (""+text).split("\n");
			for (var i = 0; i < strings.length; i++) {
				this.width = Math.max(context.measureText(strings[i].trimRight()).width, this.width);
				this.height += this.fontSize.y * this.lineHeight;
			}
			return {width: this.width, height: this.height};
		},

		/**
		 * draw a text at the specified coord
		 * @name draw
		 * @memberOf me.Font
		 * @function
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @param {Number} x
		 * @param {Number} y
		 */
		draw : function(context, text, x, y) {
			// update initial position
            this.pos.set(x,y);
            
            // draw the text
			context.font = this.font;
			context.fillStyle = this.fillStyle;
			context.textAlign = this.textAlign;
			context.textBaseline = this.textBaseline;
		           
			var strings = (""+text).split("\n");
			for (var i = 0; i < strings.length; i++) {
				// draw the string
				context.fillText(strings[i].trimRight(), ~~x, ~~y);
				// add leading space
				y += this.fontSize.y * this.lineHeight;
			}
			
		},
        
		/**
		 * draw a stroke text at the specified coord, as defined <br>
		 * by the `lineWidth` and `fillStroke` properties. <br>
		 * Note : using drawStroke is not recommended for performance reasons
		 * @name drawStroke
		 * @memberOf me.Font
		 * @function
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @param {Number} x
		 * @param {Number} y
		 */
		drawStroke : function(context, text, x, y) {
            // update initial position
            this.pos.set(x,y);
            
            // save the context, as we are modifying
            // too much parameter in this function
            context.save();
            
            // draw the text
            context.font = this.font;
            context.fillStyle = this.fillStyle;
            context.strokeStyle = this.strokeStyle;
            context.lineWidth = this.lineWidth;
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;
		           
            var strings = (""+text).split("\n");
            for (var i = 0; i < strings.length; i++) {
                var _string = strings[i].trimRight();
                // draw the border
                context.strokeText(_string, ~~x, ~~y);
                // draw the string
                context.fillText(_string, ~~x, ~~y);
                // add leading space
                y += this.fontSize.y * this.lineHeight;
            }
            
            // restore the context
            context.restore();
		}
        
	});

    
	/**
	 * a bitpmap font object
	 * @class
	 * @extends me.Font
	 * @memberOf me
	 * @constructor
	 * @param {String} font
	 * @param {Number|Object} size either an int value, or an object like {x:16,y:16}
	 * @param {Number} [scale="1.0"]
	 * @param {String} [firstChar="0x20"]
	 */
    me.BitmapFont = me.Font.extend(
    /** @scope me.BitmapFont.prototype */ {
		/** @ignore */
        // font scale;
		sSize : null,
		// first char in the ascii table
		firstChar : 0x20,
		
		// #char per row
		charCount : 0,

		/** @ignore */
		init : function(font, size, scale, firstChar) {
			// font name and type
			this.parent(font, null, null);
			
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
		 * @ignore	
		 */
		loadFontMetrics : function(font, size) {
			this.font = me.loader.getImage(font);

			// some cheap metrics
			this.fontSize.x = size.x || size;
			this.fontSize.y = size.y || this.font.height;
			this.sSize.copy(this.fontSize);
			this.height = this.sSize.y;
            
			// #char per row  
			this.charCount = ~~(this.font.width / this.fontSize.x);
		},

		/**
		 * change the font settings
		 * @name set
		 * @memberOf me.BitmapFont
		 * @function
		 * @param {String} textAlign ("left", "center", "right")
		 * @param {Number} [scale]
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
		 * @name resize
		 * @memberOf me.BitmapFont
		 * @function
		 * @param {Number} scale ratio
		 */
		resize : function(scale) {
			// updated scaled Size
			this.sSize.setV(this.fontSize);
			this.sSize.x *= scale;
			this.sSize.y *= scale;
            this.height = this.sSize.y;
        },

		/**
		 * measure the given text size in pixels
		 * @name measureText
		 * @memberOf me.BitmapFont
		 * @function
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @return {Object} returns an object, with two attributes: width (the width of the text) and height (the height of the text).
		 */
		measureText : function(context, text) {
			
			var strings = (""+text).split("\n");
            
            this.height = this.width = 0;
            
			for (var i = 0; i < strings.length; i++) {
				this.width = Math.max((strings[i].trimRight().length * this.sSize.x), this.width);
				this.height += this.sSize.y * this.lineHeight;
			}
			return {width: this.width, height: this.height};
		},

		/**
		 * draw a text at the specified coord
		 * @name draw
		 * @memberOf me.BitmapFont
		 * @function
		 * @param {Context} context 2D Context
		 * @param {String} text
		 * @param {Number} x
		 * @param {Number} y
		 */
		draw : function(context, text, x, y) {
			var strings = (""+text).split("\n");
			var lX = x;
			var height = this.sSize.y * this.lineHeight;
			// update initial position
            this.pos.set(x,y);
            for (var i = 0; i < strings.length; i++) {
				x = lX;
				var string = strings[i].trimRight();
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
				}
				 
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
				}
				
				// draw the string
				for ( var c = 0,len = string.length; c < len; c++) {
					// calculate the char index
					var idx = string.charCodeAt(c) - this.firstChar;
					if (idx >= 0) {
						// draw it
						context.drawImage(this.font,
							this.fontSize.x * (idx % this.charCount), 
							this.fontSize.y * ~~(idx / this.charCount), 
							this.fontSize.x, this.fontSize.y, 
							~~x, ~~y, 
							this.sSize.x, this.sSize.y);
					}
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
