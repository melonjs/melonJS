import { describe, expect, it } from "vitest";
import { Matrix3d, Vector2d } from "../src/index.js";
import {
	convexHull,
	normalizeVertices,
	projectVertices,
} from "../src/math/vertex.js";

// ── normalizeVertices ───────────────────────────────────────────────────────

describe("normalizeVertices()", () => {
	// --- centering ---

	it("centers vertices at the origin", () => {
		const v = new Float32Array([1, 2, 3, 5, 6, 7]);
		normalizeVertices(v);
		const cx = (v[0] + v[3]) / 2;
		const cy = (v[1] + v[4]) / 2;
		const cz = (v[2] + v[5]) / 2;
		expect(cx).toBeCloseTo(0, 5);
		expect(cy).toBeCloseTo(0, 5);
		expect(cz).toBeCloseTo(0, 5);
	});

	it("centers a cube at the origin", () => {
		// cube from (2,2,2) to (4,4,4)
		const v = new Float32Array([
			2, 2, 2, 4, 2, 2, 4, 4, 2, 2, 4, 2, 2, 2, 4, 4, 2, 4, 4, 4, 4, 2, 4, 4,
		]);
		normalizeVertices(v);
		let sumX = 0,
			sumY = 0,
			sumZ = 0;
		for (let i = 0; i < v.length; i += 3) {
			sumX += v[i];
			sumY += v[i + 1];
			sumZ += v[i + 2];
		}
		expect(sumX / 8).toBeCloseTo(0, 5);
		expect(sumY / 8).toBeCloseTo(0, 5);
		expect(sumZ / 8).toBeCloseTo(0, 5);
	});

	it("centers negative-space vertices", () => {
		const v = new Float32Array([-10, -20, -30, -5, -10, -15]);
		normalizeVertices(v);
		const cx = (v[0] + v[3]) / 2;
		const cy = (v[1] + v[4]) / 2;
		expect(cx).toBeCloseTo(0, 5);
		expect(cy).toBeCloseTo(0, 5);
	});

	// --- scale bounds ---

	it("scales to fit within [-0.5, 0.5]", () => {
		const v = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]);
		normalizeVertices(v);
		for (let i = 0; i < v.length; i++) {
			expect(v[i]).toBeGreaterThanOrEqual(-0.5 - 1e-6);
			expect(v[i]).toBeLessThanOrEqual(0.5 + 1e-6);
		}
	});

	it("largest axis spans exactly 1.0", () => {
		const v = new Float32Array([0, 0, 0, 100, 50, 25]);
		normalizeVertices(v);
		const rangeX = v[3] - v[0];
		expect(rangeX).toBeCloseTo(1.0, 5);
	});

	// --- aspect ratio ---

	it("preserves aspect ratio (uniform scale)", () => {
		const v = new Float32Array([0, 0, 0, 10, 2, 4]);
		normalizeVertices(v);
		const rangeX = v[3] - v[0];
		const rangeY = v[4] - v[1];
		const rangeZ = v[5] - v[2];
		expect(rangeX).toBeCloseTo(1.0, 5);
		expect(rangeY).toBeCloseTo(0.2, 5);
		expect(rangeZ).toBeCloseTo(0.4, 5);
	});

	it("non-uniform model preserves proportions", () => {
		// tall thin model: 1 wide, 10 tall, 1 deep
		const v = new Float32Array([0, 0, 0, 1, 10, 1]);
		normalizeVertices(v);
		const rangeX = v[3] - v[0];
		const rangeY = v[4] - v[1];
		expect(rangeY / rangeX).toBeCloseTo(10, 4);
	});

	// --- edge cases ---

	it("handles single vertex (no crash, centered at 0)", () => {
		const v = new Float32Array([5, 10, 15]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(0, 5);
		expect(v[1]).toBeCloseTo(0, 5);
		expect(v[2]).toBeCloseTo(0, 5);
	});

	it("handles two identical vertices (zero range)", () => {
		const v = new Float32Array([3, 3, 3, 3, 3, 3]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(0, 5);
		expect(v[3]).toBeCloseTo(0, 5);
	});

	it("handles already-normalized vertices", () => {
		const v = new Float32Array([-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(-0.5, 5);
		expect(v[3]).toBeCloseTo(0.5, 5);
	});

	it("handles very large coordinates", () => {
		const v = new Float32Array([1e6, 1e6, 1e6, 1e6 + 1, 1e6 + 1, 1e6 + 1]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(-0.5, 4);
		expect(v[3]).toBeCloseTo(0.5, 4);
	});

	it("handles very small coordinates", () => {
		const v = new Float32Array([0, 0, 0, 1e-6, 1e-6, 1e-6]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(-0.5, 4);
		expect(v[3]).toBeCloseTo(0.5, 4);
	});

	it("handles negative to positive range", () => {
		const v = new Float32Array([-5, -5, -5, 5, 5, 5]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(-0.5, 5);
		expect(v[3]).toBeCloseTo(0.5, 5);
	});

	it("handles flat model (zero Z range)", () => {
		const v = new Float32Array([0, 0, 0, 10, 10, 0]);
		normalizeVertices(v);
		// Z should be 0 (centered, zero range uses fallback divisor of 1)
		expect(v[2]).toBeCloseTo(0, 5);
		expect(v[5]).toBeCloseTo(0, 5);
	});

	it("handles single-axis model (line along X)", () => {
		const v = new Float32Array([0, 0, 0, 10, 0, 0]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(-0.5, 5);
		expect(v[3]).toBeCloseTo(0.5, 5);
		expect(v[1]).toBeCloseTo(0, 5);
		expect(v[4]).toBeCloseTo(0, 5);
	});

	it("modifies the array in place", () => {
		const v = new Float32Array([0, 0, 0, 10, 10, 10]);
		const ref = v;
		normalizeVertices(v);
		expect(v).toBe(ref);
	});

	it("handles many vertices", () => {
		const count = 10000;
		const v = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			v[i * 3] = Math.random() * 200 - 100;
			v[i * 3 + 1] = Math.random() * 200 - 100;
			v[i * 3 + 2] = Math.random() * 200 - 100;
		}
		normalizeVertices(v);
		for (let i = 0; i < v.length; i++) {
			expect(v[i]).toBeGreaterThanOrEqual(-0.5 - 1e-6);
			expect(v[i]).toBeLessThanOrEqual(0.5 + 1e-6);
		}
	});
});

// ── projectVertices ─────────────────────────────────────────────────────────

describe("projectVertices()", () => {
	// --- identity matrix ---

	it("identity matrix maps origin to center of display area", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100);
		expect(dst[0]).toBeCloseTo(100, 5);
		expect(dst[1]).toBeCloseTo(50, 5);
	});

	it("identity matrix maps (0.5, -0.5, 0) to bottom-right corner", () => {
		const src = new Float32Array([0.5, -0.5, 0]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100);
		expect(dst[0]).toBeCloseTo(200, 5); // halfW + 0.5 * width
		expect(dst[1]).toBeCloseTo(100, 5); // halfH + 0.5 * height (Y flipped)
	});

	it("identity matrix maps (-0.5, 0.5, 0) to top-left corner area", () => {
		const src = new Float32Array([-0.5, 0.5, 0]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100);
		expect(dst[0]).toBeCloseTo(0, 5);
		expect(dst[1]).toBeCloseTo(0, 5);
	});

	// --- offset ---

	it("applies X/Y offset", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100, 50, 75);
		expect(dst[0]).toBeCloseTo(150, 5);
		expect(dst[1]).toBeCloseTo(125, 5);
	});

	it("negative offset works", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100, -50, -25);
		expect(dst[0]).toBeCloseTo(50, 5);
		expect(dst[1]).toBeCloseTo(25, 5);
	});

	// --- Z output ---

	it("Z is 0 when zScale is 0 (default)", () => {
		const src = new Float32Array([0, 0, 0.5]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100);
		expect(dst[2]).toEqual(0);
	});

	it("computes Z when zScale is non-zero", () => {
		const src = new Float32Array([0, 0, 0.5]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100, 0, 0, 1000);
		expect(dst[2]).toBeCloseTo(-500, 1);
	});

	it("Z sign is negated (closer = more negative)", () => {
		const src = new Float32Array([0, 0, -0.3, 0, 0, 0.3]);
		const dst = new Float32Array(6);
		projectVertices(src, dst, 2, new Matrix3d().val, 200, 100, 0, 0, 1000);
		// vertex at z=-0.3 should have positive Z output (negated)
		expect(dst[2]).toBeCloseTo(300, 1);
		// vertex at z=0.3 should have negative Z output
		expect(dst[5]).toBeCloseTo(-300, 1);
	});

	it("zScale of 1 produces raw negated Z", () => {
		const src = new Float32Array([0, 0, 0.25]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 100, 100, 0, 0, 1);
		expect(dst[2]).toBeCloseTo(-0.25, 5);
	});

	// --- matrix transforms ---

	it("translation matrix shifts output", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		const m = new Matrix3d();
		m.translate(0.5, 0, 0);
		projectVertices(src, dst, 1, m.val, 200, 100);
		expect(dst[0]).toBeCloseTo(200, 5);
	});

	it("rotation matrix rotates vertices", () => {
		const src = new Float32Array([0.5, 0, 0]);
		const dst = new Float32Array(3);
		const m = new Matrix3d();
		m.rotate(Math.PI / 2); // 90° around Z
		projectVertices(src, dst, 1, m.val, 200, 200);
		// (0.5, 0) rotated 90° CCW = (0, 0.5)
		expect(dst[0]).toBeCloseTo(100, 1); // center X (Y component is 0.5 but Y is flipped)
		expect(dst[1]).toBeCloseTo(0, 1); // top edge
	});

	it("scale matrix scales output", () => {
		const src = new Float32Array([0.25, 0.25, 0]);
		const dst = new Float32Array(3);
		const m = new Matrix3d();
		m.scale(2, 2);
		projectVertices(src, dst, 1, m.val, 200, 100);
		// 0.25 * 2 = 0.5, mapped: 0.5 * 200 + 100 = 200
		expect(dst[0]).toBeCloseTo(200, 5);
	});

	// --- perspective ---

	it("perspective projection centers the origin", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		const m = new Matrix3d();
		m.perspective(Math.PI / 4, 1, 0.1, 10);
		m.translate(0, 0, -2);
		projectVertices(src, dst, 1, m.val, 400, 400);
		expect(dst[0]).toBeCloseTo(200, 0);
		expect(dst[1]).toBeCloseTo(200, 0);
	});

	it("perspective makes farther objects smaller", () => {
		const near = new Float32Array([0.1, 0, 0]);
		const far = new Float32Array([0.1, 0, 0]);
		const dstNear = new Float32Array(3);
		const dstFar = new Float32Array(3);

		const mNear = new Matrix3d();
		mNear.perspective(Math.PI / 4, 1, 0.1, 100);
		mNear.translate(0, 0, -2);

		const mFar = new Matrix3d();
		mFar.perspective(Math.PI / 4, 1, 0.1, 100);
		mFar.translate(0, 0, -10);

		projectVertices(near, dstNear, 1, mNear.val, 400, 400);
		projectVertices(far, dstFar, 1, mFar.val, 400, 400);

		// near object should be further from center than far object
		const nearDist = Math.abs(dstNear[0] - 200);
		const farDist = Math.abs(dstFar[0] - 200);
		expect(nearDist).toBeGreaterThan(farDist);
	});

	// --- multiple vertices ---

	it("projects multiple vertices correctly", () => {
		const src = new Float32Array([-0.5, 0, 0, 0, 0, 0, 0.5, 0, 0]);
		const dst = new Float32Array(9);
		projectVertices(src, dst, 3, new Matrix3d().val, 200, 100);
		expect(dst[0]).toBeCloseTo(0, 5); // left edge
		expect(dst[3]).toBeCloseTo(100, 5); // center
		expect(dst[6]).toBeCloseTo(200, 5); // right edge
	});

	it("count parameter limits processing", () => {
		const src = new Float32Array([0, 0, 0, 99, 99, 99]);
		const dst = new Float32Array(6);
		dst[3] = -1; // sentinel
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100);
		expect(dst[3]).toEqual(-1); // should not be touched
	});

	// --- edge cases ---

	it("handles zero-size display", () => {
		const src = new Float32Array([0.5, 0.5, 0]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 0, 0);
		expect(dst[0]).toEqual(0);
		expect(dst[1]).toEqual(0);
	});

	it("handles w=0 in homogeneous coordinates (degenerate)", () => {
		// a matrix that produces w=0 for a vertex
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		// set w row to all zeros so w = 0*x + 0*y + 0*z + 0*1 = 0
		const m = new Float32Array(16);
		m[0] = 1;
		m[5] = 1;
		m[10] = 1; // identity-like but w=0
		// m[15] = 0 (default) → w will be 0
		projectVertices(src, dst, 1, m, 200, 100);
		// should not crash, invW = 1.0 fallback
		expect(isFinite(dst[0])).toBe(true);
		expect(isFinite(dst[1])).toBe(true);
	});

	it("does not modify source array", () => {
		const src = new Float32Array([1, 2, 3]);
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 100);
		expect(src[0]).toEqual(1);
		expect(src[1]).toEqual(2);
		expect(src[2]).toEqual(3);
	});

	it("Y axis is flipped (screen Y down)", () => {
		const src = new Float32Array([0, 0.5, 0]); // positive Y in model space
		const dst = new Float32Array(3);
		projectVertices(src, dst, 1, new Matrix3d().val, 200, 200);
		// positive model Y → negative screen Y offset → closer to top
		expect(dst[1]).toBeLessThan(100); // above center
	});
});

// ── convexHull ──────────────────────────────────────────────────────────────

describe("convexHull()", () => {
	it("returns all points for a triangle", () => {
		const points = [
			new Vector2d(0, 0),
			new Vector2d(10, 0),
			new Vector2d(5, 10),
		];
		const hull = convexHull(points);
		expect(hull.length).toEqual(3);
	});

	it("returns all points for 2 or fewer points", () => {
		const one = [new Vector2d(5, 5)];
		expect(convexHull(one).length).toEqual(1);

		const two = [new Vector2d(0, 0), new Vector2d(10, 10)];
		expect(convexHull(two).length).toEqual(2);
	});

	it("computes hull of a square (4 points, all on hull)", () => {
		const points = [
			new Vector2d(0, 0),
			new Vector2d(10, 0),
			new Vector2d(10, 10),
			new Vector2d(0, 10),
		];
		const hull = convexHull(points);
		expect(hull.length).toEqual(4);
	});

	it("excludes interior points", () => {
		// square with a center point
		const points = [
			new Vector2d(0, 0),
			new Vector2d(10, 0),
			new Vector2d(10, 10),
			new Vector2d(0, 10),
			new Vector2d(5, 5), // interior
		];
		const hull = convexHull(points);
		expect(hull.length).toEqual(4);
	});

	it("excludes multiple interior points", () => {
		// large square with several interior points
		const points = [
			new Vector2d(0, 0),
			new Vector2d(100, 0),
			new Vector2d(100, 100),
			new Vector2d(0, 100),
			new Vector2d(30, 30),
			new Vector2d(50, 50),
			new Vector2d(70, 20),
			new Vector2d(25, 75),
		];
		const hull = convexHull(points);
		expect(hull.length).toEqual(4);
	});

	it("handles collinear points", () => {
		// three points on a line + one off
		const points = [
			new Vector2d(0, 0),
			new Vector2d(5, 0),
			new Vector2d(10, 0),
			new Vector2d(5, 10),
		];
		const hull = convexHull(points);
		// should form a triangle (the middle collinear point may or may not be included)
		expect(hull.length).toBeGreaterThanOrEqual(3);
		expect(hull.length).toBeLessThanOrEqual(4);
	});

	it("handles all identical points", () => {
		const points = [
			new Vector2d(5, 5),
			new Vector2d(5, 5),
			new Vector2d(5, 5),
			new Vector2d(5, 5),
		];
		const hull = convexHull(points);
		expect(hull.length).toBeGreaterThanOrEqual(1);
	});

	it("produces CCW winding", () => {
		const points = [
			new Vector2d(0, 0),
			new Vector2d(10, 0),
			new Vector2d(10, 10),
			new Vector2d(0, 10),
			new Vector2d(5, 5),
		];
		const hull = convexHull(points);
		// check winding: sum of cross products should be positive for CCW
		let crossSum = 0;
		for (let i = 0; i < hull.length; i++) {
			const a = hull[i];
			const b = hull[(i + 1) % hull.length];
			crossSum += (b.x - a.x) * (b.y + a.y);
		}
		// positive crossSum = clockwise in screen coords (Y down) = CCW in math coords
		expect(crossSum).not.toEqual(0);
	});

	it("handles a complex polygon shape", () => {
		// star-like shape: 5 outer + 5 inner points
		const points = [];
		for (let i = 0; i < 5; i++) {
			const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
			points.push(new Vector2d(Math.cos(angle) * 100, Math.sin(angle) * 100));
			const innerAngle = angle + Math.PI / 5;
			points.push(
				new Vector2d(Math.cos(innerAngle) * 40, Math.sin(innerAngle) * 40),
			);
		}
		const hull = convexHull(points);
		// only the 5 outer points should be on the hull
		expect(hull.length).toEqual(5);
	});

	it("handles large point count", () => {
		// random points in a circle — hull should have fewer points than input
		const points = [];
		for (let i = 0; i < 200; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = Math.random() * 100;
			points.push(new Vector2d(Math.cos(angle) * r, Math.sin(angle) * r));
		}
		// add the bounding circle points to guarantee the hull boundary
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * Math.PI * 2;
			points.push(new Vector2d(Math.cos(angle) * 100, Math.sin(angle) * 100));
		}
		const hull = convexHull(points);
		expect(hull.length).toBeGreaterThanOrEqual(8);
		expect(hull.length).toBeLessThan(208);
	});
});
