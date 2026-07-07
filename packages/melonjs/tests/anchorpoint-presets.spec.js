import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	BitmapText,
	boot,
	Collectable,
	Entity,
	ImageLayer,
	loader,
	Sprite,
	Sprite3d,
	Text,
	Vector2d,
	video,
} from "../src/index.js";

/**
 * The `settings.anchorPoint` contract, shared by every renderable that
 * consumes it: named presets ("bottom", "top-left", …) resolve identically
 * everywhere, `{x, y}` objects pass through untouched (full backward
 * compatibility), and invalid values are handled per-surface:
 *
 * - 2D classes (Sprite, Entity, Collectable, ImageLayer, Text, BitmapText):
 *   invalid values keep their legacy outcome — anchor (0, 0), previously via
 *   the silent `set(undefined, undefined)` path — but now log a console
 *   warning instead of hiding the mistake. NOTHING that constructs today may
 *   start throwing.
 * - Sprite3d (new API surface, nothing shipped): invalid values throw.
 */

// a FRESH image per construction: spritesheet atlases are cached per image
// and store the first construction's anchor as the shared per-frame pivot
// (pre-existing engine behavior), so sharing one image across cases would
// leak anchors between tests. A plain DOM canvas also avoids the deprecation
// warning of video.createCanvas, which would false-positive the warn spies.
const freshImage = () => {
	const c = document.createElement("canvas");
	c.width = 32;
	c.height = 32;
	return c;
};

beforeAll(async () => {
	boot();
	video.init(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	// BitmapText needs a real bitmap font
	await new Promise((resolve) => {
		loader.preload(
			[
				{ name: "xolo12", type: "image", src: "/data/fnt/xolo12.png" },
				{ name: "xolo12", type: "binary", src: "/data/fnt/xolo12.fnt" },
			],
			resolve,
		);
	});
});

// every consumer of settings.anchorPoint: factory + its no-anchor default
const CONSUMERS = [
	{
		name: "Sprite",
		make: (anchor) => {
			const settings = { image: freshImage() };
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new Sprite(0, 0, settings);
		},
		defaults: { x: 0.5, y: 0.5 },
		throws: false,
	},
	{
		name: "Entity",
		make: (anchor) => {
			const settings = {
				width: 32,
				height: 64,
				image: freshImage(),
				shapes: [],
			};
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new Entity(0, 0, settings);
		},
		defaults: { x: 0, y: 0 },
		throws: false,
	},
	{
		name: "Collectable",
		make: (anchor) => {
			const settings = {
				image: freshImage(),
				framewidth: 32,
				frameheight: 32,
				width: 32,
				height: 32,
			};
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new Collectable(0, 0, settings);
		},
		defaults: { x: 0, y: 0 },
		throws: false,
	},
	{
		name: "ImageLayer",
		make: (anchor) => {
			const settings = { image: freshImage() };
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new ImageLayer(0, 0, settings);
		},
		defaults: { x: 0, y: 0 },
		throws: false,
	},
	{
		name: "Text",
		make: (anchor) => {
			const settings = { font: "Arial", size: 16 };
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new Text(0, 0, settings);
		},
		defaults: { x: 0, y: 0 },
		throws: false,
	},
	{
		name: "BitmapText",
		make: (anchor) => {
			const settings = { font: "xolo12", size: 1, text: "A" };
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new BitmapText(0, 0, settings);
		},
		defaults: { x: 0, y: 0 },
		throws: false,
	},
	{
		name: "Sprite3d",
		make: (anchor) => {
			const settings = { image: freshImage(), width: 32, height: 32 };
			if (anchor !== undefined) {
				settings.anchorPoint = anchor;
			}
			return new Sprite3d(0, 0, settings);
		},
		defaults: { x: 0.5, y: 0.5 },
		throws: true,
	},
];

describe.each(CONSUMERS)("settings.anchorPoint on $name", ({
	make,
	defaults,
	throws,
}) => {
	it('resolves the "bottom" preset to (0.5, 1)', () => {
		const r = make("bottom");
		expect(r.anchorPoint.x).toBe(0.5);
		expect(r.anchorPoint.y).toBe(1);
	});

	it('resolves the "top-left" preset to (0, 0)', () => {
		const r = make("top-left");
		expect(r.anchorPoint.x).toBe(0);
		expect(r.anchorPoint.y).toBe(0);
	});

	it("a preset and its equivalent {x, y} object land identically", () => {
		const a = make("bottom");
		const b = make({ x: 0.5, y: 1 });
		expect(a.anchorPoint.x).toBe(b.anchorPoint.x);
		expect(a.anchorPoint.y).toBe(b.anchorPoint.y);
	});

	it("still accepts a Vector2d instance (back-compat)", () => {
		const r = make(new Vector2d(0.25, 0.75));
		expect(r.anchorPoint.x).toBe(0.25);
		expect(r.anchorPoint.y).toBe(0.75);
	});

	it("out-of-range values pass through unclamped (back-compat)", () => {
		const r = make({ x: -0.5, y: 2 });
		expect(r.anchorPoint.x).toBe(-0.5);
		expect(r.anchorPoint.y).toBe(2);
	});

	it("the default is preserved when no anchorPoint is given", () => {
		const r = make(undefined);
		expect(r.anchorPoint.x).toBe(defaults.x);
		expect(r.anchorPoint.y).toBe(defaults.y);
	});

	const garbage = [
		["an unknown preset", "botom"],
		["a wrong-cased key object", { X: 1, Y: 1 }],
		["a string-valued object", { x: "1", y: "1" }],
		["a NaN component", { x: Number.NaN, y: 1 }],
	];

	if (throws) {
		it.each(garbage)("throws on %s (new API surface)", (_label, value) => {
			expect(() => {
				make(value);
			}).toThrow();
		});
	} else {
		it.each(
			garbage,
		)("warns and keeps the legacy (0, 0) outcome on %s — never throws", (_label, value) => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				let r;
				expect(() => {
					r = make(value);
				}).not.toThrow();
				expect(r.anchorPoint.x).toBe(0);
				expect(r.anchorPoint.y).toBe(0);
				expect(warnSpy).toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
			}
		});
	}
});

describe("ImageLayer bare-number shorthand", () => {
	it("anchorPoint: 0.3 anchors both axes and never reaches the strict resolver", () => {
		const layer = new ImageLayer(0, 0, {
			image: freshImage(),
			anchorPoint: 0.3,
		});
		expect(layer.anchorPoint.x).toBe(0.3);
		expect(layer.anchorPoint.y).toBe(0.3);
	});

	it("anchorPoint: 0 (falsy) keeps the (0, 0) default", () => {
		const layer = new ImageLayer(0, 0, { image: freshImage(), anchorPoint: 0 });
		expect(layer.anchorPoint.x).toBe(0);
		expect(layer.anchorPoint.y).toBe(0);
	});
});
