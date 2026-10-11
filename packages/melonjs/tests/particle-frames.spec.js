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

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`particle sprite sheets (${backend})`, () => {
		let app, renderer, sheet;
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
			if (backend === video.WEBGL) {
				expect(renderer).toBeInstanceOf(WebGLRenderer);
			}
			sheet = document.createElement("canvas");
			sheet.width = 16;
			sheet.height = 16;
			const ctx = sheet.getContext("2d");
			for (const [i, color] of [
				"#ff0000",
				"#00ff00",
				"#0000ff",
				"#ffff00",
			].entries()) {
				ctx.fillStyle = color;
				ctx.fillRect((i % 2) * 8, Math.floor(i / 2) * 8, 8, 8);
			}
		});
		afterEach(() => {
			vi.restoreAllMocks();
			app.world.reset();
			app.world.pos.set(0, 0, 0);
			app.world.broadphase.clear();
		});
		afterAll(() => {
			return app?.destroy();
		});

		function make(settings = {}) {
			const emitter = new ParticleEmitter(0, 0, {
				image: sheet,
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
		function crop(particle) {
			const draw = vi.fn();
			particle.draw({ drawImage: draw });
			return draw.mock.calls[0].slice(1);
		}
		function pixel(x, y) {
			if (backend === video.CANVAS) {
				return Array.from(renderer.getContext().getImageData(x, y, 1, 1).data);
			}
			const gl = renderer.gl;
			const bytes = new Uint8Array(4);
			gl.readPixels(x, 63 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
			return [bytes[0], bytes[1], bytes[2]]
				.map((v) => {
					return bytes[3] ? Math.round((v * 255) / bytes[3]) : 0;
				})
				.concat(bytes[3]);
		}

		it("keeps whole-image dimensions and source coordinates by default", () => {
			const p = make().children[0];
			expect([p.width, p.height]).toEqual([16, 16]);
			expect(crop(p)).toEqual([0, 0, 16, 16, 0, 0, 16, 16]);
		});
		it("uses frame-sized bounds and traverses whole cells in row-major order", () => {
			const p = make({ framewidth: 8, frameheight: 8 }).children[0];
			expect([p.width, p.height]).toEqual([8, 8]);
			p.update(0);
			expect([p.getBounds().width, p.getBounds().height]).toEqual([8, 8]);
			expect(crop(p).slice(0, 4)).toEqual([0, 0, 8, 8]);
			p.update(250);
			expect(crop(p).slice(0, 2)).toEqual([8, 0]);
			p.update(250);
			expect(crop(p).slice(0, 2)).toEqual([0, 8]);
			p.update(499);
			expect(crop(p).slice(0, 2)).toEqual([8, 8]);
		});
		it("supports reordered and repeated frames, and snapshots the caller's array", () => {
			const frames = [3, 0, 0, 2];
			const p = make({ framewidth: 8, frameheight: 8, frames }).children[0];
			frames.fill(1);
			expect(crop(p).slice(0, 2)).toEqual([8, 8]);
			p.update(500);
			expect(crop(p).slice(0, 2)).toEqual([0, 0]);
			p.update(250);
			expect(crop(p).slice(0, 2)).toEqual([0, 8]);
		});
		it("defaults an omitted dimension to the image dimension", () => {
			const p = make({ framewidth: 8 }).children[0];
			expect([p.width, p.height]).toEqual([8, 16]);
			p.update(500);
			expect(crop(p).slice(0, 4)).toEqual([8, 0, 8, 16]);
		});
		it("ignores partial trailing cells", () => {
			const p = make({ framewidth: 6, frameheight: 6 }).children[0];
			p.update(999);
			expect(crop(p).slice(0, 4)).toEqual([6, 6, 6, 6]);
		});
		it("keeps a single selected frame for the full lifetime", () => {
			const p = make({ framewidth: 8, frameheight: 8, frames: [2] })
				.children[0];
			p.update(999);
			expect(crop(p).slice(0, 2)).toEqual([0, 8]);
		});
		it("preserves the random sampling of ordinary and lifetime-animated effects", () => {
			const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
			particlePool.purge();
			make();
			const calls = random.mock.calls.length;
			random.mockClear();
			particlePool.purge();
			make({ framewidth: 8, frameheight: 8 });
			expect(random).toHaveBeenCalledTimes(calls);
		});
		it("keeps scale and rotation around the cell center", () => {
			const p = make({
				framewidth: 8,
				frameheight: 4,
				minStartScale: 2,
				maxStartScale: 2,
				minEndScale: 2,
				maxEndScale: 2,
				minRotation: Math.PI / 2,
				maxRotation: Math.PI / 2,
			}).children[0];
			p.pos.set(20, 20);
			p.update(0);
			const bounds = p.getBounds();
			expect(bounds.width).toBeCloseTo(8);
			expect(bounds.height).toBeCloseTo(16);
			expect(bounds.centerX).toBeCloseTo(20);
			expect(bounds.centerY).toBeCloseTo(20);
		});
		it("retains the drawable fallback canvas when reset switches to a sheet", () => {
			const em = make({ image: undefined });
			const p = em.children[0];
			const image = p.image;
			em.reset({ image: sheet, framewidth: 8, frameheight: 8 });
			expect(p.image).toBe(image);
			expect([image.width, image.height]).toEqual([8, 8]);
			expect(
				Array.from(image.getContext("2d").getImageData(0, 0, 1, 1).data),
			).toEqual([255, 255, 255, 255]);
			expect(crop(p).slice(0, 4)).toEqual([0, 0, 8, 8]);
		});
		it("rejects invalid fallback frames before changing texture, blend or reference space", () => {
			const em = make({
				image: undefined,
				referenceSpace: "world",
				blendMode: "additive",
			});
			const image = em.settings.image;
			expect(() => {
				return em.reset({ framewidth: 9 });
			}).toThrow(RangeError);
			expect(em.settings.image).toBe(image);
			expect(em.referenceSpace).toBe("world");
			expect(em.blendMode).toBe("additive");
			expect(
				Array.from(image.getContext("2d").getImageData(0, 0, 1, 1).data),
			).toEqual([255, 255, 255, 255]);
		});
		it("rejects an unloaded image or multiple frames without sheet dimensions", () => {
			expect(() => {
				return make({ image: new Image(), framewidth: 8 });
			}).toThrow(RangeError);
			expect(() => {
				return make({ frames: [0, 1] });
			}).toThrow(RangeError);
		});
		it("advances by each particle's own lifetime and handles large deltas", () => {
			const p = make({ framewidth: 8, frameheight: 8 }).children[0];
			p.startLife = p.life = 2000;
			p.update(500);
			expect(crop(p).slice(0, 2)).toEqual([8, 0]);
			p.update(1499);
			expect(crop(p).slice(0, 2)).toEqual([8, 8]);
			p.update(1);
			expect(p.alive).toBe(false);
		});
		it("uses accumulated time when emitter updates are skipped", () => {
			const em = make({ framewidth: 8, frameheight: 8, framesToSkip: 1 });
			const p = em.children[0];
			em.update(125);
			em.update(125);
			expect(crop(p).slice(0, 2)).toEqual([8, 0]);
		});
		it("chooses a static random frame at birth", () => {
			vi.spyOn(Math, "random").mockReturnValue(0.75);
			const p = make({
				framewidth: 8,
				frameheight: 8,
				frames: [2, 1],
				randomFrame: true,
			}).children[0];
			expect(crop(p).slice(0, 2)).toEqual([8, 0]);
			p.update(999);
			expect(crop(p).slice(0, 2)).toEqual([8, 0]);
		});
		it("preserves live particles' image, dimensions and sequence on reset", () => {
			const em = make({ framewidth: 8, frameheight: 8, frames: [3, 2] });
			const old = em.children[0];
			const nextImage = document.createElement("canvas");
			nextImage.width = nextImage.height = 4;
			em.reset({ image: nextImage });
			em.burstParticles(1);
			old.update(500);
			expect(old.image).toBe(sheet);
			expect(crop(old).slice(0, 4)).toEqual([0, 8, 8, 8]);
			expect(crop(em.children[1]).slice(0, 4)).toEqual([0, 0, 4, 4]);
		});
		it("clears frame selection and dimensions when a pooled particle is reused", () => {
			particlePool.purge();
			const em = make({
				framewidth: 8,
				frameheight: 8,
				frames: [3],
				randomFrame: true,
			});
			const old = em.children[0];
			em.removeChildNow(old, true);
			particlePool.release(old);
			em.reset({ image: sheet });
			em.burstParticles(1);
			const next = em.children[0];
			expect(next).toBe(old);
			expect(crop(next)).toEqual([0, 0, 16, 16, 0, 0, 16, 16]);
		});
		it.each([
			{ framewidth: 0 },
			{ framewidth: -1 },
			{ framewidth: 17 },
			{ frameheight: 1.5 },
			{ frameheight: Number.NaN },
			{ framewidth: Infinity },
			{ frames: [] },
			{ frames: [-1] },
			{ frames: [0.5] },
			{ frames: [4] },
			{ frames: new Array(2) },
		])(
			"rejects invalid sheet settings without changing an existing emitter: %j",
			(settings) => {
				const em = make({ framewidth: 8, frameheight: 8 });
				expect(() => {
					return em.reset({
						image: sheet,
						framewidth: 8,
						frameheight: 8,
						...settings,
					});
				}).toThrow(RangeError);
				expect(em.settings.framewidth).toBe(8);
				em.burstParticles(1);
				expect(crop(em.children[1]).slice(0, 4)).toEqual([0, 0, 8, 8]);
			},
		);
		it("renders different frames through world transforms in one GPU batch", () => {
			const em = make({ framewidth: 8, frameheight: 8 });
			em.burstParticles(1);
			em.children[0].pos.set(16, 16);
			em.children[1].pos.set(32, 16);
			em.children[0].update(0);
			em.children[1].update(250);
			const draw =
				backend === video.WEBGL
					? vi.spyOn(renderer.gl, "drawElements")
					: undefined;
			renderer.backgroundColor.setFloat(0, 0, 0, 0);
			renderer.clearRect(0, 0, 64, 64);
			app.world.update(0);
			app.repaint();
			app.draw();
			expect(pixel(16, 16)).toEqual([255, 0, 0, 255]);
			const green = pixel(32, 16);
			expect(green.slice(0, 3)).toEqual([0, 255, 0]);
			expect(green[3]).toBeGreaterThanOrEqual(190);
			expect(green[3]).toBeLessThanOrEqual(192);
			expect(pixel(22, 16)[3]).toBe(0);
			if (draw) {
				expect(draw).toHaveBeenCalledTimes(1);
			}
		});
	});
}
