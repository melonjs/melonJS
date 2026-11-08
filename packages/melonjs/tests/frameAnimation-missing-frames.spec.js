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
	Sprite,
	TextureAtlas,
	video,
} from "../src/index.js";

/**
 * `addAnimation` with a frame the texture does not have — an atlas re-exported
 * without one of its images, a frame number past the end of a sheet.
 *
 * A missing frame number used to be skipped but leave its slot empty while
 * the animation's length shrank: `[0, 99, 2]` played frame 0, then the empty
 * slot, and the next update read `undefined.delay` and threw. A missing frame
 * name was not checked at all: the frame had no region, so the sprite drew
 * nothing or garbage, with no word of why.
 *
 * A missing frame is now left out, the frames that exist play in order, and a
 * console warning names the animation and the missing frames.
 */

// a 128 x 32 sheet: four 32 x 32 frames, 0 to 3
const sheet = () => {
	const c = document.createElement("canvas");
	c.width = 128;
	c.height = 32;
	const ctx = c.getContext("2d");
	["#f00", "#0f0", "#00f", "#ff0"].forEach((colour, i) => {
		ctx.fillStyle = colour;
		ctx.fillRect(i * 32, 0, 32, 32);
	});
	return c;
};

// the same four frames as a named atlas: walk_0 to walk_3
const atlas = () => {
	const frames = [];
	for (let i = 0; i < 4; i++) {
		frames.push({
			filename: `walk_${i}`,
			frame: { x: i * 32, y: 0, w: 32, h: 32 },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
			sourceSize: { w: 32, h: 32 },
		});
	}
	return new TextureAtlas(
		{
			frames,
			meta: {
				app: "texturepacker",
				image: "missing-frames.png",
				size: { w: 128, h: 32 },
				scale: "1",
			},
		},
		sheet(),
	);
};

const sheetSprite = () => {
	return new Sprite(0, 0, {
		image: sheet(),
		framewidth: 32,
		frameheight: 32,
	});
};

const atlasSprite = () => {
	return atlas().createAnimationFromName([
		"walk_0",
		"walk_1",
		"walk_2",
		"walk_3",
	]);
};

// play the current animation for `n` frames, collecting each frame's name
const play = (sprite, n) => {
	const seen = [
		sprite.getAnimationFrameObjectByIndex(sprite.getCurrentAnimationFrame())
			.name,
	];
	for (let i = 1; i < n; i++) {
		sprite.update(100);
		seen.push(
			sprite.getAnimationFrameObjectByIndex(sprite.getCurrentAnimationFrame())
				.name,
		);
	}
	return seen;
};

describe("addAnimation with frames the texture does not have", () => {
	let app;
	let warn;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	afterEach(() => {
		warn?.mockRestore();
		warn = undefined;
	});

	describe("frame numbers, on a sprite sheet", () => {
		it("a missing frame in the middle is left out: the others play in order, without throwing", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const sprite = sheetSprite();
			expect(sprite.addAnimation("walk", [0, 99, 2])).toEqual(2);
			sprite.setCurrentAnimation("walk");
			expect(() => {
				play(sprite, 5);
			}).not.toThrow();
			expect(play(sprite, 4)).toEqual([0, 2, 0, 2]);
		});

		it("the animation's frames hold no empty slot", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const sprite = sheetSprite();
			sprite.addAnimation("walk", [99, 1, -1, 3]);
			const { frames, length } = sprite.anim.walk;
			expect(length).toEqual(2);
			expect(frames.length).toEqual(2);
			expect(
				frames.map((f) => {
					return f.name;
				}),
			).toEqual([1, 3]);
		});

		it("warns once, naming the animation and the missing frames", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			sheetSprite().addAnimation("walk", [0, 99, 2, 42]);
			expect(warn).toHaveBeenCalledTimes(1);
			const message = String(warn.mock.calls[0][0]);
			expect(message).toContain('"walk"');
			expect(message).toContain("99");
			expect(message).toContain("42");
		});

		it("an animation whose frames all exist does not warn", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const sprite = sheetSprite();
			expect(sprite.addAnimation("walk", [0, 1, 2, 3])).toEqual(4);
			expect(warn).not.toHaveBeenCalled();
		});
	});

	describe("frame names, on a texture atlas", () => {
		it("a missing name is left out: the others play in order", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const sprite = atlasSprite();
			expect(
				sprite.addAnimation("walk", ["walk_0", "walk_9", "walk_2"]),
			).toEqual(2);
			sprite.setCurrentAnimation("walk");
			expect(play(sprite, 4)).toEqual(["walk_0", "walk_2", "walk_0", "walk_2"]);
		});

		it("every frame kept has its region from the atlas", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const sprite = atlasSprite();
			sprite.addAnimation("walk", ["walk_1", "missing", "walk_3"]);
			const { frames } = sprite.anim.walk;
			expect(frames.length).toEqual(2);
			for (const frame of frames) {
				expect(frame.width).toEqual(32);
				expect(frame.height).toEqual(32);
				expect(frame.offset).toBeDefined();
			}
		});

		it("warns, naming the animation and the missing names", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			atlasSprite().addAnimation("run", ["walk_0", "walk_03.png"]);
			expect(warn).toHaveBeenCalledTimes(1);
			const message = String(warn.mock.calls[0][0]);
			expect(message).toContain('"run"');
			expect(message).toContain("walk_03.png");
		});

		it("a sprite cut from a named atlas makes its default animation without a warning", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			atlas().createSpriteFromName("walk_1");
			expect(warn).not.toHaveBeenCalled();
		});

		it("per-frame objects with a missing name are left out too", () => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const sprite = atlasSprite();
			expect(
				sprite.addAnimation("walk", [
					{ name: "walk_0", delay: 50 },
					{ name: "nope", delay: 50 },
					{ name: "walk_1", delay: 200 },
				]),
			).toEqual(2);
			expect(
				sprite.anim.walk.frames.map((f) => {
					return [f.name, f.delay];
				}),
			).toEqual([
				["walk_0", 50],
				["walk_1", 200],
			]);
		});
	});
});
