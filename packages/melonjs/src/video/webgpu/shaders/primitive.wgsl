// melonJS WebGPU primitive shader — the WGSL port of primitive.vert/.frag.
//
// Vertex layout (24-byte stride, frozen, shared with the WebGL backend):
//   @location(0) aVertex float32x3  offset 0
//   @location(1) aNormal float32x2  offset 12   (thick-line expansion dir)
//   @location(2) aColor  unorm8x4   offset 20   (packed ARGB — see quad.wgsl)
//
// uLineWidth lives in the shared frame-globals block: the batcher pushes a
// new dynamic-offset slot whenever renderer.lineWidth changes, replacing the
// per-program uLineWidth uniform of the GL backend.

struct FrameUniforms {
	projection : mat4x4<f32>,
	lineWidth : f32,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vColor : vec4f,
};

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aNormal : vec2f,
	@location(2) aColor : vec4f,
) -> VSOut {
	var out : VSOut;
	let position = aVertex.xy + aNormal * uFrame.lineWidth * 0.5;
	let clip = uFrame.projection * vec4f(position, aVertex.z, 1.0);
	// GL-convention clip z in [-w, w] -> WebGPU [0, w] (see quad.wgsl)
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	out.vColor = vec4f(aColor.bgr * aColor.a, aColor.a);
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	return in.vColor;
}
