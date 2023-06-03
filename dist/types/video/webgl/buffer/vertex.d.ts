/**
 * @classdesc
 * a Vertex Buffer object
 * @class VertexArrayBuffer
 * @ignore
 */
export default class VertexArrayBuffer {
    constructor(vertex_size: any, vertex_per_obj: any);
    vertexSize: any;
    objSize: any;
    maxVertex: number;
    vertexCount: number;
    buffer: ArrayBuffer;
    bufferF32: Float32Array;
    bufferU32: Uint32Array;
    /**
     * clear the vertex array buffer
     * @ignore
     */
    clear(): void;
    /**
     * return true if full
     * @ignore
     */
    isFull(vertex?: any): boolean;
    /**
     * resize the vertex buffer, retaining its original contents
     * @ignore
     */
    resize(vertexCount: any): this;
    /**
     * push a new vertex to the buffer
     * @ignore
     */
    push(x: any, y: any, u: any, v: any, tint: any): this;
    /**
     * return a reference to the data in Float32 format
     * @ignore
     */
    toFloat32(begin: any, end: any): Float32Array;
    /**
     * return a reference to the data in Uint32 format
     * @ignore
     */
    toUint32(begin: any, end: any): Uint32Array;
    /**
     * return the size of the vertex in vertex
     * @ignore
     */
    length(): number;
    /**
     * return true if empty
     * @ignore
     */
    isEmpty(): boolean;
}
