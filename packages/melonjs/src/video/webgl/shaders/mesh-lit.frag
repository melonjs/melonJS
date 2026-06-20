// Lit mesh fragment shader: half-Lambert diffuse from up to MAX_LIGHTS
// directional lights plus an ambient floor.
//
// `__MAX_LIGHTS__` is replaced with the MAX_LIGHTS constant
// (src/video/webgl/lighting/constants.ts) by LitMeshBatcher._shaderSources at
// load time, so the array sizes / loop bound can't drift from the uniform
// packer. (Used directly rather than via a #define so it survives the GLSL
// preprocessor regardless of how it handles macros.)

uniform sampler2D uSampler;
uniform float uAlphaCutoff;               // alpha cutout threshold (0 = disabled)

uniform int uLightCount;
uniform vec3 uLightDir[__MAX_LIGHTS__];   // surface→light, normalized (world space)
uniform vec3 uLightColor[__MAX_LIGHTS__]; // color premultiplied by intensity
uniform vec3 uAmbient;                    // flat ambient floor

varying vec4 vColor;
varying vec2 vRegion;
varying vec3 vNormal;

void main(void) {
    vec4 base = texture2D(uSampler, vRegion) * vColor;

    // hard alpha cutout (glTF alphaMode MASK) — discard before any shading
    // so cut-away texels cost nothing and never write depth.
    if (base.a < uAlphaCutoff) {
        discard;
    }

    vec3 N = normalize(vNormal);
    vec3 lit = uAmbient;
    for (int i = 0; i < __MAX_LIGHTS__; i++) {
        if (i >= uLightCount) { break; }
        // Half-Lambert ("wrap") diffuse: dot * 0.5 + 0.5. Softens the
        // terminator and lifts the shadowed side, for a gentler, more
        // diffuse look than hard Lambert (which reads as harsh noon).
        float ndl = dot(N, uLightDir[i]) * 0.5 + 0.5;
        lit += uLightColor[i] * (ndl * ndl);
    }

    gl_FragColor = vec4(base.rgb * lit, base.a);
}
