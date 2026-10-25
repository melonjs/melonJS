#version 300 es
// Current vertex point — z carries per-sprite depth (renderable.depth),
// has no visible effect under the default ortho projection but is required
// for perspective projection (Camera3d) to scale sprites by distance.
in vec3 aVertex;
in vec2 aRegion;
in vec4 aColor;
in float aTextureId;
// the UV of the quad's opposite corner: with this vertex's own, the frame of
// the texture the quad draws (see shaders/frameclamp.js). Far below zero for
// a quad with no frame to keep to. Fifth in every sprite layout: after the
// attributes a custom shader declares, so those keep their locations, and
// before anything a layout adds (the lit extras)
in vec2 aFrame;

// Projection matrix
uniform mat4 uProjectionMatrix;

out vec2 vRegion;
out vec4 vColor;
out float vTextureId;
// the frame (left, top, right, bottom), the same at all four corners
out vec4 vFrame;

void main(void) {
    // Transform the vertex position by the projection matrix
    gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.bgr * aColor.a, aColor.a);
    vRegion = aRegion;
    vTextureId = aTextureId;
    vFrame = aFrame.x < -5.0e5
        ? vec4(-1.0e6, -1.0e6, 1.0e6, 1.0e6)
        : vec4(min(aRegion, aFrame), max(aRegion, aFrame));
}
