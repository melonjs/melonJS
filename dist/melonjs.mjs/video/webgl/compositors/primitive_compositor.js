/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import primitiveVertex from '../shaders/primitive.vert.js';
import primitiveFragment from '../shaders/primitive.frag.js';
import Compositor from './compositor.js';

/**
 * @classdesc
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @augments Compositor
 */
 class PrimitiveCompositor extends Compositor {

    /**
     * Initialize the compositor
     * @ignore
     */
    init(renderer) {
        super.init(renderer, {
            attributes: [
                {name: "aVertex", size: 2, type: renderer.gl.FLOAT, normalized: false, offset: 0 * Float32Array.BYTES_PER_ELEMENT},
                {name: "aColor",  size: 4, type: renderer.gl.UNSIGNED_BYTE, normalized: true, offset: 2 * Float32Array.BYTES_PER_ELEMENT}
            ],
            shader: {
                vertex: primitiveVertex, fragment: primitiveFragment
            }
        });
    }

    /**
     * Draw an array of vertices
     * @param {GLenum} mode - primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
     * @param {Point[]} verts - an array of vertices
     * @param {number} [vertexCount=verts.length] - amount of points defined in the points array
     */
    drawVertices(mode, verts, vertexCount = verts.length) {
        let viewMatrix = this.viewMatrix;
        let vertexData = this.vertexData;
        let color = this.renderer.currentColor;
        let alpha = this.renderer.getGlobalAlpha();

        if (vertexData.isFull(vertexCount)) {
            // is the vertex buffer full if we add more vertices
            this.flush();
        }

        // flush if drawing vertices with a different drawing mode
        if (mode !== this.mode) {
            this.flush(this.mode);
            this.mode = mode;
        }

        if (!viewMatrix.isIdentity()) {
            verts.forEach((vert) => {
                viewMatrix.apply(vert);
                vertexData.push(vert.x, vert.y, undefined, undefined, color.toUint32(alpha));
            });
        } else {
            verts.forEach((vert) => {
                vertexData.push(vert.x, vert.y, undefined, undefined, color.toUint32(alpha));
            });
        }

        // force flush for primitive using LINE_STRIP or LINE_LOOP
        if (this.mode === this.gl.LINE_STRIP || this.mode === this.gl.LINE_LOOP) {
            this.flush(this.mode);
        }
    }
}

export { PrimitiveCompositor as default };
