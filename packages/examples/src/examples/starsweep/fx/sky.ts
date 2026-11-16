/**
 * melonJS — Starsweep: the sky drawn without a shader.
 *
 * On the Canvas renderer there is no nebula shader, so the sky is drawn
 * from shapes: a flat colour, two faint clouds, twinkling stars and a
 * ringed planet. The planet is drawn on every renderer (`SpaceBackdrop`),
 * and the title draws the whole sky behind its strip of deck.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math } from "melonjs";
import type { Renderer } from "../utils/draw";

/** a star of the drawn sky */
export interface Star {
	x: number;
	y: number;
	/** in pixels: 1 or 2 */
	size: number;
	/** where in its twinkle it starts */
	phase: number;
}

/** stars scattered over a w × h sky */
export const makeStars = (count: number, w: number, h: number): Star[] => {
	const stars: Star[] = [];
	for (let i = 0; i < count; i++) {
		stars.push({
			x: math.randomFloat(0, w),
			y: math.randomFloat(0, h),
			// one star in five is bigger
			size: math.random(0, 5) === 0 ? 2 : 1,
			phase: math.randomFloat(0, math.TAU),
		});
	}
	return stars;
};

/**
 * The sky drawn without a shader (on the Canvas renderer): a flat colour,
 * two faint nebula clouds, twinkling stars and a ringed planet.
 * @param sky - the background colour
 * @param planet - the clouds' and the planet's colour
 */
export const drawSky = (
	r: Renderer,
	sky: string,
	stars: Star[],
	w: number,
	h: number,
	time: number,
	planet: string,
) => {
	r.setGlobalAlpha(1);
	r.setColor(sky);
	r.fillRect(0, 0, w, h);
	// soft nebula clouds
	r.setColor(planet);
	for (const [nx, ny, nr] of [
		[120, 520, 170],
		[640, 140, 140],
	] as const) {
		r.setGlobalAlpha(0.05);
		r.fillEllipse(nx, ny, nr, nr * 0.7);
		r.fillEllipse(nx + 30, ny - 10, nr * 0.6, nr * 0.45);
	}
	r.setColor("#ffffff");
	for (const s of stars) {
		r.setGlobalAlpha(0.25 + 0.35 * (1 + Math.sin(time * 1.7 + s.phase)));
		r.fillRect(s.x, s.y, s.size, s.size);
	}
	drawPlanet(r, w - 70, h - 60, time, planet);
};

/** A ringed planet, drifting a little around (x, y). */
export const drawPlanet = (
	r: Renderer,
	x: number,
	y: number,
	time: number,
	planet: string,
) => {
	const px = x + Math.sin(time * 0.1) * 6;
	const py = y;
	r.setGlobalAlpha(0.9);
	r.setColor(planet);
	r.fillEllipse(px, py, 46, 46);
	r.setGlobalAlpha(0.25);
	r.setColor("#ffffff");
	r.fillEllipse(px - 14, py - 16, 18, 12);
	r.setGlobalAlpha(0.7);
	r.setColor("#fff2c4");
	r.lineWidth = 4;
	r.strokeEllipse(px, py, 78, 14);
	r.setGlobalAlpha(1);
};
