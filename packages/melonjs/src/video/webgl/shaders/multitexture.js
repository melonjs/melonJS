import { FRAME_FRAGMENT_GLSL } from "./frameclamp.js";

/**
 * Generates a multi-texture fragment shader source string (GLSL ES 3.00).
 * Declares individual sampler uniforms (uSampler0..uSamplerN) and uses
 * an if/else chain with 0.5-offset thresholds to select the correct texture unit.
 * Each sample stays inside the quad's frame under the `"linear-mipmap"`
 * filter (see `frameclamp.js`).
 * @param {number} maxTextures - the number of texture units to support
 * @returns {string} GLSL fragment shader source
 * @ignore
 * @internal
 */
export function buildMultiTextureFragment(maxTextures) {
	const count = Math.max(maxTextures, 1);
	// `precision` is inserted after the version directive by
	// utils/precision.js, so it is deliberately not written here
	const lines = ["#version 300 es"];

	// declare sampler uniforms
	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uSampler" + i + ";");
	}

	lines.push("in vec4 vColor;");
	lines.push("in vec2 vRegion;");
	lines.push("in float vTextureId;");
	lines.push("out vec4 fragColor;");
	lines.push(FRAME_FRAGMENT_GLSL);
	lines.push("void main(void) {");
	// the UV's derivatives, while control flow is still uniform
	lines.push("    vec2 gx = dFdx(vRegion);");
	lines.push("    vec2 gy = dFdy(vRegion);");
	lines.push("    vec4 color;");

	// generate if/else chain using < N.5 thresholds
	for (let i = 0; i < count; i++) {
		if (i === 0) {
			lines.push("    if (vTextureId < 0.5) {");
		} else {
			lines.push("    } else if (vTextureId < " + (i + 0.5) + ") {");
		}
		lines.push(
			"        color = frameSample(uSampler" + i + ", vRegion, gx, gy);",
		);
	}

	// fallback to first sampler if vTextureId is out of range
	lines.push("    } else {");
	lines.push("        color = frameSample(uSampler0, vRegion, gx, gy);");
	lines.push("    }");
	lines.push("    fragColor = color * vColor;");
	lines.push("}");

	return lines.join("\n");
}
