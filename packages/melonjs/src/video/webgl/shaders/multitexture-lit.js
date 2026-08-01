import { MAX_LIGHTS } from "../lighting/constants.ts";

/**
 * Build the GLSL `if/else` chain that picks among N samplers based on
 * an interpolated float texture-id. Dynamic indexing of a `sampler2D`
 * array is forbidden in GLSL ES 3.00 exactly as it was in 1.00, so this
 * stays an if-ladder using the usual `< i + 0.5` threshold pattern.
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
			"        " + target + " = texture(" + samplerPrefix + i + ", vRegion);",
		);
	}
	lines.push("    } else {");
	lines.push(
		"        " + target + " = texture(" + samplerPrefix + "0, vRegion);",
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
 * `QuadBatcher` shader is one interpolated read + one comparison per
 * fragment.
 *
 * The light's "height above the sprite plane" is encoded as a small
 * fraction of the light's radius (default `0.075`) so that lights
 * exactly at a fragment's screen position don't produce degenerate
 * flat shading.
 *
 * GLSL ES 3.00, because the light data arrives in a uniform block and
 * blocks do not exist in ES 1.00 (see #1552). The paired vertex shader
 * `quad-multi-lit.vert` is on the same version — both stages of a program
 * must agree.
 * @param {number} maxTextures - the number of color/normal texture units to support
 * @returns {string} GLSL fragment shader source
 * @ignore
 */
export function buildLitMultiTextureFragment(maxTextures) {
	const count = Math.max(maxTextures, 1);
	// `precision` is inserted after the version directive by
	// utils/precision.js, so it is deliberately not written here
	const lines = ["#version 300 es"];

	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uSampler" + i + ";");
	}
	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uNormalSampler" + i + ";");
	}

	// Light data arrives in a std140 uniform block rather than uniform
	// arrays. Arrays are charged against MAX_FRAGMENT_UNIFORM_VECTORS, a
	// small driver-reported budget that also has to cover the sampler set
	// above — which is what held the light cap at 8. The layout is written
	// by src/video/webgl/lighting/std140.ts and the two must agree byte for
	// byte: a mismatch links cleanly and shifts every light.
	lines.push("struct Light2dData {");
	// (x, y, radius, intensity) and (r, g, b, height): the scalars ride in
	// the w components a vec3 would have padded out anyway
	lines.push("    vec4 posRadiusIntensity;");
	lines.push("    vec4 colorHeight;");
	lines.push("};");
	lines.push("layout(std140) uniform Light2dBlock {");
	// float rather than int so the staging buffer stays one Float32Array
	lines.push("    float uLightCount;");
	lines.push("    vec3 uAmbient;");
	lines.push("    Light2dData uLights[" + MAX_LIGHTS + "];");
	lines.push("};");

	lines.push("in vec4 vColor;");
	lines.push("in vec2 vRegion;");
	lines.push("in float vTextureId;");
	lines.push("in float vNormalTextureId;");
	lines.push("in vec2 vWorldPos;");
	lines.push("out vec4 fragColor;");
	lines.push("");
	lines.push("void main(void) {");
	lines.push("    vec4 color;");

	lines.push(...buildSamplerSelect("vTextureId", "uSampler", count, "color"));

	// unlit fast path: a quad without `normalMap` is in this batch only
	// because some other quad in the same batch needed lighting; bail
	// out before sampling the normal map and running the lit math.
	lines.push("    if (vNormalTextureId < -0.5) {");
	lines.push("        fragColor = color * vColor;");
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
	// ES 3.00 permits a non-constant bound, so this runs exactly as many
	// iterations as there are live lights — unused capacity costs nothing
	lines.push("    int count = min(int(uLightCount), " + MAX_LIGHTS + ");");
	lines.push("    for (int i = 0; i < count; i++) {");
	lines.push("        vec4 lp = uLights[i].posRadiusIntensity;");
	lines.push("        vec2 toLight = lp.xy - vWorldPos;");
	lines.push("        float dist = length(toLight);");
	// quadratic attenuation over [0, radius]: gives a wider plateau near
	// the cursor and a softer feathered edge than the linear formula
	lines.push("        float linear = max(0.0, 1.0 - dist / max(lp.z, 1.0));");
	lines.push("        float att = linear * linear;");
	lines.push(
		"        vec3 lightDir = normalize(vec3(toLight, uLights[i].colorHeight.w));",
	);
	lines.push("        float NdotL = max(0.0, dot(normal, lightDir));");
	lines.push(
		"        lighting += uLights[i].colorHeight.rgb * (lp.w * att * NdotL);",
	);
	lines.push("    }");

	lines.push("    fragColor = vec4(color.rgb * lighting, color.a) * vColor;");
	lines.push("}");

	return lines.join("\n");
}
