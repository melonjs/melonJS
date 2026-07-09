import { afterEach, describe, expect, it, vi } from "vitest";
import { TextureAtlas } from "../src/index.js";
import { ETA } from "../src/math/math.ts";

/**
 * Regression tests for the 2026-07 batchers + texture-cache bug hunt,
 * atlas/parser cluster. Every atlas here is constructed with the legacy
 * `cache = false` third argument so no renderer/boot is required — all of
 * the code under test is pure JS (parsers, UV math, dictionary handling).
 */

// a standard aseprite JSON export (hash form): `trimmed`, `spriteSourceSize`,
// `sourceSize`, `rotated`, `duration` and `pivot` are SIBLINGS of the `frame`
// rect on each frames[name] entry — NOT properties of the rect itself.
const makeAsepriteJSON = () => {
	return {
		frames: {
			"hero 0.png": {
				frame: { x: 0, y: 0, w: 28, h: 30 },
				rotated: false,
				trimmed: true,
				spriteSourceSize: { x: 2, y: 1, w: 28, h: 30 },
				sourceSize: { w: 32, h: 32 },
				duration: 100,
			},
			"hero 1.png": {
				frame: { x: 28, y: 0, w: 32, h: 32 },
				rotated: false,
				trimmed: false,
				spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
				sourceSize: { w: 32, h: 32 },
				pivot: { x: 0.5, y: 1 },
				duration: 200,
			},
			"hero 2.png": {
				frame: { x: 60, y: 0, w: 32, h: 32 },
				rotated: true,
				trimmed: false,
				spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
				sourceSize: { w: 32, h: 32 },
				duration: 300,
			},
		},
		meta: {
			app: "https://www.aseprite.org/",
			image: "hero.png",
			size: { w: 128, h: 64 },
			frameTags: [{ name: "walk", from: 0, to: 2, direction: "forward" }],
		},
	};
};

const fakeImage = (width, height, src = "fake.png") => {
	return { width, height, src };
};

describe("aseprite texture parser", () => {
	it("reads trim data from the frame entry (not the frame rect)", () => {
		const atlas = new TextureAtlas(
			makeAsepriteJSON(),
			fakeImage(128, 64),
			false,
		);
		const region = atlas.getRegion("hero 0.png");
		expect(region.trimmed).toBe(true);
		expect(region.trim).toEqual({ x: 2, y: 1, w: 28, h: 30 });
	});

	it("exposes sourceSize so animation sizing uses the untrimmed frame", () => {
		const atlas = new TextureAtlas(
			makeAsepriteJSON(),
			fakeImage(128, 64),
			false,
		);
		const region = atlas.getRegion("hero 0.png");
		expect(region.sourceSize).toEqual({ w: 32, h: 32 });
		// trimmed cell keeps its packed dimensions
		expect(region.width).toBe(28);
		expect(region.height).toBe(30);
	});

	it("computes the anchorPoint from a frame-level pivot", () => {
		const atlas = new TextureAtlas(
			makeAsepriteJSON(),
			fakeImage(128, 64),
			false,
		);
		const region = atlas.getRegion("hero 1.png");
		expect(region.anchorPoint).not.toBe(null);
		expect(region.anchorPoint.x).toBeCloseTo(0.5);
		expect(region.anchorPoint.y).toBeCloseTo(1);
	});

	it("honors the frame-level rotated flag", () => {
		const atlas = new TextureAtlas(
			makeAsepriteJSON(),
			fakeImage(128, 64),
			false,
		);
		expect(atlas.getRegion("hero 2.png").angle).toBe(-ETA);
		expect(atlas.getRegion("hero 0.png").angle).toBe(0);
	});

	it("builds animations from the authored per-frame durations", () => {
		const atlas = new TextureAtlas(
			makeAsepriteJSON(),
			fakeImage(128, 64),
			false,
		);
		const anims = atlas.getAtlas().anims;
		const walk = Object.values(anims).find((a) => {
			return a.name === "walk";
		});
		expect(walk).toBeDefined();
		// index entries are frame objects carrying each frame's own delay,
		// straight from the JSON's `duration` values
		expect(walk.index).toEqual([
			{ name: 0, delay: 100 },
			{ name: 1, delay: 200 },
			{ name: 2, delay: 300 },
		]);
		// no synthesized flat speed overriding the per-frame delays
		expect(walk.speed).toBeUndefined();
	});
});

describe("no-arg atlas iteration (getAnimationSettings)", () => {
	it("iterates real frames only — no coordinate aliases, no anims entry", () => {
		const atlas = new TextureAtlas(
			makeAsepriteJSON(),
			fakeImage(128, 64),
			false,
		);
		const settings = atlas.getAnimationSettings();
		// one entry per actual frame — aliases would double it, the aseprite
		// `anims` dict would add a bogus NaN-sized region
		expect(settings.atlas.length).toBe(3);
		expect(Object.keys(settings.atlasIndices).sort()).toEqual([
			"hero 0.png",
			"hero 1.png",
			"hero 2.png",
		]);
		expect(Number.isNaN(settings.framewidth)).toBe(false);
		expect(settings.framewidth).toBe(32);
		expect(settings.frameheight).toBe(32);
	});
});

describe("UV coordinate-alias cache (#1281 workaround)", () => {
	it("a full-image lookup is not poisoned by a frame at (0,0)", () => {
		const atlas = new TextureAtlas(
			{ framewidth: 32, frameheight: 32 },
			fakeImage(64, 64, "sheet.png"),
			false,
		);
		// frame 0 sits at (0,0,32,32); asking for the WHOLE image must not
		// return frame 0's UVs
		const uvs = atlas.getUVs(0, 0, 64, 64);
		expect(Array.from(uvs)).toEqual([0, 0, 1, 1]);
	});

	it("a sub-region lookup hits the alias instead of duplicating the region", () => {
		const atlas = new TextureAtlas(
			{ framewidth: 32, frameheight: 32 },
			fakeImage(64, 64, "sheet.png"),
			false,
		);
		const frame1uvs = atlas.getAtlas()["1"].uvs;
		// frame "1" is at (32,0,32,32) — the coordinate lookup must resolve
		// to the SAME uvs array (cache hit), not an ad-hoc duplicate region
		expect(atlas.getUVs(32, 0, 32, 32)).toBe(frame1uvs);
	});
});

describe("addRegion on a video source", () => {
	it("falls back to videoWidth/videoHeight for the UV divisor", () => {
		// an unsized HTMLVideoElement reports width/height = 0; its real
		// pixel dimensions are videoWidth/videoHeight
		const videoLike = {
			width: 0,
			height: 0,
			videoWidth: 320,
			videoHeight: 240,
		};
		const atlas = new TextureAtlas(
			{
				meta: { app: "melonJS", size: { w: 320, h: 240 } },
				frames: [
					{ filename: "default", frame: { x: 0, y: 0, w: 320, h: 240 } },
				],
			},
			videoLike,
			false,
		);
		const region = atlas.addRegion("clip", 0, 0, 64, 48);
		expect(region.uvs[2]).toBeCloseTo(64 / 320);
		expect(region.uvs[3]).toBeCloseTo(48 / 240);
		for (const v of region.uvs) {
			expect(Number.isFinite(v)).toBe(true);
		}
	});
});

describe("TextureAtlas format validation", () => {
	it("throws on an unrecognized atlas object instead of constructing empty", () => {
		expect(() => {
			return new TextureAtlas({ bogus: true }, fakeImage(1, 1), false);
		}).toThrow(/format not supported/);
	});
});

describe("spritesheet parser on a non-divisible (padded) sheet", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("computes UVs against the physical texture size, not the truncated grid", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		// 70x70 image of 32x32 cells: the frame grid truncates to 2x2, but the
		// GL texture is still uploaded at 70x70 — the UV divisor must match it
		const atlas = new TextureAtlas(
			{ framewidth: 32, frameheight: 32 },
			fakeImage(70, 70, "padded.png"),
			false,
		);
		expect(warn).toHaveBeenCalled();
		const frame0 = atlas.getAtlas()["0"];
		expect(frame0.uvs[2]).toBeCloseTo(32 / 70);
		expect(frame0.uvs[3]).toBeCloseTo(32 / 70);
		// second column starts at x=32 → u0 = 32/70
		const frame1 = atlas.getAtlas()["1"];
		expect(frame1.uvs[0]).toBeCloseTo(32 / 70);
	});
});
