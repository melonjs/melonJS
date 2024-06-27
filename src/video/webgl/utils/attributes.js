/**
 * @ignore
 */
export function extractAttributes(gl, shader) {
	const attributes = {};
	const attrRx = /attribute\s+\w+\s+(\w+)/g;
	let match;
	let i = 0;

	// Detect all attribute names
	while ((match = attrRx.exec(shader.vertex))) {
		attributes[match[1]] = i++;
	}

	return attributes;
}
