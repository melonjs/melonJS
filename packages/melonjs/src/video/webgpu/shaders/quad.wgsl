// melonJS WebGPU quad shader — the WGSL port of quad-multi.vert /
// multitexture.frag: MULTI-TEXTURE batching, eight texture+sampler slots
// per draw segment. `aTextureId` selects the slot per quad, so a segment
// flushes only when a NINTH distinct texture appears (or on the usual
// blend/effect/capacity boundaries) — the GL sampler-ladder equivalent.
//
// Vertex layout (28-byte stride, frozen, shared with the WebGL backend):
//   @location(0) aVertex    float32x3  offset 0
//   @location(1) aRegion    float32x2  offset 12
//   @location(2) aColor     unorm8x4   offset 20
//   @location(3) aTextureId float32    offset 24 (slot index, 0..7)
//
// aColor arrives from a packed ARGB uint32 (Color.toUint32). Little-endian
// memory bytes are [B,G,R,A] and unorm8x4 maps byte i -> component i, so the
// attribute reads (B,G,R,A) — the same .bgr swizzle as the GLSL sources
// reconstructs RGB, premultiplied by alpha.
//
// Sampling uses textureSampleLevel(…, 0.0): the slot index is not uniform
// across the draw, which bars implicit-derivative textureSample under WGSL's
// uniformity analysis — and 2D quads sample level 0 by contract anyway
// (their samplers are lod-clamped; mip chains are a mesh-path feature).

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture0 : texture_2d<f32>;
@group(1) @binding(1) var uTexture1 : texture_2d<f32>;
@group(1) @binding(2) var uTexture2 : texture_2d<f32>;
@group(1) @binding(3) var uTexture3 : texture_2d<f32>;
@group(1) @binding(4) var uTexture4 : texture_2d<f32>;
@group(1) @binding(5) var uTexture5 : texture_2d<f32>;
@group(1) @binding(6) var uTexture6 : texture_2d<f32>;
@group(1) @binding(7) var uTexture7 : texture_2d<f32>;
@group(1) @binding(8) var uSampler0 : sampler;
@group(1) @binding(9) var uSampler1 : sampler;
@group(1) @binding(10) var uSampler2 : sampler;
@group(1) @binding(11) var uSampler3 : sampler;
@group(1) @binding(12) var uSampler4 : sampler;
@group(1) @binding(13) var uSampler5 : sampler;
@group(1) @binding(14) var uSampler6 : sampler;
@group(1) @binding(15) var uSampler7 : sampler;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
	// constant across a quad's four vertices, so plain interpolation
	// reproduces it exactly; rounded back to the slot index per fragment
	@location(2) vTextureId : f32,
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
	out.vTextureId = aTextureId;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let uv = in.vRegion;
	var color : vec4f;
	switch i32(in.vTextureId + 0.5) {
		case 1: {
			color = textureSampleLevel(uTexture1, uSampler1, uv, 0.0);
		}
		case 2: {
			color = textureSampleLevel(uTexture2, uSampler2, uv, 0.0);
		}
		case 3: {
			color = textureSampleLevel(uTexture3, uSampler3, uv, 0.0);
		}
		case 4: {
			color = textureSampleLevel(uTexture4, uSampler4, uv, 0.0);
		}
		case 5: {
			color = textureSampleLevel(uTexture5, uSampler5, uv, 0.0);
		}
		case 6: {
			color = textureSampleLevel(uTexture6, uSampler6, uv, 0.0);
		}
		case 7: {
			color = textureSampleLevel(uTexture7, uSampler7, uv, 0.0);
		}
		default: {
			color = textureSampleLevel(uTexture0, uSampler0, uv, 0.0);
		}
	}
	return color * in.vColor;
}
