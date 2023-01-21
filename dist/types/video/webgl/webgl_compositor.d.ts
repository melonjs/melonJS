/**
 * @classdesc
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 */
export default class WebGLCompositor {
    /**
     * @param {WebGLRenderer} renderer - the current WebGL renderer session
     */
    constructor(renderer: WebGLRenderer);
    /**
     * Initialize the compositor
     * @ignore
     */
    init(renderer: any): void;
    currentTextureUnit: any;
    boundTextures: any[] | undefined;
    renderer: any;
    gl: any;
    color: any;
    viewMatrix: any;
    /**
     * a reference to the active WebGL shader
     * @type {GLShader}
     */
    activeShader: GLShader | undefined;
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
    primitiveShader: GLShader | undefined;
    quadShader: GLShader | undefined;
    vertexBuffer: VertexArrayBuffer | undefined;
    /**
     * Reset compositor internal state
     * @ignore
     */
    reset(): void;
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
    createTexture2D(unit: number, image: (new (width?: number | undefined, height?: number | undefined) => HTMLImageElement) | HTMLCanvasElement | ImageData | Uint8Array[] | Float32Array[], filter: number, repeat?: string | undefined, w?: number | undefined, h?: number | undefined, b?: number | undefined, premultipliedAlpha?: boolean | undefined, mipmap?: boolean | undefined): WebGLTexture;
    /**
     * delete the given WebGL texture
     * @param {WebGLTexture} [texture] - a WebGL texture to delete
     * @param {number} [unit] - Texture unit to delete
     */
    deleteTexture2D(texture?: WebGLTexture | undefined): void;
    /**
     * returns the WebGL texture associated to the given texture unit
     * @param {number} unit - Texture unit to which a texture is bound
     * @returns {WebGLTexture} texture a WebGL texture
     */
    getTexture2D(unit: number): WebGLTexture;
    /**
     * assign the given WebGL texture to the current batch
     * @param {WebGLTexture} texture - a WebGL texture
     * @param {number} unit - Texture unit to which the given texture is bound
     */
    bindTexture2D(texture: WebGLTexture, unit: number): void;
    /**
     * unbind the given WebGL texture, forcing it to be reuploaded
     * @param {WebGLTexture} [texture] - a WebGL texture
     * @param {number} [unit] - a WebGL texture
     * @returns {number} unit the unit number that was associated with the given texture
     */
    unbindTexture2D(texture?: WebGLTexture | undefined, unit?: number | undefined): number;
    /**
     * @ignore
     */
    uploadTexture(texture: any, w: any, h: any, b: any, force?: boolean): any;
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
    addQuad(texture: TextureAtlas, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, tint: number): void;
    /**
     * Flush batched texture operations to the GPU
     * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
     */
    flush(mode?: number | undefined): void;
    /**
     * Draw an array of vertices
     * @param {GLenum} mode - primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {Point[]} verts - an array of vertices
     * @param {number} [vertexCount=verts.length] - amount of points defined in the points array
     */
    drawVertices(mode: GLenum, verts: Point[], vertexCount?: number | undefined): void;
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
import GLShader from "./glshader.js";
import VertexArrayBuffer from "./buffer/vertex.js";
