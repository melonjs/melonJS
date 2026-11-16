/**
 * melonJS — Slingshot: the heads-up display.
 *
 * The score in one corner, the rivals left in the other, and a hint for the
 * first shot along the bottom. Floating `Text`, drawn over the 3D scene.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Text, type World } from "melonjs";

/** the look the HUD, and the points that pop up, share */
export const HUD_STYLE = {
	font: "sans-serif",
	size: 30,
	fillStyle: "#ffffff",
	strokeStyle: "#1d2a3a",
	lineWidth: 5,
};

// over the scene and the end-of-round card
const HUD_DEPTH = 3;

export class Hud {
	private readonly score: Text;
	private readonly rivals: Text;
	private readonly hint: Text;

	/**
	 * Add the HUD to the world.
	 * @param world - the game world
	 * @param width - the screen's width
	 * @param height - the screen's height
	 */
	constructor(world: World, width: number, height: number) {
		this.score = new Text(20, 16, { ...HUD_STYLE, text: "" });
		this.rivals = new Text(width - 20, 16, {
			...HUD_STYLE,
			textAlign: "right",
			text: "",
		});
		this.hint = new Text(width / 2, height - 70, {
			...HUD_STYLE,
			size: 22,
			lineWidth: 4,
			textAlign: "center",
			text: "press anywhere, drag back and let go",
		});
		for (const text of [this.score, this.rivals, this.hint]) {
			text.floating = true;
			world.addChild(text, HUD_DEPTH);
		}
	}

	/**
	 * Show the score and the rivals still standing.
	 * @param score - the score
	 * @param rivalsLeft - the rivals not knocked out yet
	 * @param rivalCount - how many there were
	 */
	show(score: number, rivalsLeft: number, rivalCount: number) {
		this.score.setText(`SCORE ${score}`);
		this.rivals.setText(`RIVALS ${rivalsLeft} / ${rivalCount}`);
	}

	/** Hide the first-shot hint. */
	hideHint() {
		this.hint.alpha = 0;
	}
}
