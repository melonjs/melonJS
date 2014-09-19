var glslify = require("glslify");
var fragmentShader =
    "precision mediump float;" +
    "varying vec2 vTexCoord0;" +
    "uniform vec4 uColor;" +
    "uniform sampler2D uTexture0;" +

    "void main(void) {" +
    "   gl_FragColor = texture2D(uTexture0, vTexCoord0) * uColor;" +
    "}"
;

var vertexShader =
    "attribute vec2 aPosition;" +
    "attribute vec2 aTexture0;" +
    "uniform mat3 uMatrix;" +
    "varying vec2 vTexCoord0;" +

    "void main(void) {" +
    "   gl_Position = vec4((uMatrix * vec3(aPosition, 1)).xy, 0, 1);" +
    "   vTexCoord0 = aTexture0;" +
    "}"
;
var createShader = glslify({
    vertex: vertexShader,
    fragment: fragmentShader,
    inline: true
});