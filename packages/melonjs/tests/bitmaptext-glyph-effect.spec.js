import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	BitmapText,
	boot,
	video,
	WebGLRenderer,
} from "../src/index.js";

const SIZE = 64;
const data = `info face="effect-test" size=4 padding=0,0,0,0 spacing=0,0
common lineHeight=6 base=4 scaleW=4 scaleH=4 pages=1 packed=0
page id=0 file="effect-test.png"
chars count=4
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=65 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=66 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
char id=67 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=15
kernings count=1
kerning first=65 second=66 amount=-1`;

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`BitmapText glyph effects (${backend === video.CANVAS ? "Canvas" : "WebGL"})`, () => {
		let app;
		let renderer;
		let image;
		const texts = [];
		beforeAll(async () => {
			boot();
			app = new Application(SIZE, SIZE, {
				parent: "screen",
				renderer: backend,
				antiAlias: false,
				failIfMajorPerformanceCaveat: false,
				transparent: true,
				backgroundColor: "rgba(0, 0, 0, 0)",
			});
			await app.init();
			renderer = app.renderer;
			if (backend === video.WEBGL) {
				expect(renderer).toBeInstanceOf(WebGLRenderer);
			}
			image = document.createElement("canvas");
			image.width = image.height = 4;
			const ctx = image.getContext("2d");
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, 4, 4);
		});
		afterEach(() => {
			vi.restoreAllMocks();
			// Direct draw probes also queue GPU quads; drain before the next scene.
			renderer.flush();
			for (const text of texts.splice(0)) {
				if (text.ancestor) {
					app.world.removeChildNow(text);
				} else {
					text.destroy();
				}
			}
			renderer.clearTint();
			renderer.setGlobalAlpha(1);
		});
		afterAll(() => {
			return app.destroy();
		});
		const makeText = (settings = {}) => {
			const text = new BitmapText(8, 8, {
				font: image,
				fontData: data,
				text: "ABC",
				...settings,
			});
			texts.push(text);
			return text;
		};
		const pixel = (x, y) => {
			if (backend === video.CANVAS) {
				return Array.from(renderer.getContext().getImageData(x, y, 1, 1).data);
			}
			const out = new Uint8Array(4);
			const gl = renderer.gl;
			gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
			// WebGL framebuffer RGB is premultiplied; Canvas readback is straight.
			return [out[0], out[1], out[2]]
				.map((v) => {
					return out[3] ? Math.round((v * 255) / out[3]) : 0;
				})
				.concat(out[3]);
		};

		it("keeps the ordinary path and layout identical with an identity effect", () => {
			const text = makeText({
				text: "AB C\nABC",
				size: 2,
				textAlign: "center",
				textBaseline: "middle",
				wordWrapWidth: 18,
			});
			const draw = vi.spyOn(renderer, "drawImage");
			text.draw(renderer);
			const plain = draw.mock.calls.map((call) => {
				return call.slice();
			});
			const bounds = {
				x: text.getBounds().x,
				y: text.getBounds().y,
				width: text.getBounds().width,
				height: text.getBounds().height,
			};
			draw.mockClear();
			text.glyphEffect = () => {};
			text.draw(renderer);
			expect(draw.mock.calls).toEqual(plain);
			expect({
				x: text.getBounds().x,
				y: text.getBounds().y,
				width: text.getBounds().width,
				height: text.getBounds().height,
			}).toEqual(bounds);
			text.glyphEffect = null;
			draw.mockClear();
			text.draw(renderer);
			expect(draw.mock.calls).toEqual(plain);
		});

		it("reuses and resets output/context, preserving spaces, reveal and pen advance", () => {
			const text = makeText({ text: "A BC\nABC" });
			const contexts = [],
				outputs = [],
				snapshots = [];
			text.glyphEffect = (out, ctx) => {
				contexts.push(ctx);
				outputs.push(out);
				snapshots.push({
					...ctx,
					offsetX: out.offsetX,
					offsetY: out.offsetY,
					tint: Array.from(out.tint.toArray()),
				});
				if (ctx.index === 0) {
					out.offsetX = 5;
					out.offsetY = 3;
					out.tint.setColor(255, 0, 0, 0.5);
				}
			};
			text.visibleCharacters = 5;
			text.update(20);
			const draw = vi.spyOn(renderer, "drawImage");
			text.draw(renderer);
			expect(
				snapshots.map((ctx) => {
					return ctx.char;
				}),
			).toEqual(["A", " ", "B", "C", "A"]);
			expect(
				snapshots.map((ctx) => {
					return ctx.index;
				}),
			).toEqual([0, 1, 2, 3, 4]);
			expect(
				snapshots.every((ctx) => {
					return (
						ctx.time === 20 &&
						ctx.offsetX === 0 &&
						ctx.offsetY === 0 &&
						ctx.tint.every((v) => {
							return v === 1;
						})
					);
				}),
			).toBe(true);
			expect(
				contexts.every((ctx) => {
					return ctx === contexts[0];
				}),
			).toBe(true);
			expect(
				outputs.every((out) => {
					return out === outputs[0];
				}),
			).toBe(true);
			expect(
				draw.mock.calls.map((call) => {
					return call.slice(5, 7);
				}),
			).toEqual([
				[13, 11],
				[20, 8],
				[26, 8],
				[8, 12],
			]);
			text.setText("CBA");
			snapshots.length = 0;
			text.draw(renderer);
			expect(
				snapshots.map((ctx) => {
					return ctx.char;
				}),
			).toEqual(["C", "B", "A"]);
		});

		it("skips missing and hidden glyphs without renumbering later characters", () => {
			const seen = [];
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const text = makeText({
				text: "A?B",
				glyphEffect: (_out, ctx) => {
					return seen.push([ctx.index, ctx.code]);
				},
			});
			text.draw(renderer);
			expect(seen).toEqual([
				[0, 65],
				[2, 66],
			]);
			expect(warn).toHaveBeenCalledTimes(1);
			seen.length = 0;
			text.visibleCharacters = 0;
			text.draw(renderer);
			expect(seen).toEqual([]);
		});

		it("advances time on updates, dirties the scene without changing layout, and redraws after removal", () => {
			const text = makeText();
			text.isDirty = false;
			expect(text.update(16)).toBe(false);
			const times = [];
			text.glyphEffect = (_out, ctx) => {
				return times.push(ctx.time);
			};
			text.isDirty = false;
			expect(text.update(16)).toBe(true);
			expect(text.isDirty).toBe(false);
			text.draw(renderer);
			text.draw(renderer);
			expect(
				times.every((time) => {
					return time === 16;
				}),
			).toBe(true);
			text.glyphEffect = null;
			expect(text.update(16)).toBe(true);
			text.isDirty = false;
			expect(text.update(16)).toBe(false);
		});

		it("restores renderer tint and alpha when the callback throws or reveal stops", () => {
			const text = makeText();
			renderer.currentTint.setFloat(0.5, 0.25, 1, 0.75);
			renderer.setGlobalAlpha(0.5);
			const original = Array.from(renderer.currentTint.toArray());
			text.glyphEffect = (out) => {
				out.tint.setColor(255, 0, 0, 0.25);
			};
			text.visibleCharacters = 1;
			text.draw(renderer);
			expect(Array.from(renderer.currentTint.toArray())).toEqual(original);
			expect(renderer.getGlobalAlpha()).toBe(0.5);
			text.glyphEffect = () => {
				throw new Error("effect failed");
			};
			expect(() => {
				return text.draw(renderer);
			}).toThrow("effect failed");
			expect(Array.from(renderer.currentTint.toArray())).toEqual(original);
			expect(renderer.getGlobalAlpha()).toBe(0.5);
		});

		it("REGRESSION: a falsy assignment disables the effect, it does not throw", () => {
			// `undefined` is how an unset option arrives and how a caller
			// spells "turn it off". The constructor normalized it with
			// `|| null`; the setter stored it, which left the draw path's
			// `!== null` test true with nothing callable behind it, and the
			// `TypeError` came out of `draw()`, from inside the frame loop.
			const text = makeText();
			text.glyphEffect = (out) => {
				out.offsetY = 3;
			};
			expect(typeof text.glyphEffect).toEqual("function");

			text.glyphEffect = undefined;
			// reads back as the documented `GlyphEffect|null`, not `undefined`
			expect(text.glyphEffect).toBe(null);
			expect(() => {
				text.draw(renderer);
			}).not.toThrow();

			// and the ordinary path really is back: no per-glyph callback runs
			const draw = vi.spyOn(renderer, "drawImage");
			text.draw(renderer);
			expect(draw).toHaveBeenCalledTimes(3);
		});

		it("renders offset/tinted pixels through the world, keeps the next glyph untouched and batches GPU colours", () => {
			const text = makeText({
				fillStyle: "#80ffff",
				glyphEffect: (out, ctx) => {
					if (ctx.index === 0) {
						out.offsetY = 8;
						out.tint.setColor(255, 0, 0, 0.5);
					}
					if (ctx.index === 1) {
						out.tint.setColor(0, 255, 0);
					}
				},
			});
			text.setOpacity(0.5);
			app.world.addChild(text);
			renderer.backgroundColor.setFloat(0, 0, 0, 0);
			renderer.clearRect(0, 0, SIZE, SIZE);
			const draw =
				backend === video.WEBGL
					? vi.spyOn(renderer.gl, "drawElements")
					: undefined;
			app.world.update(16);
			app.repaint();
			app.draw();
			const red = pixel(9, 17),
				green = pixel(15, 9),
				third = pixel(20, 9);
			expect(red[0]).toBeGreaterThan(100);
			expect(red[1]).toBe(0);
			expect(red[2]).toBe(0);
			expect(red[3]).toBeGreaterThanOrEqual(62);
			expect(red[3]).toBeLessThanOrEqual(65);
			expect(green[1]).toBe(255);
			expect(green[0]).toBe(0);
			expect(green[3]).toBeGreaterThanOrEqual(126);
			expect(green[3]).toBeLessThanOrEqual(129);
			expect(third[0]).toBeGreaterThan(120);
			expect(third[1]).toBe(255);
			if (draw) {
				expect(draw).toHaveBeenCalledTimes(1);
			}
		});
	});
}
