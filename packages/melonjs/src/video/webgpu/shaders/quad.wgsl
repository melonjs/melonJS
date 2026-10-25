// melonJS WebGPU quad shader — the WGSL port of quad-multi.vert /
// multitexture.frag: MULTI-TEXTURE batching, eight texture+sampler slots
// per draw segment. `aTextureId` selects the slot per quad, so a segment
// flushes only when a NINTH distinct texture appears (or on the usual
// blend/effect/capacity boundaries) — the GL sampler-ladder equivalent.
//
// Vertex layout (36-byte stride, frozen, shared with the WebGL backend):
//   @location(0) aVertex    float32x3  offset 0
//   @location(1) aRegion    float32x2  offset 12
//   @location(2) aColor     unorm8x4   offset 20
//   @location(3) aTextureId float32    offset 24 (slot index, 0..7)
//   @location(4) aFrame     float32x2  offset 28 (the opposite corner's UV)
//
// aColor arrives from a packed ARGB uint32 (Color.toUint32). Little-endian
// memory bytes are [B,G,R,A] and unorm8x4 maps byte i -> component i, so the
// attribute reads (B,G,R,A) — the same .bgr swizzle as the GLSL sources
// reconstructs RGB, premultiplied by alpha.
//
// Sampling uses textureSampleGrad with derivatives taken before the slot
// switch: the slot index is not uniform across the draw, which bars an
// implicit-derivative textureSample under WGSL's uniformity analysis. A slot
// samples its mip chain only under the "linear-mipmap" filter; every other
// sampler is lod-clamped to level 0.
//
// Under that filter each sample also stays inside the quad's frame, half a
// texel of the deepest level it reads in from the frame's edge: a sprite cut
// from an atlas or a tileset draws one frame of a bigger texture, and a
// small level's texels reach into the next frame. The frame is the vertex's
// own UV and `aFrame`, the opposite corner's; a quad with no frame (a
// repeating pattern) carries a sentinel far below zero and is left alone.
// GL twin: webgl/shaders/frameclamp.js.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
	// how each sample keeps inside the quad's frame (gpu/frame.js): 0 not,
	// 1 half a texel of the full-size art (a tile layer drawn tile by tile),
	// 2 half a texel of the level read ("linear-mipmap"). Rides in the
	// block's padding: the struct is 80 bytes either way
	frameClamp : f32,
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
	// the quad's frame (left, top, right, bottom), the same at all four
	// corners
	@location(3) vFrame : vec4f,
	// 1 when the clamp follows the mipmap level read, 0 at the full size
	@location(4) @interpolate(flat) vFrameLevels : f32,
};

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aRegion : vec2f,
	@location(2) aColor : vec4f,
	@location(3) aTextureId : f32,
	@location(4) aFrame : vec2f,
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
	// unbounded when the quad has no frame, or the clamp is off (the frame
	// globals are bound to the vertex stage only)
	out.vFrame = select(
		vec4f(min(aRegion, aFrame), max(aRegion, aFrame)),
		vec4f(-1.0e6, -1.0e6, 1.0e6, 1.0e6),
		aFrame.x < -5.0e5 || uFrame.frameClamp < 0.5,
	);
	out.vFrameLevels = select(0.0, 1.0, uFrame.frameClamp > 1.5);
	return out;
}

// `uv` kept inside `frame`, half a texel of the deepest level read in from
// its edge, unless the frame is unbounded (no frame, or the clamp off).
// `size` is the texture's level-0 size
fn frameUV(uv : vec2f, frame : vec4f, size : vec2f, dx : vec2f, dy : vec2f, levels : f32) -> vec2f {
	if (frame.x < -5.0e5) {
		return uv;
	}
	// the next level up once past a whole level, by more than a rounding
	// error: drawn at its size, the derivatives are 1 give or take a few
	// ulps. Without mipmaps, the full-size art is the only level
	let lod = select(
		0.0,
		ceil(log2(max(max(length(dx * size), length(dy * size)), 1.0)) - 0.01),
		levels > 0.5,
	);
	// half a texel of it, never past the frame's centre
	let inset = min(vec2f(0.5 * exp2(lod)) / size, (frame.zw - frame.xy) * 0.5);
	return clamp(uv, frame.xy + inset, frame.zw - inset);
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let uv = in.vRegion;
	// explicit gradients, taken here while control flow is uniform: the
	// slot switch below is not, which bars an implicit-derivative sample.
	// A slot's sampler without mipmaps clamps to level 0, as before
	let dx = dpdx(uv);
	let dy = dpdy(uv);
	var color : vec4f;
	switch i32(in.vTextureId + 0.5) {
		case 1: {
			color = textureSampleGrad(uTexture1, uSampler1, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture1, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		case 2: {
			color = textureSampleGrad(uTexture2, uSampler2, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture2, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		case 3: {
			color = textureSampleGrad(uTexture3, uSampler3, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture3, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		case 4: {
			color = textureSampleGrad(uTexture4, uSampler4, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture4, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		case 5: {
			color = textureSampleGrad(uTexture5, uSampler5, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture5, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		case 6: {
			color = textureSampleGrad(uTexture6, uSampler6, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture6, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		case 7: {
			color = textureSampleGrad(uTexture7, uSampler7, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture7, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
		default: {
			color = textureSampleGrad(uTexture0, uSampler0, frameUV(uv, in.vFrame, vec2f(textureDimensions(uTexture0, 0)), dx, dy, in.vFrameLevels), dx, dy);
		}
	}
	return color * in.vColor;
}
