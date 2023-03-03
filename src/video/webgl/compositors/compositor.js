import * as event from "../../../system/event.js";
import VertexArrayBuffer from "../buffer/vertex.js";

/**
 * @classdesc
 * A base Compositor object.
 */
 export default class Compositor {
    /**
     * @param {WebGLRenderer} renderer - the current WebGL renderer session
     * @param {Object} settings - additional settings to initialize this compositors
     * @param {object[]} [attribute] - an array of attributes definition
     * @param {string} [attribute.name] - name of the attribute in the vertex shader
     * @param {number} [attribute.size] - number of components per vertex attribute. Must be 1, 2, 3, or 4.
     * @param {GLenum} [attribute.type] - data type of each component in the array
     * @param {boolean} [attribute.normalized] - whether integer data values should be normalized into a certain range when being cast to a float
     * @param {number} [attribute.offset] - offset in bytes of the first component in the vertex attribute array
     */
    constructor (renderer, settings) {
        this.init(renderer, settings);
    }

    /**
     * Initialize the compositor
     * @ignore
     */
    init (renderer, settings) {
        // local reference
        var gl = renderer.gl;

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
         * @type {GLShader}
         */
        this.activeShader = null;

        /**
         * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
         * @type {number}
         * @default gl.TRIANGLES
         */
        this.mode = gl.TRIANGLES;

        /**
         * an array of vertex attribute properties
         * @see WebGLCompositor.addAttribute
         * @type {Array}
         */
        this.attributes = [];

        /**
         * the size of a single vertex in bytes
         * (will automatically be calculated as attributes definitions are added)
         * @see WebGLCompositor.addAttribute
         * @type {number}
         */
        this.vertexByteSize = 0;

        /**
         * the size of a single vertex in floats
         * (will automatically be calculated as attributes definitions are added)
         * @see WebGLCompositor.addAttribute
         * @type {number}
         */
        this.vertexSize = 0;

        /**
         * the vertex buffer used by this compositor
         * @type {VertexArrayBuffer}
         */
        this.vertexBuffer = null;

        // parse given attibrutes
        if (typeof settings !== "undefined" && Array.isArray(settings.attributes)) {
            settings.attributes.forEach((attr) => {
                this.addAttribute(attr.name, attr.size, attr.type, attr.normalized, attr.offset);
            });
        } else {
            throw new Error("attributes definition missing");
        }

        // instantiate the compositor vertexBuffer
        this.vertexBuffer = new VertexArrayBuffer(this.vertexSize, 6);

        // vertex buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexBuffer.buffer, this.gl.STREAM_DRAW);

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
            this.renderer.getCanvas().width,
            this.renderer.getCanvas().height
        );

        // Initialize clear color
        this.clearColor(0.0, 0.0, 0.0, 0.0);
    }

    /**
     * @ignore
     * called by the WebGL renderer when a compositor become the current one
     */
    bind() {
        if (this.activeShader !== null) {
            this.activeShader.bind();
            this.activeShader.setUniform("uProjectionMatrix", this.renderer.projectionMatrix);
            this.activeShader.setVertexAttributes(this.gl, this.attributes, this.vertexByteSize);
        }
    }

    /**
     * add vertex attribute property definition to the compositor
     * @param {string} name - name of the attribute in the vertex shader
     * @param {number} size - number of components per vertex attribute. Must be 1, 2, 3, or 4.
     * @param {GLenum} type - data type of each component in the array
     * @param {boolean} normalized - whether integer data values should be normalized into a certain range when being cast to a float
     * @param {number} offset - offset in bytes of the first component in the vertex attribute array
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
     * @param {number} x - x position of viewport
     * @param {number} y - y position of viewport
     * @param {number} w - width of viewport
     * @param {number} h - height of viewport
     */
    setViewport(x, y, w, h) {
        this.gl.viewport(x, y, w, h);
    }

    /**
     * set/change the current projection matrix
     * @param {Matrix3d} matrix
     */
    setProjection(matrix) {
        this.activeShader.setUniform("uProjectionMatrix", matrix);
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
     * Flush batched texture operations to the GPU
     * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
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
     * Clear the frame buffer
     * @param {number} [alpha = 0.0] - the alpha value used when clearing the framebuffer
     */
    clear(alpha = 0) {
        var gl = this.gl;
        gl.clearColor(0, 0, 0, alpha);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    }

    /**
     * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
     * @param {number} [r = 0] - the red color value used when the color buffers are cleared
     * @param {number} [g = 0] - the green color value used when the color buffers are cleared
     * @param {number} [b = 0] - the blue color value used when the color buffers are cleared
     * @param {number} [a = 0] - the alpha color value used when the color buffers are cleared
     */
    clearColor(r = 0, g = 0, b = 0, a = 0) {
        var gl = this.gl;
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
