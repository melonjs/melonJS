import { describe, expect, it } from "vitest";
import { math } from "../src/index.js";

describe("Math", () => {
	describe("degToRad", () => {
		it("0 should be 0", () => {
			expect(math.degToRad(0)).toEqual(0);
		});

		it("180 should be Pi", () => {
			expect(math.degToRad(180)).toEqual(Math.PI);
		});

		it("360 should be Pi * 2", () => {
			expect(math.degToRad(360)).toEqual(Math.PI * 2);
		});
	});

	describe("clamp", () => {
		it("should clamp low", () => {
			expect(math.clamp(-30, 1, 10)).toEqual(1);
		});

		it("should clamp high", () => {
			expect(math.clamp(30, 1, 10)).toEqual(10);
		});

		it("should not clamp", () => {
			expect(math.clamp(Math.PI, 1, 10)).toEqual(Math.PI);
		});
	});

	describe("lerp", () => {
		it("returns a at t=0", () => {
			expect(math.lerp(10, 20, 0)).toEqual(10);
		});

		it("returns b at t=1", () => {
			expect(math.lerp(10, 20, 1)).toEqual(20);
		});

		it("returns the midpoint at t=0.5", () => {
			expect(math.lerp(10, 20, 0.5)).toEqual(15);
		});

		it("does NOT clamp — t > 1 extrapolates past b", () => {
			expect(math.lerp(10, 20, 1.5)).toEqual(25);
		});

		it("does NOT clamp — t < 0 extrapolates past a", () => {
			expect(math.lerp(10, 20, -0.5)).toEqual(5);
		});

		it("a > b — direction reverses correctly", () => {
			expect(math.lerp(20, 10, 0.25)).toEqual(17.5);
		});

		it("equal endpoints — t doesn't matter", () => {
			expect(math.lerp(7, 7, 0)).toEqual(7);
			expect(math.lerp(7, 7, 0.5)).toEqual(7);
			expect(math.lerp(7, 7, 1)).toEqual(7);
			expect(math.lerp(7, 7, 999)).toEqual(7);
		});

		it("propagates NaN — any NaN input yields NaN", () => {
			expect(math.lerp(Number.NaN, 10, 0.5)).toBeNaN();
			expect(math.lerp(0, Number.NaN, 0.5)).toBeNaN();
			expect(math.lerp(0, 10, Number.NaN)).toBeNaN();
		});

		it("Infinity in either endpoint propagates as Infinity OR NaN per IEEE 754", () => {
			// Per IEEE 754, `+Inf + (−Inf) = NaN`. So lerp(+Inf, 0, t)
			// with t ∈ (0, 1) actually returns NaN, NOT +Inf — the
			// `(b - a)` step produces -Inf and the outer addition with
			// `a = +Inf` yields NaN. Documented edge case; users
			// shouldn't feed Infinity through lerp.
			expect(math.lerp(Number.POSITIVE_INFINITY, 0, 0.5)).toBeNaN();
			// On the other hand `0 + (+Inf - 0) * 0.5 = +Inf`, which
			// IS well-defined.
			expect(math.lerp(0, Number.POSITIVE_INFINITY, 0.5)).toBe(
				Number.POSITIVE_INFINITY,
			);
		});
	});

	describe("damp", () => {
		// Per-step formula: x_new = x + (target - x) * (1 - exp(-λ·dt))
		// Closed form after total elapsed `T` seconds: result =
		// current + (target - current) * (1 - exp(-λ·T)), INDEPENDENT
		// of how T was split across dt calls — this is the whole point
		// of the function.

		it("returns current when dt=0 (no time elapsed → no movement)", () => {
			expect(math.damp(0, 100, 5, 0)).toEqual(0);
		});

		it("returns current when lambda=0 (no decay → no movement)", () => {
			expect(math.damp(0, 100, 0, 1)).toEqual(0);
		});

		it("snaps to target when lambda * dt is huge (exp(-Inf) → 0)", () => {
			expect(math.damp(0, 100, 1e308, 1)).toEqual(100);
			expect(math.damp(0, 100, Number.POSITIVE_INFINITY, 1)).toEqual(100);
		});

		it("equal current and target — never moves", () => {
			expect(math.damp(50, 50, 5, 1)).toEqual(50);
			expect(math.damp(50, 50, 5, 1e6)).toEqual(50);
		});

		it("formula sanity: λ=5, dt=1, current=0, target=100 → ~99.326", () => {
			// 1 - exp(-5) ≈ 0.9932620530...
			expect(math.damp(0, 100, 5, 1)).toBeCloseTo(99.3262, 3);
		});

		it("frame-rate independence: 60 Hz, 30 Hz, 144 Hz converge identically over 1 second", () => {
			// The KEY property — same total elapsed `dt`, same result
			// regardless of frame rate. Without this, smooth follow
			// looks different on different hardware.
			const target = 100;
			const lambda = 5;
			const sim = (steps, dt) => {
				let x = 0;
				for (let i = 0; i < steps; i++) {
					x = math.damp(x, target, lambda, dt);
				}
				return x;
			};
			const at60 = sim(60, 1 / 60);
			const at30 = sim(30, 1 / 30);
			const at144 = sim(144, 1 / 144);
			expect(at60).toBeCloseTo(at30, 9);
			expect(at60).toBeCloseTo(at144, 9);
			// And matches the closed form: 100 * (1 - exp(-5)) ≈ 99.326.
			expect(at60).toBeCloseTo(99.3262, 3);
		});

		it("monotonic approach — never overshoots target", () => {
			// For positive lambda + dt, repeated damp() never goes past
			// the target. Catches a sign-flip in the formula.
			let x = 0;
			for (let i = 0; i < 1000; i++) {
				x = math.damp(x, 100, 5, 1 / 60);
				expect(x).toBeLessThanOrEqual(100);
			}
		});

		it("works going DOWN as well as up (negative delta)", () => {
			// `target < current` — must still converge correctly.
			const r = math.damp(100, 0, 5, 1);
			expect(r).toBeCloseTo(0.6738, 3); // 100 * exp(-5)
			expect(r).toBeGreaterThan(0);
		});

		it("dt very small (microsecond scale) — graceful linear regime", () => {
			// For small lambda*dt, the Taylor expansion gives
			// (1 - exp(-x)) ≈ x - x²/2 + …; result is `100 · 5e-6` to
			// leading order, with an O(λ²·dt²) error ≈ 1.25e-9. So
			// `toBeCloseTo(…, 7)` (within 5e-8) — wider than the
			// approximation error but still tight enough to catch a
			// catastrophic loss of precision.
			const r = math.damp(0, 100, 5, 1e-6);
			expect(r).toBeCloseTo(100 * 5e-6, 7);
		});

		it("negative dt would move AWAY from target — documented as undefined", () => {
			// With negative dt, exp(-λ·-dt) = exp(λ·dt) > 1, so
			// (1 - that) is negative — current moves AWAY from target.
			// Callers must clamp dt at the call site; we don't.
			const r = math.damp(0, 100, 5, -1);
			expect(r).toBeLessThan(0);
		});

		it("propagates NaN — any NaN input yields NaN", () => {
			expect(math.damp(Number.NaN, 100, 5, 1)).toBeNaN();
			expect(math.damp(0, Number.NaN, 5, 1)).toBeNaN();
			expect(math.damp(0, 100, Number.NaN, 1)).toBeNaN();
			expect(math.damp(0, 100, 5, Number.NaN)).toBeNaN();
		});

		it("classic 'lerp smoothing is broken' demo — fixed-alpha lerp is NOT frame-rate independent", () => {
			// Sanity check that we're solving the right problem.
			// `lerp(x, target, 0.1)` per frame at 60 fps vs 30 fps
			// produces a measurably different result over the same
			// total time.
			const target = 100;
			const lerpSim = (steps) => {
				let x = 0;
				for (let i = 0; i < steps; i++) {
					x = math.lerp(x, target, 0.1);
				}
				return x;
			};
			const at60 = lerpSim(60); // 1 second @ 60 fps
			const at30 = lerpSim(30); // 1 second @ 30 fps
			// These ARE different, demonstrating the broken-ness:
			expect(Math.abs(at60 - at30)).toBeGreaterThan(0.05);
		});
	});

	describe("random", () => {
		const a = math.random(1, 10);

		it("should be >= 1", () => {
			expect(a).toBeGreaterThanOrEqual(1);
		});

		it("should be < 10", () => {
			expect(a).toBeLessThanOrEqual(10);
		});

		it("should be a whole number", () => {
			expect(Math.floor(a)).toEqual(a);
		});
	});

	describe("randomFloat", () => {
		// Existing single-sample tests retained for legacy coverage;
		// the adversarial block below pins distribution + edges.
		const a = math.randomFloat(1, 10);

		it("should be >= 1", () => {
			expect(a).toBeGreaterThanOrEqual(1);
		});

		it("should be < 10", () => {
			expect(a).toBeLessThanOrEqual(10);
		});

		it("every sample of 1000 falls in [min, max)", () => {
			for (let i = 0; i < 1000; i++) {
				const r = math.randomFloat(1, 10);
				expect(r).toBeGreaterThanOrEqual(1);
				expect(r).toBeLessThan(10);
			}
		});

		it("distribution is roughly uniform — mean of 10k samples is near (min+max)/2", () => {
			let sum = 0;
			const N = 10000;
			for (let i = 0; i < N; i++) {
				sum += math.randomFloat(0, 100);
			}
			const mean = sum / N;
			// expected 50; allow ±2 for sampling noise (~3σ for N=10k)
			expect(mean).toBeGreaterThan(48);
			expect(mean).toBeLessThan(52);
		});

		it("min == max returns exactly that value", () => {
			expect(math.randomFloat(7, 7)).toEqual(7);
			expect(math.randomFloat(-3.14, -3.14)).toEqual(-3.14);
		});

		it("negative range works (both bounds negative)", () => {
			for (let i = 0; i < 100; i++) {
				const r = math.randomFloat(-10, -1);
				expect(r).toBeGreaterThanOrEqual(-10);
				expect(r).toBeLessThan(-1);
			}
		});

		it("range spanning zero (min < 0 < max)", () => {
			let sawNeg = false;
			let sawPos = false;
			for (let i = 0; i < 200; i++) {
				const r = math.randomFloat(-5, 5);
				expect(r).toBeGreaterThanOrEqual(-5);
				expect(r).toBeLessThan(5);
				if (r < 0) {
					sawNeg = true;
				}
				if (r >= 0) {
					sawPos = true;
				}
			}
			expect(sawNeg).toEqual(true);
			expect(sawPos).toEqual(true);
		});

		it("min > max is documented as undefined — implementation returns (max, min]", () => {
			// `Math.random() * (max - min)` is NEGATIVE when min > max,
			// so `randomFloat(10, 1)` returns values in `(1, 10]` — same
			// extent as the inverted call but at the OPPOSITE boundary
			// inclusivity. Callers should pass `min ≤ max`; we pin the
			// inverted behavior here so a future change is intentional.
			for (let i = 0; i < 100; i++) {
				const r = math.randomFloat(10, 1);
				expect(r).toBeGreaterThan(1);
				expect(r).toBeLessThanOrEqual(10);
			}
		});

		it("very small range stays in range (no float drift)", () => {
			for (let i = 0; i < 100; i++) {
				const r = math.randomFloat(1.0, 1.000001);
				expect(r).toBeGreaterThanOrEqual(1.0);
				expect(r).toBeLessThan(1.000001);
			}
		});
	});

	describe("weightedRandom", () => {
		const a = math.weightedRandom(1, 10);

		it("should be >= 1", () => {
			expect(a).toBeGreaterThanOrEqual(1);
		});

		it("should be < 10", () => {
			expect(a).toBeLessThanOrEqual(10);
		});

		it("should be a whole number", () => {
			expect(Math.floor(a)).toEqual(a);
		});
	});

	describe("round", () => {
		const a = math.round(Math.PI, 4);

		it("Pi should be 3.1416", () => {
			expect(a).toEqual(3.1416);
		});
	});

	describe("POT", () => {
		it("32 is a Power of 2", () => {
			expect(math.isPowerOfTwo(32)).toEqual(true);
		});
		it("1027 is not a Power of 2", () => {
			expect(math.isPowerOfTwo(1027)).toEqual(false);
		});

		it("next Power of 2 for 1000", () => {
			expect(math.nextPowerOfTwo(1000)).toEqual(1024);
		});
		it("next Power of 2 for 32", () => {
			expect(math.nextPowerOfTwo(32)).toEqual(32);
		});
	});

	describe("Power of 4", () => {
		it("16 is a Power of 4", () => {
			expect(math.isPowerOfFour(16)).toEqual(true);
		});
		it("64 is a Power of 4", () => {
			expect(math.isPowerOfFour(64)).toEqual(true);
		});
		it("3 is not a Power of 4", () => {
			expect(math.isPowerOfFour(3)).toEqual(false);
		});
		it("15 is not a Power of 4", () => {
			expect(math.isPowerOfFour(15)).toEqual(false);
		});
	});

	describe("lerpArray", () => {
		it("should return the single value for a 1-element array", () => {
			expect(math.lerpArray([5], 0)).toBe(5);
			expect(math.lerpArray([5], 0.5)).toBe(5);
			expect(math.lerpArray([5], 1)).toBe(5);
		});

		it("should interpolate linearly between two values", () => {
			expect(math.lerpArray([0, 10], 0)).toBe(0);
			expect(math.lerpArray([0, 10], 0.25)).toBe(2.5);
			expect(math.lerpArray([0, 10], 0.5)).toBe(5);
			expect(math.lerpArray([0, 10], 0.75)).toBe(7.5);
			expect(math.lerpArray([0, 10], 1)).toBe(10);
		});

		it("should interpolate across multiple segments", () => {
			expect(math.lerpArray([0, 10, 20], 0)).toBe(0);
			expect(math.lerpArray([0, 10, 20], 0.25)).toBe(5);
			expect(math.lerpArray([0, 10, 20], 0.5)).toBe(10);
			expect(math.lerpArray([0, 10, 20], 0.75)).toBe(15);
			expect(math.lerpArray([0, 10, 20], 1)).toBe(20);
		});

		it("should handle non-uniform values", () => {
			expect(math.lerpArray([1, 0.5, 0], 0)).toBe(1);
			expect(math.lerpArray([1, 0.5, 0], 0.5)).toBe(0.5);
			expect(math.lerpArray([1, 0.5, 0], 1)).toBe(0);
		});

		it("should handle boundaries correctly with 4+ values", () => {
			expect(math.lerpArray([10, 20, 30, 40], 0)).toBe(10);
			expect(math.lerpArray([10, 20, 30, 40], 1)).toBe(40);
		});

		it("should interpolate at segment boundaries", () => {
			// [0, 100, 200, 300] has 3 segments, each at 1/3 intervals
			expect(math.lerpArray([0, 100, 200, 300], 1 / 3)).toBeCloseTo(100, 10);
			expect(math.lerpArray([0, 100, 200, 300], 2 / 3)).toBeCloseTo(200, 10);
		});

		it("should handle position at exactly 1.0", () => {
			expect(math.lerpArray([0, 50, 100], 1)).toBe(100);
			expect(math.lerpArray([10, 20], 1)).toBe(20);
		});

		it("should handle position at exactly 0.0", () => {
			expect(math.lerpArray([42, 99], 0)).toBe(42);
			expect(math.lerpArray([0, 10, 20, 30], 0)).toBe(0);
		});

		it("should handle position beyond 1.0", () => {
			// position > 1 hits the idx >= last early return
			expect(math.lerpArray([0, 10, 20], 1.5)).toBe(20);
			expect(math.lerpArray([5, 15], 2)).toBe(15);
		});

		it("should handle negative position", () => {
			// ~~(negative) truncates toward zero → idx = 0, frac is negative
			// result extrapolates below first value
			expect(math.lerpArray([10, 20], -0.5)).toBe(5);
		});

		it("should handle identical values", () => {
			expect(math.lerpArray([7, 7, 7], 0)).toBe(7);
			expect(math.lerpArray([7, 7, 7], 0.5)).toBe(7);
			expect(math.lerpArray([7, 7, 7], 1)).toBe(7);
		});

		it("should handle two identical values", () => {
			expect(math.lerpArray([3, 3], 0.5)).toBe(3);
		});

		it("should handle descending values", () => {
			expect(math.lerpArray([100, 0], 0.5)).toBe(50);
			expect(math.lerpArray([100, 50, 0], 0.5)).toBe(50);
		});

		it("should handle negative values in the array", () => {
			expect(math.lerpArray([-10, 10], 0.5)).toBe(0);
			expect(math.lerpArray([-20, -10, 0], 0.5)).toBe(-10);
		});

		it("should handle very small fractional positions", () => {
			expect(math.lerpArray([0, 1000], 0.001)).toBeCloseTo(1, 5);
			expect(math.lerpArray([0, 1000], 0.999)).toBeCloseTo(999, 5);
		});
	});

	describe("toBeCloseTo", () => {
		it("4.3546731 is closed to 4.3547", () => {
			const value = 4.3546731;
			expect(math.toBeCloseTo(4.3547, value, 0)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 1)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 2)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 3)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 4)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 5)).toEqual(false);
			expect(math.toBeCloseTo(4.3547, value, 6)).toEqual(false);
		});

		it("4.8 is closed to 5 but not to 4", () => {
			const value = 4.8;
			expect(math.toBeCloseTo(5, value, 0)).toEqual(true);
			expect(math.toBeCloseTo(4, value, 0)).toEqual(false);
		});
	});
});
