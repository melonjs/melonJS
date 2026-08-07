import { getBasename } from "../../utils/file.ts";
import { mtlList } from "../cache.js";
import { fetchData } from "./fetchdata.js";
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
	"Pr",
	"Pm",
	// ignored but harmless
	"Ka",
	"Ni",
	"illum",
]);

// unsupported texture maps (would need multi-texture or shader changes)
const UNSUPPORTED_MAPS = new Set([
	"map_Ka",
	"map_Ke",
	"map_Ks",
	"map_Ns",
	"map_bump",
	"bump",
	"map_refl",
	"refl",
	"disp",
]);

/**
 * Parse a Wavefront MTL file into material data.
 * Supports: `newmtl`, `Kd` (diffuse color), `Ke` (emissive color), `Ks`/`Ns`
 * (specular color and exponent), `Pr`/`Pm` (the PBR roughness/metalness
 * extension, approximated onto the specular terms when `Ks`/`Ns` are absent),
 * `map_Kd` (diffuse texture), `map_d` (alpha map), `d`/`Tr`
 * (opacity/transparency).
 *
 * Limitations:
 * - Ambient (`Ka`), optical density (`Ni`) and illumination model (`illum`) are parsed but ignored
 * - Normal maps (`map_bump`, `bump`), specular maps (`map_Ks`), and other texture maps are not supported
 *
 * @param {string} text - raw MTL file contents
 * @param {string} basePath - base URL path for resolving texture references
 * @returns {object} map of material names to their properties
 * @ignore
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
					d: 1.0,
					map_Kd: null,
					map_d: null,
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
					current.map_Kd = basePath + parts.slice(1).join(" ");
				}
				break;

			case "map_d":
				// per-texel opacity, driving the mesh alpha cutout per pixel
				// rather than per material
				if (current) {
					current.map_d = basePath + parts.slice(1).join(" ");
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
			// (per-texel opacity) rides the same fetch for the same reason.
			const texturePaths = [
				...new Set(
					Object.values(materials)
						.flatMap((material) => {
							return [material.map_Kd, material.map_d];
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
