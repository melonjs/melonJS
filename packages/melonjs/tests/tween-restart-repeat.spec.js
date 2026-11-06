/**
 * A repeating (or yoyo) tween started again repeats again.
 *
 * `repeat(n)` stored the count in `_repeat`, and `update()` counts `_repeat`
 * down as the cycles play. `start()` never restored it, so once a tween had
 * finished, starting it again (by hand, or a chain coming back round) ran a
 * single cycle: a pulse that repeats three times pulsed once on replay, and
 * a yoyo stopped at the far end instead of coming back.
 *
 * The configured count is now kept apart (`_repeatCount`) and every
 * `start()` restores it.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Tween } from "../src/index.js";

describe("Tween : restarting a repeating tween", () => {
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

	// drive the tween in `step` ms ticks until it completes; returns the
	// number of cycles it ran (a cycle ends when the eased value reaches 1)
	const runToEnd = (tween, step = 100, limit = 100) => {
		let cycles = 0;
		tween.onUpdate((value) => {
			if (value === 1) {
				cycles++;
			}
		});
		for (let i = 0; i < limit; i++) {
			if (tween.update(step) === false) {
				return cycles;
			}
		}
		throw new Error("tween never completed");
	};

	it("runs the configured repeats on every start()", () => {
		const obj = { x: 0 };
		const tween = make(obj).to({ x: 10 }, { duration: 100 }).repeat(2);
		tween.start(0);
		expect(runToEnd(tween)).toBe(3);
		obj.x = 0;
		tween.start(1000);
		expect(runToEnd(tween)).toBe(3);
		tween.start(5000);
		expect(runToEnd(tween)).toBe(3);
	});

	it("the `repeat` option of to() is restored too", () => {
		const obj = { x: 0 };
		const tween = make(obj).to({ x: 10 }, { duration: 100, repeat: 1 });
		tween.start(0);
		expect(runToEnd(tween)).toBe(2);
		tween.start(1000);
		expect(runToEnd(tween)).toBe(2);
	});

	it("a finished yoyo tween started again comes back to its start", () => {
		const obj = { x: 0 };
		const tween = make(obj).to(
			{ x: 10 },
			{ duration: 100, yoyo: true, repeat: 1 },
		);
		tween.start(0);
		tween.update(100);
		expect(obj.x).toBe(10);
		expect(tween.update(100)).toBe(false);
		expect(obj.x).toBe(0);

		tween.start(1000);
		tween.update(100);
		expect(obj.x).toBe(10);
		tween.update(50);
		expect(obj.x).toBe(5);
		expect(tween.update(50)).toBe(false);
		expect(obj.x).toBe(0);
	});

	it("restarting mid-run starts the count over", () => {
		const obj = { x: 0 };
		const tween = make(obj).to({ x: 10 }, { duration: 100 }).repeat(3);
		tween.start(0);
		tween.update(100);
		tween.update(100); // two repeats used
		obj.x = 0;
		tween.start(1000);
		expect(runToEnd(tween)).toBe(4);
	});

	it("an endless tween keeps looping after a restart", () => {
		const obj = { x: 0 };
		const tween = make(obj).to({ x: 10 }, { duration: 100 }).repeat(Infinity);
		tween.start(0);
		tween.update(500);
		tween.start(1000);
		for (let i = 0; i < 20; i++) {
			expect(tween.update(100)).toBe(true);
		}
	});

	it("a chain coming back round repeats each time", () => {
		const obj = { x: 0 };
		const out = make(obj).to({ x: 10 }, { duration: 100 }).repeat(1);
		const back = make(obj).to({ x: 0 }, { duration: 100 });
		out.chain(back);
		back.chain(out);
		let outCycles = 0;
		out.onUpdate((value) => {
			if (value === 1) {
				outCycles++;
			}
		});
		out.start(0);
		out.update(100);
		expect(out.update(100)).toBe(false); // 2 cycles, starts `back`
		expect(back.update(100)).toBe(false); // starts `out` again
		expect(outCycles).toBe(2);
		expect(out.update(100)).toBe(true); // repeats, as the first time
		expect(out.update(100)).toBe(false);
		expect(outCycles).toBe(4);
	});

	it("a recycled tween does not inherit the previous repeat count", () => {
		const tween = make({ x: 0 });
		tween.to({ x: 10 }, { duration: 100, repeat: 4 }).start(0);
		runToEnd(tween);
		// what the tween pool does on get()
		const obj = { x: 0 };
		tween.onResetEvent(obj);
		tween.to({ x: 10 }, { duration: 100 }).start(1000);
		expect(runToEnd(tween)).toBe(1);
	});
});
