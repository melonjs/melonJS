// melonJS WebGPU clear shader — a bufferless full-viewport triangle whose
// fragments are clipped by the CURRENT setScissorRect state and written with
// blending disabled (replace). The WebGPU equivalent of gl.clearColor +
// gl.clear inside an active scissor, which the API has no native op for:
// mid-frame clearColor (ColorLayer, Container backgrounds) draws this.

struct ClearUniforms {
	color : vec4f,
};

@group(0) @binding(0) var<uniform> uClear : ClearUniforms;

@vertex
fn vertex_main(@builtin(vertex_index) i : u32) -> @builtin(position) vec4f {
	var pos = array<vec2f, 3>(
		vec2f(-1.0, -1.0),
		vec2f(3.0, -1.0),
		vec2f(-1.0, 3.0),
	);
	return vec4f(pos[i], 0.0, 1.0);
}

@fragment
fn fragment_main() -> @location(0) vec4f {
	return uClear.color;
}
