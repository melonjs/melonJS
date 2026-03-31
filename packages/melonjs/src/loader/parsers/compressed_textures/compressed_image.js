import { once, VIDEO_INIT } from "../../../system/event.ts";
import { parseDDS } from "./parseDDS.js";
import { parseKTX } from "./parseKTX.js";
import { parseKTX2 } from "./parseKTX2.js";
import { parsePKM } from "./parsePKM.js";
import { parsePVR } from "./parsePVR.js";

/**
 * @typedef {object} CompressedTextureLevel
 * @property {Uint8Array} data - the compressed pixel data for this mip level
 * @property {number} width - width of this mip level in pixels
 * @property {number} height - height of this mip level in pixels
 */

/**
 * A parsed compressed texture object, returned by the compressed texture parsers (DDS, KTX, KTX2, PVR, PKM).
 * @typedef {object} CompressedImage
 * @property {CompressedTextureLevel[]} mipmaps - array of mip levels, largest first
 * @property {number} width - width of the base (largest) mip level in pixels
 * @property {number} height - height of the base (largest) mip level in pixels
 * @property {number} format - WebGL compressed texture format constant (e.g. 0x83F0 for COMPRESSED_RGB_S3TC_DXT1_EXT)
 * @property {boolean} compressed - always true
 * @property {boolean} generateMipmap - always false (mipmaps are pre-computed)
 */

let _renderer;

// gracefully capture a reference to the active renderer without adding more cyclic redundancy
once(VIDEO_INIT, (renderer) => {
	_renderer = renderer;
});

// Map file extensions to the WebGL extensions they may require.
// If none of the listed extensions are available, parsing is skipped entirely.
// KTX and KTX2 can contain any format, so they are not listed here and
// always go through parsing + post-parse format check.
const EXT_REQUIREMENTS = {
	dds: ["s3tc", "bptc"],
	pvr: ["pvrtc", "s3tc", "etc1"],
	pkm: ["etc1", "etc2"],
};

/**
 * Check whether the renderer supports at least one of the required extensions
 * for the given file extension. Returns true if parsing should proceed.
 * @param {string} imgExt - file extension
 * @returns {boolean}
 * @ignore
 */
function hasRequiredExtension(imgExt) {
	const requirements = EXT_REQUIREMENTS[imgExt];
	if (typeof requirements === "undefined") {
		// no pre-filter for this extension (ktx, ktx2)
		return true;
	}
	const formats = _renderer.getSupportedCompressedTextureFormats();
	for (let i = 0; i < requirements.length; i++) {
		if (
			formats[requirements[i]] !== null &&
			typeof formats[requirements[i]] !== "undefined"
		) {
			return true;
		}
	}
	return false;
}

export function parseCompressedImage(arrayBuffer, imgExt) {
	// check if the current renderer is WebGL
	if (!_renderer.type.includes("WebGL")) {
		throw new Error(
			"unsupported texture format: " + imgExt + " (WebGL renderer required)",
		);
	}

	// early rejection: check if the renderer supports any extension
	// that this container format could contain
	if (!hasRequiredExtension(imgExt)) {
		throw new Error(
			"unsupported texture format: " + imgExt + " (no matching GPU extension)",
		);
	}

	let texture;

	switch (imgExt) {
		case "dds":
			texture = parseDDS(arrayBuffer);
			break;
		case "pvr":
			texture = parsePVR(arrayBuffer);
			break;
		case "pkm":
			texture = parsePKM(arrayBuffer);
			break;
		case "ktx":
			texture = parseKTX(arrayBuffer);
			break;
		case "ktx2":
			texture = parseKTX2(arrayBuffer);
			break;
	}

	if (typeof texture !== "undefined") {
		// post-parse check: verify the specific format constant is supported
		if (_renderer.hasSupportedCompressedFormats(texture.format)) {
			return texture;
		}
	}

	throw new Error(
		"unsupported texture format: " +
			imgExt +
			(texture ? " (" + texture.format + ")" : ""),
	);
}
