// Current vertex point
attribute vec2 aVertex;
// Per-vertex normal for line expansion
attribute vec2 aNormal;
attribute vec4 aColor;

// Projection matrix
uniform mat4 uProjectionMatrix;
// Line width for stroke expansion
uniform float uLineWidth;

varying vec4 vColor;

void main(void) {
    // Expand vertex position along the normal by half the line width
    vec2 position = aVertex + aNormal * uLineWidth * 0.5;
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(position, 0.0, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
}
