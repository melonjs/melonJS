/**
 * A tween whose target is an array (a path) is played as
 * `[current value, ...path]`. Two bugs broke that:
 *
 * - `start()` built the path from the working copy, which already held the
 *   previous start value in front, so every restart (a replay, a second
 *   `start()`, a chain coming back round) ran a longer path than the last.
 *   `to()` also kept the caller's object as that working copy, so the
 *   caller's array was replaced and a properties object reused for another
 *   tween came with the stale start value baked in.
 * - a yoyo leg swapped start and end as for a number, putting the array in
 *   `_valuesStart` and a number in `_valuesEnd`: the return leg was NaN.
 *
 * `to()` now keeps the given values apart, `start()` rebuilds the path from
 * them every time, and a yoyo leg plays the path back in reverse.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Tween } from "../src/index.js";

describe("Tween : array (path) targets", () => {
	/** @type {Tween[]} */
	let tweens = [];
	const make = (obj) => {
		const t = new Tween(obj);
		tweens.push(t);
		return t;
	};

	afterEach(() => {
		for (const t of tweens) {
			t.stop();
		}
		tweens = [];
	});

	describe("restarting", () => {
		it("a second start() runs the same path as the first", () => {
			const obj = { x: 0 };
			const tween = make(obj).to({ x: [50, 100] }, { duration: 1000 });

			tween.start(0);
			tween.update(500);
			expect(obj.x).toBeCloseTo(50, 5);
			tween.update(500);
			expect(obj.x).toBeCloseTo(100, 5);

			obj.x = 0;
			tween.start(0);
			expect(tween._valuesEnd.x).toEqual([0, 50, 100]);
			tween.update(500);
			expect(obj.x).toBeCloseTo(50, 5);
			tween.update(500);
			expect(obj.x).toBeCloseTo(100, 5);
		});

		it("start() called twice before any update does not lengthen the path", () => {
			const obj = { x: 0 };
			const tween = make(obj).to({ x: [50, 100] }, { duration: 1000 });
			tween.start(0);
			tween.start(0);
			tween.start(0);
			expect(tween._valuesEnd.x).toEqual([0, 50, 100]);
			tween.update(500);
			expect(obj.x).toBeCloseTo(50, 5);
		});

		it("a restart takes the object's current value as the path's start", () => {
			const obj = { x: 0 };
			const tween = make(obj).to({ x: [50, 100] }, { duration: 1000 });
			tween.start(0);
			tween.update(1000);
			// restart from where the first run ended
			tween.start(0);
			expect(tween._valuesEnd.x).toEqual([100, 50, 100]);
		});

		it("leaves the caller's properties object alone, so it can be reused", () => {
			const path = [50, 100];
			const props = { x: path };
			const a = { x: 0 };
			const b = { x: 0 };
			make(a).to(props, { duration: 1000 }).start(0).update(500);
			expect(props.x).toBe(path);
			expect(path).toEqual([50, 100]);

			const second = make(b).to(props, { duration: 1000 }).start(0);
			expect(second._valuesEnd.x).toEqual([0, 50, 100]);
			second.update(500);
			expect(b.x).toBeCloseTo(50, 5);
		});

		it("a chain coming back round replays the same path every lap", () => {
			const obj = { x: 0 };
			const out = make(obj).to({ x: [50, 100] }, { duration: 1000 });
			const back = make(obj).to({ x: 0 }, { duration: 1000 });
			out.chain(back);
			back.chain(out);

			out.start(0);
			for (let lap = 0; lap < 3; lap++) {
				out.update(500);
				expect(obj.x).toBeCloseTo(50, 5);
				out.update(500); // completes, starts `back`
				expect(obj.x).toBeCloseTo(100, 5);
				back.update(1000); // completes, starts `out` again
				expect(obj.x).toBeCloseTo(0, 5);
				expect(out._valuesEnd.x).toEqual([0, 50, 100]);
			}
		});

		it("an empty path leaves the property alone", () => {
			const obj = { x: 7, y: 0 };
			const tween = make(obj).to({ x: [], y: 10 }, { duration: 100 });
			tween.start(0);
			tween.update(50);
			expect(obj.x).toBe(7);
			expect(obj.y).toBeCloseTo(5, 5);
			tween.update(50);
			expect(obj.x).toBe(7);
			expect(obj.y).toBeCloseTo(10, 5);
		});
	});

	describe("yoyo", () => {
		it("plays the path back instead of producing NaN", () => {
			const obj = { x: 0 };
			const tween = make(obj).to(
				{ x: [50, 100] },
				{ duration: 1000, yoyo: true, repeat: 1 },
			);
			tween.start(0);
			tween.update(1000); // forward leg done
			expect(obj.x).toBeCloseTo(100, 5);
			tween.update(250);
			expect(obj.x).toBeCloseTo(75, 5);
			tween.update(250);
			expect(obj.x).toBeCloseTo(50, 5);
			tween.update(500); // back at the start, and done
			expect(obj.x).toBeCloseTo(0, 5);
			expect(tween._isRunning).toBe(false);
		});

		it("the return leg retraces the forward leg exactly", () => {
			// an uneven path, so playing it back is distinguishable from
			// heading straight home or replaying it forwards
			const obj = { x: 0 };
			const tween = make(obj).to(
				{ x: [100, -20, 40] },
				{ duration: 1000, yoyo: true, repeat: 1 },
			);
			tween.start(0);
			const forward = [];
			for (let i = 0; i < 10; i++) {
				tween.update(100);
				forward.push(obj.x);
			}
			const back = [];
			for (let i = 0; i < 10; i++) {
				tween.update(100);
				back.push(obj.x);
			}
			// back[i] is at progress (i + 1) / 10 of the return leg, which is
			// the forward leg's progress 1 - (i + 1) / 10, i.e. forward[8 - i]
			for (let i = 0; i < 9; i++) {
				expect(back[i]).toBeCloseTo(forward[8 - i], 5);
			}
			expect(forward[9]).toBeCloseTo(40, 5);
			expect(back[9]).toBeCloseTo(0, 5);
		});

		it("keeps bouncing along the same path on endless repeat", () => {
			const obj = { x: 0 };
			const tween = make(obj).to(
				{ x: [50, 100] },
				{ duration: 100, yoyo: true, repeat: Infinity },
			);
			tween.start(0);
			for (let leg = 0; leg < 7; leg++) {
				tween.update(50);
				expect(obj.x).toBeCloseTo(50, 5);
				tween.update(50);
				expect(obj.x).toBeCloseTo(leg % 2 === 0 ? 100 : 0, 5);
				expect(tween._valuesEnd.x).toHaveLength(3);
			}
		});

		it("honours delay and repeatDelay on a path", () => {
			const obj = { x: 0 };
			const tween = make(obj).to(
				{ x: [50, 100] },
				{ duration: 100, yoyo: true, repeat: 1, delay: 40, repeatDelay: 20 },
			);
			tween.start(0);
			tween.update(40); // initial delay
			expect(obj.x).toBe(0);
			tween.update(100); // forward leg
			expect(obj.x).toBeCloseTo(100, 5);
			tween.update(10); // inside the repeat delay: holds
			expect(obj.x).toBeCloseTo(100, 5);
			tween.update(10 + 50); // delay over, halfway back
			expect(obj.x).toBeCloseTo(50, 5);
			tween.update(50);
			expect(obj.x).toBeCloseTo(0, 5);
			expect(tween._isRunning).toBe(false);
		});

		it("a number tweened alongside a path still yoyos as before", () => {
			const obj = { x: 0, y: 10 };
			const tween = make(obj).to(
				{ x: [50, 100], y: 210 },
				{ duration: 100, yoyo: true, repeat: 1 },
			);
			tween.start(0);
			tween.update(50);
			expect(obj.y).toBeCloseTo(110, 5);
			tween.update(50);
			expect([obj.x, obj.y]).toEqual([100, 210]);
			tween.update(50);
			expect(obj.x).toBeCloseTo(50, 5);
			expect(obj.y).toBeCloseTo(110, 5);
			tween.update(50);
			expect(obj.x).toBeCloseTo(0, 5);
			expect(obj.y).toBeCloseTo(10, 5);
		});

		it("a restart during the return leg heads along the path forwards again", () => {
			const obj = { x: 0 };
			const tween = make(obj).to(
				{ x: [50, 100] },
				{ duration: 100, yoyo: true, repeat: 1 },
			);
			tween.start(0);
			tween.update(100); // forward leg done, path now reversed
			tween.update(50); // halfway home, at 50
			expect(obj.x).toBeCloseTo(50, 5);
			tween.start(0);
			expect(tween._valuesEnd.x).toEqual([50, 50, 100]);
			tween.update(100);
			expect(obj.x).toBeCloseTo(100, 5);
		});

		it("a number yoyo restarted during the return leg heads for its target again", () => {
			const obj = { x: 0 };
			const tween = make(obj).to(
				{ x: 100 },
				{ duration: 100, yoyo: true, repeat: 1 },
			);
			tween.start(0);
			tween.update(100);
			tween.update(50); // halfway home
			expect(obj.x).toBeCloseTo(50, 5);
			tween.start(0);
			tween.update(100);
			expect(obj.x).toBeCloseTo(100, 5);
		});
	});
});
