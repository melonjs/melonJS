/**
 * Where an effect is on the renderable it draws: the space a built-in effect
 * places its pattern in (a sway's planted row, a shine's sweep, a
 * vignette's centre), and the one `noise_uv` runs across on a pass over a
 * render target.
 *
 * An effect is handed `uv`, the coordinate it samples its texture at. That
 * runs 0..1 across the renderable only for a sprite with its own texture
 * drawing it alone. A sprite cut from an atlas gets the atlas's UVs, and a
 * renderable with two or more effects runs them over a capture the size of
 * the canvas, which gets the canvas's (#1407). So a body reads, rather than
 * `uv`:
 *
 * - `ME_local`: 0..1 across the renderable, following its art (mirrored
 *   with a flip, turned with a rotation).
 * - `ME_art`: the coordinate its texture has there, for a pattern measured
 *   in the texture (a dissolve's grain, a hologram's lines, a wave's
 *   phase): `uv` itself wherever `uv` is the texture's.
 * - `ME_localToUV(d)`, `ME_artToUV(d)`, `ME_localToArt(d)`: a displacement
 *   in one of those, in another, to move where the body samples.
 *
 * Three modes, in `ME_mode`:
 *
 * - 0, the default: what `uv` always was. `ME_local` is `uv`, top to bottom
 *   (`ME_ydir` says when the texture runs bottom-up, as a capture does on
 *   WebGL), and `ME_art` is `uv`. Any path that sets nothing keeps it: a
 *   camera's effects, `drawLight`, a mesh, a layer.
 * - 1, a renderable drawn with its one effect: `ME_local` from the vertex's
 *   position through the renderable's own transform (`ME_local_x`,
 *   `ME_local_y`, target pixels to 0..1), so it runs across the whole
 *   renderable even when it is drawn in several quads. `ME_art` stays `uv`,
 *   and `ME_to_uv` turns a local displacement into one of `uv`.
 * - 2, a pass of a renderable's effect chain: `ME_local` the same way, over
 *   the capture, and `ME_art` the renderable's frame in its texture
 *   (`ME_art_rect`, origin and size) at that point. `noise_uv` is
 *   `ME_local` too, so it runs across the renderable as it does when the
 *   renderable is drawn with its one effect.
 *
 * The renderer works the values out for each renderable (see
 * `Renderer#_setEffectSpace`) and the batchers hand them over for a pass;
 * `ShaderEffect#_setLocalSpace` writes them.
 * @ignore
 */

/**
 * a body reading the renderable's own space
 * @ignore
 * @internal
 */
export const LOCAL_SPACE_IDENTIFIER = /\bME_(?:local|art)\w*\b/;

/**
 * the modes (see the module header)
 * @ignore
 * @internal
 */
export const LOCAL_MODE = { uv: 0, sprite: 1, chain: 2 };

/**
 * The CPU mirror of the WGSL `MEBuiltins` block, in floats: `noise_uv`'s
 * rect first (object size, image size, offset), then the local space.
 * @ignore
 * @internal
 */
export const ME_LAYOUT = {
	sizeObj: 0,
	sizeImg: 2,
	offset: 4,
	mode: 6,
	ydir: 7,
	localX: 8,
	localY: 12,
	toUV: 16,
	art: 20,
	// floats; 96 bytes
	length: 24,
};

/**
 * the uniforms both stages of a GLSL body read
 * @ignore
 * @internal
 */
const GLSL_SHARED = ["uniform float ME_mode;", "uniform float ME_ydir;"];

/**
 * The vertex-stage declarations of a GLSL body using `noise_uv` and/or the
 * local space.
 * @param {{noiseUV: boolean, local: boolean}} builtins - what the body uses
 * @returns {string[]} the lines
 * @ignore
 * @internal
 */
export function localVertexDeclarationsGLSL(builtins) {
	return [
		...GLSL_SHARED,
		"uniform vec3 ME_local_x;",
		"uniform vec3 ME_local_y;",
		...(builtins.local
			? [
					"uniform vec4 ME_art_rect;",
					"varying vec2 ME_local;",
					"varying vec2 ME_art;",
				]
			: []),
	];
}

/**
 * The vertex-stage statements: `ME_px`, the vertex in the renderable's own
 * space, and the varyings that come from it.
 * @param {{noiseUV: boolean, local: boolean}} builtins - what the body uses
 * @returns {string[]} the lines
 * @ignore
 * @internal
 */
export function localVertexStatementsGLSL(builtins) {
	return [
		"    vec3 ME_v = vec3(aVertex.xy, 1.0);",
		"    vec2 ME_px = vec2(dot(ME_local_x, ME_v), dot(ME_local_y, ME_v));",
		...(builtins.local
			? [
					"    ME_local = ME_mode > 0.5 ? ME_px : vec2(aRegion.x, ME_ydir < 0.0 ? 1.0 - aRegion.y : aRegion.y);",
					"    ME_art = ME_mode > 1.5 ? ME_art_rect.xy + ME_px * ME_art_rect.zw : aRegion;",
				]
			: []),
	];
}

/**
 * the `noise_uv` statement: across the renderable on a pass of its chain,
 * the frame's own rect otherwise (as it always was)
 * @ignore
 * @internal
 */
export const NOISE_UV_GLSL =
	"    noise_uv = ME_mode > 1.5 ? ME_px : aRegion * (ME_size_img / ME_size_obj) - ME_offset / ME_size_obj;";

/**
 * The fragment-stage declarations and helpers of a GLSL body reading the
 * local space.
 * @ignore
 * @internal
 */
export const LOCAL_FRAGMENT_GLSL = [
	...GLSL_SHARED,
	"uniform vec4 ME_to_uv;",
	"uniform vec4 ME_art_rect;",
	"varying vec2 ME_local;",
	"varying vec2 ME_art;",
	"vec2 ME_localToUV(vec2 d) {",
	"    if (ME_mode > 0.5) {",
	"        return mat2(ME_to_uv.xy, ME_to_uv.zw) * d;",
	"    }",
	"    return vec2(d.x, ME_ydir < 0.0 ? -d.y : d.y);",
	"}",
	"vec2 ME_artToUV(vec2 d) {",
	"    return ME_mode > 1.5 ? mat2(ME_to_uv.xy, ME_to_uv.zw) * (d / ME_art_rect.zw) : d;",
	"}",
	"vec2 ME_localToArt(vec2 d) {",
	"    return ME_mode > 1.5 ? d * ME_art_rect.zw : ME_localToUV(d);",
	"}",
].join("\n");

/**
 * The WGSL `MEBuiltins` struct (see ME_LAYOUT).
 * @ignore
 * @internal
 */
export const ME_STRUCT_WGSL = [
	"struct MEBuiltins {",
	"\tsize_obj : vec2f,",
	"\tsize_img : vec2f,",
	"\toffset : vec2f,",
	"\tmode : f32,",
	"\tydir : f32,",
	"\tlocal_x : vec4f,",
	"\tlocal_y : vec4f,",
	"\tto_uv : vec4f,",
	"\tart : vec4f,",
	"};",
];

/**
 * the WGSL vertex-stage statements (see localVertexStatementsGLSL)
 * @param {{noiseUV: boolean, local: boolean}} builtins - what the body uses
 * @returns {string[]} the lines
 * @ignore
 * @internal
 */
export function localVertexStatementsWGSL(builtins) {
	return [
		"\tlet meV = vec3f(aVertex.xy, 1.0);",
		"\tlet mePx = vec2f(dot(ME.local_x.xyz, meV), dot(ME.local_y.xyz, meV));",
		...(builtins.local
			? [
					"\tout.vLocal = select(vec2f(aRegion.x, select(aRegion.y, 1.0 - aRegion.y, ME.ydir < 0.0)), mePx, ME.mode > 0.5);",
					"\tout.vArt = select(aRegion, ME.art.xy + mePx * ME.art.zw, ME.mode > 1.5);",
				]
			: []),
		...(builtins.noiseUV
			? [
					"\tout.vNoiseUV = select(aRegion * (ME.size_img / ME.size_obj) - ME.offset / ME.size_obj, mePx, ME.mode > 1.5);",
				]
			: []),
	];
}

/**
 * the WGSL module-scope privates and helpers of a body reading the local
 * space
 * @ignore
 * @internal
 */
export const LOCAL_HELPERS_WGSL = [
	"var<private> ME_local : vec2f;",
	"var<private> ME_art : vec2f;",
	"fn ME_localToUV(d : vec2f) -> vec2f {",
	"\tif (ME.mode > 0.5) {",
	"\t\treturn mat2x2f(ME.to_uv.xy, ME.to_uv.zw) * d;",
	"\t}",
	"\treturn vec2f(d.x, select(d.y, -d.y, ME.ydir < 0.0));",
	"}",
	"fn ME_artToUV(d : vec2f) -> vec2f {",
	"\tif (ME.mode > 1.5) {",
	"\t\treturn mat2x2f(ME.to_uv.xy, ME.to_uv.zw) * (d / ME.art.zw);",
	"\t}",
	"\treturn d;",
	"}",
	"fn ME_localToArt(d : vec2f) -> vec2f {",
	"\tif (ME.mode > 1.5) {",
	"\t\treturn d * ME.art.zw;",
	"\t}",
	"\treturn ME_localToUV(d);",
	"}",
];

/**
 * What a mesh hosting a body reading the local space gives it: `uv`, as it
 * always did, and displacements left as they are. A mesh has no renderable
 * space of its own to offer (see mesh_splice.js).
 * @ignore
 * @internal
 */
export const LOCAL_MESH_SHIM_GLSL = [
	"vec2 ME_local;",
	"vec2 ME_art;",
	"vec2 ME_localToUV(vec2 d) { return d; }",
	"vec2 ME_artToUV(vec2 d) { return d; }",
	"vec2 ME_localToArt(vec2 d) { return d; }",
].join("\n");

/**
 * the WGSL twin of LOCAL_MESH_SHIM_GLSL
 * @ignore
 * @internal
 */
export const LOCAL_MESH_SHIM_WGSL = [
	"var<private> ME_local : vec2f;",
	"var<private> ME_art : vec2f;",
	"fn ME_localToUV(d : vec2f) -> vec2f { return d; }",
	"fn ME_artToUV(d : vec2f) -> vec2f { return d; }",
	"fn ME_localToArt(d : vec2f) -> vec2f { return d; }",
].join("\n");
