/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 */
(function () {

    // Handy constants
    var VERTEX_SIZE = 2;
    var COLOR_SIZE = 4;
    var TEXTURE_SIZE = 1;
    var REGION_SIZE = 2;

    var ELEMENT_SIZE = VERTEX_SIZE + COLOR_SIZE + TEXTURE_SIZE + REGION_SIZE;
    var ELEMENT_OFFSET = ELEMENT_SIZE * Float32Array.BYTES_PER_ELEMENT;

    var VERTEX_ELEMENT = 0;
    var COLOR_ELEMENT = VERTEX_ELEMENT + VERTEX_SIZE;
    var TEXTURE_ELEMENT = COLOR_ELEMENT + COLOR_SIZE;
    var REGION_ELEMENT = TEXTURE_ELEMENT + TEXTURE_SIZE;

    var VERTEX_OFFSET = VERTEX_ELEMENT * Float32Array.BYTES_PER_ELEMENT;
    var COLOR_OFFSET = COLOR_ELEMENT * Float32Array.BYTES_PER_ELEMENT;
    var TEXTURE_OFFSET = TEXTURE_ELEMENT * Float32Array.BYTES_PER_ELEMENT;
    var REGION_OFFSET = REGION_ELEMENT * Float32Array.BYTES_PER_ELEMENT;

    var ELEMENTS_PER_QUAD = 4;
    var INDICES_PER_QUAD = 6;

    var MAX_LENGTH = 16000;

    /**
     * A WebGL texture Compositor object. This class handles all of the WebGL state<br>
     * Pushes texture regions into WebGL buffers, automatically flushes to GPU
     * @extends me.Object
     * @namespace me.WebGLRenderer.Compositor
     * @memberOf me
     * @constructor
     * @param {me.WebGLRenderer} renderer the current WebGL renderer session
     */
    me.WebGLRenderer.Compositor = me.Object.extend(
    /** @scope me.WebGLRenderer.Compositor.prototype */
    {
        /**
         * @ignore
         */
        init : function (renderer) {
            // local reference
            var gl = renderer.gl;

            /**
             * The number of quads held in the batch
             * @name length
             * @memberOf me.WebGLRenderer.Compositor
             * @type Number
             * @readonly
             */
            this.length = 0;

            // Hash map of texture units
            this.units = [];
            /*
             * XXX: The GLSL compiler pukes with "memory exhausted" when it is
             * given long if-then-else chains.
             *
             * See: http://stackoverflow.com/questions/15828966/glsl-compile-error-memory-exhausted
             *
             * Workaround the problem by limiting the max texture support to 24.
             * The magic number was determined by testing under different UAs.
             * All Desktop UAs were capable of compiling with 27 fragment shader
             * samplers. Using 24 seems like a reasonable compromise;
             *
             * 24 = 2^4 + 2^3
             *
             * As of October 2015, approximately 4.2% of all WebGL-enabled UAs
             * support more than 24 max textures, according to
             * http://webglstats.com/
             */
            this.maxTextures = Math.min(24, gl.getParameter(
                gl.MAX_TEXTURE_IMAGE_UNITS
            ));

            // Vector pool
            this.v = [
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d()
            ];

            // the associated renderer
            // TODO : add a set context or whatever function, and split
            // the constructor accordingly, so that this is easier to restore
            // the GL context when lost
            this.renderer = renderer;

            // WebGL context
            this.gl = renderer.gl;

            // Global transformation matrix
            this.matrix = renderer.currentTransform;

            // Global fill color
            this.color = renderer.currentColor;
            // Global tint color
            this.tint = renderer.currentTint;

            // Uniform projection matrix
            this.uMatrix = new me.Matrix2d();

            // reference to the active shader
            this.activeShader = null;

            // Load and create shader programs
            /* eslint-disable */
            this.primitiveShader = me.video.shader.createShader(
                this.gl,
                (__PRIMITIVE_VERTEX__)(),
                (__PRIMITIVE_FRAGMENT__)({
                    "precision"     : me.device.getMaxShaderPrecision(this.gl)
                })
            );

            this.quadShader = me.video.shader.createShader(
                this.gl,
                (__QUAD_VERTEX__)(),
                (__QUAD_FRAGMENT__)({
                    "precision"     : me.device.getMaxShaderPrecision(this.gl),
                    "maxTextures"   : this.maxTextures
                })
            );
            /* eslint-enable */

            // Stream buffer
            this.sb = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.sb);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                MAX_LENGTH * ELEMENT_OFFSET * ELEMENTS_PER_QUAD,
                gl.STREAM_DRAW
            );

            this.sbSize = 256;
            this.sbIndex = 0;

            // Quad stream buffer
            this.stream = new Float32Array(
                this.sbSize * ELEMENT_SIZE * ELEMENTS_PER_QUAD
            );

            // Index buffer
            this.ib = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.createIB(), gl.STATIC_DRAW);

            // Bind attribute pointers for quad shader
            gl.vertexAttribPointer(
                this.quadShader.attributes.aVertex,
                VERTEX_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                VERTEX_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aColor,
                COLOR_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                COLOR_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aTexture,
                TEXTURE_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                TEXTURE_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aRegion,
                REGION_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                REGION_OFFSET
            );

            this.reset();

            this.setProjection(gl.canvas.width, gl.canvas.height);

            // Initialize clear color
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
        },

        /**
         * Sets the projection matrix with the given size
         * @name setProjection
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         * @param {Number} w WebGL Canvas width
         * @param {Number} h WebGL Canvas height
         */
        setProjection : function (w, h) {
            this.flush();
            this.gl.viewport(0, 0, w, h);
            this.uMatrix.setTransform(
                2 / w,  0,      0,
                0,      -2 / h, 0,
                -1,     1,      1
            );
        },

        /**
         * @ignore
         */
        uploadTexture : function (texture, w, h, b, force) {
            var unit = this.renderer.cache.getUnit(texture);
            if (!this.units[unit] || force) {
                this.units[unit] = true;
                me.video.shader.createTexture(
                    this.gl,
                    unit,
                    texture.getTexture(),
                    this.renderer.settings.antiAlias ? this.gl.LINEAR : this.gl.NEAREST,
                    texture.repeat,
                    w,
                    h,
                    b,
                    texture.premultipliedAlpha
                );
            }

            return unit;
        },

        /**
         * Reset compositor internal state
         * @ignore
         */
        reset : function () {
            this.sbIndex = 0;
            this.length = 0;

            var samplers = [];

            for (var i = 0; i < this.maxTextures; i++) {
                this.units[i] = false;
                samplers[i] = i;
            }
            // set the quad shader as the default program
            this.useShader(this.quadShader);
            this.quadShader.uniforms.uSampler = samplers;
        },

        /**
         * Create a full index buffer for the element array
         * @ignore
         */
        createIB : function () {
            var indices = [
                0, 1, 2,
                2, 1, 3
            ];

            // ~384KB index buffer
            var data = new Array(MAX_LENGTH * INDICES_PER_QUAD);
            for (var i = 0; i < data.length; i++) {
                data[i] = indices[i % INDICES_PER_QUAD] +
                    ~~(i / INDICES_PER_QUAD) * ELEMENTS_PER_QUAD;
            }

            return new Uint16Array(data);
        },

        /**
         * Resize the stream buffer, retaining its original contents
         * @ignore
         */
        resizeSB : function () {
            this.sbSize <<= 1;
            var stream = new Float32Array(this.sbSize * ELEMENT_SIZE * ELEMENTS_PER_QUAD);
            stream.set(this.stream);
            this.stream = stream;
        },

        /**
         * Select the shader to use for compositing
         * @name useShader
         * @see me.video.shader.createShader
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         * @param {Object} a reference to a WebGL Shader Program
         */
        useShader : function (shader) {
            if (this.activeShader !== shader) {
                this.flush();
                this.activeShader = shader;
                this.gl.useProgram(this.activeShader.handle);
                this.activeShader.uniforms.uMatrix = this.uMatrix.val;
            }
        },

        /**
         * Add a textured quad
         * @name addQuad
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         * @param {me.video.renderer.Texture} texture Source texture
         * @param {String} key Source texture region name
         * @param {Number} x Destination x-coordinate
         * @param {Number} y Destination y-coordinate
         * @param {Number} w Destination width
         * @param {Number} h Destination height
         */
        addQuad : function (texture, key, x, y, w, h) {
            var color = this.color.toGL();
            var tint = this.tint.toGL();

            if (color[3] < 1 / 255) {
                // Fast path: don't send fully transparent quads
                return;
            } else {
                // use the global alpha
                tint[3] = color[3];
            }

            this.useShader(this.quadShader);

            if (this.length >= MAX_LENGTH) {
                this.flush();
            }
            if (this.length >= this.sbSize) {
                this.resizeSB();
            }

            // Transform vertices
            var m = this.matrix,
                v0 = this.v[0].set(x, y),
                v1 = this.v[1].set(x + w, y),
                v2 = this.v[2].set(x, y + h),
                v3 = this.v[3].set(x + w, y + h);

            if (!m.isIdentity()) {
                m.multiplyVector(v0);
                m.multiplyVector(v1);
                m.multiplyVector(v2);
                m.multiplyVector(v3);
            }

            // Array index computation
            var idx0 = this.sbIndex,
                idx1 = idx0 + ELEMENT_SIZE,
                idx2 = idx1 + ELEMENT_SIZE,
                idx3 = idx2 + ELEMENT_SIZE;

            // Fill vertex buffer
            // FIXME: Pack each vertex vector into single float
            this.stream[idx0 + VERTEX_ELEMENT + 0] = v0.x;
            this.stream[idx0 + VERTEX_ELEMENT + 1] = v0.y;
            this.stream[idx1 + VERTEX_ELEMENT + 0] = v1.x;
            this.stream[idx1 + VERTEX_ELEMENT + 1] = v1.y;
            this.stream[idx2 + VERTEX_ELEMENT + 0] = v2.x;
            this.stream[idx2 + VERTEX_ELEMENT + 1] = v2.y;
            this.stream[idx3 + VERTEX_ELEMENT + 0] = v3.x;
            this.stream[idx3 + VERTEX_ELEMENT + 1] = v3.y;

            // Fill color buffer
            // FIXME: Pack color vector into single float
            this.stream.set(tint, idx0 + COLOR_ELEMENT);
            this.stream.set(tint, idx1 + COLOR_ELEMENT);
            this.stream.set(tint, idx2 + COLOR_ELEMENT);
            this.stream.set(tint, idx3 + COLOR_ELEMENT);

            // Fill texture index buffer
            // FIXME: Can the texture index be packed into another element?
            var unit = this.uploadTexture(texture);
            this.stream[idx0 + TEXTURE_ELEMENT] =
            this.stream[idx1 + TEXTURE_ELEMENT] =
            this.stream[idx2 + TEXTURE_ELEMENT] =
            this.stream[idx3 + TEXTURE_ELEMENT] = unit;

            // Fill texture coordinates buffer
            var uvs = texture.getUVs(key);
            // FIXME: Pack each texture coordinate into single floats
            this.stream[idx0 + REGION_ELEMENT + 0] = uvs[0];
            this.stream[idx0 + REGION_ELEMENT + 1] = uvs[1];
            this.stream[idx1 + REGION_ELEMENT + 0] = uvs[2];
            this.stream[idx1 + REGION_ELEMENT + 1] = uvs[1];
            this.stream[idx2 + REGION_ELEMENT + 0] = uvs[0];
            this.stream[idx2 + REGION_ELEMENT + 1] = uvs[3];
            this.stream[idx3 + REGION_ELEMENT + 0] = uvs[2];
            this.stream[idx3 + REGION_ELEMENT + 1] = uvs[3];

            this.sbIndex += ELEMENT_SIZE * ELEMENTS_PER_QUAD;
            this.length++;
        },

        /**
         * Flush batched texture operations to the GPU
         * @name flush
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         */
        flush : function () {
            if (this.length) {
                var gl = this.gl;

                // Copy data into stream buffer
                var len = this.length * ELEMENT_SIZE * ELEMENTS_PER_QUAD;
                gl.bufferData(
                    gl.ARRAY_BUFFER,
                    this.stream.subarray(0, len),
                    gl.STREAM_DRAW
                );

                // Draw the stream buffer
                gl.drawElements(
                    gl.TRIANGLES,
                    this.length * INDICES_PER_QUAD,
                    gl.UNSIGNED_SHORT,
                    0
                );

                this.sbIndex = 0;
                this.length = 0;
            }
        },

        /**
         * Draw triangle(s)
         * @name drawTriangle
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         * @param {me.Vector2d[]} points vertices
         * @param {Number} [len=points.length] amount of points defined in the points array
         * @param {Boolean} [strip=false] Whether the array defines a serie of connected triangles, sharing vertices
         */
        drawTriangle : function (points, len, strip) {
            var gl = this.gl;

            len = len || points.length;

            this.useShader(this.primitiveShader);

            // Put vertex data into the stream buffer
            var j = 0;
            var m = this.matrix;
            var m_isIdentity = m.isIdentity();
            for (var i = 0; i < points.length; i++) {
                if (!m_isIdentity) {
                    m.multiplyVector(points[i]);
                }
                this.stream[j++] = points[i].x;
                this.stream[j++] = points[i].y;
            }

            // Set the line color
            this.primitiveShader.uniforms.uColor = this.color.glArray;

            // Copy data into the stream buffer
            gl.bufferData(
                gl.ARRAY_BUFFER,
                this.stream.subarray(0, len * 2),
                gl.STREAM_DRAW
            );

            // FIXME: Configure vertex attrib pointers in `useShader`
            gl.vertexAttribPointer(
                this.primitiveShader.attributes.aVertex,
                VERTEX_SIZE,
                gl.FLOAT,
                false,
                0,
                0
            );

            // Draw the stream buffer
            gl.drawArrays(strip === true ? gl.TRIANGLE_STRIP : gl.TRIANGLES, 0, len);

            // FIXME: Configure vertex attrib pointers in `useShader`
            gl.vertexAttribPointer(
                this.quadShader.attributes.aVertex,
                VERTEX_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                VERTEX_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aColor,
                COLOR_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                COLOR_OFFSET
            );

            gl.vertexAttribPointer(
                this.quadShader.attributes.aTexture,
                TEXTURE_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                TEXTURE_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aRegion,
                REGION_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                REGION_OFFSET
            );

        },

        /**
         * Draw a line
         * @name drawLine
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         * @param {me.Vector2d[]} points Line vertices
         * @param {Number} [len=points.length] amount of points defined in the points array
         * @param {Boolean} [open=false] Whether the line is open (true) or closed (false)
         */
        drawLine : function (points, len, open) {
            var gl = this.gl;

            len = len || points.length;

            this.useShader(this.primitiveShader);

            // Put vertex data into the stream buffer
            var j = 0;
            var m = this.matrix;
            var m_isIdentity = m.isIdentity();
            for (var i = 0; i < points.length; i++) {
                if (!m_isIdentity) {
                    m.multiplyVector(points[i]);
                }
                this.stream[j++] = points[i].x;
                this.stream[j++] = points[i].y;
            }

            // Set the line color
            this.primitiveShader.uniforms.uColor = this.color.glArray;

            // Copy data into the stream buffer
            gl.bufferData(
                gl.ARRAY_BUFFER,
                this.stream.subarray(0, len * 2),
                gl.STREAM_DRAW
            );

            // FIXME: Configure vertex attrib pointers in `useShader`
            gl.vertexAttribPointer(
                this.primitiveShader.attributes.aVertex,
                VERTEX_SIZE,
                gl.FLOAT,
                false,
                0,
                0
            );

            // Draw the stream buffer
            gl.drawArrays(open === true ? gl.LINE_STRIP : gl.LINE_LOOP, 0, len);

            // FIXME: Configure vertex attrib pointers in `useShader`
            gl.vertexAttribPointer(
                this.quadShader.attributes.aVertex,
                VERTEX_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                VERTEX_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aColor,
                COLOR_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                COLOR_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aTexture,
                TEXTURE_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                TEXTURE_OFFSET
            );
            gl.vertexAttribPointer(
                this.quadShader.attributes.aRegion,
                REGION_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                REGION_OFFSET
            );
        },

        /**
         * Clear the frame buffer, flushes the composite operations and calls
         * gl.clear()
         * @name clear
         * @memberOf me.WebGLRenderer.Compositor
         * @function
         */
        clear : function () {
            this.flush();
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
    });
})();
