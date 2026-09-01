// Instanced ground-shadow vertex shader (#1515).
//
// One flat blob per instance, drawn from the SAME instance buffer the mesh
// itself uses — so a forest of a hundred thousand trees costs one extra draw
// call, not a hundred thousand.
//
// This is a STANDALONE shader, not a variant of the instanced mesh family,
// and that is the whole trick. It reads only the three transform rows, never
// `aInstanceColor` or `aInstanceData`, which means:
//
//   * one shader serves every record layout — no hasColor/hasData matrix;
//   * a forest with per-instance colour and per-instance emissive cannot end
//     up with coloured, glowing shadows, because neither slot is read;
//   * the vertex layout can declare just the rows, leaving the buffer's
//     stride and offsets untouched.
//
// The instance's rotation and vertical scale are DISCARDED: a blob lies flat
// on the ground whichever way its tree is turned, and only the horizontal
// footprint decides how wide it is. What survives is the translation and the
// horizontal scale, both read straight out of the rows with no matrix built:
//
//   translation      = (aInstanceRow0.w, aInstanceRow1.w, aInstanceRow2.w)
//   horizontal scale = length(vec3(aInstanceRow0.x, aInstanceRow1.x, aInstanceRow2.x))
//
// Flattening onto the ground plane is `uModelMatrix`'s job: the caller passes
// the group matrix with its Y basis column zeroed and its translation Y set
// to the ground height, so whatever Y this stage produces is discarded and
// every blob lands on the floor.
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;

attribute vec4 aInstanceRow0;
attribute vec4 aInstanceRow1;
attribute vec4 aInstanceRow2;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform vec4 uTint;

varying vec2 vRegion;
varying vec4 vColor;
#ifdef FOG
varying float vFogDepth;
#endif

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
    vec3 instancePos = vec3(aInstanceRow0.w, aInstanceRow1.w, aInstanceRow2.w);
    // column 0 of the instance basis carries the X axis times its scale; a
    // scatter is rotated about the vertical axis, so its length is the
    // horizontal footprint whatever the rotation
    float footprint = length(
        vec3(aInstanceRow0.x, aInstanceRow1.x, aInstanceRow2.x));

    // the quad is a unit square in the ground plane (XZ); only its horizontal
    // extent is scaled, and its own Y is irrelevant — uModelMatrix flattens it
    vec3 local = instancePos + vec3(aVertex.x, 0.0, aVertex.z) * footprint;

    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix
        * vec4(local, 1.0);
#ifdef FOG
    // Radial view-space distance for distance fog. Radial rather than view-space
    // z, so fog holds steady as the camera turns instead of sliding across the
    // scene. The clip position above keeps its own product: re-associating it
    // could shift vertices by an ulp, and a scene without fog must be unchanged.
    vec4 viewPos = uViewMatrix * uModelMatrix * vec4(local, 1.0);
    vFogDepth = length(viewPos.xyz) * fogHeightFactor((uModelMatrix * vec4(local, 1.0)).y);
#endif

    // tint first, then premultiply — matches the fragment shader's expectation
    vec4 tinted = aColor * uTint;
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
}
