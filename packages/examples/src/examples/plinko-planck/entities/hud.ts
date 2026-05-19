/**
 * melonJS — Plinko (Planck) example: HUD.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Top-of-screen score and "drop count" readout, plus a transient
 * score popup that pulses for ~1s after a slot landing. Each text
 * element is its own `Text` renderable — strings are refreshed via
 * `setText` each frame against the shared `gameState`.
 */

import { Container, Text, timer } from "melonjs";
import {
	COLOR_BALL,
	COLOR_HORIZON_HI,
	DROP_BAND_Y,
	PLAY_LEFT,
	PLAY_RIGHT,
	VIEWPORT_W,
} from "../constants";
import { gameState } from "../gameState";
import { hasActiveBalls } from "./ball";

/** Pulse duration of the score-counter punch-up (ms). */
const SCORE_PULSE_MS = 500;

/**
 * Container hosting all HUD `Text` renderables. Each tick it re-syncs
 * the score / dropped-count strings against `gameState` and drives the
 * post-landing score popup's alpha + scale animation. No custom `draw()`
 * — text comes from melonJS's own glyph rasterizer (works under both
 * Canvas and WebGL renderers; that was the original bug — raw
 * `ctx.fillText` calls broke under WebGL).
 */
export class HUDContainer extends Container {
	private readonly scoreText: Text;
	private readonly ballsText: Text;
	private readonly creditsText: Text;
	private readonly hintText: Text;

	constructor() {
		super(0, 0, VIEWPORT_W, DROP_BAND_Y);
		this.anchorPoint.set(0, 0);
		this.isPersistent = false;
		this.floating = true;
		this.depth = 100;

		// Title — left side
		this.addChild(
			new Text(PLAY_LEFT, 14, {
				font: "Courier New",
				size: 18,
				fillStyle: COLOR_HORIZON_HI,
				textAlign: "left",
				textBaseline: "top",
				bold: true,
				text: "NEON PLINKO",
			}),
		);
		this.addChild(
			new Text(PLAY_LEFT, 36, {
				font: "Courier New",
				size: 10,
				fillStyle: "#a8b0e8",
				textAlign: "left",
				textBaseline: "top",
				text: "// @melonjs/planck-adapter demo",
			}),
		);

		// Hint — centered below the drop band. Swapped between the
		// "click to drop" prompt and the game-over restart prompt each
		// frame in `update()`.
		this.hintText = new Text(VIEWPORT_W / 2, DROP_BAND_Y + 16, {
			font: "Courier New",
			size: 11,
			fillStyle: "#a8b0e8",
			textAlign: "center",
			textBaseline: "top",
			text: "// click to drop a ball",
		});
		this.addChild(this.hintText);

		// Score (right side), credits (centred, same size/weight so it
		// reads as the *other* key counter), balls (right side, small).
		// Kept as fields so `update()` can refresh the strings each
		// frame.
		this.scoreText = new Text(PLAY_RIGHT, 12, {
			font: "Courier New",
			size: 24,
			fillStyle: COLOR_BALL,
			textAlign: "right",
			textBaseline: "top",
			bold: true,
			text: "SCORE 0",
		});
		this.addChild(this.scoreText);

		this.creditsText = new Text(VIEWPORT_W / 2, 12, {
			font: "Courier New",
			size: 24,
			fillStyle: COLOR_HORIZON_HI,
			textAlign: "center",
			textBaseline: "top",
			bold: true,
			text: "CREDITS 0",
		});
		this.addChild(this.creditsText);

		this.ballsText = new Text(PLAY_RIGHT, 40, {
			font: "Courier New",
			size: 11,
			fillStyle: "#a8b0e8",
			textAlign: "right",
			textBaseline: "top",
			text: "BALLS 0",
		});
		this.addChild(this.ballsText);
	}

	override update(dt: number): boolean {
		// Sync the persistent counters. `setText` is a no-op when the
		// string matches, so it's fine to call every frame.
		this.scoreText.setText(`SCORE ${gameState.score}`);
		this.creditsText.setText(`CREDITS ${gameState.credits}`);
		this.ballsText.setText(`BALLS ${gameState.dropped}`);

		// Swap the hint to a restart prompt once the player has run
		// out of credits AND every in-flight ball has landed. We need
		// the world container to count balls — walk up from this HUD
		// (which is parented to the world).
		const world = this.ancestor as Container | null;
		const gameOver =
			gameState.credits <= 0 && (!world || !hasActiveBalls(world));
		this.hintText.setText(
			gameOver
				? "// out of credits — click to restart"
				: "// click to drop a ball",
		);
		this.hintText.fillStyle.parseCSS(gameOver ? COLOR_BALL : "#a8b0e8");

		// Punch-up each counter when its own fly lands on it.
		// SCORE pulses on `lastSlotAt`, CREDITS on `lastCreditAt` —
		// independent because the two flies arrive at different times
		// (refund > 0 spawns its own fly with a different target). The
		// `scale(x, y)` call MULTIPLIES the current transform rather
		// than setting it, so reset to identity each frame before
		// applying the new scale.
		const now = timer.getTime();
		this.scoreText.currentTransform.identity();
		this.creditsText.currentTransform.identity();
		const scoreElapsed = now - gameState.lastSlotAt;
		if (scoreElapsed < SCORE_PULSE_MS) {
			const t = 1 - scoreElapsed / SCORE_PULSE_MS;
			this.scoreText.currentTransform.scale(1 + t * 0.25, 1 + t * 0.25);
		}
		const creditElapsed = now - gameState.lastCreditAt;
		if (creditElapsed < SCORE_PULSE_MS) {
			const t = 1 - creditElapsed / SCORE_PULSE_MS;
			this.creditsText.currentTransform.scale(1 + t * 0.25, 1 + t * 0.25);
		}
		super.update(dt);
		return true;
	}
}
