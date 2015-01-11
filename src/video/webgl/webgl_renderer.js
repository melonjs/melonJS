/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * a WebGL renderer object
     * @extends me.Renderer
     * @namespace me.WebGLRenderer
     * @memberOf me
     * @constructor
     * @param {Canvas} canvas - the html canvas tag to draw to on screen.
     * @param {Number} game_width - the width of the canvas without scaling
     * @param {Number} game_height - the height of the canvas without scaling
     * @param {Object} [options] The renderer parameters
     * @param {Boolean} [options.doubleBuffering] - whether to enable double buffering.
     * @param {Number} [options.zoomX] - The actual width of the canvas with scaling applied
     * @param {Number} [options.zoomY] - The actual height of the canvas with scaling applied
     */
    me.WebGLRenderer = me.Renderer.extend(
    /** @scope me.WebGLRenderer.prototype */
    {
        /**
         * @ignore
         */
        init : function (c, width, height, options) {
            this._super(me.Renderer, "init", [c, width, height, options]);

            /**
             * The WebGL context
             * @name gl
             * @memberOf me.WebGLRenderer
             */
            this.gl = this.getContextGL(c, !this.transparent);
            var gl = this.gl;

            /**
             * @ignore
             */
            this.colorStack = [];

             /**
             * @ignore
             */
            this._matrixStack = [];

            /**
             * The global matrix. Used for transformations on the overall scene
             * @name globalMatrix
             * @type me.Matrix3d
             * @memberOf me.WebGLRenderer
             */
            this.globalMatrix = new me.Matrix2d();

            // Create a compositor
            this.compositor = new me.WebGLRenderer.Compositor(
                gl,
                this.globalMatrix,
                this.globalColor
            );

            // Create a texture cache
            var max_textures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
            this.cache = new me.Renderer.TextureCache(max_textures);

            // FIXME: Cannot reference me.video.renderer yet
            me.video.renderer = this;

            // Create a 1x1 white texture for fill operations
            this.fillTexture = new me.video.renderer.Texture({
                "meta" : {
                    "app" : "melonJS",
                    "size" : { "w" : 1, "h" : 1 }
                },
                "frames" : [{
                    "filename" : "default",
                    "frame" : { "x" : 0, "y" : 0, "w" : 1, "h" : 1 }
                }]
            }, new Uint8Array([255, 255, 255, 255]));

            this.compositor.uploadTexture(
                this.cache.getUnit(this.fillTexture),
                this.fillTexture,
                1,
                1,
                0
            );

            // Initialize clear color and blend function
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            // Configure the WebGL viewport
            this.resize(1, 1);

            return this;
        },

        /**
         * Flush the compositor to the frame buffer
         * @name blitSurface
         * @memberOf me.WebGLRenderer
         * @function
         */
        blitSurface : function () {
            this.compositor.flush();
        },

        /**
         * Clears the gl context. Accepts a gl context or defaults to stored gl renderer.
         * @name clearSurface
         * @memberOf me.WebGLRenderer
         * @function
         * @param {WebGLContext} [ctx=null] For compatibility only.
         * @param {me.Color|String} color CSS color.
         * @param {Boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
         */
        clearSurface : function (ctx, col, opaque) {
            var color = this.globalColor.clone();
            var matrix = this.globalMatrix.clone();
            this.globalColor.copy(col);
            this.globalMatrix.identity();

            if (opaque) {
                this.compositor.clear();
            }
            else {
                this.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }

            this.globalMatrix.copy(matrix);
            this.globalColor.copy(color);
            me.pool.push(color);
        },

        /**
         * draws font to an off screen context, and blits to the backbuffer canvas.
         * @name drawFont
         * @memberOf me.WebGLRenderer
         * @function
         * @param {me.Font} fontObject - an instance of me.Font
         * @param {String} text - the string of text to draw
         * @param {Number} x - the x position to draw at
         * @param {Number} y - the y position to draw at
         */
        drawFont : function (/*fontObject, text, x, y*/) {
            /*
            var fontDimensions;
            var gid = fontObject.gid;
            var fontCache = this._fontCache;
            var fontCanvas = this._fontCanvas;
            var fontContext = this._fontContext;
            if (!fontCache[gid]) {
                fontObject.draw(fontContext, text, x, y);
                fontDimensions = fontObject.measureText(fontContext, text);
                fontCache[gid] = {
                    "font" : fontObject.font,
                    "fontSize" : fontObject.fontSize,
                    "fillStyle" : fontObject.fillStyle,
                    "textAlign" : fontObject.textAlign,
                    "textBaseline" : fontObject.textBaseline,
                    "lineHeight" : fontObject.lineHeight,
                    "text" : fontObject.text,
                    "image" : fontContext.getImageData(0, 0, fontCanvas.width, fontCanvas.height),
                    "width" : fontDimensions.width,
                    // Roughly equivalent to the height reserved for descenders
                    "height" : fontDimensions.height * 1.2,
                    "yOffset" : 0,
                };
                switch (fontObject.textBaseline) {
                    case "alphabetic":
                    case "ideographic":
                    case "bottom":
                        fontCache[gid].yOffset = fontDimensions.height;
                        break;

                    case "middle":
                        fontCache[gid].yOffset = fontDimensions.height / 2;
                        break;
                }
                fontContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            else {
                var cache = fontCache[gid];
                if (fontObject.font !== cache.font || fontObject.fontSize !== cache.fontSize || fontObject.fillStyle !== cache.fillStyle || fontObject.textAlign !== cache.textAlign || fontObject.textBaseline !== cache.textBaseline || fontObject.lineHeight !== cache.lineHeight || text !== cache.text) {
                    cache.font = fontObject.font;
                    cache.fontSize = fontObject.fontSize;
                    cache.fillStyle = fontObject.fillStyle;
                    cache.textAlign = fontObject.textAlign;
                    cache.textBaseline = fontObject.textBaseline;
                    cache.lineHeight = fontObject.lineHeight;
                    cache.text = text;

                    fontObject.draw(fontContext, text, x, y);
                    fontDimensions = fontObject.measureText(fontContext, text);
                    cache.yOffset = 0;
                    switch (cache.textBaseline) {
                        case "alphabetic":
                        case "ideographic":
                        case "bottom":
                            cache.yOffset = fontDimensions.height;
                            break;

                        case "middle":
                            cache.yOffset = fontDimensions.height / 2;
                            break;
                    }
                    cache.width = fontDimensions.width;
                    // Roughly equivalent to the height reserved for descenders
                    cache.height = fontDimensions.height * 1.2;
                    cache.image = fontContext.getImageData(0, 0, fontCanvas.width, fontCanvas.height);

                    fontContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
                }
            }

            y -= fontCache[gid].yOffset;
            this.drawImage(
                fontCache[gid].image,
                x, y, fontCache[gid].width, fontCache[gid].height,
                x, y, fontCache[gid].width, fontCache[gid].height
            );
            */
        },

        /**
         * Draw a line from the given point to the destination point.
         * @name drawLine
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} startX start x position
         * @param {Number} startY start y position
         * @param {Number} endX end x position
         * @param {Number} endY end y position
         */
        drawLine : function (/*startX, startY, endX, endY*/) {
            // TODO
        },

        /**
         * Draw an image to the gl context
         * @name drawImage
         * @memberOf me.WebGLRenderer
         * @function
         * @param {image} image html image element
         * @param {Number} sx value, from the source image.
         * @param {Number} sy value, from the source image.
         * @param {Number} sw the width of the image to be drawn
         * @param {Number} sh the height of the image to be drawn
         * @param {Number} dx the x position to draw the image at on the screen
         * @param {Number} dy the y position to draw the image at on the screen
         * @param {Number} dw the width value to draw the image at on the screen
         * @param {Number} dh the height value to draw the image at on the screen
         */
        drawImage : function (image, sx, sy, sw, sh, dx, dy, dw, dh) {
            if (typeof sw === "undefined") {
                sw = dw = image.width;
                sh = dh = image.height;
                dx = sx;
                dy = sy;
                sx = 0;
                sy = 0;
            }
            else if (typeof dx === "undefined") {
                dx = sx;
                dy = sy;
                dw = sw;
                dh = sh;
                sw = image.width;
                sh = image.height;
                sx = 0;
                sy = 0;
            }

            // TODO: Use `region` in place of sx, sy, sw, sh
            this.compositor.add(this.cache.get(image), sx, sy, sw, sh, dx, dy, dw, dh);
        },

        /**
         * Draw a filled rectangle at the specified coordinates
         * @name fillRect
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         */
        fillRect : function (x, y, width, height) {
            this.compositor.add(this.fillTexture, "default", x, y, width, height);
        },

        /**
         * return a reference to the screen canvas corresponding WebGL Context<br>
         * @name getScreenContext
         * @memberOf me.WebGLRenderer
         * @function
         * @return {WebGLContext}
         */
        getScreenContext : function () {
            return this.gl;
        },

        /**
         * Returns the WebGL Context object of the given Canvas
         * @name getContextGL
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Canvas} [canvas=canvas instance of the renderer]
         * @param {Boolean} [opaque=false] Use true to disable transparency
         * @return {WebGLContext}
         */
        getContextGL : function (c, opaque) {
            if (typeof c === "undefined" || c === null) {
                throw new me.video.Error(
                    "You must pass a canvas element in order to create " +
                    "a GL context"
                );
            }

            if (typeof c.getContext === "undefined") {
                throw new me.video.Error(
                    "Your browser does not support WebGL."
                );
            }

            var attr = {
                antialias : this.antiAlias,
                alpha : !opaque,
            };
            return (
                c.getContext("webgl", attr) ||
                c.getContext("experimental-webgl", attr)
            );
        },

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.WebGLRenderer
         * @function
         * @return {Canvas}
         */
        getCanvas : function () {
            return this.canvas;
        },

        /**
         * Returns the WebGLContext instance for the renderer
         * return a reference to the system 2d Context
         * @name getContext
         * @memberOf me.WebGLRenderer
         * @function
         * @return {WebGLContext}
         */
        getContext : function () {
            return this.gl;
        },

        /**
         * returns the text size based on dimensions from the font. Uses the font drawing context
         * @name measureText
         * @memberOf me.WebGLRenderer
         * @function
         * @param {me.Font} the instance of the font object
         * @param {String} text
         * @return {Object}
         */
        measureText : function (/*fontObject, text*/) {
            //return fontObject.measureText(this._fontContext, text);
            return { "width" : 0 };
        },

        /**
         * resets the gl transform to identity
         * @name resetTransform
         * @memberOf me.WebGLRenderer
         * @function
         */
        resetTransform : function () {
            this.globalMatrix.identity();
        },

        /**
         * resizes the canvas & GL Context
         * @name resize
         * @memberOf me.WebGLRenderer
         * @function
         */
        resize : function (scaleX, scaleY) {
            this.canvas.width = this.dimensions.width;
            this.canvas.height = this.dimensions.height;
            var w = this.dimensions.width * scaleX;
            var h = this.dimensions.height * scaleY;

            // adjust CSS style for High-DPI devices
            if (me.device.getPixelRatio() > 1) {
                this.canvas.style.width = (w / me.device.getPixelRatio()) + "px";
                this.canvas.style.height = (h / me.device.getPixelRatio()) + "px";
            }
            else {
                this.canvas.style.width = w + "px";
                this.canvas.style.height = h + "px";
            }

            this.compositor.setProjection(this.canvas.width, this.canvas.height);
        },

        /**
         * restores the canvas context
         * @name restore
         * @memberOf me.WebGLRenderer
         * @function
         */
        restore : function () {
            var color = this.colorStack.pop();
            me.pool.push(color);
            this.globalColor.copy(color);
            this.globalMatrix.copy(this._matrixStack.pop());
        },

        /**
         * rotates the uniform matrix
         * @name rotate
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} angle in radians
         */
        rotate : function (angle) {
            this.globalMatrix.rotate(angle);
        },

        /**
         * save the canvas context
         * @name save
         * @memberOf me.WebGLRenderer
         * @function
         */
        save : function () {
            this.colorStack.push(this.globalColor.clone());
            this._matrixStack.push(this.globalMatrix.clone());
        },

        /**
         * scales the uniform matrix
         * @name scale
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        scale : function (x, y) {
            this.globalMatrix.scale(x, y);
        },

        /**
         * @ignore
         */
        setImageSmoothing : function () {
            // TODO: perhaps handle GLNEAREST or other options with texture binding
        },

        /**
         * return the current global alpha
         * @name globalAlpha
         * @memberOf me.WebGLRenderer
         * @function
         * @return {Number}
         */
        setGlobalAlpha : function (a) {
            this.globalColor.glArray[3] = a;
        },

        /**
         * Sets the color for further draw calls
         * @name setColor
         * @memberOf me.WebGLRenderer
         * @function
         * @param {me.Color|String} color css color string.
         */
        setColor : function (color) {
            this.globalColor.copy(color);
        },

        /**
         * sets the line width on the context
         * @name setLineWidth
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} width the width to set;
         */
        setLineWidth : function () {
            // TODO
        },

        /**
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * @name strokeArc
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} radius
         * @param {Number} start start angle in radians
         * @param {Number} end end angle in radians
         * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        strokeArc : function (/*x, y, radius, start, end, antiClockwise*/) {
            // TODO
        },

        /**
         * Stroke an ellipse at the specified coordinates with given radius, start and end points
         * @name strokeEllipse
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} w horizontal radius of the ellipse
         * @param {Number} h vertical radius of the ellipse
         */
        strokeEllipse : function (/*x, y, w, h*/) {
            // TODO
        },

        /**
         * Stroke a line of the given two points
         * @name strokeLine
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} startX the start x coordinate
         * @param {Number} startY the start y coordinate
         * @param {Number} endX the end x coordinate
         * @param {Number} endY the end y coordinate
         */
        strokeLine : function (/*startX, startY, endX, endY*/) {
            // TODO
        },

        /**
         * Strokes a me.Polygon on the screen with a specified color
         * @name strokePolygon
         * @memberOf me.WebGLRenderer
         * @function
         * @param {me.Polygon} poly the shape to draw
         */
        strokePolygon : function (/*poly*/) {
            // TODO
        },

        /**
         * Draw a stroke rectangle at the specified coordinates
         * @name strokeRect
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         */
        strokeRect : function (/*x, y, width, height*/) {
            /*
            var x1 = x;
            var y1 = y;
            var x2 = x + width;
            var y2 = y + height;
            var lineVerticeArray = this._lineVerticeArray;
            lineVerticeArray[0] = x1;
            lineVerticeArray[1] = y1;
            lineVerticeArray[2] = x2;
            lineVerticeArray[3] = y1;
            lineVerticeArray[4] = x2;
            lineVerticeArray[5] = y2;
            lineVerticeArray[6] = x1;
            lineVerticeArray[7] = y2;

            var gl = this.gl;
            var shaderProgram = this._shaderProgram;

            gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, lineVerticeArray, gl.STATIC_DRAW);

            gl.vertexAttribPointer(shaderProgram.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);

            var lineTextureCoords = this._lineTextureCoords;
            lineTextureCoords[0] = 0.0;
            lineTextureCoords[1] = 0.0;
            lineTextureCoords[2] = 1.0;
            lineTextureCoords[3] = 0.0;
            lineTextureCoords[4] = 1.0;
            lineTextureCoords[5] = 1.0;
            lineTextureCoords[6] = 0.0;
            lineTextureCoords[7] = 1.0;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this._white1PixelTexture);
            gl.bindBuffer(gl.ARRAY_BUFFER, this._textureBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, lineTextureCoords, gl.STATIC_DRAW);
            gl.vertexAttribPointer(shaderProgram.attributes.aTexture, 2, gl.FLOAT, false, 0, 0);

            gl.uniform1i(shaderProgram.uniforms.texture, 0);
            shaderProgram.uniforms.uMatrix = this.globalMatrix.val;

            shaderProgram.uniforms.uColor = this.globalColor.toGL();
            gl.drawArrays(gl.LINE_LOOP, 0, 4);
            */
        },

        /**
         * draw the given shape
         * @name drawShape
         * @memberOf me.WebGLRenderer
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object
         */
        drawShape : function (shape) {
            if (shape instanceof me.Rect) {
                this.strokeRect(shape.left, shape.top, shape.width, shape.height);
            } else if (shape instanceof me.Line || shape instanceof me.Polygon) {
                this.save();
                this.strokePolygon(shape);
                this.restore();
            } else if (shape instanceof me.Ellipse) {
                this.save();
                if (shape.radiusV.x === shape.radiusV.y) {
                    // it's a circle
                    this.strokeArc(
                        shape.pos.x - shape.radius,
                        shape.pos.y - shape.radius,
                        shape.radius,
                        0,
                        2 * Math.PI
                    );
                } else {
                    // it's an ellipse
                    this.strokeEllipse(
                        shape.pos.x,
                        shape.pos.y,
                        shape.radiusV.x,
                        shape.radiusV.y
                    );
                }
                this.restore();
            }
        },

        /**
         * Multiply given matrix into the renderer tranformation matrix
         * @name multiplyMatrix
         * @memberOf me.WebGLRenderer
         * @function
         * @param {me.Matrix2d} mat2d Matrix to transform by
         */
        transform : function (mat2d) {
            this.globalMatrix.multiply(mat2d);
        },

        /**
         * Translates the uniform matrix by the given coordinates
         * @name translate
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        translate : function (x, y) {
            this.globalMatrix.translate(x, y);
        }
    });

})();
