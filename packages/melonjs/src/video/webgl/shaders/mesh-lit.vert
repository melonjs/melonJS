// Lit mesh vertex shader (Camera3d + Light3d). Same as mesh.vert
// plus a world-space normal carried to the fragment shader for diffuse shading.
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;
// World-space normal. The lit mesh batcher pushes normals WITHOUT the view
// transform, so lighting is evaluated in world space.
attribute vec3 aNormal;

uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vColor;
varying vec3 vNormal;

void main(void) {
    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
    vColor = vec4(aColor.rgb * aColor.a, aColor.a);
    vRegion = aRegion;
    // already world-space — interpolated, then renormalized per fragment
    vNormal = aNormal;
}
