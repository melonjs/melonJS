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

	describe("Sprite.preDraw/draw/postDraw + renderer.currentNormalMap state", () => {
		// Stub renderer that captures `currentNormalMap` at the moment
		// `drawImage` is called. Verifies Sprite routes the normal-map
		// through renderer state via the `preDraw` → `draw` → `postDraw`
		// lifecycle (the same convention `setTint` / `clearTint` follow).
		// `drawImage` itself stays signature-stable.
		function makeStub() {
			const calls = { normalMapAtDrawImage: [], finalState: null };
			const noop = () => {};
			const stub = {
				currentNormalMap: null,
				drawImage: function () {
					calls.normalMapAtDrawImage.push(this.currentNormalMap);
				},
				// the rest is what `Renderable.preDraw`/`postDraw` touches —
				// no-op stubs are enough to let the lifecycle run end-to-end
				save: noop,
				restore: noop,
				translate: noop,
				scale: noop,
				transform: noop,
				setGlobalAlpha: noop,
				globalAlpha: () => {
					return 1;
				},
				setTint: noop,
				clearTint: noop,
				setDepth: noop,
				setMask: noop,
				clearMask: noop,
				setBlendMode: noop,
				getBlendMode: () => {
					return "normal";
				},
				beginPostEffect: noop,
				endPostEffect: noop,
			};
			return { stub, calls };
		}

		// run the full draw lifecycle the way the engine does
		function fullDraw(sprite, stub) {
			sprite.preDraw(stub);
			sprite.draw(stub);
			sprite.postDraw(stub);
		}

		it("Sprite without normalMap leaves currentNormalMap unchanged", () => {
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const { stub, calls } = makeStub();
			fullDraw(s, stub);
			expect(calls.normalMapAtDrawImage).toEqual([null]);
			expect(stub.currentNormalMap).toBeNull();
		});

		it("Sprite with normalMap sets currentNormalMap during drawImage and clears after postDraw", () => {
			const normal = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			const { stub, calls } = makeStub();
			fullDraw(s, stub);
			expect(calls.normalMapAtDrawImage).toEqual([normal]);
			// cleared by postDraw so the next un-lit sprite isn't
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
			fullDraw(lit, stub);
			fullDraw(unlit, stub);
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

	describe("animation API (options + speed)", () => {
		// fresh 4-frame sprite (64×64 image / 32px frames = indices 0..3),
		// isolated from the shared `sprite` above
		const makeSprite = () => {
			const s = new Sprite(0, 0, {
				framewidth: 32,
				frameheight: 32,
				image: video.createCanvas(64, 64),
			});
			s.addAnimation("a", [0, 1, 2, 3], 100); // 4 frames, 100ms each
			s.addAnimation("b", [0, 1], 100);
			return s;
		};

		// ── legacy forms must keep working (non-breaking) ──────────────────

		it("legacy: loops by default", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.update(400); // one full cycle → wraps to frame 0
			expect(s.getCurrentAnimationFrame()).toBe(0);
			expect(s.isCurrentAnimation("a")).toBe(true);
		});

		it("legacy: a string 2nd arg chains to the next animation", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", "b");
			s.update(400);
			expect(s.isCurrentAnimation("b")).toBe(true);
		});

		it("legacy: a function returning false holds the last frame (called once)", () => {
			const s = makeSprite();
			let calls = 0;
			s.setCurrentAnimation("a", () => {
				calls++;
				return false;
			});
			s.update(400);
			expect(s.getCurrentAnimationFrame()).toBe(3); // held at last frame
			expect(calls).toBe(1);
		});

		it("legacy: a function returning truthy keeps looping (called each cycle)", () => {
			const s = makeSprite();
			let calls = 0;
			s.setCurrentAnimation("a", () => {
				calls++;
				return true;
			});
			s.update(400);
			s.update(400);
			expect(calls).toBe(2);
			expect(s.isCurrentAnimation("a")).toBe(true);
		});

		// ── new options-object form ────────────────────────────────────────

		it("options loop:false plays once, holds the last frame, fires onComplete once", () => {
			const s = makeSprite();
			let done = 0;
			s.setCurrentAnimation("a", {
				loop: false,
				onComplete: () => {
					done++;
				},
			});
			s.update(400); // completes
			expect(s.getCurrentAnimationFrame()).toBe(3);
			expect(done).toBe(1);
			// must NOT advance or re-fire afterwards
			s.update(400);
			s.update(400);
			expect(done).toBe(1);
			expect(s.getCurrentAnimationFrame()).toBe(3);
		});

		it("options onComplete (looping) fires every cycle", () => {
			const s = makeSprite();
			let n = 0;
			s.setCurrentAnimation("a", {
				onComplete: () => {
					n++;
				},
			});
			s.update(400);
			s.update(400);
			expect(n).toBe(2);
			expect(s.isCurrentAnimation("a")).toBe(true);
		});

		it("options next chains, firing onComplete first", () => {
			const s = makeSprite();
			const order = [];
			s.setCurrentAnimation("a", {
				next: "b",
				onComplete: () => {
					return order.push("done");
				},
			});
			s.update(400);
			expect(s.isCurrentAnimation("b")).toBe(true);
			expect(order).toEqual(["done"]);
		});

		it("options speed:2 advances twice as fast", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", { speed: 2 });
			s.update(50); // 50 × 2 = 100 effective → one frame
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("options speed:0.5 advances half as fast", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", { speed: 0.5 });
			s.update(100); // 100 × 0.5 = 50 < 100 → no advance
			expect(s.getCurrentAnimationFrame()).toBe(0);
			s.update(100); // cumulative 100 → advance one frame
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("getAnimationNames returns every defined animation", () => {
			// the Sprite constructor auto-defines a "default" animation
			expect(makeSprite().getAnimationNames().sort()).toEqual([
				"a",
				"b",
				"default",
			]);
		});

		// ── adversarial ────────────────────────────────────────────────────

		it("ADVERSARIAL: a play-once animation un-sticks when another is selected", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", { loop: false });
			s.update(400); // done + held
			s.setCurrentAnimation("b"); // switch
			expect(s._animDone).toBe(false);
			s.update(100);
			expect(s.isCurrentAnimation("b")).toBe(true);
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("ADVERSARIAL: speed resets to 1 when switching without a speed option", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", { speed: 4 });
			s.setCurrentAnimation("b"); // no speed → back to 1×
			s.update(50); // 50 < 100 at 1× → no advance
			expect(s.getCurrentAnimationFrame()).toBe(0);
		});

		it("ADVERSARIAL: speed:0 freezes the animation", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", { speed: 0 });
			s.update(1000);
			expect(s.getCurrentAnimationFrame()).toBe(0);
		});

		it("ADVERSARIAL: options onComplete return value is ignored (only the legacy fn holds)", () => {
			const s = makeSprite();
			// returning false from onComplete must NOT hold — only the legacy
			// bare-function form has that contract
			s.setCurrentAnimation("a", {
				onComplete: () => {
					return false;
				},
			});
			s.update(400);
			expect(s.isCurrentAnimation("a")).toBe(true); // still looping
			expect(s.getCurrentAnimationFrame()).toBe(0); // wrapped, not held
		});

		it("ADVERSARIAL: animationpause halts the options path too", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a", { loop: true });
			s.animationpause = true;
			s.update(400);
			expect(s.getCurrentAnimationFrame()).toBe(0);
		});

		it("ADVERSARIAL: re-selecting the SAME animation is a no-op (no reset mid-play)", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.update(100); // idx → 1
			s.setCurrentAnimation("a"); // same anim → must not reset to frame 0
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		// ── play() / pause() / stop() shorthands (2D ↔ 3D parity) ──────────

		it("play(name) switches to and starts the animation", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.play("b");
			expect(s.isCurrentAnimation("b")).toBe(true);
			expect(s.animationpause).toBe(false);
		});

		it("play(name, options) forwards options (loop:false holds last frame)", () => {
			const s = makeSprite();
			let done = 0;
			s.play("a", {
				loop: false,
				onComplete: () => {
					return done++;
				},
			});
			s.update(400); // one cycle
			expect(s.getCurrentAnimationFrame()).toBe(3); // held
			expect(done).toBe(1);
			s.update(400); // _animDone → frozen
			expect(s.getCurrentAnimationFrame()).toBe(3);
		});

		it("play() with no argument resumes after pause()", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.pause();
			expect(s.animationpause).toBe(true);
			s.update(100); // paused → no advance
			expect(s.getCurrentAnimationFrame()).toBe(0);
			s.play();
			expect(s.animationpause).toBe(false);
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("pause() returns this and freezes the current frame", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.update(100); // idx → 1
			expect(s.pause()).toBe(s); // chainable
			s.update(1000); // frozen
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("stop() resets to the first frame and pauses", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.update(150); // idx → 1
			expect(s.stop()).toBe(s); // chainable
			expect(s.getCurrentAnimationFrame()).toBe(0);
			expect(s.animationpause).toBe(true);
			s.update(1000); // stays put
			expect(s.getCurrentAnimationFrame()).toBe(0);
		});

		it("ADVERSARIAL: stop() then play() restarts from the first frame", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.update(250); // idx → 2
			s.stop(); // → frame 0, paused
			s.play(); // resume
			s.update(100); // advance one frame from 0
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("ADVERSARIAL: stop() clears a held play-once so it can advance again", () => {
			const s = makeSprite();
			s.play("a", { loop: false });
			s.update(400); // held at last frame, _animDone
			s.stop(); // resets frame + clears _animDone
			s.play("a"); // loop again
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(1); // advancing again
		});

		it("ADVERSARIAL: play(name) un-pauses in one call", () => {
			const s = makeSprite();
			s.setCurrentAnimation("a");
			s.pause();
			s.play("b"); // must both switch AND resume
			expect(s.isCurrentAnimation("b")).toBe(true);
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});
	});
});
