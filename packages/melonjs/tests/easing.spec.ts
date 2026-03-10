import { describe, expect, it } from "vitest";
import { Easing } from "../src/tweens/easing.js";

describe("Easing", () => {
	// Tolerance for floating point comparisons
	const EPSILON = 1e-6;

	describe("Linear", () => {
		it("None should return the input value unchanged", () => {
			expect(Easing.Linear.None(0)).toBeCloseTo(0, 6);
			expect(Easing.Linear.None(0.25)).toBeCloseTo(0.25, 6);
			expect(Easing.Linear.None(0.5)).toBeCloseTo(0.5, 6);
			expect(Easing.Linear.None(0.75)).toBeCloseTo(0.75, 6);
			expect(Easing.Linear.None(1)).toBeCloseTo(1, 6);
		});

		it("None should be monotonically increasing", () => {
			let prev = Easing.Linear.None(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Linear.None(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});
	});

	describe("Quadratic", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Quadratic.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Quadratic.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Quadratic.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Quadratic.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Quadratic.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Quadratic.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Quadratic.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should be monotonically increasing", () => {
			let prev = Easing.Quadratic.In(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Quadratic.In(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("Out should be monotonically increasing", () => {
			let prev = Easing.Quadratic.Out(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Quadratic.Out(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("InOut should be monotonically increasing", () => {
			let prev = Easing.Quadratic.InOut(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Quadratic.InOut(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("In should produce expected values", () => {
			expect(Easing.Quadratic.In(0.5)).toBeCloseTo(0.25, 6);
		});
	});

	describe("Cubic", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Cubic.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Cubic.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Cubic.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Cubic.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Cubic.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Cubic.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Cubic.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should be monotonically increasing", () => {
			let prev = Easing.Cubic.In(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Cubic.In(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("In should produce expected values", () => {
			expect(Easing.Cubic.In(0.5)).toBeCloseTo(0.125, 6);
		});
	});

	describe("Quartic", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Quartic.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Quartic.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Quartic.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Quartic.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Quartic.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Quartic.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Quartic.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should be monotonically increasing", () => {
			let prev = Easing.Quartic.In(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Quartic.In(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("In should produce expected values", () => {
			expect(Easing.Quartic.In(0.5)).toBeCloseTo(0.0625, 6);
		});
	});

	describe("Quintic", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Quintic.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Quintic.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Quintic.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Quintic.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Quintic.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Quintic.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Quintic.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should be monotonically increasing", () => {
			let prev = Easing.Quintic.In(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Quintic.In(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("In should produce expected values", () => {
			expect(Easing.Quintic.In(0.5)).toBeCloseTo(0.03125, 6);
		});
	});

	describe("Sinusoidal", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Sinusoidal.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Sinusoidal.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Sinusoidal.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Sinusoidal.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Sinusoidal.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Sinusoidal.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Sinusoidal.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should be monotonically increasing", () => {
			let prev = Easing.Sinusoidal.In(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Sinusoidal.In(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("Out should be monotonically increasing", () => {
			let prev = Easing.Sinusoidal.Out(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Sinusoidal.Out(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});
	});

	describe("Exponential", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Exponential.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Exponential.In(1)).toBeCloseTo(1, 2);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Exponential.Out(0)).toBeCloseTo(0, 2);
			expect(Easing.Exponential.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Exponential.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Exponential.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Exponential.InOut(0.5)).toBeCloseTo(0.5, 2);
		});

		it("In(0) should return exactly 0", () => {
			expect(Easing.Exponential.In(0)).toBe(0);
		});

		it("Out(1) should return exactly 1", () => {
			expect(Easing.Exponential.Out(1)).toBe(1);
		});
	});

	describe("Circular", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Circular.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Circular.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Circular.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Circular.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Circular.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Circular.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Circular.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should be monotonically increasing", () => {
			let prev = Easing.Circular.In(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Circular.In(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});

		it("Out should be monotonically increasing", () => {
			let prev = Easing.Circular.Out(0);
			for (let t = 0.01; t <= 1.0; t += 0.01) {
				const current = Easing.Circular.Out(t);
				expect(current).toBeGreaterThanOrEqual(prev);
				prev = current;
			}
		});
	});

	describe("Elastic", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Elastic.In(0)).toBe(0);
			expect(Easing.Elastic.In(1)).toBe(1);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Elastic.Out(0)).toBe(0);
			expect(Easing.Elastic.Out(1)).toBe(1);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Elastic.InOut(0)).toBe(0);
			expect(Easing.Elastic.InOut(1)).toBe(1);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Elastic.InOut(0.5)).toBeCloseTo(0.5, 1);
		});

		it("In should oscillate (go below 0 for some values)", () => {
			// Elastic In overshoots below 0 before reaching 1
			let hasNegative = false;
			for (let t = 0.01; t < 1.0; t += 0.01) {
				if (Easing.Elastic.In(t) < 0) {
					hasNegative = true;
					break;
				}
			}
			expect(hasNegative).toBe(true);
		});

		it("Out should oscillate (go above 1 for some values)", () => {
			let hasOvershoot = false;
			for (let t = 0.01; t < 1.0; t += 0.01) {
				if (Easing.Elastic.Out(t) > 1) {
					hasOvershoot = true;
					break;
				}
			}
			expect(hasOvershoot).toBe(true);
		});
	});

	describe("Back", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Back.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Back.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Back.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Back.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Back.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Back.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Back.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("In should go below 0 (overshoot backwards)", () => {
			let hasNegative = false;
			for (let t = 0.01; t < 1.0; t += 0.01) {
				if (Easing.Back.In(t) < 0) {
					hasNegative = true;
					break;
				}
			}
			expect(hasNegative).toBe(true);
		});

		it("Out should go above 1 (overshoot forwards)", () => {
			let hasOvershoot = false;
			for (let t = 0.01; t < 1.0; t += 0.01) {
				if (Easing.Back.Out(t) > 1) {
					hasOvershoot = true;
					break;
				}
			}
			expect(hasOvershoot).toBe(true);
		});
	});

	describe("Bounce", () => {
		it("In should satisfy boundary conditions", () => {
			expect(Easing.Bounce.In(0)).toBeCloseTo(0, 6);
			expect(Easing.Bounce.In(1)).toBeCloseTo(1, 6);
		});

		it("Out should satisfy boundary conditions", () => {
			expect(Easing.Bounce.Out(0)).toBeCloseTo(0, 6);
			expect(Easing.Bounce.Out(1)).toBeCloseTo(1, 6);
		});

		it("InOut should satisfy boundary conditions", () => {
			expect(Easing.Bounce.InOut(0)).toBeCloseTo(0, 6);
			expect(Easing.Bounce.InOut(1)).toBeCloseTo(1, 6);
		});

		it("InOut(0.5) should be approximately 0.5", () => {
			expect(Easing.Bounce.InOut(0.5)).toBeCloseTo(0.5, 6);
		});

		it("Out values should stay between 0 and 1", () => {
			for (let t = 0; t <= 1.0; t += 0.01) {
				const val = Easing.Bounce.Out(t);
				expect(val).toBeGreaterThanOrEqual(0);
				expect(val).toBeLessThanOrEqual(1);
			}
		});

		it("In values should stay between 0 and 1", () => {
			for (let t = 0; t <= 1.0; t += 0.01) {
				const val = Easing.Bounce.In(t);
				expect(val).toBeGreaterThanOrEqual(0);
				expect(val).toBeLessThanOrEqual(1);
			}
		});

		it("Out should produce expected values at specific points", () => {
			// At k = 0.5 (within second bounce segment: 1/2.75 < 0.5 < 2/2.75)
			const val = Easing.Bounce.Out(0.5);
			expect(val).toBeGreaterThan(0.5);
			expect(val).toBeLessThan(1);
		});
	});

	describe("All easings boundary conditions", () => {
		const easings: [string, Record<string, (k: number) => number>][] = [
			["Quadratic", Easing.Quadratic],
			["Cubic", Easing.Cubic],
			["Quartic", Easing.Quartic],
			["Quintic", Easing.Quintic],
			["Sinusoidal", Easing.Sinusoidal],
			["Exponential", Easing.Exponential],
			["Circular", Easing.Circular],
			["Elastic", Easing.Elastic],
			["Back", Easing.Back],
			["Bounce", Easing.Bounce],
		];

		for (const [name, easing] of easings) {
			it(`${name}.In(0) should be approximately 0`, () => {
				expect(Math.abs(easing.In(0))).toBeLessThan(EPSILON);
			});

			it(`${name}.In(1) should be approximately 1`, () => {
				expect(Math.abs(easing.In(1) - 1)).toBeLessThan(EPSILON);
			});

			it(`${name}.Out(0) should be approximately 0`, () => {
				expect(Math.abs(easing.Out(0))).toBeLessThan(EPSILON);
			});

			it(`${name}.Out(1) should be approximately 1`, () => {
				expect(Math.abs(easing.Out(1) - 1)).toBeLessThan(EPSILON);
			});

			it(`${name}.InOut(0) should be approximately 0`, () => {
				expect(Math.abs(easing.InOut(0))).toBeLessThan(EPSILON);
			});

			it(`${name}.InOut(1) should be approximately 1`, () => {
				expect(Math.abs(easing.InOut(1) - 1)).toBeLessThan(EPSILON);
			});
		}
	});
});
