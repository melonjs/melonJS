// melonJS WebGPU lit mesh shader — the WGSL port of mesh-lit.vert /
// mesh-lit.frag: half-Lambert diffuse from directional Light3d lights plus
// an ambient floor, over the mesh tier's uniform-driven placement.
//
// Vertex layout (48-byte stride, shared with the WebGL backend): the
// 36-byte unlit layout plus
//   @location(3) aNormal float32x3 offset 36
// aNormal is MODEL-space on the retained path (rotated below by the model
// matrix's upper 3×3) and world-space on the accumulated path — which
// supplies an identity model matrix, so one shader serves both.
//
// The std140 Light3dBlock binds at group 2 with a dynamic offset — one
// snapshot per light change per frame, per the queue-write ordering law.
// Its layout is written by src/video/webgl/lighting/std140.ts and the two
// must agree byte for byte — a mismatch does not fail validation, it
// silently shifts every light.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block
	lineWidth : f32,
};

struct MeshUniforms {
	model : mat4x4<f32>,
	view : mat4x4<f32>,
	tint : vec4f,
	// x = alpha cutout threshold (0 = disabled); y, z, w reserved
	params : vec4f,
	// self-illumination added AFTER lighting (r, g, b; w reserved)
	emissive : vec4f,
};

// One light, type inferred from sentinels (see std140.ts):
// posRange.w < 0 → directional (dirCone.xyz = surface→light, normalized);
// otherwise positional at posRange.xyz with quadratic falloff over
// posRange.w, plus a spot cone when dirCone.w > -1 (dirCone.xyz = the
// cone axis / travel direction, w = cos(outer), colorInner.w =
// cos(inner)). colorInner.rgb is premultiplied by intensity.
struct Light3dData {
	posRange : vec4f,
	dirCone : vec4f,
	colorInner : vec4f,
};

// header = count + pad (vec4), ambient rgb + pad (vec4), then 32 lights
// of 3 vec4 each — 1568 bytes total (BLOCK3D_BYTES)
struct Light3dBlock {
	countPad : vec4f,
	ambient : vec4f,
	lights : array<Light3dData, 32>,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;
@group(2) @binding(0) var<uniform> uLights : Light3dBlock;
@group(3) @binding(0) var<uniform> uMesh : MeshUniforms;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
	@location(2) vNormal : vec3f,
	// world-space fragment position — positional lights (point / spot)
	// fall off with distance, so the fragment stage needs where the
	// surface IS
	@location(3) vWorldPos : vec3f,
};

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aRegion : vec2f,
	@location(2) aColor : vec4f,
	@location(3) aNormal : vec3f,
) -> VSOut {
	var out : VSOut;
	let worldPos = uMesh.model * vec4f(aVertex, 1.0);
	let clip = uFrame.projection * uMesh.view * worldPos;
	// GL-convention clip z in [-w, w] remapped to WebGPU's [0, w]
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	let tinted = aColor * uMesh.tint;
	out.vColor = vec4f(tinted.rgb * tinted.a, tinted.a);
	out.vRegion = aRegion;
	out.vWorldPos = worldPos.xyz;
	// Rotate the normal into world space with the model matrix's upper
	// 3×3. Lighting is evaluated in world space, so the view transform is
	// deliberately excluded. Uniform scale cancels when the fragment
	// renormalizes; non-uniform scale is approximated — an exact result
	// would need the inverse-transpose.
	let m = uMesh.model;
	out.vNormal = mat3x3f(m[0].xyz, m[1].xyz, m[2].xyz) * aNormal;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	// sampled unconditionally, before the discard (uniform control flow)
	let base = textureSample(uTexture, uSampler, in.vRegion) * in.vColor;
	// hard alpha cutout (glTF alphaMode MASK) — discard before any shading
	// so cut-away texels cost nothing and never write depth
	if (base.a < uMesh.params.x) {
		discard;
	}

	let n = normalize(in.vNormal);
	var lit = uLights.ambient.rgb;
	// clamped to the array size, not just taken on trust: if the block
	// ever read as something other than what the writer put there, an
	// unbounded trip count would also index out of range
	let count = min(i32(uLights.countPad.x), 32);
	for (var i = 0; i < count; i = i + 1) {
		let pr = uLights.lights[i].posRange;
		let dc = uLights.lights[i].dirCone;
		var lightDir : vec3f;
		var atten = 1.0;
		if (pr.w < 0.0) {
			// directional: dirCone.xyz is already the surface→light vector
			lightDir = dc.xyz;
		} else {
			// positional: quadratic falloff over range (the Light2d model —
			// stylized, not physical inverse-square, which is unusable in
			// pixel-unit worlds with unit intensities)
			let toLight = pr.xyz - in.vWorldPos;
			let dist = max(length(toLight), 1e-4);
			lightDir = toLight / dist;
			let linearAtt = max(0.0, 1.0 - dist / pr.w);
			atten = linearAtt * linearAtt;
			if (dc.w > -1.0) {
				// spot cone: -lightDir is the light→surface direction; fade
				// from the inner cone cosine to the outer
				let cd = dot(-lightDir, dc.xyz);
				atten = atten * smoothstep(dc.w, uLights.lights[i].colorInner.w, cd);
			}
		}
		// Half-Lambert ("wrap") diffuse: dot * 0.5 + 0.5, squared. Softens
		// the terminator and lifts the shadowed side — gentler than hard
		// Lambert, which reads as harsh noon.
		let ndl = dot(n, lightDir) * 0.5 + 0.5;
		lit = lit + uLights.lights[i].colorInner.rgb * (ndl * ndl * atten);
	}

	// emissive self-illuminates: added AFTER lighting so it glows at full
	// strength regardless of the scene lights (neon, lava, glowing eyes)
	return vec4f(base.rgb * lit + uMesh.emissive.rgb, base.a);
}
