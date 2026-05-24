// Lit-aware vertex shader used by `LitQuadBatcher` (the SpriteIlluminator
// path). Carries a paired `aNormalTextureId` per vertex so the fragment
// shader knows which `uNormalSampler<n>` to read, and `vWorldPos` so the
// lit math can compute per-fragment `lightPos - pos` deltas.
// `aVertex.z` carries per-sprite depth (renderable.depth) — a no-op under
// the default ortho projection, used by perspective (Camera3d).
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;
attribute float aTextureId;
attribute float aNormalTextureId;

uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vColor;
varying float vTextureId;
varying float vNormalTextureId;
// Pre-projection vertex position (in the renderer's pre-projection
// space — typically camera-local for default cameras with the world
// container's translate applied). Used by the lit fragment path to
// compute `lightPos - fragmentPos` for each Light2d. 2D — light math is
// in the screen plane, depth doesn't participate.
varying vec2 vWorldPos;

void main(void) {
    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
    vTextureId = aTextureId;
    vNormalTextureId = aNormalTextureId;
    vWorldPos = aVertex.xy;
}
