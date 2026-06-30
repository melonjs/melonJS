import { describe, expect, it } from "vitest";
import { Noise } from "../src/index.js";

/**
 * `Noise` is the renderer-free coherent-noise algorithm. The load-bearing
 * invariant is determinism (same seed ⇒ same field); everything else (range,
 * continuity, per-type behavior) builds on that.
 */
describe("Noise", () => {
	const TYPES = ["simplex", "perlin", "value", "valueCubic", "cellular"];

	it("is deterministic — same seed reproduces the same value", () => {
		const a = new Noise({ seed: 1337, frequency: 0.05 });
		const b = new Noise({ seed: 1337, frequency: 0.05 });
		for (let i = 0; i < 50; i++) {
			expect(a.getNoise2d(i * 1.3, i * 0.7)).toBe(
				b.getNoise2d(i * 1.3, i * 0.7),
			);
		}
	});

	it("different seeds produce different fields", () => {
		const a = new Noise({ seed: 1, frequency: 0.05 });
		const b = new Noise({ seed: 2, frequency: 0.05 });
		let differences = 0;
		for (let i = 0; i < 50; i++) {
			if (a.getNoise2d(i, i) !== b.getNoise2d(i, i)) {
				differences++;
			}
		}
		expect(differences).toBeGreaterThan(40);
	});

	it("re-seeding changes the field deterministically", () => {
		const n = new Noise({ seed: 5, frequency: 0.05 });
		const before = n.getNoise2d(3, 7);
		n.seedNoise(99);
		const after = n.getNoise2d(3, 7);
		expect(after).not.toBe(before);
		// re-seeding back reproduces the original
		n.seedNoise(5);
		expect(n.getNoise2d(3, 7)).toBe(before);
	});

	it.each(TYPES)("type '%s' stays in a bounded range and varies", (type) => {
		const n = new Noise({ type, seed: 7, frequency: 0.07 });
		let min = Infinity;
		let max = -Infinity;
		for (let y = 0; y < 40; y++) {
			for (let x = 0; x < 40; x++) {
				const v = n.getNoise2d(x, y);
				expect(Number.isFinite(v)).toBe(true);
				expect(Math.abs(v)).toBeLessThanOrEqual(1.5);
				min = Math.min(min, v);
				max = Math.max(max, v);
			}
		}
		// the field actually varies (not constant / all-zero)
		expect(max - min).toBeGreaterThan(0.2);
	});

	it("getNoise3d is deterministic and bounded", () => {
		const a = new Noise({ seed: 3, frequency: 0.05 });
		const b = new Noise({ seed: 3, frequency: 0.05 });
		for (let i = 0; i < 30; i++) {
			const va = a.getNoise3d(i, i * 0.5, i * 0.25);
			expect(va).toBe(b.getNoise3d(i, i * 0.5, i * 0.25));
			expect(Math.abs(va)).toBeLessThanOrEqual(1.5);
		}
	});

	it("animating via the z axis changes a 2D slice", () => {
		const n = new Noise({ seed: 11, frequency: 0.08 });
		const t0 = n.getNoise3d(10, 10, 0);
		const t1 = n.getNoise3d(10, 10, 5);
		expect(t1).not.toBe(t0);
	});

	it("fBm (octaves > 1) stays bounded and defaults fractalType to fbm", () => {
		const n = new Noise({ seed: 2, frequency: 0.04, octaves: 5 });
		expect(n.fractalType).toBe("fbm");
		for (let i = 0; i < 50; i++) {
			expect(Math.abs(n.getNoise2d(i * 2, i))).toBeLessThanOrEqual(1.2);
		}
	});

	it("ridged fractal is bounded", () => {
		const n = new Noise({
			seed: 4,
			frequency: 0.04,
			octaves: 4,
			fractalType: "ridged",
		});
		for (let i = 0; i < 50; i++) {
			expect(Math.abs(n.getNoise2d(i, i * 1.5))).toBeLessThanOrEqual(1.2);
		}
	});

	it("`scale` is an alias for 1 / frequency", () => {
		const byScale = new Noise({ seed: 8, scale: 50 });
		const byFreq = new Noise({ seed: 8, frequency: 1 / 50 });
		expect(byScale.frequency).toBeCloseTo(byFreq.frequency, 10);
		expect(byScale.getNoise2d(12, 34)).toBe(byFreq.getNoise2d(12, 34));
	});

	it("pingPong fractal stays bounded and varies", () => {
		const n = new Noise({
			seed: 9,
			frequency: 0.04,
			octaves: 4,
			fractalType: "pingPong",
		});
		expect(n.fractalType).toBe("pingPong");
		let min = Infinity;
		let max = -Infinity;
		for (let i = 0; i < 60; i++) {
			const v = n.getNoise2d(i, i * 0.6);
			expect(Math.abs(v)).toBeLessThanOrEqual(1.2);
			min = Math.min(min, v);
			max = Math.max(max, v);
		}
		expect(max - min).toBeGreaterThan(0.2);
	});

	it("domain warp perturbs the field deterministically", () => {
		const plain = new Noise({ seed: 3, frequency: 0.04 });
		const warpedA = new Noise({
			seed: 3,
			frequency: 0.04,
			domainWarp: true,
			domainWarpAmp: 40,
		});
		const warpedB = new Noise({
			seed: 3,
			frequency: 0.04,
			domainWarp: true,
			domainWarpAmp: 40,
		});
		let differences = 0;
		for (let i = 0; i < 40; i++) {
			const w = warpedA.getNoise2d(i * 2, i);
			// deterministic with the same settings
			expect(w).toBe(warpedB.getNoise2d(i * 2, i));
			// bounded
			expect(Math.abs(w)).toBeLessThanOrEqual(1.5);
			if (w !== plain.getNoise2d(i * 2, i)) {
				differences++;
			}
		}
		// warping actually changes the field
		expect(differences).toBeGreaterThan(30);
	});
});
