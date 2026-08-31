// melonJS WebGPU mesh shader — the WGSL port of mesh.vert / mesh.frag.
//
// Vertex layout (36-byte stride, shared with the WebGL backend):
//   @location(0) aVertex float32x3 offset 0
//   @location(1) aRegion float32x2 offset 12
//   @location(2) aColor  float32x4 offset 20
//
// aColor is four straight floats (R, G, B, A in [0, 1]) — NOT the quad
// tier's packed unorm8x4 — so no BGRA swizzle applies. The float layout is
// shared with the GL backend, where it exists to dodge NaN-pattern
// canonicalization on Metal-backed drivers.
//
// Placement is uniform-driven so retained geometry uploads once and reuses:
//   clip = projection × view × model × vertex
// One MeshUniforms snapshot binds per draw (group 3, dynamic offset — the
// queue-write ordering law: a shared region would be retroactively
// clobbered for draws already recorded). The accumulated path (2D camera,
// CPU-projected vertices) supplies an identity model matrix.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
};

struct MeshUniforms {
	// the mesh's own placement (axis bridge + mesh scale included)
	model : mat4x4<f32>,
	// the camera view plus any ancestor container transform
	view : mat4x4<f32>,
	// per-draw tint × global alpha (r, g, b, a) — kept out of the vertex
	// data so re-tinting never invalidates retained geometry
	tint : vec4f,
	// x = alpha cutout threshold (0 = disabled), y = 1 when an opacity map
	// is bound (0 = the second sampler is filler); z, w reserved
	params : vec4f,
	// self-illumination added on top (r, g, b; w reserved)
	emissive : vec4f,
	// specular color (rgb) and exponent (w); w = 0 means no highlight.
	// Unused by the unlit tier, present so both tiers share one block size.
	specular : vec4f,
	// the camera's world position (xyz; w reserved)
	eye : vec4f,
	// straight (unpremultiplied) fog colour (rgb; w reserved)
	fogColor : vec4f,
	// x = mode (0 off / 1 linear / 2 exp2), y = near, z = 1/(far - near),
	// w = density
	fogParams : vec4f,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;
// per-texel opacity (MTL map_d). When no map is bound this pair is filler —
// the diffuse texture again — and `params.y` is 0, so its sample is weighted
// away rather than branched around.
@group(1) @binding(2) var uAlphaMap : texture_2d<f32>;
@group(1) @binding(3) var uAlphaSampler : sampler;
@group(3) @binding(0) var<uniform> uMesh : MeshUniforms;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
	@location(2) vFogDepth : f32,
};

// Distance fog is behind a PIPELINE-OVERRIDABLE CONSTANT rather than a plain
// runtime test. `enable_fog` is fixed when the pipeline is created, so the
// implementation can fold the branch and drop the dead side — the same result
// the WebGL backend gets from `#define FOG`, without WGSL needing a
// preprocessor or the engine deriving a second module. A scene that never
// enables fog pays for none of the work below.
override enable_fog : bool = false;

// Fold distance fog into a PREMULTIPLIED colour. Twin of `applyFog` in the
// GLSL mesh shaders — keep the two in step. They are duplicated rather than
// shared because WGSL has no preprocessor and the production build loads each
// shader as raw text.
//
// `rgb` is already multiplied by `a`, so the fog colour must be scaled by the
// fragment's own coverage: a plain mix toward the fog colour would paint
// full-strength fog onto near-transparent fragments — grey halos around every
// alpha-cutout leaf.
//
// Mode 0 returns the input untouched, so a scene with no fog is bit-identical
// to one built before fog existed.
fn apply_fog(rgb : vec3f, a : f32, fogDepth : f32) -> vec3f {
	if (!enable_fog) {
		return rgb;
	}
	let mode = uMesh.fogParams.x;
	if (mode < 0.5) {
		return rgb;
	}
	var f : f32;
	if (mode < 1.5) {
		// linear: 1 at `near`, reaching 0 at `far`
		f = 1.0 - clamp((fogDepth - uMesh.fogParams.y) * uMesh.fogParams.z, 0.0, 1.0);
	} else {
		// exponential squared: survival = exp(-(density * d)^2)
		let dd = fogDepth * uMesh.fogParams.w;
		f = exp(-dd * dd);
	}
	return mix(uMesh.fogColor.rgb * a, rgb, f);
}

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aRegion : vec2f,
	@location(2) aColor : vec4f,
) -> VSOut {
	var out : VSOut;
	let clip =
		uFrame.projection * uMesh.view * uMesh.model * vec4f(aVertex, 1.0);
	// GL-convention clip z in [-w, w] remapped to WebGPU's [0, w]
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	// tint first, then premultiply — matches the fragment's expectation
	let tinted = aColor * uMesh.tint;
	out.vColor = vec4f(tinted.rgb * tinted.a, tinted.a);
	// Radial view-space distance for distance fog. Radial rather than view-space
	// z, so fog holds steady as the camera turns. The clip position above keeps
	// its own product: re-associating it could shift vertices by an ulp, and
	// fog-off output must stay bit-identical.
	// the slot is always declared — an override cannot remove an inter-stage
	// variable — but the work behind it folds away with the constant
	if (enable_fog) {
		let viewPos = uMesh.view * uMesh.model * vec4f(aVertex, 1.0);
		out.vFogDepth = length(viewPos.xyz);
	} else {
		out.vFogDepth = 0.0;
	}
	out.vRegion = aRegion;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	// sampled unconditionally, before the discard (uniform control flow)
	var color = textureSample(uTexture, uSampler, in.vRegion) * in.vColor;
	// Per-texel opacity (MTL map_d), applied BEFORE the cutout so one
	// material can cut out to the shape of a leaf rather than at a single
	// threshold across the whole surface. Sampled unconditionally and
	// WEIGHTED: with no map bound the second pair is filler, and this keeps
	// the sample in uniform control flow (and identical to the GLSL twin).
	color.a = color.a * mix(1.0, textureSample(uAlphaMap, uAlphaSampler, in.vRegion).r, uMesh.params.y);
	// hard alpha cutout (glTF alphaMode MASK): drop cut texels so foliage /
	// fences / decals read crisp without blending or sorting
	if (color.a < uMesh.params.x) {
		discard;
	}
	// emissive adds a self-lit color on top (neon, lava, screens); the
	// unlit path has no lighting, so it is simply added to the base color
	return vec4f(
		apply_fog(color.rgb + uMesh.emissive.rgb, color.a, in.vFogDepth),
		color.a
	);
}
