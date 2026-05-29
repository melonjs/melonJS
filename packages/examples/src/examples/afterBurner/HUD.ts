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
import {
	type Application,
	type CanvasRenderer,
	Renderable,
	save,
	Text,
	type WebGLRenderer,
} from "melonjs";

const CANVAS_W = 1024;
const CANVAS_H = 768;
// World-Z = camera position, so the squared distance to camera is the
// smallest possible — the world's depth-sort then draws the HUD last,
// on top of every other renderable.
const HUD_Z = -150;
// Above HUD_Z so the death flash overpaints score + game-over text.
const FLASH_Z = -200;
// Initial overlay alpha at the moment of death — strong enough to "white
// out" the cockpit (red, in this case), faint enough that the player can
// still see the explosion underneath.
const DEATH_FLASH_ALPHA = 0.55;
// Linear fade — matches the death rumble's ~1.1 s tail so the flash and
// audio decay together.
const DEATH_FLASH_FADE_MS = 1100;

/**
 * Full-screen colored overlay that fades to transparent over a fixed
 * duration. Used as the player death "hit flash" so the cockpit washes
 * red in time with the explosion + audio rumble.
 *
 * Implementation note: rendered as a floating Renderable (screen-space
 * projection) with a manual `fillRect` so the alpha blends correctly —
 * the engine's `ColorLayer` would `clearColor` over the framebuffer,
 * which would overwrite the explosion underneath instead of tinting it.
 */
class DeathFlash extends Renderable {
	private remainingMs = 0;
	private startAlpha = DEATH_FLASH_ALPHA;

	constructor() {
		super(0, 0, CANVAS_W, CANVAS_H);
		this.floating = true;
		this.alwaysUpdate = true;
		// Renderable defaults anchorPoint to (0.5, 0.5), which would
		// shift our fillRect by (-w/2, -h/2) via preDraw and leave
		// only the top-left quadrant visible — zero it so our
		// fillRect(0, 0, w, h) covers the whole screen.
		this.anchorPoint.set(0, 0);
		this.setOpacity(0);
		this.tint.parseCSS("#ff3030");
	}

	trigger(): void {
		this.remainingMs = DEATH_FLASH_FADE_MS;
		this.setOpacity(this.startAlpha);
	}

	hide(): void {
		this.remainingMs = 0;
		this.setOpacity(0);
	}

	override update(dt: number): boolean {
		if (this.remainingMs <= 0) {
			return false;
		}
		this.remainingMs -= dt;
		if (this.remainingMs <= 0) {
			this.setOpacity(0);
			return false;
		}
		this.setOpacity((this.remainingMs / DEATH_FLASH_FADE_MS) * this.startAlpha);
		return true;
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer): void {
		const alpha = this.getOpacity();
		if (alpha <= 0) {
			return;
		}
		renderer.save();
		renderer.setColor(this.tint);
		renderer.setGlobalAlpha(alpha);
		renderer.fillRect(0, 0, CANVAS_W, CANVAS_H);
		renderer.restore();
	}
}

// Persistent HiScore key under `me.save`. The engine wires up the
// localStorage round-trip + private-mode fallback for us; we just
// declare the key + default once at HUD construction and read/write
// `save[HISCORE_KEY]` as a plain property afterward.
const HISCORE_KEY = "afterBurnerHiScore";

export class HUD {
	private scoreText: Text;
	private hiScoreText: Text;
	private livesText: Text;
	private gameOverLine: Text;
	private gameOverSub: Text;
	private deathFlash: DeathFlash;
	private hiScore: number;

	constructor(app: Application) {
		// Register the HiScore key with a default of 0. `save.add` is
		// idempotent — it loads the persisted value on second-and-later
		// game opens, so this also doubles as the "load on boot" step.
		save.add({ [HISCORE_KEY]: 0 });
		this.hiScore = (save[HISCORE_KEY] as number) ?? 0;

		this.scoreText = this._makeText(app, 16, 24, {
			size: 32,
			fillStyle: "#ffe066",
			textAlign: "left",
			textBaseline: "top",
			bold: true,
			text: "SCORE  000000",
		});

		this.hiScoreText = this._makeText(app, CANVAS_W - 16, 24, {
			size: 32,
			fillStyle: "#ffae3a",
			textAlign: "right",
			textBaseline: "top",
			bold: true,
			text: `HI  ${this.hiScore.toString().padStart(6, "0")}`,
		});

		// Lives readout — top-center, big enough to be glanceable but
		// smaller than the score so the eye still goes there first.
		this.livesText = this._makeText(app, CANVAS_W / 2, 24, {
			size: 28,
			fillStyle: "#ff7766",
			textAlign: "center",
			textBaseline: "top",
			bold: true,
			text: "▲ ▲ ▲",
		});

		// Music attribution — bottom-left, low-key (small size + muted
		// tint) so it doesn't compete with the score or game-over text.
		// The world owns the reference via `addChild`, so we don't keep
		// a field for it here.
		this._makeText(app, 16, CANVAS_H - 16, {
			size: 11,
			fillStyle: "#bbbbbb",
			textAlign: "left",
			textBaseline: "bottom",
			text: "Music by davidKBD: https://www.davidkbd.com",
		});

		// Art-asset attribution — bottom-right, same muted tint as the
		// music credit so the two read as one paired strip of credits.
		this._makeText(app, CANVAS_W - 16, CANVAS_H - 16, {
			size: 11,
			fillStyle: "#bbbbbb",
			textAlign: "right",
			textBaseline: "bottom",
			text: "3D assets by Kenney: https://kenney.nl/assets/space-kit",
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

		this.deathFlash = new DeathFlash();
		app.world.addChild(this.deathFlash, FLASH_Z);
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

	/**
	 * Refresh the score readout. Zero-padded to 6 digits. Also bumps
	 * the HiScore display + persists it to localStorage whenever the
	 * running score crosses the previous best — gives the player a
	 * visible target to beat without waiting until game-over.
	 */
	setScore(score: number): void {
		this.scoreText.setText(`SCORE  ${score.toString().padStart(6, "0")}`);
		if (score > this.hiScore) {
			this.hiScore = score;
			this.hiScoreText.setText(
				`HI  ${this.hiScore.toString().padStart(6, "0")}`,
			);
			// Assigning through `save` triggers the engine's
			// localStorage write — no manual try/catch needed.
			save[HISCORE_KEY] = score;
		}
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
		this.deathFlash.hide();
	}

	/** Trigger the red full-screen death flash. Self-fading. */
	flashDeath(): void {
		this.deathFlash.trigger();
	}

	/**
	 * Refresh the lives readout. Rendered as N upward triangles —
	 * compact, matches the arcade-cabinet feel, and a single triangle
	 * = "one life left" reads instantly.
	 */
	setLives(lives: number): void {
		const n = Math.max(0, lives);
		this.livesText.setText(n === 0 ? "—" : "▲ ".repeat(n).trim());
	}
}
