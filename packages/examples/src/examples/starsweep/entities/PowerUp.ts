/**
 * melonJS — Starsweep: a power-up on the board.
 *
 * It bobs over its panel for a while, blinks before it goes, and goes if
 * Bolt does not pick it up in time: a gem (points), an extra life, a freeze
 * (monsters stop), a shield (monsters pop on contact), a burst (sparks in
 * four directions) or a force-field (cells round Bolt that monsters cannot
 * cross). `game/Powers.ts` puts them on the board; the field decides what
 * picking one up does.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math, Polygon, Renderable } from "melonjs";
import { centreX, centreY, STAND_LIFT, TILE } from "../config/layout";
import { type Cell, DX, DY } from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";

/** seconds a power-up stays on the board */
const LIFE = 9;
/** it blinks for this many seconds before it goes */
const BLINK = 2;
/** how close Bolt must come to pick one up, as a share of a cell */
const PICKUP_REACH = 0.5;

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

/**
 * A power-up's icon, bobbing over its cell with a shadow under it.
 * @param cx - the cell's centre across
 * @param cy - the cell's centre down
 * @param time - the game's clock, in seconds, for the bobbing
 * @param alpha - 1, or less while it blinks before it goes
 */
const drawIcon = (
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

/** A power-up on a panel, waiting to be picked up. */
export class PowerUp extends Renderable {
	/** seconds before it goes */
	private life = LIFE;
	/** its own clock, for the bobbing */
	private time = 0;

	/**
	 * @param kind - what it does
	 * @param cell - the panel it is on
	 */
	constructor(
		readonly kind: PowerKind,
		readonly cell: Cell,
	) {
		super(centreX(cell.x) - TILE / 2, centreY(cell.y) - TILE / 2, TILE, TILE);
		this.anchorPoint.set(0, 0);
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
	}

	/** whether its time on the board ran out */
	get gone() {
		return this.life <= 0;
	}

	/**
	 * Count its time on the board down, while play goes on.
	 * @param dt - seconds
	 */
	step(dt: number) {
		this.life -= dt;
	}

	/** whether Bolt, at a point on the screen, is close enough to pick it up */
	isReachedFrom(x: number, y: number) {
		return (
			Math.hypot(
				centreX(this.cell.x) - x,
				centreY(this.cell.y) - STAND_LIFT - y,
			) <
			TILE * PICKUP_REACH
		);
	}

	override update(dt: number) {
		this.time += dt / 1000;
		return true;
	}

	override draw(r: Renderer) {
		const blink =
			this.life < BLINK && Math.floor(this.life * 8) % 2 === 0 ? 0.3 : 1;
		drawIcon(
			r,
			this.kind,
			centreX(this.cell.x),
			centreY(this.cell.y) - 2,
			this.time,
			blink,
		);
	}
}
