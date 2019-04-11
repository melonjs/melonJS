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
 * @see me.Renderer#stroke
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

/**
 * @function me.video.getPos
 * @deprecated since 7.0.0
 * @see me.Renderer#getBounds
 */
me.video.getPos = function() {
    console.log("me.video.getPos() is deprecated, please use me.video.renderer.getBounds()");
    return me.video.renderer.getBounds();
};

/**
 * melonJS base class for exception handling.
 * @class
 * @extends me.Object
 * @memberOf me
 * @constructor
 * @deprecated since 7.0.0
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
 * @param {String} msg Error message.
 */
me.Error = me.Object.extend.bind(Error)({
    /**
     * @ignore
     */
    init : function (msg) {
        this.name = "me.Error";
        this.message = msg;
    }
});

/**
 * @function sys.checkVersion
 * @deprecated since 7.1.0
 * @see me.utils#checkVersion
 */
me.sys.checkVersion = function(first, second) {
    console.log("me.sys.checkVersion() is deprecated, please use me.utils.checkVersion()");
    return me.utils.checkVersion(first, second);
};

/**
 * @public
 * @type {Object}
 * @name HASH
 * @memberOf me.game
 * @deprecated since 7.1.0
 * @see me.utils#getUriFragment
 */
Object.defineProperty(me.game, "HASH", {
    /**
     * @ignore
     */
    get : function () {
        console.log("me.game.HASH is deprecated, please use me.utils.getUriFragment()");
        return me.utils.getUriFragment();
    },
    configurable : false
});
