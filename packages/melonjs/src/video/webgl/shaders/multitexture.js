/**
 * Maximum number of `Light2d` instances the lit fragment shader supports
 * concurrently per draw call. Lights past this index are ignored.
 * @ignore
 */
export const MAX_LIGHTS = 8;

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
	// fallback to first sampler if the id is out of range
	lines.push(
		"        " + target + " = texture2D(" + samplerPrefix + "0, vRegion);",
	);
	lines.push("    }");
	return lines;
}

/**
 * Generates a multi-texture fragment shader source string.
 *
 * Two paths share the same shader:
 *
 * 1. **Unlit fast path** — when the per-vertex `vNormalTextureId` is
 *    negative, the shader just samples the color texture and outputs
 *    it (same instruction count as the legacy non-lit shader, plus
 *    one varying read + comparison — a uniform branch within a quad,
 *    so essentially free on modern GPUs).
 *
 * 2. **Lit path** — when `vNormalTextureId >= 0`, the shader samples
 *    the paired normal map at the same UVs, decodes the surface
 *    normal, and runs a Lambertian light loop over up to
 *    `MAX_LIGHTS` point lights uploaded as uniforms by the
 *    renderer/Stage. Result is the color texture multiplied by
 *    `ambient + Σ light_i`.
 *
 * The light's "height above the sprite plane" is encoded as a small
 * fraction of the light's radius (default `0.075`) so that lights
 * exactly at a fragment's screen position don't produce degenerate
 * flat shading; the value trades off realism for stability with
 * hand-painted normal maps.
 * @param {number} maxTextures - the number of color/normal texture units to support
 * @returns {string} GLSL fragment shader source
 * @ignore
 */
export function buildMultiTextureFragment(maxTextures) {
	const count = Math.max(maxTextures, 1);
	const lines = [];

	lines.push("precision highp float;");

	// color samplers (one per texture unit)
	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uSampler" + i + ";");
	}
	// paired normal-map samplers — bound only when a quad's
	// `aNormalTextureId` is >= 0 (i.e. the sprite has a normal map)
	for (let i = 0; i < count; i++) {
		lines.push("uniform sampler2D uNormalSampler" + i + ";");
	}

	// light uniforms (set per-camera by the renderer)
	lines.push("uniform int uLightCount;");
	// pos = (x, y, radius, intensity) packed into a vec4 for fewer uniforms
	lines.push("uniform vec4 uLightPos[" + MAX_LIGHTS + "];");
	lines.push("uniform vec3 uLightColor[" + MAX_LIGHTS + "];");
	lines.push("uniform vec3 uAmbient;");

	lines.push("varying vec4 vColor;");
	lines.push("varying vec2 vRegion;");
	lines.push("varying float vTextureId;");
	lines.push("varying float vNormalTextureId;");
	lines.push("varying vec2 vWorldPos;");
	lines.push("");
	lines.push("void main(void) {");
	lines.push("    vec4 color;");

	// sample the color texture (unlit + lit paths share this step)
	lines.push(...buildSamplerSelect("vTextureId", "uSampler", count, "color"));

	// unlit fast path: bail out before the lighting math
	lines.push("    if (vNormalTextureId < -0.5) {");
	lines.push("        gl_FragColor = color * vColor;");
	lines.push("        return;");
	lines.push("    }");

	// sample the normal map at the same UVs as the color texture
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

	// Lambertian accumulation. `lighting` starts at the ambient floor.
	lines.push("    vec3 lighting = uAmbient;");
	lines.push("    for (int i = 0; i < " + MAX_LIGHTS + "; i++) {");
	lines.push("        if (i >= uLightCount) break;");
	lines.push("        vec4 lp = uLightPos[i];");
	lines.push("        vec2 toLight = lp.xy - vWorldPos;");
	lines.push("        float dist = length(toLight);");
	// linear attenuation over [0, radius]; clamp to non-negative
	lines.push("        float att = max(0.0, 1.0 - dist / max(lp.z, 1.0));");
	// height z-component keeps near-center pixels from going dark
	lines.push("        float height = lp.z * 0.075;");
	lines.push("        vec3 lightDir = normalize(vec3(toLight, height));");
	lines.push("        float NdotL = max(0.0, dot(normal, lightDir));");
	lines.push("        lighting += uLightColor[i] * (lp.w * att * NdotL);");
	lines.push("    }");

	// modulate the color sample by accumulated lighting; preserve alpha
	lines.push(
		"    gl_FragColor = vec4(color.rgb * lighting, color.a) * vColor;",
	);
	lines.push("}");

	return lines.join("\n");
}
