import { beforeAll, describe, expect, onTestFinished, test, vi } from "vitest";
import { timer } from "../src/index.js";
import { init } from "../src/video/video.js";

describe("Timer", () => {
	beforeAll(() => {
		init(100, 100);
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
});
