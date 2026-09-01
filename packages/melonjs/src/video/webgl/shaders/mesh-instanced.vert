// Instanced mesh vertex shader (#1508).
//
// The unlit mesh vertex stage, with the geometry drawn many times from one
// copy: `aVertex`/`aRegion`/`aColor` advance per vertex as usual, while the
// `aInstance*` attributes advance once per INSTANCE (their vertex buffer is
// declared with a divisor of 1). So one geometry plus a small per-instance
// record produces N copies in a single draw call:
//
//   clip = projection × view × model(group) × instance × vertex
//
// `uModelMatrix` places the whole group — moving an InstancedMesh is still
// one uniform write — and the per-instance transform places each copy within
// it.
//
// The instance transform arrives as three ROW-major vec4 rows rather than a
// full mat4: the bottom row of an affine matrix is always (0,0,0,1), so
// storing it would waste 16 bytes and a fourth attribute slot per instance.
// GLSL's mat4 constructor takes COLUMNS, hence the transpose below.
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;

attribute vec4 aInstanceRow0;
attribute vec4 aInstanceRow1;
attribute vec4 aInstanceRow2;
#ifdef INSTANCE_COLORS
attribute vec4 aInstanceColor;
#endif
#ifdef INSTANCE_DATA
attribute vec4 aInstanceData;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform vec4 uTint;

varying vec2 vRegion;
varying vec4 vColor;
#ifdef FOG
varying float vFogDepth;
#endif
#ifdef INSTANCE_DATA
varying vec4 vInstanceData;
#endif

mat4 instanceMatrix() {
    return mat4(
        vec4(aInstanceRow0.x, aInstanceRow1.x, aInstanceRow2.x, 0.0),
        vec4(aInstanceRow0.y, aInstanceRow1.y, aInstanceRow2.y, 0.0),
        vec4(aInstanceRow0.z, aInstanceRow1.z, aInstanceRow2.z, 0.0),
        vec4(aInstanceRow0.w, aInstanceRow1.w, aInstanceRow2.w, 1.0));
}

void main(void) {
    mat4 instance = instanceMatrix();
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * instance
        * vec4(aVertex, 1.0);
#ifdef FOG
    // Radial view-space distance for distance fog. Radial rather than view-space
    // z, so fog holds steady as the camera turns instead of sliding across the
    // scene. The clip position above keeps its own product: re-associating it
    // could shift vertices by an ulp, and a scene without fog must be unchanged.
    vec4 viewPos = uViewMatrix * uModelMatrix * instance * vec4(aVertex, 1.0);
    vFogDepth = length(viewPos.xyz);
#endif

    vec4 tinted = aColor * uTint;
#ifdef INSTANCE_COLORS
    tinted *= aInstanceColor;
#endif
    // tint first, then premultiply — matches the fragment shader's expectation
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
#ifdef INSTANCE_DATA
    vInstanceData = aInstanceData;
#endif
}
