import { objList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

// OBJ line type identifiers
const VERTEX_PREFIX = "v";
const TEXCOORD_PREFIX = "vt";
const FACE_PREFIX = "f";
const COMMENT_CHAR = "#";
const SLASH_CHAR = "/";

// vertex map key multiplier: pack v and vt into a single numeric key
// supports up to Number.MAX_SAFE_INTEGER / VT_KEY_MULTIPLIER unique positions
const VT_KEY_MULTIPLIER = 1048576;

// stride constants for position (x,y,z) and texcoord (u,v) arrays
const POS_STRIDE = 3;
const UV_STRIDE = 2;

// sentinel for missing UV index
const NO_UV = -1;

// OBJ indices are 1-based
const OBJ_INDEX_OFFSET = 1;

/**
 * Parse a Wavefront OBJ file into geometry data.
 * Supports: `v` (vertex positions), `vt` (texture coordinates),
 * `f` (faces in `v`, `v/vt`, `v/vt/vn`, or `v//vn` format),
 * `mtllib` (material library reference).
 *
 * Features:
 * - Quad and n-gon triangulation (fan from first vertex)
 * - Automatic CW → CCW winding correction via signed volume test
 * - V texture coordinate flipped for OpenGL convention (OBJ has origin at bottom-left)
 * - Single-pass parsing with direct vertex unification (no intermediate arrays)
 *
 * Parsed but ignored: `vn` (normals), `g` (groups), `usemtl` (material assignment),
 * `s` (smooth shading), `o` (object name).
 *
 * @param {string} text - raw OBJ file contents
 * @returns {object} parsed geometry with `vertices` (Float32Array), `uvs` (Float32Array),
 *   `indices` (Uint16Array), `vertexCount` (number), and `mtllib` (string|null)
 * @ignore
 */
function parseOBJ(text) {
	const positions = [];
	const texcoords = [];

	// unified output arrays (built in a single pass)
	const vertexMap = new Map();
	const vertices = [];
	const uvs = [];
	const indices = [];
	let vertexCount = 0;

	// helper: look up or create a unified vertex for a v/vt pair
	function addVertex(v, vt) {
		const key = v * VT_KEY_MULTIPLIER + (vt + OBJ_INDEX_OFFSET);
		let index = vertexMap.get(key);
		if (index === undefined) {
			index = vertexCount++;
			vertexMap.set(key, index);
			const v3 = v * POS_STRIDE;
			vertices.push(positions[v3], positions[v3 + 1], positions[v3 + 2]);
			if (vt >= 0) {
				const vt2 = vt * UV_STRIDE;
				uvs.push(texcoords[vt2], texcoords[vt2 + 1]);
			} else {
				uvs.push(0, 0);
			}
		}
		return index;
	}

	/**
	 * parse a face vertex component (e.g. "1/2/3" or "1//3" or "1")
	 * and return the UV index, or NO_UV if not present
	 * @param {string} part - face vertex string
	 * @returns {number} UV index (0-based) or NO_UV
	 * @ignore
	 */
	function parseUVIndex(part, slashIdx) {
		if (slashIdx !== -1 && part[slashIdx + 1] !== SLASH_CHAR) {
			return parseInt(part.substring(slashIdx + 1), 10) - OBJ_INDEX_OFFSET;
		}
		return NO_UV;
	}

	// mtllib reference (if present)
	let mtllib = null;

	// parse lines and build geometry in a single pass
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.length === 0 || line[0] === COMMENT_CHAR) {
			continue;
		}

		const first = line[0];
		if (first === "m" && line.startsWith("mtllib ")) {
			mtllib = line.substring(7).trim();
			continue;
		}
		if (first === VERTEX_PREFIX) {
			const parts = line.split(/\s+/);
			if (parts[0] === VERTEX_PREFIX) {
				positions.push(
					parseFloat(parts[1]),
					parseFloat(parts[2]),
					parseFloat(parts[3]),
				);
			} else if (parts[0] === TEXCOORD_PREFIX) {
				texcoords.push(parseFloat(parts[1]), 1.0 - parseFloat(parts[2]));
			}
		} else if (first === FACE_PREFIX) {
			const parts = line.split(/\s+/);

			// first vertex of the fan
			let slashIdx = parts[1].indexOf(SLASH_CHAR);
			const v0 = parseInt(parts[1], 10) - OBJ_INDEX_OFFSET;
			const vt0 = parseUVIndex(parts[1], slashIdx);
			const idx0 = addVertex(v0, vt0);

			let prevIdx = -1;
			for (let j = 2; j < parts.length; j++) {
				slashIdx = parts[j].indexOf(SLASH_CHAR);
				const v = parseInt(parts[j], 10) - OBJ_INDEX_OFFSET;
				const vt = parseUVIndex(parts[j], slashIdx);
				const idx = addVertex(v, vt);

				if (prevIdx !== -1) {
					indices.push(idx0, prevIdx, idx);
				}
				prevIdx = idx;
			}
		}
	}

	// winding order check using signed volume
	// positive = CCW (outward normals), negative = CW (inward normals)
	let signedVolume = 0;
	for (let i = 0; i < indices.length; i += 3) {
		const i0 = indices[i] * 3;
		const i1 = indices[i + 1] * 3;
		const i2 = indices[i + 2] * 3;
		// signed volume contribution of this triangle
		signedVolume +=
			vertices[i0] *
				(vertices[i1 + 1] * vertices[i2 + 2] -
					vertices[i1 + 2] * vertices[i2 + 1]) +
			vertices[i0 + 1] *
				(vertices[i1 + 2] * vertices[i2] - vertices[i1] * vertices[i2 + 2]) +
			vertices[i0 + 2] *
				(vertices[i1] * vertices[i2 + 1] - vertices[i1 + 1] * vertices[i2]);
	}

	if (signedVolume < 0) {
		// CW winding detected — flip all triangles to CCW
		for (let i = 0; i < indices.length; i += 3) {
			const tmp = indices[i + 1];
			indices[i + 1] = indices[i + 2];
			indices[i + 2] = tmp;
		}
	}

	return {
		vertices: new Float32Array(vertices),
		uvs: new Float32Array(uvs),
		indices: new Uint16Array(indices),
		vertexCount,
		mtllib,
	};
}

/**
 * parse/preload a Wavefront OBJ file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadOBJ(data, onload, onerror, settings) {
	if (typeof objList[data.name] !== "undefined") {
		// already loaded
		return 0;
	}

	fetchData(data.src, "text", settings)
		.then((response) => {
			objList[data.name] = parseOBJ(response);
			if (typeof onload === "function") {
				onload();
			}
		})
		.catch((error) => {
			if (typeof onerror === "function") {
				onerror(error);
			}
		});

	return 1;
}
