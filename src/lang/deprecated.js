/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2019 Olivier Biot
 * http://www.melonjs.org
 */

// placeholder for all deprecated classes,
// and corresponding alias for backward compatibility

/**
 * @class me.ScreenObject
 * @deprecated since 6.2.0
 * @see me.Stage
 */
me.ScreenObject = me.Stage.extend({
    /** @ignore */
    init: function (settings) {
        // super constructor
        this._super(me.Stage, "init", settings);
        // deprecation warning
        console.log("me.ScreenObject is deprecated, please use me.Stage");
    }
});

/**
 * @class me.Font
 * @deprecated since 6.1.0
 * @see me.Text
 */
me.Font = me.Text.extend({
    /** @ignore */
    init: function (font, size, fillStyle, textAlign) {
        var settings = {
            font:font,
            size:size,
            fillStyle:fillStyle,
            textAlign:textAlign
        }
        // super constructor
        this._super(me.Text, "init", [0, 0, settings]);
        // deprecation warning
        console.log("me.Font is deprecated, please use me.Text");
    },

    /** @ignore */
    setFont : function (font, size, fillStyle, textAlign) {
        // apply fillstyle if defined
        if (typeof(fillStyle) !== "undefined") {
            this.fillStyle.copy(fillStyle);
        }
        // h alignement if defined
        if (typeof(textAlign) !== "undefined") {
            this.textAlign = textAlign;
        }
        // super constructor
        return this._super(me.Text, "setFont", [font, size]);
    }
});

/**
 * @ignore
 */
me.BitmapFontData = me.BitmapTextData;

/**
 * @class me.BitmapFont
 * @deprecated since 6.1.0
 * @see me.BitmapText
 */
me.BitmapFont = me.BitmapText.extend({
    /** @ignore */
    init: function (data, fontImage, scale, textAlign, textBaseline) {
        var settings = {
            font: fontImage,
            fontData: data,
            size: scale,
            textAlign: textAlign,
            textBaseline: textBaseline
        }
        // super constructor
        this._super(me.BitmapText, "init", [0, 0, settings]);
        // deprecation warning
        console.log("me.BitmapFont is deprecated, please use me.BitmapText");
    }
});

/**
 * @function me.Renderer.drawShape
 * @deprecated since 6.3.0
 * @see me.Renderer.stroke
 */
me.Renderer.prototype.drawShape = function () {
    console.log("drawShape() is deprecated, please use the stroke() or fill() function");
    me.Renderer.prototype.stroke.apply(this, arguments);
}

/**
 * @ignore
 */
me.CanvasRenderer.prototype.Texture = me.Renderer.prototype.Texture;

/**
 * @ignore
 */
me.WebGLRenderer.prototype.Texture = me.Renderer.prototype.Texture;
