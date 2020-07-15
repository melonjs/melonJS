// placeholder for all deprecated classes,
// and corresponding alias for backward compatibility

/**
 * @function me.device.getPixelRatio
 * @deprecated since 5.1.0
 * @see me.device.devicePixelRatio
 */
me.device.getPixelRatio = function() {
    console.warn("me.device.getPixelRatio() is deprecated, please use me.device.devicePixelRatio");
    return me.device.devicePixelRatio;
};

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
        };
        // super constructor
        this._super(me.Text, "init", [0, 0, settings]);
        // deprecation warning
        console.warn("me.Font is deprecated, please use me.Text");
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
        };
        // super constructor
        this._super(me.BitmapText, "init", [0, 0, settings]);
        // deprecation warning
        console.warn("me.BitmapFont is deprecated, please use me.BitmapText");
    }
});

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
        console.warn("me.ScreenObject is deprecated, please use me.Stage");
    }
});

/**
 * @function me.Renderer.drawShape
 * @deprecated since 6.3.0
 * @see me.Renderer.stroke
 */
me.Renderer.prototype.drawShape = function () {
    console.warn("drawShape() is deprecated, please use the stroke() or fill() function");
    me.Renderer.prototype.stroke.apply(this, arguments);
};

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
  * @see me.device.getElementBounds
  */
me.video.getPos = function() {
    console.warn("me.video.getPos() is deprecated, please use me.device.getElementBounds(me.video.renderer.getScreenCanvas());");
    return me.device.getElementBounds(me.video.renderer.getScreenCanvas());
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
 * @function me.sys.checkVersion
 * @deprecated since 7.1.0
 * @see me.utils.checkVersion
 */
me.sys.checkVersion = function(first, second) {
    console.warn("me.sys.checkVersion() is deprecated, please use me.utils.checkVersion()");
    return me.utils.checkVersion(first, second);
};

/**
 * @public
 * @type {Object}
 * @name HASH
 * @memberOf me.game
 * @deprecated since 7.1.0
 * @see me.utils.getUriFragment
 */
Object.defineProperty(me.game, "HASH", {
    /**
     * @ignore
     */
    get : function () {
        console.warn("me.game.HASH is deprecated, please use me.utils.getUriFragment()");
        return me.utils.getUriFragment();
    },
    configurable : false
});

/**
 * @function me.video.updateDisplaySize
 * @deprecated since 7.1.0
 * @see me.video.scale
 */
me.video.updateDisplaySize = function(x, y) {
    console.warn("me.video.updateDisplaySize() is deprecated, please use me.video.scale()");
    return me.video.scale(x, y);
};

/**
 * @function me.Renderer.scaleCanvas
 * @deprecated since 7.1.0
 * @see me.video.scale
 */
me.Renderer.prototype.scaleCanvas = function (x, y) {
    console.warn("scaleCanvas() is deprecated, please use me.video.scale()");
    return me.video.scale(x, y);
};

/**
 * @function me.Entity.distanceToPoint
 * @deprecated since 7.1.0
 * @see me.Renderable.distanceTo
*/
me.Entity.prototype.distanceToPoint = function (v) {
    console.warn("distanceToPoint() is deprecated, please use me.Renderable.distanceTo()");
    return this.distanceTo(v);
};

/**
 * @function me.Entity.angleToPoint
 * @deprecated since 7.1.0
 * @see me.Renderable.angleTo
*/
me.Entity.prototype.angleToPoint = function (v) {
    console.warn("angleToPoint() is deprecated, please use me.Renderable.angleTo()");
    return this.angleTo(v);
};

/**
 * @public
 * @type {Number}
 * @name gravity
 * @memberOf me.sys
 * @deprecated since 8.0.0
 * @see me.World.gravity
 */
Object.defineProperty(me.sys, "gravity", {
    /**
     * @ignore
     */
    get : function () {
        console.warn("me.sys.gravity is deprecated, please use me.game.world.gravity");
        return me.game.world ? me.game.world.gravity.y : undefined;
    },

    /**
     * @ignore
     */
    set : function (value) {
        console.warn("me.sys.gravity is deprecated, please use me.game.world.gravity");
        if (me.game.world) me.game.world.gravity.y = value;
    },
    configurable : false
});

/**
 * @ignore
 */
me.WebGLRenderer.Compositor = me.WebGLCompositor;

/**
 * Draw triangle(s)
 * @name drawTriangle
 * @deprecated since 8.0.0
 * @see me.WebGLRenderer.Compositor
 * @memberOf me.WebGLRenderer.Compositor.drawVertices
 * @function
 * @param {me.Vector2d[]} points vertices
 * @param {Number} [len=points.length] amount of points defined in the points array
 * @param {Boolean} [strip=false] Whether the array defines a serie of connected triangles, sharing vertices
 */
me.WebGLRenderer.Compositor.prototype.drawTriangle = function (points, len, strip) {
    var gl = this.gl;
    this.drawVertices(strip === true ? gl.TRIANGLE_STRIP : gl.TRIANGLES, points, len);
    console.warn("drawTriangle is deprecated, please use drawVertices");
};

/**
 * Draw a line
 * @name drawLine
 * @deprecated since 8.0.0
 * @memberOf me.WebGLRenderer.Compositor.drawVertices
 * @memberOf me.WebGLRenderer.Compositor
 * @function
 * @param {me.Vector2d[]} points Line vertices
 * @param {Number} [len=points.length] amount of points defined in the points array
 * @param {Boolean} [open=false] Whether the line is open (true) or closed (false)
 */
me.WebGLRenderer.Compositor.prototype.drawLine = function (points, len, open) {
    var gl = this.gl;
    this.drawVertices(open === true ? gl.LINE_STRIP : gl.LINE_LOOP, points, len);
    console.warn("drawLine is deprecated, please use drawVertices");
};

/**
 * @public
 * @type {me.Vector2d}
 * @name scale
 * @memberOf me.sys
 * @deprecated since 8.0.0
 * @see me.video.scaleRatio
 */
Object.defineProperty(me.sys, "scale", {
    /**
     * @ignore
     */
    get : function () {
        console.warn("me.sys.scale is deprecated, please use me.video.scaleRatio");
        return me.video.scaleRatio;
    },
    configurable : false
});

/**
 * @function me.video.getWrapper
 * @deprecated since 8.0.0
 * @see me.video.getParent
 */
me.video.getWrapper = function() {
    console.warn("me.video.getWrapper()is deprecated, please use me.device.getParent();");
    return me.video.getParent();
};
