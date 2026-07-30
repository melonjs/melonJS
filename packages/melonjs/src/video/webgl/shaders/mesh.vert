// Mesh vertex shader (retained-mode).
//
// Vertices arrive in MODEL space and are placed by uniforms rather than by
// CPU-side transformation, so moving/rotating/scaling a mesh costs a uniform
// update instead of re-uploading its geometry:
//
//   clip = projection × view × model × vertex
//
// `uModelMatrix` carries the mesh's own transform (including the Y/Z axis
// bridge and mesh scale); `uViewMatrix` carries the camera view plus any
// ancestor container transform. Both default to identity, which is what the
// legacy accumulation path (2D camera, vertices pre-projected on the CPU)
// relies on.
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
// Per-draw tint × global alpha. Kept out of the vertex data so that changing
// a mesh's tint never invalidates its retained geometry.
uniform vec4 uTint;

varying vec2 vRegion;
varying vec4 vColor;

void main(void) {
    gl_Position =
        uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);
    // tint first, then premultiply — matches the fragment shader's expectation
    vec4 tinted = aColor * uTint;
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
}
