/**
 * Constants shared between the lit fragment shader (`multitexture-lit.js`),
 * the lit batcher (`LitQuadBatcher`), and the uniform packer (`pack.ts`).
 * Kept in a tiny standalone module so the three consumers don't depend on
 * each other transitively for a single integer.
 */

/**
 * Maximum number of `Light2d` instances the lit fragment shader supports
 * concurrently per draw call. Lights past this index are ignored. Sized
 * to keep the GLSL uniform arrays comfortably within WebGL1 limits.
 */
export const MAX_LIGHTS = 8;
