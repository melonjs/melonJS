import { level } from "../../level/level.js";
import * as TMXUtils from "../../level/tiled/TMXUtils.js";
import { fetchData } from "../../utils/fetchdata.js";
import { getExtension } from "../../utils/file.ts";
import { tmxList } from "../cache.js";

/**
 * parse/preload a TMX file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 * @internal
 */
export function preloadTMX(tmxData, onload, onerror, settings) {
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

		// add the tmx to the level manager
		if (tmxData.type === "tmx") {
			level.add(tmxData.type, tmxData.name);
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
		.then((response) => {
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
