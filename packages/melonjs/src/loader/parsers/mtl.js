import { fetchData } from "../../utils/fetchdata.js";
import { getBasename } from "../../utils/file.ts";
import { mtlList } from "../cache.js";
import { preloadImage } from "./image.js";

// supported MTL properties
const SUPPORTED_PROPS = new Set([
	"newmtl",
	"Kd",
	"Ke",
	"d",
	"Tr",
	"map_Kd",
	"Ks",
	"Ns",
	"map_d",
	"map_bump",
	// the capitalised spelling exporters actually emit
	"map_Bump",
	"bump",
	"norm",
	"Pr",
	"Pm",
	// read onto the material but never consulted while shading — see the
	// material record below for why each one stays out of the lit path
	"Ka",
	"illum",
	// ignored but harmless
	"Ni",
]);

// unsupported texture maps (would need multi-texture or shader changes)
const UNSUPPORTED_MAPS = new Set([
	"map_Ka",
	"map_Ke",
	"map_Ks",
	"map_Ns",
	"map_refl",
	"refl",
	"disp",
	// The PBR extension's texture maps. Their SCALARS (`Pr` / `Pm`) are read
	// and approximated onto the existing shading terms; the maps are not,
	// because sampling roughness or metalness per texel only pays off against
	// a genuine PBR model and this is a stylized half-Lambert one. Listed here
	// rather than left to fall through: they are declined, not unrecognised,
	// and an exporter writing them deserves to be told which.
	"map_Pr",
	"map_Pm",
]);

// Option flags a texture-map line may carry before the filename. The format
// allows them on every `map_*`, but a normal map is where they actually show
// up: exporters write `map_Bump -bm 1.000000 rock-normal.png` as a matter of
// course. Each entry is [how many values the flag takes at most, whether
// those values are numbers] — the numeric ones take UP TO that many, so the
// scan has to stop at the first token that is not one, or a two-value `-s`
// would swallow the filename.
const MAP_OPTIONS = new Map([
	["-bm", [1, true]],
	["-boost", [1, true]],
	["-texres", [1, true]],
	["-mm", [2, true]],
	["-s", [3, true]],
	["-o", [3, true]],
	["-t", [3, true]],
	// these take a word, not a number ("on"/"off", a channel letter, a type
	// name), so their value count is exact rather than a maximum
	["-clamp", [1, false]],
	["-blendu", [1, false]],
	["-blendv", [1, false]],
	["-imfchan", [1, false]],
	["-type", [1, false]],
]);

/**
 * The filename off a `map_*` line, with any leading option flags removed.
 *
 * The filename is everything that survives, rejoined — a path may contain
 * spaces, so it cannot simply be the last token. Only KNOWN flags are
 * consumed, so a filename that happens to start with a dash ends the scan
 * rather than being eaten.
 * @param {string[]} parts - the whitespace-split line, keyword included
 * @returns {string} the filename, or an empty string if the line carried none
 * @ignore
 * @internal
 */
function mapFilename(parts) {
	let i = 1;
	while (i < parts.length) {
		const option = MAP_OPTIONS.get(parts[i]);
		if (option === undefined) {
			break;
		}
		const [count, numeric] = option;
		i += 1;
		let taken = 0;
		while (taken < count && i < parts.length) {
			// a numeric flag takes UP TO `count` numbers, so the first token
			// that is not one ends it — and that token is the filename
			if (numeric && Number.isNaN(Number(parts[i]))) {
				break;
			}
			i += 1;
			taken += 1;
		}
	}
	return parts.slice(i).join(" ");
}

/**
 * Parse a Wavefront MTL file into material data.
 * Supports: `newmtl`, `Kd` (diffuse color), `Ke` (emissive color), `Ks`/`Ns`
 * (specular color and exponent), `Pr`/`Pm` (the PBR roughness/metalness
 * extension, approximated onto the specular terms when `Ks`/`Ns` are absent),
 * `map_Kd` (diffuse texture), `map_d` (alpha map),
 * `map_bump`/`bump`/`norm` (tangent-space normal map) and `d`/`Tr`
 * (opacity/transparency).
 *
 * Limitations:
 * - Ambient (`Ka`) and the illumination model (`illum`) are read onto the
 *   material and readable from user code, but take no part in shading: `Ka`
 *   would fight the engine's own ambient light, and `illum` describes a
 *   fixed-function pipeline this renderer does not have
 * - Optical density (`Ni`) is parsed and ignored
 * - Specular maps (`map_Ks`), the PBR extension's `map_Pr` / `map_Pm`, and
 *   other texture maps are not supported; each warns once naming itself
 *
 * @param {string} text - raw MTL file contents
 * @param {string} basePath - base URL path for resolving texture references
 * @returns {object} map of material names to their properties
 * @ignore
 * @internal
 */
export function parseMTL(text, basePath) {
	const materials = {};
	let current = null;

	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.length === 0 || line[0] === "#") {
			continue;
		}

		const parts = line.split(/\s+/);
		const keyword = parts[0];

		// warn on unsupported texture maps
		if (UNSUPPORTED_MAPS.has(keyword)) {
			console.warn(
				"MTL: '" + keyword + "' is not supported and will be ignored",
			);
			continue;
		}

		// warn on completely unknown properties
		if (!SUPPORTED_PROPS.has(keyword) && !UNSUPPORTED_MAPS.has(keyword)) {
			console.warn("MTL: unknown property '" + keyword + "' will be ignored");
			continue;
		}

		switch (keyword) {
			case "newmtl":
				if (!parts[1]) {
					console.warn("MTL: newmtl missing material name, skipping");
					break;
				}
				current = {
					name: parts[1],
					Kd: [1, 1, 1],
					Ke: [0, 0, 0],
					// no specular by default: an MTL that declares none must
					// shade exactly as it did before specular existed
					Ks: [0, 0, 0],
					Ns: 0,
					// the PBR extension. `null` rather than a default value:
					// absent must be distinguishable from an authored 0, which
					// means "mirror-smooth" for Pr and "non-metal" for Pm
					Pr: null,
					Pm: null,
					// Ambient colour and illumination model: both parsed so an
					// authored value is not silently dropped, and both
					// deliberately left out of shading.
					//
					// `Ka` predates scene-wide ambient lighting. Adding it to
					// the lit path would give two ambient contributions
					// fighting each other, since `Stage.ambientLightingColor`
					// already provides one.
					//
					// `illum` enumerates fixed-function behaviours from the
					// Phong era — 0 is colour on / ambient off, 1 adds ambient,
					// 2 adds a highlight, and the higher values describe
					// reflection and raytrace modes. It describes a pipeline
					// this renderer does not have, and exporters write it
					// inconsistently, so it is reported rather than obeyed.
					//
					// `null` rather than a default, for the same reason `Pr`
					// and `Pm` use it: absent must stay distinguishable from an
					// authored value, and `illum 0` and `Ka 0 0 0` are both
					// meaningful things to have written.
					Ka: null,
					illum: null,
					d: 1.0,
					map_Kd: null,
					map_d: null,
					map_bump: null,
				};
				materials[parts[1]] = current;
				break;

			case "Kd":
				if (current) {
					current.Kd = [
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					];
				}
				break;

			case "Ke":
				// emissive color (self-illumination — Blender's OBJ exporter
				// writes it for materials with an emission shader)
				if (current) {
					current.Ke = [
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					];
				}
				break;

			case "Ka":
				// ambient colour, read but not shaded with
				if (current) {
					current.Ka = [
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					];
				}
				break;

			case "illum":
				// illumination model, read but not obeyed
				if (current) {
					current.illum = parseInt(parts[1], 10);
				}
				break;

			case "Ks":
				// specular color — the highlight's tint and strength
				if (current) {
					current.Ks = [
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					];
				}
				break;

			case "Ns":
				// specular exponent (0..1000 in the format): how tight the
				// highlight is. 0 means none, which is why Ks alone is not
				// enough to turn specular on
				if (current) {
					current.Ns = parseFloat(parts[1]);
				}
				break;

			case "Pr":
				// PBR extension: roughness. Blender's OBJ exporter writes it
				// (and `Pm`) for every material, so these are already in the
				// assets people bring to the engine
				if (current) {
					current.Pr = parseFloat(parts[1]);
				}
				break;

			case "Pm":
				// PBR extension: metalness
				if (current) {
					current.Pm = parseFloat(parts[1]);
				}
				break;

			case "d":
				if (current) {
					current.d = parseFloat(parts[1]);
				}
				break;

			case "Tr":
				// Tr is inverse of d (transparency = 1 - opacity)
				if (current) {
					current.d = 1.0 - parseFloat(parts[1]);
				}
				break;

			case "map_Kd":
				if (current) {
					// resolve texture path relative to MTL file location
					current.map_Kd = basePath + mapFilename(parts);
				}
				break;

			case "map_bump":
			case "map_Bump":
			case "bump":
			case "norm":
				// Four spellings, one slot. `norm` is the only one the format
				// defines as a tangent-space NORMAL map; `bump` and `map_bump`
				// are specified as height maps. In practice every exporter
				// worth supporting writes a normal map under `map_bump`, and
				// treating it as a height field would misread the common case
				// to honour the rare one — so all of them are read as normal
				// maps, and a genuine height map is unsupported. `map_Bump` is
				// the same keyword with the capital the exporters actually
				// write; the format is case-sensitive, so it needs saying.
				if (current) {
					// a line whose options consumed everything names no file
					const file = mapFilename(parts);
					if (file !== "") {
						current.map_bump = basePath + file;
					}
				}
				break;

			case "map_d":
				// per-texel opacity, driving the mesh alpha cutout per pixel
				// rather than per material
				if (current) {
					current.map_d = basePath + mapFilename(parts);
				}
				break;
		}
	}

	return materials;
}

/**
 * Parse/preload a Wavefront MTL material file.
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 * @internal
 */
export function preloadMTL(data, onload, onerror, settings) {
	if (typeof mtlList[data.name] !== "undefined") {
		return 0;
	}

	// derive base path from the MTL file URL
	const basePath = data.src.substring(0, data.src.lastIndexOf("/") + 1);

	fetchData(data.src, "text", settings)
		.then((response) => {
			const materials = parseMTL(response, basePath);
			mtlList[data.name] = materials;
			// Auto-load the diffuse textures referenced by `map_Kd`, resolved
			// relative to the MTL file and registered under that resolved path —
			// so a Mesh built with `material:` (and no explicit `texture:`) finds
			// them via `getImage(map_Kd)` without the caller having to preload
			// each texture separately (parity with the glTF loader, which fetches
			// a scene's external textures automatically). A texture that fails to
			// load is warned and skipped (the mesh falls back to the white pixel),
			// so one missing map_Kd doesn't abort the whole load. `map_d`
			// (per-texel opacity) and `map_bump` (the tangent-space normal map)
			// ride the same fetch for the same reason.
			const texturePaths = [
				...new Set(
					Object.values(materials)
						.flatMap((material) => {
							return [material.map_Kd, material.map_d, material.map_bump];
						})
						.filter(Boolean),
				),
			];
			return Promise.all(
				texturePaths.map((path) => {
					return new Promise((resolve) => {
						// register under the basename — `getImage` (used by Mesh to
						// resolve `map_Kd`) normalizes its lookup key via getBasename,
						// so the image must be stored under that same key to be found.
						const loading = preloadImage(
							{ name: getBasename(path), src: path },
							resolve,
							() => {
								console.warn(
									`melonJS: MTL texture "${path}" could not be loaded`,
								);
								resolve();
							},
							settings,
						);
						// preloadImage returns 0 when the image is already cached —
						// it then never calls our onload, so resolve now to avoid
						// hanging the Promise.all.
						if (loading === 0) {
							resolve();
						}
					});
				}),
			);
		})
		.then(() => {
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
