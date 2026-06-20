import { level } from "../../level/level.js";
import { transformedBounds } from "../../math/vertex.ts";
import { gltfList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

/**
 * glTF 2.0 (.gltf / .glb) scene loader — Tier 1.
 *
 * Parses a glTF asset into a flat list of mesh nodes with their world
 * transforms, geometry (positions / uvs / indices), and decoded baseColor
 * texture, ready to instantiate as melonJS {@link Mesh} renderables.
 *
 * Tier 1 scope: static node graph + mesh primitives (POSITION / TEXCOORD_0
 * / indices) + pbrMetallicRoughness.baseColorTexture (and baseColorFactor) +
 * node TRS animation (translation / rotation / scale channels, the rigid
 * hierarchical animation used by e.g. Kenney's blocky characters).
 * Out of scope: skinning (vertex skinning / JOINTS_0 / WEIGHTS_0), morph
 * targets, full PBR maps, KHR extensions, Draco compression.
 * @ignore
 */

// glTF componentType -> TypedArray + DataView reader
const COMPONENT = {
	5120: { array: Int8Array, size: 1, get: "getInt8" },
	5121: { array: Uint8Array, size: 1, get: "getUint8" },
	5122: { array: Int16Array, size: 2, get: "getInt16" },
	5123: { array: Uint16Array, size: 2, get: "getUint16" },
	5125: { array: Uint32Array, size: 4, get: "getUint32" },
	5126: { array: Float32Array, size: 4, get: "getFloat32" },
};
// glTF accessor type -> component count
const TYPE_COUNT = {
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT2: 4,
	MAT3: 9,
	MAT4: 16,
};

/**
 * Split a GLB binary container into its JSON description and binary buffer.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{ json: object, bin: Uint8Array | null }}
 * @ignore
 */
export function parseGLB(arrayBuffer) {
	const dv = new DataView(arrayBuffer);
	const magic = dv.getUint32(0, true);
	// 0x46546C67 === "glTF"
	if (magic !== 0x46546c67) {
		// not a binary container — assume a JSON .gltf
		const json = JSON.parse(new TextDecoder().decode(arrayBuffer));
		return { json, bin: null };
	}
	const length = dv.getUint32(8, true);
	let offset = 12;
	let json = null;
	let bin = null;
	while (offset < length) {
		const chunkLength = dv.getUint32(offset, true);
		const chunkType = dv.getUint32(offset + 4, true);
		const start = offset + 8;
		if (chunkType === 0x4e4f534a) {
			// "JSON"
			json = JSON.parse(
				new TextDecoder().decode(
					new Uint8Array(arrayBuffer, start, chunkLength),
				),
			);
		} else if (chunkType === 0x004e4942) {
			// "BIN\0"
			bin = new Uint8Array(arrayBuffer, start, chunkLength);
		}
		offset = start + chunkLength;
	}
	return { json, bin };
}

/**
 * Resolve a glTF relative resource URI (external `.bin` / image) against the
 * asset's own URL, the same way a browser resolves a relative `<img src>`.
 * Returns an absolute URL string, or `null` when the asset URL is unknown
 * (e.g. a GLB parsed straight from an ArrayBuffer in a test) — the caller then
 * fails with a clear "external resource" message instead of fetching garbage.
 * @ignore
 */
function resolveURI(uri, baseURI) {
	if (baseURI === undefined || baseURI === null) {
		return null;
	}
	// `new URL` handles ./, ../, %20-encoding and absolute base normalization.
	// Resolve the (possibly relative) asset URL against the document first so a
	// page-relative `data.src` like "assets/x.gltf" becomes absolute.
	const absoluteBase = new URL(
		baseURI,
		typeof document !== "undefined" ? document.baseURI : undefined,
	);
	return new URL(uri, absoluteBase).href;
}

/**
 * Decode a single base64 `data:` URI payload into a Uint8Array.
 * @ignore
 */
function decodeDataURI(uri) {
	const base64 = uri.slice(uri.indexOf(",") + 1);
	const binary = atob(base64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

/**
 * Resolve every glTF buffer to a Uint8Array. Handles the GLB binary chunk
 * (no uri), embedded `data:` URIs, and external `.bin` files fetched relative
 * to the asset URL (`baseURI`). Async because external buffers are fetched.
 * @ignore
 */
function resolveBuffers(json, bin, baseURI, settings) {
	return Promise.all(
		(json.buffers || []).map((buffer) => {
			if (buffer.uri === undefined) {
				return bin;
			}
			if (buffer.uri.startsWith("data:")) {
				return decodeDataURI(buffer.uri);
			}
			// external .bin — fetch it relative to the asset URL
			const url = resolveURI(buffer.uri, baseURI);
			if (url === null) {
				throw new Error(
					`glTF: external buffer "${buffer.uri}" cannot be resolved without the asset URL`,
				);
			}
			return fetchData(url, "arrayBuffer", settings).then((ab) => {
				return new Uint8Array(ab);
			});
		}),
	);
}

/**
 * Read an accessor into a flat TypedArray (stride-aware, non-interleaved
 * fast-path covered as a subset).
 * @ignore
 */
export function readAccessor(json, buffers, accessorIndex) {
	const accessor = json.accessors[accessorIndex];
	const comp = COMPONENT[accessor.componentType];
	const numComp = TYPE_COUNT[accessor.type];
	if (comp === undefined || numComp === undefined) {
		throw new Error(
			`glTF: unsupported accessor (componentType ${accessor.componentType}, type "${accessor.type}")`,
		);
	}
	// An accessor with no bufferView is sparse-only or zero-initialized (out of
	// Tier 1 scope). Fail with a clear message rather than a cryptic
	// "cannot read byteStride of undefined" further down.
	if (accessor.bufferView === undefined) {
		throw new Error(
			`glTF: accessor ${accessorIndex} has no bufferView (sparse / zero-initialized accessors are not supported)`,
		);
	}
	const view = json.bufferViews[accessor.bufferView];
	const elementSize = comp.size * numComp;
	const stride = view.byteStride || elementSize;
	const bytes = buffers[view.buffer];
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
	const TypedArrayCtor = comp.array;
	const out = new TypedArrayCtor(accessor.count * numComp);
	for (let i = 0; i < accessor.count; i++) {
		const elementOffset = base + i * stride;
		for (let c = 0; c < numComp; c++) {
			out[i * numComp + c] = dv[comp.get](elementOffset + c * comp.size, true);
		}
	}
	return out;
}

/**
 * Read a `COLOR_0` accessor into a packed ARGB Uint32 per vertex (the format
 * {@link Mesh}'s `vertexColors` consumes). Handles `VEC3` (alpha defaults to 1)
 * and `VEC4`, and the three glTF color encodings: float `0..1`, and normalized
 * `UNSIGNED_BYTE` / `UNSIGNED_SHORT`.
 * @ignore
 */
function readVertexColors(json, buffers, accessorIndex) {
	const accessor = json.accessors[accessorIndex];
	const raw = readAccessor(json, buffers, accessorIndex);
	const numComp = TYPE_COUNT[accessor.type]; // 3 (rgb) or 4 (rgba)
	// normalize integer encodings to 0..1; float is already 0..1
	const div =
		accessor.componentType === 5121
			? 255
			: accessor.componentType === 5123
				? 65535
				: 1;
	const out = new Uint32Array(accessor.count);
	for (let i = 0; i < accessor.count; i++) {
		const o = i * numComp;
		const r = Math.round((raw[o] / div) * 255);
		const g = Math.round((raw[o + 1] / div) * 255);
		const b = Math.round((raw[o + 2] / div) * 255);
		const a = numComp === 4 ? Math.round((raw[o + 3] / div) * 255) : 255;
		// ARGB packed (A<<24 | R<<16 | G<<8 | B), matching Color.toUint32
		out[i] = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
	}
	return out;
}

// ---- 4x4 column-major matrix helpers (glTF convention) ----

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * Compose a column-major 4x4 local matrix from translation / rotation
 * (quaternion) / scale arrays — the glTF TRS convention — writing into `out`.
 * In-place so the per-frame animation pose path allocates nothing.
 * @param {number[]} out - 16-element destination (returned)
 * @param {number[]} translation - [tx, ty, tz]
 * @param {number[]} rotation - quaternion [qx, qy, qz, qw]
 * @param {number[]} scale - [sx, sy, sz]
 * @returns {number[]} `out`
 * @ignore
 */
export function composeTRSInto(out, translation, rotation, scale) {
	const [tx, ty, tz] = translation;
	const [qx, qy, qz, qw] = rotation;
	const [sx, sy, sz] = scale;
	const x2 = qx + qx;
	const y2 = qy + qy;
	const z2 = qz + qz;
	const xx = qx * x2;
	const xy = qx * y2;
	const xz = qx * z2;
	const yy = qy * y2;
	const yz = qy * z2;
	const zz = qz * z2;
	const wx = qw * x2;
	const wy = qw * y2;
	const wz = qw * z2;
	out[0] = (1 - (yy + zz)) * sx;
	out[1] = (xy + wz) * sx;
	out[2] = (xz - wy) * sx;
	out[3] = 0;
	out[4] = (xy - wz) * sy;
	out[5] = (1 - (xx + zz)) * sy;
	out[6] = (yz + wx) * sy;
	out[7] = 0;
	out[8] = (xz + wy) * sz;
	out[9] = (yz - wx) * sz;
	out[10] = (1 - (xx + yy)) * sz;
	out[11] = 0;
	out[12] = tx;
	out[13] = ty;
	out[14] = tz;
	out[15] = 1;
	return out;
}

/**
 * Allocating form of {@link composeTRSInto} — returns a fresh 16-element array.
 * @param {number[]} translation - [tx, ty, tz]
 * @param {number[]} rotation - quaternion [qx, qy, qz, qw]
 * @param {number[]} scale - [sx, sy, sz]
 * @returns {number[]} 16-element column-major matrix
 * @ignore
 */
export function composeTRS(translation, rotation, scale) {
	return composeTRSInto(new Array(16), translation, rotation, scale);
}

/** Compose a node's local matrix from its `matrix` or TRS fields. @ignore */
export function nodeLocalMatrix(node) {
	if (node.matrix) {
		return node.matrix.slice();
	}
	return composeTRS(
		node.translation || [0, 0, 0],
		node.rotation || [0, 0, 0, 1],
		node.scale || [1, 1, 1],
	);
}

/**
 * Synthesize per-vertex normals for a primitive that lacks a `NORMAL`
 * accessor: accumulate each triangle's face normal onto its three vertices,
 * then normalize. Shared vertices end up area-weighted (smooth); isolated
 * faces stay flat. A degenerate (zero-length) result falls back to +Y.
 * @param {Float32Array} positions - x,y,z triplets
 * @param {Uint16Array|Uint32Array} indices - triangle indices
 * @param {number} vertexCount
 * @returns {Float32Array} x,y,z normals, one per vertex
 * @ignore
 */
function computeFlatNormals(positions, indices, vertexCount) {
	const normals = new Float32Array(vertexCount * 3);
	for (let i = 0; i < indices.length; i += 3) {
		const a = indices[i] * 3;
		const b = indices[i + 1] * 3;
		const c = indices[i + 2] * 3;
		const e1x = positions[b] - positions[a];
		const e1y = positions[b + 1] - positions[a + 1];
		const e1z = positions[b + 2] - positions[a + 2];
		const e2x = positions[c] - positions[a];
		const e2y = positions[c + 1] - positions[a + 1];
		const e2z = positions[c + 2] - positions[a + 2];
		// face normal = e1 × e2 (unnormalized → area-weighted accumulation)
		const nx = e1y * e2z - e1z * e2y;
		const ny = e1z * e2x - e1x * e2z;
		const nz = e1x * e2y - e1y * e2x;
		// accumulate the (area-weighted) face normal onto each of the 3
		// vertices — unrolled to avoid a per-triangle array allocation
		normals[a] += nx;
		normals[a + 1] += ny;
		normals[a + 2] += nz;
		normals[b] += nx;
		normals[b + 1] += ny;
		normals[b + 2] += nz;
		normals[c] += nx;
		normals[c + 1] += ny;
		normals[c + 2] += nz;
	}
	for (let i = 0; i < normals.length; i += 3) {
		const x = normals[i];
		const y = normals[i + 1];
		const z = normals[i + 2];
		const len = Math.hypot(x, y, z);
		if (len > 1e-8) {
			normals[i] = x / len;
			normals[i + 1] = y / len;
			normals[i + 2] = z / len;
		} else {
			normals[i] = 0;
			normals[i + 1] = 1;
			normals[i + 2] = 0;
		}
	}
	return normals;
}

/** Normalize a 3-component vector (returns +Y on a zero-length input). @ignore */
function normalize3(v) {
	const len = Math.hypot(v[0], v[1], v[2]);
	return len > 1e-8 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0];
}

/**
 * Column-major 4x4 multiply `a * b`, writing into `out`. `out` must NOT alias
 * `a` or `b` (results are written as they're computed). In-place so the
 * per-frame pose path allocates nothing.
 * @ignore
 */
export function multiplyMatrixInto(out, a, b) {
	for (let col = 0; col < 4; col++) {
		for (let row = 0; row < 4; row++) {
			out[col * 4 + row] =
				a[0 * 4 + row] * b[col * 4 + 0] +
				a[1 * 4 + row] * b[col * 4 + 1] +
				a[2 * 4 + row] * b[col * 4 + 2] +
				a[3 * 4 + row] * b[col * 4 + 3];
		}
	}
	return out;
}

/** Allocating form of {@link multiplyMatrixInto}: `a * b` → fresh array. @ignore */
export function multiplyMatrix(a, b) {
	return multiplyMatrixInto(new Array(16), a, b);
}

/**
 * Decode a glTF image into an HTMLImageElement. Handles the three sources:
 * an embedded `bufferView`, an inline `data:` URI, and an external image file
 * referenced by relative `uri` (resolved against the asset URL `baseURI`).
 * @returns {Promise<HTMLImageElement>}
 * @ignore
 */
function decodeImage(json, buffers, imageIndex, baseURI, settings) {
	const image = json.images[imageIndex];
	let blob;
	if (image.bufferView !== undefined) {
		const view = json.bufferViews[image.bufferView];
		const bytes = buffers[view.buffer];
		const slice = bytes.subarray(
			view.byteOffset || 0,
			(view.byteOffset || 0) + view.byteLength,
		);
		blob = new Blob([slice], { type: image.mimeType || "image/png" });
	} else if (image.uri && image.uri.startsWith("data:")) {
		return loadImageFromUrl(image.uri);
	} else if (image.uri) {
		// external image file — resolve relative to the asset URL and let the
		// browser fetch it directly (no object-URL to revoke). Forward the
		// loader's crossOrigin so a cross-origin texture isn't tainted (which
		// would throw on the WebGL `texImage2D` upload); same-origin is
		// unaffected.
		const url = resolveURI(image.uri, baseURI);
		if (url === null) {
			return Promise.reject(
				new Error(
					`glTF: external image "${image.uri}" cannot be resolved without the asset URL`,
				),
			);
		}
		return loadImageFromUrl(url, false, settings?.crossOrigin);
	} else {
		return Promise.reject(new Error("glTF: unsupported image source"));
	}
	// `revoke: true` — the blob URL is a transient handle, only needed until
	// the image has decoded; release it on load/error to avoid leaking it for
	// the lifetime of the document.
	return loadImageFromUrl(URL.createObjectURL(blob), true);
}

/** @ignore */
function loadImageFromUrl(url, revoke = false, crossOrigin) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		// must be set before `src` to take effect; only for real (non-blob,
		// non-data) URLs that may be cross-origin
		if (typeof crossOrigin === "string") {
			img.crossOrigin = crossOrigin;
		}
		img.onload = () => {
			if (revoke) {
				URL.revokeObjectURL(url);
			}
			resolve(img);
		};
		img.onerror = () => {
			if (revoke) {
				URL.revokeObjectURL(url);
			}
			reject(new Error("glTF: failed to decode image"));
		};
		img.src = url;
	});
}

/**
 * Parse a glTF/GLB ArrayBuffer into a flat, instantiable scene descriptor.
 * @param {ArrayBuffer} arrayBuffer - the .glb / .gltf bytes
 * @param {string} [baseURI] - the asset's own URL, used to resolve external
 * `.bin` buffers and image files referenced by relative `uri`. Omit for a fully
 * self-contained GLB (embedded buffers + data-URI / bufferView images).
 * @param {object} [settings] - loader settings forwarded to `fetchData` for
 * external resources (crossOrigin / withCredentials / nocache).
 * @returns {Promise<object>} `{ nodes, cameras, lights, bounds, graph, animations }`
 * @ignore
 */
export async function parseGLTF(arrayBuffer, baseURI, settings) {
	const { json, bin } = parseGLB(arrayBuffer);
	const buffers = await resolveBuffers(json, bin, baseURI, settings);

	// decode every image once, keyed by image index
	const images = await Promise.all(
		(json.images || []).map((_, i) => {
			return decodeImage(json, buffers, i, baseURI, settings);
		}),
	);

	// resolve material index -> decoded baseColor image
	const materialImage = (materialIndex) => {
		if (materialIndex === undefined) {
			return null;
		}
		const mat = json.materials?.[materialIndex];
		const tex = mat?.pbrMetallicRoughness?.baseColorTexture;
		if (!tex) {
			return null;
		}
		const imageIndex = json.textures?.[tex.index]?.source;
		return imageIndex !== undefined ? images[imageIndex] || null : null;
	};

	// resolve material index -> baseColorFactor [r,g,b,a] in 0..1 (defaults to
	// opaque white). A material with no baseColorTexture but a non-white factor
	// is a solid-colored mesh — without this it would render as the white-pixel
	// fallback.
	const materialBaseColor = (materialIndex) => {
		if (materialIndex === undefined) {
			return [1, 1, 1, 1];
		}
		return (
			json.materials?.[materialIndex]?.pbrMetallicRoughness
				?.baseColorFactor ?? [1, 1, 1, 1]
		);
	};

	// resolve material index -> melonJS texture wrap mode, honoring the glTF
	// sampler's `wrapS` / `wrapT`. The glTF default sampler wrap is REPEAT
	// (10497) on both axes — many exporters author UVs outside `[0, 1]` that
	// rely on it, so a missing sampler / texture must default to "repeat", not
	// clamp. CLAMP_TO_EDGE is 33071; MIRRORED_REPEAT (33648) has no melonJS
	// equivalent and maps to plain repeat.
	const CLAMP = 33071;
	const materialTextureRepeat = (materialIndex) => {
		let wrapS = 10497;
		let wrapT = 10497;
		const tex =
			materialIndex !== undefined
				? json.materials?.[materialIndex]?.pbrMetallicRoughness
						?.baseColorTexture
				: undefined;
		if (tex) {
			const samplerIndex = json.textures?.[tex.index]?.sampler;
			const sampler =
				samplerIndex !== undefined ? json.samplers?.[samplerIndex] : undefined;
			wrapS = sampler?.wrapS ?? 10497;
			wrapT = sampler?.wrapT ?? 10497;
		}
		const repeatS = wrapS !== CLAMP;
		const repeatT = wrapT !== CLAMP;
		if (repeatS && repeatT) {
			return "repeat";
		}
		if (repeatS) {
			return "repeat-x";
		}
		if (repeatT) {
			return "repeat-y";
		}
		return "no-repeat";
	};

	// walk the active scene's node graph, accumulating world matrices.
	// A malformed asset is not allowed to crash the loader: a missing scene
	// or scene-node list degrades to an empty (but valid) descriptor rather
	// than throwing on a null dereference.
	const meshNodes = [];
	const cameras = [];
	const lights = [];
	// the top-level KHR_lights_punctual light definitions (nodes reference these
	// by index); empty when the extension isn't used.
	const lightDefs = json.extensions?.KHR_lights_punctual?.lights ?? [];
	const sceneIndex = json.scene ?? 0;
	const roots = json.scenes?.[sceneIndex]?.nodes ?? [];

	// Read one mesh primitive's geometry (positions / uvs / indices / normals /
	// colors) + resolved material color. Shared by the flat static `meshNodes`
	// list and the hierarchical `graph` (animated path) so geometry is read
	// exactly once per primitive and both views share the same typed arrays.
	const readPrimitiveGeometry = (prim) => {
		const vertices = readAccessor(json, buffers, prim.attributes.POSITION);
		const uvs =
			prim.attributes.TEXCOORD_0 !== undefined
				? readAccessor(json, buffers, prim.attributes.TEXCOORD_0)
				: new Float32Array((vertices.length / 3) * 2);
		const vertexCount = vertices.length / 3;
		let indices;
		if (prim.indices !== undefined) {
			const raw = readAccessor(json, buffers, prim.indices);
			indices = raw instanceof Uint32Array ? raw : Uint16Array.from(raw);
		} else {
			// non-indexed primitive (drawArrays-style): synthesize a
			// sequential index buffer so the geometry is still drawable.
			const Indexed = vertexCount > 65535 ? Uint32Array : Uint16Array;
			indices = new Indexed(vertexCount);
			for (let i = 0; i < vertexCount; i++) {
				indices[i] = i;
			}
		}
		// per-vertex normals for lit shading — read NORMAL when present,
		// otherwise synthesize them from the geometry so a mesh without
		// authored normals can still be lit.
		const normals =
			prim.attributes.NORMAL !== undefined
				? readAccessor(json, buffers, prim.attributes.NORMAL)
				: computeFlatNormals(vertices, indices, vertexCount);
		// optional per-vertex colors (COLOR_0) → packed ARGB Uint32, for
		// untextured vertex-colored meshes (MagicaVoxel, vertex paint).
		const colors =
			prim.attributes.COLOR_0 !== undefined
				? readVertexColors(json, buffers, prim.attributes.COLOR_0)
				: undefined;
		return {
			vertices,
			normals,
			uvs,
			indices,
			vertexCount,
			image: materialImage(prim.material),
			// texture wrap mode from the glTF sampler (default REPEAT) — see
			// materialTextureRepeat; carried so the Mesh samples tiling UVs
			// correctly instead of clamping to flat edge texels
			textureRepeat: materialTextureRepeat(prim.material),
			// baseColorFactor [r,g,b,a] — applied as the mesh tint so a
			// solid-colored (untextured) material renders its color
			baseColorFactor: materialBaseColor(prim.material),
			// per-vertex colors (COLOR_0), packed ARGB, or undefined
			colors,
			// honor the glTF material's double-sided flag — many props
			// (coins, fences, foliage) are thin/flat double-sided
			// geometry that a single-sided back-face cull would gut
			doubleSided:
				prim.material !== undefined &&
				json.materials?.[prim.material]?.doubleSided === true,
		};
	};

	// Guard against cyclic node graphs. Per the glTF spec the node hierarchy
	// is a strict tree (each node has at most one parent), so a node visited
	// twice means the file is malformed — skip it rather than recursing
	// forever into a stack overflow.
	const visited = new Set();

	// the full node hierarchy (animated path): glTF node index → graph node
	// carrying rest TRS, children, and any mesh primitives. Built alongside the
	// flat `meshNodes` from the same single geometry read.
	const graphNodes = {};

	const visit = (nodeIndex, parentWorld) => {
		if (visited.has(nodeIndex)) {
			return;
		}
		visited.add(nodeIndex);
		const node = json.nodes[nodeIndex];
		const world = multiplyMatrix(parentWorld, nodeLocalMatrix(node));
		const nodeName = node.name || `node_${nodeIndex}`;
		const primitives = [];
		if (node.mesh !== undefined) {
			for (const prim of json.meshes[node.mesh].primitives) {
				const geo = readPrimitiveGeometry(prim);
				primitives.push(geo);
				// flat static entry — same shape (+ world + name) as before so the
				// static path and bounds computation are unchanged
				meshNodes.push({ name: nodeName, world, ...geo });
			}
		}
		// graph node: rest TRS (glTF defaults when a field is absent), an explicit
		// `matrix` if the node used one, children, and its mesh primitives. The
		// animated path samples into a mutable copy of this TRS each frame.
		graphNodes[nodeIndex] = {
			index: nodeIndex,
			name: nodeName,
			translation: node.translation ? node.translation.slice() : [0, 0, 0],
			rotation: node.rotation ? node.rotation.slice() : [0, 0, 0, 1],
			scale: node.scale ? node.scale.slice() : [1, 1, 1],
			matrix: node.matrix ? node.matrix.slice() : null,
			children: (node.children || []).slice(),
			primitives,
		};
		if (node.camera !== undefined) {
			cameras.push({ ...json.cameras[node.camera], world });
		}
		// KHR_lights_punctual: a node references a light defined in the
		// top-level extension. Resolve its world-space direction (directional /
		// spot lights point down the node's local -Z) and position (point /
		// spot) from the node world matrix, so consumers get ready-to-use data.
		const lightIndex = node.extensions?.KHR_lights_punctual?.light;
		if (lightIndex !== undefined && lightDefs[lightIndex] !== undefined) {
			const def = lightDefs[lightIndex];
			lights.push({
				type: def.type, // "directional" | "point" | "spot"
				color: def.color ?? [1, 1, 1],
				intensity: def.intensity ?? 1,
				range: def.range,
				// world -Z axis of the node (third basis column negated), normalized
				direction: normalize3([-world[8], -world[9], -world[10]]),
				// world translation
				position: [world[12], world[13], world[14]],
				name: def.name,
			});
		}
		for (const child of node.children || []) {
			visit(child, world);
		}
	};
	for (const root of roots) {
		visit(root, IDENTITY);
	}

	// scene bounds (world space) for camera framing — accumulate each node's
	// transformed vertices into one AABB
	const min = [Infinity, Infinity, Infinity];
	const max = [-Infinity, -Infinity, -Infinity];
	for (const n of meshNodes) {
		transformedBounds(n.vertices, n.vertexCount, n.world, min, max);
	}
	// a scene with no drawable geometry leaves the bounds at their sentinel
	// ±Infinity — collapse to a degenerate box at the origin so consumers
	// (camera framing, etc.) get finite numbers instead of NaN.
	if (meshNodes.length === 0) {
		min[0] = min[1] = min[2] = 0;
		max[0] = max[1] = max[2] = 0;
	}

	// node-TRS animation clips. Each channel binds a sampler (keyframe times +
	// values) to a node's translation / rotation / scale. Other paths (weights /
	// morph targets) are skipped — out of Tier-1 scope. Channels targeting a node
	// outside the active scene are dropped. `duration` is the latest keyframe
	// time across the clip's samplers (seconds).
	const animations = (json.animations || []).map((anim, ai) => {
		let duration = 0;
		const channels = [];
		for (const ch of anim.channels) {
			const path = ch.target?.path;
			const nodeIndex = ch.target?.node;
			if (
				nodeIndex === undefined ||
				graphNodes[nodeIndex] === undefined ||
				(path !== "translation" && path !== "rotation" && path !== "scale")
			) {
				continue;
			}
			const sampler = anim.samplers[ch.sampler];
			const times = readAccessor(json, buffers, sampler.input);
			const values = readAccessor(json, buffers, sampler.output);
			if (times.length > 0) {
				duration = Math.max(duration, times[times.length - 1]);
			}
			channels.push({
				node: nodeIndex,
				path,
				times,
				values,
				// component count per keyframe value (rotation = quaternion VEC4)
				stride: path === "rotation" ? 4 : 3,
				interpolation: sampler.interpolation || "LINEAR",
			});
		}
		return { name: anim.name || `anim_${ai}`, duration, channels };
	});

	return {
		nodes: meshNodes,
		cameras,
		lights,
		bounds: { min, max },
		// hierarchical node graph + animation clips for the animated path; the
		// static path ignores both. `graph.nodes` is keyed by glTF node index.
		graph: { roots, nodes: graphNodes },
		animations,
	};
}

/**
 * parse/preload a glTF/GLB file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadGLTF(data, onload, onerror, settings) {
	if (typeof gltfList[data.name] !== "undefined") {
		return 0;
	}
	fetchData(data.src, "arrayBuffer", settings)
		.then((buffer) => {
			// pass the asset URL so external `.bin` / image `uri`s resolve
			// relative to it (a GLB with an external texture, like Kenney's
			// blocky characters, loads as-shipped without repackaging)
			return parseGLTF(buffer, data.src, settings);
		})
		.then((scene) => {
			gltfList[data.name] = scene;
			// register with the level director so the scene can be loaded
			// into the world via `me.level.load(name)`, like a Tiled map
			level.add(data.type, data.name);
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
