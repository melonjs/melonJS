/**
 * `Renderable#sortOffset`: an offset added to a child's position when its
 * parent container sorts on `"y"` (or `"x"`), and used for nothing else.
 *
 * What has to hold:
 *   - left at 0, everything sorts exactly as it always did
 *   - it changes the order, never the position nor the bounds
 *   - what is drawn, and what a pointer hits, follow that order
 *   - `"z"` sorting ignores it, and on `"x"`/`"y"` a different `pos.z` still
 *     decides first
 *   - a tie keeps insertion order (the child added last is drawn BEHIND), and
 *     an offset settles a tie on purpose
 *   - a change is picked up by the parent's next update when it keeps itself
 *     sorted (`autoSort`), and not with `autoSort` off nor on a `"z"` sort
 *   - a bad value is refused where it is set, leaving the order as it was
 *   - a renderable taken from a pool starts again at 0
 *
 * Order is read after `sortNow()`: the children array is then topmost first,
 * since `Container.draw` walks it backwards (index 0 is drawn last).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	input,
	Renderable,
	video,
} from "../src/index.js";
import { resetRenderableState } from "../src/renderable/renderable.js";

describe("Renderable#sortOffset", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	/** a 10x10 child at (x, y), anchored at its top left like a Tiled object */
	const box = (name, x, y, sortOffset) => {
		const r = new Renderable(x, y, 10, 10);
		r.anchorPoint.set(0, 0);
		r.name = name;
		if (sortOffset !== undefined) {
			r.sortOffset = sortOffset;
		}
		return r;
	};

	/** a container sorted on `sortOn`, holding `children` at depth 0, sorted */
	const sorted = (sortOn, ...children) => {
		const c = new Container(0, 0, 1000, 1000);
		c.sortOn = sortOn;
		for (const child of children) {
			c.addChild(child, 0);
		}
		c.sortNow();
		// drop the sort `addChild` queued for the next tick, so that nothing
		// sorts behind a test's back
		clearTimeout(c.pendingSort);
		c.pendingSort = null;
		return c;
	};

	/** the names of the children, topmost first */
	const topFirst = (c) => {
		return c.getChildren().map((child) => {
			return child.name;
		});
	};

	// ---- the order --------------------------------------------------------

	describe("the order", () => {
		it("is 0 by default, and sorts exactly as before", () => {
			const a = box("a", 0, 10);
			expect(a.sortOffset).toBe(0);
			const c = sorted("y", a, box("b", 0, 30), box("c", 0, 20));
			// the lowest on screen is drawn last, on top
			expect(topFirst(c)).toEqual(["b", "c", "a"]);
		});

		it("lines a child up as if it stood lower, without moving it", () => {
			const a = box("a", 0, 10, 25); // counts as 35
			const c = sorted("y", a, box("b", 0, 30));
			expect(topFirst(c)).toEqual(["a", "b"]);
			// where it is, and where it is drawn, are untouched
			expect(a.pos.y).toBe(10);
			expect(a.getBounds().top).toBe(10);
		});

		it("lines it up higher with a negative offset", () => {
			const c = sorted("y", box("a", 0, 50, -30), box("b", 0, 30));
			expect(topFirst(c)).toEqual(["b", "a"]);
		});

		it("takes a fractional offset", () => {
			const c = sorted("y", box("a", 0, 30, 0.5), box("b", 0, 30.25));
			expect(topFirst(c)).toEqual(["a", "b"]);
		});

		it("works on the x axis of an x-sorted container", () => {
			const c = sorted("x", box("a", 10, 0, 25), box("b", 30, 0));
			expect(topFirst(c)).toEqual(["a", "b"]);
			// and the y offset of a child does not leak into an x sort: it is
			// the same single number, applied to the axis being sorted
			const d = sorted("x", box("a", 10, 500), box("b", 30, 0));
			expect(topFirst(d)).toEqual(["b", "a"]);
		});

		it("is ignored by a z-sorted container", () => {
			const a = box("a", 0, 0);
			const b = box("b", 0, 0);
			const c = new Container(0, 0, 1000, 1000);
			c.sortOn = "z";
			c.addChild(a, 1);
			c.addChild(b, 2);
			a.sortOffset = 1e6;
			c.sortNow();
			expect(topFirst(c)).toEqual(["b", "a"]);
		});

		it("never outweighs a different pos.z on a y sort", () => {
			const c = new Container(0, 0, 1000, 1000);
			c.sortOn = "y";
			const high = box("high", 0, 0);
			const low = box("low", 0, 100, 1e6);
			c.addChild(high, 2);
			c.addChild(low, 1);
			c.sortNow();
			expect(topFirst(c)).toEqual(["high", "low"]);
		});

		it("works on a container child, which sorts as one piece", () => {
			const group = new Container(0, 10, 50, 50);
			group.name = "group";
			group.addChild(box("inside", 0, 0), 0);
			group.sortOffset = 25; // counts as 35
			const c = sorted("y", group, box("b", 0, 30));
			expect(topFirst(c)).toEqual(["group", "b"]);
		});

		it("can be set before the child is added, and sorts it once added", () => {
			const a = box("a", 0, 10);
			a.sortOffset = 40;
			const c = sorted("y", a, box("b", 0, 30));
			expect(topFirst(c)).toEqual(["a", "b"]);
		});
	});

	// ---- ties -------------------------------------------------------------

	describe("ties", () => {
		it("keep insertion order, which draws the child added last behind", () => {
			// a torch hung on a wall, at the wall's own position
			const c = sorted("y", box("wall", 0, 50), box("torch", 0, 50));
			expect(topFirst(c)).toEqual(["wall", "torch"]);
		});

		it("are settled on purpose by an offset", () => {
			const c = sorted("y", box("wall", 0, 50), box("torch", 0, 50, 1));
			expect(topFirst(c)).toEqual(["torch", "wall"]);
		});
	});

	// ---- what the player sees and clicks ----------------------------------

	describe("drawing and pointer hits follow it", () => {
		it("draws the children in that order", () => {
			const drawn = [];
			const recording = (name, y, sortOffset) => {
				const r = box(name, 0, y, sortOffset);
				r.inViewport = true;
				r.draw = () => {
					drawn.push(name);
				};
				return r;
			};
			const c = sorted(
				"y",
				recording("front", 40),
				recording("lifted", 10, 50), // counts as 60
				recording("back", 20),
			);
			c.draw(app.renderer, app.viewport);
			// first drawn is at the bottom of the pile, last on top
			expect(drawn).toEqual(["back", "front", "lifted"]);
		});

		describe("a pointer hits the child drawn on top", () => {
			afterEach(() => {
				app.world.reset();
				app.world.sortOn = "z";
				app.world.broadphase.clear();
			});

			// two 40x40 regions on top of each other, in a y-sorted world
			const overlapping = (offsetOfSecond) => {
				const make = (name) => {
					const r = new Renderable(100, 100, 40, 40);
					r.anchorPoint.set(0, 0);
					r.name = name;
					r.isKinematic = false; // hit detection skips kinematic ones
					return r;
				};
				const first = make("first");
				const second = make("second");
				second.sortOffset = offsetOfSecond;
				app.world.sortOn = "y";
				app.world.addChild(first, 0);
				app.world.addChild(second, 0);
				app.world.sortNow();
				first.updateBounds(true);
				second.updateBounds(true);
				app.world.broadphase.clear();
				app.world.broadphase.insertContainer(app.world);
				return [first, second];
			};

			/** click the middle of both, and return who got it first */
			const click = (regions) => {
				const hits = [];
				for (const r of regions) {
					input.registerPointerEvent("pointerdown", r, () => {
						hits.push(r.name);
						return false; // consumed: nothing underneath gets it
					});
				}
				try {
					const canvas = app.renderer.getCanvas();
					const rect = canvas.getBoundingClientRect();
					canvas.dispatchEvent(
						new PointerEvent("pointerdown", {
							clientX: rect.left + (120 * rect.width) / canvas.width,
							clientY: rect.top + (120 * rect.height) / canvas.height,
							pointerId: 1,
							width: 1,
							height: 1,
							isPrimary: true,
							bubbles: true,
						}),
					);
				} finally {
					for (const r of regions) {
						input.releasePointerEvent("pointerdown", r);
					}
				}
				return hits;
			};

			it("without an offset, the one drawn on top of the tie", () => {
				expect(click(overlapping(0))).toEqual(["first"]);
			});

			it("with an offset, the one it lifts on top", () => {
				expect(click(overlapping(1))).toEqual(["second"]);
			});
		});
	});

	// ---- re-sorting -------------------------------------------------------

	describe("changing it", () => {
		it("is picked up by the parent's next update", () => {
			const a = box("a", 0, 10);
			const c = sorted("y", a, box("b", 0, 30));
			a.sortOffset = 50;
			// nothing moves until the container updates
			expect(topFirst(c)).toEqual(["b", "a"]);
			c.update(16);
			expect(topFirst(c)).toEqual(["a", "b"]);
		});

		it("leaves a container with autoSort off to its own order", () => {
			const a = box("a", 0, 10);
			const c = sorted("y", a, box("b", 0, 30));
			c.autoSort = false;
			a.sortOffset = 50;
			c.update(16);
			expect(topFirst(c)).toEqual(["b", "a"]);
			// until it is told to sort
			c.sortNow();
			expect(topFirst(c)).toEqual(["a", "b"]);
		});

		it("is ignored by a z-sorted container's update", () => {
			const a = box("a", 0, 0);
			const b = box("b", 0, 0);
			const c = new Container(0, 0, 1000, 1000);
			c.sortOn = "z";
			c.addChild(a, 1);
			c.addChild(b, 2);
			c.sortNow();
			a.sortOffset = 1e6;
			c.update(16);
			expect(topFirst(c)).toEqual(["b", "a"]);
		});
	});

	// ---- bad values -------------------------------------------------------

	describe("bad values", () => {
		it("are refused where they are set, leaving the value and the order alone", () => {
			const a = box("a", 0, 10, 3);
			const c = sorted("y", a, box("b", 0, 30));
			// a NaN or a string would quietly scramble every sibling's order:
			// `pos.y + "5"` is the string "105"
			for (const bad of [
				NaN,
				Infinity,
				-Infinity,
				"5",
				null,
				undefined,
				{},
				true,
			]) {
				expect(() => {
					a.sortOffset = bad;
				}, String(bad)).toThrow(TypeError);
				expect(a.sortOffset).toBe(3);
			}
			c.sortNow();
			expect(topFirst(c)).toEqual(["b", "a"]);
		});
	});

	// ---- pools ------------------------------------------------------------

	describe("a renderable taken from a pool", () => {
		it("starts again at 0", () => {
			const a = box("a", 0, 10, 42);
			resetRenderableState(a);
			expect(a.sortOffset).toBe(0);
		});
	});
});
