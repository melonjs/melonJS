/**
 * Pick out every vertex attribute name from a shader source, regardless of
 * GLSL version. GLSL 1.00 marks attributes with the `attribute` storage
 * qualifier; GLSL ES 3.00 reuses `in` at file scope for the same purpose
 * (and `in` inside function parameter lists, which we exclude by requiring
 * the qualifier to start at the beginning of a line). Skipping the 3.00
 * form leaves the shader with no bound vertex data and the rasterizer
 * silently degenerates every triangle.
 * @ignore
 */
export function extractAttributes(gl, shader) {
	const attributes = {};
	// Match either `attribute <type> <name>` (GLSL 1.00) or `in <type>
	// <name>` (GLSL 3.00), with an optional precision qualifier or other
	// auxiliary qualifier in front of the type (`highp vec3`, `mediump
	// vec2`, etc.). The `(?:\w+\s+)+` allows one or more words before the
	// final identifier so multi-qualifier declarations capture the
	// trailing name and not an intermediate qualifier.
	const attrRx = /(?:^|\n)\s*(?:attribute|in)\s+(?:\w+\s+)+(\w+)/g;
	let match;
	let i = 0;

	while ((match = attrRx.exec(shader.vertex))) {
		attributes[match[1]] = i++;
	}

	return attributes;
}
