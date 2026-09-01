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

#ifdef FOG
uniform vec4 uFogHeight;  // x = falloff (0 = uniform), y = reference world Y,
                          // z = the camera's world Y, w unused

// How much the height falloff scales the fog along this view ray.
//
// Density falls off exponentially with altitude, and an exponential integrates
// analytically along a straight segment, so the whole ray costs one `exp` and
// no marching. The result multiplies the distance, which leaves both fog
// curves exactly as they are.
//
// Render space is Y-DOWN: density rises as `y` INCREASES, the opposite sign to
// every published form of this. The `- uFogHeight.y` below is measured that
// way round, and there is a test that catches it being flipped.
//
// A falloff of 0 gives exactly 1: `kdy` is 0, the series limit is taken, and
// `exp(0)` is 1 — so uniform fog is not a special case, it is this with the
// dial at zero.
float fogHeightFactor(float worldY) {
    float k = uFogHeight.x;
    float dy = worldY - uFogHeight.z;
    float kdy = k * dy;
    // (exp(x) - 1) / x is 0/0 at x = 0, and a horizontal view ray — looking
    // straight across a valley — is exactly that case. Take the limit rather
    // than guarding, or the fog steps as the ray approaches horizontal.
    float t = abs(kdy) < 1e-4 ? 1.0 : (exp(kdy) - 1.0) / kdy;
    // clamped: a camera far below the reference height would otherwise
    // overflow the exponential and whiten the frame
    return exp(clamp(k * (uFogHeight.z - uFogHeight.y), -30.0, 30.0)) * t;
}
#endif

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
    vFogDepth = length(viewPos.xyz) * fogHeightFactor((uModelMatrix * instance * vec4(aVertex, 1.0)).y);
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
