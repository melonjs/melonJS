/**
 * melonJS — Starsweep: the title screen's backdrop.
 *
 * A strip of deck lighting up as Bolt runs over it, the monsters after
 * it, and now and then a nova far off in space.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Renderable } from "melonjs";
import {
	BACKGROUND,
	HEIGHT,
	OX,
	STAND_LIFT,
	TILE,
	WIDTH,
} from "../config/layout";
import { Actor, GLOW } from "../entities/Actor";
import type { DeepSpace } from "../fx/DeepSpace";
import { controls } from "../input/Controls";
import { COLS } from "../rules/board";
import { THEMES } from "../rules/levels";
import {
	drawGlow,
	drawPanelDetail,
	drawSky,
	drawSlab,
	makeStars,
	type Renderer,
	type Star,
} from "../utils/draw";

/** the title's colours: the cyan and pink themes */
export const TITLE = {
	sky: BACKGROUND,
	clouds: THEMES.pink.litSide,
	deepClouds: THEMES.cyan.wallSide,
	novas: [THEMES.pink.lit, THEMES.cyan.lit],
	dust: [THEMES.pink.lit, THEMES.cyan.lit, "#ffffff", THEMES.violet.lit],
	lit: THEMES.cyan.lit,
	litSide: THEMES.cyan.litSide,
};

/** the title's strip of deck: where it is, and its unlit colours */
const DECK = { y: 500, face: "#2b3052", side: "#161a32" };
/** seconds Bolt takes to run across the deck and come round again */
const LAP_TIME = 7;
/** Bolt, then the monsters after it, and how many cells behind each runs */
const RUNNERS = [
	{ kind: "bolt", behind: 0 },
	{ kind: "wobbler", behind: 1.8 },
	{ kind: "muncher", behind: 3.1 },
	{ kind: "chaser", behind: 4.4 },
] as const;

/** A strip of tiles lighting up as Bolt runs over it, monsters in pursuit. */
export class TitleBackdrop extends Renderable {
	/** false when a shader sky is drawn behind instead */
	drawnSky = true;
	/** the 3D space behind, for a nova now and then */
	deep: DeepSpace | null = null;
	/** the runners' sprites, for the screen to add */
	readonly runners = RUNNERS.map(({ kind }) => new Actor(`${kind}-walk-right`));

	private time = 0;
	private readonly stars: Star[] = makeStars(140, WIDTH, HEIGHT);
	private nextNova = 1;
	private started = false;

	constructor(private readonly onStart: () => void) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	/** start the game, once: the start button, or a key */
	start() {
		if (!this.started) {
			this.started = true;
			this.onStart();
		}
	}

	override update(dt: number) {
		this.time += dt / 1000;
		controls.poll();
		if (this.time > 0.5 && controls.confirm()) {
			this.start();
		}
		this.nextNova -= dt / 1000;
		if (this.nextNova <= 0) {
			this.nextNova = 2 + Math.random() * 3;
			this.deep?.burst(TITLE.novas[Math.random() < 0.5 ? 0 : 1]);
		}
		const y = DECK.y + TILE / 2 - STAND_LIFT;
		const at = this.boltCell();
		this.runners.forEach((runner, i) => {
			runner.place(OX + (at - RUNNERS[i].behind) * TILE + TILE / 2, y);
		});
		return true;
	}

	/**
	 * Where Bolt is along the deck, in cells: it runs in from off the left,
	 * and out past the right until the last monster has gone too.
	 */
	private boltCell() {
		const start = -1;
		const end = COLS + RUNNERS[RUNNERS.length - 1].behind + 1;
		const u = (this.time % LAP_TIME) / LAP_TIME;
		return start + u * (end - start);
	}

	override draw(r: Renderer) {
		if (this.drawnSky) {
			drawSky(r, TITLE.sky, this.stars, WIDTH, HEIGHT, this.time, TITLE.clouds);
		}
		// the deck lights up behind Bolt
		const lit = this.boltCell();
		for (let i = 0; i < COLS; i++) {
			const on = i < lit;
			const x = OX + i * TILE;
			drawSlab(
				r,
				x,
				DECK.y,
				on ? TITLE.lit : DECK.face,
				on ? TITLE.litSide : DECK.side,
			);
			drawPanelDetail(r, x, DECK.y, on);
		}
		// a glow under each runner; the sprites draw over it
		this.runners.forEach((runner, i) => {
			drawGlow(r, runner.pos.x, runner.pos.y, 26, GLOW[RUNNERS[i].kind], 0.75);
		});
	}
}
