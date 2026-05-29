/**
 * HUD — score readout + game-over overlay for the AfterBurner Clone
 * showcase. Built from engine `Text` renderables marked
 * `floating = true` so the labels stay locked to screen space
 * (bypassing the Camera3d perspective projection) and ride the world's
 * painter sort above everything else.
 *
 * Replaces the previous DOM-overlay approach (`document.createElement`
 * + inline styles): now that `Container.draw` swaps to the camera's
 * `screenProjection` for floating children under any camera (including
 * the default Camera3d), the engine's text rendering pipeline is the
 * "right" tool — and it sidesteps the DOM-vs-canvas-scale mismatch
 * under `scale: "auto"`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { type Application, Text } from "melonjs";

const CANVAS_W = 1024;
const CANVAS_H = 768;
// World-Z = camera position, so the squared distance to camera is the
// smallest possible — the world's depth-sort then draws the HUD last,
// on top of every other renderable.
const HUD_Z = -150;

export class HUD {
	private scoreText: Text;
	private gameOverLine: Text;
	private gameOverSub: Text;

	constructor(app: Application) {
		this.scoreText = this._makeText(app, 16, 60, {
			size: 20,
			fillStyle: "#ffe066",
			textAlign: "left",
			textBaseline: "top",
			bold: true,
			text: "SCORE  000000",
		});

		this.gameOverLine = this._makeText(app, CANVAS_W / 2, CANVAS_H / 2 - 12, {
			size: 42,
			fillStyle: "#ff5566",
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: "GAME OVER",
		});
		this.gameOverLine.setOpacity(0);

		this.gameOverSub = this._makeText(app, CANVAS_W / 2, CANVAS_H / 2 + 32, {
			size: 18,
			fillStyle: "#cccccc",
			textAlign: "center",
			textBaseline: "middle",
			text: "",
		});
		this.gameOverSub.setOpacity(0);
	}

	/**
	 * Construct a floating Text at the given screen position and attach
	 * it to the world. `floating = true` on the Text itself is the
	 * engine's intended way to opt a single renderable out of the
	 * Camera3d perspective projection — Container.draw swaps the active
	 * projection to the camera's `screenProjection` (a screen ortho)
	 * for floating children, regardless of whether we're on the default
	 * camera or not.
	 */
	private _makeText(
		app: Application,
		x: number,
		y: number,
		settings: ConstructorParameters<typeof Text>[2],
	): Text {
		const t = new Text(x, y, {
			font: "Courier New",
			...settings,
		});
		t.floating = true;
		app.world.addChild(t, HUD_Z);
		return t;
	}

	/** Refresh the score readout. Zero-padded to 6 digits. */
	setScore(score: number): void {
		this.scoreText.setText(`SCORE  ${score.toString().padStart(6, "0")}`);
	}

	/** Reveal the GAME OVER overlay with the final score + restart hint. */
	showGameOver(score: number): void {
		this.gameOverLine.setOpacity(1);
		this.gameOverSub.setOpacity(1);
		this.gameOverSub.setText(`SCORE ${score} — press R to restart`);
	}

	/** Hide the GAME OVER overlay on restart. */
	hideGameOver(): void {
		this.gameOverLine.setOpacity(0);
		this.gameOverSub.setOpacity(0);
	}
}
