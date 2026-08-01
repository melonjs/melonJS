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

void main(void) {
    gl_Position =
        uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);
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
