import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Sprite, video } from "../src/index.js";

/**
 * Where a Sprite's `width` / `height` come from at construction.
 *
 * Written because the whole suite passed with `Sprite`'s width and height
 * SWAPPED: nothing asserted either one against the source image, nothing
 * asserted `current.width` at all, and the video branch's
 * `videoWidth`/`videoHeight` fallback was never reached because every video
 * spec passes an explicit `framewidth`. Three separate assignments in that
 * constructor had no coverage.
 *
 * Deliberately NON-SQUARE sizes throughout, so a transposition fails rather
 * than passing by symmetry.
 */

// 48x72, so width and height can never be confused
const ART_W = 48;
const ART_H = 72;

const makeImage = (w = ART_W, h = ART_H) => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	c.getContext("2d").fillRect(0, 0, w, h);
	return c;
};

// a detached <video> reports videoWidth 0, so the intrinsic size is stubbed
// as instance properties (shadowing the prototype), the same approach
// video-sprite.spec.js uses for the rVFC surface
const VID_W = 120;
const VID_H = 90;

const makeVideo = (w = VID_W, h = VID_H) => {
	const el = document.createElement("video");
	Object.defineProperty(el, "videoWidth", {
		get: () => {
			return w;
		},
		configurable: true,
	});
	Object.defineProperty(el, "videoHeight", {
		get: () => {
			return h;
		},
		configurable: true,
	});
	// the constructor reads these when wiring playback
	Object.defineProperty(el, "paused", {
		get: () => {
			return true;
		},
		configurable: true,
	});
	el.play = () => {
		return Promise.resolve();
	};
	el.pause = () => {};
	return el;
};

describe("Sprite frame sizing", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(64, 64, { parent: "screen", renderer: video.CANVAS });
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	describe("from a plain image", () => {
		it("takes its size from the image when no frame size is given", () => {
			const s = new Sprite(0, 0, { image: makeImage() });
			expect(s.width).toBe(ART_W);
			expect(s.height).toBe(ART_H);
		});

		it("tracks the frame size on `current`", () => {
			const s = new Sprite(0, 0, { image: makeImage() });
			expect(s.current.width).toBe(ART_W);
			expect(s.current.height).toBe(ART_H);
		});

		it("writes the resolved frame size back onto the settings object", () => {
			// callers read this back, and the atlas descriptor built further
			// down the constructor is keyed off it
			const settings = { image: makeImage() };
			const s = new Sprite(0, 0, settings);
			expect(s.width).toBe(ART_W);
			expect(settings.framewidth).toBe(ART_W);
			expect(settings.frameheight).toBe(ART_H);
		});

		it("an explicit frame size wins over the image size", () => {
			const s = new Sprite(0, 0, {
				image: makeImage(),
				framewidth: 16,
				frameheight: 24,
			});
			expect(s.width).toBe(16);
			expect(s.height).toBe(24);
			expect(s.current.width).toBe(16);
			expect(s.current.height).toBe(24);
		});

		it("one explicit dimension still falls back for the other", () => {
			const s = new Sprite(0, 0, { image: makeImage(), framewidth: 16 });
			expect(s.width).toBe(16);
			expect(s.height).toBe(ART_H);
		});

		it("is the only writer when no frame can be applied", () => {
			// The usual plain-image path writes `width` TWICE: once here in the
			// constructor, then again from `_applyFrame` once the default
			// animation selects a frame. That second write masks the first, so
			// breaking the constructor assignment is invisible in those cases.
			//
			// A frame LARGER than the sheet yields no usable grid, so
			// `addAnimation("default", null)` returns 0, no animation is set and
			// `_applyFrame` never runs. The constructor's assignment is then the
			// only one, which is what makes it observable here.
			const s = new Sprite(0, 0, {
				image: makeImage(),
				framewidth: 200,
				frameheight: 300,
			});
			expect(s.width).toBe(200);
			expect(s.height).toBe(300);
			expect(s.current.width).toBe(200);
			expect(s.current.height).toBe(300);
		});

		it("the size reaches the bounds, so it went through Rect's setter", () => {
			// `width` is an accessor on Rect whose setter recalcs the polygon;
			// a plain own property would shadow it and leave the bounds stale
			const s = new Sprite(0, 0, { image: makeImage() });
			expect(s.getBounds().width).toBe(ART_W);
			expect(s.getBounds().height).toBe(ART_H);
			expect(Object.getOwnPropertyDescriptor(s, "width")).toBeUndefined();
		});
	});

	describe("from a video element", () => {
		it("takes its size from videoWidth / videoHeight when none is given", () => {
			const s = new Sprite(0, 0, { image: makeVideo() });
			expect(s.width).toBe(VID_W);
			expect(s.height).toBe(VID_H);
		});

		it("tracks the video frame size on `current`", () => {
			const s = new Sprite(0, 0, { image: makeVideo() });
			expect(s.current.width).toBe(VID_W);
			expect(s.current.height).toBe(VID_H);
		});

		it("writes the resolved video size back onto the settings object", () => {
			const settings = { image: makeVideo() };
			const s = new Sprite(0, 0, settings);
			expect(s.width).toBe(VID_W);
			expect(settings.framewidth).toBe(VID_W);
			expect(settings.frameheight).toBe(VID_H);
		});

		it("an explicit frame size wins over the video size", () => {
			const s = new Sprite(0, 0, {
				image: makeVideo(),
				framewidth: 30,
				frameheight: 20,
			});
			expect(s.width).toBe(30);
			expect(s.height).toBe(20);
		});
	});
});
