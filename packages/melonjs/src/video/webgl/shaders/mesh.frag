uniform sampler2D uSampler;
uniform float uAlphaCutoff;   // alpha cutout threshold (0 = disabled)
uniform vec3 uEmissive;       // self-illumination color added on top (0 = none)
uniform sampler2D uAlphaMap;  // per-texel opacity (MTL map_d)
uniform float uHasAlphaMap;   // 0 = uAlphaMap is filler, ignore it
varying vec4 vColor;
varying vec2 vRegion;
// Distance fog is a COMPILED VARIANT, not a runtime branch: the batcher
// injects `#define FOG` only while a camera has fog enabled. A software
// rasterizer predicates both sides of a branch, so an `exp()` guarded at
// runtime still costs every fragment of every scene — including the scenes
// that never asked for fog.
#ifdef FOG
uniform vec3 uFogColor;   // straight (unpremultiplied) fog colour
uniform vec4 uFogParams;  // x = mode (0 off / 1 linear / 2 exp2),
                          // y = near, z = 1/(far - near), w = density
varying float vFogDepth;  // radial view-space distance, interpolated

// Fold distance fog into a PREMULTIPLIED colour.
//
// `rgb` here is already multiplied by `a` (the vertex stage premultiplies
// vColor), so the fog colour has to be scaled by the fragment's own coverage.
// A plain mix toward uFogColor would paint full-strength fog onto
// near-transparent fragments — grey halos around every alpha-cutout leaf, and
// unattenuated fog added on the blended shadow pass.
//
// Mode 0 returns the input untouched, so a scene with no fog is bit-identical
// to one built before fog existed.
vec3 applyFog(vec3 rgb, float a) {
    float mode = uFogParams.x;
    if (mode < 0.5) {
        return rgb;
    }
    float f; // fraction of the scene colour that survives
    if (mode < 1.5) {
        // linear: 1 at `near`, reaching 0 at `far`
        f = 1.0 - clamp((vFogDepth - uFogParams.y) * uFogParams.z, 0.0, 1.0);
    } else {
        // exponential squared: survival = exp(-(density * d)^2)
        float dd = vFogDepth * uFogParams.w;
        f = exp(-dd * dd);
    }
    return mix(uFogColor * a, rgb, f);
}
#endif


#ifdef INSTANCE_DATA
// per-instance custom slot. The built-in shading reads its rgb as emissive,
// so a forest can glow per tree without a uniform per instance; a CUSTOM mesh
// shader is free to read the same slot as anything else entirely.
varying vec4 vInstanceData;
#endif

void main(void) {
    vec4 texel = texture2D(uSampler, vRegion);
    // per-texel opacity (MTL map_d) multiplies in BEFORE the cutout, so one
    // material can cut out to the shape of a leaf rather than at a single
    // threshold across the whole surface. Red channel: the format stores a
    // greyscale map, and every channel carries the same value.
    // Sampled unconditionally and WEIGHTED rather than branched: when no map
    // is bound the second sampler is filler (the diffuse texture), so the
    // value is thrown away — and both backends run the identical expression
    // instead of one branching and the other not.
    texel.a *= mix(1.0, texture2D(uAlphaMap, vRegion).r, uHasAlphaMap);
    // hard alpha cutout (glTF alphaMode MASK): drop fully-transparent texels
    // so foliage / fences / decals read crisp without blending or sorting.
    // Thresholded on the MATERIAL's own alpha, deliberately BEFORE the tint
    // multiply. The cutout describes the shape of the surface, and that shape
    // does not change when the object fades: testing the drawn alpha instead
    // makes a cutout mesh vanish completely the moment its opacity crosses its
    // own threshold — and `Sprite3d` defaults that threshold to 0.5, so half a
    // fade-out was a hard pop.
    if (texel.a < uAlphaCutoff) {
        discard;
    }
    vec4 color = texel * vColor;
    // emissive adds a self-lit color on top (neon, lava, screens); the unlit
    // path has no lighting, so it's simply added to the base color.
    vec3 emissive = uEmissive;
#ifdef INSTANCE_DATA
    emissive += vInstanceData.rgb;
#endif
#ifdef FOG
    gl_FragColor = vec4(applyFog(color.rgb + emissive, color.a), color.a);
#else
    gl_FragColor = vec4(color.rgb + emissive, color.a);
#endif
}
