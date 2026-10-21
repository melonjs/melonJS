import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	BitmapText,
	boot,
	CanvasRenderTarget,
	Color,
	Matrix3d,
	Text,
	TextureAtlas,
	video,
	WebGLRenderer,
} from "../src/index.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";
import { readPixel } from "./helpers/pixels.js";

const sheet = () => {
	return new TextureAtlas(
		{ framewidth: 16, frameheight: 16 },
		{ width: 32, height: 32 },
		false,
	);
};

describe("TextureAtlas UV lookup without coordinate regions", () => {
	it("keeps packed UVs axis-aligned for rotated and trimmed frames", () => {
		const atlas = new TextureAtlas(
			{
				meta: {
					app: "texturepacker",
					image: "packed.png",
					size: { w: 64, h: 64 },
				},
				frames: [
					{
						filename: "packed",
						frame: { x: 8, y: 8, w: 16, h: 8 },
						rotated: true,
						trimmed: true,
						spriteSourceSize: { x: 2, y: 1, w: 8, h: 16 },
						sourceSize: { w: 12, h: 20 },
					},
				],
			},
			{ width: 64, height: 64 },
			false,
		);
		const region = atlas.getRegion("packed");
		expect(region.angle).not.toBe(0);
		expect(region.trimmed).toBe(true);
		expect(Array.from(atlas.getUVs(8, 8, 16, 8))).toEqual([
			0.125, 0.125, 0.375, 0.25,
		]);
		expect(atlas.getUVs(8, 8, 16, 8)).toBe(region.uvs);
		// a Sprite draws a rotated frame with its width and height swapped:
		// not a frame rectangle, so computed from the image size, as before
		expect(Array.from(atlas._quadUVs(atlas.getTexture(), 8, 8, 8, 16))).toEqual(
			[0.125, 0.125, 0.25, 0.375],
		);
	});

	it("keeps only authored frames in the atlas dictionary", () => {
		const atlas = sheet();
		expect(Object.keys(atlas.getAtlas())).toEqual(["0", "1", "2", "3"]);
	});

	it("does not register arbitrary drawImage source rectangles as frames", () => {
		const atlas = sheet();
		const names = Object.keys(atlas.getAtlas());
		expect(Array.from(atlas.getUVs(4, 8, 8, 16))).toEqual([
			0.125, 0.25, 0.375, 0.75,
		]);
		expect(Object.keys(atlas.getAtlas())).toEqual(names);
		expect(Object.keys(atlas.getAnimationSettings().atlasIndices)).toEqual([
			"0",
			"1",
			"2",
			"3",
		]);
	});

	it("returns a frame's own UVs, and computes any other rectangle without keeping it", () => {
		const atlas = sheet();
		expect(atlas.getUVs(16, 0, 16, 16)).toBe(atlas.getRegion("1").uvs);
		const first = atlas.getUVs(4, 8, 8, 16);
		expect(Array.from(first)).toEqual([0.125, 0.25, 0.375, 0.75]);
		// computed when asked: a new array each time, nothing stored for it
		const again = atlas.getUVs(4, 8, 8, 16);
		expect(again).not.toBe(first);
		expect(Array.from(again)).toEqual(Array.from(first));
	});

	it("draws any rectangle without allocating or remembering it", () => {
		const atlas = sheet();
		const page = atlas._pageUVs.get(atlas.getAtlas());
		const indexed = () => {
			return [...page.frames.values()].flat().length;
		};
		const before = indexed();
		const source = atlas.getTexture();
		const scratch = atlas._quadUVs(source, 0.5, 0.5, 3, 3);
		for (let i = 0; i < 1000; i++) {
			expect(
				atlas._quadUVs(source, (i % 30) + 0.25, i % 7, 1 + (i % 5), 2),
			).toBe(scratch);
		}
		expect(indexed()).toBe(before);
		expect(Object.keys(atlas.getAtlas())).toEqual(["0", "1", "2", "3"]);
	});

	it("draws every frame with the exact UVs its parser stored", () => {
		// odd sizes and offsets, so a rounding difference between computing
		// a frame's UVs and reading the stored ones would show
		const frames = [];
		for (let i = 0; i < 40; i++) {
			frames.push({
				filename: "f" + i,
				frame: {
					x: (i * 37) % 600,
					y: (i * 53) % 590,
					w: 13 + i,
					h: 7 + 2 * i,
				},
				rotated: i % 3 === 0,
				trimmed: false,
				spriteSourceSize: { x: 0, y: 0, w: 13 + i, h: 7 + 2 * i },
				sourceSize: { w: 13 + i, h: 7 + 2 * i },
			});
		}
		const atlas = new TextureAtlas(
			{
				meta: {
					app: "texturepacker",
					image: "odd.png",
					size: { w: 669, h: 665 },
				},
				frames,
			},
			{ width: 669, height: 665 },
			false,
		);
		for (const { filename } of frames) {
			const region = atlas.getRegion(filename);
			const drawn = atlas._quadUVs(
				atlas.getTexture(),
				region.offset.x,
				region.offset.y,
				region.width,
				region.height,
			);
			expect(Array.from(drawn)).toEqual(Array.from(region.uvs));
		}
	});

	it("keeps each frame's own UVs on a page whose file gives another size than its image", () => {
		// the file says 64x64, the image is 32x32: frames are normalized by
		// the file, as they always were, and anything else by the image
		const atlas = new TextureAtlas(
			{
				meta: {
					app: "texturepacker",
					image: "half.png",
					size: { w: 64, h: 64 },
				},
				frames: [
					{
						filename: "a",
						frame: { x: 16, y: 16, w: 16, h: 16 },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
						sourceSize: { w: 16, h: 16 },
					},
				],
			},
			{ width: 32, height: 32 },
			false,
		);
		const region = atlas.getRegion("a");
		const source = atlas.getTexture();
		expect(Array.from(region.uvs)).toEqual([0.25, 0.25, 0.5, 0.5]);
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).toBe(region.uvs);
		expect(atlas.getUVs(16, 16, 16, 16)).toBe(region.uvs);
		expect(Array.from(atlas._quadUVs(source, 0, 0, 8, 8))).toEqual([
			0, 0, 0.25, 0.25,
		]);
	});

	it("decides again when the image's pixels are replaced at another size", () => {
		// `_sizeChanged` is what a canvas render target's `invalidate()`
		// reaches: the page is decided again at the new size
		const atlas = new TextureAtlas(
			{
				meta: {
					app: "texturepacker",
					image: "clip.png",
					size: { w: 64, h: 64 },
				},
				frames: [
					{
						filename: "a",
						frame: { x: 16, y: 16, w: 16, h: 16 },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
						sourceSize: { w: 16, h: 16 },
					},
				],
			},
			{ width: 64, height: 64 },
			false,
		);
		const source = atlas.getTexture();
		const region = atlas.getRegion("a");
		// the file's size: computed, the same bits as the frame's own UVs
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).not.toBe(region.uvs);
		source.width = source.height = 32;
		atlas._sizeChanged();
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).toBe(region.uvs);
		expect(Array.from(atlas._quadUVs(source, 0, 0, 8, 8))).toEqual([
			0, 0, 0.25, 0.25,
		]);
		// back to the file's size, then only one side changes at a time
		source.width = source.height = 64;
		atlas._sizeChanged();
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).not.toBe(region.uvs);
		source.height = 32;
		atlas._sizeChanged();
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).toBe(region.uvs);
		source.height = 64;
		atlas._sizeChanged();
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).not.toBe(region.uvs);
		source.width = 32;
		atlas._sizeChanged();
		expect(atlas._quadUVs(source, 16, 16, 16, 16)).toBe(region.uvs);
	});

	it("has a canvas render target's WebGPU refresh tell the atlases drawn from it", () => {
		const target = new CanvasRenderTarget(8, 8);
		const told = [];
		const renderer = {
			type: "WebGPU",
			currentBatcher: { flush() {} },
			textureStore: { getBinding() {} },
			cache: {
				has() {
					return true;
				},
				get() {
					return {};
				},
				sizeChanged(image) {
					told.push(image);
				},
			},
		};
		target.invalidate(renderer);
		expect(told).toEqual([target.canvas]);
	});

	it("reads a video's size on every draw", () => {
		// a video reports 0x0 until its metadata loads, and uploads every frame
		const atlas = sheet();
		const video = { width: 0, height: 0, videoWidth: 0, videoHeight: 0 };
		atlas.sources.set("default", video);
		expect(Number.isFinite(atlas._quadUVs(video, 8, 16, 16, 32)[0])).toBe(
			false,
		);
		video.videoWidth = 64;
		video.videoHeight = 128;
		expect(Array.from(atlas._quadUVs(video, 8, 16, 16, 32))).toEqual([
			0.125, 0.125, 0.375, 0.375,
		]);
		video.videoWidth = 32;
		video.videoHeight = 64;
		expect(Array.from(atlas._quadUVs(video, 8, 16, 16, 32))).toEqual([
			0.25, 0.25, 0.75, 0.75,
		]);
	});

	it("reads an image's size once, and a canvas's again when it is refreshed", () => {
		const image = new Image();
		image.width = 32;
		image.height = 32;
		const atlas = new TextureAtlas(
			{ framewidth: 16, frameheight: 16 },
			image,
			false,
		);
		const width = vi.spyOn(image, "width", "get");
		for (let i = 0; i < 10; i++) {
			atlas._quadUVs(image, 4, 8, 8, 16);
		}
		expect(width.mock.calls.length).toBeLessThanOrEqual(1);
		width.mockRestore();

		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 32;
		const sheet = new TextureAtlas(
			{ framewidth: 16, frameheight: 16 },
			canvas,
			false,
		);
		const canvasWidth = vi.spyOn(canvas, "width", "get");
		for (let i = 0; i < 10; i++) {
			expect(Array.from(sheet._quadUVs(canvas, 4, 8, 8, 16))).toEqual([
				0.125, 0.25, 0.375, 0.75,
			]);
		}
		expect(canvasWidth.mock.calls.length).toBeLessThanOrEqual(1);
		canvasWidth.mockRestore();
		// resized but not refreshed: the GPU still holds the old 32 pixels,
		// and the old size is the one that samples them
		canvas.width = 64;
		expect(Array.from(sheet._quadUVs(canvas, 4, 8, 8, 16))).toEqual([
			0.125, 0.25, 0.375, 0.75,
		]);
		// refreshed, as `CanvasRenderTarget#invalidate` does through the cache
		sheet._sizeChanged();
		expect(Array.from(sheet._quadUVs(canvas, 4, 8, 8, 16))).toEqual([
			0.0625, 0.25, 0.1875, 0.75,
		]);
	});

	it("keeps reading an image's size until it has one", () => {
		// an image drawn before it has loaded reports 0x0
		const image = new Image();
		const atlas = new TextureAtlas(
			{ framewidth: 16, frameheight: 16 },
			{ width: 32, height: 32 },
			false,
		);
		atlas.sources.set("default", image);
		// no size yet: no usable UVs, as before
		expect(atlas._quadUVs(image, 4, 8, 8, 16)[0]).toBeNaN();
		image.width = 32;
		image.height = 32;
		expect(Array.from(atlas._quadUVs(image, 4, 8, 8, 16))).toEqual([
			0.125, 0.25, 0.375, 0.75,
		]);
	});

	it("reads the size again when another image is drawn from", () => {
		const small = new Image();
		small.width = small.height = 32;
		const large = new Image();
		large.width = large.height = 64;
		const atlas = new TextureAtlas(
			{ framewidth: 16, frameheight: 16 },
			small,
			false,
		);
		expect(atlas._quadUVs(small, 8, 8, 8, 8)[2]).toBe(0.5);
		atlas.sources.set("default", large);
		expect(atlas._quadUVs(large, 8, 8, 8, 8)[2]).toBe(0.25);
		atlas.sources.set("default", small);
		expect(atlas._quadUVs(small, 8, 8, 8, 8)[2]).toBe(0.5);
	});

	it("decides again when it switches between pages that share one image", () => {
		// what `new TextureAtlas([file0, file1], image)` gives every page: one
		// image, already sized, so only the page tells the decisions apart
		const image = new Image();
		image.width = image.height = 32;
		const atlas = new TextureAtlas(
			{ framewidth: 16, frameheight: 16 },
			image,
			false,
		);
		atlas.sources.set("second", image);
		atlas.atlases.set("second", {});
		const page = atlas.getAtlas("second");
		page.f = {
			name: "f",
			offset: { x: 0, y: 0 },
			width: 8,
			height: 8,
			angle: 0,
		};
		atlas.addUVs(page, "f", 64, 64);
		expect(atlas._quadUVs(image, 0, 0, 8, 8)).not.toBe(page.f.uvs);
		atlas.activeAtlas = "second";
		expect(atlas._quadUVs(image, 0, 0, 8, 8)).toBe(page.f.uvs);
		atlas.activeAtlas = "default";
		expect(atlas._quadUVs(image, 0, 0, 8, 8)).not.toBe(page.f.uvs);
	});

	it("decides again when it draws from another page of the same size", () => {
		// both images 32x32, so only the page tells the two decisions apart
		const atlas = sheet();
		atlas.sources.set("half", { width: 32, height: 32 });
		atlas.atlases.set("half", {});
		const page = atlas.getAtlas("half");
		page.f = {
			name: "f",
			offset: { x: 0, y: 0 },
			width: 8,
			height: 8,
			angle: 0,
		};
		// normalized by 64 on a 32 image: this page needs the frame's own UVs
		atlas.addUVs(page, "f", 64, 64);
		const own = page.f.uvs;
		expect(atlas._quadUVs(atlas.getTexture(), 0, 0, 8, 8)).not.toBe(own);
		atlas.activeAtlas = "half";
		expect(atlas._quadUVs(atlas.getTexture(), 0, 0, 8, 8)).toBe(own);
		atlas.activeAtlas = "default";
		expect(atlas._quadUVs(atlas.getTexture(), 0, 0, 8, 8)).not.toBe(own);
	});

	it("keeps a frame's own UVs when it was normalized by another size than the rest of its page", () => {
		const atlas = sheet();
		const page = atlas.getAtlas();
		page.odd = {
			name: "odd",
			offset: { x: 0, y: 0 },
			width: 8,
			height: 8,
			angle: 0,
		};
		const source = atlas.getTexture();
		// decided before the odd frame exists: every UV computed
		expect(Array.from(atlas._quadUVs(source, 0, 0, 8, 8))).toEqual([
			0, 0, 0.25, 0.25,
		]);
		atlas.addUVs(page, "odd", 64, 64);
		expect(Array.from(page.odd.uvs)).toEqual([0, 0, 0.125, 0.125]);
		expect(atlas._quadUVs(source, 0, 0, 8, 8)).toBe(page.odd.uvs);
	});

	it("throws for a name that is not a region, coordinates included", () => {
		const atlas = sheet();
		const names = Object.keys(atlas.getAtlas());
		expect(() => {
			return atlas.getUVs("missing");
		}).toThrow(/region.*missing.*not found/i);
		// a source rectangle is passed as numbers: a "x,y,w,h" string is
		// a name like any other
		expect(() => {
			return atlas.getUVs("4,8,8,16");
		}).toThrow(/region.*4,8,8,16.*not found/i);
		expect(() => {
			return atlas.getUVs("16,0,16,16");
		}).toThrow(/not found/i);
		expect(Object.keys(atlas.getAtlas())).toEqual(names);
	});

	it("keeps an explicitly named coordinate string distinct from a numeric rectangle", () => {
		const atlas = sheet();
		const named = atlas.addRegion("4,8,8,16", 0, 0, 32, 32);
		expect(atlas.getUVs("4,8,8,16")).toBe(named.uvs);
		expect(Array.from(atlas.getUVs(4, 8, 8, 16))).toEqual([
			0.125, 0.25, 0.375, 0.75,
		]);
		expect(atlas.getRegion("4,8,8,16")).toBe(named);
	});

	it("scopes identical source rectangles to the active atlas page", () => {
		const atlas = sheet();
		atlas.sources.set("large", { width: 64, height: 64 });
		atlas.atlases.set("large", {});
		const small = atlas.getUVs(0, 0, 16, 16);
		atlas.activeAtlas = "large";
		const large = atlas.getUVs(0, 0, 16, 16);
		expect(Array.from(large)).toEqual([0, 0, 0.25, 0.25]);
		expect(large).not.toBe(small);
		atlas.activeAtlas = "default";
		expect(atlas.getUVs(0, 0, 16, 16)).toBe(small);
		expect(Object.keys(atlas.getAtlas("large"))).toEqual([]);
	});

	it("returns a region's UVs once addRegion names that rectangle", () => {
		const atlas = sheet();
		const previous = atlas.getUVs(4, 8, 8, 16);
		const region = atlas.addRegion("clip", 4, 8, 8, 16);
		expect(atlas.getUVs(4, 8, 8, 16)).toBe(region.uvs);
		expect(region.uvs).not.toBe(previous);
	});

	it("matches a recomputation that remembers nothing, through resizes, swapped images, page switches and new regions", () => {
		let seed = 1734;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed / 0x7fffffff;
		};
		const pick = (list) => {
			return list[Math.floor(rand() * list.length)];
		};
		const pageFile = (image, w, h, count) => {
			const frames = [];
			for (let i = 0; i < count; i++) {
				const fw = 4 + (i % 5);
				const fh = 3 + (i % 4);
				frames.push({
					filename: image + i,
					frame: { x: (i * 13) % (w - 8), y: (i * 7) % (h - 8), w: fw, h: fh },
					rotated: i % 4 === 0,
					trimmed: false,
					spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
					sourceSize: { w: fw, h: fh },
				});
			}
			return { meta: { app: "texturepacker", image, size: { w, h } }, frames };
		};
		const atlas = new TextureAtlas(
			[pageFile("a.png", 64, 32, 12), pageFile("b.png", 48, 48, 9)],
			{ width: 64, height: 32 },
			false,
		);
		atlas.sources.set("b.png", { width: 48, height: 48 });
		const fileSize = { "a.png": [64, 32], "b.png": [48, 48] };

		// what the test itself knows of every frame: its rectangle, its UVs,
		// and the size those were normalized by
		const known = new Map();
		for (const [page, dict] of atlas.atlases) {
			known.set(
				page,
				Object.values(dict).map((r) => {
					return {
						x: r.offset.x,
						y: r.offset.y,
						w: r.width,
						h: r.height,
						uvs: r.uvs,
						nw: fileSize[page][0],
						nh: fileSize[page][1],
					};
				}),
			);
		}
		const sizeOf = (source) => {
			return [
				source.width || source.videoWidth,
				source.height || source.videoHeight,
			];
		};
		const own = (x, y, w, h) => {
			return known.get(atlas.activeAtlas).findLast((f) => {
				return f.x === x && f.y === y && f.w === w && f.h === h;
			});
		};
		const computedUVs = (x, y, w, h) => {
			const [W, H] = sizeOf(atlas.getTexture());
			return Array.from(
				Float32Array.of(x / W, y / H, (x + w) / W, (y + h) / H),
			);
		};
		// a draw: the frame's own UVs only on a page where some frame was
		// normalized by another size than the image has now
		const drawn = (x, y, w, h) => {
			const [W, H] = sizeOf(atlas.getTexture());
			const frame = own(x, y, w, h);
			const computed = known.get(atlas.activeAtlas).every((f) => {
				return f.nw === W && f.nh === H;
			});
			return !computed && frame
				? Array.from(frame.uvs)
				: computedUVs(x, y, w, h);
		};
		// the public lookup: a frame's own UVs whenever there is one
		const looked = (x, y, w, h) => {
			const frame = own(x, y, w, h);
			return frame ? Array.from(frame.uvs) : computedUVs(x, y, w, h);
		};

		let regions = 0;
		let draws = 0;
		for (let step = 0; step < 3000; step++) {
			const r = rand();
			const page = atlas.activeAtlas;
			const source = atlas.getTexture();
			if (r < 0.55) {
				const frames = known.get(page);
				const [W, H] = sizeOf(source);
				const rect =
					rand() < 0.5 && frames.length > 0
						? (({ x, y, w, h }) => {
								return [x, y, w, h];
							})(pick(frames))
						: [
								Math.floor(rand() * (W || 32)),
								Math.floor(rand() * (H || 32)),
								1 + Math.floor(rand() * 9),
								rand() < 0.3 ? 2.5 : 1 + Math.floor(rand() * 9),
							];
				// draw the same rectangle a few times running, as a particle
				// system or a tile run does
				for (let n = 0, runs = 1 + Math.floor(rand() * 3); n < runs; n++) {
					draws++;
					expect(Array.from(atlas._quadUVs(source, ...rect))).toEqual(
						drawn(...rect),
					);
				}
				if (rand() < 0.3) {
					expect(Array.from(atlas.getUVs(...rect))).toEqual(looked(...rect));
				}
			} else if (r < 0.65) {
				// the image changes size: half, the file's size, double, or a
				// video that reports 0x0 until its metadata loads. A video is
				// read on every draw; anything else is told, the way a canvas
				// render target's invalidate() tells it
				const [fw, fh] = fileSize[page];
				const [w, h] = pick([
					[fw / 2, fh / 2],
					[fw, fh],
					[fw * 2, fh * 2],
					[fw, fh * 2],
					[fw * 2, fh],
				]);
				if (rand() < 0.2) {
					// a video takes the page over, 0x0 apart from its intrinsic size
					atlas.sources.set(page, {
						width: 0,
						height: 0,
						videoWidth: w,
						videoHeight: h,
					});
				} else if (typeof source.videoWidth === "number") {
					source.videoWidth = w;
					source.videoHeight = h;
				} else {
					source.width = w;
					source.height = h;
					atlas._sizeChanged();
				}
			} else if (r < 0.72) {
				// the page's image is replaced by another object
				const [fw, fh] = fileSize[page];
				const scale = pick([0.5, 1, 2]);
				atlas.sources.set(page, { width: fw * scale, height: fh * scale });
			} else if (r < 0.87) {
				atlas.activeAtlas = pick(["a.png", "b.png"]);
			} else if (r < 0.95) {
				// a region named on the page, sometimes over an existing
				// frame's rectangle, normalized by the image's current size
				const frames = known.get(page);
				const [W, H] = sizeOf(source);
				const [x, y, w, h] =
					rand() < 0.4
						? (({ x, y, w, h }) => {
								return [x, y, w, h];
							})(pick(frames))
						: [
								Math.floor(rand() * 20),
								Math.floor(rand() * 20),
								2 + Math.floor(rand() * 6),
								2 + Math.floor(rand() * 6),
							];
				const region = atlas.addRegion("region" + regions++, x, y, w, h);
				frames.push({ x, y, w, h, uvs: region.uvs, nw: W, nh: H });
			} else {
				// a frame normalized by a size of its own
				const dict = atlas.getAtlas();
				const name = "odd" + regions++;
				const [x, y, w, h] = [
					Math.floor(rand() * 20),
					Math.floor(rand() * 20),
					3,
					5,
				];
				dict[name] = { name, offset: { x, y }, width: w, height: h, angle: 0 };
				const nw = pick([16, 100]);
				atlas.addUVs(dict, name, nw, nw);
				known.get(page).push({ x, y, w, h, uvs: dict[name].uvs, nw, nh: nw });
			}
		}
		expect(draws).toBeGreaterThan(2000);
	});

	it("uses intrinsic video dimensions for anonymous numeric rectangles", () => {
		const atlas = sheet();
		atlas.sources.set("default", {
			width: 0,
			height: 0,
			videoWidth: 64,
			videoHeight: 128,
		});
		expect(Array.from(atlas.getUVs(8, 16, 16, 32))).toEqual([
			0.125, 0.125, 0.375, 0.375,
		]);
	});
});

describe.each([
	["WebGL", WebGLRenderer],
	["WebGPU", WebGPURenderer],
])("%s pattern UV consumer", (_name, Renderer) => {
	it("computes the pattern's UVs from its size, repeat coordinates included", () => {
		const pattern = sheet();
		const quadUVs = vi.spyOn(pattern, "_quadUVs");
		const getUVs = vi.spyOn(pattern, "getUVs");
		const batcher = { addQuad: vi.fn() };
		const renderer = {
			currentBatcher: batcher,
			setBatcher: vi.fn(),
			currentTint: {
				toUint32: () => {
					return 0xffffffff;
				},
			},
			getGlobalAlpha: () => {
				return 1;
			},
		};
		Renderer.prototype.drawPattern.call(renderer, pattern, 2, 3, 64, 96);
		expect(quadUVs).toHaveBeenCalledWith(pattern.getTexture(), 0, 0, 64, 96);
		// computed for the draw: the public lookup allocates a new array
		expect(getUVs).not.toHaveBeenCalled();
		expect(batcher.addQuad.mock.calls[0].slice(5, 9)).toEqual([0, 0, 2, 3]);
		expect(Object.keys(pattern.getAtlas())).toEqual(["0", "1", "2", "3"]);
	});
});

describe("WebGPU drawImage", () => {
	it("computes a source rectangle's UVs instead of looking them up", () => {
		const atlas = sheet();
		const getUVs = vi.spyOn(atlas, "getUVs");
		const added = [];
		const renderer = {
			settings: { subPixel: false },
			batchers: new Map(),
			customShader: undefined,
			activeLightCount: 0,
			currentNormalMap: null,
			frameId: 1,
			setBatcher() {
				this.currentBatcher = {
					addQuad(...args) {
						added.push(args);
					},
				};
				return this.currentBatcher;
			},
			cache: {
				get() {
					return atlas;
				},
			},
			currentTint: new Color(255, 255, 255, 1),
			getGlobalAlpha() {
				return 1;
			},
		};
		WebGPURenderer.prototype.drawImage.call(
			renderer,
			{ width: 32, height: 32 },
			4,
			8,
			8,
			16,
			0,
			0,
			8,
			16,
		);
		expect(getUVs).not.toHaveBeenCalled();
		expect(added[0].slice(5, 9)).toEqual([0.125, 0.25, 0.375, 0.75]);
	});
});

describe("WebGL source rectangles and repeating patterns", () => {
	let app;
	let renderer;
	let image;
	beforeAll(async () => {
		await boot();
		app = new Application(32, 32, {
			parent: "screen",
			renderer: video.WEBGL,
			antiAlias: false,
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
		renderer = app.renderer;
		expect(renderer).toBeInstanceOf(WebGLRenderer);
		const projection = new Matrix3d();
		projection.ortho(0, 32, 32, 0, -1000, 1000);
		renderer.setProjection(projection);
		image = document.createElement("canvas");
		image.width = image.height = 8;
		const ctx = image.getContext("2d");
		ctx.fillStyle = "red";
		ctx.fillRect(0, 0, 4, 8);
		ctx.fillStyle = "blue";
		ctx.fillRect(4, 0, 4, 8);
	});
	afterAll(() => {
		return app?.destroy();
	});

	it("draws cropped pixels without adding animation frames", async () => {
		const atlas = renderer.cache.get(image);
		const names = Object.keys(atlas.getAtlas());
		const getUVs = vi.spyOn(atlas, "getUVs");
		const quadUVs = vi.spyOn(atlas, "_quadUVs");
		renderer.clearColor("black");
		renderer.drawImage(image, 4, 0, 4, 8, 0, 0, 16, 16);
		expect(await readPixel(renderer, 8, 8)).toEqual([0, 0, 255, 255]);
		expect(Object.keys(atlas.getAtlas())).toEqual(names);
		// computed for the draw, not looked up or allocated
		expect(quadUVs).toHaveBeenCalledWith(image, 4, 0, 4, 8);
		expect(getUVs).not.toHaveBeenCalled();
		getUVs.mockRestore();
		quadUVs.mockRestore();
	});

	it("repeats the full image without adding pattern-sized regions", async () => {
		const pattern = renderer.createPattern(image, "repeat");
		const names = Object.keys(pattern.getAtlas());
		renderer.clearColor("black");
		renderer.drawPattern(pattern, 0, 0, 24, 24);
		expect(await readPixel(renderer, 1, 4)).toEqual([255, 0, 0, 255]);
		expect(await readPixel(renderer, 5, 4)).toEqual([0, 0, 255, 255]);
		expect(await readPixel(renderer, 9, 4)).toEqual([255, 0, 0, 255]);
		expect(Object.keys(pattern.getAtlas())).toEqual(names);
	});

	it("draws a canvas that grows, whole and cropped, and its atlas gains nothing", async () => {
		// what Text does with its canvas: one atlas for the canvas, which is
		// resized and re-uploaded in place as the string gets longer
		const target = new CanvasRenderTarget(8, 8);
		const paint = (colors) => {
			const ctx = target.context;
			const w = target.width / colors.length;
			colors.forEach((color, i) => {
				ctx.fillStyle = color;
				ctx.fillRect(i * w, 0, w, target.height);
			});
		};
		paint(["red", "blue"]);
		renderer.clearColor("black");
		renderer.drawImage(target.canvas, 0, 0);
		expect(await readPixel(renderer, 6, 4)).toEqual([0, 0, 255, 255]);
		const atlas = renderer.cache.get(target.canvas);
		const names = Object.keys(atlas.getAtlas());

		target.resize(16, 8);
		paint(["red", "blue", "lime", "yellow"]);
		target.invalidate(renderer);
		renderer.clearColor("black");
		renderer.drawImage(target.canvas, 0, 0);
		expect(await readPixel(renderer, 2, 4)).toEqual([255, 0, 0, 255]);
		expect(await readPixel(renderer, 14, 4)).toEqual([255, 255, 0, 255]);
		// a crop of the grown canvas, then the old full size as a crop
		renderer.drawImage(target.canvas, 8, 0, 4, 8, 0, 16, 8, 8);
		expect(await readPixel(renderer, 4, 20)).toEqual([0, 255, 0, 255]);
		renderer.drawImage(target.canvas, 4, 0, 8, 8, 16, 16, 8, 8);
		expect(await readPixel(renderer, 17, 20)).toEqual([0, 0, 255, 255]);
		expect(await readPixel(renderer, 22, 20)).toEqual([0, 255, 0, 255]);

		target.resize(32, 8);
		paint(["red", "blue", "lime", "yellow"]);
		target.invalidate(renderer);
		renderer.clearColor("black");
		renderer.drawImage(target.canvas, 0, 0);
		expect(await readPixel(renderer, 4, 4)).toEqual([255, 0, 0, 255]);
		expect(await readPixel(renderer, 28, 4)).toEqual([255, 255, 0, 255]);
		expect(Object.keys(atlas.getAtlas())).toEqual(names);
		renderer.cache.delete(target.canvas);
		target.destroy(renderer);
	});

	it("tells every atlas drawn from an image that its size changed", () => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 32;
		// two atlases over one canvas: the cache's own, and a sprite sheet
		const own = renderer.cache.get(canvas);
		const sheet = new TextureAtlas({ framewidth: 16, frameheight: 16 }, canvas);
		try {
			expect(own._quadUVs(canvas, 0, 0, 8, 8)[2]).toBe(0.25);
			expect(sheet._quadUVs(canvas, 0, 0, 8, 8)[2]).toBe(0.25);
			canvas.width = canvas.height = 64;
			renderer.cache.sizeChanged(canvas);
			expect(own._quadUVs(canvas, 0, 0, 8, 8)[2]).toBe(0.125);
			expect(sheet._quadUVs(canvas, 0, 0, 8, 8)[2]).toBe(0.125);
		} finally {
			renderer.cache.delete(canvas);
		}
	});

	it("draws the same rectangle from pages of different sizes with each page's own UVs", async () => {
		const canvas = (size, colors) => {
			const c = document.createElement("canvas");
			c.width = c.height = size;
			const ctx = c.getContext("2d");
			colors.forEach((color, i) => {
				ctx.fillStyle = color;
				ctx.fillRect((i * size) / colors.length, 0, size / colors.length, size);
			});
			return c;
		};
		const small = canvas(8, ["red", "blue"]);
		const large = canvas(16, ["lime", "yellow"]);
		const file = (image, size) => {
			return {
				meta: { app: "texturepacker", image, size: { w: size, h: size } },
				frames: [
					{
						filename: image,
						frame: { x: 0, y: 0, w: size, h: size },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: size, h: size },
						sourceSize: { w: size, h: size },
					},
				],
			};
		};
		const atlas = new TextureAtlas(
			[file("small.png", 8), file("large.png", 16)],
			small,
			false,
		);
		atlas.sources.set("large.png", large);
		renderer.cache.set(small, atlas);
		renderer.cache.set(large, atlas);
		try {
			renderer.clearColor("black");
			// the same rectangle, x 4 to 8: the right half of the small page,
			// the left half of the large one
			renderer.drawImage(small, 4, 0, 4, 8, 0, 0, 8, 8);
			renderer.drawImage(large, 4, 0, 4, 8, 8, 0, 8, 8);
			renderer.drawImage(small, 4, 0, 4, 8, 16, 0, 8, 8);
			expect(await readPixel(renderer, 4, 4)).toEqual([0, 0, 255, 255]);
			expect(await readPixel(renderer, 12, 4)).toEqual([0, 255, 0, 255]);
			expect(await readPixel(renderer, 20, 4)).toEqual([0, 0, 255, 255]);
		} finally {
			renderer.cache.delete(small);
			renderer.cache.delete(large);
		}
	});

	it("draws bitmap text glyphs, at any size, without a region per glyph", async () => {
		const font = document.createElement("canvas");
		font.width = 8;
		font.height = 4;
		const ctx = font.getContext("2d");
		ctx.fillStyle = "red";
		ctx.fillRect(0, 0, 4, 4);
		ctx.fillStyle = "blue";
		ctx.fillRect(4, 0, 4, 4);
		const fontData = `info face="uv-test" size=4 padding=0,0,0,0 spacing=0,0
common lineHeight=6 base=4 scaleW=8 scaleH=4 pages=1 packed=0
page id=0 file="uv-test.png"
chars count=2
char id=65 x=0 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=5 page=0 chnl=15
char id=66 x=4 y=0 width=4 height=4 xoffset=0 yoffset=0 xadvance=5 page=0 chnl=15`;
		const colors = { 65: [255, 0, 0, 255], 66: [0, 0, 255, 255] };
		// one string per size, each fitting the 32 pixel canvas
		for (const [size, string] of [
			[1, "ABBA"],
			[2, "ABA"],
		]) {
			const text = new BitmapText(2, 2, {
				font,
				fontData,
				text: string,
				size,
				textBaseline: "top",
			});
			const draw = vi.spyOn(renderer, "drawImage");
			renderer.clearColor("black");
			text.draw(renderer);
			const glyphs = draw.mock.calls.slice();
			draw.mockRestore();
			expect(glyphs).toHaveLength(string.length);
			const atlas = renderer.cache.get(font);
			expect(Object.keys(atlas.getAtlas())).toHaveLength(1);
			for (const [i, call] of glyphs.entries()) {
				const [, sx, , , , dx, dy, dw, dh] = call;
				const glyph = string.charCodeAt(i);
				expect(sx).toBe(glyph === 65 ? 0 : 4);
				expect(await readPixel(renderer, dx + dw / 2, dy + dh / 2)).toEqual(
					colors[glyph],
				);
			}
			text.destroy();
		}
		renderer.cache.delete(font);
	});

	it("builds a sprite's animation from the authored frames only, after crops of its sheet were drawn", () => {
		const image = document.createElement("canvas");
		image.width = 16;
		image.height = 8;
		const atlas = new TextureAtlas({ framewidth: 8, frameheight: 8 }, image);
		try {
			expect(renderer.cache.get(image)).toBe(atlas);
			renderer.drawImage(image, 1, 1, 3, 3, 0, 0, 3, 3);
			renderer.drawImage(image, 0, 0, 16, 8, 0, 0, 16, 8);
			renderer.drawImage(image, 2.5, 0, 4, 4, 0, 0, 4, 4);
			expect(Object.keys(atlas.getAtlas())).toEqual(["0", "1"]);
			// every frame of the atlas, the way a sheet with no names is
			// animated: the crops drawn above must not be among them, nor
			// widen the sprite to the 16 pixel crop
			const sprite = atlas.createAnimationFromName();
			expect(sprite.textureAtlas).toHaveLength(2);
			expect(sprite.width).toBe(8);
			expect(sprite.height).toBe(8);
			sprite.destroy();
		} finally {
			renderer.cache.delete(image);
		}
	});

	it("draws an image, whole and cropped", async () => {
		const canvas = document.createElement("canvas");
		canvas.width = 8;
		canvas.height = 8;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "red";
		ctx.fillRect(0, 0, 4, 8);
		ctx.fillStyle = "lime";
		ctx.fillRect(4, 0, 4, 8);
		const image = new Image();
		image.src = canvas.toDataURL();
		await image.decode();
		try {
			renderer.clearColor("black");
			renderer.drawImage(image, 0, 0, 8, 8, 0, 0, 8, 8);
			renderer.drawImage(image, 4, 0, 4, 8, 8, 0, 8, 8);
			renderer.drawImage(image, 0, 0, 4, 8, 16, 0, 8, 8);
			expect(await readPixel(renderer, 1, 4)).toEqual([255, 0, 0, 255]);
			expect(await readPixel(renderer, 6, 4)).toEqual([0, 255, 0, 255]);
			expect(await readPixel(renderer, 12, 4)).toEqual([0, 255, 0, 255]);
			expect(await readPixel(renderer, 20, 4)).toEqual([255, 0, 0, 255]);
			expect(Object.keys(renderer.cache.get(image).getAtlas())).toHaveLength(1);
		} finally {
			renderer.cache.delete(image);
		}
	});

	it("draws a Text whose canvas grows, with one region on its atlas throughout", () => {
		const text = new Text(0, 0, { font: "Arial", size: 8, text: "A" });
		try {
			text.draw(renderer);
			const canvas = text.canvasTexture.canvas;
			const atlas = renderer.cache.get(canvas);
			const names = Object.keys(atlas.getAtlas());
			const widths = [canvas.width];
			for (const string of [
				"A longer line",
				"A much, much longer line of text",
			]) {
				text.setText(string);
				text.draw(renderer);
				widths.push(canvas.width);
			}
			// the canvas did grow, and the atlas still holds its one region
			expect(widths[2]).toBeGreaterThan(widths[0]);
			expect(Object.keys(atlas.getAtlas())).toEqual(names);
			expect(
				Array.from(atlas._quadUVs(canvas, 0, 0, canvas.width, canvas.height)),
			).toEqual([0, 0, 1, 1]);
		} finally {
			text.destroy();
		}
	});
});
