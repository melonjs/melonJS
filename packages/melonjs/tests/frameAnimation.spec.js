import { beforeAll, describe, expect, it, vi } from "vitest";
import { boot, FrameAnimation, Sprite, Sprite3d, video } from "../src/index.js";

/**
 * FrameAnimation — the shared frame-animation engine behind Sprite (2D) and
 * Sprite3d (3D). The exact same battery is run against BOTH hosts, so every
 * accessor (`anim` / `current` / `dt` / `animationspeed` / `animationpause`)
 * and every proxied method (`addAnimation` / `setCurrentAnimation` / `play` /
 * `pause` / `stop` / `reverseAnimation` / `setAnimationFrame` / …) is verified
 * to behave identically whether it's surfaced through a Sprite or a Sprite3d.
 */

// a 128×32 sheet → four 32×32 frames (indices 0..3), each a solid block
const makeSheet = () => {
	const c = document.createElement("canvas");
	c.width = 128;
	c.height = 32;
	c.getContext("2d").fillRect(0, 0, 128, 32);
	return c;
};

// host factories — same spritesheet, same frame grid, exposed through each class
const HOSTS = [
	{
		name: "Sprite",
		make: () => {
			return new Sprite(0, 0, {
				image: makeSheet(),
				framewidth: 32,
				frameheight: 32,
			});
		},
	},
	{
		name: "Sprite3d",
		make: () => {
			return new Sprite3d(0, 0, {
				image: makeSheet(),
				framewidth: 32,
				frameheight: 32,
				width: 32,
				height: 32,
			});
		},
	},
];

for (const HOST of HOSTS) {
	describe(`FrameAnimation via ${HOST.name}`, () => {
		beforeAll(() => {
			boot();
			video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
		});

		// a fresh host with two animations defined (4-frame "walk", 2-frame "ab")
		const make = () => {
			const s = HOST.make();
			s.addAnimation("walk", [0, 1, 2, 3], 100);
			s.addAnimation("ab", [0, 1], 100);
			return s;
		};

		// ── addAnimation + animationspeed defaulting ─────────────────────────

		it("addAnimation returns the frame count and records the frames", () => {
			const s = HOST.make();
			expect(s.addAnimation("a", [0, 1, 2])).toBe(3);
			expect(s.anim["a"].length).toBe(3);
			expect(s.anim["a"].frames[2].name).toBe(2);
		});

		it("addAnimation defaults each frame delay to animationspeed (100)", () => {
			const s = HOST.make();
			s.addAnimation("def", [0, 1]);
			expect(s.anim["def"].frames[0].delay).toBe(100);
			expect(s.anim["def"].frames[1].delay).toBe(100);
		});

		it("addAnimation honors a host-level animationspeed override", () => {
			const s = HOST.make();
			s.animationspeed = 250; // accessor → engine
			s.addAnimation("slow", [0, 1]);
			expect(s.anim["slow"].frames[0].delay).toBe(250);
			// an explicit per-call speed still wins
			s.addAnimation("fast", [0, 1], 30);
			expect(s.anim["fast"].frames[0].delay).toBe(30);
		});

		it("addAnimation accepts per-frame delay objects", () => {
			const s = HOST.make();
			s.addAnimation("mix", [
				{ name: 0, delay: 200 },
				{ name: 1, delay: 50 },
			]);
			expect(s.anim["mix"].frames[0].delay).toBe(200);
			expect(s.anim["mix"].frames[1].delay).toBe(50);
		});

		// ── selection + query accessors ──────────────────────────────────────

		it("setCurrentAnimation sets name/length and isCurrentAnimation reports it", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			expect(s.current.name).toBe("walk");
			expect(s.current.length).toBe(4);
			expect(s.isCurrentAnimation("walk")).toBe(true);
			expect(s.isCurrentAnimation("ab")).toBe(false);
		});

		it("getAnimationNames lists every defined animation", () => {
			const s = make();
			expect(s.getAnimationNames()).toEqual(
				expect.arrayContaining(["walk", "ab"]),
			);
		});

		it("setCurrentAnimation throws on an unknown id", () => {
			const s = make();
			expect(() => {
				return s.setCurrentAnimation("nope");
			}).toThrow();
		});

		it("setAnimationFrame / getCurrentAnimationFrame jump to a frame", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.setAnimationFrame(2);
			expect(s.getCurrentAnimationFrame()).toBe(2);
			// `current` reflects the frame's texture offset/size (frame 2 at x=64)
			expect(s.current.idx).toBe(2);
			expect(s.current.offset.x).toBe(64);
			expect(s.current.width).toBe(32);
		});

		it("getAnimationFrameObjectByIndex returns the frame data", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			expect(s.getAnimationFrameObjectByIndex(3).name).toBe(3);
		});

		// ── update timing (the core stepping) ────────────────────────────────

		it("update advances one frame per animationspeed-worth of time", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			expect(s.getCurrentAnimationFrame()).toBe(0);
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(1);
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(2);
			s.update(200); // skip two frames at once
			expect(s.getCurrentAnimationFrame()).toBe(0); // 4-frame loop wraps
		});

		// ── dirty flag: the host owns it, the engine never sets it directly ──

		it("host.update() returns isDirty — true only when a frame changed", () => {
			const s = make();
			s.setCurrentAnimation("walk"); // 100ms frames
			// selecting the animation dirtied the host; clear it so the return
			// reflects THIS update's frame change, not prior state
			s.isDirty = false;
			expect(s.update(50)).toBeFalsy(); // < 100ms → no advance, still clean
			s.isDirty = false;
			expect(s.update(60)).toBeTruthy(); // 50 + 60 ≥ 100 → advance → dirty
		});

		it("host.update() returns false while paused", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.pause();
			s.isDirty = false;
			expect(s.update(1000)).toBeFalsy();
		});

		it("the engine update() returns whether a frame changed, and marks dirty only via _applyFrame", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.isDirty = false;
			// no frame change → returns false, host left clean (engine sets nothing)
			expect(s._frameAnim.update(50)).toBe(false);
			expect(s.isDirty).toBe(false);
			// frame change → returns true, host marked dirty inside _applyFrame
			expect(s._frameAnim.update(60)).toBe(true);
			expect(s.isDirty).toBe(true);
		});

		it("every frame-selecting call marks the host dirty", () => {
			const s = make();
			for (const act of [
				() => {
					s.setCurrentAnimation("ab");
				},
				() => {
					s.setAnimationFrame(1);
				},
				() => {
					s.reverseAnimation("walk");
				},
			]) {
				s.isDirty = false;
				act();
				expect(s.isDirty).toBe(true);
			}
		});

		it("setRegion marks the host dirty", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.isDirty = false;
			s.setRegion(s.getAnimationFrameObjectByIndex(2));
			expect(s.isDirty).toBe(true);
		});

		it("the speed option scales how fast frames advance", () => {
			const s = make();
			s.setCurrentAnimation("walk", { speed: 2 });
			s.update(50); // 50 × 2 = 100ms consumed → one frame
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("loop:false holds on the last frame", () => {
			const s = make();
			s.setCurrentAnimation("ab", { loop: false });
			s.update(100); // → frame 1 (last)
			expect(s.getCurrentAnimationFrame()).toBe(1);
			s.update(1000); // would loop, but held
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("the next option chains to another animation at cycle end", () => {
			const s = make();
			s.setCurrentAnimation("ab", { next: "walk" });
			s.update(200); // one full 2-frame cycle → chain
			expect(s.isCurrentAnimation("walk")).toBe(true);
		});

		it("onComplete fires at each cycle end", () => {
			const s = make();
			const spy = vi.fn();
			s.setCurrentAnimation("ab", { onComplete: spy });
			s.update(200); // one full cycle
			expect(spy).toHaveBeenCalledTimes(1);
		});

		// ── legacy resetAnim forms (back-compat) ─────────────────────────────

		it("legacy: a bare function returning false holds the last frame", () => {
			const s = make();
			const cb = vi.fn(() => {
				return false;
			});
			s.setCurrentAnimation("ab", cb);
			s.update(200);
			expect(cb).toHaveBeenCalled();
			expect(s.getCurrentAnimationFrame()).toBe(1); // held on last
		});

		it("legacy: a string second arg chains to that animation", () => {
			const s = make();
			s.setCurrentAnimation("ab", "walk");
			s.update(200);
			expect(s.isCurrentAnimation("walk")).toBe(true);
		});

		// ── pause / play / stop + animationpause accessor ────────────────────

		it("animationpause freezes stepping; clearing it resumes", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.animationpause = true;
			s.update(500);
			expect(s.getCurrentAnimationFrame()).toBe(0); // frozen
			expect(s.animationpause).toBe(true);
			s.animationpause = false;
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("pause() / play() toggle animationpause", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.pause();
			expect(s.animationpause).toBe(true);
			s.play();
			expect(s.animationpause).toBe(false);
		});

		it("play(name) switches to and plays an animation", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.pause();
			s.play("ab");
			expect(s.isCurrentAnimation("ab")).toBe(true);
			expect(s.animationpause).toBe(false);
		});

		it("stop() pauses and rewinds to the first frame", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.update(200); // → frame 2
			expect(s.getCurrentAnimationFrame()).toBe(2);
			s.stop();
			expect(s.animationpause).toBe(true);
			expect(s.getCurrentAnimationFrame()).toBe(0);
		});

		// ── reverseAnimation + dt accessor ───────────────────────────────────

		it("reverseAnimation reverses the frame order", () => {
			const s = make();
			expect(s.anim["walk"].frames[0].name).toBe(0);
			s.reverseAnimation("walk");
			expect(s.anim["walk"].frames[0].name).toBe(3);
			expect(s.anim["walk"].frames[3].name).toBe(0);
		});

		it("the dt accessor reads and writes the frame timer", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.dt = 40;
			expect(s.dt).toBe(40);
			// 40 + 70 = 110 ≥ 100 → advances one frame, 10ms carried over
			s.update(70);
			expect(s.getCurrentAnimationFrame()).toBe(1);
			expect(s.dt).toBe(10);
		});

		it("switching animation resets the speed multiplier to 1", () => {
			const s = make();
			s.setCurrentAnimation("walk", { speed: 4 });
			s.setCurrentAnimation("ab"); // no speed → back to 1×
			s.update(100);
			expect(s.getCurrentAnimationFrame()).toBe(1); // 100ms = one frame
		});

		// ── adversarial ──────────────────────────────────────────────────────

		it("ADVERSARIAL: re-selecting the current animation does NOT rewind it", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.update(200); // → frame 2
			s.setCurrentAnimation("walk"); // already current → no-op
			expect(s.getCurrentAnimationFrame()).toBe(2);
		});

		it("ADVERSARIAL: a single-frame animation never advances and never hangs", () => {
			const s = make();
			s.addAnimation("solo", [1]);
			s.setCurrentAnimation("solo");
			s.update(1_000_000); // length === 1 → the stepping loop is skipped
			expect(s.getCurrentAnimationFrame()).toBe(0);
			expect(s.current.length).toBe(1);
		});

		it("ADVERSARIAL: setAnimationFrame wraps an out-of-range index", () => {
			const s = make();
			s.setCurrentAnimation("walk"); // 4 frames
			s.setAnimationFrame(5); // 5 % 4
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("ADVERSARIAL: speed 0 freezes the animation (no divide-by-zero / drift)", () => {
			const s = make();
			s.setCurrentAnimation("walk", { speed: 0 });
			s.update(100000);
			expect(s.getCurrentAnimationFrame()).toBe(0);
		});

		it("ADVERSARIAL: a huge single dt steps deterministically and terminates", () => {
			const s = make();
			s.setCurrentAnimation("walk"); // 4 frames × 100ms
			s.update(1000); // 10 frames worth → 10 % 4
			expect(s.getCurrentAnimationFrame()).toBe(2);
		});

		it("ADVERSARIAL: an Infinity frame delay holds forever (die pattern)", () => {
			const s = make();
			s.addAnimation("die", [
				{ name: 0, delay: 100 },
				{ name: 1, delay: Number.POSITIVE_INFINITY },
			]);
			s.setCurrentAnimation("die");
			s.update(100); // → frame 1
			expect(s.getCurrentAnimationFrame()).toBe(1);
			s.update(1e12); // Infinity delay never elapses
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("ADVERSARIAL: changing animationspeed after addAnimation leaves baked delays intact", () => {
			const s = make();
			expect(s.anim["walk"].frames[0].delay).toBe(100);
			s.animationspeed = 10; // must not retro-edit existing frames
			expect(s.anim["walk"].frames[0].delay).toBe(100);
		});

		it("ADVERSARIAL: reverseAnimation() with no arg reverses the CURRENT animation", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.reverseAnimation();
			expect(s.anim["walk"].frames[0].name).toBe(3);
		});

		it("ADVERSARIAL: onComplete fires before chaining via next", () => {
			const s = make();
			const order = [];
			s.setCurrentAnimation("ab", {
				onComplete: () => {
					return order.push("complete");
				},
				next: "walk",
			});
			s.update(200); // one cycle → onComplete then chain
			expect(order).toEqual(["complete"]);
			expect(s.isCurrentAnimation("walk")).toBe(true);
		});

		it("ADVERSARIAL: a chained animation keeps looping afterwards", () => {
			const s = make();
			s.setCurrentAnimation("ab", { next: "walk" });
			s.update(200); // → chains to walk @ frame 0
			expect(s.isCurrentAnimation("walk")).toBe(true);
			expect(s.getCurrentAnimationFrame()).toBe(0);
			s.update(100); // walk keeps advancing
			expect(s.getCurrentAnimationFrame()).toBe(1);
		});

		it("ADVERSARIAL: manual setAnimationFrame still works while paused", () => {
			const s = make();
			s.setCurrentAnimation("walk");
			s.pause();
			s.setAnimationFrame(3);
			expect(s.getCurrentAnimationFrame()).toBe(3);
			s.update(500); // paused → no drift
			expect(s.getCurrentAnimationFrame()).toBe(3);
		});
	});
}

// Sprite3d-only: a frame change must remap the quad's UVs (its `_applyFrame`)
describe("FrameAnimation → Sprite3d UV remap", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	it("maps the current frame onto the quad UVs", () => {
		const s = new Sprite3d(0, 0, {
			image: makeSheet(),
			framewidth: 32,
			frameheight: 32,
			width: 32,
			height: 32,
		});
		s.addAnimation("walk", [0, 1, 2, 3], 100);
		s.setCurrentAnimation("walk");
		// frame 0 → u ∈ [0, 0.25] (32/128)
		expect(s.uvs[0]).toBeCloseTo(0, 5);
		expect(s.uvs[2]).toBeCloseTo(0.25, 5);
		s.update(100); // → frame 1 → u ∈ [0.25, 0.5]
		expect(s.uvs[0]).toBeCloseTo(0.25, 5);
		expect(s.uvs[2]).toBeCloseTo(0.5, 5);
	});
});

// Engine in isolation: prove FrameAnimation owns NO dirty flag — only the host's
// applyFrame callback can mark dirty. A fake host whose applyFrame deliberately
// does nothing must stay clean through every engine path.
describe("FrameAnimation engine — host owns the dirty flag", () => {
	// minimal host: a 2-frame numeric atlas, applyFrame is a no-op that does NOT
	// touch isDirty (so any isDirty=true would have to come from the engine)
	const makeHost = () => {
		const region = (x) => {
			return { offset: { x, y: 0 }, width: 32, height: 32 };
		};
		return {
			textureAtlas: { 0: region(0), 1: region(32) },
			atlasIndices: undefined,
			source: {
				getFormat: () => {
					return "Spritesheet (fixed cell size)";
				},
			},
			onended: undefined,
			isDirty: false,
			applied: 0,
			_applyFrame() {
				// host geometry hook — intentionally does NOT set isDirty here, so
				// the test can detect if the engine sets it instead
				this.applied++;
			},
		};
	};

	it("never sets host.isDirty itself — applies frames only through the callback", () => {
		const host = makeHost();
		const fa = new FrameAnimation(host, (region) => {
			host._applyFrame(region);
		});
		fa.addAnimation("walk", [0, 1], 100);

		fa.setCurrentAnimation("walk"); // applies frame 0 via the callback
		expect(host.applied).toBeGreaterThan(0); // frame WAS applied
		expect(host.isDirty).toBe(false); // …but the engine left isDirty alone

		const appliedBefore = host.applied;
		fa.update(100); // advance a frame
		expect(host.applied).toBeGreaterThan(appliedBefore); // applied again
		expect(host.isDirty).toBe(false); // still never set by the engine

		fa.setAnimationFrame(1);
		fa.setRegion(fa.getAnimationFrameObjectByIndex(0));
		fa.reverseAnimation("walk");
		expect(host.isDirty).toBe(false); // no engine path sets it
	});

	it("update() returns whether a frame changed (pure signal, no isDirty)", () => {
		const host = makeHost();
		const fa = new FrameAnimation(host, (region) => {
			host._applyFrame(region);
		});
		fa.addAnimation("walk", [0, 1], 100);
		fa.setCurrentAnimation("walk");
		expect(fa.update(100)).toBe(true); // stepped a frame
		expect(fa.update(10)).toBe(false); // not enough time → no step
		expect(host.isDirty).toBe(false); // and never set by the engine
	});
});
