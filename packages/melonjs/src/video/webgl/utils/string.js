/**
 * clean the given source from space, comments, etc...
 * @ignore
 */
export function minify(src) {
	// remove comments
	src = src.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
	// Remove leading and trailing whitespace from lines
	src = src.replace(/(\\n\s+)|(\s+\\n)/g, "");
	// Remove line breaks
	src = src.replace(/(\\r|\\n)+/g, "");
	// Remove unnecessary whitespace (spaces/tabs only, preserving newlines for preprocessor directives)
	src = src.replace(/[ \t]*([;,[\](){}\\\/\-+*|^&!=<>?~%])[ \t]*/g, "$1");

	return src;
}

/**
 * Prepend preprocessor defines to a GLSL source, respecting `#version`.
 *
 * `#version` must be the very first statement of a GLSL ES 3.00 shader —
 * anything before it, including a `#define`, is a compile error. So defines
 * go immediately *after* that line when one is present, and at the top when
 * it is not (GLSL ES 1.00 sources declare no version).
 *
 * Used to compile shader variants from one source: the optional parts are
 * `#ifdef`-guarded, and the variant is what defines are injected here.
 * @param {string} source - the shader source
 * @param {string} defines - `#define` lines, each newline-terminated
 * @returns {string} the source with the defines injected
 * @ignore
 */
export function injectDefines(source, defines) {
	if (!defines) {
		return source;
	}
	// GLSL ES 3.00 allows comments (and whitespace) BEFORE `#version`, so the
	// directive is not necessarily at byte 0 — a licence header above it is
	// enough to push the defines in front of it, which fails to compile and
	// leaves the draw with no program at all. Skip leading comments too, and
	// tolerate a `#version` line that ends the source without a newline.
	const lead = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/.exec(source)[0];
	const rest = source.slice(lead.length);
	const version = /^#version[^\n]*(?:\n|$)/.exec(rest);
	if (version === null) {
		return defines + source;
	}
	const directive = version[0].endsWith("\n") ? version[0] : `${version[0]}\n`;
	return lead + directive + defines + rest.slice(version[0].length);
}
