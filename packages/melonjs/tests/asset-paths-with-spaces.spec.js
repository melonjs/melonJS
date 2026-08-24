/**
 * Every preloadable asset type, with and without a space in the filename.
 *
 * A space is entirely ordinary in a shipped asset name, and it broke `fontface`
 * outright: that parser embeds the path in a CSS `url()` token, and an
 * UNQUOTED `url()` may not contain whitespace, so the descriptor never parsed
 * and no request was made:
 *
 *     SyntaxError: The source provided ('url(data/fnt/Super Bouncer.ttf)')
 *                  could not be parsed as a value list.
 *
 * Every other transport hands the raw string to the browser, which
 * percent-encodes it and issues a real request. Measured, against a file that
 * does not exist so the outcome is purely about the transport:
 *
 *     fetch()      (binary/json/tmx/shader/obj/mtl)  ->  404, request made
 *     Image.src    (image)                           ->  error event
 *     script.src   (js)                              ->  error event
 *     video.src    (video)                           ->  error event
 *     FontFace, unquoted                             ->  SyntaxError, NO request
 *
 * So `fontface` was the only one affected. These tests pin the whole matrix so
 * a future parser that builds a URL by string concatenation cannot regress it
 * silently, and so the paired plain-name case proves the fixture itself is
 * sound rather than the test passing for the wrong reason.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { boot, loader } from "../src/index.js";
import { preloadFontFace } from "../src/loader/parsers/fontface.js";

/** load one asset descriptor, resolving to "ok" or the failure reason */
const load = (asset) => {
	return new Promise((resolve) => {
		try {
			loader.load(
				asset,
				() => {
					return resolve("ok");
				},
				(err) => {
					return resolve(`error: ${err?.message ?? err}`);
				},
			);
		} catch (e) {
			resolve(`threw: ${e.message}`);
		}
	});
};

describe("asset paths containing a space", () => {
	beforeAll(() => {
		boot();
	});

	// Each entry is the SAME asset twice: once plainly named, once with a
	// space. The plain case is the control — if it fails, the fixture or the
	// parser is broken and the spaced case proves nothing.
	const matrix = [
		["image", "data/img/rect.png", "data/img/rect with space.png"],
		["json", "data/misc/plain.json", "data/misc/name with space.json"],
		["binary", "data/misc/plain.bin", "data/misc/name with space.bin"],
		["js", "data/misc/plain.js", "data/misc/name with space.js"],
	];

	// Not in the round trip, and deliberately so:
	//
	//   shader, tmx, tsx, obj, mtl, gltf, aseprite — all fetched through the
	//     same `fetchData` path as "json" and "binary" above, so the transport
	//     under test is already covered. `shader` additionally refuses to load
	//     without an initialized Application and a GPU renderer, which would
	//     put a WebGL context in this spec for nothing.
	//   audio — goes through Howler, a third-party loader with its own URL
	//     handling; worth its own test if it ever proves to matter.
	//   video — `video.src`, measured to issue a real request for a spaced
	//     name exactly as Image.src does.

	for (const [type, plainSrc, spacedSrc] of matrix) {
		it(`loads a "${type}" asset with a plain name`, async () => {
			const r = await load({ name: `plain-${type}`, type, src: plainSrc });
			expect(r).toBe("ok");
		});

		it(`loads a "${type}" asset whose name contains a space`, async () => {
			const r = await load({ name: `spaced-${type}`, type, src: spacedSrc });
			expect(r).toBe("ok");
		});
	}

	// `fontface` cannot round-trip here without shipping a real font binary,
	// and it does not need to: the bug was a PARSE failure that happened before
	// any request, so distinguishing SyntaxError from a network outcome is the
	// exact discrimination that matters.
	describe("fontface", () => {
		const outcomeFor = (src) => {
			return new Promise((resolve) => {
				preloadFontFace(
					{ name: `probe-${src}`, src },
					() => {
						return resolve("loaded");
					},
					(error) => {
						return resolve(error?.name ?? "unknown");
					},
				);
			});
		};

		it("builds a parseable descriptor for a plain name", async () => {
			expect(await outcomeFor("data/fnt/Plain.ttf")).not.toBe("SyntaxError");
		});

		it("builds a parseable descriptor for a name with a space", async () => {
			expect(await outcomeFor("data/fnt/Super Bouncer.ttf")).not.toBe(
				"SyntaxError",
			);
		});
	});
});
