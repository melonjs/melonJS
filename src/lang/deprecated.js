/**
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 * @namespace deprecated
 * @memberOf me
 */

/**
 * display a deprecation warning in the console
 * @public
 * @function
 * @memberOf me.deprecated
 * @name warning
 * @param {String} deprecated deprecated class,function or property name
 * @param {String} replacement the replacement class, function, or property name
 * @param {String} version the version since when the lass,function or property is deprecated
 */
export function warning(deprecated, replacement, version) {
    var msg = "melonJS: %s is deprecated since version %s, please use %s";
    var stack = new Error().stack;

    if (console.groupCollapsed) {
        console.groupCollapsed(
            "%c" + msg,
            "font-weight:normal;color:yellow;",
            deprecated,
            version,
            replacement
        );
    } else {
        console.warn(
            msg,
            deprecated,
            version,
            replacement
        );
    }

    if (typeof stack !== "undefined") {
        console.warn(stack);
    }

    if (console.groupCollapsed) {
        console.groupEnd();
    }


};


/**
 * Backward compatibility for deprecated method or properties are automatically
 * applied when automatically generating an UMD bundle (which is the default since version 9.0).
 * @memberof me.deprecated
 * @function apply
 */
 export function apply() {

    /**
     * @function me.device.getPixelRatio
     * @deprecated since 5.1.0
     * @see me.device.devicePixelRatio
     */
    me.device.getPixelRatio = function() {
        warning("me.device.getPixelRatio()", "me.device.devicePixelRatio", "5.1.0");
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
            warning("me.Font", "me.Text", "6.1.0");
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
            warning("me.BitmapFont", "me.BitmapText", "6.1.0");
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
            warning("me.ScreenObject", "me.Stage", "6.2.0");
        }
    });

    /**
     * @function me.Renderer.drawShape
     * @deprecated since 6.3.0
     * @see me.Renderer.stroke
     */
    me.Renderer.prototype.drawShape = function () {
        warning("drawShape()", "the stroke() or fill()", "6.3.0");
        me.Renderer.prototype.stroke.apply(this, arguments);
    };

    /**
     * @function me.video.getPos
     * @deprecated since 7.0.0
     * @see me.device.getElementBounds
     */
    me.video.getPos = function() {
        warning("me.video.getPos()", "me.device.getElementBounds(me.video.renderer.getScreenCanvas());", "7.0.0");
        return me.device.getElementBounds(me.video.renderer.getScreenCanvas());
    };

    /**
     * @classdesc
     * melonJS base class for exception handling.
     * @class
     * @memberOf me
     * @constructor
     * @deprecated since 7.0.0
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
     * @param {String} msg Error message.
     * @example
     * throw new me.Error("Guru Meditation");
     */
     me.Error = function(msg) {
         var err = new Error();
         err.name = "me.Error";
         err.message = msg;
         return err;
     };

    /**
     * @namespace me.sys
     * @deprecated since 9.0.0
     */
    me.sys = me.sys || {};

    /**
     * @function me.sys.checkVersion
     * @deprecated since 7.1.0
     * @see me.utils.checkVersion
     */
    me.sys.checkVersion = function(first, second) {
        warning("me.sys.checkVersion()", "me.utils.checkVersion()", "7.1.0");
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
            warning("me.game.HASH", "me.utils.getUriFragment()", "7.1.0");
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
        warning("me.video.updateDisplaySize()", "me.video.scale()", "7.1.0");
        return me.video.scale(x, y);
    };

    /**
     * @function me.Renderer.scaleCanvas
     * @deprecated since 7.1.0
     * @see me.video.scale
     */
    me.Renderer.prototype.scaleCanvas = function (x, y) {
        warning("scaleCanvas()", "me.video.scale()", "7.1.0");
        return me.video.scale(x, y);
    };

    /**
     * @function me.Entity.distanceToPoint
     * @deprecated since 7.1.0
     * @see me.Renderable.distanceTo
    */
    me.Entity.prototype.distanceToPoint = function (v) {
        warning("distanceToPoint()", "me.Renderable.distanceTo()", "7.1.0");
        return this.distanceTo(v);
    };

    /**
     * @function me.Entity.angleToPoint
     * @deprecated since 7.1.0
     * @see me.Renderable.angleTo
    */
    me.Entity.prototype.angleToPoint = function (v) {
        warning("angleToPoint()", "me.Renderable.angleTo()", "7.1.0");
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
            warning("me.sys.gravity", "me.game.world.gravity", "8.0.0");
            return me.game.world ? me.game.world.gravity.y : undefined;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.gravity", "me.game.world.gravity", "8.0.0");
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
        warning("drawTriangle()", "drawVertices()", "8.0.0");
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
        warning("drawLine()", "drawVertices()", "8.0.0");
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
            warning("me.sys.scale", "me.video.scaleRatio", "8.0.0");
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
        warning("me.video.getWrapper()", "me.device.getParent()", "8.0.0");
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
            warning("me.sys.fps", "me.timer.maxfps", "8.0.0");
            return me.timer.maxfps;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.fps", "me.timer.maxfps", "8.0.0");
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
            warning("me.sys.updatesPerSecond", "me.game.world.fps", "8.0.0");
            return me.game.world.fps;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.updatesPerSecond", "me.game.world.fps", "8.0.0");
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
            warning("me.sys.interpolation", "me.timer.interpolation", "8.0.0");
            return me.timer.interpolation;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.interpolation", "me.timer.interpolation", "8.0.0");
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
        warning("addShapesFromJSON()", "fromJSON()", "8.0.0");
        return this.fromJSON(json, id);
    };

    /**
     * Specify either to stop on audio loading error or not
     * @public
     * @type {Boolean}
     * @name stopOnAudioError
     * @memberOf me.sys
     * @deprecated since 9.0.0
     * @see me.audio.interpolation
     */
    Object.defineProperty(me.sys, "stopOnAudioError", {
        /**
         * @ignore
         */
        get : function () {
            warning("me.sys.stopOnAudioError", "me.audio.stopOnAudioError", "9.0.0");
            return me.audio.stopOnAudioError;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.stopOnAudioError", "me.audio.stopOnAudioError", "9.0.0");
            me.audio.stopOnAudioError = value;
        },
        configurable : false
    });

    /**
     * Specify whether to pause the game when losing focus
     * @public
     * @type {Boolean}
     * @name pauseOnBlur
     * @memberOf me.sys
     * @deprecated since 9.0.0
     * @see me.device.pauseOnBlur
     */
    Object.defineProperty(me.sys, "pauseOnBlur", {
        /**
         * @ignore
         */
        get : function () {
            warning("me.sys.pauseOnBlur", "me.device.pauseOnBlur", "9.0.0");
            return me.audio.pauseOnBlur;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.pauseOnBlur", "me.device.pauseOnBlur", "9.0.0");
            me.device.pauseOnBlur = value;
        },
        configurable : false
    });

    /**
     * Specify whether to unpause the game when gaining focus
     * @public
     * @type {Boolean}
     * @name resumeOnFocus
     * @memberOf me.sys
     * @deprecated since 9.0.0
     * @see me.device.resumeOnFocus
     */
    Object.defineProperty(me.sys, "resumeOnFocus", {
        /**
         * @ignore
         */
        get : function () {
            warning("me.sys.pauseOnBlur", "me.device.resumeOnFocus", "9.0.0");
            return me.device.resumeOnFocus;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.pauseOnBlur", "me.device.resumeOnFocus", "9.0.0");
            me.device.resumeOnFocus = value;
        },
        configurable : false
    });

    /**
     * Specify whether to automatically bring the window to the front
     * @public
     * @type {Boolean}
     * @name autoFocus
     * @memberOf me.sys
     * @deprecated since 9.0.0
     * @see me.device.autoFocus
     */
    Object.defineProperty(me.sys, "autoFocus", {
        /**
         * @ignore
         */
        get : function () {
            warning("me.sys.autoFocus", "me.device.autoFocus", "9.0.0");
            return me.device.autoFocus;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.autoFocus", "me.device.autoFocus", "9.0.0");
            me.device.autoFocus = value;
        },
        configurable : false
    });

    /**
     * Specify whether to stop the game when losing focus or not
     * @public
     * @type {Boolean}
     * @name pauseOnBlur
     * @memberOf me.sys
     * @deprecated since 9.0.0
     * @see me.device.pauseOnBlur
     */
    Object.defineProperty(me.sys, "stopOnBlur", {
        /**
         * @ignore
         */
        get : function () {
            warning("me.sys.pauseOnBlur", "me.device.stopOnBlur", "9.0.0");
            return me.device.stopOnBlur;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.pauseOnBlur", "me.device.stopOnBlur", "9.0.0");
            me.device.stopOnBlur = value;
        },
        configurable : false
    });

    /**
     * Specify the rendering method for tiled layers
     * @public
     * @type {Boolean}
     * @name preRender
     * @memberOf me.sys
     * @deprecated since 9.0.0
     * @see me.game.world.preRender
     */
    Object.defineProperty(me.sys, "preRender", {
        /**
         * @ignore
         */
        get : function () {
            warning("me.sys.preRender", "me.game.world.preRender", "9.0.0");
            return me.game.world.stopOnBlur;
        },

        /**
         * @ignore
         */
        set : function (value) {
            warning("me.sys.preRender", "me.game.world.preRender", "9.0.0");
            me.game.world.stopOnBlur = value;
        },
        configurable : false
    });

    /**
     * @namespace me.levelDirector
     * @deprecated since 9.0.0
     */
    me.levelDirector = me.levelDirector || {};

    /**
     * @function me.levelDirector.loadLevel
     * @deprecated since 9.0.0
     * @see me.level.load
     */
    me.levelDirector.loadLevel = function(levelId, options) {
        warning("me.levelDirector.loadLevel()", "me.level.load()", "9.0.0");
        return me.level.load(levelId, options);
    };

    /**
     * @function me.levelDirector.getCurrentLevelId
     * @deprecated since 9.0.0
     * @see me.level.getCurrentLevelId
     */
    me.levelDirector.getCurrentLevelId = function() {
        warning("me.levelDirector.getCurrentLevelId()", "me.level.getCurrentLevelId()", "9.0.0");
        return me.level.getCurrentLevelId();
    };

    /**
     * @function me.levelDirector.getCurrentLevel
     * @deprecated since 9.0.0
     * @see me.level.load
     */
    me.levelDirector.getCurrentLevel = function() {
        warning("me.levelDirector.getCurrentLevel()", "me.level.getCurrentLevel()", "9.0.0");
        return me.level.getCurrentLevel();
    };

    /**
     * @function me.levelDirector.reloadLevel
     * @deprecated since 9.0.0
     * @see me.level.reload
     */
    me.levelDirector.reloadLevel = function(options) {
        warning("me.levelDirector.reloadLevel()", "me.level.reload()", "9.0.0");
        return me.level.reload(options);
    };

    /**
     * @function me.levelDirector.nextLevel
     * @deprecated since 9.0.0
     * @see me.level.load
     */
    me.levelDirector.nextLevel = function(options) {
        warning("me.levelDirector.nextLevel()", "me.level.next()", "9.0.0");
        return me.level.next(options);
    };

    /**
     * @function me.levelDirector.previousLevel
     * @deprecated since 9.0.0
     * @see me.level.load
     */
    me.levelDirector.previousLevel = function(options) {
        warning("me.levelDirector.previousLevel()", "me.level.previous()", "9.0.0");
        return me.level.previous(options);
    };

    /**
     * @function me.levelDirector.levelCount
     * @deprecated since 9.0.0
     * @see me.level.levelCount
     */
    me.levelDirector.levelCount = function() {
        warning("me.levelDirector.levelCount()", "me.level.levelCount()", "9.0.0");
        return me.level.levelCount();
    };

    /**
     * translate the rect by the specified vector
     * @name translate
     * @memberOf me.Rect.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Rect.translate
     * @param {me.Vector2d} v vector offset
     * @return {me.Rect} this rectangle
     */
    me.Rect.prototype.translateV = function (v) {
        warning("translateV()", "translate()", "9.0.0");
        return this.translate(v);
    };

    /**
     * Returns true if the rectangle contains the given point
     * @name containsPoint
     * @memberOf me.Rect.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Rect.contains
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    me.Rect.prototype.containsPoint = function (x, y) {
        warning("containsPoint()", "contains()", "9.0.0");
        return this.contains(x, y);
    };

    /**
     * translate the Polygon by the specified vector
     * @name translateV
     * @memberOf me.Polygon.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Polygon.translate
     * @param {me.Vector2d} v vector offset
     * @return {me.Polygon} Reference to this object for method chaining
     */
    me.Polygon.prototype.translateV = function (v) {
        warning("translateV()", "translate()", "9.0.0");
        return this.translate(v);
    };

    /**
     * check if this Polygon contains the specified point
     * @name containsPointV
     * @memberOf me.Polygon.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Polygon.contains
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */
    me.Polygon.prototype.containsPointV = function (v) {
        warning("containsPointV()", "contains()", "9.0.0");
        return this.contains(v);
    };

    /**
     * Returns true if the polygon contains the given point. <br>
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name containsPoint
     * @memberOf me.Polygon.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Polygon.contains
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */

    me.Polygon.prototype.containsPoint = function (x, y) {
        warning("containsPoint()", "contains()", "9.0.0");
        return this.contains(x, y);
    };

    /**
     * check if this Line contains the specified point
     * @name containsPointV
     * @memberOf me.Line.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Line.contains
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */
    me.Line.prototype.containsPointV = function (v) {
        warning("containsPointV()", "contains()", "9.0.0");
        return this.contains(v);
    };

    /**
     * Returns true if the Line contains the given point. <br>
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name containsPoint
     * @memberOf me.Line.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Line.contains
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    me.Line.prototype.containsPoint = function (x, y) {
        warning("containsPoint()", "contains()", "9.0.0");
        return this.contains(x, y);
    };

    /**
     * translate the circle/ellipse by the specified vector
     * @name translateV
     * @memberOf me.Ellipse.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Ellipse.translate
     * @param {me.Vector2d} v vector offset
     * @return {me.Rect} this ellipse
     */
    me.Ellipse.prototype.translateV = function (v) {
        warning("translateV()", "translate()", "9.0.0");
        return this.translate(v);
    };

    /**
     * check if this Ellipse contains the specified point
     * @name containsPointV
     * @memberOf me.Ellipse.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Ellipse.contains
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */
    me.Ellipse.prototype.containsPointV = function (v) {
        warning("containsPointV()", "contains()", "9.0.0");
        return this.contains(v);
    };

    /**
     * Returns true if the Ellipse contains the given point
     * @name containsPoint
     * @memberOf me.Ellipse.prototype
     * @function
     * @deprecated since 9.0.0
     * @see me.Ellipse.contains
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    me.Ellipse.prototype.containsPoint = function (x, y) {
        warning("containsPoint()", "contains()", "9.0.0");
        return this.contains(x, y);
    };

    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberOf me.Matrix2d
     * @function
     * @deprecated since 9.0.0
     * @see me.Matrix2d.translate
     * @param {me.Vector2d} v the vector to translate the matrix by
     * @return {me.Matrix2d} Reference to this object for method chaining
     */
    me.Matrix2d.prototype.translateV = function (v) {
        warning("translateV()", "translate()", "9.0.0");
        return this.translate(v);
    };

    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberOf me.Matrix3d
     * @function
     * @deprecated since 9.0.0
     * @see me.Matrix3d.translate
     * @param {me.Vector2d|me.Vector3d} v the vector to translate the matrix by
     * @return {me.Matrix3d} Reference to this object for method chaining
     */
    me.Matrix3d.prototype.translateV = function (v) {
        warning("translateV()", "translate()", "9.0.0");
        return this.translate(v);
    };

};
