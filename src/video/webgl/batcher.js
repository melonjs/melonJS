/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
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

    var ELEMENTS_PER_RECT = 4;
    var INDICES_PER_RECT = 6;

    var MAX_LENGTH = 16000;

    /**
     * A WebGL texture batcher object. This class handles all of the WebGL state<br>
     * Pushes texture regions into WebGL buffers, automatically flushes to GPU
     * @extends Object
     * @namespace me.WebGLRenderer.Batcher
     * @memberOf me
     * @constructor
     * @param {WebGLContext} gl Destination WebGL Context
     * @param {me.Matrix2d} matrix Global transformation matrix
     * @param {me.Color} color Global color
     */
    me.WebGLRenderer.Batcher = Object.extend(
    /** @scope me.WebGLRenderer.Batcher.prototype */
    {
        /**
         * @ignore
         */
        init : function (gl, matrix, color) {
            /**
             * The number of rectangles held in the batch
             * @name length
             * @memberOf me.WebGLRenderer.Batcher
             * @type Number
             * @readonly
             */
            this.length = 0;

            // Hash map of texture units
            this.units = [];

            // Vector pool
            this.v = [
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d()
            ];

            // WebGL context
            this.gl = gl;

            // Global transformation matrix
            this.matrix = matrix;

            // Global color
            this.color = color;

            // Uniform projection matrix
            this.uMatrix = new me.Matrix2d();

            // Rectangle buffer
            this.buffer = new Float32Array(ELEMENT_SIZE * ELEMENTS_PER_RECT);

            // Load and create shader program
            this.shader = this.createShader();

            // Stream buffer
            this.sb = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.sb);
            gl.bufferData(gl.ARRAY_BUFFER, MAX_LENGTH * ELEMENT_OFFSET, gl.DYNAMIC_DRAW);
            this.sbIndex = 0;

            // Index buffer
            this.ib = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.createIB(), gl.STATIC_DRAW);

            // Bind attribute pointers
            gl.vertexAttribPointer(
                this.shader.attributes.aVertex,
                VERTEX_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                VERTEX_OFFSET
            );
            gl.vertexAttribPointer(
                this.shader.attributes.aColor,
                COLOR_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                COLOR_OFFSET
            );
            gl.vertexAttribPointer(
                this.shader.attributes.aTexture,
                TEXTURE_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                TEXTURE_OFFSET
            );
            gl.vertexAttribPointer(
                this.shader.attributes.aRegion,
                REGION_SIZE,
                gl.FLOAT,
                false,
                ELEMENT_OFFSET,
                REGION_OFFSET
            );

            this.reset();
            this.setProjection(gl.canvas.width, gl.canvas.height);
        },

        /**
         * @ignore
         */
        createShader : function () {
            // WebGL shader program
            return me.video.shader.createShader(
                this.gl,
                [
                    "aVertex",
                    "aColor",
                    "aTexture",
                    "aRegion",
                ],
                {
                    "uMatrix"   : "mat3",
                    "uSampler"  : "sampler2D",
                }
            );
        },

        /**
         * Sets the projection matrix with the given size
         * @name setProjection
         * @memberOf me.WebGLRenderer.Batcher
         * @function
         * @param {Number} w WebGL Canvas width
         * @param {Number} h WebGL Canvas height
         */
        setProjection : function (w, h) {
            this.gl.viewport(0, 0, w, h);
            this.uMatrix.set(
                2 / w,  0,      0,
                0,      -2 / h, 0,
                -1,     1,      1
            );
            this.shader.uniforms.uMatrix = this.uMatrix.val;
        },

        /**
         * @ignore
         */
        uploadTexture : function (unit, texture, w, h, b) {
            if (!this.units[unit]) {
                this.units[unit] = true;
                this.shader.createTexture(this.gl, unit, texture.texture, w, h, b);
            }
        },

        /**
         * @ignore
         */
        reset : function () {
            // TODO
            this.sbIndex = 0;
            this.length = 0;

            var samplers = [];

            var units = this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
            for (var i = 0; i < units; i++) {
                this.units[i] = false;
                samplers[i] = i;
            }

            this.shader.uniforms.uSampler = samplers;
        },

        /**
         * @ignore
         */
        createIB : function () {
            var indices = [
                0, 1, 2,
                2, 1, 3
            ];

            // ~128KB index buffer
            var data = new Array(MAX_LENGTH * INDICES_PER_RECT);
            for (var i = 0; i < data.length; i++) {
                data[i] = indices[i % INDICES_PER_RECT] +
                    ~~(i / INDICES_PER_RECT) * ELEMENTS_PER_RECT;
            }

            return new Uint16Array(data);
        },

        /**
         * Add a texture region
         * @name add
         * @memberOf me.WebGLRenderer.Batcher
         * @function
         * @param {me.video.renderer.Texture} texture Source texture
         * @param {Number} sx Source x-coordinate
         * @param {Number} sy Source y-coordinate
         * @param {Number} sw Source width
         * @param {Number} sh Source height
         * @param {Number} dx Destination x-coordinate
         * @param {Number} dy Destination y-coordinate
         * @param {Number} dw Destination width
         * @param {Number} dh Destination height
         */
        add : function (texture, sx, sy, sw, sh, dx, dy, dw, dh) {
            if (this.length >= MAX_LENGTH) {
                this.flush();
            }

            // TODO: Replace the function signature with:
            // add(texture, region, x, y, w, h)
            // This can only be done after TextureAtlas is used on tilesets
            var region,
                x = dx,
                y = dy,
                w = dw,
                h = dh;

            if (arguments.length === 6) {
                h = dx;
                w = sh;
                y = sw;
                x = sy;
                region = texture.getRegion(sx);
            }
            else {
                // TODO: Remove this cache lookup and the assignment in Texture
                var key = sx + "," + sy + "," + sw + "," + sh;
                region = texture.getRegion(key);
                if (typeof(region) === "undefined") {
                    // TODO: Require proper atlas regions instead of caching arbitrary regions
                    region = texture._insertRegion(key, sx, sy, sw, sh);
                }
            }

            var gl = this.gl;
            var m = this.matrix;

            // Upload the texture if necessary
            var unit = me.video.renderer.cache.getUnit(texture);
            this.uploadTexture(unit, texture);

            // Transform vertices
            var v0 = m.vectorMultiply(this.v[0].set(x, y));
            var v1 = m.vectorMultiply(this.v[1].set(x + w, y));
            var v2 = m.vectorMultiply(this.v[2].set(x, y + h));
            var v3 = m.vectorMultiply(this.v[3].set(x + w, y + h));

            // Fill vertex buffer
            // FIXME: Pack each vertex vector into single float
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 0 + 0] = v0.x;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 0 + 1] = v0.y;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 1 + 0] = v1.x;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 1 + 1] = v1.y;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 2 + 0] = v2.x;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 2 + 1] = v2.y;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 3 + 0] = v3.x;
            this.buffer[VERTEX_ELEMENT + ELEMENT_SIZE * 3 + 1] = v3.y;

            // Fill color buffer
            // FIXME: Pack color vector into single float
            var color = this.color.toGL();
            this.buffer.set(color, COLOR_ELEMENT + ELEMENT_SIZE * 0);
            this.buffer.set(color, COLOR_ELEMENT + ELEMENT_SIZE * 1);
            this.buffer.set(color, COLOR_ELEMENT + ELEMENT_SIZE * 2);
            this.buffer.set(color, COLOR_ELEMENT + ELEMENT_SIZE * 3);

            // Fill texture index buffer
            // FIXME: Can the texture index be packed into another element?
            this.buffer[TEXTURE_ELEMENT + ELEMENT_SIZE * 0] =
            this.buffer[TEXTURE_ELEMENT + ELEMENT_SIZE * 1] =
            this.buffer[TEXTURE_ELEMENT + ELEMENT_SIZE * 2] =
            this.buffer[TEXTURE_ELEMENT + ELEMENT_SIZE * 3] = unit;

            // Fill texture coordinates buffer
            // FIXME: Pack each texture coordinate into single floats
            var stMap = region.stMap;
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 0 + 0] = stMap[0];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 0 + 1] = stMap[1];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 1 + 0] = stMap[2];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 1 + 1] = stMap[1];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 2 + 0] = stMap[0];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 2 + 1] = stMap[3];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 3 + 0] = stMap[2];
            this.buffer[REGION_ELEMENT + ELEMENT_SIZE * 3 + 1] = stMap[3];

            // Copy data into stream buffer
            gl.bufferSubData(gl.ARRAY_BUFFER, this.sbIndex, this.buffer);

            this.sbIndex += ELEMENT_OFFSET * ELEMENTS_PER_RECT;
            this.length++;
        },

        /**
         * Flush batched texture operations to the GPU
         * @name flush
         * @memberOf me.WebGLRenderer.Batcher
         * @function
         */
        flush : function () {
            if (this.length) {
                var gl = this.gl;
                gl.drawElements(
                    gl.TRIANGLES,
                    this.length * ELEMENTS_PER_RECT * INDICES_PER_RECT,
                    gl.UNSIGNED_SHORT,
                    0
                );

                this.sbIndex = 0;
                this.length = 0;
            }
        }
    });
})();
