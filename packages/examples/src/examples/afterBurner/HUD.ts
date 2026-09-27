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
	FlashEffect,
	type Gradient,
	save,
	Text,
} from "melonjs";

// World-Z = camera position, so the squared distance to camera is the
// smallest possible — the world's depth-sort then draws the HUD last,
// on top of every other renderable.
const HUD_Z = -150;
// Initial overlay alpha at the moment of death — strong enough to "white
// out" the cockpit (red, in this case), faint enough that the player can
// still see the explosion underneath.
const DEATH_FLASH_ALPHA = 0.55;
// Linear fade — matches the death rumble's ~1.1 s tail so the flash and
// audio decay together.
const DEATH_FLASH_FADE_MS = 1100;

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
	/**
	 * The death wash, as the engine's own {@link FlashEffect} on the camera.
	 *
	 * This used to be a floating `Renderable` with a manual `fillRect`,
	 * written around `ColorLayer` clearing the framebuffer rather than
	 * tinting it. A camera post-effect is the thing that was actually wanted:
	 * it shades the frame that has already been composited, so the explosion
	 * and the HUD wash together instead of one being painted over the other,
	 * and the engine ships it.
	 *
	 * Held rather than added and removed, because `removePostEffect` destroys
	 * the effect it removes; the intensity is what gets driven.
	 */
	private deathFlash: FlashEffect;
	/** remaining fade, counted down by {@link HUD#update} */
	private flashRemainingMs = 0;
	private hiScore: number;

	constructor(app: Application) {
		// Register the HiScore key with a default of 0. `save.add` is
		// idempotent — it loads the persisted value on second-and-later
		// game opens, so this also doubles as the "load on boot" step.
		save.add({ [HISCORE_KEY]: 0 });
		this.hiScore = (save[HISCORE_KEY] as number) ?? 0;

		// Read the canvas dimensions from the live viewport so the
		// overlay positions track whatever size the example was
		// configured with (1024×576 today vs the original 1024×768)
		// instead of hard-coding numbers that silently drift when the
		// game's aspect ratio is retuned.
		const w = app.viewport.width;
		const h = app.viewport.height;

		// The arcade readout, as a vertical ramp rather than a flat colour.
		// `Text.fillStyle` takes a `Gradient` as well as a colour: the
		// coordinates are the label's OWN bake, not the screen, so a ramp from
		// y=0 to the cap height runs down each glyph whatever the label's
		// position on screen. The stroke is a separate pass, so the dark
		// outline underneath is untouched and the ramp reads as gold leaf
		// rather than as a fade to nothing.
		this.scoreText = this._makeText(app, 16, 24, {
			size: 32,
			fillStyle: this._goldRamp(app, 32),
			textAlign: "left",
			textBaseline: "top",
			bold: true,
			text: "SCORE  000000",
		});

		this.hiScoreText = this._makeText(app, w - 16, 24, {
			size: 32,
			fillStyle: this._goldRamp(app, 32),
			textAlign: "right",
			textBaseline: "top",
			bold: true,
			text: `HI  ${this.hiScore.toString().padStart(6, "0")}`,
		});

		// Lives readout — top-center, big enough to be glanceable but
		// smaller than the score so the eye still goes there first.
		this.livesText = this._makeText(app, w / 2, 24, {
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
		this._makeText(app, 16, h - 6, {
			size: 11,
			fillStyle: "#bbbbbb",
			textAlign: "left",
			textBaseline: "bottom",
			text: "Music by davidKBD: https://www.davidkbd.com",
		});

		// Engine attribution — bottom-center, paired with the same muted
		// tint so it reads as one connected credits strip across the bottom.
		this._makeText(app, w / 2, h - 6, {
			size: 11,
			fillStyle: "#bbbbbb",
			textAlign: "center",
			textBaseline: "bottom",
			text: "Powered by melonJS: https://melonjs.org",
		});

		// Art-asset attribution — bottom-right, same muted tint as the
		// music credit so the two read as one paired strip of credits.
		this._makeText(app, w - 16, h - 6, {
			size: 11,
			fillStyle: "#bbbbbb",
			textAlign: "right",
			textBaseline: "bottom",
			text: "3D assets by Kenney: https://kenney.nl",
		});

		this.gameOverLine = this._makeText(app, w / 2, h / 2 - 12, {
			size: 42,
			fillStyle: "#ff5566",
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: "GAME OVER",
		});
		this.gameOverLine.setOpacity(0);

		this.gameOverSub = this._makeText(app, w / 2, h / 2 + 32, {
			size: 18,
			fillStyle: "#cccccc",
			textAlign: "center",
			textBaseline: "middle",
			text: "",
		});
		this.gameOverSub.setOpacity(0);

		// [r, g, b] in 0..1, the same red the hand-rolled overlay used
		this.deathFlash = new FlashEffect(app.renderer, {
			color: [1.0, 0.19, 0.19],
			intensity: 0,
		});
		app.viewport.addPostEffect(this.deathFlash);
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
		// `font` is supplied below, so callers must not be required to repeat
		// it. Omitting it from the parameter type is also what lets TypeScript
		// infer `textAlign` / `textBaseline` as their literal unions rather
		// than widening them to `string`.
		settings: Omit<ConstructorParameters<typeof Text>[2], "font"> & {
			font?: string;
		},
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
	 * A hot-to-cool gold ramp the height of one line of text.
	 *
	 * Two labels each get their own: a `Gradient` is baked into the label
	 * that owns it, so sharing one instance across two `Text` renderables
	 * would couple their bakes. They are cheap enough that separate ones
	 * are the simpler answer.
	 * @param app - for the renderer that mints the gradient
	 * @param lineHeight - the label's font size, which the ramp spans
	 * @returns the gradient to hand to `fillStyle`
	 */
	private _goldRamp(app: Application, lineHeight: number): Gradient {
		const ramp = app.renderer.createLinearGradient(0, 0, 0, lineHeight);
		// pale at the top where a cabinet's glass would catch the light,
		// deepening through gold to a warm amber at the baseline
		ramp.addColorStop(0, "#fffbe6");
		ramp.addColorStop(0.45, "#ffe066");
		ramp.addColorStop(1, "#ff9a2e");
		return ramp;
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
		this.flashRemainingMs = 0;
		this.deathFlash.setUniform("uFlashIntensity", 0);
	}

	/** Trigger the red full-screen death flash. Faded by {@link HUD#update}. */
	flashDeath(): void {
		this.flashRemainingMs = DEATH_FLASH_FADE_MS;
		this.deathFlash.setUniform("uFlashIntensity", DEATH_FLASH_ALPHA);
	}

	/**
	 * Fade the death wash out.
	 *
	 * Driven from the game's own tick rather than from a renderable's
	 * `update`, since the effect is no longer a renderable: it lives on the
	 * camera, which has nothing to tick it.
	 * @param dt - frame time in milliseconds
	 */
	update(dt: number): void {
		if (this.flashRemainingMs <= 0) {
			return;
		}
		this.flashRemainingMs -= dt;
		const k = Math.max(0, this.flashRemainingMs / DEATH_FLASH_FADE_MS);
		this.deathFlash.setUniform("uFlashIntensity", k * DEATH_FLASH_ALPHA);
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
