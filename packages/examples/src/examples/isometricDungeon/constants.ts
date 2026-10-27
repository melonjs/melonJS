/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

export const VIEW_W = 1280;
export const VIEW_H = 720;

// size of every tileset cell and hero frame
export const FRAME_W = 128;
export const FRAME_H = 256;

// height of a map cell
export const TILE_H = 64;

// position of the hero's feet in a frame
export const FEET_X = 64;
export const FEET_Y = 234;

// pixels per frame, along the map axes
export const HERO_SPEED = 3.2;

// ms per animation frame
export const RUN_FRAME_MS = 55;
export const PICKUP_FRAME_MS = 45;

// how close (in pixels) the hero needs to be to open something
export const REACH = 64;

export const TORCH_RADIUS = 200;
export const TORCH_COLOR = "#ffb46a";
export const TORCH_INTENSITY = 0.2;

// the torches on the walls
export const WALL_TORCH_RADIUS = 120;
export const WALL_TORCH_COLOR = "#ff9a40";
export const WALL_TORCH_INTENSITY = 0.35;

// the darkness over the dungeon: the stage's ambient light, which every
// light cuts a soft hole in
export const DARKNESS = "rgba(4, 3, 10, 0.9)";

// how far the darkness opens around the hero and around a wall torch, in
// pixels, out to where it is fully dark again. The openings are ellipses,
// wider than tall
export const SIGHT_RADIUS = 380;
export const TORCH_SIGHT_RADIUS = 240;
export const SIGHT_SQUASH = 0.5625;

// light over the chests that are still closed
export const CHEST_GLOW_RADIUS = 130;
export const CHEST_GLOW_COLOR = "#ffd75e";
export const CHEST_GLOW_INTENSITY = 0.5;

// the dust motes float over the world (the darkness is drawn after it)
export const MOTES_Z = 1e9;

// the visibility layer of every particle emitter: the minimap leaves it out
export const PARTICLES = 2;
