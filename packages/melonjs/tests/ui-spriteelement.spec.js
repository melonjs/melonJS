import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	input,
	Renderable,
	TextureAtlas,
	UISpriteElement,
	video,
} from "../src/index.js";

// UISpriteElement's public behaviour, as a game sees it: where it is, what
// the pointer does to it, and the Sprite shortcuts a subclass calls. It
// only uses what both the Sprite-based element and the UIBaseElement-based
// one offer, so it pins the behaviour existing games depend on.

let app;
const added = [];

/** a DOM event at game coordinates, through the canvas's on-page rect */
const at = (gameX, gameY) => {
	const canvas = app.renderer.getCanvas();
	const rect = canvas.getBoundingClientRect();
	return {
		clientX: rect.left + (gameX * rect.width) / canvas.width,
		clientY: rect.top + (gameY * rect.height) / canvas.height,
	};
};

const pointer = (type, gameX, gameY) => {
	app.renderer.getCanvas().dispatchEvent(
		new PointerEvent(type, {
			...at(gameX, gameY),
			pointerId: 1,
			width: 1,
			height: 1,
			isPrimary: true,
			bubbles: true,
		}),
	);
};

const syncBroadphase = () => {
	app.world.broadphase.clear();
	app.world.broadphase.insertContainer(app.world);
};

/** add to the world, and take it out after the test */
const place = (renderable) => {
	app.world.addChild(renderable);
	added.push(renderable);
	syncBroadphase();
	return renderable;
};

/** a 64x32 atlas: "up", "on" and "off" are 16x16, "down" is 16x12 */
const makeAtlas = () => {
	const sheet = document.createElement("canvas");
	sheet.width = 64;
	sheet.height = 32;
	const ctx = sheet.getContext("2d");
	["#f00", "#0f0", "#00f", "#ff0"].forEach((c, i) => {
		ctx.fillStyle = c;
		ctx.fillRect(i * 16, 0, 16, 16);
	});
	const frame = (filename, x, w, h) => {
		return {
			filename,
			frame: { x, y: 0, w, h },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w, h },
			sourceSize: { w, h },
			pivot: { x: 0.5, y: 0.5 },
		};
	};
	return new TextureAtlas(
		{
			frames: [
				frame("up", 0, 16, 16),
				frame("down", 16, 16, 12),
				frame("on", 32, 16, 16),
				frame("off", 48, 16, 16),
			],
			meta: {
				app: "texturepacker",
				image: "ui.png",
				size: { w: 64, h: 32 },
				scale: "1",
			},
		},
		sheet,
	);
};

/** a 16x16 element centred on (100, 100), with spies on its callbacks */
const makeIcon = (settings = {}) => {
	const icon = new UISpriteElement(100, 100, {
		image: makeAtlas(),
		region: "up",
		...settings,
	});
	return icon;
};

/** a renderable under everything, listening for presses */
const listenBehind = () => {
	const behind = vi.fn();
	const under = new Renderable(0, 0, 800, 600);
	under.anchorPoint.set(0, 0);
	// a kinematic renderable is left out of hit detection
	under.isKinematic = false;
	under.depth = -10;
	place(under);
	input.registerPointerEvent("pointerdown", under, behind);
	return { behind, under };
};

describe("UISpriteElement", () => {
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterEach(() => {
		// end any press a test left held
		pointer("pointermove", 790, 590);
		pointer("pointerup", 790, 590);
		for (const r of added.splice(0)) {
			if (r.ancestor !== undefined) {
				app.world.removeChildNow(r);
			}
		}
		vi.restoreAllMocks();
	});

	describe("construction", () => {
		it("takes Sprite settings: an atlas region, at the region's size", () => {
			const icon = makeIcon();
			expect(icon).toBeInstanceOf(UISpriteElement);
			expect(icon.width).toBe(16);
			expect(icon.height).toBe(16);
		});

		it("uses screen coordinates and takes part in hit detection", () => {
			const icon = makeIcon();
			expect(icon.floating).toBe(true);
			expect(icon.isKinematic).toBe(false);
			expect(icon.isClickable).toBe(true);
		});

		it("starts released, not hovered, not holdable", () => {
			const icon = makeIcon();
			expect(icon.released).toBe(true);
			expect(icon.hover).toBe(false);
			expect(icon.isHoldable).toBe(false);
			expect(icon.holdThreshold).toBe(250);
		});
	});

	describe("placement", () => {
		it("is centred on (x, y) by default, as a sprite is", () => {
			const b = makeIcon().getBounds();
			expect([b.left, b.top, b.width, b.height]).toEqual([92, 92, 16, 16]);
		});

		it("with an anchorPoint of (0, 0) in the settings, (x, y) is its top left corner", () => {
			const icon = new UISpriteElement(10, 20, {
				image: makeAtlas(),
				region: "up",
				anchorPoint: { x: 0, y: 0 },
			});
			const b = icon.getBounds();
			expect([b.left, b.top, b.width, b.height]).toEqual([10, 20, 16, 16]);
		});
	});

	describe("the pointer", () => {
		it("a press calls onClick with the pointer, and holds it down until the release", () => {
			const icon = place(makeIcon());
			const onClick = vi.spyOn(icon, "onClick");
			const onRelease = vi.spyOn(icon, "onRelease");
			pointer("pointermove", 100, 100);
			pointer("pointerdown", 100, 100);
			expect(onClick).toHaveBeenCalledTimes(1);
			expect(onClick.mock.calls[0][0]).toHaveProperty("gameX");
			expect(icon.released).toBe(false);
			expect(onRelease).not.toHaveBeenCalled();
			pointer("pointerup", 100, 100);
			expect(onRelease).toHaveBeenCalledTimes(1);
			expect(icon.released).toBe(true);
		});

		it("answers where its image is, and not just outside it", () => {
			const icon = place(makeIcon());
			const onClick = vi.spyOn(icon, "onClick");
			// just inside each edge of 92..108
			for (const [x, y] of [
				[93, 100],
				[107, 100],
				[100, 93],
				[100, 107],
			]) {
				pointer("pointermove", x, y);
				pointer("pointerdown", x, y);
				pointer("pointerup", x, y);
			}
			expect(onClick).toHaveBeenCalledTimes(4);
			// just outside
			for (const [x, y] of [
				[89, 100],
				[111, 100],
				[100, 89],
				[100, 111],
			]) {
				pointer("pointermove", x, y);
				pointer("pointerdown", x, y);
				pointer("pointerup", x, y);
			}
			expect(onClick).toHaveBeenCalledTimes(4);
		});

		it("hover: onOver as the pointer comes in, onOut as it leaves", () => {
			const icon = place(makeIcon());
			const onOver = vi.spyOn(icon, "onOver");
			const onOut = vi.spyOn(icon, "onOut");
			pointer("pointermove", 100, 100);
			expect(onOver).toHaveBeenCalledTimes(1);
			expect(icon.hover).toBe(true);
			pointer("pointermove", 300, 300);
			expect(onOut).toHaveBeenCalledTimes(1);
			expect(icon.hover).toBe(false);
		});

		it("the pointer leaving while held ends the press", () => {
			const icon = place(makeIcon());
			const onRelease = vi.spyOn(icon, "onRelease");
			pointer("pointermove", 100, 100);
			pointer("pointerdown", 100, 100);
			pointer("pointermove", 300, 300);
			expect(onRelease).toHaveBeenCalledTimes(1);
			expect(icon.released).toBe(true);
		});

		it("ignores the pointer while isClickable is false", () => {
			const icon = place(makeIcon());
			const onClick = vi.spyOn(icon, "onClick");
			icon.isClickable = false;
			pointer("pointermove", 100, 100);
			pointer("pointerdown", 100, 100);
			expect(onClick).not.toHaveBeenCalled();
			expect(icon.released).toBe(true);
		});

		it("hears nothing once removed from the world", () => {
			const icon = place(makeIcon());
			const onClick = vi.spyOn(icon, "onClick");
			app.world.removeChildNow(icon);
			syncBroadphase();
			pointer("pointermove", 100, 100);
			pointer("pointerdown", 100, 100);
			expect(onClick).not.toHaveBeenCalled();
		});
	});

	describe("what is behind it", () => {
		it("a press stops at it by default", () => {
			const { behind, under } = listenBehind();
			try {
				const icon = place(makeIcon());
				expect(icon.onClick()).toBe(false);
				expect(icon.onRelease()).toBe(false);
				pointer("pointermove", 100, 100);
				pointer("pointerdown", 100, 100);
				expect(behind).not.toHaveBeenCalled();
				// and away from it, the game gets the press
				pointer("pointermove", 400, 400);
				pointer("pointerdown", 400, 400);
				expect(behind).toHaveBeenCalledTimes(1);
			} finally {
				input.releasePointerEvent("pointerdown", under);
			}
		});

		it("onClick returning true lets the press through", () => {
			const { behind, under } = listenBehind();
			try {
				const icon = place(makeIcon());
				icon.onClick = () => {
					return true;
				};
				pointer("pointermove", 100, 100);
				pointer("pointerdown", 100, 100);
				expect(behind).toHaveBeenCalledTimes(1);
			} finally {
				input.releasePointerEvent("pointerdown", under);
			}
		});
	});

	describe("a subclass", () => {
		it("overrides the callbacks, as the demos' buttons do", () => {
			const log = [];
			class Toggle extends UISpriteElement {
				constructor(x, y) {
					super(x, y, { image: makeAtlas(), region: "off" });
					this.on = false;
					this.setOpacity(0.5);
				}
				onOver() {
					this.setOpacity(1);
					log.push("over");
				}
				onOut() {
					this.setOpacity(0.5);
					log.push("out");
				}
				onClick() {
					this.on = !this.on;
					log.push("click");
					return false;
				}
				onRelease() {
					log.push("release");
					return false;
				}
			}
			const t = place(new Toggle(100, 100));
			expect(t.getOpacity()).toBe(0.5);
			pointer("pointermove", 100, 100);
			expect(t.getOpacity()).toBe(1);
			pointer("pointerdown", 100, 100);
			pointer("pointerup", 100, 100);
			pointer("pointermove", 300, 300);
			expect(t.getOpacity()).toBe(0.5);
			expect(t.on).toBe(true);
			expect(log).toEqual(["over", "click", "release", "out"]);
		});
	});

	describe("Sprite shortcuts", () => {
		it("setRegion swaps the image, to the new region's size", () => {
			const atlas = makeAtlas();
			const icon = new UISpriteElement(100, 100, {
				image: atlas,
				region: "up",
			});
			icon.setRegion(atlas.getRegion("down"));
			expect(icon.width).toBe(16);
			expect(icon.height).toBe(12);
		});

		it("addAnimation, setCurrentAnimation and isCurrentAnimation", () => {
			// a spritesheet of 16x16 frames
			const sheet = document.createElement("canvas");
			sheet.width = 64;
			sheet.height = 16;
			const icon = new UISpriteElement(100, 100, {
				image: sheet,
				framewidth: 16,
				frameheight: 16,
			});
			expect([icon.width, icon.height]).toEqual([16, 16]);
			icon.addAnimation("blink", [1, 2]);
			icon.addAnimation("idle", [0]);
			icon.setCurrentAnimation("blink");
			expect(icon.isCurrentAnimation("blink")).toBe(true);
			expect(icon.isCurrentAnimation("idle")).toBe(false);
			icon.setCurrentAnimation("idle");
			expect(icon.isCurrentAnimation("idle")).toBe(true);
		});

		it("setOpacity and getOpacity", () => {
			const icon = makeIcon();
			icon.setOpacity(0.25);
			expect(icon.getOpacity()).toBe(0.25);
		});
	});
});
