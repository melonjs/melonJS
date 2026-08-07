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

// largest unified vertex count a Uint16 index buffer can address
const UINT16_VERTEX_LIMIT = 65536;

/**
 * The unsigned angle between two vectors, in radians. `0` when either is
 * degenerate, so a zero-length edge contributes no weight instead of NaN.
 * @param {number} x1
 * @param {number} y1
 * @param {number} z1
 * @param {number} x2
 * @param {number} y2
 * @param {number} z2
 * @returns {number} the angle in radians
 * @ignore
 */
function angleBetween(x1, y1, z1, x2, y2, z2) {
	const l1 = Math.hypot(x1, y1, z1);
	const l2 = Math.hypot(x2, y2, z2);
	if (l1 === 0 || l2 === 0) {
		return 0;
	}
	// clamped: rounding can push the quotient a hair outside [-1, 1], where
	// acos is NaN
	const cosine = (x1 * x2 + y1 * y2 + z1 * z2) / (l1 * l2);
	return Math.acos(cosine < -1 ? -1 : cosine > 1 ? 1 : cosine);
}

/**
 * Add `weight × (nx, ny, nz)` into an accumulator at a float offset.
 * @param {Float64Array} target - the accumulator
 * @param {number} at - float offset of the entry
 * @param {number} nx
 * @param {number} ny
 * @param {number} nz
 * @param {number} weight
 * @ignore
 */
function addWeighted(target, at, nx, ny, nz, weight) {
	target[at] += nx * weight;
	target[at + 1] += ny * weight;
	target[at + 2] += nz * weight;
}

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
 * imported from glTF does. Every vertex WITHOUT a usable authored normal
 * gets one GENERATED from face geometry — angle-weighted, accumulated per
 * source position and normalized, i.e. smooth across UV and material seams
 * — after the winding correction below, so the result follows the final
 * triangle orientation rather than the authored one. That rule is
 * per-vertex, so a file mixing normalled and un-normalled faces, or one
 * carrying an out-of-range `vn`, still comes out fully normalled.
 *
 * Parsed but ignored: `g` (groups), `s` (smooth shading — generated normals
 * are smooth across the whole mesh, so a model relying on hard edges from
 * smoothing groups will read softer than authored),
 * `o` (object name).
 *
 * @param {string} text - raw OBJ file contents
 * @returns {object} parsed geometry with `vertices` (Float32Array),
 *   `uvs` (Float32Array), `normals` (Float32Array), `indices`
 *   (Uint16Array, widening to Uint32Array past 65 536 vertices),
 *   `vertexCount` (number),
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
	const indices = [];
	let vertexCount = 0;

	// per-unified-vertex provenance, consumed by the normal resolution pass
	// once the whole file has been read: the `vn` this vertex asked for (or
	// NO_NORMAL), and the source position index it was built from
	const vertexNormalIndex = [];
	const vertexPosition = [];

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
			// Normal VALUES are resolved after the whole file is parsed (see
			// the resolution pass below), not here: `vn` may legally be
			// declared after the face referencing it, and an out-of-range
			// index must degrade to "no authored normal" rather than reading
			// past `sourceNormals` and writing NaN. Only the provenance is
			// recorded now — which normal this vertex asked for, and which
			// source POSITION it came from.
			vertexNormalIndex.push(vn);
			vertexPosition.push(v);
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

	// ── normal resolution ────────────────────────────────────────────────
	//
	// Authored `vn` wins wherever one is available; every vertex left over
	// is GENERATED from face geometry. Running per-vertex rather than
	// per-file is what makes a partially-normalled model coherent: a file
	// mixing `f v//vn` and `f v` faces, one that declares `vn` its faces
	// never reference, or one carrying an out-of-range index all end up
	// fully normalled instead of half zero-filled.
	//
	// Deliberately AFTER the winding correction above: generated normals
	// follow triangle orientation, so generating first would point them
	// inward on a CW-wound model — the exact case that correction exists
	// to fix.
	const normals = new Array(vertexCount * POS_STRIDE).fill(0);
	const authored = new Array(vertexCount).fill(false);
	let needsGenerated = false;
	for (let i = 0; i < vertexCount; i++) {
		const vn = vertexNormalIndex[i];
		const vn3 = vn * POS_STRIDE;
		// an index past the end is a malformed file, or a `vn` line that
		// never arrived — treated as "no authored normal" so the generation
		// pass below covers it
		if (vn >= 0 && vn3 + POS_STRIDE <= sourceNormals.length) {
			const at = i * POS_STRIDE;
			normals[at] = sourceNormals[vn3];
			normals[at + 1] = sourceNormals[vn3 + 1];
			normals[at + 2] = sourceNormals[vn3 + 2];
			authored[i] = true;
		} else {
			needsGenerated = true;
		}
	}

	if (needsGenerated === true && vertexCount > 0) {
		// Accumulated per SOURCE POSITION rather than per unified vertex. A
		// position split by a UV seam or a `usemtl` boundary is still one
		// point on the surface, and a generated normal is smooth by
		// definition — accumulating per unified vertex would crease the
		// model along every seam, most visibly at material boundaries.
		//
		// Weighted by the INTERIOR ANGLE at each corner. Area weighting is
		// tempting because the unnormalized cross product already carries
		// twice the area, but it is wrong here: an n-gon arrives
		// fan-triangulated, which hands the fan's pivot corners two
		// triangles' worth of one face and the others only one. A cube built
		// from quads then accumulates (1, 0.5, 0.5) at a corner instead of
		// (1, 1, 1) — 19.5° off, and asymmetric on a symmetric model. Angle
		// weighting is independent of how the polygon happened to be
		// triangulated.
		const accumulated = new Float64Array(positions.length);
		for (let i = 0; i < indices.length; i += 3) {
			const a = vertexPosition[indices[i]] * POS_STRIDE;
			const b = vertexPosition[indices[i + 1]] * POS_STRIDE;
			const c = vertexPosition[indices[i + 2]] * POS_STRIDE;
			const abx = positions[b] - positions[a];
			const aby = positions[b + 1] - positions[a + 1];
			const abz = positions[b + 2] - positions[a + 2];
			const acx = positions[c] - positions[a];
			const acy = positions[c + 1] - positions[a + 1];
			const acz = positions[c + 2] - positions[a + 2];
			let nx = aby * acz - abz * acy;
			let ny = abz * acx - abx * acz;
			let nz = abx * acy - aby * acx;
			const faceLength = Math.hypot(nx, ny, nz);
			if (faceLength === 0) {
				// degenerate (zero-area or collinear) — contributes no
				// direction, and normalizing it would be a division by zero
				continue;
			}
			nx /= faceLength;
			ny /= faceLength;
			nz /= faceLength;
			const bcx = positions[c] - positions[b];
			const bcy = positions[c + 1] - positions[b + 1];
			const bcz = positions[c + 2] - positions[b + 2];
			addWeighted(
				accumulated,
				a,
				nx,
				ny,
				nz,
				angleBetween(abx, aby, abz, acx, acy, acz),
			);
			addWeighted(
				accumulated,
				b,
				nx,
				ny,
				nz,
				angleBetween(-abx, -aby, -abz, bcx, bcy, bcz),
			);
			addWeighted(
				accumulated,
				c,
				nx,
				ny,
				nz,
				angleBetween(-acx, -acy, -acz, -bcx, -bcy, -bcz),
			);
		}
		for (let i = 0; i < vertexCount; i++) {
			if (authored[i] === true) {
				continue;
			}
			const from = vertexPosition[i] * POS_STRIDE;
			const at = i * POS_STRIDE;
			const length = Math.hypot(
				accumulated[from],
				accumulated[from + 1],
				accumulated[from + 2],
			);
			if (length > 0) {
				normals[at] = accumulated[from] / length;
				normals[at + 1] = accumulated[from + 1] / length;
				normals[at + 2] = accumulated[from + 2] / length;
			} else {
				// a position referenced by no triangle, or by ones whose
				// contributions cancel exactly: leave a valid unit normal
				// rather than a zero vector, which would be NaN once
				// normalized
				normals[at + 1] = 1;
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
		// Uint16 holds indices up to 65 535, so it covers a vertex count of
		// 65 536 exactly. Past that the array must widen or every index
		// wraps mod 65 536 in silence — reachable on ordinary models now
		// that a position referencing several normals is split per normal,
		// which can treble the unified vertex count of a flat-shaded mesh.
		indices:
			vertexCount > UINT16_VERTEX_LIMIT
				? new Uint32Array(indices)
				: new Uint16Array(indices),
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
