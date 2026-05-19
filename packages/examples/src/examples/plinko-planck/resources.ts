/**
 * melonJS — Plinko (Planck) example: asset manifest.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 *
 * Intentionally empty — every visual in this demo is rendered
 * procedurally via the `Renderer` primitives (`fillEllipse`,
 * `fillRect`, `strokeLine`) plus a viewport scanline + vignette
 * post-effect. No sprite sheets, no texture atlas, no font files.
 *
 * Kept as an exported empty array so the `createGame` bootstrap can
 * still call `loader.preload(resources, …)` — the loader handles an
 * empty manifest by calling the completion callback synchronously,
 * which simplifies the path through `state.set(state.PLAY, …)`.
 */

export const resources: never[] = [];
