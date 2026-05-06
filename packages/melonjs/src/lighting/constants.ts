/**
 * Renderer-agnostic constants shared by the lighting subsystem.
 *
 * Lives outside `video/webgl/` so `Stage` (used by both Canvas and WebGL)
 * can import it without dragging WebGL-specific shader code into Canvas
 * builds.
 */

/**
 * Maximum number of `Light2d` instances the lit fragment shader supports
 * concurrently per draw call. Lights past this index are ignored. Sized
 * to keep the GLSL uniform arrays comfortably within WebGL1 limits.
 */
export const MAX_LIGHTS = 8;
