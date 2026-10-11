import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Matrix3d,
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

	it("reuses precomputed frame UVs and caches alternating arbitrary rectangles", () => {
		const atlas = sheet();
		expect(atlas.getUVs(16, 0, 16, 16)).toBe(atlas.getRegion("1").uvs);
		const first = atlas.getUVs(4, 8, 8, 16);
		const second = atlas.getUVs(8, 4, 16, 8);
		expect(atlas.getUVs(4, 8, 8, 16)).toBe(first);
		expect(atlas.getUVs(8, 4, 16, 8)).toBe(second);
		expect(Array.from(first)).toEqual([0.125, 0.25, 0.375, 0.75]);
	});

	it("rejects missing names and coordinate strings without creating regions", () => {
		const atlas = sheet();
		const names = Object.keys(atlas.getAtlas());
		expect(() => {
			return atlas.getUVs("missing");
		}).toThrow(/region.*missing.*not found/i);
		expect(() => {
			return atlas.getUVs("4,8,8,16");
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

	it("refreshes a cached rectangle when addRegion supplies precomputed UVs", () => {
		const atlas = sheet();
		const previous = atlas.getUVs(4, 8, 8, 16);
		const region = atlas.addRegion("clip", 4, 8, 8, 16);
		expect(atlas.getUVs(4, 8, 8, 16)).toBe(region.uvs);
		expect(region.uvs).not.toBe(previous);
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
	it("uses numeric UV lookup while preserving repeat coordinates", () => {
		const pattern = sheet();
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
		expect(getUVs).toHaveBeenCalledWith(0, 0, 64, 96);
		expect(batcher.addQuad.mock.calls[0].slice(5, 9)).toEqual([0, 0, 2, 3]);
		expect(Object.keys(pattern.getAtlas())).toEqual(["0", "1", "2", "3"]);
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
		renderer.clearColor("black");
		renderer.drawImage(image, 4, 0, 4, 8, 0, 0, 16, 16);
		expect(await readPixel(renderer, 8, 8)).toEqual([0, 0, 255, 255]);
		expect(Object.keys(atlas.getAtlas())).toEqual(names);
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
});
