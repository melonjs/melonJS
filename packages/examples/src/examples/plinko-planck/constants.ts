/**
 * melonJS — Plinko (Planck) example: tuning constants.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A neon-cyberpunk plinko/pachinko demo running on `@melonjs/planck-adapter`.
 * Everything is procedurally rendered — no sprite sheets, no atlas, just
 * `Renderer` primitives + viewport scanline post-effect.
 *
 * All "feel" values live here so the user can iterate on `gravity`,
 * `restitution` (peg bounciness), and the slot scoring tiers without
 * chasing them through entities.
 *
 * The peg layout (`PEG_ROWS`, `PEG_COLS`, spacing) and the slot
 * arrangement (`SLOT_COUNT`, `SLOT_SCORES`) are sized so a 720×900
 * portrait-ish viewport reads cleanly in the example gallery's iframe.
 */

// viewport — portrait-ish so the peg field has vertical room for the
// ball to bounce naturally. `scaleMethod: "fit"` in createGame scales
// the whole canvas to the browser window while preserving aspect.
export const VIEWPORT_W = 720;
export const VIEWPORT_H = 900;

// Background layout: the "play area" is a narrower vertical strip
// centred in the viewport. Gives breathing room on the sides for
// score columns and ambient grid.
export const PLAY_W = 560;
export const PLAY_LEFT = (VIEWPORT_W - PLAY_W) / 2;
export const PLAY_RIGHT = PLAY_LEFT + PLAY_W;

// Ball drop band — top horizontal strip where the player clicks to
// release a ball. Visualised as a glowing horizontal rail.
export const DROP_BAND_Y = 60;
export const DROP_BAND_H = 30;

// Peg field — triangular grid of static circle pegs the ball bounces
// off. Rows alternate column offset by `PEG_X_SPACING / 2` to form
// a proper triangular packing.
export const PEG_ROWS = 11;
export const PEG_COLS = 9;
export const PEG_X_SPACING = 60;
export const PEG_Y_SPACING = 56;
export const PEG_FIELD_TOP = 140;
/**
 * Peg radius — small enough that the ball-to-peg gap stays > ball
 * diameter (10 px) so the ball actually fits between rows of pegs
 * without wedging.
 */
export const PEG_RADIUS = 6;

// Ball
export const BALL_RADIUS = 10;
/**
 * Restitution between the ball and pegs. 0.75 is in the satisfying
 * "bouncy but not perpetual" zone — energy bleeds out fast enough that
 * the ball reaches the slots within ~3 seconds.
 */
export const BALL_RESTITUTION = 0.75;
/**
 * Coefficient of friction between ball and pegs. Low so the ball glances
 * cleanly off rather than getting "sticky" on a peg.
 */
export const BALL_FRICTION = 0.05;
export const BALL_DENSITY = 1;
/**
 * Linear damping bleeds a tiny amount of velocity each step so the ball
 * eventually settles into a slot instead of skating across the bottom
 * forever.
 */
export const BALL_LINEAR_DAMPING = 0.4;

// Slot layout — bottom of the screen, color-coded by score multiplier.
// Centre slots are low (most likely landing zone); edge slots are
// high (rare, rewarding).
export const SLOT_COUNT = 9;
export const SLOT_HEIGHT = 80;
export const SLOT_TOP = VIEWPORT_H - SLOT_HEIGHT - 30;
export const SLOT_WALL_TOP = SLOT_TOP - 100;
/** Score per slot — symmetric around centre. */
export const SLOT_SCORES = [100, 30, 10, 5, 2, 5, 10, 30, 100];

// Gravity — in px/s², matches PlanckAdapter convention. 1100 ≈ 34 m/s²
// at pixelsPerMeter=32 — heavier than Earth, gives the falling ball a
// snappy "casino plinko" feel rather than the floaty Earth-gravity look.
export const GRAVITY_Y = 1100;
export const PIXELS_PER_METER = 32;

// Colour palette — neon synthwave. Stored as both CSS strings (for
// renderer.setColor) and normalised RGB triples (for Light2d).
export const COLOR_BG = "#06061a";
export const COLOR_GRID = "#1a1a3a";
export const COLOR_HORIZON_HI = "#ff10f0";
export const COLOR_HORIZON_LO = "#7a0bcc";

export const COLOR_PEG = "#00ffff";
export const COLOR_PEG_HOT = "#ffffff";
export const COLOR_PEG_GLOW: [number, number, number] = [0.0, 1.0, 1.0];

export const COLOR_BALL = "#fff5a0";
export const COLOR_BALL_HOT = "#ffffff";
export const COLOR_BALL_LIGHT: [number, number, number] = [1.0, 0.95, 0.45];

export const COLOR_WALL = "#ff10f0";
export const COLOR_WALL_HOT = "#ffffff";

/** Slot fill colours indexed by score tier (low → high). */
export const SLOT_COLORS = [
	"#7a0bcc", // 2
	"#ff10f0", // 5
	"#ff5a3c", // 10
	"#ffd23f", // 30
	"#ffffff", // 100 — hottest
];

// Particle effect on peg hit
export const SPARK_COUNT = 6;
export const SPARK_LIFETIME = 350; // ms

/** Maximum simultaneous balls. Old balls are reaped FIFO when exceeded. */
export const MAX_BALLS = 60;
