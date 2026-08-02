/**
 * Frozen bind-group conventions for the WebGPU backend.
 *
 * WebGPU bind-group indices are a per-pipeline-layout namespace with a hard
 * cap of four groups, so — unlike WebGL's context-wide uniform-buffer
 * binding points, which the renderer hands out from a monotonic counter
 * (`reserveUniformBindingPoint`) — the collision-proofing here is a frozen
 * convention: every pipeline in the backend agrees on what each group index
 * means, and additions claim the reserved slots below instead of inventing
 * their own.
 *
 * - group 0 — frame globals: one dynamic-offset uniform binding shared by
 *   every draw (projection matrix + line width), served by the uniform
 *   ring. The clear pipeline substitutes its own group-0 layout (a bare
 *   color) over the same ring.
 * - group 1 — material: texture view + sampler (quad pipeline).
 * - group 2 — reserved: lights (the std140 light block ports here).
 * - group 3 — reserved: per-effect extras (ShaderEffect-WGSL, post FX).
 * @ignore
 */
export const GROUP_FRAME = 0;
export const GROUP_MATERIAL = 1;
export const GROUP_LIGHTS = 2;
export const GROUP_EFFECT = 3;

/**
 * Byte size of the frame-globals uniform block:
 * mat4x4<f32> projection (64) + f32 lineWidth (4) + pad to 16 → 80.
 * @ignore
 */
export const FRAME_UNIFORM_SIZE = 80;

/**
 * Byte size of the clear-color uniform block: vec4<f32> → 16.
 * @ignore
 */
export const CLEAR_UNIFORM_SIZE = 16;
