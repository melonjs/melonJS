// Current vertex point
attribute vec2 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;
attribute float aTextureId;
// Per-quad normal-map sampler index. -1 means "unlit" — the fragment
// shader takes a fast path that skips normal sampling and the light
// loop. Sprites without `normalMap` set push -1 here, so unlit and
// lit quads can batch through the same draw call.
attribute float aNormalTextureId;

// Projection matrix
uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vColor;
varying float vTextureId;
varying float vNormalTextureId;
// Pre-projection vertex position (in the renderer's pre-projection
// space — typically camera-local for default cameras with the world
// container's translate applied). Used by the lit fragment path to
// compute `lightPos - fragmentPos` for each Light2d.
varying vec2 vWorldPos;

void main(void) {
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
    vTextureId = aTextureId;
    vNormalTextureId = aNormalTextureId;
    vWorldPos = aVertex;
}
