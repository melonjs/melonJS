// melonJS WebGPU lit quad shader — the WGSL port of quad-multi-lit.vert /
// multitexture-lit.js under this backend's single-texture-per-draw-segment
// model: ONE color texture and ONE normal map bound per flush (group 1),
// so the GL sampler ladder and the per-vertex normal-texture id are gone.
// The std140 Light2dBlock binds at group 2 with a dynamic offset — one
// snapshot per setLightUniforms call, per the queue-write ordering law.
//
// Vertex layout: this family's OWN 40-byte `litQuad` layout — the quad
// layout (`aFrame` fifth, as in every sprite layout), then a per-quad
// `aShininess`, so unlit sprites are not charged for a term they never
// evaluate. Under "linear-mipmap" the color and normal samples stay inside
// the quad's frame, as in quad.wgsl.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
	// how each sample keeps inside the quad's frame (quad.wgsl, gpu/frame.js)
	frameClamp : f32,
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
	// specular exponent, flat across the quad; 0 = matte
	@location(3) vShininess : f32,
	// the quad's frame (left, top, right, bottom), the same at all corners
	@location(4) vFrame : vec4f,
	// 1 when the clamp follows the mipmap level read, 0 at the full size
	@location(5) @interpolate(flat) vFrameLevels : f32,
};

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aRegion : vec2f,
	@location(2) aColor : vec4f,
	@location(3) aTextureId : f32,
	@location(4) aFrame : vec2f,
	@location(5) aShininess : f32,
) -> VSOut {
	var out : VSOut;
	let clip = uFrame.projection * vec4f(aVertex, 1.0);
	// GL-convention clip z in [-w, w] remapped to WebGPU's [0, w]
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	out.vColor = vec4f(aColor.bgr * aColor.a, aColor.a);
	out.vRegion = aRegion;
	out.vWorldPos = aVertex.xy;
	out.vShininess = aShininess;
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
// its edge, unless the frame is unbounded (quad.wgsl's twin)
fn frameUV(uv : vec2f, frame : vec4f, size : vec2f, dx : vec2f, dy : vec2f, levels : f32) -> vec2f {
	if (frame.x < -5.0e5) {
		return uv;
	}
	let lod = select(
		0.0,
		ceil(log2(max(max(length(dx * size), length(dy * size)), 1.0)) - 0.01),
		levels > 0.5,
	);
	let inset = min(vec2f(0.5 * exp2(lod)) / size, (frame.zw - frame.xy) * 0.5);
	return clamp(uv, frame.xy + inset, frame.zw - inset);
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	// sampled with the unclamped UV's derivatives, so a clamped sample reads
	// the level the unclamped one would
	let dx = dpdx(in.vRegion);
	let dy = dpdy(in.vRegion);
	let uv = frameUV(in.vRegion, in.vFrame, vec2f(textureDimensions(uTexture, 0)), dx, dy, in.vFrameLevels);
	let color = textureSampleGrad(uTexture, uSampler, uv, dx, dy);
	// the normal map is UV-paired with the color atlas — same frame
	let normalSample = textureSampleGrad(uNormal, uNormalSampler, uv, dx, dy);

	// Decode 0..1 -> -1..1. Normal maps use the Y-up authoring convention
	// but screen space here is Y-down — flip Y so dot(normal, lightDir)
	// runs in one coherent coordinate system (GL-backend parity).
	var normal = normalize(normalSample.rgb * 2.0 - vec3f(1.0));
	normal.y = -normal.y;

	var lighting = uLights.ambient.rgb;
	// Specular accumulates SEPARATELY: it is light reflected OFF the surface,
	// not the surface's own colour lit up, so it is ADDED at the end rather
	// than multiplied into the albedo (which is why a glint blows out to
	// white on a dark sprite). GL twin: multitexture-lit.js.
	var specular = vec3f(0.0);
	// per-texel mask from the normal map's ALPHA — free, the sample is already
	// taken, and intact because normal maps upload with premultiply OFF
	let specMask = normalSample.a;
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
		// Blinn-Phong, gated on the exponent exactly as the mesh path gates
		// on `Ns`: zero is matte however bright the light, so a sprite that
		// never opts in runs what it always did.
		if (in.vShininess > 0.0) {
			// the view vector is a CONSTANT in 2D — a sprite lies in the
			// screen plane and the camera looks straight down -Z at it, so
			// there is no per-fragment world position to get wrong
			let halfVec = normalize(lightDir + vec3f(0.0, 0.0, 1.0));
			let ndoth = max(0.0, dot(normal, halfVec));
			// gate on the surface facing the light, or a back-facing texel
			// whose half-vector lines up picks up a highlight from behind
			let facing = step(0.0001, ndotl);
			specular = specular + ch.rgb * (lp.w * att * facing * specMask * pow(ndoth, in.vShininess));
		}
	}

	// `specular * color.a`: the pipeline is premultiplied, so the diffuse term
	// self-cancels where the sprite is transparent but an added highlight would
	// not. A normal map is usually opaque even where its diffuse is cut away.
	return vec4f(color.rgb * lighting + specular * color.a, color.a) * in.vColor;
}
