// Current vertex point — z carries per-sprite depth (renderable.depth),
// has no visible effect under the default ortho projection but is required
// for perspective projection (Camera3d) to scale sprites by distance.
attribute vec3 aVertex;
attribute vec2 aRegion;
attribute vec4 aColor;
attribute float aTextureId;

// Projection matrix
uniform mat4 uProjectionMatrix;

varying vec2 vRegion;
varying vec4 vColor;
varying float vTextureId;

void main(void) {
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
    vTextureId = aTextureId;
}
