/**
 * The `fontface` parser builds the CSS source descriptor the `FontFace`
 * constructor is given, and it wrapped bare paths as `url(<path>)` with no
 * quotes.
 *
 * An unquoted CSS `url()` token may not contain whitespace, so a font whose
 * FILENAME has a space — `data/fnt/Super Bouncer.ttf`, an entirely ordinary
 * thing to ship — produced a descriptor the browser refuses to parse, and
 * `font.load()` rejected before any request was made:
 *
 *     SyntaxError: The source provided ('url(data/fnt/Super Bouncer.ttf)')
 *                  could not be parsed as a value list.
 *
 * which the loader surfaced as `Failed loading resource`. Measured against the
 * live `FontFace` implementation, quoting is what distinguishes a parse failure
 * from an ordinary fetch:
 *
 *     url(data/fnt/Nope.ttf)             -> NetworkError  (parsed, 404)
 *     url(data/fnt/Super Bouncer.ttf)    -> SyntaxError    (never parsed)
 *     url('data/fnt/Super Bouncer.ttf')  -> NetworkError  (parsed, 404)
 */
import { describe, expect, it } from "vitest";
import { preloadFontFace } from "../src/loader/parsers/fontface.js";

/**
 * Run the parser and report how the browser judged the descriptor it built.
 * @param {string} src - the `src` field of the asset descriptor
 * @returns {Promise<string>} the rejection's error name, or "loaded"
 */
const outcomeFor = (src) => {
	return new Promise((resolve) => {
		preloadFontFace(
			{ name: `probe-${Math.random()}`, src },
			() => {
				return resolve("loaded");
			},
			(error) => {
				return resolve(error?.name ?? "unknown");
			},
		);
	});
};

describe("fontface parser: the CSS source descriptor", () => {
	it("accepts a path containing spaces", async () => {
		// The file does not exist, so the honest outcome is a NETWORK error.
		// A SyntaxError means the descriptor never parsed and no request was
		// ever made, which is the bug.
		const outcome = await outcomeFor("data/fnt/Super Bouncer.ttf");
		expect(outcome).not.toBe("SyntaxError");
	});

	it("still accepts an ordinary path with no spaces", async () => {
		const outcome = await outcomeFor("data/fnt/PlainName.ttf");
		expect(outcome).not.toBe("SyntaxError");
	});

	it("accepts a path containing an apostrophe", async () => {
		// quoting introduces its own escaping hazard, so pin it
		const outcome = await outcomeFor("data/fnt/it's a font.ttf");
		expect(outcome).not.toBe("SyntaxError");
	});

	it("accepts a path containing parentheses", async () => {
		const outcome = await outcomeFor("data/fnt/font (1).ttf");
		expect(outcome).not.toBe("SyntaxError");
	});

	it("leaves an explicit url(...) descriptor alone", async () => {
		const outcome = await outcomeFor("url('data/fnt/Already Wrapped.ttf')");
		expect(outcome).not.toBe("SyntaxError");
	});

	it("leaves a local(...) descriptor alone", async () => {
		// `local()` names an installed family; wrapping it in url() would break
		// it entirely. Absent locally, so any non-syntax outcome is fine.
		const outcome = await outcomeFor("local('Arial')");
		expect(outcome).not.toBe("SyntaxError");
	});

	it("does not mutate the caller's asset descriptor", () => {
		// the manifest is the game's own object, frequently a module-level
		// constant reused across scenes and retries
		const asset = { name: "probe-mutate", src: "data/fnt/Super Bouncer.ttf" };
		preloadFontFace(
			asset,
			() => {},
			() => {},
		);
		expect(asset.src).toBe("data/fnt/Super Bouncer.ttf");
	});
});
