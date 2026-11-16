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
import { collision, Ellipse, math, Polygon, Renderable } from "melonjs";
import * as sfx from "../audio/sfx";
import { centreX, centreY, REACH, STAND_LIFT, TILE } from "../config/layout";
import type { DeepSpace } from "../fx/DeepSpace";
import type { Effects } from "../fx/Effects";
import { type Cell, DX, DY } from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";

/** seconds a power-up stays on the board */
const LIFE = 9;
/** it blinks for this many seconds before it goes */
const BLINK = 2;

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
	/** Bolt picked it up */
	private taken = false;

	/**
	 * @param kind - what it does
	 * @param cell - the panel it is on
	 * @param effects - for its sparkle when picked up
	 * @param space - for a far-off burst when picked up, when there is one
	 */
	constructor(
		readonly kind: PowerKind,
		readonly cell: Cell,
		private readonly effects: Effects,
		private readonly space: DeepSpace | null,
	) {
		super(centreX(cell.x) - TILE / 2, centreY(cell.y) - TILE / 2, TILE, TILE);
		this.anchorPoint.set(0, 0);
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
		// Bolt finds it with the engine's collision detection (see Bolt.ts):
		// a circle where Bolt would stand, which nothing is pushed off
		this.bodyDef = {
			type: "static",
			shapes: [
				new Ellipse(
					TILE / 2,
					TILE / 2 - STAND_LIFT,
					REACH.powerUp * 2,
					REACH.powerUp * 2,
				),
			],
			isSensor: true,
			collisionType: collision.types.COLLECTABLE_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
		};
	}

	/** whether it is done: picked up, or its time on the board ran out */
	get gone() {
		return this.taken || this.life <= 0;
	}

	/**
	 * Bolt picks it up: a sparkle, a chime and a far-off burst in its colour.
	 * @returns what it does, or null if it was already taken
	 */
	collect(): PowerKind | null {
		if (this.gone) {
			return null;
		}
		this.taken = true;
		this.alpha = 0;
		const color = POWER_COLORS[this.kind];
		sfx.sfxPickup();
		this.space?.burst(color, 0.6);
		this.effects.burst(
			centreX(this.cell.x),
			centreY(this.cell.y) - 6,
			color,
			16,
			160,
		);
		return this.kind;
	}

	/**
	 * Count its time on the board down, while play goes on.
	 * @param dt - seconds
	 */
	step(dt: number) {
		this.life -= dt;
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
