import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	CanvasRenderer,
	Color,
	Matrix2d,
	Matrix3d,
	Rect,
	Sprite,
	video,
} from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";

/**
 * With `subPixel: false` (the default) every renderer snaps positions to a
 * whole pixel. It used to truncate (`|0`), which turned floating point error
 * into a visible shake: a body resting on the floor in the built-in physics
 * alternates between y = 224 and 223.99999999999997 after each collision
 * push-out, and truncation drew those a whole pixel apart. The snap now
 * rounds to the nearest pixel.
 *
 * Every check runs on Canvas, WebGL and WebGPU through the same harness, and
 * the parity block compares them directly: the three must put an image on
 * the same pixel for the same calls, under scales and flips too.
 */

// a hair short of 224, as the built-in solver leaves a resting body
const NEAR_224 = 223.99999999999997;

// [input, snapped]: float error on either side of a whole pixel, the half
// pixel (rounds up), and negative values, which snap the same way as
// positive ones once moved by a whole number of pixels
const CASES = [
	[NEAR_224, 224],
	[224.00000000000003, 224],
	[224.4, 224],
	[224.5, 225],
	[224.6, 225],
	[-3.2, -3],
	[-3.5, -3],
	[-3.7, -4],
];

const IMAGE = { width: 16, height: 16 };

/**
 * A WebGL or WebGPU renderer reduced to what the transform and drawImage
 * paths read: the settings, the current transform and the batcher. They run
 * on the real prototypes, without a GPU.
 * @param {Function} Renderer - WebGLRenderer or WebGPURenderer
 * @param {boolean} subPixel - the setting
 * @returns {object} the harness
 */
const gpuHarness = (Renderer, subPixel) => {
	const quads = [];
	const r = {
		settings: { subPixel },
		currentTransform: new Matrix3d(),
		batchers: new Map(),
		customShader: undefined,
		activeLightCount: 0,
		currentNormalMap: null,
		frameId: 1,
		setBatcher() {
			this.currentBatcher = {
				addQuad(texture, dx, dy) {
					quads.push([dx, dy]);
				},
			};
			return this.currentBatcher;
		},
		cache: {
			get() {
				return {
					_quadUVs() {
						return [0, 0, 1, 1];
					},
				};
			},
		},
		currentTint: new Color(255, 255, 255, 1),
		getGlobalAlpha() {
			return 1;
		},
	};
	const P = Renderer.prototype;
	return {
		translate: (x, y) => {
			return P.translate.call(r, x, y);
		},
		scale: (x, y) => {
			return P.scale.call(r, x, y);
		},
		transform: (...args) => {
			return P.transform.call(r, ...args);
		},
		/** @returns {number[]} the translation of the current transform */
		origin: () => {
			const m = r.currentTransform.val;
			return [m[12], m[13]];
		},
		/** @returns {number[]} where the top left of an image drawn at x, y lands */
		draw: (x, y) => {
			P.drawImage.call(r, IMAGE, x, y);
			const [dx, dy] = quads.pop();
			const m = r.currentTransform.val;
			return [m[0] * dx + m[4] * dy + m[12], m[1] * dx + m[5] * dy + m[13]];
		},
	};
};

/**
 * The same harness on a real CanvasRenderer, from an identity transform.
 * @param {CanvasRenderer} renderer - the renderer
 * @param {boolean} subPixel - the setting
 * @returns {object} the harness
 */
const canvasHarness = (renderer, subPixel) => {
	const context = renderer.getContext();
	renderer.settings.subPixel = subPixel;
	context.setTransform(1, 0, 0, 1, 0, 0);
	return {
		translate: (x, y) => {
			return renderer.translate(x, y);
		},
		scale: (x, y) => {
			return renderer.scale(x, y);
		},
		transform: (...args) => {
			return renderer.transform(...args);
		},
		origin: () => {
			const m = context.getTransform();
			return [m.e, m.f];
		},
		draw: (x, y) => {
			let out;
			const original = context.drawImage;
			context.drawImage = (...args) => {
				const m = context.getTransform();
				out = [
					m.a * args[5] + m.c * args[6] + m.e,
					m.b * args[5] + m.d * args[6] + m.f,
				];
			};
			try {
				renderer.drawImage(IMAGE, x, y);
			} finally {
				context.drawImage = original;
			}
			return out;
		},
	};
};

describe("subPixel: false snaps to the nearest pixel", () => {
	let app;
	let canvasRenderer;
	let image;

	beforeAll(async () => {
		boot();
		app = new Application(400, 400, {
			parent: "screen",
			renderer: video.CANVAS,
			subPixel: false,
		});
		await app.init();
		canvasRenderer = app.renderer;
		expect(canvasRenderer).toBeInstanceOf(CanvasRenderer);
		image = document.createElement("canvas");
		image.width = image.height = 16;
	});

	afterAll(() => {
		app?.destroy();
	});

	/**
	 * run `fn` on a fresh harness of each backend
	 * @param {Function} fn - (harness) => result
	 * @param {boolean} [subPixel=false] - the setting
	 * @returns {object} result per backend name
	 */
	const onEachBackend = (fn, subPixel = false) => {
		const out = {};
		for (const name of ["Canvas", "WebGL", "WebGPU"]) {
			canvasRenderer.save();
			try {
				out[name] = fn(
					name === "Canvas"
						? canvasHarness(canvasRenderer, subPixel)
						: gpuHarness(
								name === "WebGL" ? WebGLRenderer : WebGPURenderer,
								subPixel,
							),
				);
			} finally {
				canvasRenderer.settings.subPixel = false;
				canvasRenderer.restore();
			}
		}
		return out;
	};

	it("starts from a value that truncation would draw a pixel too high", () => {
		expect(NEAR_224).not.toBe(224);
		expect(NEAR_224 | 0).toBe(223);
	});

	describe.for(["Canvas", "WebGL", "WebGPU"])("%s", (name) => {
		/**
		 * @param {Function} fn - (harness) => result
		 * @param {boolean} [subPixel=false] - the setting
		 * @returns {*} the result on this backend
		 */
		const on = (fn, subPixel = false) => {
			return onEachBackend(fn, subPixel)[name];
		};

		it("translate() rounds the position", () => {
			for (const [value, snapped] of CASES) {
				const origin = on((h) => {
					h.translate(value, value);
					return h.origin();
				});
				expect(origin, `${value}`).toEqual([snapped, snapped]);
			}
		});

		it("transform() rounds the position, given components or a matrix", () => {
			for (const [value, snapped] of CASES) {
				const fromComponents = on((h) => {
					h.transform(1, 0, 0, 1, value, value);
					return h.origin();
				});
				const from2d = on((h) => {
					h.transform(new Matrix2d().translate(value, value));
					return h.origin();
				});
				const from3d = on((h) => {
					h.transform(new Matrix3d().translate(value, value));
					return h.origin();
				});
				expect(fromComponents, `components ${value}`).toEqual([
					snapped,
					snapped,
				]);
				expect(from2d, `Matrix2d ${value}`).toEqual([snapped, snapped]);
				expect(from3d, `Matrix3d ${value}`).toEqual([snapped, snapped]);
			}
		});

		it("drawImage() rounds the destination", () => {
			for (const [value, snapped] of CASES) {
				const at = on((h) => {
					return h.draw(value, value);
				});
				expect(at, `${value}`).toEqual([snapped, snapped]);
			}
		});

		it("draws a flipped image on the pixels it covers unflipped", () => {
			// Renderable#preDraw flips about the center: translate to it,
			// mirror, translate back. A 15px wide image has its center on a
			// half pixel, and the two translations must cancel rather than
			// round the same half the same way and move the image by a pixel
			for (const x of [20, 0, -10, 224]) {
				const [left] = on((h) => {
					return h.draw(x, 0);
				});
				const [right] = on((h) => {
					const center = x + 7.5;
					h.translate(center, 0);
					h.scale(-1, 1);
					h.translate(-center, 0);
					// mirrored, the image's left edge lands on its right edge
					return h.draw(x, 0);
				});
				expect(right - 15, `${x}`).toBe(left);
			}
		});

		it("keeps the fraction when subPixel is true", () => {
			// 10.25 rather than NEAR_224: the WebGL and WebGPU matrices are
			// Float32Arrays, which store NEAR_224 as 224 whatever the setting
			const origin = on((h) => {
				h.translate(10.25, 10.25);
				return h.origin();
			}, true);
			expect(origin).toEqual([10.25, 10.25]);
			const at = on((h) => {
				return h.draw(10.25, 10.25);
			}, true);
			expect(at).toEqual([10.25, 10.25]);
		});
	});

	it("leaves the matrix given to transform() untouched", () => {
		for (const Renderer of [WebGLRenderer, WebGPURenderer]) {
			const m3 = new Matrix3d().translate(NEAR_224, 10.5);
			const m2 = new Matrix2d().translate(NEAR_224, 10.5);
			const h = gpuHarness(Renderer, false);
			h.transform(m3);
			h.transform(m2);
			expect(m3.val[13]).toBe(10.5);
			expect(m2.val[7]).toBe(10.5);
		}
	});

	describe("parity between Canvas, WebGL and WebGPU", () => {
		const VALUES = [
			NEAR_224,
			224.00000000000003,
			10.3,
			10.5,
			10.6,
			1.25,
			0.5,
			-2.5,
			-3.7,
			-10,
		];

		// each sequence ends with a draw, and returns where the image lands
		const SEQUENCES = {
			drawImage: (h, v) => {
				return h.draw(v, v);
			},
			translate: (h, v) => {
				h.translate(v, v);
				return h.draw(0, 0);
			},
			"translate twice": (h, v) => {
				h.translate(v, v);
				h.translate(v, -v);
				return h.draw(v, v);
			},
			"camera, then sprite": (h, v) => {
				// a container translating by the camera, then the sprite
				h.translate(-v * 3, -v * 7);
				return h.draw(v, NEAR_224);
			},
			transform: (h, v) => {
				h.transform(1, 0, 0, 1, v, v);
				return h.draw(v, v);
			},
			"transform a matrix": (h, v) => {
				h.transform(new Matrix3d().translate(v, -v));
				return h.draw(v, v);
			},
			"scale, then translate": (h, v) => {
				h.scale(2, 2);
				h.translate(v, v);
				return h.draw(v, v);
			},
			"translate, then scale": (h, v) => {
				h.translate(v, v);
				h.scale(2, 2);
				return h.draw(v, v);
			},
			"scaled transform": (h, v) => {
				h.transform(2, 0, 0, 2, v, v);
				return h.draw(v, v);
			},
			"flip about a half pixel": (h, v) => {
				h.translate(v, v);
				h.translate(7.5, 4.5);
				h.scale(-1, -1);
				h.translate(-7.5, -4.5);
				return h.draw(0, 0);
			},
			"flip, then translate": (h, v) => {
				h.scale(-1, 1);
				h.translate(v, v);
				return h.draw(v, 0);
			},
		};

		for (const [name, sequence] of Object.entries(SEQUENCES)) {
			it(`draws on the same pixel: ${name}`, () => {
				for (const v of VALUES) {
					const at = onEachBackend((h) => {
						return sequence(h, v);
					});
					// whole pixels...
					for (const [backend, [x, y]] of Object.entries(at)) {
						expect(Number.isInteger(x), `${backend} x ${v}`).toBe(true);
						expect(Number.isInteger(y), `${backend} y ${v}`).toBe(true);
					}
					// ...and the same ones (`+ 0` folds -0 into 0)
					const canvas = at.Canvas.map((n) => {
						return n + 0;
					});
					expect(
						at.WebGL.map((n) => {
							return n + 0;
						}),
						`WebGL ${v}`,
					).toEqual(canvas);
					expect(
						at.WebGPU.map((n) => {
							return n + 0;
						}),
						`WebGPU ${v}`,
					).toEqual(canvas);
				}
			});
		}
	});

	describe("a body at rest on the floor", () => {
		let positions;

		beforeAll(() => {
			// the alex4 player: a 192x96 sprite with its body low in the
			// frame, on a floor whose top edge is at 320, so it rests at
			// y = 224. The built-in solver leaves it at 224 one step and
			// 223.99999999999997 the next.
			const floor = new Sprite(0, 320, { image, width: 400, height: 32 });
			floor.anchorPoint.set(0, 0);
			floor.isKinematic = false;
			floor.bodyDef = { type: "static", shapes: [new Rect(0, 0, 400, 32)] };
			app.world.addChild(floor);

			const alex = new Sprite(100, 0, { image, width: 192, height: 96 });
			alex.anchorPoint.set(0, 0);
			alex.isKinematic = false;
			alex.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(76, 36, 40, 60)],
			};
			app.world.addChild(alex);

			positions = [];
			const context = canvasRenderer.getContext();
			const original = context.drawImage;
			const rows = [];
			context.drawImage = (...args) => {
				// where the image's top edge lands on the canvas
				rows.push(context.getTransform().f + args[6]);
			};
			try {
				for (let i = 0; i < 300; i++) {
					app.world.update(16);
					if (i < 200) {
						continue; // falling, then settling
					}
					positions.push(alex.pos.y);
					// the full sprite draw path, on the Canvas renderer
					canvasRenderer.save();
					context.setTransform(1, 0, 0, 1, 0, 0);
					alex.preDraw(canvasRenderer);
					alex.draw(canvasRenderer);
					alex.postDraw(canvasRenderer);
					canvasRenderer.restore();
				}
			} finally {
				context.drawImage = original;
				app.world.removeChildNow(alex);
				app.world.removeChildNow(floor);
			}
			positions.canvasSpriteRows = rows;
		});

		it("still alternates in the physics", () => {
			// this is what the snap must absorb. If the solver ever comes to
			// rest exactly, this test needs a new source of float error to
			// stay meaningful
			expect([...new Set(positions)].sort()).toEqual([NEAR_224, 224]);
		});

		it("is drawn by a Sprite on one pixel row (Canvas)", () => {
			expect([...new Set(positions.canvasSpriteRows)]).toEqual([224]);
		});

		it("is drawn on the same single row by every backend", () => {
			// a camera at a fractional position, as a smoothed follow leaves
			// it, then the sprite at the body's position
			const rows = onEachBackend((h) => {
				const seen = new Set();
				for (const y of positions) {
					h.translate(-0.4, -10.4);
					seen.add(h.draw(100, y)[1]);
					h.translate(0.4, 10.4);
				}
				return [...seen];
			});
			expect(rows.Canvas).toEqual([214]);
			expect(rows.WebGL).toEqual([214]);
			expect(rows.WebGPU).toEqual([214]);
		});
	});
});
