/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier Biot, Jason Oster
 * http://www.melonjs.org
 */
(function () {
    var cssToRGB = {
        // CSS1
        "black"                 : [   0,   0,   0 ],
        "silver"                : [ 192, 192, 129 ],
        "gray"                  : [ 128, 128, 128 ],
        "white"                 : [ 255, 255, 255 ],
        "maroon"                : [ 128,   0,   0 ],
        "red"                   : [ 255,   0,   0 ],
        "purple"                : [ 128,   0, 128 ],
        "fuchsia"               : [ 255,   0, 255 ],
        "green"                 : [   0, 128,   0 ],
        "lime"                  : [   0, 255,   0 ],
        "olive"                 : [ 128, 128,   0 ],
        "yellow"                : [ 255, 255,   0 ],
        "navy"                  : [   0,   0, 128 ],
        "blue"                  : [   0,   0, 255 ],
        "teal"                  : [   0, 128, 128 ],
        "aqua"                  : [   0, 255, 255 ],

        // CSS2
        "orange"                : [ 255, 165,   0 ],

        // CSS3
        "aliceblue"             : [ 240, 248, 245 ],
        "antiquewhite"          : [ 250, 235, 215 ],
        "aquamarine"            : [ 127, 255, 212 ],
        "azure"                 : [ 240, 255, 255 ],
        "beige"                 : [ 245, 245, 220 ],
        "bisque"                : [ 255, 228, 196 ],
        "blanchedalmond"        : [ 255, 235, 205 ],
        "blueviolet"            : [ 138,  43, 226 ],
        "brown"                 : [ 165,  42,  42 ],
        "burlywood"             : [ 222, 184,  35 ],
        "cadetblue"             : [  95, 158, 160 ],
        "chartreuse"            : [ 127, 255,   0 ],
        "chocolate"             : [ 210, 105,  30 ],
        "coral"                 : [ 255, 127,  80 ],
        "cornflowerblue"        : [ 100, 149, 237 ],
        "cornsilk"              : [ 255, 248, 220 ],
        "crimson"               : [ 220,  20,  60 ],
        "darkblue"              : [   0,   0, 139 ],
        "darkcyan"              : [   0, 139, 139 ],
        "darkgoldenrod"         : [ 184, 134,  11 ],
        "darkgray[*]"           : [ 169, 169, 169 ],
        "darkgreen"             : [   0, 100,   0 ],
        "darkgrey[*]"           : [ 169, 169, 169 ],
        "darkkhaki"             : [ 189, 183, 107 ],
        "darkmagenta"           : [ 139,   0, 139 ],
        "darkolivegreen"        : [  85, 107,  47 ],
        "darkorange"            : [ 255, 140,   0 ],
        "darkorchid"            : [ 153,  50, 204 ],
        "darkred"               : [ 139,   0,   0 ],
        "darksalmon"            : [ 233, 150, 122 ],
        "darkseagreen"          : [ 143, 188, 143 ],
        "darkslateblue"         : [  72,  61, 139 ],
        "darkslategray"         : [  47,  79,  79 ],
        "darkslategrey"         : [  47,  79,  79 ],
        "darkturquoise"         : [   0, 206, 209 ],
        "darkviolet"            : [ 148,   0, 211 ],
        "deeppink"              : [ 255,  20, 147 ],
        "deepskyblue"           : [   0, 191, 255 ],
        "dimgray"               : [ 105, 105, 105 ],
        "dimgrey"               : [ 105, 105, 105 ],
        "dodgerblue"            : [  30, 144, 255 ],
        "firebrick"             : [ 178,  34,  34 ],
        "floralwhite"           : [ 255, 250, 240 ],
        "forestgreen"           : [  34, 139,  34 ],
        "gainsboro"             : [ 220, 220, 220 ],
        "ghostwhite"            : [ 248, 248, 255 ],
        "gold"                  : [ 255, 215,   0 ],
        "goldenrod"             : [ 218, 165,  32 ],
        "greenyellow"           : [ 173, 255,  47 ],
        "grey"                  : [ 128, 128, 128 ],
        "honeydew"              : [ 240, 255, 240 ],
        "hotpink"               : [ 255, 105, 180 ],
        "indianred"             : [ 205,  92,  92 ],
        "indigo"                : [  75,   0, 130 ],
        "ivory"                 : [ 255, 255, 240 ],
        "khaki"                 : [ 240, 230, 140 ],
        "lavender"              : [ 230, 230, 250 ],
        "lavenderblush"         : [ 255, 240, 245 ],
        "lawngreen"             : [ 124, 252,   0 ],
        "lemonchiffon"          : [ 255, 250, 205 ],
        "lightblue"             : [ 173, 216, 230 ],
        "lightcoral"            : [ 240, 128, 128 ],
        "lightcyan"             : [ 224, 255, 255 ],
        "lightgoldenrodyellow"  : [ 250, 250, 210 ],
        "lightgray"             : [ 211, 211, 211 ],
        "lightgreen"            : [ 144, 238, 144 ],
        "lightgrey"             : [ 211, 211, 211 ],
        "lightpink"             : [ 255, 182, 193 ],
        "lightsalmon"           : [ 255, 160, 122 ],
        "lightseagreen"         : [  32, 178, 170 ],
        "lightskyblue"          : [ 135, 206, 250 ],
        "lightslategray"        : [ 119, 136, 153 ],
        "lightslategrey"        : [ 119, 136, 153 ],
        "lightsteelblue"        : [ 176, 196, 222 ],
        "lightyellow"           : [ 255, 255, 224 ],
        "limegreen"             : [  50, 205,  50 ],
        "linen"                 : [ 250, 240, 230 ],
        "mediumaquamarine"      : [ 102, 205, 170 ],
        "mediumblue"            : [   0,   0, 205 ],
        "mediumorchid"          : [ 186,  85, 211 ],
        "mediumpurple"          : [ 147, 112, 219 ],
        "mediumseagreen"        : [  60, 179, 113 ],
        "mediumslateblue"       : [ 123, 104, 238 ],
        "mediumspringgreen"     : [   0, 250, 154 ],
        "mediumturquoise"       : [  72, 209, 204 ],
        "mediumvioletred"       : [ 199,  21, 133 ],
        "midnightblue"          : [  25,  25, 112 ],
        "mintcream"             : [ 245, 255, 250 ],
        "mistyrose"             : [ 255, 228, 225 ],
        "moccasin"              : [ 255, 228, 181 ],
        "navajowhite"           : [ 255, 222, 173 ],
        "oldlace"               : [ 253, 245, 230 ],
        "olivedrab"             : [ 107, 142,  35 ],
        "orangered"             : [ 255,  69,   0 ],
        "orchid"                : [ 218, 112, 214 ],
        "palegoldenrod"         : [ 238, 232, 170 ],
        "palegreen"             : [ 152, 251, 152 ],
        "paleturquoise"         : [ 175, 238, 238 ],
        "palevioletred"         : [ 219, 112, 147 ],
        "papayawhip"            : [ 255, 239, 213 ],
        "peachpuff"             : [ 255, 218, 185 ],
        "peru"                  : [ 205, 133,  63 ],
        "pink"                  : [ 255, 192, 203 ],
        "plum"                  : [ 221, 160, 221 ],
        "powderblue"            : [ 176, 224, 230 ],
        "rosybrown"             : [ 188, 143, 143 ],
        "royalblue"             : [  65, 105, 225 ],
        "saddlebrown"           : [ 139,  69,  19 ],
        "salmon"                : [ 250, 128, 114 ],
        "sandybrown"            : [ 244, 164,  96 ],
        "seagreen"              : [  46, 139,  87 ],
        "seashell"              : [ 255, 245, 238 ],
        "sienna"                : [ 160,  82,  45 ],
        "skyblue"               : [ 135, 206, 235 ],
        "slateblue"             : [ 106,  90, 205 ],
        "slategray"             : [ 112, 128, 144 ],
        "slategrey"             : [ 112, 128, 144 ],
        "snow"                  : [ 255, 250, 250 ],
        "springgreen"           : [   0, 255, 127 ],
        "steelblue"             : [  70, 130, 180 ],
        "tan"                   : [ 210, 180, 140 ],
        "thistle"               : [ 216, 191, 216 ],
        "tomato"                : [ 255,  99,  71 ],
        "turquoise"             : [  64, 224, 208 ],
        "violet"                : [ 238, 130, 238 ],
        "wheat"                 : [ 245, 222, 179 ],
        "whitesmoke"            : [ 245, 245, 245 ],
        "yellowgreen"           : [ 154, 205,  50 ]
    };

    /**
     * A color manipulation object.
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {Number} [r=0] red component
     * @param {Number} [g=0] green component
     * @param {Number} [b=0] blue component
     * @param {Number} [a=1.0] alpha value
     */
    me.Color = Object.extend(
    /** @scope me.Color.prototype */
    {

        /** @ignore */
        init : function (r, g, b, a) {
            /**
             * Color Red Component
             * @name r
             * @memberOf me.Color
             * @type {Number}
             * @readonly
             */
            this.r = r || 0;

            /**
             * Color Green Component
             * @name g
             * @memberOf me.Color
             * @type {Number}
             * @readonly
             */
            this.g = g || 0;

            /**
             * Color Blue Component
             * @name b
             * @memberOf me.Color
             * @type {Number}
             * @readonly
             */
            this.b = b || 0;

            /**
             * Color alpha Component
             * @name alpha
             * @memberOf me.Color
             * @type {Number}
             * @readonly
             */
            this.alpha = a || 1.0;
            return this;
        },

        /**
         * @ignore
         */
        onResetEvent : function (r, g, b, a) {
            return this.setColor(r, g, b, a);
        },

        /**
         * Set this color to the specified value.
         * @name setColor
         * @memberOf me.Color
         * @function
         * @param {Number} r red component
         * @param {Number} g green component
         * @param {Number} b blue component
         * @param {Number} [a=1.0] alpha value
         * @return {me.Color} Reference to this object for method chaining
         */
        setColor : function (r, g, b, a) {
            this.r = Math.floor(r || 0).clamp(0, 255);
            this.g = Math.floor(g || 0).clamp(0, 255);
            this.b = Math.floor(b || 0).clamp(0, 255);
            this.alpha = typeof(a) === "undefined" ? 1.0 : a.clamp(0, 1);

            return this;
        },

        /**
         * Create a new copy of this color object.
         * @name clone
         * @memberOf me.Color
         * @function
         * @return {me.Color} Reference to the newly cloned object
         */
        clone : function () {
            return me.pool.pull("me.Color", this.r, this.g, this.b, this.alpha);
        },

        /**
         * Blend this color with the given one using addition.
         * @name add
         * @memberOf me.Color
         * @function
         * @param {me.Color} color
         * @return {me.Color} Reference to this object for method chaining
         */
        add : function (color) {
            return this.setColor(
                this.r + color.r,
                this.g + color.g,
                this.b + color.b,
                (this.alpha + color.alpha) / 2
            );
        },

        /**
         * Darken this color value by 0..1
         * @name darken
         * @memberOf me.Color
         * @function
         * @param {Number} scale
         * @return {me.Color} Reference to this object for method chaining
         */
        darken : function (scale) {
            scale = scale.clamp(0, 1);
            return this.setColor(
                this.r * scale,
                this.g * scale,
                this.b * scale,
                this.alpha
            );
        },

        /**
         * Lighten this color value by 0..1
         * @name lighten
         * @memberOf me.Color
         * @function
         * @param {Number} scale
         * @return {me.Color} Reference to this object for method chaining
         */
        lighten : function (scale) {
            scale = scale.clamp(0, 1);
            return this.setColor(
                this.r + (255 - this.r) * scale,
                this.g + (255 - this.g) * scale,
                this.b + (255 - this.b) * scale,
                this.alpha
            );
        },

        /**
         * Generate random r,g,b values for this color object
         * @name random
         * @memberOf me.Color
         * @function
         * @return {me.Color} Reference to this object for method chaining
         */
        random : function () {
            return this.setColor(
                Math.random() * 256,
                Math.random() * 256,
                Math.random() * 256,
                this.alpha
            );
        },

        /**
         * Return true if the r,g,b,a values of this color are equal with the
         * given one.
         * @name equals
         * @memberOf me.Color
         * @function
         * @param {me.Color} color
         * @return {Boolean}
         */
        equals : function (color) {
            return (
                (this.r === color.r) &&
                (this.g === color.g) &&
                (this.b === color.b) &&
                (this.alpha === color.alpha)
            );
        },

        /**
         * Parse a CSS color string and set this color to the corresponding
         * r,g,b values
         * @name parseCSS
         * @memberOf me.Color
         * @function
         * @param {String} color
         * @return {me.Color} Reference to this object for method chaining
         */
        parseCSS : function (cssColor) {
            // TODO : Memoize this function by caching its input

            if (!(cssColor in cssToRGB)) {
                return this.parseRGB(cssColor);
            }

            return this.setColor.apply(this, cssToRGB[cssColor]);
        },

        /**
         * Parse an RGB or RGBA CSS color string
         * @name parseRGB
         * @memberOf me.Color
         * @function
         * @param {String} color
         * @return {me.Color} Reference to this object for method chaining
         */
        parseRGB : function (rgbColor) {
            // TODO : Memoize this function by caching its input

            var start;
            if (rgbColor.substring(0, 4) === "rgba") {
                start = 5;
            }
            else if (rgbColor.substring(0, 3) === "rgb") {
                start = 4;
            }
            else {
                return this.parseHex(rgbColor);
            }

            var color = rgbColor.slice(start, -1).split(/\s*,\s*/);
            return this.setColor.apply(this, color);
        },

        /**
         * Parse a Hex color ("#RGB" or "#RRGGBB" format) and set this color to
         * the corresponding r,g,b values
         * @name parseHex
         * @memberOf me.Color
         * @function
         * @param {String} color
         * @return {me.Color} Reference to this object for method chaining
         */
        parseHex : function (hexColor) {
            // TODO : Memoize this function by caching its input

            // Remove the # if present
            if (hexColor.charAt(0) === "#") {
                hexColor = hexColor.substring(1, hexColor.length);
            }

            var r, g, b;

            if (hexColor.length < 6)  {
                // 3 char shortcut is used, double each char
                r = parseInt(hexColor.charAt(0) + hexColor.charAt(0), 16);
                g = parseInt(hexColor.charAt(1) + hexColor.charAt(1), 16);
                b = parseInt(hexColor.charAt(2) + hexColor.charAt(2), 16);
            }
            else {
                r = parseInt(hexColor.substring(0, 2), 16);
                g = parseInt(hexColor.substring(2, 4), 16);
                b = parseInt(hexColor.substring(4, 6), 16);
            }

            return this.setColor(r, g, b);
        },

        /**
         * Get the color in "#RRGGBB" format
         * @name toHex
         * @memberOf me.Color
         * @function
         * @return {String}
         */
        toHex : function () {
            // TODO : Memoize this function by caching its result until any of
            // the r,g,b,a values are changed

            return "#" + this.r.toHex() + this.g.toHex() + this.b.toHex();
        },

        /**
         * Get the color in "rgb(R,G,B)" format
         * @name toRGB
         * @memberOf me.Color
         * @function
         * @return {String}
         */
        toRGB : function () {
            // TODO : Memoize this function by caching its result until any of
            // the r,g,b,a values are changed

            return "rgb(" +
                this.r + "," +
                this.g + "," +
                this.b +
            ")";
        },

        /**
         * Get the color in "rgba(R,G,B,A)" format
         * @name toRGBA
         * @memberOf me.Color
         * @function
         * @return {String}
         */
        toRGBA : function () {
            // TODO : Memoize this function by caching its result until any of
            // the r,g,b,a values are changed

            return "rgba(" +
                this.r + "," +
                this.g + "," +
                this.b + "," +
                this.alpha +
            ")";
        }

    });
})();
