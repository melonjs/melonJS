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
