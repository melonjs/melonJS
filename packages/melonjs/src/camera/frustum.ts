import { Matrix3d } from "../math/matrix3d.ts";

/**
 * A plane in 3D space, expressed as `Ax + By + Cz + D = 0`.
 * `normal` is `(A, B, C)`; `constant` is `D`. Used by {@link Frustum}
 * to represent the six bounding planes for culling.
 * @category Camera
 */
export interface Plane {
	/** plane normal (A, B, C in the plane equation) — not necessarily unit-length */
	nx: number;
	ny: number;
	nz: number;
	/** plane constant (D in the plane equation) */
	d: number;
}

export interface FrustumOptions {
	/** vertical field of view in radians (default: π / 3 = 60°) */
	fov?: number;
	/** aspect ratio (width / height) — default 1.0 (square) */
	aspect?: number;
	/** distance to the near clipping plane (default 0.1) */
	near?: number;
	/** distance to the far clipping plane (default 1000) */
	far?: number;
}

/**
 * A view frustum — the truncated pyramid that defines a perspective
 * camera's visible volume. Holds the four projection parameters
 * (`fov`, `aspect`, `near`, `far`) and the matching projection matrix.
 *
 * Used by {@link Camera3d} as its source of truth for perspective
 * projection. The matrix follows melonJS conventions: Y-down (sprite
 * at higher `y` appears lower on screen, matching Camera2d) and +Z
 * forward (sprite at higher `pos.z` is farther from the camera and
 * renders smaller). This differs from the OpenGL default of Y-up and
 * -Z forward, but matches the rest of the engine and lets Camera2d
 * code translate directly to Camera3d.
 *
 * Plane-based frustum culling is available via {@link Frustum#planes}
 * (rebuilt by {@link Frustum#setFromViewProjection} per frame) plus
 * {@link Frustum#containsPoint} / {@link Frustum#intersectsSphere} for
 * culling tests. `Camera3d.update` calls `setFromViewProjection` once
 * per frame so its `isVisible(obj)` queries against current planes —
 * no per-frame setup needed from user code.
 * @category Camera
 * @example
 * const frustum = new Frustum({ fov: Math.PI / 3, aspect: 16 / 9 });
 * frustum.near = 0.5;
 * frustum.update();
 * renderer.setProjection(frustum.projectionMatrix);
 */
export default class Frustum {
	/**
	 * vertical field of view in radians.
	 * Mutating this field requires calling {@link Frustum#update} to
	 * rebuild the projection matrix — or use {@link Frustum#set} to
	 * change multiple parameters and update in one call.
	 */
	fov: number;

	/**
	 * aspect ratio (width / height). Camera3d sets this automatically
	 * from its viewport on resize.
	 */
	aspect: number;

	/**
	 * distance to the near clipping plane (positive — measured along
	 * +Z, the camera's forward direction).
	 */
	near: number;

	/**
	 * distance to the far clipping plane.
	 */
	far: number;

	/**
	 * the perspective projection matrix derived from `fov`, `aspect`,
	 * `near` and `far`. Rebuilt by {@link Frustum#update}.
	 */
	projectionMatrix: Matrix3d;

	/**
	 * The six bounding planes of this frustum in world space, in order:
	 * left, right, bottom, top, near, far. Each plane is oriented so
	 * its `(nx, ny, nz)` normal points **inward** — a point with
	 * positive signed distance to a plane is on the visible side.
	 *
	 * Populated by {@link Frustum#setFromViewProjection}. Callers that
	 * use {@link Frustum#intersectsSphere} or {@link Frustum#containsPoint}
	 * must first call `setFromViewProjection` each frame the camera
	 * moves; otherwise the planes describe a stale frustum.
	 */
	planes: Plane[];

	/**
	 * @param [opts] - initial parameters; any omitted field uses the
	 *   class default
	 */
	constructor(opts?: FrustumOptions) {
		this.fov = opts?.fov ?? Math.PI / 3;
		this.aspect = opts?.aspect ?? 1.0;
		this.near = opts?.near ?? 0.1;
		this.far = opts?.far ?? 1000;
		this.projectionMatrix = new Matrix3d();
		// six planes — left, right, bottom, top, near, far. Initialised
		// to all-zero; populated by `setFromViewProjection` on first
		// camera update.
		this.planes = [
			{ nx: 0, ny: 0, nz: 0, d: 0 },
			{ nx: 0, ny: 0, nz: 0, d: 0 },
			{ nx: 0, ny: 0, nz: 0, d: 0 },
			{ nx: 0, ny: 0, nz: 0, d: 0 },
			{ nx: 0, ny: 0, nz: 0, d: 0 },
			{ nx: 0, ny: 0, nz: 0, d: 0 },
		];
		this.update();
	}

	/**
	 * Atomically set all four parameters and rebuild the projection
	 * matrix in one call.
	 * @param fov - vertical field of view in radians
	 * @param aspect - aspect ratio (width / height)
	 * @param near - distance to the near clipping plane
	 * @param far - distance to the far clipping plane
	 * @returns this Frustum for chaining
	 */
	set(fov: number, aspect: number, near: number, far: number): this {
		this.fov = fov;
		this.aspect = aspect;
		this.near = near;
		this.far = far;
		this.update();
		return this;
	}

	/**
	 * Rebuild {@link Frustum#projectionMatrix} from the current
	 * parameter values. Call this after mutating any of `fov`,
	 * `aspect`, `near`, `far` individually.
	 *
	 * The matrix is the standard OpenGL perspective post-multiplied by
	 * `scale(1, -1, -1)` so that:
	 * - Y-down matches melonJS screen + Camera2d conventions
	 * - +Z is forward (positive `pos.z` = farther from camera)
	 */
	update(): void {
		this.projectionMatrix.perspective(
			this.fov,
			this.aspect,
			this.near,
			this.far,
		);
		// flip Y (down) + Z (+Z forward) to match engine conventions
		this.projectionMatrix.scale(1, -1, -1);
	}

	/**
	 * Rebuild the six bounding {@link Frustum#planes} from the world →
	 * clip matrix. Standard Gribb–Hartmann extraction: each plane is
	 * one of the six combinations of the matrix's row 3 (the "w" row)
	 * ± rows 0, 1, 2.
	 *
	 * Call this once per frame after the camera has moved (typically
	 * from `Camera3d.update`); the planes are then valid in world
	 * space for that frame and can be tested against world-space
	 * bounds via {@link Frustum#intersectsSphere} /
	 * {@link Frustum#containsPoint}.
	 *
	 * **Pass `projectionMatrix × viewMatrix`** — column-major /
	 * gl-matrix convention: a world-space point becomes a clip-space
	 * point via `clip = projection × view × world`, so the combined
	 * matrix is `projection × view`. The parameter name says
	 * `viewProjection` for that reason — it's the matrix uploaded to
	 * `uProjectionMatrix` in the vertex shader (after Camera3d bakes
	 * the per-frame world translate into the view via
	 * `container.translate`).
	 * @param viewProjection - the `projectionMatrix × viewMatrix` matrix
	 */
	setFromViewProjection(viewProjection: Matrix3d): void {
		// column-major matrix: `m.val[col * 4 + row]`. Row r is the
		// elements at indices `r, 4+r, 8+r, 12+r` (one from each column).
		const m = viewProjection.val;
		const r0x = m[0],
			r0y = m[4],
			r0z = m[8],
			r0w = m[12];
		const r1x = m[1],
			r1y = m[5],
			r1z = m[9],
			r1w = m[13];
		const r2x = m[2],
			r2y = m[6],
			r2z = m[10],
			r2w = m[14];
		const r3x = m[3],
			r3y = m[7],
			r3z = m[11],
			r3w = m[15];

		// each plane is a sum/difference of two rows, then normalized
		// so the `(nx, ny, nz)` is unit length (so `intersectsSphere`
		// can compare distance against radius in world units).
		const set = (
			idx: number,
			nx: number,
			ny: number,
			nz: number,
			d: number,
		) => {
			const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
			const p = this.planes[idx];
			p.nx = nx * inv;
			p.ny = ny * inv;
			p.nz = nz * inv;
			p.d = d * inv;
		};

		// left = row3 + row0  (points pass when their signed distance > 0)
		set(0, r3x + r0x, r3y + r0y, r3z + r0z, r3w + r0w);
		// right = row3 - row0
		set(1, r3x - r0x, r3y - r0y, r3z - r0z, r3w - r0w);
		// bottom = row3 + row1
		set(2, r3x + r1x, r3y + r1y, r3z + r1z, r3w + r1w);
		// top = row3 - row1
		set(3, r3x - r1x, r3y - r1y, r3z - r1z, r3w - r1w);
		// near = row3 + row2
		set(4, r3x + r2x, r3y + r2y, r3z + r2z, r3w + r2w);
		// far = row3 - row2
		set(5, r3x - r2x, r3y - r2y, r3z - r2z, r3w - r2w);
	}

	/**
	 * Test whether a world-space sphere overlaps this frustum.
	 * Conservative — a sphere that touches even one plane's positive
	 * side is reported visible. Always run {@link Frustum#setFromViewProjection}
	 * first so the planes describe the current camera view.
	 * @param x - sphere center x in world coords
	 * @param y - sphere center y in world coords
	 * @param z - sphere center z in world coords
	 * @param radius - sphere radius in world units
	 * @returns true if the sphere is at least partially inside the frustum
	 */
	intersectsSphere(x: number, y: number, z: number, radius: number): boolean {
		// for each plane, compute signed distance from sphere center.
		// if the center is farther than `radius` on the OUTSIDE side
		// (distance < -radius) of ANY plane, the whole sphere is outside.
		for (let i = 0; i < 6; i++) {
			const p = this.planes[i];
			const distance = p.nx * x + p.ny * y + p.nz * z + p.d;
			if (distance < -radius) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Test whether a world-space point is inside this frustum.
	 * Always run {@link Frustum#setFromViewProjection} first.
	 * @param x - world x
	 * @param y - world y
	 * @param z - world z
	 * @returns true if the point is inside (on the positive side of every plane)
	 */
	containsPoint(x: number, y: number, z: number): boolean {
		for (let i = 0; i < 6; i++) {
			const p = this.planes[i];
			if (p.nx * x + p.ny * y + p.nz * z + p.d < 0) {
				return false;
			}
		}
		return true;
	}
}
