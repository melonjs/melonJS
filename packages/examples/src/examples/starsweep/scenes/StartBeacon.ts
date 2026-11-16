/**
 * melonJS — Starsweep: the rings pulsing out of the title's start button.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Renderable } from "melonjs";
import { HEIGHT, WIDTH } from "../config/layout";
import { THEMES } from "../rules/levels";
import type { Renderer } from "../utils/draw";

/** the title's start button */
export const START = { x: WIDTH / 2 - 140, y: 812, width: 280, height: 68 };
/** seconds between two rings of the start button's beacon */
const BEACON_TIME = 1.4;

/** rings pulsing out of the start button, to draw the eye to it */
export class StartBeacon extends Renderable {
	private t = 0;

	constructor() {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.floating = true;
	}

	override update(dt: number) {
		this.t = (this.t + dt / 1000) % BEACON_TIME;
		return true;
	}

	override draw(r: Renderer) {
		const k = this.t / BEACON_TIME;
		const grow = 4 + k * 22;
		r.setGlobalAlpha(0.7 * (1 - k));
		r.setColor(THEMES.pink.lit);
		r.lineWidth = 3;
		r.strokeRoundRect(
			START.x - grow,
			START.y - grow,
			START.width + grow * 2,
			START.height + grow * 2,
			18 + grow,
		);
		r.setGlobalAlpha(1);
	}
}
