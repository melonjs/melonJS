/**
 * @classdesc
 * a Vertex Buffer object
 * @class VertexArrayBuffer
 * @ignore
 */

class VertexArrayBuffer {

    constructor(vertex_size, vertex_per_quad) {
        // the size of one vertex in float
        this.vertexSize = vertex_size;
        // size of a quad in vertex
        this.quadSize = vertex_per_quad;
        // the maximum number of vertices the vertex array buffer can hold
        this.maxVertex = 256;
        // the current number of vertices added to the vertex array buffer
        this.vertexCount = 0;

        // the actual vertex data buffer
        this.buffer = new ArrayBuffer(this.maxVertex * this.vertexSize * this.quadSize);
        // Float32 and Uint32 view of the vertex data array buffer
        this.bufferF32 = new Float32Array(this.buffer);
        this.bufferU32 = new Uint32Array(this.buffer);


        return this;
    }

    /**
     * clear the vertex array buffer
     * @ignore
     */
    clear() {
        this.vertexCount = 0;
    }


    /**
     * return true if full
     * @ignore
     */
    isFull(vertex = this.quadSize) {
         return (this.vertexCount + vertex >= this.maxVertex);
    }

    /**
     * resize the vertex buffer, retaining its original contents
     * @ignore
     */
    resize() {
        // double the vertex size
        this.maxVertex <<= 1;
        // save a reference to the previous data
        var data = this.bufferF32;

        // recreate ArrayBuffer and views
        this.buffer = new ArrayBuffer(this.maxVertex * this.vertexSize * this.quadSize);
        this.bufferF32 = new Float32Array(this.buffer);
        this.bufferU32 = new Uint32Array(this.buffer);

        // copy previous data
        this.bufferF32.set(data);

        return this;
    }

    /**
     * push a new vertex to the buffer
     * @ignore
     */
    push(x, y, u, v, tint) {
        var offset = this.vertexCount * this.vertexSize;

        if (this.vertexCount >= this.maxVertex) {
            this.resize();
        }

        this.bufferF32[offset + 0] = x;
        this.bufferF32[offset + 1] = y;

        if (typeof u !== "undefined") {
            this.bufferF32[offset + 2] = u;
            this.bufferF32[offset + 3] = v;
        }

        if (typeof tint !== "undefined") {
            this.bufferU32[offset + 4] = tint;
        }

        this.vertexCount++;

        return this;
    }

    /**
     * return a reference to the data in Float32 format
     * @ignore
     */
    toFloat32(begin, end) {
        if (typeof end !== "undefined") {
            return this.bufferF32.subarray(begin, end);
        } else {
            return this.bufferF32;
        }
    }

    /**
     * return a reference to the data in Uint32 format
     * @ignore
     */
    toUint32(begin, end) {
        if (typeof end !== "undefined") {
            return this.bufferU32.subarray(begin, end);
        } else {
            return this.bufferU32;
        }
    }

    /**
     * return the size of the vertex in vertex
     * @ignore
     */
    length() {
        return this.vertexCount;
    }

    /**
     * return true if empty
     * @ignore
     */
    isEmpty() {
        return this.vertexCount === 0;
    }

};

export default VertexArrayBuffer;
