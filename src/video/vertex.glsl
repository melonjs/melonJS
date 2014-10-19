attribute vec2 aPosition;
attribute vec2 aTexture;
uniform mat3 uMatrix;
uniform mat3 pMatrix;
varying vec2 vTexCoord;

void main(void) {
   gl_Position = vec4((pMatrix * (uMatrix * vec3(aPosition, 1))).xy, 0, 1);
   vTexCoord = aTexture;
}
