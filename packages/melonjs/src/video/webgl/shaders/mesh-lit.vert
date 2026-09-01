#version 300 es
// Lit mesh vertex shader (Camera3d + Light3d) — retained-mode.
//
// GLSL ES 3.00 because the fragment stage reads light data from a uniform
// block, which does not exist in ES 1.00. Both stages of a program must share
// a dialect, so the vertex shader follows.
//
// Same placement as mesh.vert (clip = projection × view × model × vertex,
// vertices in MODEL space) plus a normal carried to the fragment shader in
// world space for diffuse shading.
in vec3 aVertex;
in vec2 aRegion;
in vec4 aColor;
// Model-space normal, rotated into world space below.
in vec3 aNormal;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform vec4 uTint;

out vec2 vRegion;
out vec4 vColor;
out vec3 vNormal;
// world-space fragment position — positional lights (point / spot) fall
// off with distance, so the fragment stage needs where the surface IS
out vec3 vWorldPos;
#ifdef FOG
out float vFogDepth;
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
    vec4 worldPos = uModelMatrix * vec4(aVertex, 1.0);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    vWorldPos = worldPos.xyz;
#ifdef FOG
    // Radial view-space distance for distance fog. Radial rather than view-space
    // z, so fog holds steady as the camera turns instead of sliding across the
    // scene. The clip position above keeps its own product: re-associating it
    // could shift vertices by an ulp, and a scene without fog must be unchanged.
    vFogDepth = length((uViewMatrix * worldPos).xyz)
        * fogHeightFactor(worldPos.y);
#endif
    vec4 tinted = aColor * uTint;
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
    // Rotate the normal into world space with the model matrix's upper 3×3.
    // Lighting is evaluated in world space, so the view transform is
    // deliberately excluded. Uniform scale cancels when the fragment shader
    // renormalizes; non-uniform scale is approximated — unchanged behaviour,
    // an exact result would need the inverse-transpose.
    vNormal = mat3(uModelMatrix) * aNormal;
}
