import { warning } from "../../lang/console.js";
import { mtlList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

// supported MTL properties
const SUPPORTED_PROPS = new Set([
	"newmtl",
	"Kd",
	"d",
	"Tr",
	"map_Kd",
	// ignored but harmless
	"Ka",
	"Ns",
	"Ni",
	"illum",
]);

// unsupported texture maps (would need multi-texture or shader changes)
const UNSUPPORTED_MAPS = new Set([
	"map_Ka",
	"map_Ks",
	"map_Ns",
	"map_d",
	"map_bump",
	"bump",
	"map_refl",
	"refl",
	"disp",
]);

/**
 * Parse a Wavefront MTL file into material data.
 * Supports: `newmtl`, `Kd` (diffuse color), `map_Kd` (diffuse texture),
 * `d`/`Tr` (opacity/transparency).
 *
 * Limitations:
 * - Only one `map_Kd` texture per material is supported
 * - Specular (`Ks`, `Ns`), ambient (`Ka`), and illumination model (`illum`) are parsed but ignored
 * - Normal maps (`map_bump`, `bump`), specular maps (`map_Ks`), and other texture maps are not supported
 * - Multiple materials per mesh (`usemtl`) are not supported — only the first material is used
 *
 * @param {string} text - raw MTL file contents
 * @param {string} basePath - base URL path for resolving texture references
 * @returns {object} map of material names to their properties
 * @ignore
 */
function parseMTL(text, basePath) {
	const materials = {};
	let current = null;
	let materialCount = 0;

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
			warning("MTL: '" + keyword + "' is not supported and will be ignored");
			continue;
		}

		// warn on completely unknown properties
		if (
			!SUPPORTED_PROPS.has(keyword) &&
			!UNSUPPORTED_MAPS.has(keyword) &&
			keyword !== "Ks"
		) {
			warning("MTL: unknown property '" + keyword + "' will be ignored");
			continue;
		}

		switch (keyword) {
			case "newmtl":
				materialCount++;
				if (materialCount > 1) {
					warning(
						"MTL: multiple materials detected — only the first material's texture will be used per mesh",
					);
				}
				if (!parts[1]) {
					warning("MTL: newmtl missing material name, skipping");
					break;
				}
				current = {
					name: parts[1],
					Kd: [1, 1, 1],
					d: 1.0,
					map_Kd: null,
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
			mtlList[data.name] = parseMTL(response, basePath);
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
