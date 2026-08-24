import {
	afterAll,
	beforeAll,
	describe,
	expect,
	onTestFinished,
	test,
	vi,
} from "vitest";
import { Application, timer, video } from "../src/index.js";

describe("Timer", () => {
	let app;

	beforeAll(async () => {
		// Canvas: this suite only drives the timer; an unspecified renderer
		// resolved to WebGL and held a context for the whole session.
		app = new Application(100, 100, { renderer: video.CANVAS });
		await app.init();
	});

	afterAll(() => {
		// tear the application down rather than leaving its canvas,
		// listeners and timers live in the shared browser session for
		// the rest of the run
		app?.destroy();
	});

	describe("setTimeout", () => {
		test("calls the provided function when enough time have elapsed", async () => {
			const fn = vi.fn();
			const timerId = timer.setTimeout(fn, 200);
			onTestFinished(() => {
				timer.clearTimer(timerId);
			});
			expect(timer.timers).toHaveLength(1);

			expect(fn).not.toHaveBeenCalled();

			await vi.waitFor(() => {
				expect(fn).toHaveBeenCalled();
			});
			expect(timer.timers).toHaveLength(0);
		});

		test("calls function with args", async () => {
			const fn = vi.fn();
			const timerId = timer.setTimeout(fn, 200, false, 1, 2, 3);
			onTestFinished(() => {
				timer.clearTimer(timerId);
			});

			expect(fn).not.toHaveBeenCalled();

			await vi.waitFor(
				() => {
					expect(fn).toHaveBeenCalledWith(1, 2, 3);
				},
				{ timeout: 8000 },
			);
		});
	});

	describe("setInterval", () => {
		test("calls the provided function when enough time have elapsed", async () => {
			const fn = vi.fn();
			const timerId = timer.setInterval(fn, 100);
			onTestFinished(() => {
				timer.clearTimer(timerId);
			});

			expect(timer.timers).toHaveLength(1);

			expect(fn).not.toHaveBeenCalled();

			// Assert "fires repeatedly" (the setInterval contract) instead of
			// an exact call count — under CI load, `vi.waitFor`'s first poll
			// can land past the target N, and the equality condition never
			// becomes true again. Two calls is enough to prove it's an
			// interval and not a one-shot.
			await vi.waitFor(
				() => {
					expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
				},
				// engine timers advance with the game loop, so this is bounded by
				// how promptly the browser schedules it. The default 1s budget is
				// enough on an idle machine and not enough on a loaded one — the
				// assertion is unchanged, only the patience.
				{ timeout: 8000 },
			);
		});

		test("calls function with args", async () => {
			const fn = vi.fn();
			const timerId = timer.setInterval(fn, 200, false, 1, 2, 3);
			onTestFinished(() => {
				timer.clearTimer(timerId);
			});

			expect(fn).not.toHaveBeenCalled();

			await vi.waitFor(
				() => {
					expect(fn).toHaveBeenCalledWith(1, 2, 3);
				},
				{ timeout: 8000 },
			);
		});
	});

	test("can clear timer", () => {
		const fn = vi.fn();
		const timerId = timer.setTimeout(fn, 100);
		expect(timer.timers).toHaveLength(1);

		timer.clearTimer(timerId);
		expect(timer.timers).toHaveLength(0);
	});

	test("can attempt to clear timer with any id", () => {
		timer.clearTimer("THIS_TIMER_ID_IS_NOT_REAL");
	});

	describe("updateTimers mutating the list it iterates", () => {
		/**
		 * `updateTimers()` walks `this.timers` with `for...of` while the
		 * non-repeating branch calls `clearTimer()`, which splices that same
		 * array synchronously. Splicing during a `for...of` shifts every later
		 * element down one, so the entry after a fired one-shot is skipped for
		 * that tick.
		 *
		 * The public `clearTimeout` defers removal for exactly this reason; the
		 * engine's own internal call did not. Symptom is silent: two timers due
		 * on the same tick, only one fires, and the other is a frame late.
		 */

		/** drive one tick of `dt` ms through the timer directly */
		const tick = (dt) => {
			timer.delta = dt;
			timer.updateTimers();
		};

		test("two one-shots due on the same tick both fire", () => {
			const order = [];
			const a = timer.setTimeout(() => {
				return order.push("a");
			}, 100);
			const b = timer.setTimeout(() => {
				return order.push("b");
			}, 100);
			onTestFinished(() => {
				timer.clearTimer(a);
				timer.clearTimer(b);
			});

			tick(150);
			expect(order).toEqual(["a", "b"]);
		});

		test("three one-shots due on the same tick all fire", () => {
			const order = [];
			const ids = [1, 2, 3].map((n) => {
				return timer.setTimeout(() => {
					return order.push(n);
				}, 100);
			});
			onTestFinished(() => {
				for (const id of ids) {
					timer.clearTimer(id);
				}
			});

			tick(150);
			expect(order).toEqual([1, 2, 3]);
		});

		test("a callback clearing another pending timer does not skip a third", () => {
			// user code mutating the list mid-iteration, the same class as the
			// internal splice
			const order = [];
			let victim;
			const first = timer.setTimeout(() => {
				order.push("first");
				timer.clearTimer(victim);
			}, 100);
			victim = timer.setTimeout(() => {
				return order.push("victim");
			}, 100);
			const third = timer.setTimeout(() => {
				return order.push("third");
			}, 100);
			onTestFinished(() => {
				timer.clearTimer(first);
				timer.clearTimer(third);
			});

			tick(150);
			// the victim is legitimately cancelled; the third must still run
			expect(order).toContain("first");
			expect(order).toContain("third");
			expect(order).not.toContain("victim");
		});

		test("a repeating timer beside a one-shot is not skipped", () => {
			const order = [];
			const once = timer.setTimeout(() => {
				return order.push("once");
			}, 100);
			const every = timer.setInterval(() => {
				return order.push("every");
			}, 100);
			onTestFinished(() => {
				timer.clearTimer(once);
				timer.clearTimer(every);
			});

			tick(150);
			expect(order).toEqual(["once", "every"]);
		});
	});
});
