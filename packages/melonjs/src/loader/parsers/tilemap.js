import { level } from "../../level/level.js";
import {
	isSpriteFusionMap,
	SPRITESHEET,
	spritesheetName,
	usesSpritesheet,
} from "../../level/tiled/spritefusion.ts";
import * as TMXUtils from "../../level/tiled/TMXUtils.js";
import { fetchData } from "../../utils/fetchdata.js";
import { getExtension } from "../../utils/file.ts";
import { MAP_TYPES, tmxList } from "../cache.js";
import { loadReference } from "../loader.js";

/**
 * whether a map draws from the image Sprite Fusion saves with it: a map of
 * its JSON export does, and one of its TMX export names it
 * @ignore
 * @internal
 */
function drawsFromSpritesheet(map) {
	if (isSpriteFusionMap(map)) {
		return true;
	}
	return Array.isArray(map?.tilesets) && map.tilesets.some(usesSpritesheet);
}

/**
 * Load the `spritesheet.png` saved next to a `"spritefusion"` map, for the
 * map: under a name of the map's own (every map of the editor's comes with a
 * file of that name), held by the map and freed with it.
 * @param {loader.Asset} asset - the map asset, its `src` resolved
 * @param {object} [settings] - the loader's request settings
 * @returns {Promise<void>} settles when it is loaded
 * @ignore
 * @internal
 */
async function loadSpritesheet(asset, settings) {
	const src =
		asset.src.slice(0, asset.src.lastIndexOf("/") + 1) + SPRITESHEET + ".png";
	try {
		await loadReference(
			asset,
			{ name: spritesheetName(asset.name), type: "image", src },
			settings,
		);
	} catch (error) {
		throw new Error(
			`Sprite Fusion map "${asset.name}": its spritesheet could not be loaded (${src})`,
			{ cause: error },
		);
	}
}

/**
 * parse/preload a tile map or a tileset: a Tiled file (XML or JSON), or a
 * Sprite Fusion `map.json`
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 * @internal
 */
export function preloadTileMap(tmxData, onload, onerror, settings) {
	if (typeof tmxList[tmxData.name] !== "undefined") {
		// already loaded
		return 0;
	}

	/**
	 * @ignore
	 * @internal
	 */
	function addToTMXList(data) {
		// set the TMX content
		tmxList[tmxData.name] = data;

		// add the map to the level manager
		if (MAP_TYPES.includes(tmxData.type)) {
			level.add("tmx", tmxData.name);
		}
	}

	//if the data is in the tmxData object, don't get it via a XMLHTTPRequest
	if (tmxData.data) {
		addToTMXList(tmxData.data);
		if (typeof onload === "function") {
			onload();
		}
		return 1;
	}

	fetchData(tmxData.src, "text", settings)
		.then(async (response) => {
			if (typeof response !== "string") {
				throw new Error("Invalid response type");
			}

			let result;

			switch (getExtension(tmxData.src)) {
				case "xml":
				case "tmx":
				case "tsx": {
					// checked BEFORE constructing one: without it (a Web Worker,
					// nx.js) `new DOMParser()` is a bare ReferenceError that says
					// nothing about what to do instead
					if (
						typeof globalThis.DOMParser === "undefined" ||
						typeof globalThis.DOMParser.prototype.parseFromString !== "function"
					) {
						// logged as well as thrown: the loader reports a failed
						// asset by name only (this is the error's `cause`), and
						// only a runtime with no DOM ever gets here
						const message = `${tmxData.src}: loading a Tiled map or tileset in XML (.tmx/.tsx/.xml) needs DOMParser, which this runtime does not have. Export it from Tiled as JSON (.tmj/.tsj) instead.`;
						console.error(message);
						throw new Error(message);
					}

					const parser = new DOMParser();
					const xmlDoc = parser.parseFromString(response, "text/xml");
					const data = TMXUtils.parse(xmlDoc);

					result = data.map || data.tilesets[0] || data;

					break;
				}
				case "json":
				case "tmj":
				case "tsj":
					result = JSON.parse(response);
					break;
				default:
					throw new Error(
						`TMX file format not supported: ${getExtension(tmxData.src)}`,
					);
			}

			// a Sprite Fusion map comes with its spritesheet
			if (tmxData.type === "spritefusion" && drawsFromSpritesheet(result)) {
				await loadSpritesheet(tmxData, settings);
			}

			addToTMXList(result);

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
