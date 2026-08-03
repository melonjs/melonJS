// melonJS WebGPU lit quad shader — the WGSL port of quad-multi-lit.vert /
// multitexture-lit.js under this backend's single-texture-per-draw-segment
// model: ONE color texture and ONE normal map bound per flush (group 1),
// so the GL sampler ladder and the per-vertex normal-texture id are gone.
// The std140 Light2dBlock binds at group 2 with a dynamic offset — one
// snapshot per setLightUniforms call, per the queue-write ordering law.
//
// Vertex layout: the frozen 28-byte quad layout, unchanged.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
};

struct Light2dData {
	// x, y, radius, intensity
	posRadiusIntensity : vec4f,
	// r, g, b, lightHeight
	colorHeight : vec4f,
};

// the std140 layout published by src/video/webgl/lighting/std140.ts:
// header = count + pad (vec4), ambient rgb + pad (vec4), then 32 lights
// of 2 vec4 each — 1056 bytes total
struct Light2dBlock {
	countPad : vec4f,
	ambient : vec4f,
	lights : array<Light2dData, 32>,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;
@group(1) @binding(2) var uNormal : texture_2d<f32>;
@group(1) @binding(3) var uNormalSampler : sampler;
@group(2) @binding(0) var<uniform> uLights : Light2dBlock;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
	// pre-projection coordinates — the space packLights translates the
	// light positions into (world after the camera translate)
	@location(2) vWorldPos : vec2f,
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
	// GL-convention clip z in [-w, w] remapped to WebGPU's [0, w]
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	out.vColor = vec4f(aColor.bgr * aColor.a, aColor.a);
	out.vRegion = aRegion;
	out.vWorldPos = aVertex.xy;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let color = textureSample(uTexture, uSampler, in.vRegion);
	// the normal map is UV-paired with the color atlas — same vRegion
	let normalSample = textureSample(uNormal, uNormalSampler, in.vRegion);

	// Decode 0..1 -> -1..1. Normal maps use the Y-up authoring convention
	// but screen space here is Y-down — flip Y so dot(normal, lightDir)
	// runs in one coherent coordinate system (GL-backend parity).
	var normal = normalize(normalSample.rgb * 2.0 - vec3f(1.0));
	normal.y = -normal.y;

	var lighting = uLights.ambient.rgb;
	let count = min(i32(uLights.countPad.x), 32);
	for (var i = 0; i < count; i = i + 1) {
		let lp = uLights.lights[i].posRadiusIntensity;
		let ch = uLights.lights[i].colorHeight;
		let toLight = lp.xy - in.vWorldPos;
		let dist = length(toLight);
		// quadratic attenuation over [0, radius]: a wider plateau near the
		// light and a softer feathered edge than the linear formula
		let linearAtt = max(0.0, 1.0 - dist / max(lp.z, 1.0));
		let att = linearAtt * linearAtt;
		let lightDir = normalize(vec3f(toLight, ch.w));
		let ndotl = max(0.0, dot(normal, lightDir));
		lighting = lighting + ch.rgb * (lp.w * att * ndotl);
	}

	return vec4f(color.rgb * lighting, color.a) * in.vColor;
}
