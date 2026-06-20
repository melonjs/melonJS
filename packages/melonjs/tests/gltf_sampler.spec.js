import { describe, expect, it } from "vitest";
import {
	findKeyframe,
	sampleChannel,
	slerpQuat,
} from "../src/level/gltf/gltf_sampler.js";

/**
 * Unit tests for the glTF node-TRS keyframe sampler. Pure math — no renderer.
 */
describe("findKeyframe", () => {
	const times = [0, 1, 2, 3];

	it("clamps below the first keyframe (no extrapolation)", () => {
		expect(findKeyframe(times, -5)).toEqual({ i0: 0, i1: 0, alpha: 0 });
	});

	it("clamps at/above the last keyframe", () => {
		expect(findKeyframe(times, 3)).toEqual({ i0: 3, i1: 3, alpha: 0 });
		expect(findKeyframe(times, 99)).toEqual({ i0: 3, i1: 3, alpha: 0 });
	});

	it("brackets an interior time with the correct blend factor", () => {
		expect(findKeyframe(times, 1.25)).toEqual({ i0: 1, i1: 2, alpha: 0.25 });
		expect(findKeyframe(times, 2.5)).toEqual({ i0: 2, i1: 3, alpha: 0.5 });
	});

	it("lands exactly on a keyframe → alpha 0 at that index", () => {
		expect(findKeyframe(times, 2)).toEqual({ i0: 2, i1: 3, alpha: 0 });
	});

	it("ADVERSARIAL: empty times array does not crash", () => {
		expect(findKeyframe([], 0.5)).toEqual({ i0: 0, i1: 0, alpha: 0 });
	});

	it("ADVERSARIAL: duplicate keyframe times (zero span) → alpha 0, no divide-by-zero", () => {
		const dup = [0, 1, 1, 2];
		const r = findKeyframe(dup, 1);
		// t === 1 lands on the first index whose time is <= t → index 2 here, but
		// the contract that matters: alpha is finite (never NaN/Infinity)
		expect(Number.isFinite(r.alpha)).toBe(true);
		expect(r.alpha).toBe(0);
	});
});

describe("slerpQuat", () => {
	const out = [0, 0, 0, 0];

	it("t=0 / t=1 return the endpoints", () => {
		const q = [0, 0, 0, 1, 0, 0, 0.7071, 0.7071]; // identity → 90° about Z
		slerpQuat(q, 0, 4, 0, out);
		expect(out[3]).toBeCloseTo(1, 4);
		slerpQuat(q, 0, 4, 1, out);
		expect(out[2]).toBeCloseTo(0.7071, 4);
		expect(out[3]).toBeCloseTo(0.7071, 4);
	});

	it("midpoint of identity→90°(Z) is 45° about Z, normalized", () => {
		const q = [0, 0, 0, 1, 0, 0, 0.70710678, 0.70710678];
		slerpQuat(q, 0, 4, 0.5, out);
		// 45° about Z = (0,0,sin22.5,cos22.5)
		expect(out[2]).toBeCloseTo(Math.sin(Math.PI / 8), 4);
		expect(out[3]).toBeCloseTo(Math.cos(Math.PI / 8), 4);
		expect(Math.hypot(out[0], out[1], out[2], out[3])).toBeCloseTo(1, 5);
	});

	it("ADVERSARIAL: takes the shortest arc when the dot is negative", () => {
		// q and -q represent the same orientation; slerp must not spin the long
		// way. identity vs negated-identity → midpoint stays at identity.
		const q = [0, 0, 0, 1, 0, 0, 0, -1];
		slerpQuat(q, 0, 4, 0.5, out);
		expect(Math.abs(out[3])).toBeCloseTo(1, 4);
		expect(out[0]).toBeCloseTo(0, 5);
		expect(out[1]).toBeCloseTo(0, 5);
		expect(out[2]).toBeCloseTo(0, 5);
	});

	it("ADVERSARIAL: nearly-parallel quaternions use the lerp fallback (no NaN)", () => {
		const a = Math.cos(0.0001);
		const s = Math.sin(0.0001);
		const q = [0, 0, s, a, 0, 0, s * 1.0001, a];
		slerpQuat(q, 0, 4, 0.5, out);
		expect(
			out.every((v) => {
				return Number.isFinite(v);
			}),
		).toBe(true);
		expect(Math.hypot(out[0], out[1], out[2], out[3])).toBeCloseTo(1, 5);
	});
});

describe("sampleChannel", () => {
	const out = [0, 0, 0, 0];

	it("LINEAR vec3 (translation) lerps component-wise", () => {
		const channel = {
			times: [0, 1],
			values: [0, 0, 0, 10, 20, -30],
			stride: 3,
			interpolation: "LINEAR",
		};
		sampleChannel(channel, 0.5, out);
		expect([out[0], out[1], out[2]]).toEqual([5, 10, -15]);
	});

	it("STEP holds the lower keyframe value", () => {
		const channel = {
			times: [0, 1],
			values: [1, 2, 3, 100, 200, 300],
			stride: 3,
			interpolation: "STEP",
		};
		sampleChannel(channel, 0.99, out);
		expect([out[0], out[1], out[2]]).toEqual([1, 2, 3]);
	});

	it("rotation (stride 4) uses slerp", () => {
		const channel = {
			times: [0, 1],
			values: [0, 0, 0, 1, 0, 0, 0.70710678, 0.70710678],
			stride: 4,
			interpolation: "LINEAR",
		};
		sampleChannel(channel, 0.5, out);
		expect(out[2]).toBeCloseTo(Math.sin(Math.PI / 8), 4);
		expect(out[3]).toBeCloseTo(Math.cos(Math.PI / 8), 4);
	});

	it("ADVERSARIAL: CUBICSPLINE reads the middle (value) of each keyframe block, ignores tangents", () => {
		// 2 keyframes, stride 3, cubicspline blocks = [inTangent, value, outTangent]
		// key0: in=[9,9,9] value=[0,0,0] out=[9,9,9]
		// key1: in=[9,9,9] value=[10,0,0] out=[9,9,9]
		const channel = {
			times: [0, 1],
			values: [9, 9, 9, 0, 0, 0, 9, 9, 9, 9, 9, 9, 10, 0, 0, 9, 9, 9],
			stride: 3,
			interpolation: "CUBICSPLINE",
		};
		sampleChannel(channel, 0.5, out);
		// linear blend of the two VALUES (tangents must be ignored): 0..10 → 5
		expect(out[0]).toBeCloseTo(5, 5);
		expect(out[1]).toBeCloseTo(0, 5);
		expect(out[2]).toBeCloseTo(0, 5);
	});

	it("ADVERSARIAL: sampling past the end clamps to the last value", () => {
		const channel = {
			times: [0, 1],
			values: [0, 0, 0, 7, 8, 9],
			stride: 3,
			interpolation: "LINEAR",
		};
		sampleChannel(channel, 5, out);
		expect([out[0], out[1], out[2]]).toEqual([7, 8, 9]);
	});
});
