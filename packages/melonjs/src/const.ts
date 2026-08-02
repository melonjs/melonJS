/**
 * Select the HTML5 Canvas renderer. Lower performance and no shader /
 * mesh / Camera3d support, but supported on every browser including
 * environments where WebGL is unavailable (some embedded webviews,
 * stripped-down kiosk browsers, GPU blocklisted by driver policy).
 *
 * Use when the example / game uses only 2D sprites + primitives and you
 * want the broadest possible reach. Anything depending on `ShaderEffect`,
 * `Mesh`, `Camera3d`, GPU TMX tile rendering or `Light2d` will silently
 * not work — those subsystems are WebGL-only.
 */
export const CANVAS = 0;

/**
 * Require the WebGL renderer. **Throws at `new Application(...)` time
 * if WebGL is unavailable** (driver-blocklisted GPU, software fallback
 * failing the `failIfMajorPerformanceCaveat` check, no `WebGLRenderingContext`
 * in the environment, etc.) — does NOT silently fall back to Canvas.
 *
 * Use this when your scene needs WebGL (Camera3d, Mesh, ShaderEffect,
 * Light2d, GPU tilemap) and you'd rather fail fast with a clear error
 * than have the engine render a stuck blank canvas.
 *
 * If Canvas fallback is acceptable when WebGL isn't there, use
 * {@link AUTO} instead.
 */
export const WEBGL = 1;

/**
 * Auto-select the renderer: prefer WebGL when available, silently fall
 * back to Canvas otherwise. Application construction always succeeds.
 *
 * {@link WEBGPU} is **not** a candidate here and will not be selected
 * automatically, however capable the browser — it stays opt-in until it
 * reaches parity with WebGL.
 *
 * Use this when your scene works under both renderers (2D sprites,
 * primitives, basic tile maps) and you want the engine to pick the
 * best available backend. Note: subsystems that require WebGL
 * (Camera3d, Mesh, ShaderEffect, Light2d, GPU tilemap) will silently
 * stop working under the Canvas fallback path — if your scene depends
 * on any of those, use {@link WEBGL} so the failure surfaces at
 * construction time instead of as a black canvas at runtime.
 */
export const AUTO = 2;

/**
 * Require the **experimental** WebGPU renderer. What exists today is the
 * asynchronous bootstrap — adapter/device negotiation and canvas
 * configuration in `await app.init()` — plus a real per-frame clear pass;
 * every other drawing method is still a no-op, so the application boots,
 * runs its loop and clears to its background color, and renders nothing
 * else. `app.init()` rejects when WebGPU is unavailable in the
 * environment; like {@link WEBGL} it fails loudly rather than falling
 * back, so a missing capability surfaces at startup.
 *
 * Deliberately excluded from {@link AUTO}: until the WebGPU backend reaches
 * feature parity with WebGL it is opt-in only, so no existing game can be
 * silently moved onto an incomplete backend by a browser gaining support.
 * You have to ask for it by name (or with the `#webgpu` URI fragment) to
 * exercise it.
 */
export const WEBGPU = 3;

export type RendererType =
	| typeof CANVAS
	| typeof WEBGL
	| typeof AUTO
	| typeof WEBGPU;
