/**
 * Tuning constants for the AfterBurner showcase. Grouped by what they
 * affect (world layout, movement, banking, spawn, skybox, asset paths).
 * Anything that's not a tunable knob lives in its own module.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { Vector3d } from "melonjs";

// ─── world coordinate system ───────────────────────────────────────────
//   +X right, +Y down (engine convention), +Z forward (away from camera).
//   Player anchored at z = PLAYER_Z; XY moves freely within play bounds.
//   Enemies spawn at SPAWN_Z and decrement z each frame.
//   Bullets spawn at player.z and increment z each frame.
export const PLAYER_Z = 200;
export const SPAWN_Z = 3000;
export const DESPAWN_Z_FAR = 4000; // bullet past-horizon cleanup
export const DESPAWN_Z_NEAR = 0; // enemy past-player cleanup
export const PLAY_BOUND_X = 350;
export const PLAY_BOUND_Y = 200;
// Targeting reticle world-z offset ahead of the player. Far enough that
// Camera3d shrinks it to a small overlay (not a giant frame), close
// enough that the parallax with player banking reads as "where the
// bullets converge." Tunable: smaller value → bigger reticle, more
// parallax with bank; larger value → smaller, less responsive.
export const RETICLE_FORWARD_Z = 600;
// World-space size of the reticle quad. Combined with the forward Z
// offset above, lands at roughly 1/6 the player's apparent size on
// screen at default framing — visible but not dominating.
export const RETICLE_SIZE = 64;

// ─── movement / gameplay ───────────────────────────────────────────────
export const PLAYER_SPEED = 500; // world units per second
export const BULLET_SPEED = 1800; // world units per second toward +Z
export const ENEMY_SPEED = 600; // world units per second toward -Z
export const ENEMY_SPAWN_INTERVAL_MS = 700;
export const FIRE_COOLDOWN_MS = 140;
export const HIT_RADIUS = 60; // sphere radius for collision

// ─── camera banking ────────────────────────────────────────────────────
// Pitch / yaw / roll radians at the play-bound edge. Larger = more
// dramatic horizon + view tilt at the corners. Roll is the signature
// After Burner move — the whole world rotates when the pilot banks
// left/right.
export const MAX_BANK_PITCH = 0.35;
export const MAX_BANK_YAW = 0.22;
export const MAX_BANK_ROLL = 0.18;

// ─── player-mesh banking ───────────────────────────────────────────────
// Separate from the camera bank above. Driven from input direction so
// the jet visibly rolls into turns and pitches up/down on climbs/dives
// even when the camera-bank already moved the horizon. Smoothed via an
// exponential decay so input transitions feel like a pilot pulling the
// stick, not a snap to angle.
export const PLAYER_MAX_ROLL = 0.95; // radians at full left/right input (~55°)
export const PLAYER_MAX_PITCH = 0.45; // radians at full up/down input (~26°)
export const PLAYER_BANK_DECAY = 6; // higher = snappier bank response (1/s)

// ─── exhaust trail ─────────────────────────────────────────────────────
export const EXHAUST_PUFF_INTERVAL_MS = 32;
export const EXHAUST_PUFF_LIFE_MS = 380;
// Doubled vs the single-flame design — we spawn one puff per engine pod
// per tick, so the live count is roughly 2× the previous max.
export const EXHAUST_PUFF_MAX = 48;
// Engine-pod local offsets from the player center, in world units.
// `ENGINE_X` is the lateral spacing between the two pods (rotated by
// the player's roll each tick so the trails stay glued to the pods
// during banks). `ENGINE_Y` anchors the top of the flame texture at
// the engine outlet — the texture itself is built with the hot spot
// near the top (see `makeExhaustPuffTexture`), so the visible glow
// extends downward like a real thrust plume. `ENGINE_Z` is the
// forward/back offset; **positive** is correct here because the world
// container's depth sort is "ascending squared distance from camera,
// then reverse-iterated", i.e. it paints far → near. A puff that's
// FARTHER from the camera than the player (positive `ENGINE_Z` since
// the camera sits at low world-z) draws BEFORE the player, so the
// plane body — drawn after — cleanly occludes the half of the halo
// overlapping the cockpit / wing. Only the part extending past the
// engine outlet remains visible.
export const ENGINE_X = 10;
export const ENGINE_Y = 5;
export const ENGINE_Z = 8;
// Per-puff scale — smaller than the original single flame so the two
// trails together read like a pair of focused jets, not a blob.
export const EXHAUST_PUFF_SCALE = 0.65;

// ─── ground speed-line ─────────────────────────────────────────────────
export const SPEED_LINE_COUNT = 14;
export const SPEED_LINE_SCROLL_PER_S = 1.6; // cycles per second — faster = more "Mach"
export const HORIZON_BASE_FRACTION = 0.55; // baseline horizon Y at pitch = 0

// ─── assets ────────────────────────────────────────────────────────────
export const SPEEDER_ASSET_BASE = `${import.meta.env.BASE_URL}assets/multiMaterialMesh/`;
export const SPEEDER_MODEL = "craft_speederA";

// ─── axes for mesh rotations ───────────────────────────────────────────
// AXIS_X is the pitch axis (nose up/down), AXIS_Y is the facing-flip
// axis (used once on enemy spawn to point the nose back at the camera),
// AXIS_Z is the roll axis (wings rocking around the forward heading).
export const AXIS_X = new Vector3d(1, 0, 0);
export const AXIS_Y = new Vector3d(0, 1, 0);
export const AXIS_Z = new Vector3d(0, 0, 1);
