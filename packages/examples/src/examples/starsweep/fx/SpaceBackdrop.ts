/**
 * melonJS — Starsweep: the ringed planet, and the drawn sky.
 *
 * Drawn under the Tiled board: the planet always, and the whole sky
 * (stars and all) on a renderer that cannot run the nebula shader.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Renderable } from "melonjs";
import { BACKGROUND } from "../config/layout";
import { THEMES, type Theme } from "../rules/levels";
import {
	drawPlanet,
	drawSky,
	makeStars,
	type Renderer,
	type Star,
} from "../utils/draw";

/**
 * The ringed planet, and the whole sky on a renderer that cannot run the
 * nebula shader. Drawn under the Tiled board.
 */
export class SpaceBackdrop extends Renderable {
	private time = 0;
	private readonly stars: Star[];
	private planet = THEMES.cyan.litSide;
	private sky = BACKGROUND;

	constructor(
		w: number,
		h: number,
		/** draw the sky too: false when the nebula shader paints it */
		private readonly drawnSky: boolean,
		private readonly planetAt: { x: number; y: number },
	) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.isPersistent = true;
		this.stars = makeStars(120, w, h);
	}

	/** take on a level's colours */
	setTheme(theme: Theme) {
		this.planet = theme.litSide;
		this.sky = theme.sky;
	}

	override update(dt: number) {
		this.time += dt / 1000;
		return true;
	}

	override draw(r: Renderer) {
		if (this.drawnSky) {
			drawSky(
				r,
				this.sky,
				this.stars,
				this.width,
				this.height,
				this.time,
				this.planet,
			);
		} else {
			drawPlanet(r, this.planetAt.x, this.planetAt.y, this.time, this.planet);
		}
	}
}
