#version 300 es
// Instanced lit mesh vertex shader (#1508).
//
// The lit mesh vertex stage drawn many times from one copy of the geometry:
// `aVertex`/`aRegion`/`aColor`/`aNormal` advance per vertex, the `aInstance*`
// attributes once per INSTANCE (their buffer is declared with a divisor of 1):
//
//   clip = projection × view × model(group) × instance × vertex
//
// GLSL ES 3.00 for the same reason mesh-lit.vert is — the fragment stage reads
// light data from a uniform block, and both stages of a program must share a
// dialect. (The UNLIT instanced shader stays ES 1.00: `attribute mat4`/`vec4`
// are legal there, so instancing itself forces no dialect change.)
//
// The instance transform arrives as three ROW-major vec4 rows rather than a
// full mat4 — the bottom row of an affine matrix is always (0,0,0,1), so
// storing it would waste 16 bytes and an attribute slot per instance. GLSL's
// mat4 constructor takes COLUMNS, hence the transpose below.
in vec3 aVertex;
in vec2 aRegion;
in vec4 aColor;
in vec3 aNormal;

in vec4 aInstanceRow0;
in vec4 aInstanceRow1;
in vec4 aInstanceRow2;
#ifdef INSTANCE_COLORS
in vec4 aInstanceColor;
#endif
#ifdef INSTANCE_DATA
in vec4 aInstanceData;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform vec4 uTint;

out vec2 vRegion;
out vec4 vColor;
out vec3 vNormal;
out vec3 vWorldPos;
#ifdef INSTANCE_DATA
out vec4 vInstanceData;
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
    vec4 worldPos = uModelMatrix * instance * vec4(aVertex, 1.0);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    vWorldPos = worldPos.xyz;

    vec4 tinted = aColor * uTint;
#ifdef INSTANCE_COLORS
    tinted *= aInstanceColor;
#endif
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;

    // Rotate the normal into world space through BOTH transforms, in the same
    // order the position takes them. Uniform scale cancels when the fragment
    // shader renormalizes; non-uniform scale is approximated exactly as the
    // non-instanced path approximates it (an exact result would need the
    // inverse-transpose) — so an instanced mesh shades like its uninstanced
    // twin rather than subtly differently.
    vNormal = mat3(uModelMatrix) * mat3(instance) * aNormal;
#ifdef INSTANCE_DATA
    vInstanceData = aInstanceData;
#endif
}
