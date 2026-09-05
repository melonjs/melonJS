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
    gl_Position =
        uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);
#ifdef FOG
    // Radial view-space distance for distance fog. Radial rather than view-space
    // z, so fog holds steady as the camera turns instead of sliding across the
    // scene. The clip position above keeps its own product: re-associating it
    // could shift vertices by an ulp, and a scene without fog must be unchanged.
    vec4 viewPos = uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);
    vFogDepth = length(viewPos.xyz) * fogHeightFactor(viewPos.xyz);
#endif
    // tint first, then premultiply — matches the fragment shader's expectation
    vec4 tinted = aColor * uTint;
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
}
