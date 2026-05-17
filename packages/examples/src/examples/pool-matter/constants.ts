/**
 * melonJS — Pool (Matter) example: tuning constants.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * All "feel" values live here so the user can iterate on `frictionAir`
 * (table drag), `restitution` (bounce), and `STRIKE_FORCE_SCALE` (how
 * hard a max-power strike hits) in one place rather than chasing them
 * through entities.
 *
 * Pocket and rail GEOMETRY (per-element position + size) is **not**
 * here — it's in `entities/pocket.ts` (`POCKET_POSITIONS`) and
 * `entities/table.ts` (`RAIL_RECTS`), each as an explicit row-per-piece
 * table so a single off pocket or rail can be tuned without cascading
 * into the others.
 */

// viewport — matches the table.png native dimensions (1280×723) so the
// table sprite renders 1:1 without scaling distortion. `scaleMethod:
// "fit"` in the Application config then scales the whole canvas to the
// browser window while preserving aspect ratio.
export const VIEWPORT_W = 1280;
export const VIEWPORT_H = 723;

// Play boundaries are measured to the **dark-green felt edge** in the
// table sprite — NOT the brown rail and NOT the light-green cushion
// strip. Balls live inside this rectangle in world coordinates.
export const PLAY_LEFT = 107;
export const PLAY_RIGHT = 1180;
export const PLAY_TOP = 90;
export const PLAY_BOTTOM = 635;
export const PLAY_W = PLAY_RIGHT - PLAY_LEFT;
export const PLAY_H = PLAY_BOTTOM - PLAY_TOP;
export const PLAY_MIDX = (PLAY_LEFT + PLAY_RIGHT) / 2;

// ball geometry — chosen so a 5-row rack fits the table comfortably
// (rack width ≈ 5 × 2 × BALL_RADIUS ≈ 160 px out of ~880 play width)
export const BALL_RADIUS = 16;

// physics tuning — TUNE_ME interactively
// Real pool balls slide first then roll — sliding friction is ~3× rolling
// friction. Matter only models one `frictionAir`, so we swap between the
// two values in `Ball.update` based on current speed: above
// `ROLL_TRANSITION_VEL` the ball reads as sliding (high drag), below it
// rolls cleanly (low drag). The transition is what makes break shots
// look like the cue ball "settles" into a roll partway down the table
// instead of decelerating uniformly.
/** rolling friction air drag — applied below ROLL_TRANSITION_VEL */
export const BALL_FRICTION_AIR_ROLL = 0.003;
/** sliding friction air drag — applied above ROLL_TRANSITION_VEL */
export const BALL_FRICTION_AIR_SLIDE = 0.018;
/** speed (px/frame) at which sliding transitions to rolling */
export const ROLL_TRANSITION_VEL = 1.5;
// rail bounciness. 1.0 = perfectly elastic; lower = energy loss per bounce.
export const RAIL_RESTITUTION = 0.85;
// ball-on-ball bounciness — pool balls are very elastic in reality.
export const BALL_RESTITUTION = 0.92;
// ball density — keep all 16 balls equal so collisions transfer momentum
// the way you'd expect from break shots.
export const BALL_DENSITY = 0.01;

// strike (cue) tuning
// drag-distance (px) that corresponds to max-power. Drags beyond this
// cap to MAX_DRAG so the player can't apply absurd velocities.
export const MAX_DRAG = 200;
// peak impulse magnitude applied at max drag. With density=0.01 and
// radius=16, ball mass works out to ~8; matter-js applyImpulse adds
// `impulse / mass` directly to velocity, so a max-power strike of 240
// gives a delta-V of ~30 px/frame — break-shot territory, snappy enough
// that the rack actually scatters. Lower if you want softer strikes;
// higher and you risk tunneling on the corner pocket sensors.
export const STRIKE_FORCE_SCALE = 240;
