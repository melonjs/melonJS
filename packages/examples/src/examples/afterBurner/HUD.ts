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
	Tween,
} from "melonjs";

// World-Z = camera position, so the squared distance to camera is the
// smallest possible — the world's depth-sort then draws the HUD last,
// on top of every other renderable.
const HUD_Z = -150;
// Initial overlay alpha at the moment of death — strong enough to "white
// out" the cockpit (red, in this case), faint enough that the player can
// still see the explosion underneath.
/** how much of the viewport width GAME OVER spans */
const GAME_OVER_WIDTH_RATIO = 0.82;
/**
 * The outline, which is what makes it readable.
 *
 * The death flash washes the whole screen red, and the word is red: without a
 * dark edge the two have almost no contrast at the one moment the player is
 * meant to read it.
 *
 * Scaled with the font rather than pinned at 1. The usual advice is to keep a
 * stroke at 1 and raise the size instead, because `Text` strokes ON TOP of the
 * fill and half the line lands inside the glyph, which fills in a small face.
 * At a couple of hundred pixels there is glyph to spare and a hairline would
 * simply vanish.
 */
const GAME_OVER_STROKE_RATIO = 0.03;
const GAME_OVER_STROKE = "#2a0006";
/** the drop, matching Earth Defender's: falls from this and springs onto 1 */
const GAME_OVER_STAMP_FROM = 5;
const GAME_OVER_STAMP_MS = 420;
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
	/** the death wash fading out, stopped if a restart cuts it short */
	private flashTween: Tween | undefined;
	/** what the fade drives, read straight into the effect's uniform */
	private readonly flashDriver = { k: 0 };
	/** the GAME OVER drop in flight */
	private stampTween: Tween | undefined;
	/** the live scale of the GAME OVER line, 1 at rest */
	private readonly stampDriver = { scale: 1 };
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

		// Sized to the viewport rather than to a fixed 42px, so GAME OVER reads
		// as the ending on any canvas instead of as another label.
		//
		// `Text` bakes to a canvas at its FONT SIZE, so the size has to be
		// found rather than faked with a transform: a small bake scaled up is
		// blurry, and it would be blurry at rest. Measure a throwaway at a
		// known size, then build the real one at the size that lands on the
		// target width.
		const TRIAL_SIZE = 42;
		const trial = this._makeText(app, 0, 0, {
			size: TRIAL_SIZE,
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: "GAME OVER",
		});
		const trialWidth = trial.getBounds().width;
		app.world.removeChild(trial);
		const overSize =
			trialWidth > 0
				? Math.round(TRIAL_SIZE * ((w * GAME_OVER_WIDTH_RATIO) / trialWidth))
				: TRIAL_SIZE;

		this.gameOverLine = this._makeText(app, w / 2, h / 2 - overSize * 0.3, {
			size: overSize,
			fillStyle: "#ff5566",
			strokeStyle: GAME_OVER_STROKE,
			lineWidth: Math.max(2, Math.round(overSize * GAME_OVER_STROKE_RATIO)),
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: "GAME OVER",
		});
		this.gameOverLine.setOpacity(0);

		this.gameOverSub = this._makeText(app, w / 2, h / 2 + overSize * 0.55, {
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

	/**
	 * Drop GAME OVER onto the screen, the way Earth Defender stamps it.
	 *
	 * `Back.Out` is what makes it a stamp: on a scale coming DOWN to 1 that
	 * easing overshoots past the target and springs back, so the word lands
	 * rather than arrives. No shake here, because the death that got us this
	 * far already fired a hard one of its own.
	 */
	private stampGameOver(): void {
		this.stampTween?.stop();
		this.stampDriver.scale = GAME_OVER_STAMP_FROM;
		const tween = new Tween(this.stampDriver);
		tween.updateWhenPaused = true;
		this.stampTween = tween
			.to({ scale: 1 }, { duration: GAME_OVER_STAMP_MS })
			.easing(Tween.Easing.Back.Out)
			.onUpdate(() => {
				// `scale` MULTIPLIES into the transform, so it is reset first
				this.gameOverLine.currentTransform.identity();
				this.gameOverLine.scale(this.stampDriver.scale);
			})
			.onComplete(() => {
				this.stampTween = undefined;
			})
			.start();
	}

	/** Reveal the GAME OVER overlay with the final score + restart hint. */
	showGameOver(score: number): void {
		this.gameOverLine.setOpacity(1);
		this.gameOverSub.setOpacity(1);
		this.gameOverSub.setText(`SCORE ${score} — press R to restart`);
		this.stampGameOver();
	}

	/** Hide the GAME OVER overlay on restart. */
	hideGameOver(): void {
		this.gameOverLine.setOpacity(0);
		this.gameOverSub.setOpacity(0);
		this.stampTween?.stop();
		this.stampTween = undefined;
		this.stampDriver.scale = 1;
		this.gameOverLine.currentTransform.identity();
		this.flashTween?.stop();
		this.flashTween = undefined;
		this.flashDriver.k = 0;
		this.deathFlash.setUniform("uFlashIntensity", 0);
	}

	/**
	 * Trigger the red full-screen death flash, which then fades on its own.
	 *
	 * A `Tween` rather than a countdown the game has to tick. This effect
	 * lives on the camera rather than on a renderable, so nothing updates it
	 * for free, and the fade used to need a whole `HUD#update(dt)` and a call
	 * site in the game loop purely to drive it. A tween updates itself, so
	 * both are gone.
	 */
	flashDeath(): void {
		this.flashTween?.stop();
		this.flashDriver.k = 1;
		this.deathFlash.setUniform("uFlashIntensity", DEATH_FLASH_ALPHA);
		const tween = new Tween(this.flashDriver);
		// the wash has to finish even though the run is over
		tween.updateWhenPaused = true;
		this.flashTween = tween
			.to({ k: 0 }, { duration: DEATH_FLASH_FADE_MS })
			.easing(Tween.Easing.Quadratic.Out)
			.onUpdate(() => {
				this.deathFlash.setUniform(
					"uFlashIntensity",
					this.flashDriver.k * DEATH_FLASH_ALPHA,
				);
			})
			.onComplete(() => {
				this.flashTween = undefined;
			})
			.start();
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
