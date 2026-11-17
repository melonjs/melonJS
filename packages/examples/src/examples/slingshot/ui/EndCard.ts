/**
 * melonJS — Slingshot: the card shown at the end of a round.
 *
 * The result, the stars earned, the score, and a PLAY AGAIN button, which
 * builds the stage again with `state.reload()`. A blocking `UIPanel`, so a
 * press on it never reaches the game behind.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { state, Text, UIPanel, UITextButton } from "melonjs";

/** how a round ended */
export interface RoundResult {
	// every rival knocked out, or the pets ran out first
	cleared: boolean;
	score: number;
	stars: number;
	// the pets not launched, and the bonus they earned
	sparePets: number;
	bonus: number;
}

const WIDTH = 420;
const HEIGHT = 300;

export class EndCard extends UIPanel {
	/**
	 * @param screenWidth - the screen's width, to centre the card on
	 * @param screenHeight - the screen's height
	 * @param result - how the round ended
	 */
	constructor(screenWidth: number, screenHeight: number, result: RoundResult) {
		super((screenWidth - WIDTH) / 2, (screenHeight - HEIGHT) / 2, {
			width: WIDTH,
			height: HEIGHT,
			fillColor: "#1d3b57",
			borderColor: "#f6c445",
			borderWidth: 4,
			radius: 22,
			shadowColor: "rgba(0, 0, 0, 0.35)",
			shadowOffsetY: 8,
			shadowBlur: 16,
			blocking: true,
		});
		const { cleared, score, stars, sparePets, bonus } = result;

		this.line(26, cleared ? "TOWERS CLEARED!" : "OUT OF PETS", 38);
		this.line(84, "★".repeat(stars) + "☆".repeat(3 - stars), 56, "#f6c445");
		this.line(160, `score ${score}`, 26);
		this.line(
			194,
			bonus > 0
				? `${sparePets} spare pet${sparePets > 1 ? "s" : ""}: +${bonus}`
				: " ",
			18,
			"#bcd3e6",
		);

		this.addChild(
			new UITextButton(WIDTH / 2 - 110, 228, {
				width: 220,
				height: 52,
				font: "sans-serif",
				fontSize: 24,
				text: "PLAY AGAIN",
				labelFillStyle: "#ffffff",
				hoverOffColor: "#e8892c",
				hoverOnColor: "#f6a23f",
				pressedColor: "#c86e1c",
				borderColor: "#7a3f0c",
				hoverScale: 1.05,
				pressScale: 0.95,
				// the stage is built again, once this frame is done with the world
				onClick: () => {
					state.reload();
				},
			}),
		);
	}

	/**
	 * A line of text, centred on the card.
	 * @param y - how far down the card
	 * @param text - what it says
	 * @param size - its size, in pixels
	 * @param fill - its colour
	 */
	private line(y: number, text: string, size: number, fill = "#ffffff") {
		this.addChild(
			new Text(WIDTH / 2, y, {
				font: "sans-serif",
				size,
				fillStyle: fill,
				strokeStyle: "#10243a",
				// an outline on the big lines only
				lineWidth: size > 30 ? 6 : 0,
				textAlign: "center",
				text,
			}),
		);
	}
}
