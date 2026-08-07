#version 300 es
// Lit mesh fragment shader: half-Lambert diffuse from directional lights
// plus an ambient floor.
//
// GLSL ES 3.00 because the light data arrives in a uniform block, which does
// not exist in ES 1.00. That is what lifted the light cap: uniform arrays are
// charged against MAX_FRAGMENT_UNIFORM_VECTORS, a small driver-reported
// budget, while a block is charged against MAX_UNIFORM_BLOCK_SIZE.
//
// `__MAX_LIGHTS__` is replaced with the MAX_LIGHTS constant
// (src/video/webgl/lighting/constants.ts) by LitMeshBatcher._shaderSources at
// load time, so the array size can't drift from the uniform packer. (Used
// directly rather than via a #define so it survives the GLSL preprocessor
// regardless of how it handles macros.)
//
// The block's layout is std140 and is written by
// src/video/webgl/lighting/std140.ts. The two must agree byte for byte — a
// mismatch does not fail to link, it silently shifts every light.
//
// No `precision` line here on purpose: `setPrecision` injects float and int
// precision after `#version`, using whatever the device reports and the
// application asked for, so shader files don't hardcode it.

uniform sampler2D uSampler;
uniform float uAlphaCutoff;               // alpha cutout threshold (0 = disabled)
uniform vec3 uEmissive;                   // self-illumination color (0 = none)

// One light, type inferred from sentinels (see std140.ts):
// posRange.w < 0 -> directional (dirCone.xyz = surface->light, normalized);
// otherwise positional at posRange.xyz with quadratic falloff over
// posRange.w, plus a spot cone when dirCone.w > -1 (dirCone.xyz = the cone
// axis / travel direction, w = cos(outer), colorInner.w = cos(inner)).
// colorInner.rgb is premultiplied by intensity.
struct Light3dData {
    vec4 posRange;
    vec4 dirCone;
    vec4 colorInner;
};

layout(std140) uniform Light3dBlock {
    // `count` is a float: mixing int and float members would stop the staging
    // buffer being a single Float32Array view, and the cast below is free. The
    // vec3 that follows aligns to 16 bytes, so the three floats after `count`
    // are padding either way.
    float uLightCount;
    vec3 uAmbient;
    Light3dData uLights[__MAX_LIGHTS__];
};

in vec4 vColor;
in vec2 vRegion;
in vec3 vNormal;
in vec3 vWorldPos;
#ifdef INSTANCE_DATA
// per-instance custom slot — read as emissive by this built-in shading
in vec4 vInstanceData;
#endif

out vec4 fragColor;

void main(void) {
    vec4 base = texture(uSampler, vRegion) * vColor;

    // hard alpha cutout (glTF alphaMode MASK) — discard before any shading
    // so cut-away texels cost nothing and never write depth.
    if (base.a < uAlphaCutoff) {
        discard;
    }

    vec3 N = normalize(vNormal);
    vec3 lit = uAmbient;
    // ES 3.00 allows a non-constant loop bound, so this runs exactly as many
    // iterations as there are live lights — unused capacity costs nothing,
    // which is what makes a larger cap safe.
    // clamped to the array size, not just taken on trust: if the block ever
    // read as something other than what the writer put there, an unbounded
    // trip count would also index `uLights` out of range
    int count = min(int(uLightCount), __MAX_LIGHTS__);
    for (int i = 0; i < count; i++) {
        vec4 pr = uLights[i].posRange;
        vec4 dc = uLights[i].dirCone;
        vec3 L;
        float atten = 1.0;
        if (pr.w < 0.0) {
            // directional: dirCone.xyz is already the surface->light vector
            L = dc.xyz;
        } else {
            // positional: quadratic falloff over range (the Light2d model —
            // stylized, not physical inverse-square, which is unusable in
            // pixel-unit worlds with unit intensities)
            vec3 toLight = pr.xyz - vWorldPos;
            float dist = max(length(toLight), 1e-4);
            L = toLight / dist;
            float linearAtt = max(0.0, 1.0 - dist / pr.w);
            atten = linearAtt * linearAtt;
            if (dc.w > -1.0) {
                // spot cone: -L is the light->surface direction; fade from
                // the inner cone cosine to the outer
                float cd = dot(-L, dc.xyz);
                atten *= smoothstep(dc.w, uLights[i].colorInner.w, cd);
            }
        }
        // Half-Lambert ("wrap") diffuse: dot * 0.5 + 0.5. Softens the
        // terminator and lifts the shadowed side, for a gentler, more
        // diffuse look than hard Lambert (which reads as harsh noon).
        float ndl = dot(N, L) * 0.5 + 0.5;
        lit += uLights[i].colorInner.rgb * (ndl * ndl * atten);
    }

    // emissive self-illuminates: added AFTER lighting so it glows at full
    // strength regardless of the scene lights (neon, lava, glowing eyes).
    vec3 emissive = uEmissive;
#ifdef INSTANCE_DATA
    emissive += vInstanceData.rgb;
#endif
    fragColor = vec4(base.rgb * lit + emissive, base.a);
}
