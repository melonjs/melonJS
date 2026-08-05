// melonJS WebGPU mip-chain blit — renders mip level N-1 into level N with
// linear filtering, one fullscreen triangle per level. Used by the texture
// store's mipmap generation (mesh-path textures); runs in its own encoder
// outside the frame's pass.

@group(0) @binding(0) var srcTexture : texture_2d<f32>;
@group(0) @binding(1) var srcSampler : sampler;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) uv : vec2f,
};

@vertex
fn vertex_main(@builtin(vertex_index) index : u32) -> VSOut {
	// bufferless fullscreen triangle; uv (0,0) lands on the attachment's
	// top-left texel so the downsample is orientation-preserving
	var out : VSOut;
	let x = f32((index << 1u) & 2u);
	let y = f32(index & 2u);
	out.uv = vec2f(x, y);
	out.position = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	// the bind group's view exposes exactly one level — level 0 of the view
	return textureSampleLevel(srcTexture, srcSampler, in.uv, 0.0);
}
