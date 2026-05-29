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

// ─── lives + respawn invulnerability ───────────────────────────────────
export const LIVES_START = 3;
// Window of invulnerability after a respawn — long enough that the
// player isn't insta-killed by the same enemy that just hit them
// (enemies at z=0 take ~1500ms at z=600 to leave the play area).
export const INVULN_MS = 1500;
// Visible blink while invulnerable (full alpha → mid alpha). Short
// enough that 1500ms gives ~7 cycles.
export const INVULN_BLINK_MS = 110;

// ─── enemy fire ────────────────────────────────────────────────────────
// Not every enemy is a shooter — only ~30% take a pot-shot during their
// inbound run. Bullets travel at a fraction of the player's bullet speed
// so dodging is actually possible, with the aim baked in at fire time
// (no leading — too punishing under perspective at this pace).
export const ENEMY_FIRE_CHANCE = 0.18;
export const ENEMY_BULLET_SPEED = 900; // world units / second along aim vector
export const ENEMY_FIRE_INTERVAL_MIN_MS = 1500;
export const ENEMY_FIRE_INTERVAL_MAX_MS = 3000;
// RGB tint for enemy bolts — sit visually opposite the gold player
// bullets so the player can read what's incoming at a glance.
export const TINT_ENEMY_BULLET_RGB: readonly [number, number, number] = [
	255, 90, 160,
];

// ─── enemy barrel-roll ─────────────────────────────────────────────────
// Most enemies fly straight; an occasional one barrel-rolls during the
// inbound run so the 3D mesh sells its volume. The values are randomized
// per-enemy inside a window — these are the bounds.
export const ENEMY_ROLL_DURATION_MIN_MS = 600;
export const ENEMY_ROLL_DURATION_MAX_MS = 1100;
// Time between rolls (per enemy). Lower bound keeps any one enemy from
// pancake-rolling continuously; upper bound means about a third of all
// enemies will get one roll during their inbound flight (flight time at
// SPAWN_Z=3000 / ENEMY_SPEED=600 is ~5 s).
export const ENEMY_ROLL_INTERVAL_MIN_MS = 2200;
export const ENEMY_ROLL_INTERVAL_MAX_MS = 5500;

// ─── effect tints ──────────────────────────────────────────────────────
// Centralized so tweaks land in one place and the gameplay code reads
// like intent ("enemy hit fireball") instead of a hex blob.
export const TINT_BULLET_RGB: readonly [number, number, number] = [
	255, 230, 90,
];
export const TINT_ENEMY_EXPLOSION = "#ffae3a"; // warm orange fireball
export const TINT_PLAYER_EXPLOSION = "#ff4a3a"; // deeper red — death

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

// ─── contrail (custom 3D trail) ────────────────────────────────────────
// Hand-rolled trail of additive Sprites — NOT a ParticleEmitter. Each
// node spawns at the engine-outlet world position (rotated with the
// plane's roll), then each frame its `depth` is increased so the node
// recedes AWAY FROM the camera in world space. Under perspective the
// receding node shrinks and projects higher on screen (toward the
// horizon) — gives the classic "vapor trail vanishing into the
// distance" silhouette, with painter's-sort guaranteed to place older
// nodes behind newer ones AND behind the plane.
export const CONTRAIL_INTERVAL_MS = 28;
export const CONTRAIL_LIFE_MS = 1200;
// World units per second the node travels in -Z (TOWARD the camera —
// i.e. backward in the plane's flight direction, the way a real vapor
// trail trails behind a jet). The aged nodes get LARGER under
// perspective and project LOWER on screen, which reads as the trail
// extending downward past the plane's tail. Reversing the sign (+Z =
// receding into the distance) puts the trail ahead of the plane,
// which is the bug we just fixed.
export const CONTRAIL_TRAIL_SPEED = 900;
// Trail node engine-pod offset, plane-local. Positive Y sits below
// the plane center on screen (where the engines visually are). Lower
// X spread than the exhaust because the contrail reads as one
// merged vapor stream, not two distinct pods.
export const CONTRAIL_OFFSET_X = 0;
export const CONTRAIL_OFFSET_Y = 22;
// World-space scale at spawn vs end-of-life. Stays roughly constant
// in world units; Camera3d's perspective handles the visual shrink as
// the node recedes. End slightly smaller so the trail tapers cleanly
// instead of clipping to nothing.
export const CONTRAIL_SCALE_START = 1.0;
export const CONTRAIL_SCALE_END = 0.7;

// ─── ground perspective grid ───────────────────────────────────────────
// OutRun-style horizontal hash bands scrolling toward the camera. Sells
// "rapidly moving terrain" much more than the previous radial chevrons.
export const GRID_ROW_COUNT = 14; // horizontal scrolling bands
export const GRID_SCROLL_PER_S = 0.9; // scroll cycles per second
export const HORIZON_BASE_FRACTION = 0.55; // baseline horizon Y at pitch = 0

// ─── assets ────────────────────────────────────────────────────────────
export const SPEEDER_ASSET_BASE = `${import.meta.env.BASE_URL}assets/multiMaterialMesh/`;
export const SPEEDER_MODEL = "craft_speederA";
// Background music loop. `audio.load` resolves the actual URL as
// `${BGM_PATH}${BGM_NAME}.{ext}` using the first extension from the
// `audio.init("mp3,m4a,ogg")` list that the browser can decode, so all
// three files live next to each other under `public/`.
export const BGM_NAME = "ingame-loop";
export const BGM_PATH = `${import.meta.env.BASE_URL}assets/afterBurner/bgm/`;

// ─── axes for mesh rotations ───────────────────────────────────────────
// AXIS_X is the pitch axis (nose up/down), AXIS_Y is the facing-flip
// axis (used once on enemy spawn to point the nose back at the camera),
// AXIS_Z is the roll axis (wings rocking around the forward heading).
export const AXIS_X = new Vector3d(1, 0, 0);
export const AXIS_Y = new Vector3d(0, 1, 0);
export const AXIS_Z = new Vector3d(0, 0, 1);
