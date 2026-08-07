uniform sampler2D uSampler;
uniform float uAlphaCutoff;   // alpha cutout threshold (0 = disabled)
uniform vec3 uEmissive;       // self-illumination color added on top (0 = none)
uniform sampler2D uAlphaMap;  // per-texel opacity (MTL map_d)
uniform float uHasAlphaMap;   // 0 = uAlphaMap is filler, ignore it
varying vec4 vColor;
varying vec2 vRegion;
#ifdef INSTANCE_DATA
// per-instance custom slot. The built-in shading reads its rgb as emissive,
// so a forest can glow per tree without a uniform per instance; a CUSTOM mesh
// shader is free to read the same slot as anything else entirely.
varying vec4 vInstanceData;
#endif

void main(void) {
    vec4 color = texture2D(uSampler, vRegion) * vColor;
    // per-texel opacity (MTL map_d) multiplies in BEFORE the cutout, so one
    // material can cut out to the shape of a leaf rather than at a single
    // threshold across the whole surface. Red channel: the format stores a
    // greyscale map, and every channel carries the same value.
    // Sampled unconditionally and WEIGHTED rather than branched: when no map
    // is bound the second sampler is filler (the diffuse texture), so the
    // value is thrown away — and both backends run the identical expression
    // instead of one branching and the other not.
    color.a *= mix(1.0, texture2D(uAlphaMap, vRegion).r, uHasAlphaMap);
    // hard alpha cutout (glTF alphaMode MASK): drop fully-transparent texels
    // so foliage / fences / decals read crisp without blending or sorting.
    if (color.a < uAlphaCutoff) {
        discard;
    }
    // emissive adds a self-lit color on top (neon, lava, screens); the unlit
    // path has no lighting, so it's simply added to the base color.
    vec3 emissive = uEmissive;
#ifdef INSTANCE_DATA
    emissive += vInstanceData.rgb;
#endif
    gl_FragColor = vec4(color.rgb + emissive, color.a);
}
