import { MAX_LIGHTS } from "../../../lighting/constants.ts";

// re-export so existing batcher imports keep working
export { MAX_LIGHTS };

/**
 * Build the GLSL `if/else` chain that picks among N samplers based on
 * a varying float texture-id. WebGL1 forbids dynamic indexing of
 * `sampler2D`, so the standard workaround is an if-ladder using the
 * usual `< i + 0.5` threshold pattern.
 * @ignore
 */
function buildSamplerSelect(varName, samplerPrefix, count, target) {
	const lines = [];
	for (let i = 0; i < count; i++) {
		if (i === 0) {
			lines.push("    if (" + varName + " < 0.5) {");
		} else {
			lines.push("    } else if (" + varName + " < " + (i + 0.5) + ") {");
		}
		lines.push(
			"        " + target + " = texture2D(" + samplerPrefix + i + ", vRegion);",
		);
	}
	lines.push("    } else {");
	lines.push(
		"        " + target + " = texture2D(" + samplerPrefix + "0, vRegion);",
	);
	lines.push("    }");
	return lines;
}

/**
 * Generate the fragment shader for `LitQuadBatcher` — the SpriteIlluminator
 * path that supports per-pixel normal-map lighting from up to `MAX_LIGHTS`
 * point lights.
 *
 * Sprites without a `normalMap` push `aNormalTextureId = -1` and take the
 * unlit fast path inside this same shader (sample color, multiply by
 * vertex color, return) so lit and unlit sprites can share the lit batch
 * when they coexist with active lights. The cost vs the truly-unlit
 * `QuadBatcher` shader is one varying read + one comparison per fragment.
 *
 * The light's "height above the sprite plane" is encoded as a small
 * fraction of the light's radius (default `0.075`) so that lights
 * exactly at a fragment's screen position don't produce degenerate
 * flat shading.
 * @param {number} maxTextures - the number of color/normal texture units to support
 * @returns {string} GLSL fragment shader source
 * @ignore
 */
export function buildLitMultiTextureFragment(maxTextures) {
	const count = Math.max(maxTextures, 1);
	const lines = [];

	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uSampler" + i + ";");
	}
	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uNormalSampler" + i + ";");
	}

	lines.push("uniform int uLightCount;");
	// pos = (x, y, radius, intensity) packed into a vec4 for fewer uniforms
	lines.push("uniform vec4 uLightPos[" + MAX_LIGHTS + "];");
	lines.push("uniform vec3 uLightColor[" + MAX_LIGHTS + "];");
	lines.push("uniform float uLightHeight[" + MAX_LIGHTS + "];");
	lines.push("uniform vec3 uAmbient;");

	lines.push("varying vec4 vColor;");
	lines.push("varying vec2 vRegion;");
	lines.push("varying float vTextureId;");
	lines.push("varying float vNormalTextureId;");
	lines.push("varying vec2 vWorldPos;");
	lines.push("");
	lines.push("void main(void) {");
	lines.push("    vec4 color;");

	lines.push(...buildSamplerSelect("vTextureId", "uSampler", count, "color"));

	// unlit fast path: a quad without `normalMap` is in this batch only
	// because some other quad in the same batch needed lighting; bail
	// out before sampling the normal map and running the lit math.
	lines.push("    if (vNormalTextureId < -0.5) {");
	lines.push("        gl_FragColor = color * vColor;");
	lines.push("        return;");
	lines.push("    }");

	lines.push("    vec4 normalSample;");
	lines.push(
		...buildSamplerSelect(
			"vNormalTextureId",
			"uNormalSampler",
			count,
			"normalSample",
		),
	);
	// Decode 0..1 → -1..1. Normal maps emitted by SpriteIlluminator (and
	// most 3D authoring tools) use Y-up convention, but screen-space
	// here is Y-down — flip the Y component so `dot(normal, lightDir)`
	// is computed in a single coherent coord system.
	lines.push(
		"    vec3 normal = normalize(normalSample.rgb * 2.0 - vec3(1.0));",
	);
	lines.push("    normal.y = -normal.y;");

	lines.push("    vec3 lighting = uAmbient;");
	lines.push("    for (int i = 0; i < " + MAX_LIGHTS + "; i++) {");
	lines.push("        if (i >= uLightCount) break;");
	lines.push("        vec4 lp = uLightPos[i];");
	lines.push("        vec2 toLight = lp.xy - vWorldPos;");
	lines.push("        float dist = length(toLight);");
	// quadratic attenuation over [0, radius]: gives a wider plateau near
	// the cursor and a softer feathered edge than the linear formula
	lines.push("        float linear = max(0.0, 1.0 - dist / max(lp.z, 1.0));");
	lines.push("        float att = linear * linear;");
	lines.push(
		"        vec3 lightDir = normalize(vec3(toLight, uLightHeight[i]));",
	);
	lines.push("        float NdotL = max(0.0, dot(normal, lightDir));");
	lines.push("        lighting += uLightColor[i] * (lp.w * att * NdotL);");
	lines.push("    }");

	lines.push(
		"    gl_FragColor = vec4(color.rgb * lighting, color.a) * vColor;",
	);
	lines.push("}");

	return lines.join("\n");
}
