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
	boot,
	ParticleEmitter,
	video,
	WebGLRenderer,
} from "../src/index.js";
import { particlePool } from "../src/particles/particle.ts";
import Renderer from "../src/video/renderer.js";

/**
 * An emitter without an image draws white squares of `textureSize` (#1807).
 *
 * Each emitter used to paint a square canvas of its own, rebuilt on every
 * `reset()`, and never freed from the renderer: on WebGL and WebGPU every
 * square stayed uploaded and in `renderer.cache`, and on Canvas every tinted
 * copy of it stayed in the tint cache. Now every such emitter draws the
 * renderer's shared white pixel (`Renderer.getWhitePixel()`), stretched to
 * `textureSize`: one texture, uploaded once, so nothing is left to leak.
 *
 * These pin both halves: that it looks exactly as a real white square of the
 * same size does, in every way a particle can be drawn, and that no amount of
 * resets, emitters or destroys adds a texture.
 */

const W = 96;
const H = 96;

/** a white square canvas, the image the built-in square must look like */
const whiteSquare = (size) => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, size, size);
	return canvas;
};

/** the sources the renderer's texture cache holds */
const cachedSources = (renderer) => {
	const sources = new Set();
	renderer.cache.cache.forEach((_texture, source) => {
		sources.add(source);
	});
	return sources;
};

/** the white pixel's own pixel, which nothing may have drawn on */
const whitePixelData = () => {
	return Array.from(
		Renderer.getWhitePixel().getContext("2d").getImageData(0, 0, 1, 1).data,
	);
};

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`built-in particle square (${backend})`, () => {
		let app;
		let renderer;

		beforeAll(async () => {
			boot();
			app = new Application(W, H, {
				parent: "screen",
				renderer: backend,
				scale: "1.0",
				antiAlias: false,
				failIfMajorPerformanceCaveat: false,
				transparent: true,
			});
			await app.init();
			renderer = app.renderer;
			if (backend === video.WEBGL) {
				expect(renderer).toBeInstanceOf(WebGLRenderer);
			}
		});

		afterEach(() => {
			vi.restoreAllMocks();
			app.world.reset();
			app.world.pos.set(0, 0, 0);
			app.world.broadphase.clear();
			renderer.setAntiAlias(false);
			if (backend === video.WEBGL) {
				renderer.setTextureFilter("auto");
			}
		});

		afterAll(() => {
			// whatever ran, the shared pixel is still a white pixel
			expect(whitePixelData()).toEqual([255, 255, 255, 255]);
			return app?.destroy();
		});

		/** an emitter of particles that stay put, at full size and opacity */
		const make = (settings = {}) => {
			const emitter = new ParticleEmitter(0, 0, {
				width: 0,
				height: 0,
				speed: 0,
				speedVariation: 0,
				gravity: 0,
				minLife: 100000,
				maxLife: 100000,
				minStartScale: 1,
				maxStartScale: 1,
				minEndScale: 1,
				maxEndScale: 1,
				onlyInViewport: false,
				...settings,
			});
			app.world.addChild(emitter);
			return emitter;
		};

		/** one particle, placed at (x, y) */
		const particleAt = (emitter, x, y) => {
			emitter.burstParticles(1);
			const particle = emitter.children.at(-1);
			particle.pos.set(x, y);
			particle.update(0);
			return particle;
		};

		/** draw the world over a transparent screen, and read it back */
		const render = () => {
			renderer.backgroundColor.setFloat(0, 0, 0, 0);
			renderer.clearRect(0, 0, W, H);
			app.world.update(0);
			app.repaint();
			app.draw();
			if (backend === video.CANVAS) {
				return Array.from(renderer.getContext().getImageData(0, 0, W, H).data);
			}
			const gl = renderer.gl;
			const bytes = new Uint8Array(W * H * 4);
			gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
			return Array.from(bytes);
		};

		/** what the drawn particle covers: the box of its non-transparent pixels */
		const inkBox = (pixels) => {
			let left = W;
			let right = -1;
			let top = H;
			let bottom = -1;
			for (let y = 0; y < H; y++) {
				for (let x = 0; x < W; x++) {
					if (pixels[(y * W + x) * 4 + 3] !== 0) {
						left = Math.min(left, x);
						right = Math.max(right, x);
						top = Math.min(top, y);
						bottom = Math.max(bottom, y);
					}
				}
			}
			return { width: right - left + 1, height: bottom - top + 1, left, top };
		};

		/** the first pixel that differs between two frames, or undefined */
		const firstDifference = (a, b) => {
			for (let i = 0; i < a.length; i++) {
				if (a[i] !== b[i]) {
					const at = i >> 2;
					return `pixel (${at % W}, ${Math.floor(at / W)}): ${a.slice(at * 4, at * 4 + 4)} vs ${b.slice(at * 4, at * 4 + 4)}`;
				}
			}
			return undefined;
		};

		describe("looks exactly like a white square of the same size", () => {
			const cases = [];
			for (const size of [1, 2, 8, 13, 32]) {
				for (const tint of ["#ffffff", "#ff8000"]) {
					// where the square's top left corner lands
					for (const [where, dx, dy] of [
						["on whole pixels", 0, 0],
						["between pixels", 0.3, 0.6],
					]) {
						for (const rotation of [0, 0.6]) {
							for (const smooth of [false, true]) {
								cases.push([size, tint, where, rotation, smooth, dx, dy]);
							}
						}
					}
				}
			}

			it.each(cases)(
				"size %i, tint %s, %s, rotated %f, smoothing %s",
				(size, tint, _where, rotation, smooth, dx, dy) => {
					// a particle is placed by its centre
					const x = 40 + dx + size / 2;
					const y = 30 + dy + size / 2;
					renderer.setAntiAlias(smooth);
					if (backend === video.WEBGL) {
						renderer.setTextureFilter(smooth ? "linear" : "nearest");
					}
					const settings = {
						textureSize: size,
						tint,
						minRotation: rotation,
						maxRotation: rotation,
					};

					const builtin = make(settings);
					particleAt(builtin, x, y);
					const drawn = render();
					app.world.removeChildNow(builtin);

					const own = make({ ...settings, image: whiteSquare(size) });
					particleAt(own, x, y);
					const expected = render();

					// something was drawn, and exactly the same thing
					expect(inkBox(expected).width).toBeGreaterThan(0);
					expect(firstDifference(drawn, expected)).toBeUndefined();
				},
			);
		});

		it("is a solid square of textureSize pixels, in the tint", () => {
			for (const size of [1, 8, 13]) {
				const emitter = make({ textureSize: size, tint: "#ff8000" });
				// the square's top left corner on a whole pixel
				particleAt(emitter, 20 + size / 2, 20 + size / 2);
				const pixels = render();
				const box = inkBox(pixels);
				expect([box.width, box.height]).toEqual([size, size]);
				for (let y = box.top; y < box.top + size; y++) {
					for (let x = box.left; x < box.left + size; x++) {
						const i = (y * W + x) * 4;
						expect(pixels.slice(i, i + 4)).toEqual([255, 128, 0, 255]);
					}
				}
				app.world.removeChildNow(emitter);
			}
		});

		it("uses the shared white pixel, sized by textureSize", () => {
			const a = make({ textureSize: 8 });
			const b = make({ textureSize: 20 });
			expect(a.settings.image).toBe(Renderer.getWhitePixel());
			expect(b.settings.image).toBe(Renderer.getWhitePixel());
			const pa = particleAt(a, 10, 10);
			const pb = particleAt(b, 50, 50);
			expect([pa.width, pa.height]).toEqual([8, 8]);
			expect([pb.width, pb.height]).toEqual([20, 20]);
			expect([pb.getBounds().width, pb.getBounds().height]).toEqual([20, 20]);
		});

		describe("adds no texture, however it is used", () => {
			/** count what a run adds to the renderer: textures, uploads, tinted copies */
			const watch = () => {
				const sources = cachedSources(renderer).size;
				const tinted = renderer.cache.tinted.size;
				let created = 0;
				let uploads = 0;
				if (backend === video.WEBGL) {
					const gl = renderer.gl;
					const createTexture = gl.createTexture.bind(gl);
					const texImage2D = gl.texImage2D.bind(gl);
					vi.spyOn(gl, "createTexture").mockImplementation(() => {
						created++;
						return createTexture();
					});
					vi.spyOn(gl, "texImage2D").mockImplementation((...args) => {
						uploads++;
						return texImage2D(...args);
					});
				}
				return () => {
					return {
						sources: cachedSources(renderer).size - sources,
						tinted: renderer.cache.tinted.size - tinted,
						created,
						uploads,
					};
				};
			};

			const nothing = { sources: 0, tinted: 0, created: 0, uploads: 0 };

			it("over many reset() calls, its live particles drawing throughout", () => {
				const emitter = make({ tint: "#40c0ff" });
				particleAt(emitter, 30, 30);
				render();
				const added = watch();
				for (let i = 0; i < 40; i++) {
					emitter.reset({
						...emitter.settings,
						image: undefined,
						speed: 0,
						textureSize: 4 + (i % 5),
					});
					particleAt(emitter, 10 + i, 30);
					render();
				}
				expect(added()).toEqual(nothing);
				// every particle, the oldest included, still draws white squares
				expect(
					new Set(
						emitter.children.map((p) => {
							return p.image;
						}),
					).size,
				).toBe(1);
			});

			it("over many short-lived emitters, created, drawn and destroyed", () => {
				const first = make({ tint: "#40c0ff" });
				particleAt(first, 30, 30);
				render();
				app.world.removeChildNow(first);
				const added = watch();
				for (let i = 0; i < 40; i++) {
					const emitter = make({ tint: "#40c0ff", textureSize: 6 });
					particleAt(emitter, 20 + i, 40);
					render();
					app.world.removeChildNow(emitter);
				}
				expect(added()).toEqual(nothing);
			});

			it("with many emitters drawn at once: one texture for all", () => {
				const before = cachedSources(renderer);
				for (let i = 0; i < 25; i++) {
					particleAt(make({ textureSize: 2 + i }), 10 + i * 3, 10 + i * 3);
				}
				render();
				const added = [...cachedSources(renderer)].filter((source) => {
					return !before.has(source);
				});
				// at most the white pixel itself, if nothing had drawn it yet
				expect(added.length).toBeLessThanOrEqual(1);
				if (backend === video.WEBGL) {
					expect(renderer.cache.has(Renderer.getWhitePixel())).toBe(true);
				}
			});
		});

		it("destroying an emitter leaves the others drawing their squares", () => {
			const doomed = make({ tint: "#ff0000" });
			const kept = make({ tint: "#00ff00" });
			particleAt(doomed, 20, 20);
			particleAt(kept, 60, 60);
			render();
			app.world.removeChildNow(doomed);
			expect(doomed.settings.image).toBeUndefined();
			const pixels = render();
			const box = inkBox(pixels);
			expect([box.width, box.height]).toEqual([8, 8]);
			const i = ((box.top + 4) * W + box.left + 4) * 4;
			expect(pixels.slice(i, i + 4)).toEqual([0, 255, 0, 255]);
			if (backend === video.WEBGL) {
				expect(renderer.cache.has(Renderer.getWhitePixel())).toBe(true);
			}
		});

		it("a new textureSize sizes new particles, and leaves live ones as they are", () => {
			const emitter = make({ textureSize: 8 });
			const before = particleAt(emitter, 20, 20);
			emitter.reset({ ...emitter.settings, image: undefined, textureSize: 16 });
			const after = particleAt(emitter, 60, 60);
			expect([before.width, after.width]).toEqual([8, 16]);
			expect(before.image).toBe(after.image);
		});

		describe("an emitter with an image of its own", () => {
			it("draws it, at its size, and never frees it", () => {
				const image = whiteSquare(12);
				const emitter = make({ image });
				const particle = particleAt(emitter, 30, 30);
				expect(emitter.settings.image).toBe(image);
				expect([particle.width, particle.height]).toEqual([12, 12]);
				render();
				app.world.removeChildNow(emitter);
				// the game's image, untouched, and still uploaded where it was
				expect(
					Array.from(image.getContext("2d").getImageData(0, 0, 1, 1).data),
				).toEqual([255, 255, 255, 255]);
				if (backend === video.WEBGL) {
					expect(renderer.cache.has(image)).toBe(true);
				}
			});

			it("given the white pixel itself, draws 1x1 particles: its image, not the built-in square", () => {
				const emitter = make({
					image: Renderer.getWhitePixel(),
					textureSize: 16,
				});
				const particle = particleAt(emitter, 30, 30);
				expect([particle.width, particle.height]).toEqual([1, 1]);
				expect(inkBox(render())).toMatchObject({ width: 1, height: 1 });
			});

			it("switching between an image and none, by reset(), sizes each right", () => {
				const image = whiteSquare(10);
				const emitter = make({ image });
				const a = particleAt(emitter, 10, 10);
				emitter.reset({
					...emitter.settings,
					image: undefined,
					textureSize: 6,
				});
				const b = particleAt(emitter, 30, 30);
				emitter.reset({ ...emitter.settings, image });
				const c = particleAt(emitter, 60, 60);
				expect([a.width, b.width, c.width]).toEqual([10, 6, 10]);
				expect([a.image, c.image]).toEqual([image, image]);
				expect(b.image).toBe(Renderer.getWhitePixel());
			});
		});

		it("a pooled particle reused across emitters with and without an image draws each right", () => {
			const crop = (particle) => {
				const draw = vi.fn();
				particle.draw({ drawImage: draw });
				return draw.mock.calls[0].slice(1);
			};
			const builtin = make({ textureSize: 8 });
			const p = particleAt(builtin, 10, 10);
			expect(crop(p)).toEqual([0, 0, 1, 1, 0, 0, 8, 8]);
			app.world.removeChildNow(builtin);

			const image = whiteSquare(10);
			const withImage = make({ image });
			const spy = vi.spyOn(particlePool, "get");
			const q = particleAt(withImage, 10, 10);
			// the recycled instance, when the pool gave one back
			expect(spy).toHaveBeenCalled();
			expect(crop(q)).toEqual([0, 0, 10, 10, 0, 0, 10, 10]);
			app.world.removeChildNow(withImage);

			const again = make({ textureSize: 5 });
			const r = particleAt(again, 10, 10);
			expect(crop(r)).toEqual([0, 0, 1, 1, 0, 0, 5, 5]);
		});

		describe("frames of the built-in square", () => {
			it("are cells of textureSize, each drawing the whole white pixel", () => {
				const emitter = make({ textureSize: 8, framewidth: 4, frameheight: 4 });
				const particle = particleAt(emitter, 32, 32);
				expect([particle.width, particle.height]).toEqual([4, 4]);
				expect(inkBox(render())).toMatchObject({ width: 4, height: 4 });
				// through all four cells of its life, alive throughout
				for (let i = 0; i < 4; i++) {
					const draw = vi.fn();
					particle.draw({ drawImage: draw });
					expect(draw.mock.calls[0].slice(1)).toEqual([0, 0, 1, 1, 0, 0, 4, 4]);
					particle.update(24000);
				}
				expect(particle.life).toBeGreaterThan(0);
			});

			it("larger than textureSize are still refused", () => {
				expect(() => {
					return make({ textureSize: 8, framewidth: 9 });
				}).toThrow(RangeError);
			});
		});
	});
}
