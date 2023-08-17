import * as event from "./../../system/event.js";
import { extractUniforms } from "./utils/uniforms.js";
import { extractAttributes } from "./utils/attributes.js";
import { compileProgram } from "./utils/program.js";
import { setPrecision, getMaxShaderPrecision } from "./utils/precision.js";
import { minify } from "./utils/string.js";

/**
 * @classdesc
 * a base GL Shader object
 */
export default class GLShader {
    /**
     * @param {WebGLRenderingContext} gl - the current WebGL rendering context
     * @param {string} vertex - a string containing the GLSL source code to set
     * @param {string} fragment - a string containing the GLSL source code to set
     * @param {string} [precision=auto detected] - float precision ('lowp', 'mediump' or 'highp').
     * @see https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/GLSL_Shaders
     * @example
     * // create a basic shader
     * let myShader = new me.GLShader(
     *    // WebGL rendering context
     *    gl,
     *    // vertex shader
     *    [
     *        "void main() {",
     *        "    gl_Position = doMathToMakeClipspaceCoordinates;",
     *        "}"
     *    ].join("\n"),
     *    // fragment shader
     *    [
     *        "void main() {",
     *        "    gl_FragColor = doMathToMakeAColor;",
     *        "}"
     *    ].join("\n")
     *  )
     * // use the shader
     * myShader.bind();
     */
    constructor(gl, vertex, fragment, precision) {

        /**
         * the active gl rendering context
         * @type {WebGLRenderingContext}
         */
        this.gl = gl;

        /**
         * the vertex shader source code
         * @type {string}
         */
        this.vertex = setPrecision(minify(vertex), precision || getMaxShaderPrecision(this.gl));

        /**
         * the fragment shader source code
         * @type {string}
         */
        this.fragment = setPrecision(minify(fragment), precision || getMaxShaderPrecision(this.gl));

        /**
         * the location attributes of the shader
         * @type {GLint[]}
         */
        this.attributes = extractAttributes(this.gl, this);


        /**
         * a reference to the shader program (once compiled)
         * @type {WebGLProgram}
         */
        this.program = compileProgram(this.gl, this.vertex, this.fragment, this.attributes);

        /**
         * the uniforms of the shader
         * @type {object}
         */
        this.uniforms = extractUniforms(this.gl, this);

        // destroy the shader on context lost (will be recreated on context restore)
        event.on(event.ONCONTEXT_LOST, this.destroy, this);
    }

    /**
     * Installs this shader program as part of current rendering state
     */
    bind() {
        this.gl.useProgram(this.program);
    }

    /**
     * returns the location of an attribute variable in this shader program
     * @param {string} name - the name of the attribute variable whose location to get.
     * @returns {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
     */
    getAttribLocation(name) {
        let attr = this.attributes[name];
        if (typeof attr !== "undefined") {
            return attr;
        } else {
            return -1;
        }
    }

    /**
     * Set the uniform to the given value
     * @param {string} name - the uniform name
     * @param {object|Float32Array} value - the value to assign to that uniform
     * @example
     * myShader.setUniform("uProjectionMatrix", this.projectionMatrix);
     */
    setUniform(name, value) {
        let uniforms = this.uniforms;
        if (typeof uniforms[name] !== "undefined") {
            if (typeof value === "object" && typeof value.toArray === "function") {
                uniforms[name] = value.toArray();
            } else {
                uniforms[name] = value;
            }
        } else {
            throw new Error("undefined (" + name + ") uniform for shader " + this);
        }
    }

    /**
     * activate the given vertex attribute for this shader
     * @param {WebGLRenderingContext} gl - the current WebGL rendering context
     * @param {object[]} attributes - an array of vertex attributes
     * @param {number} vertexByteSize - the size of a single vertex in bytes
     */
    setVertexAttributes(gl, attributes, vertexByteSize) {
        // set the vertex attributes
        for (let index = 0; index < attributes.length; ++index) {
            let element = attributes[index];
            let location = this.getAttribLocation(element.name);

            if (location !== -1) {
                gl.enableVertexAttribArray(location);
                gl.vertexAttribPointer(location, element.size, element.type, element.normalized, vertexByteSize, element.offset);
            } else {
                gl.disableVertexAttribArray(index);
            }
        }
    }

    /**
     * destroy this shader objects resources (program, attributes, uniforms)
     */
    destroy() {
        this.uniforms = null;
        this.attributes = null;

        this.gl.deleteProgram(this.program);

        this.vertex = null;
        this.fragment = null;
    }
}

