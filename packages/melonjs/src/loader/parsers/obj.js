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
 * `mtllib` (material library reference),
 * `usemtl` (material group boundaries — emitted as `groups[]`).
 *
 * Features:
 * - Quad and n-gon triangulation (fan from first vertex)
 * - Automatic CW → CCW winding correction via signed volume test
 * - V texture coordinate flipped for OpenGL convention (OBJ has origin at bottom-left)
 * - Single-pass parsing with direct vertex unification (no intermediate arrays)
 * - Material grouping: each `usemtl` switch emits a new `groups[]` entry
 *   pointing to a slice of the unified `indices` buffer, so callers
 *   (e.g. `Mesh`) can render each group with its own material without
 *   touching the geometry. A model with no `usemtl` directives produces
 *   a single group with `material: null`.
 *
 * Parsed but ignored: `vn` (normals), `g` (groups), `s` (smooth shading),
 * `o` (object name).
 *
 * @param {string} text - raw OBJ file contents
 * @returns {object} parsed geometry with `vertices` (Float32Array),
 *   `uvs` (Float32Array), `indices` (Uint16Array), `vertexCount` (number),
 *   `mtllib` (string|null), and `groups`
 *   (Array<{materialName: string|null, start: number, count: number}>).
 *   `groups` follows the Three.js / glTF convention — each entry is a
 *   contiguous slice of the shared `indices` buffer that draws as one
 *   submesh against a single material. Single-material models still
 *   produce a `groups` array of length 1, so consumers don't need a
 *   special case.
 * @ignore
 */
function parseOBJ(text) {
	const positions = [];
	const texcoords = [];

	// unified output arrays (built in a single pass)
	const vertices = [];
	const uvs = [];
	const indices = [];
	let vertexCount = 0;

	// Per-material vertex dedup: each `usemtl` switch resets the active
	// `vertexMap` so the same (v, vt) reused across different materials
	// produces SEPARATE unified vertices. This is the prerequisite for
	// per-vertex color baking in `Mesh` — without it, a vertex shared
	// between two materials couldn't carry both colors. Pre-usemtl
	// faces use the initial empty map (the "anonymous" group).
	let vertexMap = new Map();

	// helper: look up or create a unified vertex for a v/vt pair in the
	// current material's dedup scope
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

	// Material grouping. Each `usemtl` switch closes the running group
	// (recording its index count) and opens a new one. Models without
	// any `usemtl` produce a single group spanning all indices with
	// `materialName: null` — consumers can treat that uniformly with
	// the multi-material path. Field name `materialName` matches the
	// Three.js / glTF convention for "name of the material this
	// submesh wants to be drawn with"; renderers / mesh objects look
	// it up in their own material table.
	const groups = [];
	const startGroup = (materialName) => {
		// close the previous group if it has any indices
		const prev = groups[groups.length - 1];
		if (prev) {
			prev.count = indices.length - prev.start;
		} else if (indices.length > 0) {
			// pre-usemtl indices belong to an anonymous group
			groups.push({
				materialName: null,
				start: 0,
				count: indices.length,
			});
		}
		groups.push({ materialName, start: indices.length, count: 0 });
		// Reset the vertex dedup scope so vertices shared with the
		// previous material get re-added as distinct unified vertices.
		// Required for per-vertex color baking in `Mesh` — each
		// material's vertices need their own slots in the position
		// buffer to carry distinct colors.
		vertexMap = new Map();
	};

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
		if (first === "u" && line.startsWith("usemtl ")) {
			startGroup(line.substring(7).trim());
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

	// finalize the last open group (or, if no `usemtl` was ever seen,
	// emit a single material-less group covering all indices so the
	// `groups[]` contract is always non-empty for non-empty OBJs)
	if (groups.length === 0) {
		if (indices.length > 0) {
			groups.push({ materialName: null, start: 0, count: indices.length });
		}
	} else {
		const last = groups[groups.length - 1];
		last.count = indices.length - last.start;
	}

	return {
		vertices: new Float32Array(vertices),
		uvs: new Float32Array(uvs),
		indices: new Uint16Array(indices),
		vertexCount,
		mtllib,
		groups,
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
