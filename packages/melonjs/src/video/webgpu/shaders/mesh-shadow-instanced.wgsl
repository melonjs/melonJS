// Instanced ground-shadow module (#1515) — the WGSL twin of
// `webgl/shaders/mesh-shadow-instanced.vert`.
//
// One flat blob per instance, drawn from the SAME instance buffer the mesh
// itself uses, so a forest of a hundred thousand trees costs one extra draw
// rather than a hundred thousand.
//
// Hand-written and STANDALONE, rather than derived from the mesh module by
// `buildInstancedMeshWGSL`. Deriving it would inherit three things it must
// not have: the `hasColor`/`hasData` variant matrix (this reads neither slot,
// so one module serves every record layout), the per-instance tint multiply
// and emissive substitution (which would give a forest coloured, glowing
// shadows), and the VSOut member-written guard, which on the lit tier
// requires a body that writes `vWorldPos` and `vNormal` — neither of which a
// flat unlit blob has any use for.
//
// The instance's rotation and vertical scale are DISCARDED: a blob lies flat
// however its tree is turned, and only the horizontal footprint sets its
// width. Translation and horizontal scale come straight out of the record's
// three rows with no matrix built. Flattening onto the ground is
// `uMesh.model`'s job — the caller passes the group matrix with its Y basis
// column zeroed and its translation Y set to the ground height.

struct FrameUniforms {
	projection : mat4x4<f32>,
	// unused by this shader; part of the shared frame-globals block. Its size
	// has to match the block the layout declares EXACTLY — a struct that reads
	// past `minBindingSize` is a pipeline-creation error, not a silent
	// over-read, and takes the whole frame's command buffer down with it.
	lineWidth : f32,
};

struct MeshUniforms {
	model : mat4x4<f32>,
	view : mat4x4<f32>,
	tint : vec4f,
	params : vec4f,
	emissive : vec4f,
	specular : vec4f,
	eye : vec4f,
	// straight (unpremultiplied) fog colour (rgb; w reserved)
	fogColor : vec4f,
	// x = mode (0 off / 1 linear / 2 exp2), y = near, z = 1/(far - near),
	// w = density
	fogParams : vec4f,
	// x = height falloff (0 = uniform), y = reference world Y,
	// z = the camera's world Y, w unused
	fogHeight : vec4f,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;
@group(1) @binding(2) var uAlphaMap : texture_2d<f32>;
@group(1) @binding(3) var uAlphaSampler : sampler;
@group(3) @binding(0) var<uniform> uMesh : MeshUniforms;

// Distance fog is behind a PIPELINE-OVERRIDABLE CONSTANT rather than a plain
// runtime test. `enable_fog` is fixed when the pipeline is created, so the
// implementation can fold the branch and drop the dead side — the same result
// the WebGL backend gets from `#define FOG`, without WGSL needing a
// preprocessor or the engine deriving a second module. A scene that never
// enables fog pays for none of the work below.
override enable_fog : bool = false;

// How much the height falloff scales the fog along this view ray. Twin of
// `fogHeightFactor` in the GLSL mesh shaders — keep them in step.
//
// Density falls off exponentially with altitude, and an exponential integrates
// analytically along a straight segment, so the ray costs one `exp` and no
// marching. The result multiplies the distance, leaving both curves untouched.
//
// Render space is Y-DOWN: density rises as `y` INCREASES, the opposite sign to
// every published form of this.
//
// A falloff of 0 gives exactly 1, so uniform fog is this with the dial at zero
// rather than a special case.
fn fog_height_factor(worldY : f32) -> f32 {
	let k = uMesh.fogHeight.x;
	let dy = worldY - uMesh.fogHeight.z;
	let kdy = k * dy;
	// (exp(x) - 1) / x is 0/0 at x = 0, which is a horizontal view ray — take
	// the limit rather than guarding, or the fog steps as the ray flattens
	var t = 1.0;
	if (abs(kdy) >= 1e-4) {
		t = (exp(kdy) - 1.0) / kdy;
	}
	// clamped: a camera far below the reference height would otherwise
	// overflow the exponential and whiten the frame
	return exp(clamp(k * (uMesh.fogHeight.z - uMesh.fogHeight.y), -30.0, 30.0)) * t;
}


struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
	// radial view-space distance for distance fog
	@location(2) vFogDepth : f32,
};

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aRegion : vec2f,
	@location(2) aColor : vec4f,
	@location(3) aInstanceRow0 : vec4f,
	@location(4) aInstanceRow1 : vec4f,
	@location(5) aInstanceRow2 : vec4f,
) -> VSOut {
	var out : VSOut;

	let instancePos = vec3f(aInstanceRow0.w, aInstanceRow1.w, aInstanceRow2.w);
	// column 0 of the instance basis is the X axis times its scale; a scatter
	// is rotated about the vertical axis, so its length is the horizontal
	// footprint whatever the rotation
	let footprint = length(
		vec3f(aInstanceRow0.x, aInstanceRow1.x, aInstanceRow2.x));

	// the quad is a unit square in the ground plane (XZ); its own Y is
	// irrelevant, because uMesh.model flattens it onto the floor
	let local = instancePos + vec3f(aVertex.x, 0.0, aVertex.z) * footprint;

	let clip = uFrame.projection * uMesh.view * uMesh.model * vec4f(local, 1.0);
	// WebGPU clip space is [0, w] in Z where GL is [-w, w]
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);

	let tinted = aColor * uMesh.tint;
	out.vColor = vec4f(tinted.rgb * tinted.a, tinted.a);
	// a blob fades with distance like the ground it lies on
	if (enable_fog) {
		let viewPos = uMesh.view * uMesh.model * vec4f(local, 1.0);
		out.vFogDepth = length(viewPos.xyz)
			* fog_height_factor((uMesh.model * vec4f(local, 1.0)).y);
	} else {
		out.vFogDepth = 0.0;
	}
	out.vRegion = aRegion;
	return out;
}

// Fold distance fog into a PREMULTIPLIED colour. Twin of `apply_fog` in
// mesh.wgsl — kept in step by hand (WGSL has no preprocessor, and the build
// loads shaders as raw text). Present here because on WebGL this vertex
// shader pairs with mesh.frag, which fogs; without this the two backends would
// disagree on whether distant shadows fade.
fn apply_fog(rgb : vec3f, a : f32, fogDepth : f32) -> vec3f {
	if (!enable_fog) {
		return rgb;
	}
	let mode = uMesh.fogParams.x;
	if (mode < 0.5) {
		return rgb;
	}
	var f : f32;
	if (mode < 1.5) {
		f = 1.0 - clamp((fogDepth - uMesh.fogParams.y) * uMesh.fogParams.z, 0.0, 1.0);
	} else {
		let dd = fogDepth * uMesh.fogParams.w;
		f = exp(-dd * dd);
	}
	return mix(uMesh.fogColor.rgb * a, rgb, f);
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let texel = textureSample(uTexture, uSampler, in.vRegion);
	let color = texel * in.vColor;
	return vec4f(apply_fog(color.rgb, color.a, in.vFogDepth), color.a);
}
