/**
 * Select the HTML5 Canvas renderer. Lower performance and no
 * programmable pipeline, but supported on every browser including
 * environments where the GPU backends are unavailable (some embedded
 * webviews, stripped-down kiosk browsers, GPU blocklisted by driver
 * policy).
 *
 * Use when the example / game uses only 2D sprites + primitives and you
 * want the broadest possible reach. Anything depending on the GPU
 * backends degrades or disables here: `ShaderEffect` and `Light2d`
 * shading stay inert, GPU TMX tile rendering falls back to the per-tile
 * path, and `Mesh` / `Camera3d` lose the depth-buffer path (meshes only
 * render CPU-projected under a 2D camera — `supportsDepthBuffer` is
 * `false`).
 */
export const CANVAS = 0;

/**
 * Require the WebGL renderer. **`app.init()` rejects if WebGL 2 is
 * unavailable** (WebGL-1-only device, driver-blocklisted GPU, software
 * fallback failing the `failIfMajorPerformanceCaveat` check, etc.) —
 * it does NOT silently fall back to Canvas.
 *
 * Use this when your scene needs a GPU backend (Camera3d, Mesh,
 * ShaderEffect, Light2d, GPU tilemap) pinned to WebGL specifically and
 * you'd rather fail fast with a clear error than have the engine render
 * a stuck blank canvas.
 *
 * If falling back is acceptable, use {@link AUTO} instead (WebGPU →
 * WebGL 2 → Canvas).
 */
export const WEBGL = 1;

/**
 * Auto-select the renderer: try WebGPU first (when the browser exposes it
 * and an adapter/device negotiates successfully), fall back to WebGL 2,
 * then to Canvas. `await app.init()` always resolves — a failed candidate
 * falls through to the next rather than rejecting.
 *
 * The WebGPU attempt is a full backend initialization (support can only be
 * proven by negotiating a device), so on WebGPU-capable browsers `init()`
 * settles after the adapter handshake; browsers without `navigator.gpu`
 * skip straight to the synchronous WebGL probe.
 *
 * Note: subsystems that require a GPU backend (Camera3d, ShaderEffect,
 * Light2d normal-map shading, GPU tilemap) will silently stop working under
 * the terminal Canvas fallback — if your scene depends on any of those,
 * use {@link WEBGL} (or {@link WEBGPU}) so the failure surfaces at
 * startup instead of as a black canvas at runtime.
 *
 * A specific backend can still be forced per-run with the `#webgpu`,
 * `#webgl` or `#canvas` URI fragments.
 */
export const AUTO = 2;

/**
 * Require the WebGPU renderer. The backend covers the full rendering
 * contract of the WebGL renderer — the 2D tier (sprites, text,
 * primitives, blend modes, masks and clipping, patterns, ShaderEffect /
 * post effects in WGSL, 2D lights and normal maps, frame captures,
 * gradient fills, compressed textures, GPU tile layers) and the 3D tier
 * (retained and accumulated meshes, lit and unlit, Camera3d, Light3d,
 * glTF scenes and models, Sprite3d billboards).
 *
 * `app.init()` rejects when WebGPU is unavailable in the environment;
 * like {@link WEBGL} it fails loudly rather than falling back, so a
 * missing capability surfaces at startup. Use {@link AUTO} if fallback
 * to WebGL / Canvas is acceptable — AUTO already prefers WebGPU when
 * the browser can negotiate a device.
 */
export const WEBGPU = 3;

export type RendererType =
	| typeof CANVAS
	| typeof WEBGL
	| typeof AUTO
	| typeof WEBGPU;
