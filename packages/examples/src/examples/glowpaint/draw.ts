/**
 * melonJS — Glowpaint: drawing helpers.
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
import type { EnemyKind } from "./levels";

export const TILE = 48;

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
) => {
	r.setGlobalAlpha(1);
	r.setColor(sky);
	r.fillRect(0, 0, w, h);
	r.setColor("#ffffff");
	for (const s of stars) {
		r.setGlobalAlpha(0.25 + 0.35 * (1 + Math.sin(time * 1.7 + s.phase)));
		r.fillRect(s.x, s.y, s.size, s.size);
	}
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
	r.setGlobalAlpha(1);
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

/** Eyes looking in `dir` (or straight ahead when -1). */
const drawEyes = (
	r: Renderer,
	cx: number,
	cy: number,
	dir: Dir | -1,
	white: string,
	pupil: string,
	spread = 6,
	size = 4.5,
) => {
	const lx = dir === -1 ? 0 : DX[dir] * 2.5;
	const ly = dir === -1 ? 0 : DY[dir] * 2.5;
	r.setColor(white);
	r.fillEllipse(cx - spread, cy - 2, size, size + 1);
	r.fillEllipse(cx + spread, cy - 2, size, size + 1);
	r.setColor(pupil);
	r.fillEllipse(cx - spread + lx, cy - 2 + ly, size * 0.5, size * 0.6);
	r.fillEllipse(cx + spread + lx, cy - 2 + ly, size * 0.5, size * 0.6);
};

/** Lumi, the little light you play. */
export const drawLumi = (
	r: Renderer,
	cx: number,
	cy: number,
	facing: Dir,
	time: number,
	opts: {
		squash?: number;
		scale?: number;
		alpha?: number;
		shield?: boolean;
	} = {},
) => {
	const { squash = 0, scale = 1, alpha = 1, shield = false } = opts;
	const pulse = 1 + Math.sin(time * 6) * 0.06;
	drawGlow(r, cx, cy, 30 * scale * pulse, "#fff2a8", alpha);
	r.setGlobalAlpha(alpha);
	// squash along the way we move: wider across, shorter along
	const along = 15 * scale * (1 - squash * 0.18);
	const across = 15 * scale * (1 + squash * 0.12);
	const horizontal = facing === 1 || facing === 3;
	const w = horizontal ? along : across;
	const h = horizontal ? across : along;
	r.setColor("#ffd23d");
	r.fillEllipse(cx, cy + 1.5 * scale, w, h);
	r.setColor("#fff6c8");
	r.fillEllipse(cx, cy, w - 2 * scale, h - 2 * scale);
	r.setColor("#ffffff");
	r.fillEllipse(cx - 5 * scale, cy - 6 * scale, 4 * scale, 3 * scale);
	if (scale > 0.4) {
		drawEyes(
			r,
			cx,
			cy + 1,
			facing,
			"#3b2a12",
			"#3b2a12",
			5 * scale,
			2.6 * scale,
		);
	}
	if (shield) {
		r.setColor("#7ff7ff");
		r.lineWidth = 3;
		const a = time * 5;
		for (let i = 0; i < 3; i++) {
			const s = a + (i * Math.PI * 2) / 3;
			r.strokeArc(cx, cy, 22, s, s + 1.2);
		}
	}
	r.setGlobalAlpha(1);
};

const ENEMY_COLORS: Record<
	EnemyKind,
	{ body: string; rim: string; glow: string }
> = {
	blot: { body: "#7b3cff", rim: "#4a1fb0", glow: "#9a6bff" },
	smudge: { body: "#2b2b44", rim: "#16162a", glow: "#3cf0c8" },
	hunter: { body: "#ff3b5c", rim: "#a3122f", glow: "#ff6a7f" },
};

export const drawEnemy = (
	r: Renderer,
	kind: EnemyKind,
	cx: number,
	cy: number,
	dir: Dir | -1,
	time: number,
	seed: number,
	opts: { scale?: number; alpha?: number; frozen?: boolean } = {},
) => {
	const { scale = 1, alpha = 1, frozen = false } = opts;
	const c = ENEMY_COLORS[kind];
	const t = frozen ? 0 : time;
	drawGlow(r, cx, cy, 24 * scale, c.glow, alpha * 0.7);
	r.setGlobalAlpha(alpha);
	const wob = Math.sin(t * 8 + seed) * 1.5;
	if (kind === "hunter") {
		// spikes spinning round the body
		r.setColor(c.rim);
		r.lineWidth = 4;
		for (let i = 0; i < 6; i++) {
			const a = t * 2 + (i * Math.PI) / 3;
			r.strokeLine(
				cx + Math.cos(a) * 9 * scale,
				cy + Math.sin(a) * 9 * scale,
				cx + Math.cos(a) * 19 * scale,
				cy + Math.sin(a) * 19 * scale,
			);
		}
	}
	r.setColor(c.rim);
	r.fillEllipse(cx, cy + 2 * scale, (15 + wob) * scale, (14 - wob) * scale);
	r.setColor(c.body);
	r.fillEllipse(cx, cy, (14 + wob) * scale, (13 - wob) * scale);
	if (kind === "blot") {
		// little bubbles orbiting the blob
		for (let i = 0; i < 3; i++) {
			const a = t * 3 + seed + (i * Math.PI * 2) / 3;
			r.fillEllipse(
				cx + Math.cos(a) * 13 * scale,
				cy + Math.sin(a) * 11 * scale,
				4.5 * scale,
				4.5 * scale,
			);
		}
	}
	if (kind === "smudge") {
		// ink drips and a teal rim so it reads on dark tiles
		r.setColor(c.glow);
		r.lineWidth = 2;
		r.strokeEllipse(cx, cy, (14 + wob) * scale, (13 - wob) * scale);
		r.setColor(c.body);
		for (let i = 0; i < 3; i++) {
			const drip = 4 + ((t * 1.5 + i * 0.37 + seed) % 1) * 8;
			r.fillEllipse(
				cx - 8 * scale + i * 8 * scale,
				cy + (10 + drip) * scale,
				3 * scale,
				3.5 * scale,
			);
		}
	}
	if (scale > 0.5) {
		if (kind === "hunter") {
			drawEyes(r, cx, cy, dir, "#fff3c4", "#2a0008", 5.5, 4);
			// angry brows
			r.setColor("#2a0008");
			r.lineWidth = 3;
			r.strokeLine(cx - 10, cy - 9, cx - 2, cy - 5);
			r.strokeLine(cx + 10, cy - 9, cx + 2, cy - 5);
		} else if (kind === "smudge") {
			drawEyes(r, cx, cy, dir, "#e8ff6a", "#14140a", 5.5, 4);
		} else {
			drawEyes(r, cx, cy, dir, "#ffffff", "#1d0b4a", 6, 4.5);
		}
	}
	if (frozen) {
		r.setGlobalAlpha(alpha * 0.45);
		r.setColor("#bff4ff");
		r.fillEllipse(cx, cy, 17 * scale, 16 * scale);
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
