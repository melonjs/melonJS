/**
 * Generates a multi-texture fragment shader source string.
 * Declares individual sampler uniforms (uSampler0..uSamplerN) and uses
 * an if/else chain with 0.5-offset thresholds to select the correct texture unit.
 * @param {number} maxTextures - the number of texture units to support
 * @returns {string} GLSL fragment shader source
 * @ignore
 */
export function buildMultiTextureFragment(maxTextures) {
	const lines = [];

	// declare sampler uniforms
	for (let i = 0; i < maxTextures; i++) {
		lines.push("uniform sampler2D uSampler" + i + ";");
	}

	lines.push("varying vec4 vColor;");
	lines.push("varying vec2 vRegion;");
	lines.push("varying float vTextureId;");
	lines.push("");
	lines.push("void main(void) {");
	lines.push("    vec4 color;");

	// generate if/else chain using < N.5 thresholds
	for (let i = 0; i < maxTextures; i++) {
		if (i === 0) {
			lines.push("    if (vTextureId < 0.5) {");
		} else {
			lines.push("    } else if (vTextureId < " + (i + 0.5) + ") {");
		}
		lines.push("        color = texture2D(uSampler" + i + ", vRegion);");
	}

	// fallback to first sampler if vTextureId is out of range
	lines.push("    } else {");
	lines.push("        color = texture2D(uSampler0, vRegion);");
	lines.push("    }");
	lines.push("    gl_FragColor = color * vColor;");
	lines.push("}");

	return lines.join("\n");
}
