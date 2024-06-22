/**
 * additional import for TypeScript
 * @import Point from "./../../../geometries/point.js";
 */
/**
 * @classdesc
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @augments Compositor
 */
export default class PrimitiveCompositor extends Compositor {
    /**
     * Initialize the compositor
     * @ignore
     */
    init(renderer: any): void;
    /**
     * Draw an array of vertices
     * @param {GLenum} mode - primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {Point[]} verts - an array of vertices
     * @param {number} [vertexCount=verts.length] - amount of points defined in the points array
     */
    drawVertices(mode: GLenum, verts: Point[], vertexCount?: number | undefined): void;
}
import Compositor from "./compositor.js";
import type Point from "./../../../geometries/point.js";
