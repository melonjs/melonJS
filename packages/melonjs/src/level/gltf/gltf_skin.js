/**
 * Vertex skinning for glTF skins. Pure, engine-free helpers so the math can be
 * unit-tested in isolation from the renderer.
 *
 * A glTF skin binds a mesh to a set of joint nodes. Each vertex names up to
 * four of those joints (`JOINTS_0`) with a weight each (`WEIGHTS_0`), and is
 * placed by the weighted sum of its joints' **joint matrices**:
 *
 *     jointMatrix[j] = inverse(placement) · jointWorld[j] · inverseBind[j]
 *
 * The `inverse(placement)` term expresses the skinned result in the space the
 * part is drawn in — `GLTFModel` uses the model's own placement — so placing
 * the part puts it back exactly where the joints are. The skinned mesh's own
 * node transform plays no part, as the glTF spec requires.
 *
 * Skinning runs on the CPU, writing into the mesh's `originalVertices` /
 * `originalNormals`: it therefore works identically on WebGL, WebGPU and the
 * Canvas fallback, at the cost of one pass over the vertices per posed frame.
 * @ignore
 * @internal
 */

/**
 * Invert a column-major 4x4 matrix into `out` (general inverse, cofactor
 * expansion). `out` must not alias `m`.
 * @param {number[]|Float32Array|Float64Array} out - 16-element destination
 * @param {ArrayLike<number>} m - 16-element source
 * @returns {boolean} false (and `out` untouched) when `m` is singular
 * @ignore
 * @internal
 */
export function invertMatrixInto(out, m) {
	const a00 = m[0];
	const a01 = m[1];
	const a02 = m[2];
	const a03 = m[3];
	const a10 = m[4];
	const a11 = m[5];
	const a12 = m[6];
	const a13 = m[7];
	const a20 = m[8];
	const a21 = m[9];
	const a22 = m[10];
	const a23 = m[11];
	const a30 = m[12];
	const a31 = m[13];
	const a32 = m[14];
	const a33 = m[15];

	const b00 = a00 * a11 - a01 * a10;
	const b01 = a00 * a12 - a02 * a10;
	const b02 = a00 * a13 - a03 * a10;
	const b03 = a01 * a12 - a02 * a11;
	const b04 = a01 * a13 - a03 * a11;
	const b05 = a02 * a13 - a03 * a12;
	const b06 = a20 * a31 - a21 * a30;
	const b07 = a20 * a32 - a22 * a30;
	const b08 = a20 * a33 - a23 * a30;
	const b09 = a21 * a32 - a22 * a31;
	const b10 = a21 * a33 - a23 * a31;
	const b11 = a22 * a33 - a23 * a32;

	let det =
		b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	if (det === 0 || !Number.isFinite(det)) {
		return false;
	}
	det = 1 / det;

	out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
	out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
	out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
	out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
	out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
	out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
	out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
	return true;
}

// scratch for one joint's `inverse(meshWorld) · jointWorld`
const _jw = new Float64Array(16);

/**
 * `out = a · b` for column-major 4x4 matrices, reading `b` at an offset (the
 * inverse bind matrices are packed back to back) and writing `out` at one.
 * @ignore
 * @internal
 */
function multiplyAt(out, outOffset, a, b, bOffset) {
	for (let col = 0; col < 4; col++) {
		const b0 = b[bOffset + col * 4];
		const b1 = b[bOffset + col * 4 + 1];
		const b2 = b[bOffset + col * 4 + 2];
		const b3 = b[bOffset + col * 4 + 3];
		for (let row = 0; row < 4; row++) {
			out[outOffset + col * 4 + row] =
				a[row] * b0 + a[4 + row] * b1 + a[8 + row] * b2 + a[12 + row] * b3;
		}
	}
}

/**
 * Compute every joint matrix of a skin, packed back to back into `out`.
 * @param {Float32Array|Float64Array} out - destination, `16 × skin.joints.length` long
 * @param {{joints: number[], inverseBindMatrices: Float32Array}} skin - a parsed skin
 * @param {function(number): (ArrayLike<number>|undefined)} worldOf - a joint node's current world matrix (`undefined` reads as identity)
 * @param {ArrayLike<number>} meshWorldInverse - the inverse of the matrix the skinned part is placed with
 * @returns {Float32Array|Float64Array} `out`
 * @ignore
 * @internal
 */
export function computeJointMatrices(out, skin, worldOf, meshWorldInverse) {
	const joints = skin.joints;
	const ibm = skin.inverseBindMatrices;
	for (let j = 0; j < joints.length; j++) {
		const world = worldOf(joints[j]);
		if (world === undefined) {
			// a joint outside the scene's node tree never moves, so it stays at
			// its bind pose, jointWorld = inverse(IBM): the IBM cancels and the
			// joint matrix is inverse(meshWorld) alone
			for (let i = 0; i < 16; i++) {
				out[j * 16 + i] = meshWorldInverse[i];
			}
			continue;
		}
		// _jw = inverse(meshWorld) · jointWorld
		for (let col = 0; col < 4; col++) {
			const b0 = world[col * 4];
			const b1 = world[col * 4 + 1];
			const b2 = world[col * 4 + 2];
			const b3 = world[col * 4 + 3];
			for (let row = 0; row < 4; row++) {
				_jw[col * 4 + row] =
					meshWorldInverse[row] * b0 +
					meshWorldInverse[4 + row] * b1 +
					meshWorldInverse[8 + row] * b2 +
					meshWorldInverse[12 + row] * b3;
			}
		}
		multiplyAt(out, j * 16, _jw, ibm, j * 16);
	}
	return out;
}

/**
 * Deform bind-pose positions (and normals) by a skin's joint matrices.
 *
 * Each vertex is the weighted sum of its (up to four) joints' transforms of
 * the bind-pose vertex; each normal the weighted sum of the joints' 3x3 parts,
 * renormalized. Weights are used as given — {@link normalizeSkinWeights}
 * prepares them at load.
 * @param {Float32Array} bindPositions - bind-pose x,y,z triplets
 * @param {Float32Array|undefined} bindNormals - bind-pose normals, or undefined
 * @param {Uint16Array} joints - 4 joint indices (into the skin's joint list) per vertex
 * @param {Float32Array} weights - 4 weights per vertex
 * @param {Float32Array|Float64Array} jointMatrices - from {@link computeJointMatrices}
 * @param {number} vertexCount - number of vertices
 * @param {Float32Array} outPositions - deformed positions (may not alias `bindPositions`)
 * @param {Float32Array} [outNormals] - deformed normals (may not alias `bindNormals`)
 * @ignore
 * @internal
 */
export function skinVertices(
	bindPositions,
	bindNormals,
	joints,
	weights,
	jointMatrices,
	vertexCount,
	outPositions,
	outNormals,
) {
	const m = jointMatrices;
	const doNormals = bindNormals !== undefined && outNormals !== undefined;
	for (let v = 0; v < vertexCount; v++) {
		const p = v * 3;
		const k = v * 4;
		const x = bindPositions[p];
		const y = bindPositions[p + 1];
		const z = bindPositions[p + 2];
		let ox = 0;
		let oy = 0;
		let oz = 0;
		let nx = 0;
		let ny = 0;
		let nz = 0;
		const ix = doNormals ? bindNormals[p] : 0;
		const iy = doNormals ? bindNormals[p + 1] : 0;
		const iz = doNormals ? bindNormals[p + 2] : 0;
		for (let i = 0; i < 4; i++) {
			const w = weights[k + i];
			if (w === 0) {
				continue;
			}
			const o = joints[k + i] * 16;
			ox += w * (m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12]);
			oy += w * (m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13]);
			oz += w * (m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14]);
			if (doNormals) {
				nx += w * (m[o] * ix + m[o + 4] * iy + m[o + 8] * iz);
				ny += w * (m[o + 1] * ix + m[o + 5] * iy + m[o + 9] * iz);
				nz += w * (m[o + 2] * ix + m[o + 6] * iy + m[o + 10] * iz);
			}
		}
		outPositions[p] = ox;
		outPositions[p + 1] = oy;
		outPositions[p + 2] = oz;
		if (doNormals) {
			const len = Math.hypot(nx, ny, nz);
			if (len > 1e-8) {
				outNormals[p] = nx / len;
				outNormals[p + 1] = ny / len;
				outNormals[p + 2] = nz / len;
			} else {
				outNormals[p] = ix;
				outNormals[p + 1] = iy;
				outNormals[p + 2] = iz;
			}
		}
	}
}

/**
 * Turn a raw `WEIGHTS_0` accessor into float weights that sum to 1.
 *
 * glTF allows the weights as floats or as normalized unsigned bytes / shorts,
 * and exporters do not always make them sum to exactly 1, which would shrink or
 * grow the vertex. A vertex whose weights are all zero is bound fully to its
 * first joint, rather than collapsing to the origin.
 * @param {ArrayLike<number>} raw - the accessor's raw component values
 * @param {number} componentType - the accessor's glTF componentType
 * @returns {Float32Array} 4 weights per vertex
 * @ignore
 * @internal
 */
export function normalizeSkinWeights(raw, componentType) {
	// 5121 UNSIGNED_BYTE, 5123 UNSIGNED_SHORT (normalized), 5126 FLOAT
	const div = componentType === 5121 ? 255 : componentType === 5123 ? 65535 : 1;
	const out = new Float32Array(raw.length);
	for (let v = 0; v < raw.length; v += 4) {
		const a = raw[v] / div;
		const b = raw[v + 1] / div;
		const c = raw[v + 2] / div;
		const d = raw[v + 3] / div;
		const sum = a + b + c + d;
		if (sum > 0) {
			out[v] = a / sum;
			out[v + 1] = b / sum;
			out[v + 2] = c / sum;
			out[v + 3] = d / sum;
		} else {
			out[v] = 1;
		}
	}
	return out;
}
