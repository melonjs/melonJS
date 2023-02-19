/**
 * @classdesc
 * A base Compositor object.
 */
export default class Compositor {
    /**
     * @param {WebGLRenderer} renderer - the current WebGL renderer session
     */
    constructor(renderer: WebGLRenderer);
    /**
     * Initialize the compositor
     * @ignore
     */
    init(renderer: any): void;
    renderer: any;
    gl: any;
    color: any;
    viewMatrix: any;
    /**
     * a reference to the active WebGL shader
     * @type {GLShader}
     */
    activeShader: any;
    /**
     * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @type {number}
     * @default gl.TRIANGLES
     */
    mode: number | undefined;
    /**
     * an array of vertex attribute properties
     * @see WebGLCompositor.addAttribute
     * @type {Array}
     */
    attributes: any[] | undefined;
    /**
     * the size of a single vertex in bytes
     * (will automatically be calculated as attributes definitions are added)
     * @see WebGLCompositor.addAttribute
     * @type {number}
     */
    vertexByteSize: number | undefined;
    /**
     * the size of a single vertex in floats
     * (will automatically be calculated as attributes definitions are added)
     * @see WebGLCompositor.addAttribute
     * @type {number}
     */
    vertexSize: number | undefined;
    /**
     * Reset compositor internal state
     * @ignore
     */
    reset(): void;
    /**
     * @ignore
     * called by the WebGL renderer when a compositor become the current one
     */
    bind(): void;
    /**
     * add vertex attribute property definition to the compositor
     * @param {string} name - name of the attribute in the vertex shader
     * @param {number} size - number of components per vertex attribute. Must be 1, 2, 3, or 4.
     * @param {GLenum} type - data type of each component in the array
     * @param {boolean} normalized - whether integer data values should be normalized into a certain range when being cast to a float
     * @param {number} offset - offset in bytes of the first component in the vertex attribute array
     */
    addAttribute(name: string, size: number, type: GLenum, normalized: boolean, offset: number): void;
    /**
     * Sets the viewport
     * @param {number} x - x position of viewport
     * @param {number} y - y position of viewport
     * @param {number} w - width of viewport
     * @param {number} h - height of viewport
     */
    setViewport(x: number, y: number, w: number, h: number): void;
    /**
     * set/change the current projection matrix
     * @param {Matrix3d} matrix
     */
    setProjection(matrix: Matrix3d): void;
    /**
     * Select the shader to use for compositing
     * @see GLShader
     * @param {GLShader} shader - a reference to a GLShader instance
     */
    useShader(shader: GLShader): void;
    /**
     * Flush batched texture operations to the GPU
     * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
     */
    flush(mode?: number | undefined): void;
    /**
     * Clear the frame buffer
     * @param {number} [alpha = 0.0] - the alpha value used when clearing the framebuffer
     */
    clear(alpha?: number | undefined): void;
    /**
     * Specify the color values used when clearing color buffers. The values are clamped between 0 and 1.
     * @param {number} [r = 0] - the red color value used when the color buffers are cleared
     * @param {number} [g = 0] - the green color value used when the color buffers are cleared
     * @param {number} [b = 0] - the blue color value used when the color buffers are cleared
     * @param {number} [a = 0] - the alpha color value used when the color buffers are cleared
     */
    clearColor(r?: number | undefined, g?: number | undefined, b?: number | undefined, a?: number | undefined): void;
}
