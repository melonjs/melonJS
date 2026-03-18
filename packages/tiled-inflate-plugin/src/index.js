import { decompress as zstdDecompress } from "fzstd";
import { Base64 } from "js-base64";
import { plugin, TMXUtils } from "melonjs";
import pako from "pako";

/**
 * @classdesc
 * a melonJS plugin to enable loading and parsing of compressed Tiled maps.
 * Supports gzip, zlib, and zstd compressed tile layer data.
 * @augments plugin.BasePlugin
 * @example
 * import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";
 * import { plugin as mePlugin } from "melonjs";
 *
 * // register the plugin
 * mePlugin.register(TiledInflatePlugin);
 */
export class TiledInflatePlugin extends plugin.BasePlugin {
	constructor() {
		// call the super constructor
		super();

		// minimum melonJS version expected to run this plugin
		this.version = "15.2.1";

		/**
		 * decompress and decode zlib/gzip/zstd data
		 * @param {string} input - base64 encoded and compressed data
		 * @param {string} format - compressed data format ("gzip", "zlib", "zstd")
		 * @returns {Uint32Array} decoded and decompressed data
		 */
		TMXUtils.setInflateFunction((data, format) => {
			let output;
			switch (format) {
				case "gzip":
				case "zlib":
					output = pako.inflate(Base64.toUint8Array(data));
					break;
				case "zstd":
					output = zstdDecompress(Base64.toUint8Array(data));
					break;
				default:
					throw new Error(`${format} compressed TMX Tile Map not supported!`);
			}
			return new Uint32Array(
				output.buffer,
				output.byteOffset,
				output.byteLength / 4,
			);
		});
	}
}
