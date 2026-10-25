import { FRAME_UNBOUNDED } from "../gpu/frame.js";

/**
 * A fixed-size vertex array buffer for batching vertex data.
 * Renderer-agnostic — stores vertex data in typed arrays (Float32/Uint32).
 * Batchers must check isFull() and flush before the buffer overflows.
 * @ignore
 * @internal
 */
export default class VertexArrayBuffer {
	constructor(vertexSize, maxVertex) {
		// the size of one vertex in floats
		this.vertexSize = vertexSize;
		// the maximum number of vertices the vertex array buffer can hold
		this.maxVertex = maxVertex;
		// the current number of vertices added to the vertex array buffer
		this.vertexCount = 0;

		// the actual vertex data buffer
		this.buffer = new ArrayBuffer(
			this.maxVertex * this.vertexSize * Float32Array.BYTES_PER_ELEMENT,
		);
		// Float32 and Uint32 view of the vertex data array buffer
		this.bufferF32 = new Float32Array(this.buffer);
		this.bufferU32 = new Uint32Array(this.buffer);
		// Byte view used only for `gl.bufferData` UPLOADS via
		// `toUint8()` — bypasses NaN canonicalization that some drivers
		// (notably Apple's Metal-backed ANGLE) perform when the same
		// 4-byte slot is uploaded through a `Float32Array` view and
		// happens to form a NaN bit pattern (`A=0xFF` AND `R≥0x80`,
		// which covers most non-faded MTL diffuse colors). NOT used
		// for writing packed colors into the buffer — `bufferU32[i] =
		// tint` is byte-identical (V8 doesn't canonicalize at the
		// typed-array write site) and cheaper (one store vs four).
		this.bufferU8 = new Uint8Array(this.buffer);
	}

	/**
	 * clear the vertex array buffer
	 * @ignore
	 * @internal
	 */
	clear() {
		this.vertexCount = 0;
	}

	/**
	 * return true if full
	 * @ignore
	 * @internal
	 */
	isFull(vertex) {
		return this.vertexCount + vertex >= this.maxVertex;
	}

	/**
	 * push a new vertex to the buffer: the 6-float layout of the primitive
	 * batcher (a shape's position, its normal or UV, and a packed color).
	 * Sprites have their own, wider layout: see {@link pushSprite}.
	 * @param {number} x - x position
	 * @param {number} y - y position
	 * @param {number} z - z position (per-renderable depth; 0 under ortho)
	 * @param {number} u - texture U coordinate (or aNormal.x for primitives)
	 * @param {number} v - texture V coordinate (or aNormal.y for primitives)
	 * @param {number} tint - tint color in UINT32 (argb) format
	 * @returns {VertexArrayBuffer} this
	 * @ignore
	 * @internal
	 */
	push(x, y, z, u, v, tint) {
		const offset = this.vertexCount * this.vertexSize;

		this.bufferF32[offset] = x;
		this.bufferF32[offset + 1] = y;
		this.bufferF32[offset + 2] = z;
		this.bufferF32[offset + 3] = u;
		this.bufferF32[offset + 4] = v;
		this.bufferU32[offset + 5] = tint;

		this.vertexCount++;

		return this;
	}

	/**
	 * push a sprite vertex: the quad batchers' layout, whose fifth attribute
	 * (floats 7 and 8, after the texture slot) is the UV of the quad's
	 * opposite corner. With the vertex's own UV, that is the frame of the
	 * texture the quad draws, so the sprite shaders can keep their samples
	 * inside it ({@link FRAME_UNBOUNDED} for a quad that has none). It sits
	 * at the same place in every sprite layout, so an effect's program reads
	 * it on any of them. Any field a layout adds after it (a lit layout's
	 * normal map slot and shininess) goes in `extra0` and `extra1`, in
	 * layout order. Every field is written as given, so a caller passes all
	 * of its layout's: the lit batchers write `-1` for "no normal map" and
	 * `0` for a matte sprite themselves.
	 * @param {number} x - x position
	 * @param {number} y - y position
	 * @param {number} z - depth
	 * @param {number} u - texture u
	 * @param {number} v - texture v
	 * @param {number} tint - tint color in UINT32 (argb) format
	 * @param {number} textureId - the texture slot
	 * @param {number} frameU - u of the quad's opposite corner
	 * @param {number} frameV - v of the quad's opposite corner
	 * @param {number} [extra0] - the layout's first field after the slot
	 * @param {number} [extra1] - the layout's second field after the slot
	 * @returns {VertexArrayBuffer} this
	 * @ignore
	 * @internal
	 */
	pushSprite(x, y, z, u, v, tint, textureId, frameU, frameV, extra0, extra1) {
		const size = this.vertexSize;
		const offset = this.vertexCount * size;
		const f32 = this.bufferF32;

		f32[offset] = x;
		f32[offset + 1] = y;
		f32[offset + 2] = z;
		f32[offset + 3] = u;
		f32[offset + 4] = v;
		this.bufferU32[offset + 5] = tint;
		f32[offset + 6] = textureId;
		f32[offset + 7] = frameU;
		f32[offset + 8] = frameV;
		if (size > 9) {
			f32[offset + 9] = extra0;
			if (size > 10) {
				f32[offset + 10] = extra1;
			}
		}

		this.vertexCount++;

		return this;
	}

	/**
	 * push the four corners of a sprite quad (see {@link pushSprite}):
	 * top left, top right, bottom left, bottom right, each carrying the UV
	 * of the corner opposite it. A quad with no frame of its own (a
	 * repeating pattern, a whole render target) carries the unbounded mark
	 * instead, and its samples are left alone.
	 * @param {{x: number, y: number, z: number}} c0 - top left corner
	 * @param {{x: number, y: number, z: number}} c1 - top right corner
	 * @param {{x: number, y: number, z: number}} c2 - bottom left corner
	 * @param {{x: number, y: number, z: number}} c3 - bottom right corner
	 * @param {number} u0 - left u
	 * @param {number} v0 - top v
	 * @param {number} u1 - right u
	 * @param {number} v1 - bottom v
	 * @param {number} tint - tint color in UINT32 (argb) format
	 * @param {number} textureId - the texture slot
	 * @param {boolean} framed - false when the quad has no frame to keep to
	 * @param {number} [extra0] - the layout's first field after the slot
	 * @param {number} [extra1] - the layout's second field after the slot
	 * @returns {VertexArrayBuffer} this
	 * @ignore
	 * @internal
	 */
	pushSpriteQuad(
		c0,
		c1,
		c2,
		c3,
		u0,
		v0,
		u1,
		v1,
		tint,
		textureId,
		framed,
		extra0,
		extra1,
	) {
		const fu0 = framed ? u0 : FRAME_UNBOUNDED;
		const fv0 = framed ? v0 : FRAME_UNBOUNDED;
		const fu1 = framed ? u1 : FRAME_UNBOUNDED;
		const fv1 = framed ? v1 : FRAME_UNBOUNDED;
		this.pushSprite(
			c0.x,
			c0.y,
			c0.z,
			u0,
			v0,
			tint,
			textureId,
			fu1,
			fv1,
			extra0,
			extra1,
		);
		this.pushSprite(
			c1.x,
			c1.y,
			c1.z,
			u1,
			v0,
			tint,
			textureId,
			fu0,
			fv1,
			extra0,
			extra1,
		);
		this.pushSprite(
			c2.x,
			c2.y,
			c2.z,
			u0,
			v1,
			tint,
			textureId,
			fu1,
			fv0,
			extra0,
			extra1,
		);
		this.pushSprite(
			c3.x,
			c3.y,
			c3.z,
			u1,
			v1,
			tint,
			textureId,
			fu0,
			fv0,
			extra0,
			extra1,
		);
		return this;
	}

	/**
	 * push a new vertex with all-float data to the buffer
	 * @param {ArrayLike<number>} data - float values for one vertex
	 * @param {number} srcOffset - start index in the source data
	 * @param {number} count - number of floats to copy (should equal vertexSize)
	 * @ignore
	 * @internal
	 */
	pushFloats(data, srcOffset, count) {
		const offset = this.vertexCount * this.vertexSize;

		for (let i = 0; i < count; i++) {
			this.bufferF32[offset + i] = data[srcOffset + i];
		}

		this.vertexCount++;

		return this;
	}

	/**
	 * push a new vertex to the buffer (mesh format: x, y, z, u, v, tint).
	 * Color is unpacked from the ARGB Uint32 input into 4 normalized
	 * `[0, 1]` floats — the mesh batcher's `aColor` attribute is
	 * `FLOAT × 4` rather than `UNSIGNED_BYTE × 4` to avoid NaN-pattern
	 * bit values getting canonicalized on Metal-backed WebGL drivers.
	 * See `mesh_batcher.init` for the rationale.
	 * @ignore
	 * @internal
	 */
	pushMesh(x, y, z, u, v, tint) {
		const offset = this.vertexCount * this.vertexSize;

		this.bufferF32[offset] = x;
		this.bufferF32[offset + 1] = y;
		this.bufferF32[offset + 2] = z;
		this.bufferF32[offset + 3] = u;
		this.bufferF32[offset + 4] = v;
		this.bufferF32[offset + 5] = ((tint >> 16) & 0xff) / 255; // R
		this.bufferF32[offset + 6] = ((tint >> 8) & 0xff) / 255; // G
		this.bufferF32[offset + 7] = (tint & 0xff) / 255; // B
		this.bufferF32[offset + 8] = ((tint >>> 24) & 0xff) / 255; // A

		this.vertexCount++;

		return this;
	}

	/**
	 * push a new lit-mesh vertex (mesh format + a world-space normal):
	 * x, y, z, u, v, tint, nx, ny, nz. Used by the lit mesh batcher, whose
	 * vertex layout is 12 floats (the 9 of {@link pushMesh} plus `aNormal`).
	 * @ignore
	 * @internal
	 */
	pushMeshLit(x, y, z, u, v, tint, nx, ny, nz) {
		const offset = this.vertexCount * this.vertexSize;

		this.bufferF32[offset] = x;
		this.bufferF32[offset + 1] = y;
		this.bufferF32[offset + 2] = z;
		this.bufferF32[offset + 3] = u;
		this.bufferF32[offset + 4] = v;
		this.bufferF32[offset + 5] = ((tint >> 16) & 0xff) / 255; // R
		this.bufferF32[offset + 6] = ((tint >> 8) & 0xff) / 255; // G
		this.bufferF32[offset + 7] = (tint & 0xff) / 255; // B
		this.bufferF32[offset + 8] = ((tint >>> 24) & 0xff) / 255; // A
		// world-space normal (aNormal)
		this.bufferF32[offset + 9] = nx;
		this.bufferF32[offset + 10] = ny;
		this.bufferF32[offset + 11] = nz;

		this.vertexCount++;

		return this;
	}

	/**
	 * return a reference to the data in Float32 format
	 * @ignore
	 * @internal
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
	 * @internal
	 */
	toUint32(begin, end) {
		if (typeof end !== "undefined") {
			return this.bufferU32.subarray(begin, end);
		} else {
			return this.bufferU32;
		}
	}

	/**
	 * return a byte-view reference to the data — use this for `gl.bufferData`
	 * uploads to avoid the NaN-canonicalization that some drivers perform
	 * on Float32 uploads of the same backing buffer (see the constructor's
	 * `bufferU8` comment).
	 * @ignore
	 * @internal
	 */
	toUint8(byteBegin, byteEnd) {
		if (typeof byteEnd !== "undefined") {
			return this.bufferU8.subarray(byteBegin, byteEnd);
		} else {
			return this.bufferU8;
		}
	}
}
