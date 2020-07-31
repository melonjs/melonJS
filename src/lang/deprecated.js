// placeholder for all deprecated classes,
// and corresponding alias for backward compatibility

/**
 * @function me.device.getPixelRatio
 * @deprecated since 5.1.0
 * @see me.device.devicePixelRatio
 */
me.device.getPixelRatio = function() {
    me.utils.deprecated("me.device.getPixelRatio()", "me.device.devicePixelRatio", "5.1.0");
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
        me.utils.deprecated("me.Font", "me.Text", "6.1.0");
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
        me.utils.deprecated("me.BitmapFont", "me.BitmapText", "6.1.0");
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
        me.utils.deprecated("me.ScreenObject", "me.Stage", "6.2.0");
    }
});

/**
 * @function me.Renderer.drawShape
 * @deprecated since 6.3.0
 * @see me.Renderer.stroke
 */
me.Renderer.prototype.drawShape = function () {
    me.utils.deprecated("drawShape()", "the stroke() or fill()", "6.3.0");
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
    me.utils.deprecated("me.video.getPos()", "me.device.getElementBounds(me.video.renderer.getScreenCanvas());", "7.0.0");
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
    me.utils.deprecated("me.sys.checkVersion()", "me.utils.checkVersion()", "7.1.0");
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
        me.utils.deprecated("me.game.HASH", "me.utils.getUriFragment()", "7.1.0");
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
    me.utils.deprecated("me.video.updateDisplaySize()", "me.video.scale()", "7.1.0");
    return me.video.scale(x, y);
};

/**
 * @function me.Renderer.scaleCanvas
 * @deprecated since 7.1.0
 * @see me.video.scale
 */
me.Renderer.prototype.scaleCanvas = function (x, y) {
    me.utils.deprecated("scaleCanvas()", "me.video.scale()", "7.1.0");
    return me.video.scale(x, y);
};

/**
 * @function me.Entity.distanceToPoint
 * @deprecated since 7.1.0
 * @see me.Renderable.distanceTo
*/
me.Entity.prototype.distanceToPoint = function (v) {
    me.utils.deprecated("distanceToPoint()", "me.Renderable.distanceTo()", "7.1.0");
    return this.distanceTo(v);
};

/**
 * @function me.Entity.angleToPoint
 * @deprecated since 7.1.0
 * @see me.Renderable.angleTo
*/
me.Entity.prototype.angleToPoint = function (v) {
    me.utils.deprecated("angleToPoint()", "me.Renderable.angleTo()", "7.1.0");
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
        me.utils.deprecated("me.sys.gravity", "me.game.world.gravity", "8.0.0");
        return me.game.world ? me.game.world.gravity.y : undefined;
    },

    /**
     * @ignore
     */
    set : function (value) {
        me.utils.deprecated("me.sys.gravity", "me.game.world.gravity", "8.0.0");
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
    me.utils.deprecated("drawTriangle()", "drawVertices()", "8.0.0");
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
    me.utils.deprecated("drawLine()", "drawVertices()", "8.0.0");
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
        me.utils.deprecated("me.sys.scale", "me.video.scaleRatio", "8.0.0");
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
    me.utils.deprecated("me.video.getWrapper()", "me.device.getParent()", "8.0.0");
    return me.video.getParent();
};

/**
 * Set game FPS limiting
 * @public
 * @type {Number}
 * @name fps
 * @memberOf me.sys
 * @deprecated since 8.0.0
 * @see me.timer.maxfps
 */
Object.defineProperty(me.sys, "fps", {
    /**
     * @ignore
     */
    get : function () {
        me.utils.deprecated("me.sys.fps", "me.timer.maxfps", "8.0.0");
        return me.timer.maxfps;
    },

    /**
     * @ignore
     */
    set : function (value) {
        me.utils.deprecated("me.sys.fps", "me.timer.maxfps", "8.0.0");
        me.timer.maxfps = value;
    },
    configurable : false
});

/**
 * Rate at which the game physic updates;
 * may be greater than or lower than the display fps
 * @public
 * @type {Number}
 * @name updatesPerSecond
 * @memberOf me.sys
 * @deprecated since 8.0.0
 * @see me.World.fps
 */
Object.defineProperty(me.sys, "updatesPerSecond", {
    /**
     * @ignore
     */
    get : function () {
        me.utils.deprecated("me.sys.updatesPerSecond", "me.game.world.fps", "8.0.0");
        return me.game.world.fps;
    },

    /**
     * @ignore
     */
    set : function (value) {
        me.utils.deprecated("me.sys.updatesPerSecond", "me.game.world.fps", "8.0.0");
        me.game.world.fps = value;
    },
    configurable : false
});

/**
 * Enable/disable frame interpolation
 * @public
 * @type {Boolean}
 * @name interpolation
 * @memberOf me.sys
 * @deprecated since 8.0.0
 * @see me.timer.interpolation
 */
Object.defineProperty(me.sys, "interpolation", {
    /**
     * @ignore
     */
    get : function () {
        me.utils.deprecated("me.sys.interpolation", "me.timer.interpolation", "8.0.0");
        return me.timer.interpolation;
    },

    /**
     * @ignore
     */
    set : function (value) {
        me.utils.deprecated("me.sys.interpolation", "me.timer.interpolation", "8.0.0");
        me.timer.interpolation = value;
    },
    configurable : false
});

/**
 * add collision mesh based on a given Physics Editor JSON object
 * @name addShapesFromJSON
 * @deprecated since 8.0.0
 * @see me.Body.fromJSON
 * @memberOf me.Body
 * @function
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse|Object} shape a shape or JSON object
 * @param {Boolean} batchInsert if true the body bounds won't be updated after adding a shape
 * @return {Number} the shape array length
 */
me.Body.prototype.addShapesFromJSON = function (json, id) {
    me.utils.deprecated("addShapesFromJSON()", "fromJSON()", "8.0.0");
    return this.fromJSON(json, id);
};
