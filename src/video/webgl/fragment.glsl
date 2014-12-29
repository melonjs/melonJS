precision mediump float;

// FIXME: Make number of samplers dynamic (rewrite at compile-time)
uniform sampler2D uSampler[16];

varying vec4 vColor;
varying float vTexture;
varying vec2 vRegion;

void main(void) {
    for (int i = 0; i < 16; i++) {
        if (vTexture == float(i)) {
            gl_FragColor = texture2D(uSampler[i], vec2(vRegion.s, vRegion.t)) * vColor;
            break;
        }
    }
}
