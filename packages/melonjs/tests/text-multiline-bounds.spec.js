import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	BitmapText,
	boot,
	Container,
	Text,
	video,
} from "../src/index.js";

/**
 * A multi-line label is placed by its `textBaseline` as ONE block.
 *
 * `Text#updateBounds` (like `BitmapText`, for its bounds and its drawing) put
 * the whole block against `pos.y`: its top for "top" / "hanging", its centre
 * for "middle", its bottom for "bottom" / "alphabetic" / "ideographic". But
 * `TextMetrics.updateOrigin`, which places the baked canvas, only ever moved
 * it by ONE line. So a two-line "bottom" label drew its first line above
 * `pos.y` and its second line below it, while its bounds said both were
 * above. `setText()` reported the drawn box and the next `updateBounds()` —
 * any move, or adding it to a container — swapped it for the block box, with
 * a whole line of ink outside it: culled too early, hit by the pointer in the
 * wrong place.
 *
 * These read back the pixels to say where the ink really lands, and check that
 * the bounds match it whatever recomputed them.
 */

const BASELINES = [
	"top",
	"hanging",
	"middle",
	"alphabetic",
	"ideographic",
	"bottom",
];
const ALIGNS = ["left", "center", "right"];
const LINES = [1, 2, 3];

// a minimal BMFont: 4x4 glyphs, 6px advance, 4px line height
const fontData = `info face="block" size=4 padding=0,0,0,0 spacing=0,0
common lineHeight=6 base=4 scaleW=4 scaleH=4 pages=1 packed=0
page id=0 file="block.png"
chars count=4
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=65 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=66 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=88 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15`;

describe("multi-line text: the bounds are where the block is drawn", () => {
	let app;
	let image;

	beforeAll(async () => {
		boot();
		app = new Application(240, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			transparent: true,
			backgroundColor: "rgba(0, 0, 0, 0)",
		});
		await app.init();
		image = document.createElement("canvas");
		image.width = image.height = 4;
		const ctx = image.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 4, 4);
	});

	afterAll(() => {
		app?.destroy();
	});

	/** snapshot a Bounds, so a later recompute cannot change it under us */
	const box = (bounds) => {
		return {
			left: bounds.left,
			top: bounds.top,
			right: bounds.right,
			bottom: bounds.bottom,
		};
	};

	/**
	 * Draw `label` alone and scan the screen for ink.
	 * @returns the ink box, and for each screen row whether it holds ink
	 */
	const drawnInk = (label) => {
		const renderer = app.renderer;
		const context = renderer.getContext();
		const { width, height } = renderer.getCanvas();
		// `renderer.clear()` paints the opaque background: wipe to nothing
		renderer.resetTransform();
		context.clearRect(0, 0, width, height);
		label.draw(renderer);
		const data = context.getImageData(0, 0, width, height).data;
		const ink = { left: width, top: height, right: -1, bottom: -1 };
		const rows = new Array(height).fill(false);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (data[(y * width + x) * 4 + 3] > 0) {
					rows[y] = true;
					ink.left = Math.min(ink.left, x);
					ink.right = Math.max(ink.right, x + 1);
					ink.top = Math.min(ink.top, y);
					ink.bottom = Math.max(ink.bottom, y + 1);
				}
			}
		}
		return { ink, rows };
	};

	/** `actual` is `expected` to within a pixel (the box sits on whole pixels) */
	const near = (actual, expected, what) => {
		expect(
			Math.abs(actual - expected),
			`${what}: ${actual} vs ${expected}`,
		).toBeLessThanOrEqual(1);
	};

	/** where the block must sit against `pos.y` for this baseline */
	const expectAnchored = (bounds, baseline, y) => {
		switch (baseline) {
			case "top":
			case "hanging":
				near(bounds.top, y, "top at pos.y");
				break;
			case "middle":
				near((bounds.top + bounds.bottom) / 2, y, "centred on pos.y");
				break;
			default:
				near(bounds.bottom, y, "bottom at pos.y");
				break;
		}
	};

	/**
	 * Everything drawn lies inside `bounds` (within a pixel: antialiasing),
	 * and every line band of it holds some ink, so no line is drawn elsewhere.
	 */
	const expectInkInside = (label, bounds, lines, lineHeight) => {
		const { ink, rows } = drawnInk(label);
		expect(ink.bottom).toBeGreaterThan(0);
		expect(ink.top).toBeGreaterThanOrEqual(bounds.top - 1);
		expect(ink.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
		expect(ink.left).toBeGreaterThanOrEqual(bounds.left - 1);
		expect(ink.right).toBeLessThanOrEqual(bounds.right + 1);
		for (let i = 0; i < lines; i++) {
			const from = Math.round(bounds.top + i * lineHeight);
			const band = rows.slice(from, from + Math.round(lineHeight));
			expect(band.includes(true), `line ${i + 1} has ink in its band`).toBe(
				true,
			);
		}
	};

	describe("Text", () => {
		const SIZE = 20;
		const make = (baseline, align, lines, extra = {}) => {
			return new Text(120, 120, {
				font: "sans-serif",
				size: SIZE,
				fillStyle: "#ffffff",
				textBaseline: baseline,
				textAlign: align,
				text: new Array(lines).fill("XX").join("\n"),
				...extra,
			});
		};

		for (const baseline of BASELINES) {
			for (const lines of LINES) {
				for (const align of ALIGNS) {
					const name = `${lines} line(s), textBaseline "${baseline}", textAlign "${align}"`;

					it(`${name}: updateBounds() agrees with the bounds setText() gave`, () => {
						const label = make(baseline, align, lines);
						const fromSetText = box(label.getBounds());
						// nothing moved: recomputing must not change them
						const recomputed = box(label.updateBounds());
						for (const side of ["top", "bottom", "left", "right"]) {
							near(recomputed[side], fromSetText[side], side);
						}
						label.destroy();
					});

					it(`${name}: the block is anchored at pos.y and drawn inside its bounds`, () => {
						const label = make(baseline, align, lines);
						const bounds = box(label.updateBounds());
						expect(bounds.bottom - bounds.top).toBeCloseTo(lines * SIZE, 0);
						expectAnchored(bounds, baseline, 120);
						expectInkInside(label, bounds, lines, SIZE);
						label.destroy();
					});
				}
			}
		}

		it("lineHeight 1.5: each spaced line is drawn inside the bounds", () => {
			for (const baseline of BASELINES) {
				const label = make(baseline, "left", 3, { lineHeight: 1.5 });
				const bounds = box(label.updateBounds());
				expect(bounds.bottom - bounds.top).toBeCloseTo(3 * SIZE * 1.5, 0);
				expectAnchored(bounds, baseline, 120);
				expectInkInside(label, bounds, 3, SIZE * 1.5);
				label.destroy();
			}
		});

		it("a label moved after setText() still draws inside its bounds", () => {
			for (const baseline of BASELINES) {
				const label = make(baseline, "center", 2);
				label.pos.set(100, 140);
				const bounds = box(label.getBounds());
				expectAnchored(bounds, baseline, 140);
				expectInkInside(label, bounds, 2, SIZE);
				label.destroy();
			}
		});

		it("setText() inside an offset container reports the same bounds updateBounds() does", () => {
			const parent = new Container(30, 40, 200, 200);
			const label = make("bottom", "left", 2);
			parent.addChild(label);
			label.setText("XX\nXX\nXX");
			const fromSetText = box(label.getBounds());
			expect(box(label.updateBounds())).toEqual(fromSetText);
			// in world space, like every other renderable's bounds
			expect(fromSetText.left).toBeCloseTo(30 + 120, 0);
			expect(fromSetText.bottom).toBeCloseTo(40 + 120, 0);
			parent.destroy();
		});

		it("a stroked, multi-line label keeps its outline inside the canvas", () => {
			// the ink padding is measured per line box, so moving the block
			// must not shear the outline off its first or last line
			for (const baseline of BASELINES) {
				const label = make(baseline, "left", 2, {
					strokeStyle: "#ff0000",
					lineWidth: 6,
				});
				const canvas = label.canvasTexture.canvas;
				const data = label.canvasTexture.context.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				).data;
				let top = -1;
				let bottom = -1;
				for (let y = 0; y < canvas.height; y++) {
					for (let x = 0; x < canvas.width; x++) {
						if (data[(y * canvas.width + x) * 4 + 3] !== 0) {
							if (top === -1) {
								top = y;
							}
							bottom = y;
							break;
						}
					}
				}
				expect(top, `"${baseline}": ink starts below row 0`).toBeGreaterThan(0);
				expect(
					bottom,
					`"${baseline}": ink ends above the last row`,
				).toBeLessThan(canvas.height - 1);
				label.destroy();
			}
		});
	});

	describe("BitmapText", () => {
		// 4px glyphs at size 2: 8px lines
		const LINE = 8;
		const make = (baseline, align, lines) => {
			return new BitmapText(120, 120, {
				font: image,
				fontData,
				size: 2,
				textBaseline: baseline,
				textAlign: align,
				text: new Array(lines).fill("XX").join("\n"),
			});
		};

		for (const baseline of BASELINES) {
			for (const lines of LINES) {
				for (const align of ALIGNS) {
					it(`${lines} line(s), textBaseline "${baseline}", textAlign "${align}": anchored at pos.y and drawn inside its bounds`, () => {
						const label = make(baseline, align, lines);
						const bounds = box(label.updateBounds());
						expect(bounds.bottom - bounds.top).toBeCloseTo(lines * LINE, 0);
						expectAnchored(bounds, baseline, 120);
						expectInkInside(label, bounds, lines, LINE);
						label.destroy();
					});
				}
			}
		}
	});

	it("Text and BitmapText place a multi-line block the same way", () => {
		for (const baseline of BASELINES) {
			const text = new Text(120, 120, {
				font: "sans-serif",
				size: 20,
				textBaseline: baseline,
				text: "XX\nXX",
			});
			const bitmap = new BitmapText(120, 120, {
				font: image,
				fontData,
				size: 5,
				textBaseline: baseline,
				text: "XX\nXX",
			});
			// both 40px tall: the same block, so the same box
			const a = box(text.updateBounds());
			const b = box(bitmap.updateBounds());
			expect(a.bottom - a.top).toBe(40);
			expect(b.bottom - b.top).toBe(40);
			expect(a.top, `"${baseline}"`).toBeCloseTo(b.top, 0);
			text.destroy();
			bitmap.destroy();
		}
	});
});
