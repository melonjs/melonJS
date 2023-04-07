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
    constructor(gl: WebGLRenderingContext, vertex: string, fragment: string, precision?: string | undefined);
    /**
     * the active gl rendering context
     * @type {WebGLRenderingContext}
     */
    gl: WebGLRenderingContext;
    /**
     * the vertex shader source code
     * @type {string}
     */
    vertex: string;
    /**
     * the fragment shader source code
     * @type {string}
     */
    fragment: string;
    /**
     * the location attributes of the shader
     * @type {GLint[]}
     */
    attributes: GLint[];
    /**
     * a reference to the shader program (once compiled)
     * @type {WebGLProgram}
     */
    program: WebGLProgram;
    /**
     * the uniforms of the shader
     * @type {object}
     */
    uniforms: object;
    /**
     * Installs this shader program as part of current rendering state
     */
    bind(): void;
    /**
     * returns the location of an attribute variable in this shader program
     * @param {string} name - the name of the attribute variable whose location to get.
     * @returns {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
     */
    getAttribLocation(name: string): GLint;
    /**
     * Set the uniform to the given value
     * @param {string} name - the uniform name
     * @param {object|Float32Array} value - the value to assign to that uniform
     * @example
     * myShader.setUniform("uProjectionMatrix", this.projectionMatrix);
     */
    setUniform(name: string, value: object | Float32Array): void;
    /**
     * activate the given vertex attribute for this shader
     * @param {WebGLRenderingContext} gl - the current WebGL rendering context
     * @param {object[]} attributes - an array of vertex attributes
     * @param {number} vertexByteSize - the size of a single vertex in bytes
     */
    setVertexAttributes(gl: WebGLRenderingContext, attributes: object[], vertexByteSize: number): void;
    /**
     * destroy this shader objects resources (program, attributes, uniforms)
     */
    destroy(): void;
}
