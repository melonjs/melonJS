/**
 * `ParticleEmitterSettings.tintOverLife`: the tints a particle takes over its
 * life, evenly spaced and blended, in 32 steps whatever the number of colors.
 *
 * What has to hold, on Canvas and WebGL:
 *   - the first color at birth, the last at the end, a blend in between
 *   - one color is a plain tint, and the setting replaces `tint`
 *   - the color only: opacity is still the fade, and a color's alpha is ignored
 *   - at most 32 colors over a life, however many are given, which bounds the
 *     Canvas renderer's tinted copies of the texture to 32
 *   - drawn pixels take the tint
 *   - it works alongside sprite-sheet frames
 *   - a pooled particle reused by another emitter takes that emitter's tint
 *   - the caller's array is snapshot; `reset()` changes it for new particles
 *   - bad values throw, and leave the previous settings in place
 */
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { Application, boot, ParticleEmitter, video } from "../src/index.js";

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`particle tintOverLife (${backend})`, () => {
		let app, renderer, white;

		beforeAll(async () => {
			boot();
			app = new Application(64, 64, {
				parent: "screen",
				renderer: backend,
				scale: "1.0",
				antiAlias: false,
				failIfMajorPerformanceCaveat: false,
				transparent: true,
			});
			await app.init();
			renderer = app.renderer;
			white = document.createElement("canvas");
			white.width = 8;
			white.height = 8;
			const ctx = white.getContext("2d");
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, 8, 8);
		});
		afterEach(() => {
			vi.restoreAllMocks();
			app.world.reset();
			app.world.broadphase.clear();
		});
		afterAll(() => {
			return app?.destroy();
		});

		/** an emitter with one particle of a 1000 ms life, at rest */
		function make(settings = {}) {
			const emitter = new ParticleEmitter(0, 0, {
				image: white,
				width: 0,
				height: 0,
				speed: 0,
				speedVariation: 0,
				minLife: 1000,
				maxLife: 1000,
				minEndScale: 1,
				maxEndScale: 1,
				onlyInViewport: false,
				...settings,
			});
			app.world.addChild(emitter);
			emitter.burstParticles(1);
			return emitter;
		}

		const rgb = (particle) => {
			return Array.from(particle.tint.toArray().slice(0, 3), (v) => {
				return Math.round(v * 255);
			});
		};

		// ---- the blend ------------------------------------------------------

		it("is the first color at birth", () => {
			const p = make({ tintOverLife: ["#ff0000", "#0000ff"] }).children[0];
			expect(rgb(p)).toEqual([255, 0, 0]);
			p.update(0);
			expect(rgb(p)).toEqual([255, 0, 0]);
		});

		it("ends on the last color", () => {
			const p = make({ tintOverLife: ["#ff0000", "#0000ff"] }).children[0];
			p.update(999);
			expect(rgb(p)).toEqual([0, 0, 255]);
		});

		it("blends evenly spaced colors in between", () => {
			const p = make({
				tintOverLife: ["#ff0000", "#00ff00", "#0000ff"],
			}).children[0];
			// half way: the middle color, give or take one of the 32 steps
			p.update(500);
			const [r, g, b] = rgb(p);
			expect(g).toBeGreaterThan(230);
			expect(r + b).toBeLessThan(25);
			// and a quarter of the way: half red, half green
			const q = make({
				tintOverLife: ["#ff0000", "#00ff00", "#0000ff"],
			}).children[0];
			q.update(250);
			const [qr, qg, qb] = rgb(q);
			expect(Math.abs(qr - qg)).toBeLessThan(40);
			expect(qb).toBe(0);
		});

		it("treats one color as a plain tint, and replaces tint", () => {
			const p = make({ tint: "#00ff00", tintOverLife: ["#ff0000"] })
				.children[0];
			expect(rgb(p)).toEqual([255, 0, 0]);
			p.update(700);
			expect(rgb(p)).toEqual([255, 0, 0]);
		});

		it("leaves the opacity to the fade, ignoring a color's alpha", () => {
			const p = make({
				tintOverLife: ["rgba(255, 0, 0, 0.2)", "rgba(0, 0, 255, 0.2)"],
			}).children[0];
			p.update(500);
			expect(p.alpha).toBeCloseTo(0.5, 5);
			expect(p.tint.alpha).toBe(1);
		});

		it("changes color at most 32 times over a life, however many colors", () => {
			// a hundred distinct colors, stepped through one millisecond at a time
			const colors = Array.from({ length: 100 }, (_, i) => {
				return `rgb(${(i * 37) % 256}, ${(i * 91) % 256}, ${(i * 53) % 256})`;
			});
			const p = make({ tintOverLife: colors }).children[0];
			const seen = new Set([rgb(p).join()]);
			for (let t = 0; t < 999; t++) {
				p.update(1);
				seen.add(rgb(p).join());
			}
			expect(seen.size).toBeLessThanOrEqual(32);
			expect(seen.size).toBeGreaterThan(16);
		});

		// ---- drawing --------------------------------------------------------

		it("draws in the tint", () => {
			const em = make({ tintOverLife: ["#ff0000", "#0000ff"] });
			em.children[0].pos.set(16, 16);
			em.children[0].update(0);
			renderer.backgroundColor.setFloat(0, 0, 0, 0);
			renderer.clearRect(0, 0, 64, 64);
			app.world.update(0);
			app.repaint();
			app.draw();
			const [r, g, b, a] =
				backend === video.CANVAS
					? Array.from(renderer.getContext().getImageData(16, 16, 1, 1).data)
					: (() => {
							const bytes = new Uint8Array(4);
							renderer.gl.readPixels(
								16,
								63 - 16,
								1,
								1,
								renderer.gl.RGBA,
								renderer.gl.UNSIGNED_BYTE,
								bytes,
							);
							return Array.from(bytes);
						})();
			expect(a).toBeGreaterThan(200);
			expect(r).toBeGreaterThan(200);
			expect(g + b).toBeLessThan(40);
		});

		if (backend === video.CANVAS) {
			it("keeps the Canvas renderer's tinted copies of the texture to 32", () => {
				// many particles at every age, through a hundred colors, drawn
				// frame after frame: without the steps, each new color would
				// leave another tinted copy of the texture in the cache for good
				const colors = Array.from({ length: 100 }, (_, i) => {
					return `rgb(${(i * 37) % 256}, ${(i * 91) % 256}, ${(i * 53) % 256})`;
				});
				// a texture of its own: the cache outlives each test
				const texture = document.createElement("canvas");
				texture.width = 8;
				texture.height = 8;
				texture.getContext("2d").fillRect(0, 0, 8, 8);
				const em = make({
					image: texture,
					tintOverLife: colors,
					totalParticles: 60,
					frequency: 5,
					minLife: 300,
					maxLife: 900,
				});
				em.streamParticles();
				for (let frame = 0; frame < 120; frame++) {
					app.world.update(16);
					app.repaint();
					app.draw();
				}
				const copies = renderer.cache.tinted.get(texture);
				expect(copies).toBeDefined();
				expect(copies.size).toBeLessThanOrEqual(32);
			});
		}

		// ---- with the rest of the emitter ------------------------------------

		it("works alongside sprite-sheet frames", () => {
			const sheet = document.createElement("canvas");
			sheet.width = 16;
			sheet.height = 8;
			const p = make({
				image: sheet,
				framewidth: 8,
				frameheight: 8,
				tintOverLife: ["#ff0000", "#0000ff"],
			}).children[0];
			p.update(999);
			const draw = vi.fn();
			p.draw({ drawImage: draw });
			// the last frame, in the last color
			expect(draw.mock.calls[0].slice(1, 3)).toEqual([8, 0]);
			expect(rgb(p)).toEqual([0, 0, 255]);
		});

		it("gives a pooled particle reused by another emitter that emitter's tint", () => {
			const first = make({ tintOverLife: ["#ff0000", "#0000ff"] });
			const p = first.children[0];
			p.update(999); // blue, the end of the first emitter's blend
			// what the pool runs on a particle it hands out again
			const second = new ParticleEmitter(0, 0, {
				image: white,
				tint: "#00ff00",
			});
			p.onResetEvent(second, false);
			expect(rgb(p)).toEqual([0, 255, 0]);
			p.update(500);
			expect(rgb(p)).toEqual([0, 255, 0]);
			// and back on an emitter with a blend
			p.onResetEvent(first, false);
			expect(rgb(p)).toEqual([255, 0, 0]);
		});

		it("snapshots the colors: changing the array afterwards does nothing", () => {
			const colors = ["#ff0000", "#0000ff"];
			const em = make({ tintOverLife: colors });
			colors[0] = "#00ff00";
			em.burstParticles(1);
			expect(rgb(em.children[1])).toEqual([255, 0, 0]);
		});

		it("takes new colors from reset(), for the particles emitted after", () => {
			const em = make({ tintOverLife: ["#ff0000", "#0000ff"] });
			em.reset({ ...em.settings, tintOverLife: ["#00ff00"] });
			em.burstParticles(1);
			expect(rgb(em.children[em.children.length - 1])).toEqual([0, 255, 0]);
		});

		// ---- bad values -------------------------------------------------------

		it("throws on anything but a non-empty array of CSS colors, saying so", () => {
			// what is wrong, rather than a crash deeper in
			for (const bad of [[], "red", {}]) {
				expect(() => {
					return new ParticleEmitter(0, 0, { tintOverLife: bad });
				}, JSON.stringify(bad)).toThrow(/non-empty array of CSS colors/);
			}
			for (const bad of [[5], [null], ["#ff0000", 7]]) {
				expect(() => {
					return new ParticleEmitter(0, 0, { tintOverLife: bad });
				}, JSON.stringify(bad)).toThrow(/must be CSS strings/);
			}
			expect(() => {
				return new ParticleEmitter(0, 0, { tintOverLife: ["not a color"] });
			}).toThrow();
		});

		it("leaves the previous settings in place when reset() throws", () => {
			const em = make({ tintOverLife: ["#ff0000", "#0000ff"] });
			expect(() => {
				em.reset({ ...em.settings, tintOverLife: [] });
			}).toThrow(TypeError);
			expect(em.settings.tintOverLife).toEqual(["#ff0000", "#0000ff"]);
			em.burstParticles(1);
			expect(rgb(em.children[em.children.length - 1])).toEqual([255, 0, 0]);
		});
	});
}
