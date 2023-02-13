/*!
 * melonJS Game Engine - v15.0.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import Vector2d from '../../../math/vector2.js';
import GLShader from '../glshader.js';
import VertexArrayBuffer from '../buffer/vertex.js';
import { isPowerOfTwo } from '../../../math/math.js';
import primitiveVertex from '../shaders/primitive.vert.js';
import primitiveFragment from '../shaders/primitive.frag.js';
import quadVertex from '../shaders/quad.vert.js';
import quadFragment from '../shaders/quad.frag.js';
import Compositor from './compositor.js';

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
 * @augments Compositor
 */
 class WebGLCompositor extends Compositor {

    /**
     * Initialize the compositor
     * @ignore
     */
    init (renderer) {
        super.init(renderer);

        // list of active texture units
        this.currentTextureUnit = -1;
        this.boundTextures = [];

        // Load and create shader programs
        this.primitiveShader = new GLShader(this.gl, primitiveVertex, primitiveFragment);
        this.quadShader = new GLShader(this.gl, quadVertex, quadFragment);

        /// define all vertex attributes
        this.addAttribute("aVertex", 2, this.gl.FLOAT, false, 0 * Float32Array.BYTES_PER_ELEMENT); // 0
        this.addAttribute("aRegion", 2, this.gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT); // 1
        this.addAttribute("aColor",  4, this.gl.UNSIGNED_BYTE, true, 4 * Float32Array.BYTES_PER_ELEMENT); // 2

        this.vertexBuffer = new VertexArrayBuffer(this.vertexSize, 6); // 6 vertices per quad

        // vertex buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexBuffer.buffer, this.gl.STREAM_DRAW);
    }

    /**
     * Reset compositor internal state
     * @ignore
     */
    reset() {
        super.reset();

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
     * Create a WebGL texture from an image
     * @param {number} unit - Destination texture unit
     * @param {Image|HTMLCanvasElement|ImageData|Uint8Array[]|Float32Array[]} image - Source image
     * @param {number} filter - gl.LINEAR or gl.NEAREST
     * @param {string} [repeat="no-repeat"] - Image repeat behavior (see {@link ImageLayer#repeat})
     * @param {number} [w] - Source image width (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {number} [h] - Source image height (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {number} [b] - Source image border (Only use with UInt8Array[] or Float32Array[] source image)
     * @param {boolean} [premultipliedAlpha=true] - Multiplies the alpha channel into the other color channels
     * @param {boolean} [mipmap=true] - Whether mipmap levels should be generated for this texture
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
     * @param {WebGLTexture} [texture] - a WebGL texture to delete
     * @param {number} [unit] - Texture unit to delete
     */
    deleteTexture2D(texture) {
        this.gl.deleteTexture(texture);
        this.unbindTexture2D(texture);
    }

    /**
     * returns the WebGL texture associated to the given texture unit
     * @param {number} unit - Texture unit to which a texture is bound
     * @returns {WebGLTexture} texture a WebGL texture
     */
    getTexture2D(unit) {
        return this.boundTextures[unit];
    }

    /**
     * assign the given WebGL texture to the current batch
     * @param {WebGLTexture} texture - a WebGL texture
     * @param {number} unit - Texture unit to which the given texture is bound
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
     * @param {WebGLTexture} [texture] - a WebGL texture
     * @param {number} [unit] - a WebGL texture
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
     * @see GLShader
     * @param {GLShader} shader - a reference to a GLShader instance
     */
    useShader(shader) {
        if (this.activeShader !== shader) {
            this.flush();
            this.activeShader = shader;
            this.activeShader.bind();
            this.activeShader.setUniform("uProjectionMatrix", this.renderer.projectionMatrix);
            this.activeShader.setVertexAttributes(this.gl, this.attributes, this.vertexByteSize);
        }
    }

    /**
     * Add a textured quad
     * @param {TextureAtlas} texture - Source texture atlas
     * @param {number} x - Destination x-coordinate
     * @param {number} y - Destination y-coordinate
     * @param {number} w - Destination width
     * @param {number} h - Destination height
     * @param {number} u0 - Texture UV (u0) value.
     * @param {number} v0 - Texture UV (v0) value.
     * @param {number} u1 - Texture UV (u1) value.
     * @param {number} v1 - Texture UV (v1) value.
     * @param {number} tint - tint color to be applied to the texture in UINT32 (argb) format
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
     * Draw an array of vertices
     * @param {GLenum} mode - primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {Point[]} verts - an array of vertices
     * @param {number} [vertexCount=verts.length] - amount of points defined in the points array
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
}

export { WebGLCompositor as default };
