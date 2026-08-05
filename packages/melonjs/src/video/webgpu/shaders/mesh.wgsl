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
	// x = alpha cutout threshold (0 = disabled); y, z, w reserved
	params : vec4f,
	// self-illumination added on top (r, g, b; w reserved)
	emissive : vec4f,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;
@group(3) @binding(0) var<uniform> uMesh : MeshUniforms;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
};

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
	out.vRegion = aRegion;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	// sampled unconditionally, before the discard (uniform control flow)
	let color = textureSample(uTexture, uSampler, in.vRegion) * in.vColor;
	// hard alpha cutout (glTF alphaMode MASK): drop cut texels so foliage /
	// fences / decals read crisp without blending or sorting
	if (color.a < uMesh.params.x) {
		discard;
	}
	// emissive adds a self-lit color on top (neon, lava, screens); the
	// unlit path has no lighting, so it is simply added to the base color
	return vec4f(color.rgb + uMesh.emissive.rgb, color.a);
}
