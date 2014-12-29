precision mediump float;

attribute vec2 aVertex;
attribute vec4 aColor;
attribute float aTexture;
attribute vec2 aRegion;

uniform mat3 uMatrix;

varying vec4 vColor;
varying float vTexture;
varying vec2 vRegion;

void main(void) {
    gl_Position = vec4((uMatrix * vec3(aVertex, 1)).xy, 0, 1);
    vColor = aColor;
    vTexture = aTexture;
    vRegion = aRegion;
}
