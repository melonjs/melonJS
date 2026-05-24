// Current vertex point — z carries per-sprite depth (renderable.depth),
// a no-op under the default ortho projection, used by perspective (Camera3d).
// This is also the default vertex template used by ShaderEffect, so user-
// defined fragment-only effects honor the renderable's depth automatically.
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
