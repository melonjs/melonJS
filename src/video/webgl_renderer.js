/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * The WebGL renderer object
     * There is no constructor function for me.CanvasRenderer
     * @namespace me.WebGLRenderer
     * @memberOf me
     * @ignore
     */
    me.WebGLRenderer = (function () {
        var api = {},
        canvas = null,
        gl = null,
        color = null,
        textures = {},
        fragmentShader = null,
        vertexShader = null,
        shaderProgram = null,
        spriteBatch;

        api.init = function (width, height, c) {
            canvas = c;

            fragmentShader =
                "precision mediump float;" +
                "varying vec2 vTexCoord0;" +
                "varying vec4 vColor;" +
                "uniform sampler2D u_texture0;" +

                "void main(void) {" +
                "   gl_FragColor = texture2D(u_texture0, vTexCoord0) * vColor;" +
                "}"
            ;

            vertexShader =
                "attribute vec2 " + kami.ShaderProgram.POSITION_ATTRIBUTE + ";" +
                "attribute vec4 " + kami.ShaderProgram.COLOR_ATTRIBUTE + ";" +
                "attribute vec2 " + kami.ShaderProgram.TEXCOORD_ATTRIBUTE + "0;" +

                "uniform mat3 u_matrix;" +
                "varying vec2 vTexCoord0;" +
                "varying vec4 vColor;" +

                "void main(void) {" +
                "   gl_Position = vec4((u_matrix * vec3(" + kami.ShaderProgram.POSITION_ATTRIBUTE + ", 1)).xy, 0, 1);" +
                "   vTexCoord0 = " + kami.ShaderProgram.TEXCOORD_ATTRIBUTE + "0;" +
                "   vColor = " + kami.ShaderProgram.COLOR_ATTRIBUTE + ";" +
                "}"
            ;

            this.context = new kami.WebGLContext(width, height, canvas);
            gl = this.context.gl;
            color = new me.Color();
            this.globalAlpha = 1.0;
            this.uniformMatrix = new me.Matrix3d();
            shaderProgram = new kami.ShaderProgram(this.context, vertexShader, fragmentShader);
            if (shaderProgram.log) {
                console.warn(shaderProgram.log);
            }

            spriteBatch = new kami.SpriteBatch(this.context);

            return this;
        };

        /**
         * Starts the sprite batch draw call
         * @name begin
         * @memberOf me.WebGLRenderer
         * @function
         */
        api.begin = function () {
            spriteBatch.begin();
        };

        api.blitSurface = function () {
            // empty function for now
        };

        /**
         * Clears the gl context. Accepts a gl context or defaults to stored gl renderer.
         * @name clearSurface
         * @memberOf me.WebGLRenderer
         * @function
         * @param {WebGLContext} gl - the gl context.
         * @param {String} color - css color string.
         */
        api.clearSurface = function (gl, col) {
            if (col.match(/^\#/)) {
                color.parseHex(col);
            }
            else if (col.match(/^rgb/)) {
                color.parseRGB(col);
            }
            else {
                color.parseCSS(col);
            }

            gl.clearColor(color.r / 255.0, color.g / 255.0, color.b / 255.0, 1.0);
        };

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
        api.drawImage = function (image, sx, sy, sw, sh, dx, dy, dw, dh) {
            shaderProgram.setUniformMatrix3("u_matrix", this.uniformMatrix, false);
            if (typeof textures[image.src] === "undefined") {
                var texture = new kami.Texture(this.context);
                texture.setFilter(kami.Texture.Filter.LINEAR);
                texture.create();
                texture.uploadImage(image);
            }
            this.context.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
        };

        /**
         * Ends the sprite batch draw call
         * @name end
         * @memberOf me.WebGLRenderer
         * @function
         */
        api.end = function () {
            spriteBatch.end();
        };

        /**
         * return a reference to the screen canvas
         * @name getScreenCanvas
         * @memberOf me.WebGLRenderer
         * @function
         * @return {Canvas}
         */
        api.getScreenCanvas = function () {
            return canvas;
        };

        /**
         * return a reference to the screen canvas corresponding WebGL Context<br>
         * @name getScreenContext
         * @memberOf me.WebGLRenderer
         * @function
         * @return {WebGLContext}
         */
        api.getScreenContext = function () {
            return gl;
        };

        api.getHeight = function () {
            return this.context.height;
        };

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.WebGLRenderer
         * @function
         * @return {Canvas}
         */
        api.getCanvas = function () {
            return canvas;
        };

        /**
         * Returns the WebGLContext instance for the renderer
         * return a reference to the system 2d Context
         * @name getContext
         * @memberOf me.WebGLRenderer
         * @function
         * @return {WebGLContext}
         */
        api.getContext = function () {
            return gl;
        };

        api.getWidth = function () {
            return this.context.width;
        };

        /**
         * return the current global alpha
         * @name globalAlpha
         * @memberOf me.WebGLRenderer
         * @function
         * @return {Number}
         */
        api.globalAlpha = function () {
            return this.globalAlpha;
        };

        /**
         * resets the gl transform to identity
         * @name resetTransform
         * @memberOf me.WebGLRenderer
         * @function
         */
        api.resetTransform = function () {
            this.uniformMatrix.identity();
        };

        /**
         * resizes the canvas & GL Context
         * @name resize
         * @memberOf me.WebGLRenderer
         * @function
         */
        api.resize = function (scaleX, scaleY) {
            canvas = this.context.view;
            var gameWidthZoom = canvas.width * scaleX;
            var gameHeightZoom = canvas.height * scaleY;
            this.context.resize(gameWidthZoom, gameHeightZoom);
            // adjust CSS style for High-DPI devices
            if (me.device.getPixelRatio() > 1) {
                canvas.style.width = (canvas.width / me.device.getPixelRatio()) + "px";
                canvas.style.height = (canvas.height / me.device.getPixelRatio()) + "px";
            }
        };

        api.restore = function () {

        };

        /**
         * rotates the uniform matrix
         * @name rotate
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} angle in radians
         */
        api.rotate = function (angle) {
            this.uniformMatrix.rotate(angle);
        };

        api.save = function () {

        };

        /**
         * scales the uniform matrix
         * @name scale
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        api.scale = function (x, y) {
            this.uniformMatrix.scale(x, y);
        };

        /**
         * @private
         */
        api.setAlpha = function () {
            // Kami handles the alpha blending.
        };

        api.setImageSmoothing = function () {
            // TODO: perhaps handle GLNEAREST or other options with texture binding
        };

        /**
         * Sets the uniform matrix to the specified values from a Matrix2d
         * Created to support the original canvas method on the webgl renderer
         * @name transform
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} a the m1,1 (m11) value in the matrix
         * @param {Number} b the m1,2 (m12) value in the matrix
         * @param {Number} d the m2,1 (m21) value in the matrix
         * @param {Number} e the m2,2 (m12) value in the matrix
         * @param {Number} c the m1,3
         * @param {Number} f the m2,3
         */
        api.transform = function (a, b, d, e, c, f) {
            this.uniformMatrix.transform(a, b, d, e, c, f);
        };

        /**
         * Translates the uniform matrix by the given coordinates
         * @name translate
         * @memberOf me.WebGLRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        api.translate = function (x, y) {
            this.uniformMatrix.translate(x, y);
        };



        return api;
    })();

})();