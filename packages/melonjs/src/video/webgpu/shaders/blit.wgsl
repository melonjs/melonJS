// melonJS WebGPU blit shader — one source texture over the frozen quad
// vertex layout. The compositing primitive: render-target blits and the
// no-effect post-FX composite ride this family, which keeps the
// single-texture group-1 shape the effect scaffold shares (the QUAD family
// batches across eight textures and has its own group-1 layout).
//
// Vertex layout (28-byte stride, frozen, shared with the WebGL backend):
//   @location(0) aVertex    float32x3  offset 0
//   @location(1) aRegion    float32x2  offset 12
//   @location(2) aColor     unorm8x4   offset 20
//   @location(3) aTextureId float32    offset 24 (unused here)
//
// aColor arrives from a packed ARGB uint32 (Color.toUint32). Little-endian
// memory bytes are [B,G,R,A] and unorm8x4 maps byte i -> component i, so the
// attribute reads (B,G,R,A) — the same .bgr swizzle as the GLSL sources
// reconstructs RGB, premultiplied by alpha.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;

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
	@location(3) aTextureId : f32,
) -> VSOut {
	var out : VSOut;
	let clip = uFrame.projection * vec4f(aVertex, 1.0);
	// Matrix3d.ortho/perspective emit GL-convention clip z in [-w, w];
	// WebGPU clips z outside [0, w]. Without this remap any vertex with a
	// non-zero depth (Sprite3d, renderable.depth) is silently clipped away.
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	out.vColor = vec4f(aColor.bgr * aColor.a, aColor.a);
	out.vRegion = aRegion;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	return textureSample(uTexture, uSampler, in.vRegion) * in.vColor;
}
