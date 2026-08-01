#version 300 es
// Lit-aware vertex shader used by `LitQuadBatcher` (the SpriteIlluminator
// path). Carries a paired `aNormalTextureId` per vertex so the fragment
// shader knows which `uNormalSampler<n>` to read, and `vWorldPos` so the
// lit math can compute per-fragment `lightPos - pos` deltas.
// `aVertex.z` carries per-sprite depth (renderable.depth) — a no-op under
// the default ortho projection, used by perspective (Camera3d).
in vec3 aVertex;
in vec2 aRegion;
in vec4 aColor;
in float aTextureId;
in float aNormalTextureId;

uniform mat4 uProjectionMatrix;

out vec2 vRegion;
out vec4 vColor;
out float vTextureId;
out float vNormalTextureId;
// Pre-projection vertex position (in the renderer's pre-projection
// space — typically camera-local for default cameras with the world
// container's translate applied). Used by the lit fragment path to
// compute `lightPos - fragmentPos` for each Light2d. 2D — light math is
// in the screen plane, depth doesn't participate.
out vec2 vWorldPos;

void main(void) {
    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
    vTextureId = aTextureId;
    vNormalTextureId = aNormalTextureId;
    vWorldPos = aVertex.xy;
}
