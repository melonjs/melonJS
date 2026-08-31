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
// ancestor container transform. Both are always written before a draw — the
// accumulation path (2D camera, vertices pre-projected on the CPU) pushes
// identity explicitly. Note GLSL uniforms default to ZERO, not identity, so a
// path that reached this shader without setting them would collapse every
// vertex onto the origin rather than drawing untransformed.
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
#ifdef FOG
varying float vFogDepth;
#endif

void main(void) {
    gl_Position =
        uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);
#ifdef FOG
    // Radial view-space distance for distance fog. Radial rather than view-space
    // z, so fog holds steady as the camera turns instead of sliding across the
    // scene. The clip position above keeps its own product: re-associating it
    // could shift vertices by an ulp, and a scene without fog must be unchanged.
    vec4 viewPos = uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);
    vFogDepth = length(viewPos.xyz);
#endif
    // tint first, then premultiply — matches the fragment shader's expectation
    vec4 tinted = aColor * uTint;
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
}
