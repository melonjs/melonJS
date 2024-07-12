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

			await vi.waitFor(() => {
				expect(fn).toHaveBeenCalledWith(1, 2, 3);
			});
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

			await vi.waitFor(() => {
				expect(fn).toHaveBeenCalledTimes(5);
			});
		});

		test("calls function with args", async () => {
			const fn = vi.fn();
			const timerId = timer.setInterval(fn, 200, false, 1, 2, 3);
			onTestFinished(() => {
				timer.clearTimer(timerId);
			});

			expect(fn).not.toHaveBeenCalled();

			await vi.waitFor(() => {
				expect(fn).toHaveBeenCalledWith(1, 2, 3);
			});
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
