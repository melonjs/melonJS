// Current vertex point — z carries per-sprite depth (renderable.depth),
// a no-op under the default ortho projection, used by perspective (Camera3d).
attribute vec3 aVertex;
// Per-vertex normal for line expansion (2D — line expansion is in the
// screen plane and doesn't participate in depth).
attribute vec2 aNormal;
attribute vec4 aColor;

// Projection matrix
uniform mat4 uProjectionMatrix;
// Line width for stroke expansion
uniform float uLineWidth;

varying vec4 vColor;

void main(void) {
    // Expand vertex position along the normal by half the line width (2D)
    vec2 position = aVertex.xy + aNormal * uLineWidth * 0.5;
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(position, aVertex.z, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
}
