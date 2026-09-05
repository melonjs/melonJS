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
#ifdef FOG
out float vFogDepth;
#endif
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

#ifdef FOG
uniform vec4 uFogHeight;  // xyz = falloff x world-up axis, in VIEW space;
                          // w = exp(k * (cameraY - fogHeight)), pre-baked

// How much the height falloff scales the fog along this view ray.
//
// Density falls off exponentially with altitude, and an exponential integrates
// analytically along a straight segment, so the whole ray costs one `exp` and
// no marching. The result multiplies the distance, which leaves both fog
// curves exactly as they are.
//
// Takes the VIEW-space position, not a height. The only position this stage
// has is pre-view — `uModelMatrix * position` — and that is the mesh's parent
// space rather than the world, because `Container.draw` folds every ancestor
// into the view matrix. Reading a height straight off it put the fog floor at
// the wrong altitude for anything under a scaled container. Dotting the
// view-space position against the world-up axis expressed in view space gives
// the height above the camera whatever those ancestors did, since they are
// inside the very matrix that produced this position. `uFogHeight.xyz`
// carries the falloff too, so the exponent is one dot product.
//
// Render space is Y-DOWN: density rises as height INCREASES, the opposite
// sign to every published form of this. The axis is signed that way round,
// and there is a test that catches it being flipped.
//
// A falloff of 0 gives exactly 1: the axis is all zero, so `kdy` is 0, the
// series limit is taken, and the pre-baked term is exp(0) — uniform fog is
// not a special case, it is this with the dial at zero.
float fogHeightFactor(vec3 viewPos) {
    float kdy = dot(uFogHeight.xyz, viewPos);
    // (exp(x) - 1) / x is 0/0 at x = 0, and a horizontal view ray — looking
    // straight across a valley — is exactly that case. Take the limit rather
    // than guarding, or the fog steps as the ray approaches horizontal.
    float t = abs(kdy) < 1e-4 ? 1.0 : (exp(kdy) - 1.0) / kdy;
    return uFogHeight.w * t;
}
#endif

void main(void) {
    mat4 instance = instanceMatrix();
    vec4 worldPos = uModelMatrix * instance * vec4(aVertex, 1.0);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    vWorldPos = worldPos.xyz;
#ifdef FOG
    // Radial view-space distance for distance fog. Radial rather than view-space
    // z, so fog holds steady as the camera turns instead of sliding across the
    // scene. The clip position above keeps its own product: re-associating it
    // could shift vertices by an ulp, and a scene without fog must be unchanged.
    vec3 viewPos = (uViewMatrix * worldPos).xyz;
    vFogDepth = length(viewPos) * fogHeightFactor(viewPos);
#endif

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
