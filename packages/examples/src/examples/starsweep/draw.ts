/**
 * melonJS — Starsweep: drawing helpers.
 *
 * Everything on screen is drawn from shapes (rects, ellipses, arcs,
 * lines, polygons) through the renderer, so the example has no image
 * assets at all and runs the same on Canvas, WebGL and WebGPU.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type CanvasRenderer, Polygon, type WebGLRenderer } from "melonjs";
import { type Dir, DX, DY } from "./board";

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
// one chevron per direction, pointing that way
const CHEVRONS = ([0, 1, 2, 3] as Dir[]).map((d) => {
	const pts: [number, number][] = [
		[-9, 4],
		[0, -5],
		[9, 4],
		[9, 9],
		[0, 0],
		[-9, 9],
	];
	// rotate the "up" chevron to face `d`
	const rot = ([x, y]: [number, number]): [number, number] => {
		switch (d) {
			case 1:
				return [-y, x];
			case 2:
				return [-x, -y];
			case 3:
				return [y, -x];
			default:
				return [x, y];
		}
	};
	return poly(pts.map(rot));
});

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

/** A wall block, raised above the floor. */
export const drawWall = (
	r: Renderer,
	x: number,
	y: number,
	top: string,
	side: string,
) => {
	r.setColor(side);
	r.fillRect(x + 1, y + TILE - 18, TILE - 2, 18);
	r.setColor(top);
	r.fillRoundRect(x + 1, y - 8, TILE - 2, TILE - 8, 4);
	r.setGlobalAlpha(0.18);
	r.setColor("#ffffff");
	r.fillRect(x + 4, y - 5, TILE - 8, 3);
	// an inset hatch with a status light
	r.setGlobalAlpha(0.35);
	r.setColor("#000000");
	r.fillRoundRect(x + 9, y + 2, TILE - 18, TILE - 24, 4);
	r.setGlobalAlpha(1);
	r.setColor("#ffcf3d");
	r.fillRect(x + 1, y + TILE - 12, TILE - 2, 3);
	r.setColor("#5dff9a");
	r.fillEllipse(x + TILE / 2, y + 12, 2.5, 2.5);
};

export const drawIceSheen = (r: Renderer, x: number, y: number) => {
	r.setGlobalAlpha(0.55);
	r.setColor("#ffffff");
	r.lineWidth = 2;
	r.strokeLine(x + 10, y + 26, x + 24, y + 10);
	r.strokeLine(x + 18, y + 30, x + 34, y + 12);
	r.setGlobalAlpha(1);
};

export const drawChevron = (
	r: Renderer,
	cx: number,
	cy: number,
	dir: Dir,
	color: string,
	time: number,
) => {
	const nudge = ((time * 2.5) % 1) * 6 - 3;
	r.setColor(color);
	fillShape(r, CHEVRONS[dir], cx + DX[dir] * nudge, cy + DY[dir] * nudge);
};

export const drawCracks = (r: Renderer, x: number, y: number) => {
	r.setColor("#05050c");
	r.setGlobalAlpha(0.7);
	r.lineWidth = 2;
	r.strokeLine(x + 8, y + 10, x + 20, y + 20);
	r.strokeLine(x + 20, y + 20, x + 17, y + 32);
	r.strokeLine(x + 20, y + 20, x + 36, y + 16);
	r.strokeLine(x + 36, y + 16, x + 40, y + 28);
	r.setGlobalAlpha(1);
};

export const drawNest = (r: Renderer, cx: number, cy: number, time: number) => {
	r.setGlobalAlpha(0.65);
	r.setColor("#05030f");
	r.fillEllipse(cx, cy - 4, 15, 12);
	r.setGlobalAlpha(0.9);
	r.setColor("#a24dff");
	r.lineWidth = 3;
	const a = time * 3;
	r.strokeArc(cx, cy - 4, 12, a, a + 2.2);
	r.strokeArc(cx, cy - 4, 12, a + Math.PI, a + Math.PI + 2.2);
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

export type PowerKind = "gem" | "freeze" | "shield" | "burst" | "life";

export const POWER_COLORS: Record<PowerKind, string> = {
	gem: "#5cf2ff",
	freeze: "#bff4ff",
	shield: "#7ff7ff",
	burst: "#ffd23d",
	life: "#ff6aa2",
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
