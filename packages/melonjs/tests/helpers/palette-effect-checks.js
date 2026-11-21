/**
 * What `GradientMapEffect` and `DitherEffect` draw, read in pixels, for any
 * renderer with shaders: the same checks run on WebGL
 * (`palette-effects.spec.js`) and on WebGPU
 * (`palette-effects-webgpu.spec.js`).
 *
 * Each check draws a 32 x 32 sprite of known colors in the middle of a
 * 64 x 64 frame, through the effect, and reads the frame back.
 */
import { expect, it } from "vitest";
import { DitherEffect, GradientMapEffect, Sprite } from "../../src/index.js";
import Renderer from "../../src/video/renderer.js";
import { grabFrame } from "./pixels.js";

export const SIZE = 64;
const ART = 32;
// the sprite covers these pixels of the frame
const FROM = (SIZE - ART) / 2;

/** a square texture of one CSS color */
function flat(css) {
	const canvas = Renderer.createCanvas(ART, ART);
	const context = canvas.getContext("2d");
	context.fillStyle = css;
	context.fillRect(0, 0, ART, ART);
	return canvas;
}

/** a gray, 0 to 1, as a CSS color */
function gray(value) {
	const v = Math.round(value * 255);
	return `rgb(${v}, ${v}, ${v})`;
}

/** a texture whose columns go from black to nearly white, left to right */
function columns() {
	const canvas = Renderer.createCanvas(ART, ART);
	const context = canvas.getContext("2d");
	for (let x = 0; x < ART; x++) {
		context.fillStyle = gray(x / ART);
		context.fillRect(x, 0, 1, ART);
	}
	return canvas;
}

/** draw `image` through `effect` over `background`, and return the frame */
async function draw(renderer, image, effect, background = "#000000") {
	const sprite = new Sprite(SIZE / 2, SIZE / 2, { image });
	sprite.addPostEffect(effect);
	renderer.backgroundColor.parseCSS(background);
	renderer.clear();
	renderer.save();
	renderer.resetTransform();
	sprite.preDraw(renderer);
	sprite.draw(renderer);
	sprite.postDraw(renderer);
	renderer.restore();
	const frame = await grabFrame(renderer);
	sprite.removePostEffect(effect);
	effect.destroy();
	return frame;
}

/** the pixel at x, y of a frame, as [r, g, b] */
function at(frame, x, y) {
	const o = (y * frame.width + x) * 4;
	return [frame.data[o], frame.data[o + 1], frame.data[o + 2]];
}

/** the middle pixel of a frame */
function middle(frame) {
	return at(frame, SIZE / 2, SIZE / 2);
}

/** every pixel the sprite covers, as [r, g, b] */
function covered(frame) {
	const pixels = [];
	for (let y = FROM; y < FROM + ART; y++) {
		for (let x = FROM; x < FROM + ART; x++) {
			pixels.push(at(frame, x, y));
		}
	}
	return pixels;
}

function expectClose(actual, expected, tolerance = 2) {
	for (let i = 0; i < 3; i++) {
		expect(
			Math.abs(actual[i] - expected[i]),
			`[${actual}] against [${expected}]`,
		).toBeLessThanOrEqual(tolerance);
	}
}

const RED = [1, 0, 0];
const GREEN = [0, 1, 0];
const BLUE = [0, 0, 1];

/**
 * @param {(ctx: object) => object} getRenderer - gives the renderer, or skips the test
 */
export function gradientMapChecks(getRenderer) {
	it("draws in grays by default, from each pixel's brightness", async (ctx) => {
		const renderer = getRenderer(ctx);
		expectClose(
			middle(
				await draw(renderer, flat(gray(0.5)), new GradientMapEffect(renderer)),
			),
			[128, 128, 128],
		);
		// pure red is 21% bright
		expectClose(
			middle(
				await draw(renderer, flat("#ff0000"), new GradientMapEffect(renderer)),
			),
			[54, 54, 54],
		);
	});

	it("gives the darkest pixels the first color and the brightest the last", async (ctx) => {
		const renderer = getRenderer(ctx);
		const duotone = () => {
			return new GradientMapEffect(renderer, { colors: [BLUE, RED] });
		};
		expectClose(
			middle(await draw(renderer, flat("#000000"), duotone())),
			[0, 0, 255],
		);
		expectClose(
			middle(await draw(renderer, flat("#ffffff"), duotone())),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.5)), duotone())),
			[128, 0, 127],
		);
	});

	it("blends through every color in between, in order", async (ctx) => {
		const renderer = getRenderer(ctx);
		const three = () => {
			return new GradientMapEffect(renderer, { colors: [RED, GREEN, BLUE] });
		};
		expectClose(
			middle(await draw(renderer, flat("#000000"), three())),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.25)), three())),
			[127, 128, 0],
			3,
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.5)), three())),
			[0, 254, 1],
			3,
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.75)), three())),
			[0, 127, 128],
			3,
		);
		expectClose(
			middle(await draw(renderer, flat("#ffffff"), three())),
			[0, 0, 255],
		);
	});

	it("takes eight colors", async (ctx) => {
		const renderer = getRenderer(ctx);
		const colors = [];
		for (let i = 0; i < 8; i++) {
			colors.push([i / 7, 0, 1 - i / 7]);
		}
		// a ramp from blue to red in eight equal steps is one straight ramp
		expectClose(
			middle(
				await draw(
					renderer,
					flat(gray(0.3)),
					new GradientMapEffect(renderer, { colors }),
				),
			),
			[77, 0, 178],
			3,
		);
		expectClose(
			middle(
				await draw(
					renderer,
					flat("#ffffff"),
					new GradientMapEffect(renderer, { colors }),
				),
			),
			[255, 0, 0],
		);
	});

	it("gives each color a band of its own when not smooth", async (ctx) => {
		const renderer = getRenderer(ctx);
		const WHITE = [1, 1, 1];
		const bands = () => {
			return new GradientMapEffect(renderer, {
				colors: [RED, GREEN, BLUE, WHITE],
				smooth: false,
			});
		};
		// four bands: below a quarter, a half, three quarters, and above
		expectClose(
			middle(await draw(renderer, flat("#000000"), bands())),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.2)), bands())),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.3)), bands())),
			[0, 255, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.45)), bands())),
			[0, 255, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.6)), bands())),
			[0, 0, 255],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.8)), bands())),
			[255, 255, 255],
		);
		expectClose(
			middle(await draw(renderer, flat("#ffffff"), bands())),
			[255, 255, 255],
		);
	});

	it("setSmooth switches between the two", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = new GradientMapEffect(renderer, { colors: [BLUE, RED] });
		effect.setSmooth(false);
		expect(effect.smooth).toBe(false);
		// two bands: the dark half blue, the bright half red
		expectClose(
			middle(await draw(renderer, flat(gray(0.4)), effect)),
			[0, 0, 255],
		);
	});

	it("recolors as far as its intensity", async (ctx) => {
		const renderer = getRenderer(ctx);
		const at = (intensity) => {
			return new GradientMapEffect(renderer, {
				colors: [BLUE, BLUE],
				intensity,
			});
		};
		expectClose(
			middle(await draw(renderer, flat("#ff0000"), at(0))),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat("#ff0000"), at(0.5))),
			[128, 0, 128],
		);
		expectClose(
			middle(await draw(renderer, flat("#ff0000"), at(1))),
			[0, 0, 255],
		);
	});

	it("draws the pixels that take a color as opaque as that color", async (ctx) => {
		const renderer = getRenderer(ctx);
		// the dark pixels take a transparent color: what is behind shows
		const knockout = () => {
			return new GradientMapEffect(renderer, {
				colors: [
					[0, 0, 0, 0],
					[1, 1, 1, 1],
				],
				smooth: false,
			});
		};
		expectClose(
			middle(await draw(renderer, flat("#000000"), knockout(), "#ff0000")),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat("#ffffff"), knockout(), "#ff0000")),
			[255, 255, 255],
		);
		// and a half-opaque color lets half of it through
		const half = new GradientMapEffect(renderer, {
			colors: [
				[0, 0, 1, 0.5],
				[0, 0, 1, 0.5],
			],
		});
		expectClose(
			middle(await draw(renderer, flat("#ffffff"), half, "#ff0000")),
			[128, 0, 128],
		);
	});

	it("keeps a translucent pixel as translucent as it was", async (ctx) => {
		const renderer = getRenderer(ctx);
		// half-opaque white over black: white at half
		expectClose(
			middle(
				await draw(
					renderer,
					flat("rgba(255, 255, 255, 0.5)"),
					new GradientMapEffect(renderer),
				),
			),
			[128, 128, 128],
			3,
		);
		// and it is mapped from its own color, not from its premultiplied one:
		// half-opaque white is bright, so it takes the last color
		expectClose(
			middle(
				await draw(
					renderer,
					flat("rgba(255, 255, 255, 0.5)"),
					new GradientMapEffect(renderer, {
						colors: [BLUE, RED],
						smooth: false,
					}),
				),
			),
			[128, 0, 0],
			3,
		);
	});
}

/**
 * @param {(ctx: object) => object} getRenderer - gives the renderer, or skips the test
 */
export function ditherChecks(getRenderer) {
	const count = (pixels, color) => {
		return pixels.filter((p) => {
			return (
				Math.abs(p[0] - color[0]) <= 2 &&
				Math.abs(p[1] - color[1]) <= 2 &&
				Math.abs(p[2] - color[2]) <= 2
			);
		}).length;
	};

	it("with no pattern, rounds each channel to its nearest level", async (ctx) => {
		const renderer = getRenderer(ctx);
		const flatBands = (levels) => {
			return new DitherEffect(renderer, { levels, strength: 0 });
		};
		expectClose(
			middle(await draw(renderer, flat(gray(0.3)), flatBands(2))),
			[0, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.7)), flatBands(2))),
			[255, 255, 255],
		);
		// each channel on its own
		expectClose(
			middle(await draw(renderer, flat("rgb(204, 51, 153)"), flatBands(2))),
			[255, 0, 255],
		);
		// four levels: 0, a third, two thirds, 1
		expectClose(
			middle(await draw(renderer, flat(gray(0.4)), flatBands(4))),
			[85, 85, 85],
		);
		expectClose(
			middle(await draw(renderer, flat(gray(0.6)), flatBands(4))),
			[170, 170, 170],
		);
	});

	it("draws a gray between two levels as a mix of the two, in proportion", async (ctx) => {
		const renderer = getRenderer(ctx);
		const twoLevels = () => {
			return new DitherEffect(renderer, { levels: 2 });
		};
		// half gray: half the pixels white, the others black, and nothing else
		let pixels = covered(await draw(renderer, flat(gray(0.5)), twoLevels()));
		expect(count(pixels, [255, 255, 255])).toBe(ART * ART * 0.5);
		expect(count(pixels, [0, 0, 0])).toBe(ART * ART * 0.5);
		// a quarter gray: a quarter of them white
		pixels = covered(await draw(renderer, flat(gray(0.25)), twoLevels()));
		expect(count(pixels, [255, 255, 255])).toBe(ART * ART * 0.25);
		expect(count(pixels, [0, 0, 0])).toBe(ART * ART * 0.75);
		// three quarters: three quarters of them
		pixels = covered(await draw(renderer, flat(gray(0.75)), twoLevels()));
		expect(count(pixels, [255, 255, 255])).toBe(ART * ART * 0.75);
	});

	it("spreads the mix evenly: every 4 x 4 block of a half gray is half white", async (ctx) => {
		const renderer = getRenderer(ctx);
		const frame = await draw(
			renderer,
			flat(gray(0.5)),
			new DitherEffect(renderer, { levels: 2 }),
		);
		for (let by = FROM; by < FROM + ART; by += 4) {
			for (let bx = FROM; bx < FROM + ART; bx += 4) {
				let white = 0;
				for (let y = by; y < by + 4; y++) {
					for (let x = bx; x < bx + 4; x++) {
						white += at(frame, x, y)[0] > 128 ? 1 : 0;
					}
				}
				expect(white, `block at ${bx}, ${by}`).toBe(8);
			}
		}
	});

	it("leaves a color that is a level as it is, with or without the pattern", async (ctx) => {
		const renderer = getRenderer(ctx);
		const pixels = covered(
			await draw(
				renderer,
				flat("#ffffff"),
				new DitherEffect(renderer, { levels: 2 }),
			),
		);
		expect(count(pixels, [255, 255, 255])).toBe(ART * ART);
	});

	it("draws pixels of several texels with size", async (ctx) => {
		const renderer = getRenderer(ctx);
		const frame = await draw(
			renderer,
			columns(),
			new DitherEffect(renderer, { levels: 256, strength: 0, size: 4 }),
		);
		// the columns of the texture differ, the pixels of one cell do not
		const y = SIZE / 2;
		for (let cell = 0; cell < ART / 4; cell++) {
			const x = FROM + cell * 4;
			const first = at(frame, x, y);
			for (let i = 1; i < 4; i++) {
				expectClose(at(frame, x + i, y), first, 0);
			}
		}
		// and one cell differs from the next
		expect(at(frame, FROM + 4, y)[0]).toBeGreaterThan(at(frame, FROM, y)[0]);
		expect(at(frame, FROM + 28, y)[0]).toBeGreaterThan(
			at(frame, FROM + 4, y)[0] + 100,
		);
	});

	it("draws in the nearest color of a palette", async (ctx) => {
		const renderer = getRenderer(ctx);
		const palette = () => {
			return new DitherEffect(renderer, {
				palette: [RED, GREEN, BLUE],
				strength: 0,
			});
		};
		expectClose(
			middle(await draw(renderer, flat("rgb(230, 50, 25)"), palette())),
			[255, 0, 0],
		);
		expectClose(
			middle(await draw(renderer, flat("rgb(50, 180, 60)"), palette())),
			[0, 255, 0],
		);
		expectClose(
			middle(await draw(renderer, flat("rgb(50, 75, 230)"), palette())),
			[0, 0, 255],
		);
	});

	it("takes sixteen colors, and reaches the last", async (ctx) => {
		const renderer = getRenderer(ctx);
		const palette = [];
		for (let i = 0; i < 16; i++) {
			palette.push([i / 15, i / 15, i / 15]);
		}
		expectClose(
			middle(
				await draw(
					renderer,
					flat("#ffffff"),
					new DitherEffect(renderer, { palette, strength: 0 }),
				),
			),
			[255, 255, 255],
		);
		// 0.4 is the palette's seventh gray, 6 / 15
		expectClose(
			middle(
				await draw(
					renderer,
					flat(gray(0.4)),
					new DitherEffect(renderer, { palette, strength: 0 }),
				),
			),
			[102, 102, 102],
		);
	});

	it("mixes the two colors of a palette a pixel lies between", async (ctx) => {
		const renderer = getRenderer(ctx);
		const pixels = covered(
			await draw(
				renderer,
				flat(gray(0.5)),
				new DitherEffect(renderer, {
					palette: [
						[0, 0, 0],
						[1, 1, 1],
					],
				}),
			),
		);
		expect(count(pixels, [255, 255, 255])).toBe(ART * ART * 0.5);
		expect(count(pixels, [0, 0, 0])).toBe(ART * ART * 0.5);
	});

	it("mixes them in proportion: a quarter of the way is a quarter of the pixels", async (ctx) => {
		const renderer = getRenderer(ctx);
		const pixels = covered(
			await draw(
				renderer,
				flat(gray(0.25)),
				new DitherEffect(renderer, {
					palette: [
						[0, 0, 0],
						[1, 1, 1],
					],
				}),
			),
		);
		expect(count(pixels, [255, 255, 255])).toBe(ART * ART * 0.25);
		expect(count(pixels, [0, 0, 0])).toBe(ART * ART * 0.75);
	});

	it("leaves a color that is in the palette flat, however close its neighbours", async (ctx) => {
		const renderer = getRenderer(ctx);
		// two close greens and two far colors: the pattern must not reach
		// from one green to the other
		const palette = [
			[0.2, 0.6, 0.2],
			[0.25, 0.65, 0.2],
			[1, 1, 1],
			[0, 0, 0],
		];
		const pixels = covered(
			await draw(
				renderer,
				flat("rgb(51, 153, 51)"),
				new DitherEffect(renderer, { palette }),
			),
		);
		expect(count(pixels, [51, 153, 51])).toBe(ART * ART);
	});

	it("draws the pixels that take a palette color as opaque as that color", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = new DitherEffect(renderer, {
			palette: [
				[1, 1, 1, 0.5],
				[0, 0, 0, 1],
			],
			strength: 0,
		});
		expectClose(
			middle(await draw(renderer, flat("#ffffff"), effect, "#ff0000")),
			[255, 128, 128],
		);
	});

	it("setPalette(null) goes back to levels", async (ctx) => {
		const renderer = getRenderer(ctx);
		const effect = new DitherEffect(renderer, {
			palette: [RED, BLUE],
			levels: 2,
			strength: 0,
		});
		effect.setPalette(null);
		// green is in neither color of the palette it had
		expectClose(
			middle(await draw(renderer, flat("#00ff00"), effect)),
			[0, 255, 0],
		);
	});

	it("keeps a translucent pixel as translucent as it was", async (ctx) => {
		const renderer = getRenderer(ctx);
		expectClose(
			middle(
				await draw(
					renderer,
					flat("rgba(255, 255, 255, 0.5)"),
					new DitherEffect(renderer, { levels: 2, strength: 0 }),
				),
			),
			[128, 128, 128],
			3,
		);
	});
}
