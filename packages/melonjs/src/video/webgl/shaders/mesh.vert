// Current vertex point (3D position for mesh rendering)
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;

// Projection matrix
uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vColor;

void main(void) {
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
}
