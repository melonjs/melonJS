/**
 * melonJS — Slingshot: the numbers the game is tuned with, in one place.
 *
 * Render space is Y-DOWN: the ground's top is at y = 0 and up is negative.
 * Distances are in pixels, speeds in pixels per second.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math, Vector3d } from "melonjs";

// ── where the assets are ──────────────────────────────────────────────────
export const PETS_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/kenney/`;
export const MESH_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/`;

// the textures painted in code, by the names they are preloaded under
export const WOOD = "wood";
export const STONE = "stone";
export const GRASS = "grass";

// ── the animals ───────────────────────────────────────────────────────────
// the pets, launched in this order, one per shot
export const PETS = [
	"animal-chick",
	"animal-bunny",
	"animal-penguin",
	"animal-panda",
	"animal-elephant",
];
export const PET_SIZE = 64;
// the rivals perched on the towers
export const RIVALS = [
	"animal-fox",
	"animal-crab",
	"animal-monkey",
	"animal-lion",
	"animal-tiger",
];
export const RIVAL_SIZE = 56;

// ── the world ─────────────────────────────────────────────────────────────
export const GROUND_Y = 0;
// gravity pulls along +Y (down), in pixels per second²
export const GRAVITY = 980;
// the field: the backdrop stands this far out, front and back, and to the sides
export const FIELD_DEPTH = 1700;
export const FIELD_WIDTH = 3000;
// below this, a pet or a rival has fallen off the field
export const FALLEN_Y = 400;
// the raised deck the slingshot stands on, and the next pets wait on
export const DECK_TOP = -70;

// ── the slingshot ─────────────────────────────────────────────────────────
// where the pet waits in the pouch: in from the left edge, so a full pull
// still has room on screen
export const POUCH = new Vector3d(-400, -250, 0);
// how far apart the waiting pets stand, in line behind the slingshot
export const QUEUE_GAP = 58;
// how far a pet can be pulled back, and how hard the bands send it
export const MAX_PULL = 120;
export const POWER = 11;
// a pull shorter than this puts the pet back in the pouch
export const MIN_PULL = 15;
// a shot is over once the pet rests, leaves the field, or after this long
export const SHOT_SECONDS = 7;

// ── scoring ───────────────────────────────────────────────────────────────
// a rival struck at this speed or more (the two bodies' speed relative to
// each other) is knocked out
export const KNOCKOUT_SPEED = 260;
export const RIVAL_POINTS = 5000;
export const SPARE_PET_POINTS = 10000;

// ── the camera ────────────────────────────────────────────────────────────
// it orbits this point, the middle of the field
export const PIVOT = new Vector3d(100, -210, 0);
// how far out it is and how far it looks down (radians, negative is down):
// side on, and from behind the slingshot, further back and higher to see
// over the pets waiting in line. In between, it blends from one to the other.
export const ORBIT_SIDE = { distance: 1150, pitch: math.degToRad(-1.5) };
export const ORBIT_BEHIND = { distance: 1557, pitch: math.degToRad(-10.7) };
// a press of a turn button turns it this far; a held arrow key, this fast
// (radians per second)
export const ORBIT_STEP = Math.PI / 6;
export const ORBIT_SPEED = 1.6;
// how quickly it eases to where it is asked to be (`math.damp`)
export const ORBIT_EASE = 8;

// ── axes ──────────────────────────────────────────────────────────────────
export const AXIS_X = new Vector3d(1, 0, 0);
export const AXIS_Y = new Vector3d(0, 1, 0);
