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
uniform vec3 uSpecular;                   // specular color (0 = purely diffuse)
uniform float uShininess;                 // specular exponent (0 = no highlight)
uniform vec3 uEyePosition;                // camera position, world space
uniform sampler2D uAlphaMap;              // per-texel opacity (MTL map_d)
uniform float uHasAlphaMap;               // 0 = uAlphaMap is filler, ignore it

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

    // per-texel opacity (MTL map_d) multiplies in BEFORE the cutout, so one
    // material can cut out to the shape of a leaf rather than at a single
    // threshold across the whole surface. Red channel: the format stores a
    // greyscale map, and every channel carries the same value.
    // Sampled unconditionally and WEIGHTED rather than branched: when no map
    // is bound the second sampler is filler (the diffuse texture), so the
    // value is thrown away — and both backends run the identical expression
    // instead of one branching and the other not.
    base.a *= mix(1.0, texture(uAlphaMap, vRegion).r, uHasAlphaMap);

    // hard alpha cutout (glTF alphaMode MASK) — discard before any shading
    // so cut-away texels cost nothing and never write depth.
    if (base.a < uAlphaCutoff) {
        discard;
    }

    // A mesh marked `lit` with no usable normals — the 2D-camera path,
    // which leaves world normals unwritten, or geometry that supplied none —
    // would normalize a zero vector to NaN and render BLACK. Degrade to
    // unlit instead: wrong, but recognisably the model rather than a hole.
    float nLength = length(vNormal);
    if (nLength < 1e-6) {
        // the emissive term is built exactly as the lit path below builds
        // it, per-instance slot included — degrading to unlit must not also
        // drop an instance's glow
        vec3 unlitEmissive = uEmissive;
#ifdef INSTANCE_DATA
        unlitEmissive += vInstanceData.rgb;
#endif
        fragColor = vec4(base.rgb + unlitEmissive, base.a);
        return;
    }
    vec3 N = vNormal / nLength;
    vec3 lit = uAmbient;
    // Blinn-Phong specular, accumulated alongside the diffuse term. Gated on
    // the exponent rather than the colour: `Ns` of 0 is the format's "no
    // highlight", and exporters happily write a non-black `Ks` next to it.
    // The half-vector form (rather than reflect()) is the cheaper of the two
    // and is what the fixed-function pipeline this format predates used.
    vec3 specular = vec3(0.0);
    bool hasSpecular = uShininess > 0.0;
    vec3 V = hasSpecular ? normalize(uEyePosition - vWorldPos) : vec3(0.0);
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
        if (hasSpecular) {
            // masked by the UNWRAPPED Lambert term: half-Lambert lifts the
            // shadowed side, and a highlight on a surface facing away from
            // the light reads as a rendering error
            float facing = max(dot(N, L), 0.0);
            vec3 H = normalize(L + V);
            float spec = pow(max(dot(N, H), 0.0), uShininess);
            specular += uLights[i].colorInner.rgb * (spec * facing * atten);
        }
    }

    // emissive self-illuminates: added AFTER lighting so it glows at full
    // strength regardless of the scene lights (neon, lava, glowing eyes).
    vec3 emissive = uEmissive;
#ifdef INSTANCE_DATA
    emissive += vInstanceData.rgb;
#endif
    fragColor = vec4(base.rgb * lit + specular * uSpecular + emissive, base.a);
}
