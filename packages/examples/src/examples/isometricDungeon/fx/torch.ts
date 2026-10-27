/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Noise } from "melonjs";

// a smooth random wobble, seeded so it is the same every game
const noise = new Noise({ seed: 7, frequency: 1.5, octaves: 3 });

// torch brightness factor, around 1 (about 0.8 to 1.2). Each torch samples
// its own stretch of the noise, from its own start time
export function flicker(seconds: number) {
	return 1 + 0.23 * noise.getNoise1d(seconds);
}

// how much an opening in the darkness grows and shrinks with that flicker,
// around 1
export function breath(seconds: number) {
	return 1 + (flicker(seconds) - 1) * 0.12;
}
