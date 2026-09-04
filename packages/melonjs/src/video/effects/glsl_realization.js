import quadVertex from "../webgl/shaders/quad.vert";

/*
 * The GLSL realization of a ShaderEffect body — the pure source-assembly
 * half of the WebGL path, extracted verbatim so the neutral ShaderEffect
 * class can dispatch per backend while the emitted GLSL stays
 * byte-identical (pinned by tests/effects_golden_glsl.spec.js).
 *
 * ---- Shader builtins -------------------------------------------------------
 *
 * Inside a ShaderEffect fragment body, three names get special treatment so
 * users never compute screen/frame UVs by hand:
 *
 * - `uniform sampler2D <name> : screen_texture;` — the engine strips the
 *   annotation and keeps the sampler filled with a capture of everything
 *   drawn so far (a back-buffer copy, via the renderer's shared
 *   toFrameTexture slot). An optional wrap mode is accepted:
 *   `: screen_texture(repeat)`.
 * - `screen_uv`  — varying with this fragment's position in that capture
 *   (0..1 across the screen).
 * - `noise_uv`   — varying with a frame-local coordinate across the drawn
 *   object (undoes atlas packing; scaled to object pixels so patterns keep
 *   their density when the destination is scaled).
 *
 * The builtins only activate when referenced, and never when the body
 * carries its OWN declaration of the identifier — a shader that used these
 * names before this feature keeps compiling unchanged.
 */
const SCREEN_TEXTURE_ANNOTATION =
	/\buniform\s+sampler2D\s+([A-Za-z_]\w*)\s*:\s*screen_texture(?:\((repeat|repeat-x|repeat-y|no-repeat)\))?\s*;/g;
const SCREEN_UV_IDENTIFIER = /\bscreen_uv\b/;
const NOISE_UV_IDENTIFIER = /\bnoise_uv\b/;

/**
 * whether the body declares `name` itself (as a varying/uniform/attribute) —
 * the engine then leaves that identifier fully user-managed
 * @ignore
 * @internal
 */
function hasOwnDeclaration(source, name) {
	return new RegExp(
		`\\b(?:varying|uniform|attribute)\\s+\\w+\\s+${name}\\s*;`,
	).test(source);
}

/**
 * Parse the builtin usages out of a fragment body: collect and strip the
 * `: screen_texture` annotations, and detect the `screen_uv` / `noise_uv`
 * varyings. Bodies without builtins pass through byte-identical.
 * @ignore
 * @internal
 */
function parseShaderBuiltins(fragmentBody) {
	const screenTextures = [];
	const body = fragmentBody.replace(
		SCREEN_TEXTURE_ANNOTATION,
		(match, name, repeat = "no-repeat") => {
			screenTextures.push({ name, repeat });
			// keep the plain `uniform sampler2D <name>;` declaration
			return match.replace(/\s*:\s*screen_texture(?:\([\w-]+\))?/, "");
		},
	);
	const screenUV =
		(screenTextures.length > 0 || SCREEN_UV_IDENTIFIER.test(body)) &&
		!hasOwnDeclaration(body, "screen_uv");
	const noiseUV =
		NOISE_UV_IDENTIFIER.test(body) && !hasOwnDeclaration(body, "noise_uv");
	return { body, screenTextures, screenUV, noiseUV };
}

/**
 * The effect's vertex shader: the stock quad template, or — when a builtin
 * varying is in play — a variant that additionally computes `screen_uv`
 * (clip space → 0..1) and/or `noise_uv` (atlas UV → frame-local, fed by
 * `_setNoiseUVRect` through the `ME_*` uniforms). Built deterministically
 * from a template; user source is never rewritten.
 * @ignore
 * @internal
 */
function buildEffectVertex(builtins) {
	if (!builtins.screenUV && !builtins.noiseUV) {
		return quadVertex;
	}
	return [
		"attribute vec3 aVertex;",
		"attribute vec2 aRegion;",
		"attribute vec4 aColor;",
		"uniform mat4 uProjectionMatrix;",
		"varying vec2 vRegion;",
		"varying vec4 vColor;",
		...(builtins.screenUV ? ["varying vec2 screen_uv;"] : []),
		...(builtins.noiseUV
			? [
					"uniform vec2 ME_size_obj;",
					"uniform vec2 ME_size_img;",
					"uniform vec2 ME_offset;",
					"varying vec2 noise_uv;",
				]
			: []),
		"void main(void) {",
		"    vec4 ME_clip = uProjectionMatrix * vec4(aVertex, 1.0);",
		"    gl_Position = ME_clip;",
		...(builtins.screenUV
			? ["    screen_uv = ME_clip.xy / ME_clip.w * 0.5 + 0.5;"]
			: []),
		...(builtins.noiseUV
			? [
					"    noise_uv = aRegion * (ME_size_img / ME_size_obj) - ME_offset / ME_size_obj;",
				]
			: []),
		"    vColor = vec4(aColor.bgr * aColor.a, aColor.a);",
		"    vRegion = aRegion;",
		"}",
	].join("\n");
}

/**
 * Assemble the complete GLSL program sources for a ShaderEffect fragment
 * body: parse the builtins, build the vertex variant, and wrap the user's
 * `apply()` with the texture-sampling boilerplate.
 * @param {string} fragmentBody - the user body (GLSL, `vec4 apply(vec4, vec2)` convention)
 * @returns {{vertex: string, fragment: string, screenTextures: Array<{name: string, repeat: string}>, noiseUV: boolean}} the assembled sources + builtin usage
 * @ignore
 * @internal
 */
export function buildGLSLProgram(fragmentBody) {
	// Shader builtins: parse & strip `: screen_texture` annotations,
	// detect the free `screen_uv` / `noise_uv` varyings (see the module
	// header). A body using none of them passes through untouched.
	const builtins = parseShaderBuiltins(fragmentBody);

	// wrap the user's apply() with the texture-sampling boilerplate
	const fragment = [
		"uniform sampler2D uSampler;",
		"varying vec4 vColor;",
		"varying vec2 vRegion;",
		...(builtins.screenUV ? ["varying vec2 screen_uv;"] : []),
		...(builtins.noiseUV ? ["varying vec2 noise_uv;"] : []),
		builtins.body,
		"void main(void) {",
		"    vec4 texColor = texture2D(uSampler, vRegion) * vColor;",
		"    gl_FragColor = apply(texColor, vRegion);",
		"}",
	].join("\n");

	return {
		vertex: buildEffectVertex(builtins),
		fragment,
		screenTextures: builtins.screenTextures,
		noiseUV: builtins.noiseUV,
	};
}
