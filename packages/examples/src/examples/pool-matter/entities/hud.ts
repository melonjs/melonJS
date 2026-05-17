/**
 * melonJS — Pool (Matter) example: HUD (score, balls-left, game-over).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Container, Text } from "melonjs";
import { VIEWPORT_W } from "../constants";
import { gameState } from "../gameState";

/**
 * Minimal HUD: score + balls-remaining counter, plus a "GAME OVER"
 * banner when the 8-ball is sunk. Uses melonJS's `Text` Renderable
 * (system-font rendered into a canvas texture) so it works on both
 * the Canvas and WebGL renderers — earlier versions dropped to
 * `renderer.getContext().fillText`, which silently broke under WebGL
 * because `getContext()` there returns the GL context (no `save()` /
 * `fillText`).
 */
class HUDText extends Text {
	private kind: "score" | "balls" | "gameover";

	constructor(
		x: number,
		y: number,
		kind: "score" | "balls" | "gameover",
		textAlign: "left" | "right" | "center",
	) {
		super(x, y, {
			font: "sans-serif",
			size: kind === "gameover" ? 48 : 20,
			fillStyle: kind === "gameover" ? "#ffd700" : "#ffffff",
			textAlign,
			textBaseline: "top",
			text: kind === "gameover" ? "GAME OVER" : "0",
		});
		this.kind = kind;
		this.floating = true;
		this.alwaysUpdate = true;
	}

	override update(_dt: number): boolean {
		// Refresh the displayed string each frame from gameState. Text
		// only redraws its texture when `setText` actually changes the
		// content, so this is cheap when nothing's changing.
		if (this.kind === "score") {
			this.setText(`Score: ${gameState.score}`);
		} else if (this.kind === "balls") {
			this.setText(`Balls left: ${gameState.ballsRemaining}`);
		}
		// "gameover" Text only needs to render when gameState.gameOver
		// is true — the HUDContainer toggles its draw by add/remove.
		return super.update(_dt);
	}
}

export class HUDContainer extends Container {
	private gameOverText: HUDText;
	private gameOverShown = false;

	constructor() {
		super();
		this.isPersistent = true;
		this.floating = true;
		this.name = "HUD";
		// `Renderable.z` is the typed accessor for the underlying
		// ObservableVector3d.z (declared as Vector2d in some signatures).
		this.z = Number.POSITIVE_INFINITY;
		// Y=16 keeps the text in the brown rail strip above the felt — the
		// previous Y=50 placed it level with the corner pockets, where the
		// numbers overlapped the pocket "holes" on the table sprite.
		this.addChild(new HUDText(16, 8, "score", "left"));
		this.addChild(new HUDText(VIEWPORT_W - 16, 8, "balls", "right"));
		// Keep a reference but don't add until the game ends, so the
		// "GAME OVER" text isn't rendered during normal play.
		this.gameOverText = new HUDText(VIEWPORT_W / 2, 280, "gameover", "center");
	}

	override update(dt: number): boolean {
		if (gameState.gameOver && !this.gameOverShown) {
			this.addChild(this.gameOverText);
			this.gameOverShown = true;
		} else if (!gameState.gameOver && this.gameOverShown) {
			this.removeChildNow(this.gameOverText, true);
			this.gameOverShown = false;
		}
		return super.update(dt);
	}
}
