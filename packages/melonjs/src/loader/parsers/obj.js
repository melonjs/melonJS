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
// OBJ vertex-normal line prefix
const NORMAL_PREFIX = "vn";

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
 *   a single group with `materialName: null`.
 *
 * `vn` (vertex normals) are consumed: a face referencing them
 * (`v//vn` or `v/vt/vn`) produces unified vertices carrying the authored
 * normal, so an OBJ model lights under `Light3d` exactly as the same model
 * imported from glTF does. A file with no `vn` gets normals GENERATED from
 * face geometry (accumulated and normalized, i.e. smooth) after the winding
 * correction below, so the result is consistent with the final triangle
 * orientation rather than the authored one.
 *
 * Parsed but ignored: `g` (groups), `s` (smooth shading — generated normals
 * are smooth across the whole mesh, so a model relying on hard edges from
 * smoothing groups will read softer than authored),
 * `o` (object name).
 *
 * @param {string} text - raw OBJ file contents
 * @returns {object} parsed geometry with `vertices` (Float32Array),
 *   `uvs` (Float32Array), `indices` (Uint16Array), `vertexCount` (number),
 *   `mtllib` (string|null), and `groups`
 *   (Array<{materialName: string|null, start: number, count: number}>).
 *   `groups` follows the glTF convention — each entry is a
 *   contiguous slice of the shared `indices` buffer that draws as one
 *   submesh against a single material. Single-material models still
 *   produce a `groups` array of length 1, so consumers don't need a
 *   special case.
 * @ignore
 */
export function parseOBJ(text) {
	const positions = [];
	const texcoords = [];
	const sourceNormals = [];

	// unified output arrays (built in a single pass)
	const vertices = [];
	const uvs = [];
	const normals = [];
	const indices = [];
	let vertexCount = 0;

	// Per-material vertex dedup: each material name owns its own
	// `vertexMap`, so the same (v, vt) reused across different
	// materials produces SEPARATE unified vertices (needed for
	// per-vertex color baking in `Mesh`), but the same material
	// reappearing in a later `usemtl` block re-uses its existing
	// vertex slots. Pre-usemtl faces use the `null` map (the
	// "anonymous" group).
	const materialMaps = new Map();
	materialMaps.set(null, new Map());
	let vertexMap = materialMaps.get(null);

	// helper: look up or create a unified vertex for a v/vt pair in the
	// current material's dedup scope
	function addVertex(v, vt, vn) {
		// The dedup key gains the normal index only when the file supplies
		// normals: two faces sharing a position/UV but referencing DIFFERENT
		// normals (a hard edge) must become separate vertices, or the edge
		// smooths itself away. A string key is used in that case rather than
		// packing a third component into the numeric one — `v * M²` overflows
		// Number.MAX_SAFE_INTEGER well before the position count does.
		const key =
			vn >= 0
				? `${v}|${vt}|${vn}`
				: v * VT_KEY_MULTIPLIER + (vt + OBJ_INDEX_OFFSET);
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
			if (vn >= 0) {
				const vn3 = vn * POS_STRIDE;
				normals.push(
					sourceNormals[vn3],
					sourceNormals[vn3 + 1],
					sourceNormals[vn3 + 2],
				);
			} else {
				// filled in by the generation pass when the file had none
				normals.push(0, 0, 0);
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
	function parseNormalIndex(part, slashIdx) {
		if (slashIdx === -1) {
			return NO_UV;
		}
		const second = part.indexOf(SLASH_CHAR, slashIdx + 1);
		if (second === -1) {
			return NO_UV;
		}
		return parseInt(part.substring(second + 1), 10) - OBJ_INDEX_OFFSET;
	}

	/**
	 * parse a face vertex component and return the UV index, or NO_UV
	 * @param {string} part - face vertex string
	 * @param {number} slashIdx - index of the first slash
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
	// glTF convention for "name of the material this
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
		// Swap to this material's vertex dedup scope. Vertices shared
		// across materials get separate slots (required for per-vertex
		// color baking in `Mesh`), but vertices reused within the same
		// material — even across non-contiguous `usemtl` blocks — hit
		// the cache and don't get duplicated. Lazily allocated per
		// material name on first switch.
		let cached = materialMaps.get(materialName);
		if (cached === undefined) {
			cached = new Map();
			materialMaps.set(materialName, cached);
		}
		vertexMap = cached;
	};

	// parse lines and build geometry in a single pass
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.length === 0 || line[0] === COMMENT_CHAR) {
			continue;
		}

		const first = line[0];
		// tokenize once for keyword + argument lookup. The v/vt/f
		// paths below also split on `\s+`, so this is just hoisting
		// the same parse — handles tabs and multiple-space separators
		// consistently across every line type.
		if (first === "m" || first === "u") {
			const parts = line.split(/\s+/);
			if (parts[0] === "mtllib") {
				mtllib = parts.slice(1).join(" ");
				continue;
			}
			if (parts[0] === "usemtl") {
				startGroup(parts.slice(1).join(" "));
				continue;
			}
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
			} else if (parts[0] === NORMAL_PREFIX) {
				// stored raw: the Y/Z axis bridge is applied at draw through
				// the model matrix (`mat3(uModelMatrix) * aNormal`), exactly
				// as it is for glTF normals — flipping here would double it
				sourceNormals.push(
					parseFloat(parts[1]),
					parseFloat(parts[2]),
					parseFloat(parts[3]),
				);
			}
		} else if (first === FACE_PREFIX) {
			const parts = line.split(/\s+/);

			// first vertex of the fan
			let slashIdx = parts[1].indexOf(SLASH_CHAR);
			const v0 = parseInt(parts[1], 10) - OBJ_INDEX_OFFSET;
			const vt0 = parseUVIndex(parts[1], slashIdx);
			const vn0 = parseNormalIndex(parts[1], slashIdx);
			const idx0 = addVertex(v0, vt0, vn0);

			let prevIdx = -1;
			for (let j = 2; j < parts.length; j++) {
				slashIdx = parts[j].indexOf(SLASH_CHAR);
				const v = parseInt(parts[j], 10) - OBJ_INDEX_OFFSET;
				const vt = parseUVIndex(parts[j], slashIdx);
				const vn = parseNormalIndex(parts[j], slashIdx);
				const idx = addVertex(v, vt, vn);

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

	// Generate normals when the file supplied none. Deliberately AFTER the
	// winding correction above: face normals follow triangle orientation, so
	// generating first would point them inward on a CW-wound model — the
	// exact case that correction exists to fix.
	if (sourceNormals.length === 0 && vertexCount > 0) {
		for (let i = 0; i < indices.length; i += 3) {
			const a = indices[i] * 3;
			const b = indices[i + 1] * 3;
			const c = indices[i + 2] * 3;
			const ux = vertices[b] - vertices[a];
			const uy = vertices[b + 1] - vertices[a + 1];
			const uz = vertices[b + 2] - vertices[a + 2];
			const wx = vertices[c] - vertices[a];
			const wy = vertices[c + 1] - vertices[a + 1];
			const wz = vertices[c + 2] - vertices[a + 2];
			// unnormalized cross product — its length is twice the triangle
			// area, which area-weights the accumulation for free
			const nx = uy * wz - uz * wy;
			const ny = uz * wx - ux * wz;
			const nz = ux * wy - uy * wx;
			for (const at of [a, b, c]) {
				normals[at] += nx;
				normals[at + 1] += ny;
				normals[at + 2] += nz;
			}
		}
		for (let i = 0; i < normals.length; i += 3) {
			const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
			if (length > 0) {
				normals[i] /= length;
				normals[i + 1] /= length;
				normals[i + 2] /= length;
			} else {
				// a vertex referenced by no triangle (or by degenerate ones):
				// leave a valid unit normal rather than a zero vector, which
				// would normalize to NaN in the shader
				normals[i + 1] = 1;
			}
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
		normals: new Float32Array(normals),
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
