attribute vec2 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;

uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vColor;

void main(void) {
    // Transform the vertex position by the projection matrix
     gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.rgb * aColor.a, aColor.a);
    vRegion = aRegion;
}
