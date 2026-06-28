/**
 * melonJS — Text rendering showcase.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A small "game dialogue" scene rather than a test grid. It mixes:
 *  - pixel bitmap fonts (frostyfreeze "minogram" + "thick", converted from
 *    BMFont XML to the .fnt text format melonJS parses),
 *  - a loaded web font (kenvector_future, via the `fontface` loader),
 *  - and a generic system font (Arial),
 * and uses a NineSliceSprite as an RPG-style dialogue box driving a bitmap-font
 * typewriter effect.
 *
 * The scene is authored at 2× (1280×960) so it renders close to native pixels
 * on a HiDPI display, and uses nearest-neighbour sampling (antiAlias:false) so
 * the pixel fonts stay crisp. Pixel fonts are scaled by integer ratios only.
 */
import {
	type Application,
	BitmapText,
	ColorLayer,
	Container,
	NineSliceSprite,
	Renderable,
	type Renderer,
	Stage,
	Text,
	Tween,
} from "melonjs";

const ACCENT = "#ff6b5e";
const INK = "#ecedf5";
const MUTED = "#9aa0b8";
const PANEL_TINT = "#2a3556"; // dark-slate tint applied to the dialogue panel
const HEADER_H = 196;

/**
 * Static scenery drawn behind the text: a header band, an accent divider, and
 * the reference rule the baseline row aligns to.
 */
class Scenery extends Renderable {
	private baselineY: number;

	constructor(w: number, h: number, baselineY: number) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.baselineY = baselineY;
	}

	override draw(renderer: Renderer) {
		renderer.setColor("#1b1e2b");
		renderer.fillRect(0, 0, this.width, HEADER_H);
		renderer.setColor(ACCENT);
		renderer.fillRect(0, HEADER_H, this.width, 4);
		// reference rule for the baseline demo row
		renderer.setColor("#39405f");
		renderer.fillRect(48, this.baselineY, this.width - 96, 2);
	}
}

/**
 * A blinking "continue" chevron for the dialogue box (drawn, not a glyph).
 */
class ContinueArrow extends Renderable {
	private elapsed = 0;
	private ax: number;
	private ay: number;

	constructor(w: number, h: number, ax: number, ay: number) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.ax = ax;
		this.ay = ay;
	}

	override update(dt: number) {
		this.elapsed += dt;
		this.isDirty = true;
		return true;
	}

	override draw(renderer: Renderer) {
		// blink ~ once per second
		if (Math.floor(this.elapsed / 480) % 2 !== 0) {
			return;
		}
		renderer.setColor(ACCENT);
		renderer.lineWidth = 5;
		renderer.strokeLine(this.ax, this.ay, this.ax + 12, this.ay + 12);
		renderer.strokeLine(this.ax + 12, this.ay + 12, this.ax + 24, this.ay);
		renderer.lineWidth = 1;
	}
}

/**
 * RPG-style "wavy text": a bitmap-font string whose glyphs bob on a sine wave.
 * Each character is its own BitmapText (BitmapText draws a string in one batch,
 * with no per-glyph hook) so it can be offset independently every frame.
 */
class WavyText extends Container {
	private glyphs: BitmapText[] = [];
	private elapsed = 0;
	private amplitude: number;
	private speed: number;
	private phaseStep: number;

	constructor(
		x: number,
		y: number,
		text: string,
		settings: ConstructorParameters<typeof BitmapText>[2],
		amplitude = 10,
		speed = 0.009,
		phaseStep = 0.7,
	) {
		super(x, y);
		this.amplitude = amplitude;
		this.speed = speed;
		this.phaseStep = phaseStep;
		this.alwaysUpdate = true;

		// lay glyphs out left-to-right by measured advance
		const measurer = new BitmapText(0, 0, settings);
		let cx = 0;
		for (const ch of text) {
			const glyph = new BitmapText(cx, 0, { ...settings, text: ch });
			this.glyphs.push(glyph);
			this.addChild(glyph);
			measurer.setText(ch === " " ? "M" : ch); // spaces measure to 0 otherwise
			cx += measurer.measureText().width;
		}

		// Fixed, non-empty bounds so the camera never culls the group. Deriving
		// bounds from the (continuously moving) child glyphs is what let MELONA
		// occasionally vanish; a stable box covering the text + wave is robust.
		this.width = cx;
		this.height = (Number(settings.size) || 1) * 16 + this.amplitude * 2;
	}

	override update(dt: number) {
		this.elapsed += dt;
		this.glyphs.forEach((glyph, i) => {
			glyph.pos.y =
				Math.sin(this.elapsed * this.speed + i * this.phaseStep) *
				this.amplitude;
		});
		return super.update(dt);
	}
}

/**
 * A styled run within an inline sentence. Leading spaces provide the spacing
 * between words (measureText trims trailing whitespace, not leading).
 */
type StyledRun = {
	text: string;
	fillStyle?: string;
	strokeStyle?: string;
	lineWidth?: number;
	opacity?: number;
	mutate?: (segment: Text) => void;
};

/**
 * Render a one-line sentence whose runs each carry their own style, so a keyword
 * can be drawn in the very style it names (fill / stroke / opacity / bold /
 * italic). Each run is its own Text, laid out left-to-right by measured width.
 */
const renderStyledSentence = (
	app: Application,
	x: number,
	y: number,
	size: number,
	runs: StyledRun[],
) => {
	let rx = x;
	for (const run of runs) {
		const segment = new Text(rx, y, {
			font: "Arial",
			size,
			fillStyle: run.fillStyle ?? MUTED,
			strokeStyle: run.strokeStyle,
			lineWidth: run.lineWidth ?? 0,
			textAlign: "left",
			textBaseline: "top",
			text: run.text,
		});
		if (run.mutate) {
			run.mutate(segment);
		}
		if (run.opacity !== undefined) {
			segment.setOpacity(run.opacity);
		}
		app.world.addChild(segment, 3);
		rx += segment.measureText().width;
	}
};

/**
 * Text rendering showcase Stage.
 */
export class TextScreen extends Stage {
	private elapsed = 0;
	private scoreText!: BitmapText;
	private timeText!: BitmapText;
	private tintText!: BitmapText;

	override onResetEvent(app: Application) {
		const w = app.viewport.width;
		const h = app.viewport.height;
		const BASELINE_Y = 510;

		app.world.addChild(new ColorLayer("background", "#12141d"), 0);
		app.world.addChild(new Scenery(w, h, BASELINE_Y), 1);

		// ---- HUD (pixel bitmap font, updated live in update()) ----
		// y=52 keeps it clear of the examples-gallery top toolbar that overlays
		// the very top of the canvas
		this.scoreText = new BitmapText(28, 52, {
			font: "minogram",
			size: 2,
			fillStyle: INK,
			textAlign: "left",
			textBaseline: "top",
			text: "SCORE 013370",
		});
		app.world.addChild(this.scoreText, 3);
		this.timeText = new BitmapText(w - 28, 52, {
			font: "minogram",
			size: 2,
			fillStyle: MUTED,
			textAlign: "right",
			textBaseline: "top",
			text: "TIME 0:00",
		});
		app.world.addChild(this.timeText, 3);

		// ---- Title (chunky pixel font) with a soft drop shadow ----
		const titleOpts = {
			font: "thick",
			size: 6,
			textAlign: "center" as const,
			textBaseline: "top" as const,
			text: "TEXT RENDERING",
		};
		const titleShadow = new BitmapText(w / 2 + 5, 61, titleOpts);
		titleShadow.setOpacity(0.3);
		app.world.addChild(titleShadow, 2);
		app.world.addChild(new BitmapText(w / 2, 56, titleOpts), 3);

		// ---- Subtitle (loaded web font) ----
		app.world.addChild(
			new Text(w / 2, 150, {
				font: "kenpixel",
				size: 22,
				fillStyle: MUTED,
				textAlign: "center",
				textBaseline: "top",
				text: "bitmap   ·   web font   ·   system font",
			}),
			3,
		);

		// ---- Specimen: system & web fonts (left column) ----
		app.world.addChild(
			new BitmapText(48, 232, {
				font: "minogram",
				size: 2,
				fillStyle: ACCENT,
				textAlign: "left",
				textBaseline: "top",
				text: "SYSTEM & WEB FONTS",
			}),
			3,
		);
		app.world.addChild(
			new Text(48, 274, {
				font: "kenpixel",
				size: 44,
				fillStyle: INK,
				textAlign: "left",
				textBaseline: "top",
				text: "Crisp at any size",
			}),
			3,
		);
		// description sentence — each keyword is rendered in the style it names
		renderStyledSentence(app, 48, 346, 24, [
			{ text: "Smooth system text, styleable with" },
			{ text: " fill", fillStyle: ACCENT },
			{ text: "," },
			{
				text: " stroke",
				fillStyle: ACCENT,
				strokeStyle: INK,
				lineWidth: 1.5,
			},
			{ text: "," },
			{ text: " opacity", fillStyle: INK, opacity: 0.45 },
			{ text: "," },
			{
				text: " bold",
				fillStyle: INK,
				mutate: (segment) => {
					segment.bold();
				},
			},
			{ text: " and" },
			{
				text: " italic",
				fillStyle: INK,
				mutate: (segment) => {
					segment.italic();
				},
			},
			{ text: "." },
		]);

		// ---- Specimen: bitmap fonts (right column) ----
		app.world.addChild(
			new BitmapText(w - 48, 232, {
				font: "minogram",
				size: 2,
				fillStyle: ACCENT,
				textAlign: "right",
				textBaseline: "top",
				text: "BITMAP FONTS",
			}),
			3,
		);
		app.world.addChild(
			new BitmapText(w - 48, 278, {
				font: "minogram",
				size: 4,
				fillStyle: INK,
				textAlign: "right",
				textBaseline: "top",
				text: "RETRO 0123",
			}),
			3,
		);
		// tint is animated each frame in update() to show runtime re-tinting
		this.tintText = new BitmapText(w - 48, 360, {
			font: "thick",
			size: 3,
			fillStyle: ACCENT,
			textAlign: "right",
			textBaseline: "top",
			text: "TINTABLE",
		});
		app.world.addChild(this.tintText, 3);

		// ---- Baseline demo (bitmap font, spread across the reference rule) ----
		app.world.addChild(
			new BitmapText(48, 446, {
				font: "minogram",
				size: 2,
				fillStyle: ACCENT,
				textAlign: "left",
				textBaseline: "top",
				text: "TEXT BASELINE",
			}),
			3,
		);
		const baselines = [
			"bottom",
			"ideographic",
			"alphabetic",
			"middle",
			"hanging",
			"top",
		] as const;
		const BL_SIZE = 3;
		const margin = 48;
		// measure each label, then distribute the slack as equal gaps so the row
		// spans the full reference rule edge-to-edge
		const ruler = new BitmapText(0, 0, { font: "minogram", size: BL_SIZE });
		const widths = baselines.map((bl) => {
			ruler.setText(bl);
			return ruler.measureText().width;
		});
		const totalText = widths.reduce((sum, n) => {
			return sum + n;
		}, 0);
		const gap = (w - margin * 2 - totalText) / (baselines.length - 1);
		let bx = margin;
		baselines.forEach((bl, i) => {
			app.world.addChild(
				new BitmapText(bx, BASELINE_Y, {
					font: "minogram",
					size: BL_SIZE,
					fillStyle: INK,
					textAlign: "left",
					textBaseline: bl,
					text: bl,
				}),
				3,
			);
			bx += widths[i] + gap;
		});

		// ---- Dialogue box (NineSliceSprite) ----
		const boxX = 48;
		const boxY = 640;
		const boxW = w - 96;
		const boxH = 256;
		const pad = 44;

		const box = new NineSliceSprite(boxX, boxY, {
			image: "panel",
			width: boxW,
			height: boxH,
			insetx: 36,
			insety: 36,
			// the Kenney panel is light grey; tint it dark so it reads as an RPG
			// textbox (NineSliceSprite honours the tint via Renderable.preDraw)
			tint: PANEL_TINT,
		});
		box.anchorPoint.set(0, 0);
		app.world.addChild(box, 4);

		// speaker name plate (pixel bitmap font) with an RPG-style wavy animation
		app.world.addChild(
			new WavyText(boxX + pad, boxY + 34, "MELONA", {
				font: "minogram",
				size: 4,
				fillStyle: ACCENT,
				textAlign: "left",
				textBaseline: "top",
			}),
			5,
		);

		// dialogue body (bitmap font) with word-wrap + typewriter effect
		const body = new BitmapText(boxX + pad, boxY + 110, {
			font: "minogram",
			size: 3,
			fillStyle: INK,
			textAlign: "left",
			textBaseline: "top",
			lineHeight: 1.5,
		});
		// set wrap width AFTER the scale is applied, then (re)set the text so it
		// word-wraps at the correct scaled width (matches BitmapText's wrap path)
		body.wordWrapWidth = boxW - pad * 2;
		body.setText(
			"Welcome to melonJS! This dialogue box is a NineSliceSprite, and the text reveals itself with a typewriter effect.",
		);
		body.visibleCharacters = 0;
		app.world.addChild(body, 5);

		new Tween(body)
			.to(
				{ visibleRatio: 1.0 },
				{ duration: 4200, repeat: Number.POSITIVE_INFINITY, repeatDelay: 1800 },
			)
			.start();

		// blinking continue indicator
		app.world.addChild(
			new ContinueArrow(w, h, boxX + boxW - pad - 24, boxY + boxH - pad),
			5,
		);
	}

	override update(dt: number) {
		this.elapsed += dt;
		// live-ticking HUD — bitmap text re-renders cheaply each frame
		const score = (13370 + Math.floor(this.elapsed / 40)) % 1000000;
		this.scoreText.setText(`SCORE ${String(score).padStart(6, "0")}`);
		const secs = Math.floor(this.elapsed / 1000);
		this.timeText.setText(
			`TIME ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`,
		);
		// cycle the tint hue to demonstrate runtime re-tinting of a bitmap font
		this.tintText.fillStyle.setHSLDeg((this.elapsed * 0.05) % 360, 0.7, 0.62);
		this.tintText.isDirty = true;
		return super.update(dt);
	}
}
