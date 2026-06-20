uniform sampler2D uSampler;
uniform float uAlphaCutoff;   // alpha cutout threshold (0 = disabled)
varying vec4 vColor;
varying vec2 vRegion;

void main(void) {
    vec4 color = texture2D(uSampler, vRegion) * vColor;
    // hard alpha cutout (glTF alphaMode MASK): drop fully-transparent texels
    // so foliage / fences / decals read crisp without blending or sorting.
    if (color.a < uAlphaCutoff) {
        discard;
    }
    gl_FragColor = color;
}
