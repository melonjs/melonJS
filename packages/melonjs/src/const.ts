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
 * Use this when your scene works under both renderers (2D sprites,
 * primitives, basic tile maps) and you want the engine to pick the
 * best available backend. Note: subsystems that require WebGL
 * (Camera3d, Mesh, ShaderEffect, Light2d, GPU tilemap) will silently
 * stop working under the Canvas fallback path — if your scene depends
 * on any of those, use {@link WEBGL} so the failure surfaces at
 * construction time instead of as a black canvas at runtime.
 */
export const AUTO = 2;

export type RendererType = typeof CANVAS | typeof WEBGL | typeof AUTO;
