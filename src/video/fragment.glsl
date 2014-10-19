precision mediump float;
varying vec2 vTexCoord;
uniform vec4 uColor;
uniform sampler2D texture;

void main(void) {
    gl_FragColor = texture2D(texture, vec2(vTexCoord.s, vTexCoord.t)) * uColor;
}
