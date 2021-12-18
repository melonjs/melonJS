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

// Handy constants
var VERTEX_SIZE = 2;
var REGION_SIZE = 2;
var COLOR_SIZE = 4;

var ELEMENT_SIZE = VERTEX_SIZE + REGION_SIZE + COLOR_SIZE;
var ELEMENT_OFFSET = ELEMENT_SIZE * Float32Array.BYTES_PER_ELEMENT;

var ELEMENTS_PER_QUAD = 4;
var INDICES_PER_QUAD = 6;

var MAX_LENGTH = 16000;

/**
 * Create a full index buffer for the element array
 * @ignore
 */
function createIB() {
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
};


/**
 * @classdesc
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @class WebGLCompositor
 * @memberOf me
 * @constructor
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
        this.primitiveShader = new GLShader(this.gl, primitiveVertex, primitiveFragment);
        this.quadShader = new GLShader(this.gl, quadVertex, quadFragment);

        /// define all vertex attributes
        this.addAttribute("aVertex", 2, gl.FLOAT, false, 0 * Float32Array.BYTES_PER_ELEMENT); // 0
        this.addAttribute("aRegion", 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT); // 1
        this.addAttribute("aColor",  4, gl.UNSIGNED_BYTE, true, 4 * Float32Array.BYTES_PER_ELEMENT); // 2

        // vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(
            gl.ARRAY_BUFFER,
            MAX_LENGTH * ELEMENT_OFFSET * ELEMENTS_PER_QUAD,
            gl.STREAM_DRAW
        );

        this.vertexBuffer = new VertexArrayBuffer(ELEMENT_SIZE, ELEMENTS_PER_QUAD);

        // Cache index buffer (TODO Remove use for cache by replacing drawElements by drawArrays)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, createIB(), gl.STATIC_DRAW);

        // register to the CANVAS resize channel
        event.on(event.CANVAS_ONRESIZE, (width, height) => {
            this.flush();
            this.setViewport(0, 0, width, height);
        });

        this.reset();
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
            var texture = this.boundTextures[i];
            if (texture !== null) {
                this.boundTextures[i] = null;
                this.gl.deleteTexture(texture);
            }
        }
        this.currentTextureUnit = -1;

        // set the quad shader as the default program
        this.useShader(this.quadShader);
    }

    /**
     * add vertex attribute property definition to the compositor
     * @name addAttribute
     * @memberOf me.WebGLCompositor
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
    }

    /**
     * Sets the viewport
     * @name setViewport
     * @memberOf me.WebGLCompositor
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
     * @memberOf me.WebGLCompositor
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
     * assign the given WebGL texture to the current batch
     * @name bindTexture2D
     * @memberOf me.WebGLCompositor
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
     * @memberOf me.WebGLCompositor
     * @function
     * @param {WebGLTexture} texture a WebGL texture
     */
    unbindTexture2D(texture) {
        var unit = this.renderer.cache.getUnit(texture);
        this.boundTextures[unit] = null;
    }

    /**
     * @ignore
     */
    uploadTexture(texture, w, h, b, force) {
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
            this.bindTexture2D(texture2D, unit);
        }

        return this.currentTextureUnit;
    }

    /**
     * Select the shader to use for compositing
     * @name useShader
     * @see me.GLShader
     * @memberOf me.WebGLCompositor
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
                    gl.vertexAttribPointer(location, element.size, element.type, element.normalized, ELEMENT_OFFSET, element.offset);
                } else {
                    gl.disableVertexAttribArray(index);
                }
            }
        }
    }

    /**
     * Add a textured quad
     * @name addQuad
     * @memberOf me.WebGLCompositor
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
     * @param {number} tint tint color to be applied to the texture in UINT32 format
     */
    addQuad(texture, x, y, w, h, u0, v0, u1, v1, tint) {

        if (this.color.alpha < 1 / 255) {
            // Fast path: don't send fully transparent quads
            return;
        }

        this.useShader(this.quadShader);

        if (this.vertexBuffer.isFull(4)) {
            // is the vertex buffer full if we add 4 more vertices
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
        this.vertexBuffer.push(vec3.x, vec3.y, u1, v1, tint);
    }

    /**
     * Flush batched texture operations to the GPU
     * @param {number} [mode=gl.TRIANGLES] the GL drawing mode
     * @memberOf me.WebGLCompositor
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

            // Draw the stream buffer
            // TODO : finalize the WebGLCompositor implementation (splitting this one into two)
            // so that different compositor with different attributes/uniforms & drawing method can be used
            if (this.activeShader === this.primitiveShader) {
                gl.drawArrays(mode, 0, vertexCount);
            } else {
                gl.drawElements(mode, vertexCount / vertex.quadSize * INDICES_PER_QUAD, gl.UNSIGNED_SHORT, 0);
            }

            // clear the vertex buffer
            vertex.clear();
        }
    }

    /**
     * Draw an array of vertices
     * @name drawVertices
     * @memberOf me.WebGLCompositor
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
     * @memberOf me.WebGLCompositor
     * @function
     * @param {number} r - the red color value used when the color buffers are cleared
     * @param {number} g - the green color value used when the color buffers are cleared
     * @param {number} b - the blue color value used when the color buffers are cleared
     * @param {number} a - the alpha color value used when the color buffers are cleared
     */
    clearColor(r, g, b, a) {
        this.gl.clearColor(r, g, b, a);
    }

    /**
     * Clear the frame buffer
     * @name clear
     * @memberOf me.WebGLCompositor
     * @function
     */
    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
};

export default WebGLCompositor;
