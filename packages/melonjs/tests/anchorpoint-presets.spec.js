import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	BitmapText,
	boot,
	Collectable,
	Entity,
	ImageLayer,
	loader,
	NineSliceSprite,
	pool,
	Sprite,
	Sprite3d,
	Text,
	Vector2d,
	video,
} from "../src/index.js";
import { applyTMXProperties } from "../src/level/tiled/TMXUtils.js";

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

/**
 * Sprite (2D) backward compatibility — adversarial. These pin the exact
 * pre-existing behaviors a game upgrading to 19.9 depends on, including the
 * warts (shared-atlas pivot inheritance), and the one deliberate
 * safety improvement (no aliasing of caller objects into the shared cache).
 */
describe("Sprite backward compatibility — adversarial", () => {
	const freshSheet = () => {
		const c = document.createElement("canvas");
		c.width = 64;
		c.height = 32;
		return c;
	};

	it("spritesheet path: a preset and its {x, y} equivalent resolve identically", () => {
		const a = new Sprite(0, 0, {
			image: freshSheet(),
			framewidth: 32,
			frameheight: 32,
			anchorPoint: "bottom",
		});
		const b = new Sprite(0, 0, {
			image: freshSheet(),
			framewidth: 32,
			frameheight: 32,
			anchorPoint: { x: 0.5, y: 1 },
		});
		expect([a.anchorPoint.x, a.anchorPoint.y]).toEqual([0.5, 1]);
		expect([b.anchorPoint.x, b.anchorPoint.y]).toEqual([0.5, 1]);
	});

	it("PIN (pre-existing): the first sprite's anchor becomes the shared atlas pivot for later sprites of the same image", () => {
		// documented-wart behavior, unchanged by the presets feature: the
		// spritesheet descriptor (including the anchor) is cached per image,
		// so a second sprite WITHOUT an anchor inherits the first one's.
		// Candidate to revisit in the #1410 TextureCache refactor.
		const shared = freshSheet();
		const first = new Sprite(0, 0, {
			image: shared,
			framewidth: 32,
			frameheight: 32,
			anchorPoint: { x: 0.25, y: 0.75 },
		});
		const second = new Sprite(0, 0, {
			image: shared,
			framewidth: 32,
			frameheight: 32,
		});
		expect([first.anchorPoint.x, first.anchorPoint.y]).toEqual([0.25, 0.75]);
		expect([second.anchorPoint.x, second.anchorPoint.y]).toEqual([0.25, 0.75]);
	});

	it("mutating the caller's Vector2d after construction does NOT retro-poison the sprite or the cache", () => {
		const shared = freshSheet();
		const callerVector = new Vector2d(0.3, 0.4);
		const a = new Sprite(0, 0, {
			image: shared,
			framewidth: 32,
			frameheight: 32,
			anchorPoint: callerVector,
		});
		callerVector.set(0.9, 0.9);
		expect([a.anchorPoint.x, a.anchorPoint.y]).toEqual([0.3, 0.4]);
		// a later same-image sprite inherits the value AT CONSTRUCTION TIME,
		// not the caller's mutated object
		const b = new Sprite(0, 0, {
			image: shared,
			framewidth: 32,
			frameheight: 32,
		});
		expect([b.anchorPoint.x, b.anchorPoint.y]).toEqual([0.3, 0.4]);
	});

	it("garbage on a shared spritesheet keeps the legacy (0, 0) for BOTH sprites (master parity)", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const shared = freshSheet();
			const a = new Sprite(0, 0, {
				image: shared,
				framewidth: 32,
				frameheight: 32,
				anchorPoint: { X: 1, Y: 1 },
			});
			const b = new Sprite(0, 0, {
				image: shared,
				framewidth: 32,
				frameheight: 32,
			});
			expect([a.anchorPoint.x, a.anchorPoint.y]).toEqual([0, 0]);
			expect([b.anchorPoint.x, b.anchorPoint.y]).toEqual([0, 0]);
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("the anchor survives 2D animation frame changes and flips (untrimmed frames)", () => {
		const s = new Sprite(0, 0, {
			image: freshSheet(),
			framewidth: 32,
			frameheight: 32,
			anchorPoint: { x: 0.3, y: 0.8 },
		});
		s.addAnimation("walk", [0, 1], 100);
		s.setCurrentAnimation("walk");
		s.setAnimationFrame(1);
		expect([s.anchorPoint.x, s.anchorPoint.y]).toEqual([0.3, 0.8]);
		// untrimmed frames: flipping does NOT mirror the pivot (legacy rule —
		// the pivot mirror only applies to trimmed atlas frames)
		s.flipX();
		expect([s.anchorPoint.x, s.anchorPoint.y]).toEqual([0.3, 0.8]);
	});

	it("Entity: the preset reaches both the entity AND its child sprite", () => {
		const e = new Entity(0, 0, {
			width: 32,
			height: 32,
			image: freshImage(),
			shapes: [],
			anchorPoint: "bottom",
		});
		expect([e.anchorPoint.x, e.anchorPoint.y]).toEqual([0.5, 1]);
		expect([e.renderable.anchorPoint.x, e.renderable.anchorPoint.y]).toEqual([
			0.5, 1,
		]);
	});

	it("NineSliceSprite (Sprite subclass) accepts presets through the inherited path", () => {
		const n = new NineSliceSprite(0, 0, {
			width: 96,
			height: 96,
			image: freshImage(),
			framewidth: 32,
			frameheight: 32,
			anchorPoint: "bottom",
		});
		expect([n.anchorPoint.x, n.anchorPoint.y]).toEqual([0.5, 1]);
	});
});

describe("preset table — every name maps to its documented value", () => {
	// validates the WHOLE table (a typo'd pair in one preset would otherwise
	// slip through tests that only exercise "bottom"/"top-left")
	const TABLE = [
		["center", 0.5, 0.5],
		["top", 0.5, 0],
		["bottom", 0.5, 1],
		["left", 0, 0.5],
		["right", 1, 0.5],
		["top-left", 0, 0],
		["top-right", 1, 0],
		["bottom-left", 0, 1],
		["bottom-right", 1, 1],
	];

	it.each(TABLE)('"%s" resolves to (%f, %f)', (name, x, y) => {
		const s = new Sprite(0, 0, { image: freshImage(), anchorPoint: name });
		expect(s.anchorPoint.x).toBe(x);
		expect(s.anchorPoint.y).toBe(y);
	});
});

describe("Tiled property chain", () => {
	it("a Tiled string property anchorPoint = 'bottom' survives coercion as a string", () => {
		const obj = {};
		applyTMXProperties(obj, {
			properties: [{ name: "anchorPoint", type: "string", value: "bottom" }],
		});
		expect(obj.anchorPoint).toBe("bottom");
		// ...and lands correctly through a renderable constructor
		const s = new Sprite(0, 0, {
			image: freshImage(),
			anchorPoint: obj.anchorPoint,
		});
		expect([s.anchorPoint.x, s.anchorPoint.y]).toEqual([0.5, 1]);
	});

	it("a numeric Tiled anchorPoint property still expands to {x, y} (legacy rule)", () => {
		const obj = {};
		applyTMXProperties(obj, {
			properties: [{ name: "anchorPoint", type: "string", value: "0.5" }],
		});
		expect(obj.anchorPoint).toEqual({ x: 0.5, y: 0.5 });
	});
});

describe("pool recycling", () => {
	it("a pooled Text resolves presets on pull AND on recycle", () => {
		const t1 = pool.pull("Text", 0, 0, {
			font: "Arial",
			size: 16,
			anchorPoint: "bottom",
		});
		expect([t1.anchorPoint.x, t1.anchorPoint.y]).toEqual([0.5, 1]);
		pool.push(t1);
		// recycled instance must re-resolve the NEW settings, not keep the old
		const t2 = pool.pull("Text", 0, 0, {
			font: "Arial",
			size: 16,
			anchorPoint: "top-right",
		});
		expect([t2.anchorPoint.x, t2.anchorPoint.y]).toEqual([1, 0]);
		pool.push(t2);
	});
});
