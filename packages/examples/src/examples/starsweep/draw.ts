/**
 * melonJS — Starsweep: drawing helpers.
 *
 * The power-ups, glows, the drawn sky and the HUD are drawn from shapes
 * (rects, ellipses, arcs, lines, polygons) through the renderer, so they run
 * the same on Canvas, WebGL and WebGPU. The station is a Tiled map and the
 * characters are sprites (see `cast.ts`), both drawn by the engine.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type CanvasRenderer, Polygon, type WebGLRenderer } from "melonjs";
import { DX, DY } from "./board";

export const TILE = 48;

/** Kenney Future, a CC0 sci-fi face, loaded by the bootstrap */
export const FONT = "starsweepFuture";

/** the renderers that can draw every shape used here */
export type Renderer = CanvasRenderer | WebGLRenderer;

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
export const fillShape = (
	r: Renderer,
	shape: Polygon,
	x: number,
	y: number,
) => {
	r.translate(x, y);
	r.fillPolygon(shape);
	r.translate(-x, -y);
};

export interface Star {
	x: number;
	y: number;
	size: number;
	phase: number;
}

export const makeStars = (count: number, w: number, h: number): Star[] => {
	const stars: Star[] = [];
	for (let i = 0; i < count; i++) {
		stars.push({
			x: Math.random() * w,
			y: Math.random() * h,
			size: Math.random() < 0.2 ? 2 : 1,
			phase: Math.random() * Math.PI * 2,
		});
	}
	return stars;
};

export const drawSky = (
	r: Renderer,
	sky: string,
	stars: Star[],
	w: number,
	h: number,
	time: number,
	planet = "#ff8fb4",
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

/** A floor slab: a darker front edge with the face on top. */
export const drawSlab = (
	r: Renderer,
	x: number,
	y: number,
	face: string,
	side: string,
	scale = 1,
) => {
	const s = TILE * scale;
	const ox = x + (TILE - s) / 2;
	const oy = y + (TILE - s) / 2;
	r.setColor(side);
	r.fillRoundRect(ox + 2, oy + s - 14, s - 4, 12, 5);
	r.setColor(face);
	r.fillRoundRect(ox + 2, oy + 2, s - 4, s - 10, 6);
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

export type PowerKind =
	| "gem"
	| "freeze"
	| "shield"
	| "burst"
	| "life"
	| "field"
	| "scan";

export const POWER_COLORS: Record<PowerKind, string> = {
	gem: "#5cf2ff",
	freeze: "#bff4ff",
	shield: "#7ff7ff",
	burst: "#ffd23d",
	life: "#ff6aa2",
	field: "#7ff7c8",
	scan: "#ffb45c",
};

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
			r.strokeArc(cx, y, 9, 0, Math.PI * 2);
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
		case "scan": {
			// a radar sweep
			r.setColor("#7a4a12");
			r.fillEllipse(cx, y, 13, 13);
			r.setColor(color);
			r.lineWidth = 2;
			r.strokeArc(cx, y, 9, 0, Math.PI * 2);
			r.strokeArc(cx, y, 5, 0, Math.PI * 2);
			const a = time * 4;
			r.lineWidth = 3;
			r.strokeLine(cx, y, cx + Math.cos(a) * 10, y + Math.sin(a) * 10);
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
