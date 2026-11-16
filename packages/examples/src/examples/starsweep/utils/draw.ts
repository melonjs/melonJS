/**
 * melonJS — Starsweep: drawing helpers, and the game's text labels.
 *
 * The power-ups, glows, the drawn sky and the title's strip of deck are
 * drawn from shapes (rects, ellipses, arcs, lines, polygons) through the
 * renderer, so they run the same on Canvas, WebGL and WebGPU. The station
 * is a Tiled map and the characters are sprites (see `cast.ts`), both
 * drawn by the engine; the words on screen are the engine's `Text`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type CanvasRenderer,
	math,
	Polygon,
	Text,
	type WebGLRenderer,
	type WebGPURenderer,
} from "melonjs";
import { TILE } from "../config/layout";
import { DX, DY } from "../rules/board";

/** Kenney Future, a CC0 sci-fi face, loaded by the bootstrap */
export const FONT = "starsweepFuture";

/** the renderers the game runs on, which all draw every shape used here */
export type Renderer = CanvasRenderer | WebGLRenderer | WebGPURenderer;

/**
 * A line of text in the game's font, fixed on the screen (it does not move
 * with the camera), hung from its top.
 * @param x - where it is anchored across, by `align`
 * @param y - its top
 * @param size - the font size, in pixels
 * @param color - its colour
 * @param align - which side of it `x` is
 * @param text - what it says; set it later with `setText`
 * @returns the label, to add to a container
 */
export const makeLabel = (
	x: number,
	y: number,
	size: number,
	color: string,
	align: "left" | "center" | "right" = "center",
	text = " ",
) => {
	const label = new Text(x, y, {
		font: FONT,
		size,
		fillStyle: color,
		textAlign: align,
		textBaseline: "top",
		text,
	});
	label.floating = true;
	return label;
};

const poly = (points: [number, number][]) =>
	new Polygon(
		0,
		0,
		points.flat() as [number, number, number, number, number, number],
	);

// shapes are built once around (0, 0) and drawn with a translate
const DIAMOND = poly([
	[0, -13],
	[11, -2],
	[0, 13],
	[-11, -2],
]);
const HEART_TIP = poly([
	[-11.5, -1],
	[11.5, -1],
	[0, 12],
]);
/** fill a shape built around (0, 0), centred on (x, y) */
const fillShape = (r: Renderer, shape: Polygon, x: number, y: number) => {
	r.translate(x, y);
	r.fillPolygon(shape);
	r.translate(-x, -y);
};

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

/**
 * A floor slab, one cell wide, its top left at (x, y): a darker front edge
 * with the face on top.
 */
export const drawSlab = (
	r: Renderer,
	x: number,
	y: number,
	face: string,
	side: string,
) => {
	r.setColor(side);
	r.fillRoundRect(x + 2, y + TILE - 14, TILE - 4, 12, 5);
	r.setColor(face);
	r.fillRoundRect(x + 2, y + 2, TILE - 4, TILE - 10, 6);
};

/** Rivets and a seam, so a slab reads as a metal deck panel. */
export const drawPanelDetail = (
	r: Renderer,
	x: number,
	y: number,
	lit: boolean,
) => {
	r.setGlobalAlpha(lit ? 0.35 : 0.5);
	r.setColor(lit ? "#ffffff" : "#0d1024");
	for (const [rx, ry] of [
		[8, 8],
		[TILE - 8, 8],
		[8, TILE - 16],
		[TILE - 8, TILE - 16],
	]) {
		r.fillEllipse(x + rx, y + ry, 1.8, 1.8);
	}
	if (!lit) {
		r.fillRect(x + 14, y + 19, TILE - 28, 2);
	}
	r.setGlobalAlpha(1);
};

/** A soft halo: stacked translucent discs, so it fades towards the edge. */
export const drawGlow = (
	r: Renderer,
	cx: number,
	cy: number,
	radius: number,
	color: string,
	alpha: number,
) => {
	r.setColor(color);
	r.setGlobalAlpha(alpha * 0.07);
	for (let k = 1; k >= 0.3; k -= 0.14) {
		r.fillEllipse(cx, cy, radius * k, radius * k);
	}
	r.setGlobalAlpha(1);
};

/** the power-ups Bolt can pick up */
export type PowerKind =
	| "gem"
	| "freeze"
	| "shield"
	| "burst"
	| "life"
	| "field";

/** each power-up's colour, also its glow and its timer's */
export const POWER_COLORS: Record<PowerKind, string> = {
	gem: "#5cf2ff",
	freeze: "#bff4ff",
	shield: "#7ff7ff",
	burst: "#ffd23d",
	life: "#ff6aa2",
	field: "#7ff7c8",
};

/**
 * A power-up's icon, bobbing over its cell with a shadow under it.
 * @param cx - the cell's centre across
 * @param cy - the cell's centre down
 * @param time - the game's clock, in seconds, for the bobbing
 * @param alpha - 1, or less while it blinks before it goes
 */
export const drawPower = (
	r: Renderer,
	kind: PowerKind,
	cx: number,
	cy: number,
	time: number,
	alpha = 1,
) => {
	const color = POWER_COLORS[kind];
	const bob = Math.sin(time * 4) * 3;
	const y = cy - 6 + bob;
	drawGlow(r, cx, y, 24, color, alpha);
	r.setGlobalAlpha(alpha * 0.35);
	r.setColor("#000000");
	r.fillEllipse(cx, cy + 12, 10 - bob, 3);
	r.setGlobalAlpha(alpha);
	switch (kind) {
		case "gem":
			r.setColor("#1c9fd6");
			fillShape(r, DIAMOND, cx, y + 1);
			r.setColor(color);
			fillShape(r, DIAMOND, cx, y - 1);
			r.setColor("#ffffff");
			r.fillRect(cx - 3, y - 7, 3, 5);
			break;
		case "freeze": {
			r.setColor("#2b6f9e");
			r.fillEllipse(cx, y, 13, 13);
			r.setColor(color);
			r.lineWidth = 3;
			for (let i = 0; i < 3; i++) {
				const a = (i * Math.PI) / 3 + time;
				r.strokeLine(
					cx - Math.cos(a) * 10,
					y - Math.sin(a) * 10,
					cx + Math.cos(a) * 10,
					y + Math.sin(a) * 10,
				);
			}
			break;
		}
		case "shield":
			r.setColor("#1f7f8f");
			r.fillEllipse(cx, y, 13, 13);
			r.setColor(color);
			r.lineWidth = 3;
			r.strokeArc(cx, y, 9, 0, math.TAU);
			r.fillEllipse(cx, y, 4, 4);
			break;
		case "burst":
			r.setColor("#a8641a");
			r.fillEllipse(cx, y, 13, 13);
			r.setColor(color);
			r.fillEllipse(cx, y, 4, 4);
			for (let i = 0; i < 4; i++) {
				r.fillEllipse(cx + DX[i] * 8, y + DY[i] * 8, 3, 3);
			}
			break;
		case "field": {
			// a hexagon of force
			r.setColor("#1f6f5a");
			r.fillEllipse(cx, y, 13, 13);
			r.setColor(color);
			r.lineWidth = 3;
			for (let i = 0; i < 6; i++) {
				const a = (i * Math.PI) / 3 + Math.PI / 6;
				const b = a + Math.PI / 3;
				r.strokeLine(
					cx + Math.cos(a) * 9,
					y + Math.sin(a) * 9,
					cx + Math.cos(b) * 9,
					y + Math.sin(b) * 9,
				);
			}
			break;
		}
		case "life":
			r.setColor(color);
			r.fillEllipse(cx - 5.5, y - 3, 6.5, 6.5);
			r.fillEllipse(cx + 5.5, y - 3, 6.5, 6.5);
			fillShape(r, HEART_TIP, cx, y);
			r.setColor("#ffffff");
			r.fillEllipse(cx - 6, y - 5, 2, 2);
			break;
	}
	r.setGlobalAlpha(1);
};
