import { describe, expect, test, vi } from "vitest";
import { timer } from "../src/index.js";
import { init } from "../src/video/video.js";

describe("Timer", () => {
	test("calls the provided function when enough time have elapsed", async () => {
		init();
		const delay = 200;
		const fn = vi.fn();
		timer.setTimeout(fn, delay);
		expect(timer.timers).toHaveLength(1);

		expect(fn).not.toHaveBeenCalled();

		await vi.waitFor(
			() => {
				expect(fn).toHaveBeenCalled();
			},
			{ timeout: delay + 1 },
		);
		expect(timer.timers).toHaveLength(0);
	});
});
