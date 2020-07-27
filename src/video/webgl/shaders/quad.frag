uniform sampler2D uSampler;
varying vec4 vColor;
varying vec2 vRegion;

void main(void) {
    gl_FragColor = texture2D(uSampler, vRegion) * vColor;
}
