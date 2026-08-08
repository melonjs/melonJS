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

    // tint first, then premultiply — matches the fragment shader's expectation
    vec4 tinted = aColor * uTint;
    vColor = vec4(tinted.rgb * tinted.a, tinted.a);
    vRegion = aRegion;
}
