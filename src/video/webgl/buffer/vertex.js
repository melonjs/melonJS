/**
 * @classdesc
 * a Vertex Buffer object
 * @class VertexArrayBuffer
 * @private
 */

class VertexArrayBuffer {

    constructor(vertex_size, vertex_per_quad) {
        // the size of one vertex
        this.vertexSize = vertex_size;
        // size of a quad in vertex
        this.quadSize = vertex_per_quad;
        // the maximum number of vertices the vertex array buffer can hold
        this.maxVertex = 256;
        // the current number of vertices added to the vertex array buffer
        this.vertexCount = 0;

        // the actual vertex data buffer
        this.buffer = new Float32Array(this.maxVertex * this.vertexSize * this.quadSize);
        // a Uint8 view of the vertex data array buffer
        this.bytes = new Uint8Array(this.buffer);

        return this;
    }

    /**
     * clear the vertex array buffer
     */
    clear() {
        this.vertexCount = 0;
    }

    /**
     * return true if full
     */
    isFull(vertex = 0) {
         return (this.vertexCount + vertex >= this.maxVertex);
    }

    /**
     * resize the vertex buffer, retaining its original contents
     */
    resize() {
        this.maxVertex <<= 1;
        var data = new Float32Array(this.maxVertex * this.vertexSize * this.quadSize);
        data.set(this.buffer);
        this.buffer = data;
        this.bytes = new Uint8Array(this.buffer);
        return this;
    }

    /**
     * push a new vertex to the buffer
     */
    push(x, y, u, v, tint) {
        var buffer = this.buffer;
        var offset = this.vertexCount * this.vertexSize;

        if (this.vertexCount >= this.maxVertex) {
            this.resize();
        }

        buffer[offset + 0] = x;
        buffer[offset + 1] = y;

        if (typeof u !== "undefined") {
            buffer[offset + 2] = u;
            buffer[offset + 3] = v;
        }

        if (typeof tint !== "undefined") {
            buffer[offset + 4] = tint[0];
            buffer[offset + 5] = tint[1];
            buffer[offset + 6] = tint[2];
            buffer[offset + 7] = tint[3];
        }

        this.vertexCount++;

        return this;
    }

    /**
     * return a reference to the data in Float32 format
     */
    toFloat32(begin, end) {
        if (typeof end !== "undefined") {
            return this.buffer.subarray(begin, end);
        } else {
            return this.buffer;
        }
    }

    /**
     * return a reference to the data in Uint8 format
     */
    toUint8(begin, end) {
        if (typeof end !== "undefined") {
            return this.bytes.subarray(begin, end);
        } else {
            return this.bytes;
        }
    }

    /**
     * return the size of the vertex in vertex
     */
    length() {
        return this.vertexCount;
    }

    /**
     * return true if empty
     */
    isEmpty() {
        return this.vertexCount === 0;
    }

};

export default VertexArrayBuffer;
