uniform sampler2D uSampler;
uniform float uAlphaCutoff;   // alpha cutout threshold (0 = disabled)
uniform vec3 uEmissive;       // self-illumination color added on top (0 = none)
varying vec4 vColor;
varying vec2 vRegion;

void main(void) {
    vec4 color = texture2D(uSampler, vRegion) * vColor;
    // hard alpha cutout (glTF alphaMode MASK): drop fully-transparent texels
    // so foliage / fences / decals read crisp without blending or sorting.
    if (color.a < uAlphaCutoff) {
        discard;
    }
    // emissive adds a self-lit color on top (neon, lava, screens); the unlit
    // path has no lighting, so it's simply added to the base color.
    gl_FragColor = vec4(color.rgb + uEmissive, color.a);
}
