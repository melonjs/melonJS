var glslify = require("glslify");
var createShader = glslify({
    fragment: "precision mediump float;" +
    "varying vec2 vTexCoord;" +
    "uniform vec4 uColor;" +
    "uniform sampler2D texture;" +

    "void main(void) {" +
    "   gl_FragColor = texture2D(texture, vec2(vTexCoord.s, vTexCoord.t)) * uColor;" +
    "}",
    vertex: "attribute vec2 aPosition;" +
    "attribute vec2 aTexture;" +
    "uniform mat3 uMatrix;" +
    "uniform mat3 pMatrix;" +
    "varying vec2 vTexCoord;" +

    "void main(void) {" +
    "   gl_Position = vec4((pMatrix * (uMatrix * vec3(aPosition, 1))).xy, 0, 1);" +
    "   vTexCoord = aTexture;" +
    "}",
    inline: true
});

module.exports = createShader;