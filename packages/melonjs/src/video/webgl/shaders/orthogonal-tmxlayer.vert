#version 300 es

// Vertex shader for the orthogonal TMX layer GPU renderer.
//
// Matches the quad batcher's vertex layout (`aVertex`, `aRegion`, `aColor`,
// `uProjectionMatrix`) so the standard `setBatcher("quad", this.shader)` +
// `addQuad()` flow drives it like any other quad. Same attribute names,
// same uniforms — just expressed in GLSL ES 3.00 (`in`/`out` in place of
// `attribute`/`varying`) so the program can pair with the 3.00 fragment
// shader that uses `usampler2D` / `texelFetch` for integer-typed lookups.

in vec2 aVertex;
in vec2 aRegion;
in vec4 aColor;

uniform mat4 uProjectionMatrix;

out vec2 vRegion;
out vec4 vColor;

void main(void) {
	gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
	// premultiplied-alpha + bgra → rgba swap, same convention the batcher
	// uses for its default sprite shader
	vColor = vec4(aColor.bgr * aColor.a, aColor.a);
	vRegion = aRegion;
}
