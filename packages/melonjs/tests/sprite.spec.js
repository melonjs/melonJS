import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Container, Sprite, video } from "../src/index.js";

describe("Sprite", () => {
	let container;
	let sprite;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});

		container = new Container(50, 50, 150, 150);
		sprite = new Sprite(0, 0, {
			framewidth: 32,
			frameheight: 32,
			image: video.createCanvas(64, 64),
			anchorPoint: { x: 0, y: 0 },
		});

		// add to a parent container
		container.addChild(sprite);
	});

	afterAll(() => {
		container.removeChild(sprite);
	});

	describe("isAttachedToRoot", () => {
		it("Sprite bounds return the visible part of the sprite", async () => {
			const bounds = sprite.getBounds();
			expect(
				bounds.x === 50 &&
					bounds.y === 50 &&
					bounds.width === 32 &&
					bounds.height === 32,
			).toEqual(true);
		});

		it("Sprite bounds should be updated when the sprite is scaled", async () => {
			let bounds = sprite.getBounds();
			sprite.scale(2.0);
			expect(
				bounds.x === 50 &&
					bounds.y === 50 &&
					bounds.width === 64 &&
					bounds.height === 64,
			).toEqual(true);

			bounds = sprite.getBounds();
			// scale back to original size
			sprite.scale(0.5);
			expect(
				bounds.x === 50 &&
					bounds.y === 50 &&
					bounds.width === 32 &&
					bounds.height === 32 &&
					bounds.width === 32 &&
					bounds.height === 32,
			).toEqual(true);
		});

		it("Sprite bounds should be updated when the anchor is changed", async () => {
			let bounds = sprite.getBounds();
			sprite.anchorPoint.set(0, 1);
			expect(
				// container pos + 0, container pos - sprite size
				bounds.x === 50 + 0 && bounds.y === 50 - 32,
			).toEqual(true);

			bounds = sprite.getBounds();
			sprite.anchorPoint.set(0.5, 0.5);
			expect(
				// container pos - half sprite size, container pos - half sprite size
				bounds.x === 50 - 16 && bounds.y === 50 - 16,
			).toEqual(true);

			bounds = sprite.getBounds();
			sprite.anchorPoint.set(1, 0);
			expect(
				// container pos - sprite size, container pos + 0
				bounds.x === 50 - 32 && bounds.y === 50 + 0,
			).toEqual(true);

			bounds = sprite.getBounds();
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				bounds.x === 50 - 32 && bounds.y === 50 - 32,
			).toEqual(true);
		});

		it("Sprite addAnimation should return the correct amount of frame", async () => {
			expect(sprite.addAnimation("test", [0, 1])).toEqual(2);
			expect(sprite.addAnimation("test2", [0, 1, 0, 1, 0])).toEqual(5);
		});

		it("Sprite reverseAnimation should return the correct amount of frame", async () => {
			sprite.setCurrentAnimation("test");
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				sprite.anim["test"].frames[0].name === 0 &&
					sprite.anim["test"].frames[1].name === 1,
			).toEqual(true);

			sprite.reverseAnimation("test");
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				sprite.anim["test"].frames[0].name === 1 &&
					sprite.anim["test"].frames[1].name === 0,
			).toEqual(true);

			sprite.reverseAnimation();
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				sprite.anim["test"].frames[0].name === 0 &&
					sprite.anim["test"].frames[1].name === 1,
			).toEqual(true);
		});

		it("Sprite isCurrentAnimation allows to verify which animation is set", async () => {
			expect(sprite.addAnimation("yoyo", [1, 0, 1, 0], 60)).toEqual(4);

			sprite.setCurrentAnimation("test");
			expect(sprite.isCurrentAnimation("test")).toEqual(true);

			sprite.setCurrentAnimation("yoyo", "test");
			expect(
				sprite.isCurrentAnimation("test") === false &&
					sprite.isCurrentAnimation("yoyo") === true,
			).toEqual(true);

			for (let i = -1; i < 8; i++) {
				sprite.update(16);
			}
			expect(sprite.isCurrentAnimation("yoyo")).toEqual(true);

			for (let j = -1; j < 8; j++) {
				sprite.update(16);
			}
			expect(
				sprite.isCurrentAnimation("test") === true &&
					sprite.isCurrentAnimation("yoyo") === false,
			).toEqual(true);
		});
	});

	describe("normalMap", () => {
		it("defaults to null when no normalMap is provided", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			expect(s.normalMap).toBeNull();
		});

		it("accepts an image-like value passed via settings", () => {
			const normal = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			expect(s.normalMap).toBe(normal);
		});

		it("accepts an image-like value assigned after construction", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const normal = video.createCanvas(32, 32);
			s.normalMap = normal;
			expect(s.normalMap).toBe(normal);
		});

		it("accepts null to clear an existing normal map", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: video.createCanvas(16, 16),
			});
			expect(s.normalMap).not.toBeNull();
			s.normalMap = null;
			expect(s.normalMap).toBeNull();
		});

		it("rejects non-image values with TypeError", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			expect(() => {
				s.normalMap = 42;
			}).toThrow(TypeError);
			expect(() => {
				s.normalMap = "not-an-image";
			}).toThrow(TypeError);
			expect(() => {
				s.normalMap = { foo: "bar" };
			}).toThrow(TypeError);
			// the failed assignments must not have mutated state
			expect(s.normalMap).toBeNull();
		});

		it("rejects an object with non-numeric width/height", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			expect(() => {
				s.normalMap = { width: "32", height: "32" };
			}).toThrow(TypeError);
		});

		it("accepts undefined to clear (same as null)", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: video.createCanvas(16, 16),
			});
			expect(s.normalMap).not.toBeNull();
			s.normalMap = undefined;
			expect(s.normalMap).toBeNull();
		});

		it("re-assignment replaces the previous value", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const a = video.createCanvas(8, 8);
			const b = video.createCanvas(16, 16);
			s.normalMap = a;
			expect(s.normalMap).toBe(a);
			s.normalMap = b;
			expect(s.normalMap).toBe(b);
		});

		it("a failed setter assignment must not mutate the previous value", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const valid = video.createCanvas(8, 8);
			s.normalMap = valid;
			expect(() => {
				s.normalMap = "broken";
			}).toThrow(TypeError);
			// previous value preserved
			expect(s.normalMap).toBe(valid);
		});

		it("rejects boolean, array, and function", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			expect(() => {
				s.normalMap = true;
			}).toThrow(TypeError);
			expect(() => {
				s.normalMap = false;
			}).toThrow(TypeError);
			expect(() => {
				s.normalMap = [1, 2, 3];
			}).toThrow(TypeError);
			expect(() => {
				s.normalMap = () => {};
			}).toThrow(TypeError);
		});

		it("constructor: settings.normalMap = null is a no-op (not a throw)", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: null,
			});
			expect(s.normalMap).toBeNull();
		});

		it("constructor: settings.normalMap = undefined is a no-op", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: undefined,
			});
			expect(s.normalMap).toBeNull();
		});

		it("constructor: missing settings.normalMap key defaults to null", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			expect(s.normalMap).toBeNull();
		});

		it("constructor: unknown loader key throws a descriptive error", () => {
			expect(() => {
				return new Sprite(0, 0, {
					framewidth: 16,
					frameheight: 16,
					image: video.createCanvas(16, 16),
					normalMap: "definitely-not-loaded-anywhere",
				});
			}).toThrow(/normal map image not found/);
		});

		it("constructor: settings.normalMap = boolean rejected with TypeError (no coercion)", () => {
			// Pre-fix, booleans/numbers fell through to `getImage(value)`
			// which coerces to a string and throws "image not found" — a
			// confusing error. Now rejected loudly with a TypeError.
			expect(() => {
				return new Sprite(0, 0, {
					framewidth: 16,
					frameheight: 16,
					image: video.createCanvas(16, 16),
					normalMap: true,
				});
			}).toThrow(TypeError);
		});

		it("constructor: settings.normalMap = number rejected with TypeError", () => {
			expect(() => {
				return new Sprite(0, 0, {
					framewidth: 16,
					frameheight: 16,
					image: video.createCanvas(16, 16),
					normalMap: 42,
				});
			}).toThrow(TypeError);
		});

		it("constructor: settings.normalMap = bad object propagates the setter TypeError", () => {
			expect(() => {
				return new Sprite(0, 0, {
					framewidth: 16,
					frameheight: 16,
					image: video.createCanvas(16, 16),
					normalMap: { foo: 1 },
				});
			}).toThrow(TypeError);
		});
	});

	describe("Sprite.draw + renderer.currentNormalMap state", () => {
		// Stub renderer that captures `currentNormalMap` at the moment
		// `drawImage` is called. Verifies Sprite.draw routes the
		// normal-map through renderer state (not through drawImage args
		// — the drawImage signature must stay stable).
		function makeStub() {
			const calls = { normalMapAtDrawImage: [], finalState: null };
			const stub = {
				currentNormalMap: null,
				drawImage: function () {
					// snapshot the renderer state at the moment drawImage runs
					calls.normalMapAtDrawImage.push(this.currentNormalMap);
				},
			};
			return { stub, calls };
		}

		it("Sprite without normalMap leaves currentNormalMap unchanged", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const { stub, calls } = makeStub();
			s.draw(stub);
			expect(calls.normalMapAtDrawImage).toEqual([null]);
			expect(stub.currentNormalMap).toBeNull();
		});

		it("Sprite with normalMap sets currentNormalMap during drawImage and clears after", () => {
			const normal = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			const { stub, calls } = makeStub();
			s.draw(stub);
			expect(calls.normalMapAtDrawImage).toEqual([normal]);
			// cleared after drawImage so the next un-lit sprite isn't
			// accidentally lit
			expect(stub.currentNormalMap).toBeNull();
		});

		it("two Sprites in sequence — first lit, second unlit — state isolated", () => {
			const normal = video.createCanvas(16, 16);
			const lit = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			const unlit = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const { stub, calls } = makeStub();
			lit.draw(stub);
			unlit.draw(stub);
			expect(calls.normalMapAtDrawImage).toEqual([normal, null]);
		});

		it("destroy() drops the normal-map reference (mirrors how `image` is cleared)", () => {
			const normal = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			expect(s.normalMap).toBe(normal);
			s.destroy();
			expect(s.normalMap).toBeNull();
		});
	});
});
