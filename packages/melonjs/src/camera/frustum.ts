import { Matrix3d } from "../math/matrix3d.ts";

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
 * Plane-based frustum culling (`containsPoint` / `intersectsSphere`)
 * is intentionally deferred until a real use case (e.g. visibility
 * culling for the AfterBurner demo) demands it — keeps this class
 * focused on the projection-math concern.
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
	 * @param [opts] - initial parameters; any omitted field uses the
	 *   class default
	 */
	constructor(opts?: FrustumOptions) {
		this.fov = opts?.fov ?? Math.PI / 3;
		this.aspect = opts?.aspect ?? 1.0;
		this.near = opts?.near ?? 0.1;
		this.far = opts?.far ?? 1000;
		this.projectionMatrix = new Matrix3d();
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
}
