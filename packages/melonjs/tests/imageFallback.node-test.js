/**
 * Image loader fallback chain unit tests.
 *
 * Tests that when compressed textures are not supported (no WebGL renderer),
 * the loader falls back through alternatives until it finds one that works
 * (e.g. a PNG file).
 *
 * Since the full melonJS module tree pulls in polyfills and browser APIs that
 * don't resolve in Node, this test re-implements the fallback chain logic from
 * src/loader/parsers/image.js in isolation, using the same pattern and the
 * real compressed texture parsers.
 *
 * Run with: node --test tests/imageFallback.node-test.js
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { parseDDS } from "../src/loader/parsers/compressed_textures/parseDDS.js";
import { parseKTX } from "../src/loader/parsers/compressed_textures/parseKTX.js";
import { parseKTX2 } from "../src/loader/parsers/compressed_textures/parseKTX2.js";
import { parsePKM } from "../src/loader/parsers/compressed_textures/parsePKM.js";
import { parsePVR } from "../src/loader/parsers/compressed_textures/parsePVR.js";

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulates the image loader's tryLoadSource logic:
 * - For compressed formats: fetch as arrayBuffer, parse, verify format support
 * - For standard images: fetch as blob, create bitmap
 *
 * @param {string} src - source path
 * @param {string} name - cache key
 * @param {Map<string, ArrayBuffer>} fileServer - mock file system
 * @param {Set<number>} supportedFormats - set of supported WebGL format constants
 * @param {Object} imgCache - mock image cache
 * @returns {Promise}
 */
function tryLoadSource(src, name, fileServer, supportedFormats, imgCache) {
	const ext = src.split(".").pop().toLowerCase();

	// Simulate fetching — reject if file not found
	const data = fileServer.get(src);
	if (!data) {
		return Promise.reject(new Error("404 Not Found: " + src));
	}

	switch (ext) {
		case "dds":
		case "pvr":
		case "pkm":
		case "ktx":
		case "ktx2": {
			return new Promise((resolve, reject) => {
				try {
					let texture;
					switch (ext) {
						case "dds":
							texture = parseDDS(data);
							break;
						case "pvr":
							texture = parsePVR(data);
							break;
						case "pkm":
							texture = parsePKM(data);
							break;
						case "ktx":
							texture = parseKTX(data);
							break;
						case "ktx2":
							texture = parseKTX2(data);
							break;
					}
					// post-parse: check if the GPU supports this specific format
					if (supportedFormats.has(texture.format)) {
						imgCache[name] = texture;
						resolve();
					} else {
						reject(
							new Error(
								"unsupported texture format: " +
									ext +
									" (0x" +
									texture.format.toString(16) +
									")",
							),
						);
					}
				} catch (e) {
					reject(e);
				}
			});
		}

		// Standard image (png, jpg, etc.)
		default:
			return new Promise((resolve) => {
				// Simulate successful image decode
				imgCache[name] = {
					width: 64,
					height: 64,
					src: src,
					type: "standard",
				};
				resolve();
			});
	}
}

/**
 * Mirrors the fallback chain logic from preloadImage in image.js:
 * try each source sequentially, stop at the first that succeeds.
 */
function loadWithFallback(
	name,
	sources,
	fileServer,
	supportedFormats,
	imgCache,
) {
	let chain = Promise.reject();
	const triedSources = [];
	for (const src of sources) {
		chain = chain.catch(() => {
			triedSources.push(src);
			return tryLoadSource(src, name, fileServer, supportedFormats, imgCache);
		});
	}
	return chain.then(() => {
		return triedSources;
	});
}

// ── synthetic compressed texture builders ───────────────────────────────────

/** Build a minimal valid DDS DXT1 buffer */
function buildDDS_DXT1(width = 8, height = 8) {
	const blockSize = 8;
	const dataSize =
		Math.max(1, (width + 3) >> 2) * Math.max(1, (height + 3) >> 2) * blockSize;
	const buffer = new ArrayBuffer(128 + dataSize);
	const view = new DataView(buffer);
	view.setUint32(0, 0x20534444, true); // magic
	// header at offset 4 (124 bytes)
	view.setUint32(4, 124, true); // dwSize
	view.setUint32(8, 0x000a1007, true); // dwFlags
	view.setUint32(12, height, true); // dwHeight
	view.setUint32(16, width, true); // dwWidth
	view.setUint32(28, 1, true); // dwMipMapCount
	view.setUint32(80, 32, true); // ddspf.dwSize
	view.setUint32(84, 0x31545844, true); // ddspf.dwFourCC = "DXT1"
	return buffer;
}

/** Build a minimal valid PKM ETC1 buffer */
function buildPKM_ETC1(width = 8, height = 8) {
	const encodedW = (width + 3) & ~3;
	const encodedH = (height + 3) & ~3;
	const dataSize = (encodedW >> 2) * (encodedH >> 2) * 8;
	const buffer = new ArrayBuffer(16 + dataSize);
	const view = new DataView(buffer);
	view.setUint32(0, 0x504b4d20, false); // "PKM "
	view.setUint8(4, 0x31); // '1'
	view.setUint8(5, 0x30); // '0'
	view.setUint16(6, 0, false); // format type 0 = ETC1
	view.setUint16(8, encodedW, false);
	view.setUint16(10, encodedH, false);
	view.setUint16(12, width, false);
	view.setUint16(14, height, false);
	return buffer;
}

// WebGL format constants
const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83f0;
const COMPRESSED_RGB_ETC1_WEBGL = 0x8d64;

// ── tests ───────────────────────────────────────────────────────────────────

describe("image loader fallback chain", () => {
	it("should fall back to PNG when no compressed format is supported", async () => {
		const imgCache = {};
		const fileServer = new Map([
			["textures/test.dds", buildDDS_DXT1()],
			["textures/test.pkm", buildPKM_ETC1()],
			["textures/test.png", new ArrayBuffer(0)],
		]);
		// empty set = no compressed formats supported
		const supportedFormats = new Set();

		const tried = await loadWithFallback(
			"fallback-test",
			[
				"textures/test.dds", // DXT1 → unsupported
				"textures/test.pkm", // ETC1 → unsupported
				"textures/test.png", // standard → succeeds
			],
			fileServer,
			supportedFormats,
			imgCache,
		);

		// PNG should be loaded
		assert.ok(imgCache["fallback-test"], "image should be cached");
		assert.strictEqual(
			imgCache["fallback-test"].type,
			"standard",
			"should have loaded the PNG fallback",
		);
		assert.strictEqual(
			imgCache["fallback-test"].src,
			"textures/test.png",
			"cached image src should be the PNG",
		);

		// all three sources should have been tried in order
		assert.deepStrictEqual(tried, [
			"textures/test.dds",
			"textures/test.pkm",
			"textures/test.png",
		]);
	});

	it("should load the first supported compressed format and skip the rest", async () => {
		const imgCache = {};
		const fileServer = new Map([
			["textures/test.dds", buildDDS_DXT1()],
			["textures/test.pkm", buildPKM_ETC1()],
			["textures/test.png", new ArrayBuffer(0)],
		]);
		// only S3TC/DXT1 is supported
		const supportedFormats = new Set([COMPRESSED_RGB_S3TC_DXT1_EXT]);

		const tried = await loadWithFallback(
			"first-wins",
			[
				"textures/test.dds", // DXT1 → supported, stops here
				"textures/test.pkm", // should never be tried
				"textures/test.png", // should never be tried
			],
			fileServer,
			supportedFormats,
			imgCache,
		);

		assert.ok(imgCache["first-wins"], "image should be cached");
		assert.strictEqual(
			imgCache["first-wins"].format,
			COMPRESSED_RGB_S3TC_DXT1_EXT,
			"should have loaded DXT1 compressed texture",
		);
		assert.strictEqual(imgCache["first-wins"].compressed, true);

		// only DDS should have been tried
		assert.deepStrictEqual(tried, ["textures/test.dds"]);
	});

	it("should skip unsupported compressed formats and load a later supported one", async () => {
		const imgCache = {};
		const fileServer = new Map([
			["textures/test.dds", buildDDS_DXT1()],
			["textures/test.pkm", buildPKM_ETC1()],
			["textures/test.png", new ArrayBuffer(0)],
		]);
		// only ETC1 is supported (e.g. mobile GPU)
		const supportedFormats = new Set([COMPRESSED_RGB_ETC1_WEBGL]);

		const tried = await loadWithFallback(
			"skip-to-etc1",
			[
				"textures/test.dds", // DXT1 → unsupported
				"textures/test.pkm", // ETC1 → supported, stops here
				"textures/test.png", // should never be tried
			],
			fileServer,
			supportedFormats,
			imgCache,
		);

		assert.ok(imgCache["skip-to-etc1"], "image should be cached");
		assert.strictEqual(
			imgCache["skip-to-etc1"].format,
			COMPRESSED_RGB_ETC1_WEBGL,
			"should have loaded ETC1 compressed texture",
		);

		// DDS tried first (failed), then PKM succeeded
		assert.deepStrictEqual(tried, ["textures/test.dds", "textures/test.pkm"]);
	});

	it("should handle a single source (non-array style)", async () => {
		const imgCache = {};
		const fileServer = new Map([["textures/logo.png", new ArrayBuffer(0)]]);
		const supportedFormats = new Set();

		const tried = await loadWithFallback(
			"single-src",
			["textures/logo.png"],
			fileServer,
			supportedFormats,
			imgCache,
		);

		assert.ok(imgCache["single-src"], "image should be cached");
		assert.strictEqual(imgCache["single-src"].type, "standard");
		assert.deepStrictEqual(tried, ["textures/logo.png"]);
	});

	it("should reject when all sources fail", async () => {
		const imgCache = {};
		const fileServer = new Map([["textures/test.dds", buildDDS_DXT1()]]);
		// no formats supported, and no PNG fallback available
		const supportedFormats = new Set();

		await assert.rejects(() => {
			return loadWithFallback(
				"all-fail",
				[
					"textures/test.dds", // unsupported
					"textures/missing.png", // 404
				],
				fileServer,
				supportedFormats,
				imgCache,
			);
		}, /404 Not Found/);

		assert.strictEqual(
			imgCache["all-fail"],
			undefined,
			"nothing should be cached",
		);
	});
});
