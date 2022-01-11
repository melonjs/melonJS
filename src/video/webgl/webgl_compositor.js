import Vector2d from "./../../math/vector2.js";
import GLShader from "./glshader.js";
import VertexArrayBuffer from "./buffer/vertex.js";
import * as event from "./../../system/event.js";
import { isPowerOfTwo } from "./../../math/math.js";

import primitiveVertex from "./shaders/primitive.vert";
import primitiveFragment from "./shaders/primitive.frag";
import quadVertex from "./shaders/quad.vert";
import quadFragment from "./shaders/quad.frag";

// a pool of resuable vectors
var V_ARRAY = [
    new Vector2d(),
    new Vector2d(),
    new Vector2d(),
    new Vector2d()
];

/**
 * @classdesc
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @class WebGLCompositor
 * @memberof me
 * @param {me.WebGLRenderer} renderer the current WebGL renderer session
 */
class WebGLCompositor {

    constructor (renderer) {
        this.init(renderer);
    }

    /**
     * Initialize the compositor
     * @ignore
     */
    init (renderer) {
        // local reference
        var gl = renderer.gl;

        // list of active texture units
        this.currentTextureUnit = -1;
        this.boundTextures = [];

        // the associated renderer
        this.renderer = renderer;

        // WebGL context
        this.gl = renderer.gl;

        // Global fill color
        this.color = renderer.currentColor;

        // Global transformation matrix
        this.viewMatrix = renderer.currentTransform;

        /**
         * a reference to the active WebGL shader
         * @name activeShader
         * @memberof me.WebGLCompositor
         * @type {me.GLShader}
         */
        this.activeShader = null;

        /**
         * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
         * @name mode
         * @see me.WebGLCompositor
         * @memberof me.WebGLCompositor
         * @default gl.TRIANGLES
         */
        this.mode = gl.TRIANGLES;

        /**
         * an array of vertex attribute properties
         * @name attributes
         * @see me.WebGLCompositor.addAttribute
         * @memberof me.WebGLCompositor
         */
        this.attributes = [];

        /**
         * the size of a single vertex in bytes
         * (will automatically be calculated as attributes definitions are added)
         * @name vertexByteSize
         * @see me.WebGLCompositor.addAttribute
         * @memberof me.WebGLCompositor
         */
        this.vertexByteSize = 0;

        /**
         * the size of a single vertex in floats
         * (will automatically be calculated as attributes definitions are added)
         * @name vertexSize
         * @see me.WebGLCompositor.addAttribute
         * @memberof me.WebGLCompositor
         */
        this.vertexSize = 0;

        // Load and create shader programs
        this.primitiveShader = new GLShader(this.gl, primitiveVertex, primitiveFragment);
        this.quadShader = new GLShader(this.gl, quadVertex, quadFragment);

        /// define all vertex attributes
        this.addAttribute("aVertex", 2, gl.FLOAT, false, 0 * Float32Array.BYTES_PER_ELEMENT); // 0
        this.addAttribute("aRegion", 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT); // 1
        this.addAttribute("aColor",  4, gl.UNSIGNED_BYTE, true, 4 * Float32Array.BYTES_PER_ELEMENT); // 2

        this.vertexBuffer = new VertexArrayBuffer(this.vertexSize, 6); // 6 vertices per quad

        // vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexBuffer.buffer, gl.STREAM_DRAW);

        // register to the CANVAS resize channel
        event.on(event.CANVAS_ONRESIZE, (width, height) => {
            this.flush();
            this.setViewport(0, 0, width, height);
        });
    }

    /**
     * Reset compositor internal state
     * @ignore
     */
    reset() {
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
            var texture2D = this.getTexture2D(i);
            if (typeof texture2D !== "undefined") {
                this.deleteTexture2D(texture2D);
            }
        }
        this.currentTextureUnit = -1;

        // set the quad shader as the default program
        this.useShader(this.quadShader);
    }

    /**
     * add vertex attribute property definition to the compositor
     * @name addAttribute
     * @memberof me.WebGLCompositor
     * @function
     * @param {string} name name of the attribute in the vertex shader
     * @param {number} size number of components per vertex attribute. Must be 1, 2, 3, or 4.
     * @param {GLenum} type data type of each component in the array
     * @param {boolean} normalized whether integer data values should be normalized into a certain range when being cast to a float
     * @param {number} offset offset in bytes of the first component in the vertex attribute array
     */
    addAttribute(name, size, type, normalized, offset) {
        this.attributes.push({
            name: name,
            size: size,
            type: type,
            normalized: normalized,
            offset: offset
        });

        switch (type) {
            case this.gl.BYTE:
                this.vertexByteSize += size * Int8Array.BYTES_PER_ELEMENT;
                break;
            case this.gl.UNSIGNED_BYTE:
                this.vertexByteSize += size * Uint8Array.BYTES_PER_ELEMENT;
                break;
            case this.gl.SHORT:
                this.vertexByteSize += size * Int16Array.BYTES_PER_ELEMENT;
                break;
            case this.gl.UNSIGNED_SHORT:
                this.vertexByteSize += size * Uint16Array.BYTES_PER_ELEMENT;
                break;
            case this.gl.INT:
                this.vertexByteSize += size * Int32Array.BYTES_PER_ELEMENT;
                break;
            case this.gl.UNSIGNED_INT:
                this.vertexByteSize += size * Uint32Array.BYTES_PER_ELEMENT;
                break;
            case this.gl.FLOAT:
                this.vertexByteSize += size * Float32Array.BYTES_PER_ELEMENT;
                break;
            default:
                throw new Error("Invalid GL Attribute type");
        }
        this.vertexSize = this.vertexByteSize / Float32Array.BYTES_PER_ELEMENT;
    }

    /**
     * Sets the viewport
     * @name setViewport
     * @memberof me.WebGLCompositor
     * @function
     * @param {number} x x position of viewport
     * @param {number} y y position of viewport
     * @param {number} w width of viewport
     * @param {number} h height of viewport
     */
    setViewport(x, y, w, h) {
        this.gl.viewport(x, y, w, h);
    }

    /**
     * Create a WebGL texture from an image
     * @name createTexture2D
     * @memberof me.WebGLCompositor
     * @function
     * @param {number} unit Destination texture unit
     * @param {Image|HTMLCanvasElement|ImageData|Uint8Array[]|Float32Array[]} image Source image
     * @param {number} filter gl.LINEAR or gl.NEAREST
     * @param {string} [repeat="no-repeat"] Image repeat behavior (see {@link me.ImageLayer#repeat})
     * @param {number} [w] Source image width (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {number} [h] Source image height (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {boolean} [premultipliedAlpha=true] Multiplies the alpha channel into the other color channels
     * @param {boolean} [mipmap=true] Whether mipmap levels should be generated for this texture
     * @returns {WebGLTexture} a WebGL texture
     */
    createTexture2D(unit, image, filter, repeat = "no-repeat", w, h, b, premultipliedAlpha = true, mipmap = true) {
        var gl = this.gl;
        var isPOT = isPowerOfTwo(w || image.width) && isPowerOfTwo(h || image.height);
        var texture = gl.createTexture();
        var rs = (repeat.search(/^repeat(-x)?$/) === 0) && (isPOT || this.renderer.WebGLVersion > 1) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        var rt = (repeat.search(/^repeat(-y)?$/) === 0) && (isPOT || this.renderer.WebGLVersion > 1) ? gl.REPEAT : gl.CLAMP_TO_EDGE;

        this.bindTexture2D(texture, unit);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rs);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rt);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultipliedAlpha);
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
    }

    /**
     * delete the given WebGL texture
     * @name bindTexture2D
     * @memberof me.WebGLCompositor
     * @function
     * @param {WebGLTexture} [texture] a WebGL texture to delete
     * @param {number} [unit] Texture unit to delete
     */
    deleteTexture2D(texture) {
        this.gl.deleteTexture(texture);
        this.unbindTexture2D(texture);
    }

    /**
     * returns the WebGL texture associated to the given texture unit
     * @name bindTexture2D
     * @memberof me.WebGLCompositor
     * @function
     * @param {number} unit Texture unit to which a texture is bound
     * @returns {WebGLTexture} texture a WebGL texture
     */
    getTexture2D(unit) {
        return this.boundTextures[unit];
    }

    /**
     * assign the given WebGL texture to the current batch
     * @name bindTexture2D
     * @memberof me.WebGLCompositor
     * @function
     * @param {WebGLTexture} texture a WebGL texture
     * @param {number} unit Texture unit to which the given texture is bound
     */
    bindTexture2D(texture, unit) {
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
    }

    /**
     * unbind the given WebGL texture, forcing it to be reuploaded
     * @name unbindTexture2D
     * @memberof me.WebGLCompositor
     * @function
     * @param {WebGLTexture} [texture] a WebGL texture
     * @param {number} [unit] a WebGL texture
     * @returns {number} unit the unit number that was associated with the given texture
     */
    unbindTexture2D(texture, unit) {
        if (typeof unit === "undefined") {
            unit = this.boundTextures.indexOf(texture);
        }
        if (unit !== -1) {
            delete this.boundTextures[unit];
            if (unit === this.currentTextureUnit) {
                this.currentTextureUnit = -1;
            }
        }
        return unit;
    }

    /**
     * @ignore
     */
    uploadTexture(texture, w, h, b, force = false) {
        var unit = this.renderer.cache.getUnit(texture);
        var texture2D = this.boundTextures[unit];

        if (typeof texture2D === "undefined" || force) {
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
            this.bindTexture2D(texture2D, unit);
        }

        return this.currentTextureUnit;
    }

    /**
     * Select the shader to use for compositing
     * @name useShader
     * @see me.GLShader
     * @memberof me.WebGLCompositor
     * @function
     * @param {me.GLShader} shader a reference to a GLShader instance
     */
    useShader(shader) {
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
                    gl.vertexAttribPointer(location, element.size, element.type, element.normalized, this.vertexByteSize, element.offset);
                } else {
                    gl.disableVertexAttribArray(index);
                }
            }
        }
    }

    /**
     * Add a textured quad
     * @name addQuad
     * @memberof me.WebGLCompositor
     * @function
     * @param {me.Renderer.Texture} texture Source texture
     * @param {number} x Destination x-coordinate
     * @param {number} y Destination y-coordinate
     * @param {number} w Destination width
     * @param {number} h Destination height
     * @param {number} u0 Texture UV (u0) value.
     * @param {number} v0 Texture UV (v0) value.
     * @param {number} u1 Texture UV (u1) value.
     * @param {number} v1 Texture UV (v1) value.
     * @param {number} tint tint color to be applied to the texture in UINT32 (argb) format
     */
    addQuad(texture, x, y, w, h, u0, v0, u1, v1, tint) {

        if (this.color.alpha < 1 / 255) {
            // Fast path: don't send fully transparent quads
            return;
        }

        this.useShader(this.quadShader);

        if (this.vertexBuffer.isFull(6)) {
            // is the vertex buffer full if we add 6 more vertices
            this.flush();
        }

        // upload and activate the texture if necessary
        var unit = this.uploadTexture(texture);
        // set fragement sampler accordingly
        this.quadShader.setUniform("uSampler", unit);

        // Transform vertices
        var m = this.viewMatrix,
            vec0 = V_ARRAY[0].set(x, y),
            vec1 = V_ARRAY[1].set(x + w, y),
            vec2 = V_ARRAY[2].set(x, y + h),
            vec3 = V_ARRAY[3].set(x + w, y + h);

        if (!m.isIdentity()) {
            m.apply(vec0);
            m.apply(vec1);
            m.apply(vec2);
            m.apply(vec3);
        }

        this.vertexBuffer.push(vec0.x, vec0.y, u0, v0, tint);
        this.vertexBuffer.push(vec1.x, vec1.y, u1, v0, tint);
        this.vertexBuffer.push(vec2.x, vec2.y, u0, v1, tint);
        this.vertexBuffer.push(vec2.x, vec2.y, u0, v1, tint);
        this.vertexBuffer.push(vec1.x, vec1.y, u1, v0, tint);
        this.vertexBuffer.push(vec3.x, vec3.y, u1, v1, tint);
    }

    /**
     * Flush batched texture operations to the GPU
     * @param {number} [mode=gl.TRIANGLES] the GL drawing mode
     * @memberof me.WebGLCompositor
     * @function
     */
    flush(mode = this.mode) {
        var vertex = this.vertexBuffer;
        var vertexCount = vertex.vertexCount;

        if (vertexCount > 0) {
            var gl = this.gl;
            var vertexSize = vertex.vertexSize;

            // Copy data into stream buffer
            if (this.renderer.WebGLVersion > 1) {
                gl.bufferData(gl.ARRAY_BUFFER, vertex.toFloat32(), gl.STREAM_DRAW, 0, vertexCount * vertexSize);
            } else {
                gl.bufferData(gl.ARRAY_BUFFER, vertex.toFloat32(0, vertexCount * vertexSize), gl.STREAM_DRAW);
            }

            gl.drawArrays(mode, 0, vertexCount);

            // clear the vertex buffer
            vertex.clear();
        }
    }

    /**
     * Draw an array of vertices
     * @name drawVertices
     * @memberof me.WebGLCompositor
     * @function
     * @param {GLenum} mode primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {me.Vector2d[]} verts vertices
     * @param {number} [vertexCount=verts.length] amount of points defined in the points array
     */
    drawVertices(mode, verts, vertexCount = verts.length) {
        // use the primitive shader
        this.useShader(this.primitiveShader);
        // Set the line color
        this.primitiveShader.setUniform("uColor", this.color);

        var m = this.viewMatrix;
        var vertex = this.vertexBuffer;
        var m_isIdentity = m.isIdentity();

        for (var i = 0; i < vertexCount; i++) {
            if (!m_isIdentity) {
                m.apply(verts[i]);
            }
            vertex.push(verts[i].x, verts[i].y);
        }

        // flush
        this.flush(mode);
    }

    /**
     * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
     * @name clearColor
     * @memberof me.WebGLCompositor
     * @function
     * @param {number} [r=0] - the red color value used when the color buffers are cleared
     * @param {number} [g=0] - the green color value used when the color buffers are cleared
     * @param {number} [b=0] - the blue color value used when the color buffers are cleared
     * @param {number} [a=0] - the alpha color value used when the color buffers are cleared
     */
    clearColor(r, g, b, a) {
        this.gl.clearColor(r, g, b, a);
    }

    /**
     * Clear the frame buffer
     * @name clear
     * @memberof me.WebGLCompositor
     * @function
     */
    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
};

export default WebGLCompositor;
