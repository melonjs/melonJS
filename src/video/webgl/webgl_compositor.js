import primitiveVertex from "./shaders/primitive.vert";
import primitiveFragment from "./shaders/primitive.frag";
import quadVertex from "./shaders/quad.vert";
import quadFragment from "./shaders/quad.frag";

(function () {

    // Handy constants
    var VERTEX_SIZE = 2;
    var REGION_SIZE = 2;
    var COLOR_SIZE = 4;

    var ELEMENT_SIZE = VERTEX_SIZE + REGION_SIZE + COLOR_SIZE;
    var ELEMENT_OFFSET = ELEMENT_SIZE * Float32Array.BYTES_PER_ELEMENT;

    var VERTEX_ELEMENT = 0;
    var REGION_ELEMENT = VERTEX_ELEMENT + VERTEX_SIZE;
    var COLOR_ELEMENT = REGION_ELEMENT + REGION_SIZE;

    var ELEMENTS_PER_QUAD = 4;
    var INDICES_PER_QUAD = 6;

    var MAX_LENGTH = 16000;

    /**
     * A WebGL Compositor object. This class handles all of the WebGL state<br>
     * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
     * @extends me.Object
     * @namespace me.WebGLCompositor
     * @memberOf me
     * @constructor
     * @param {me.WebGLRenderer} renderer the current WebGL renderer session
     */
    me.WebGLCompositor = me.Object.extend({
        /**
         * @ignore
         */
        init : function (renderer) {
            // local reference
            var gl = renderer.gl;

            /**
             * The number of quads held in the batch
             * @name length
             * @memberOf me.WebGLCompositor
             * @type Number
             * @readonly
             */
            this.length = 0;

            // list of active texture units
            this.currentTextureUnit = -1;
            this.boundTextures = [];

            // Vector pool
            this.v = [
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d()
            ];

            // the associated renderer
            this.renderer = renderer;

            // WebGL context
            this.gl = renderer.gl;

            // Global fill color
            this.color = renderer.currentColor;

            // Global tint color
            this.tint = renderer.currentTint;

            // Global transformation matrix
            this.viewMatrix = renderer.currentTransform;

            /**
             * a reference to the active WebGL shader
             * @name activeShader
             * @memberOf me.WebGLCompositor
             * @type {me.GLShader}
             */
            this.activeShader = null;

            /**
             * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
             * @name mode
             * @see me.WebGLCompositor
             * @memberOf me.WebGLCompositor
             * @default gl.TRIANGLES
             */
            this.mode = gl.TRIANGLES;

            /**
             * an array of vertex attribute properties
             * @name attributes
             * @see me.WebGLCompositor.addAttribute
             * @memberOf me.WebGLCompositor
             */
            this.attributes = [];

            // Load and create shader programs
            this.primitiveShader = new me.GLShader(this.gl, primitiveVertex, primitiveFragment);
            this.quadShader = new me.GLShader(this.gl, quadVertex, quadFragment);

            /// define all vertex attributes
            this.addAttribute("aVertex", 2, gl.FLOAT, false, 0 * Float32Array.BYTES_PER_ELEMENT); // 0
            this.addAttribute("aRegion", 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT); // 1
            this.addAttribute("aColor",  4, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT); // 2

            // Stream buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
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
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.createIB(), gl.STATIC_DRAW);

            // register to the CANVAS resize channel
            me.event.subscribe(
                me.event.CANVAS_ONRESIZE, (function(width, height) {
                    this.flush();
                    this.setViewport(0, 0, width, height);
                }).bind(this)
            );

            this.reset();
        },

        /**
         * Reset compositor internal state
         * @ignore
         */
        reset : function () {
            this.sbIndex = 0;
            this.length = 0;

            // WebGL context
            this.gl = this.renderer.gl;

            this.flush();

            // initial viewport size
            this.setViewport(
                0, 0,
                this.renderer.getScreenCanvas().width,
                this.renderer.getScreenCanvas().height
            );

            // Initialize clear color
            this.clearColor(0.0, 0.0, 0.0, 0.0);

            // delete all related bound texture
            for (var i = 0; i < this.renderer.maxTextures; i++) {
                var texture = this.boundTextures[i];
                if (texture !== null) {
                    this.gl.deleteTexture(texture);
                }
                this.boundTextures[i] = null;
            }
            this.currentTextureUnit = -1;

            // set the quad shader as the default program
            this.useShader(this.quadShader);
        },

        /**
         * add vertex attribute property definition to the compositor
         * @name addAttribute
         * @memberOf me.WebGLCompositor
         * @function
         * @param {String} name name of the attribute in the vertex shader
         * @param {Number} size number of components per vertex attribute. Must be 1, 2, 3, or 4.
         * @param {GLenum} type data type of each component in the array
         * @param {Boolean} normalized whether integer data values should be normalized into a certain
         * @param {Number} offset offset in bytes of the first component in the vertex attribute array
         */
        addAttribute : function (name, size, type, normalized, offset) {
            this.attributes.push({
                name: name,
                size: size,
                type: type,
                normalized: normalized,
                offset: offset
            });
        },

        /**
         * Sets the viewport
         * @name setViewport
         * @memberOf me.WebGLCompositor
         * @function
         * @param {Number} x x position of viewport
         * @param {Number} y y position of viewport
         * @param {Number} width width of viewport
         * @param {Number} height height of viewport
         */
        setViewport : function (x, y, w, h) {
            this.gl.viewport(x, y, w, h);
        },

        /**
         * Create a WebGL texture from an image
         * @name createTexture2D
         * @memberOf me.WebGLCompositor
         * @function
         * @param {Number} unit Destination texture unit
         * @param {Image|Canvas|ImageData|UInt8Array[]|Float32Array[]} image Source image
         * @param {Number} filter gl.LINEAR or gl.NEAREST
         * @param {String} [repeat="no-repeat"] Image repeat behavior (see {@link me.ImageLayer#repeat})
         * @param {Number} [w] Source image width (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {Number} [h] Source image height (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {Number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {Number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {Boolean} [premultipliedAlpha=true] Multiplies the alpha channel into the other color channels
         * @param {Boolean} [mipmap=true] Whether mipmap levels should be generated for this texture
         * @return {WebGLTexture} a WebGL texture
         */
        createTexture2D : function (unit, image, filter, repeat, w, h, b, premultipliedAlpha, mipmap) {
            var gl = this.gl;

            repeat = repeat || "no-repeat";

            var isPOT = me.Math.isPowerOfTwo(w || image.width) && me.Math.isPowerOfTwo(h || image.height);
            var texture = gl.createTexture();
            var rs = (repeat.search(/^repeat(-x)?$/) === 0) && (isPOT || this.renderer.WebGLVersion === 2) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
            var rt = (repeat.search(/^repeat(-y)?$/) === 0) && (isPOT || this.renderer.WebGLVersion === 2) ? gl.REPEAT : gl.CLAMP_TO_EDGE;

            this.setTexture2D(texture, unit);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rs);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rt);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (typeof premultipliedAlpha === "boolean") ? premultipliedAlpha : true);
            if (w || h || b) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, b, gl.RGBA, gl.UNSIGNED_BYTE, image);
            }
            else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            }

            // generate the sprite mimap (used when scaling) if a PowerOfTwo texture
            if (isPOT && mipmap !== false) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }

            return texture;
        },

        /**
         * assign the given WebGL texture to the current batch
         * @name setTexture2D
         * @memberOf me.WebGLCompositor
         * @function
         * @param {WebGLTexture} a WebGL texture
         * @param {Number} unit Texture unit to which the given texture is bound
         */
        setTexture2D: function (texture, unit) {
            var gl = this.gl;

            if (texture !== this.boundTextures[unit]) {
                this.flush();
                if (this.currentTextureUnit !== unit) {
                    this.currentTextureUnit = unit;
                    gl.activeTexture(gl.TEXTURE0 + unit);
                }

                gl.bindTexture(gl.TEXTURE_2D, texture);
                this.boundTextures[unit] = texture;

            } else if (this.currentTextureUnit !== unit) {
                this.flush();
                this.currentTextureUnit = unit;
                gl.activeTexture(gl.TEXTURE0 + unit);
            }
        },


        /**
         * @ignore
         */
        uploadTexture : function (texture, w, h, b, force) {
            var unit = this.renderer.cache.getUnit(texture);
            var texture2D = this.boundTextures[unit];

            if (texture2D === null || force) {
                this.createTexture2D(
                    unit,
                    texture.getTexture(),
                    this.renderer.settings.antiAlias ? this.gl.LINEAR : this.gl.NEAREST,
                    texture.repeat,
                    w,
                    h,
                    b,
                    texture.premultipliedAlpha
                );
            } else {
                this.setTexture2D(texture2D, unit);
            }

            return this.currentTextureUnit;
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
         * @see me.GLShader
         * @memberOf me.WebGLCompositor
         * @function
         * @param {me.GLShader} shader a reference to a GLShader instance
         */
        useShader : function (shader) {
            if (this.activeShader !== shader) {
                this.flush();
                this.activeShader = shader;
                this.activeShader.bind();
                this.activeShader.setUniform("uProjectionMatrix", this.renderer.projectionMatrix);

                // set the vertex attributes
                for (var index = 0; index < this.attributes.length; ++index) {
                    var gl = this.gl;
                    var element = this.attributes[index];
                    var location = this.activeShader.getAttribLocation(element.name);

                    if (location !== -1) {
                        gl.enableVertexAttribArray(location);
                        gl.vertexAttribPointer(location, element.size, element.type, element.normalized, ELEMENT_OFFSET, element.offset);
                    } else {
                        gl.disableVertexAttribArray(index);
                    }
                }
            }
        },

        /**
         * Add a textured quad
         * @name addQuad
         * @memberOf me.WebGLCompositor
         * @function
         * @param {me.video.renderer.Texture} texture Source texture
         * @param {String} key Source texture region name
         * @param {Number} x Destination x-coordinate
         * @param {Number} y Destination y-coordinate
         * @param {Number} w Destination width
         * @param {Number} h Destination height
         */
        addQuad : function (texture, key, x, y, w, h) {
            //var gl = this.gl;
            var color = this.color.toArray();
            var tint = this.tint.toArray();

            if (color[3] < 1 / 255) {
                // Fast path: don't send fully transparent quads
                return;
            } else {
                // use the global alpha
                tint[3] = color[3];
            }

            if (this.length >= MAX_LENGTH) {
                this.flush();
            }
            if (this.length >= this.sbSize) {
                this.resizeSB();
            }

            this.useShader(this.quadShader);

            // upload and activate the texture if necessary
            var unit = this.uploadTexture(texture);
            // set fragement sampler accordingly
            this.quadShader.setUniform("uSampler", unit);

            // Transform vertices
            var m = this.viewMatrix,
                v0 = this.v[0].set(x, y),
                v1 = this.v[1].set(x + w, y),
                v2 = this.v[2].set(x, y + h),
                v3 = this.v[3].set(x + w, y + h);

            if (!m.isIdentity()) {
                m.apply(v0);
                m.apply(v1);
                m.apply(v2);
                m.apply(v3);
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

            // Fill color buffer
            // FIXME: Pack color vector into single float
            this.stream.set(tint, idx0 + COLOR_ELEMENT);
            this.stream.set(tint, idx1 + COLOR_ELEMENT);
            this.stream.set(tint, idx2 + COLOR_ELEMENT);
            this.stream.set(tint, idx3 + COLOR_ELEMENT);

            this.sbIndex += ELEMENT_SIZE * ELEMENTS_PER_QUAD;
            this.length++;
        },

        /**
         * Flush batched texture operations to the GPU
         * @param
         * @memberOf me.WebGLCompositor
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
                    this.mode,
                    this.length * INDICES_PER_QUAD,
                    gl.UNSIGNED_SHORT,
                    0
                );

                this.sbIndex = 0;
                this.length = 0;
            }
        },

        /**
         * Draw an array of vertices
         * @name drawVertices
         * @memberOf me.WebGLCompositor
         * @function
         * @param {GLENUM} [mode=gl.TRIANGLES] primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
         * @param {me.Vector2d[]} verts vertices
         * @param {Number} [vertexCount=verts.length] amount of points defined in the points array
         */
        drawVertices : function (mode, verts, vertexCount) {
            var gl = this.gl;

            vertexCount = vertexCount || verts.length;

            // use the primitive shader
            this.useShader(this.primitiveShader);

            // Set the line color
            this.primitiveShader.setUniform("uColor", this.color);

            // Put vertex data into the stream buffer
            var offset = 0;
            var m = this.viewMatrix;
            var m_isIdentity = m.isIdentity();
            for (var i = 0; i < vertexCount; i++) {
                if (!m_isIdentity) {
                    m.apply(verts[i]);
                }
                this.stream[offset + 0] = verts[i].x;
                this.stream[offset + 1] = verts[i].y;
                offset += ELEMENT_SIZE;
            }

            // Copy data into the stream buffer
            gl.bufferData(
                gl.ARRAY_BUFFER,
                this.stream.subarray(0, vertexCount * ELEMENT_SIZE),
                gl.STREAM_DRAW
            );

            // Draw the stream buffer
            gl.drawArrays(mode, 0, vertexCount);
        },

        /**
         * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
         * @name clearColor
         * @memberOf me.WebGLCompositor
         * @function
         * @param {Number} r - the red color value used when the color buffers are cleared
         * @param {Number} g - the green color value used when the color buffers are cleared
         * @param {Number} b - the blue color value used when the color buffers are cleared
         * @param {Number} a - the alpha color value used when the color buffers are cleared
         */
        clearColor : function (r, g, b, a) {
            this.gl.clearColor(r, g, b, a);
        },

        /**
         * Clear the frame buffer
         * @name clear
         * @memberOf me.WebGLCompositor
         * @function
         */
        clear : function () {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
    });
})();
