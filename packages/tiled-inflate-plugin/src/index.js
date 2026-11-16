import { plugin, TMXUtils } from "melonjs";
import { homepage, name, version } from "../package.json";
import { inflate } from "./inflate.js";

/**
 * a melonJS plugin to enable loading and parsing of compressed Tiled maps.
 * Supports gzip, zlib, and zstd compressed tile layer data.
 * @augments plugin.BasePlugin
 * @example
 * import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";
 * import { plugin as mePlugin } from "melonjs";
 *
 * // register the plugin
 * mePlugin.register(TiledInflatePlugin);
 * @category Plugins
 * @document ../README.md
 */
export class TiledInflatePlugin extends plugin.BasePlugin {
	constructor() {
		// call the super constructor
		super();

		// minimum melonJS version expected to run this plugin
		this.version = "15.2.1";

		console.log(`${name} ${version} | ${homepage}`);

		// decompress the base64 data of gzip, zlib or zstd compressed tile layers
		TMXUtils.setInflateFunction(inflate);
	}
}
