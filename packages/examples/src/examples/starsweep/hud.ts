/**
 * melonJS — Starsweep: the heads-up display.
 *
 * The top bar (score, best score, the level, Bolt's lives and how much of
 * the board is lit), the message panel over the board ("Level clear!",
 * "Paused", …), how to play under it, and the running power-ups' timers.
 * The words are the engine's `Text`, the progress bar its `ProgressBar`,
 * and the lives small Bolt sprites.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Container,
	math,
	ProgressBar,
	type Renderable,
	type Text,
} from "melonjs";
import { ROWS } from "./board";
import { Actor } from "./cast";
import { makeLabel, POWER_COLORS, type Renderer } from "./draw";
import { BOARD_BOTTOM, OX, OY, TILE, WIDTH } from "./layout";
import { POWER_TIME, type TimedPower } from "./powers";
import { formatScore } from "./score";

/** the most lives Bolt can have, and so the life icons in the top bar */
export const MAX_LIVES = 6;

/** the life icons: small Bolts, from the left of the top bar */
const LIVES = { x: OX + 14, y: 96, spacing: 30, scale: 0.5 };
/** the paint progress bar, after the life icons */
const PROGRESS = { x: OX + MAX_LIVES * LIVES.spacing + 12, y: 88, height: 12 };
/** the panel behind a message, over the middle of the board */
const PANEL = { width: 516, height: 120, top: OY + 225, radius: 18 };
/** the running power-ups' timers, under the board, between the controls */
const TIMERS = { y: BOARD_BOTTOM + 30, spacing: 40, radius: 15 };

/** what a message on the panel says */
interface Message {
	big: string;
	sub: string;
}

/** The heads-up display. */
export class Hud {
	/** the labels and the progress bar, for the screen to add */
	readonly items: Renderable[] = [];

	private readonly score: Text;
	private readonly best: Text;
	private readonly levelName: Text;
	private readonly big: Text;
	private readonly sub: Text;
	/** how to play, under the board: keyboard or touch, whichever is in use */
	private readonly hint: Text;
	private readonly progress: ProgressBar;
	private readonly lives: Actor[] = [];

	private shown = { score: -1, best: -1, touch: null as boolean | null };
	private shownMessage: Message = { big: "", sub: "" };

	/**
	 * @param actors - where the life icons go, with the other characters
	 */
	constructor(actors: Container) {
		const keep = <T extends Renderable>(r: T) => {
			// the play screen loads levels into the world: keep these across it
			r.isPersistent = true;
			this.items.push(r);
			return r;
		};
		this.score = keep(makeLabel(OX, 18, 26, "#ffffff", "left"));
		this.best = keep(makeLabel(WIDTH - OX, 18, 26, "#ffd23d", "right"));
		this.levelName = keep(makeLabel(WIDTH / 2, 56, 16, "#c9c3ff"));
		this.big = keep(makeLabel(WIDTH / 2, PANEL.top + 25, 38, "#ffffff"));
		this.sub = keep(makeLabel(WIDTH / 2, PANEL.top + 81, 15, "#e6e1ff"));
		this.hint = keep(makeLabel(WIDTH / 2, BOARD_BOTTOM + 70, 15, "#8f88c9"));
		this.progress = keep(
			new ProgressBar(PROGRESS.x, PROGRESS.y, {
				width: WIDTH - OX - PROGRESS.x,
				height: PROGRESS.height,
				trackColor: "#1b1838",
				radius: PROGRESS.height / 2,
			}),
		);
		this.progress.floating = true;
		for (let i = 0; i < MAX_LIVES; i++) {
			const icon = new Actor("bolt-idle-down").place(
				LIVES.x + i * LIVES.spacing,
				LIVES.y,
				LIVES.scale,
				0,
			);
			icon.isPersistent = true;
			// not all bobbing in step
			icon.setAnimationFrame(i * 3);
			this.lives.push(icon);
			actors.addChild(icon, 0);
		}
	}

	/** a new level: its number, name and colour */
	setLevel(number: number, count: number, name: string, color: string) {
		this.levelName.setText(`${number} / ${count}  ·  ${name.toUpperCase()}`);
		this.progress.fillColor = color;
	}

	/**
	 * The numbers in the top bar, and how to play.
	 * @param score - the score
	 * @param best - the best score so far
	 * @param lit - the share of the board lit, 0 to 1
	 * @param lives - Bolt's lives, or 0 to show none (between levels)
	 * @param touch - whether the touch controls are in use
	 */
	update(
		score: number,
		best: number,
		lit: number,
		lives: number,
		touch: boolean,
	) {
		if (score !== this.shown.score) {
			this.shown.score = score;
			this.score.setText(formatScore(score));
		}
		if (best !== this.shown.best) {
			this.shown.best = best;
			this.best.setText(`HI ${formatScore(best)}`);
		}
		if (touch !== this.shown.touch) {
			this.shown.touch = touch;
			this.hint.setText(
				touch
					? "LEFT: DRAG TO MOVE  -  RIGHT: ZAP"
					: "ARROWS / WASD TO MOVE  -  SPACE TO ZAP",
			);
		}
		this.progress.value = lit;
		this.lives.forEach((icon, i) => {
			icon.alpha = i < lives ? 1 : 0;
		});
	}

	/** what the message panel says */
	get message(): Message {
		return this.shownMessage;
	}

	/**
	 * Show a message on the panel: a title, and a line under it.
	 * @param big - the title, or "" for none
	 * @param sub - the line under it, or "" for none
	 */
	show(big: string, sub = "") {
		this.shownMessage = { big, sub };
		this.big.setText(big || " ");
		this.sub.setText(sub || " ");
		this.big.alpha = big ? 1 : 0;
		this.sub.alpha = sub ? 1 : 0;
	}

	/** fade the message's words, 0 to 1 */
	set messageAlpha(alpha: number) {
		this.big.alpha = this.sub.alpha = alpha;
	}

	/** how faded the message's words are */
	get messageAlpha() {
		return this.big.alpha;
	}

	/**
	 * The dimming over the board, and the panel behind a message.
	 * @param alpha - how far it is faded in, 0 to 1
	 * @param color - the panel's edge: the level's colour
	 */
	drawPanel(r: Renderer, alpha: number, color: string) {
		if (alpha <= 0) {
			return;
		}
		r.setGlobalAlpha(0.5 * alpha);
		r.setColor("#05030f");
		r.fillRect(0, OY - 8, WIDTH, ROWS * TILE + 16);
		// a panel behind the message so it reads over any board
		const x = (WIDTH - PANEL.width) / 2;
		r.setGlobalAlpha(0.92 * alpha);
		r.setColor("#120a2e");
		r.fillRoundRect(x, PANEL.top, PANEL.width, PANEL.height, PANEL.radius);
		r.setColor(color);
		r.lineWidth = 3;
		r.strokeRoundRect(x, PANEL.top, PANEL.width, PANEL.height, PANEL.radius);
		r.setGlobalAlpha(1);
	}

	/**
	 * The running power-ups, as icons with a draining ring, centred under
	 * the board, between the stick and the button.
	 * @param left - each running power-up, and the seconds it has left
	 */
	drawTimers(r: Renderer, left: [TimedPower, number][]) {
		const running = left.filter(([, seconds]) => seconds > 0);
		let x = WIDTH / 2 - ((running.length - 1) * TIMERS.spacing) / 2;
		for (const [kind, seconds] of running) {
			r.setColor(POWER_COLORS[kind]);
			r.lineWidth = 3;
			r.strokeArc(
				x,
				TIMERS.y,
				TIMERS.radius,
				-math.ETA,
				-math.ETA + math.TAU * (seconds / POWER_TIME[kind]),
			);
			r.setGlobalAlpha(0.9);
			r.fillEllipse(x, TIMERS.y, 7, 7);
			r.setGlobalAlpha(1);
			x += TIMERS.spacing;
		}
	}
}
