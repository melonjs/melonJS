import { fontList } from "../cache.js";

/**
 * parse/preload a font face
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 * @internal
 * @example
 * preloadFontFace([
 *     { name: "'kenpixel'", type: "fontface", src: "data/font/kenvector_future.woff2" }
 * ]);
 */
export function preloadFontFace(data, onload, onerror) {
	const fontFaceSet =
		typeof globalThis.document !== "undefined"
			? globalThis.document.fonts
			: undefined;

	// The FontFace constructor takes a CSS source descriptor: `url(...)` or
	// `local(...)`. Wrap a bare path, and leave anything already in either form
	// (including data URIs someone has wrapped themselves) untouched.
	//
	// QUOTED, because an unquoted CSS `url()` token may not contain whitespace.
	// A font whose filename has a space — "Super Bouncer.ttf", an entirely
	// ordinary thing to ship — produced a descriptor the browser refuses to
	// parse, so `load()` rejected with a SyntaxError before any request was
	// made and the loader reported it as a failed resource. Quoting also covers
	// parentheses and commas, which are equally illegal bare.
	//
	// Built into a LOCAL, not written back onto `data`: the descriptor belongs
	// to the caller's manifest, which is routinely a module-level constant
	// reused across scenes and retries.
	let src = data.src;
	if (!src.startsWith("url(") && !src.startsWith("local(")) {
		// escape what a CSS single-quoted string cannot carry literally
		const escaped = src.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
		src = `url('${escaped}')`;
	}

	if (typeof fontFaceSet !== "undefined") {
		// create a new font face
		const font = new FontFace(data.name, src);
		// loading promise
		font.load().then(
			() => {
				// add the font to the cache
				fontList[data.name] = font;
				// add the font to the document
				fontFaceSet.add(font);
				// onloaded callback
				if (typeof onload === "function") {
					onload();
				}
			},
			(error) => {
				// rejected
				if (typeof onerror === "function") {
					onerror(error);
				}
			},
		);
	} else {
		if (typeof onerror === "function") {
			onerror();
		}
	}

	return 1;
}
