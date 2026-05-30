import { describe, expect, it } from "vitest";
import { Frustum, Matrix3d as Matrix3dClass } from "../src/index.js";

/**
 * Tests for the standalone Frustum class.
 * Pure JS, no WebGL or boot() needed — Frustum is a math container.
 */
describe("Frustum", () => {
	describe("defaults", () => {
		it("constructs with sensible defaults", () => {
			const f = new Frustum();
			expect(f.fov).toBeCloseTo(Math.PI / 3, 5);
			expect(f.aspect).toBe(1.0);
			expect(f.near).toBe(0.1);
			expect(f.far).toBe(1000);
			expect(f.projectionMatrix).toBeInstanceOf(Matrix3dClass);
		});

		it("honors constructor opts", () => {
			const f = new Frustum({
				fov: Math.PI / 4,
				aspect: 16 / 9,
				near: 0.5,
				far: 2000,
			});
			expect(f.fov).toBeCloseTo(Math.PI / 4, 5);
			expect(f.aspect).toBeCloseTo(16 / 9, 5);
			expect(f.near).toBe(0.5);
			expect(f.far).toBe(2000);
		});

		it("partial opts merge with defaults", () => {
			const f = new Frustum({ fov: Math.PI / 2 });
			expect(f.fov).toBeCloseTo(Math.PI / 2, 5);
			expect(f.aspect).toBe(1.0); // default
			expect(f.near).toBe(0.1); // default
			expect(f.far).toBe(1000); // default
		});
	});

	describe("update", () => {
		it("rebuilds projectionMatrix from current params", () => {
			const f = new Frustum();
			const before = f.projectionMatrix.val.slice();

			f.fov = Math.PI / 2; // 90° — different matrix
			f.update();
			const after = f.projectionMatrix.val;

			// element [0] = f / aspect = (1 / tan(fov/2)) / aspect.
			// Different fov → different [0].
			expect(after[0]).not.toBeCloseTo(before[0], 5);
		});

		it("set() rebuilds matrix in one call", () => {
			const f = new Frustum();
			const before = f.projectionMatrix.val.slice();

			f.set(Math.PI / 2, 2.0, 1.0, 100);

			expect(f.fov).toBeCloseTo(Math.PI / 2, 5);
			expect(f.aspect).toBe(2.0);
			expect(f.near).toBe(1.0);
			expect(f.far).toBe(100);
			expect(f.projectionMatrix.val[0]).not.toBeCloseTo(before[0], 5);
		});

		it("set() returns this for chaining", () => {
			const f = new Frustum();
			expect(f.set(1, 1, 1, 10)).toBe(f);
		});
	});

	describe("Y-down + +Z forward conventions", () => {
		// melonJS Y-down: vertex at world (0, +1, +z) should project to
		// negative NDC y (below the screen origin, which is top-left in
		// 2D screen coords mapped to NDC y = +1 at top, -1 at bottom).
		// Wait — actually in NDC, y=+1 is top and y=-1 is bottom by GL
		// convention. melonJS's screen mapping then flips this so screen
		// y=0 is top. So a vertex at world y=+1 should land at NDC y=-1
		// (which then maps to screen y = canvas.height, the bottom).
		//
		// The frustum's projection matrix bakes in `scale(1, -1, -1)` to
		// achieve Y-down: pre-scale a vertex's y by -1 so the standard
		// OpenGL ortho/perspective produces NDC y that aligns with
		// screen y.
		it("projects +y world coord to negative NDC y (Y-down)", () => {
			const f = new Frustum({
				fov: Math.PI / 2,
				aspect: 1,
				near: 0.1,
				far: 100,
			});
			// project (0, 1, 5, 1) — world point above and in front of camera
			const m = f.projectionMatrix.val;
			const x = 0,
				y = 1,
				z = 5,
				w = 1;
			const ndc_y = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
			const clip_w = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
			// Y-down convention: positive world y → negative NDC y after
			// perspective divide
			expect(ndc_y / clip_w).toBeLessThan(0);
		});

		it("projects +z world coord as 'in front' (farther = smaller)", () => {
			const f = new Frustum({
				fov: Math.PI / 2,
				aspect: 1,
				near: 0.1,
				far: 1000,
			});
			const m = f.projectionMatrix.val;
			// project a vertex at z=10 vs z=100. Both directly in front.
			// In +Z forward convention, z=100 is farther.
			const project = (z) => {
				const ndc_x = m[0] * 1 + m[4] * 0 + m[8] * z + m[12] * 1;
				const clip_w = m[3] * 1 + m[7] * 0 + m[11] * z + m[15] * 1;
				return ndc_x / clip_w;
			};
			const at10 = Math.abs(project(10));
			const at100 = Math.abs(project(100));
			// farther vertex should project closer to center (smaller |ndc_x|)
			expect(at100).toBeLessThan(at10);
		});

		it("near plane at z=near falls inside clip space", () => {
			const f = new Frustum({
				fov: Math.PI / 2,
				aspect: 1,
				near: 1,
				far: 100,
			});
			const m = f.projectionMatrix.val;
			// vertex at exactly z=near should have NDC z = -1 (on near plane)
			const z = 1; // near
			const ndc_z = m[2] * 0 + m[6] * 0 + m[10] * z + m[14] * 1;
			const clip_w = m[3] * 0 + m[7] * 0 + m[11] * z + m[15] * 1;
			expect(ndc_z / clip_w).toBeCloseTo(-1, 3);
		});

		it("far plane at z=far falls inside clip space", () => {
			const f = new Frustum({
				fov: Math.PI / 2,
				aspect: 1,
				near: 1,
				far: 100,
			});
			const m = f.projectionMatrix.val;
			const z = 100; // far
			const ndc_z = m[2] * 0 + m[6] * 0 + m[10] * z + m[14] * 1;
			const clip_w = m[3] * 0 + m[7] * 0 + m[11] * z + m[15] * 1;
			expect(ndc_z / clip_w).toBeCloseTo(1, 3);
		});
	});

	describe("aspect ratio handling", () => {
		it("wider aspect → x-axis compressed", () => {
			const f1 = new Frustum({ aspect: 1 });
			const f2 = new Frustum({ aspect: 2 });
			// element [0] = f / aspect. Wider aspect → smaller [0] → x compressed
			expect(f2.projectionMatrix.val[0]).toBeLessThan(
				f1.projectionMatrix.val[0],
			);
		});
	});

	describe("planes + culling", () => {
		// build a frustum with a known view matrix and verify the
		// extracted planes correctly classify world-space points and
		// spheres. The view here is the identity — camera at origin
		// looking down +Z (the engine's "forward" direction).
		const buildFrustumWithIdentityView = (opts) => {
			const f = new Frustum(opts);
			const vp = new Matrix3dClass().copy(f.projectionMatrix); // view = identity
			f.setFromViewProjection(vp);
			return f;
		};

		it("setFromViewProjection populates 6 unit-normalized planes", () => {
			const f = buildFrustumWithIdentityView();
			expect(f.planes.length).toBe(6);
			for (const p of f.planes) {
				const len = Math.sqrt(p.nx * p.nx + p.ny * p.ny + p.nz * p.nz);
				expect(len).toBeCloseTo(1, 5);
			}
		});

		it("containsPoint accepts a point in front of the camera", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			// straight ahead at z=50
			expect(f.containsPoint(0, 0, 50)).toBe(true);
		});

		it("containsPoint rejects a point behind the near plane", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			// z = 0.5 is between camera (z=0) and near (z=1) — behind near plane
			expect(f.containsPoint(0, 0, 0.5)).toBe(false);
		});

		it("containsPoint rejects a point past the far plane", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			expect(f.containsPoint(0, 0, 200)).toBe(false);
		});

		it("containsPoint rejects a point outside the horizontal FOV", () => {
			const f = buildFrustumWithIdentityView({
				fov: Math.PI / 4,
				near: 1,
				far: 100,
			});
			// at z=10 with 45° vertical FOV (and aspect=1), the visible
			// half-width is z * tan(fov/2) ≈ 10 * 0.414 = 4.14. A point
			// at x=20, z=10 is well outside.
			expect(f.containsPoint(20, 0, 10)).toBe(false);
		});

		it("intersectsSphere accepts a sphere entirely inside the frustum", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			expect(f.intersectsSphere(0, 0, 50, 1)).toBe(true);
		});

		it("intersectsSphere accepts a sphere clipping the near plane", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			// center is behind near, but radius pokes through
			expect(f.intersectsSphere(0, 0, 0.5, 1)).toBe(true);
		});

		it("intersectsSphere rejects a sphere entirely behind the near plane", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			// center at z=-10, radius 1 → max z = -9, still behind near=1
			expect(f.intersectsSphere(0, 0, -10, 1)).toBe(false);
		});

		it("intersectsSphere rejects a sphere far past the far plane", () => {
			const f = buildFrustumWithIdentityView({ near: 1, far: 100 });
			expect(f.intersectsSphere(0, 0, 500, 1)).toBe(false);
		});
	});
});
