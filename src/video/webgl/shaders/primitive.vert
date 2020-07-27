// Current vertex point
attribute vec2 aVertex;

// Projection matrix
uniform mat4 uProjectionMatrix;

// Vertex color
uniform vec4 uColor;

// Fragment color
varying vec4 vColor;

void main(void) {
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(uColor.rgb * uColor.a, uColor.a);
}
