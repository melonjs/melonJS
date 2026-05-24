import { Vector3d } from "../math/vector3d.ts";
import type Container from "./../renderable/container.js";
import Camera2d from "./camera2d.ts";
import Frustum, { type FrustumOptions } from "./frustum.ts";

// reusable unit-axis vectors for rotation calls. Pure constants so
// allocation only happens once per module load, not per frame.
const AXIS_X = new Vector3d(1, 0, 0);
const AXIS_Y = new Vector3d(0, 1, 0);

/**
 * A perspective camera that extends {@link Camera2d} with a view
 * {@link Frustum} (fov / aspect / near / far) and orientation
 * (pitch / yaw / roll). Slots into `Stage.cameras` as a drop-in
 * replacement for `Camera2d` — inherits the post-effect FBO bracket,
 * color-matrix, fade / shake / follow plumbing, and screen viewport.
 *
 * Conventions:
 * - **Y-down + +Z forward.** Sprite at higher `pos.y` appears lower
 *   on screen (same as Camera2d). Sprite at higher `pos.z` is
 *   farther from the camera and renders smaller. Matches melonJS's
 *   2D conventions so existing Camera2d code translates directly.
 * - **Rotations are extrinsic XYZ.** `pitch` (X axis, look up/down),
 *   `yaw` (Y axis, look left/right), `roll` (Z axis, screen-plane
 *   bank — also exposed as `Camera2d.rotation` via Renderable
 *   inheritance for backward compatibility).
 * - **Follow offsets are target-local.** When a target is set,
 *   `followOffset` is applied in the target's local frame
 *   (Cinemachine / Unreal spring-arm / Babylon FollowCamera
 *   convention). The camera world position becomes
 *   `target.pos + target.rotation * followOffset`.
 *
 * Known limitations (PR B scope):
 * - `Light2d` is 2D-only — visible artifacts under perspective.
 *   Avoid combining with Camera3d for now.
 * - `Mesh` (3D models) maintains its own self-contained projection;
 *   meshes will render incorrectly under Camera3d unless their
 *   `projectionMatrix` is manually synced to the camera's. AfterBurner
 *   and similar showcases use sprite billboards instead (which scale
 *   automatically under perspective).
 * - `localToWorld` / `worldToLocal` overrides fall back to the
 *   ortho-equivalent 2D projection at z=0. Full 3D unproject for
 *   arbitrary depth is future work.
 * @category Camera
 * @example
 * // opt in app-wide:
 * const app = new Application(1024, 768, {
 *   parent: "screen",
 *   cameraClass: Camera3d,
 * });
 *
 * // or per-stage with custom fov:
 * class GameStage extends Stage {
 *   constructor() {
 *     super({
 *       cameras: [new Camera3d(0, 0, 1024, 768, { fov: Math.PI / 3 })],
 *     });
 *   }
 * }
 */
export default class Camera3d extends Camera2d {
	/**
	 * the view frustum (perspective parameters + projection matrix).
	 * Mutating `frustum.fov` / `aspect` / `near` / `far` directly
	 * requires calling `frustum.update()` to rebuild the matrix;
	 * the proxy setters on this camera (`camera.fov = ...`) handle
	 * that automatically.
	 */
	frustum: Frustum;

	/**
	 * X-axis rotation in radians (look up/down). Positive values
	 * pitch the camera up.
	 * @default 0
	 */
	pitch: number;

	/**
	 * Y-axis rotation in radians (look left/right). Positive values
	 * yaw the camera to the right.
	 * @default 0
	 */
	yaw: number;

	/**
	 * Target-local offset from the followed target. When `target` is
	 * set via {@link Camera2d#follow}, the camera position resolves to
	 * `target.pos + followOffset`. Common usage: `(0, -2, -8)` for a
	 * behind-and-above third-person view.
	 *
	 * (PR B scope: treated as world-space — target rotation
	 * application is deferred until target orientation tracking is
	 * needed, e.g. AfterBurner's banking jet.)
	 * @default (0, 0, 0)
	 */
	followOffset: Vector3d;

	/**
	 * Target-local point the camera looks at when following. Combined
	 * with the followed target's position to compute the look direction.
	 * @default (0, 0, 1)
	 */
	lookAhead: Vector3d;

	/**
	 * @param minX - start x offset
	 * @param minY - start y offset
	 * @param maxX - end x offset
	 * @param maxY - end y offset
	 * @param [opts] - perspective parameters (see {@link FrustumOptions})
	 */
	constructor(
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
		opts?: FrustumOptions,
	) {
		super(minX, minY, maxX, maxY);

		// build the frustum with the user's opts, defaulting aspect to
		// the camera viewport rect
		this.frustum = new Frustum({
			fov: opts?.fov ?? Math.PI / 3,
			aspect: opts?.aspect ?? this.width / this.height,
			near: opts?.near ?? 0.1,
			far: opts?.far ?? 1000,
		});

		this.pitch = 0;
		this.yaw = 0;
		this.followOffset = new Vector3d(0, 0, 0);
		this.lookAhead = new Vector3d(0, 0, 1);

		// override Camera2d's wide ortho range — perspective wants
		// tight near/far for meaningful z resolution
		this.near = this.frustum.near;
		this.far = this.frustum.far;

		// copy the frustum's already-built perspective matrix over
		// Camera2d's ortho (left by the super-constructor's call to
		// `_updateProjectionMatrix`). We do NOT call our overridden
		// `_updateProjectionMatrix` here, because that would re-derive
		// `aspect` from the viewport rect and overwrite any custom
		// aspect the user passed in `opts`. Auto-derivation is the
		// right behavior on `resize()` — but at construction time,
		// the user's explicit `opts.aspect` should win.
		this.projectionMatrix.copy(this.frustum.projectionMatrix);
	}

	/**
	 * vertical field of view in radians. Setting this rebuilds the
	 * projection matrix. Proxies to `frustum.fov`.
	 */
	get fov(): number {
		return this.frustum.fov;
	}
	set fov(value: number) {
		this.frustum.fov = value;
		this.frustum.update();
		this.projectionMatrix.copy(this.frustum.projectionMatrix);
	}

	/**
	 * aspect ratio (width / height). Auto-updated on `resize()`.
	 * Setting manually overrides the auto-derived value until the
	 * next resize. Proxies to `frustum.aspect`.
	 */
	get aspect(): number {
		return this.frustum.aspect;
	}
	set aspect(value: number) {
		this.frustum.aspect = value;
		this.frustum.update();
		this.projectionMatrix.copy(this.frustum.projectionMatrix);
	}

	/**
	 * Rebuild the projection matrix from the frustum. Called by the
	 * base `Camera2d` constructor and by `resize()`. Camera3d's
	 * version replaces the ortho matrix with the frustum's perspective.
	 * @ignore
	 */
	override _updateProjectionMatrix(): void {
		// guard: this is called from the Camera2d super-constructor
		// before our `frustum` field is initialized. Fall through to
		// Camera2d's ortho path in that case; the Camera3d constructor
		// re-runs this method after the frustum is built. TypeScript
		// can't model "this method runs during super-construction" so
		// the type system sees `this.frustum` as always-defined.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!this.frustum) {
			super._updateProjectionMatrix();
			return;
		}
		this.frustum.aspect = this.width / this.height;
		this.frustum.near = this.near;
		this.frustum.far = this.far;
		this.frustum.update();
		this.projectionMatrix.copy(this.frustum.projectionMatrix);
	}

	/**
	 * Resize the camera viewport and recompute aspect ratio.
	 * @param w - new width
	 * @param h - new height
	 * @returns this camera
	 */
	override resize(w: number, h: number): this {
		super.resize(w, h);
		// super.resize calls _updateProjectionMatrix which already
		// re-derives aspect — nothing more to do
		return this;
	}

	/**
	 * Apply the camera's full 3D view transform to the world container.
	 * Order: rotate first (pitch, yaw), then translate by `-camera.pos`.
	 * Post-multiplication semantics give us
	 * `currentTransform = R⁻¹ ∘ T(-pos)` — applied to a world point,
	 * this subtracts the camera position then rotates by the camera's
	 * inverse orientation, which is the standard view transform.
	 * @ignore
	 */
	override _applyContainerViewTransform(
		container: Container,
		translateX: number,
		translateY: number,
	): void {
		// rotations first (pitch then yaw — order matters for the
		// inverse to be RPY⁻¹ = Y⁻¹P⁻¹R⁻¹; here we go with Y⁻¹P⁻¹
		// = yaw then pitch with negated angles, applied via post-mult
		// in reverse)
		if (this.pitch !== 0) {
			container.rotate(-this.pitch, AXIS_X);
		}
		if (this.yaw !== 0) {
			container.rotate(-this.yaw, AXIS_Y);
		}
		// then translate by -camera.pos (include z)
		container.translate(-translateX, -translateY, -this.pos.z);
	}

	/**
	 * Revert {@link Camera3d#_applyContainerViewTransform} in reverse
	 * order to restore the container's `currentTransform` to its
	 * pre-camera state.
	 * @ignore
	 */
	override _revertContainerViewTransform(
		container: Container,
		translateX: number,
		translateY: number,
	): void {
		// reverse of apply: undo translate first, then yaw, then pitch
		container.translate(translateX, translateY, this.pos.z);
		if (this.yaw !== 0) {
			container.rotate(this.yaw, AXIS_Y);
		}
		if (this.pitch !== 0) {
			container.rotate(this.pitch, AXIS_X);
		}
	}

	/**
	 * Point the camera at a world-space target by deriving pitch and
	 * yaw from the direction (target − camera.pos). Roll is unaffected.
	 *
	 * Last-write-wins with manual `pitch` / `yaw` assignment: if you
	 * call `lookAt(...)` then set `camera.pitch = 0.1` directly, the
	 * next frame renders with the manual pitch.
	 * @param x - target world x
	 * @param y - target world y
	 * @param z - target world z
	 * @returns this camera
	 */
	lookAt(x: number, y: number, z: number): this {
		const dx = x - this.pos.x;
		const dy = y - this.pos.y;
		const dz = z - this.pos.z;

		// yaw = atan2(dx, dz) — rotation around Y axis to face the
		// XZ-plane projection of the direction vector
		this.yaw = Math.atan2(dx, dz);

		// pitch = atan2(dy, horizontalDistance). Y-down convention
		// means positive dy = below origin, so positive pitch points
		// the camera downward (matches engine Y-down + intuitive
		// "pitch up = look up").
		const horizontalDist = Math.sqrt(dx * dx + dz * dz);
		this.pitch = Math.atan2(-dy, horizontalDist);

		return this;
	}

	/**
	 * Convenience overload of `lookAt` accepting a {@link Vector3d}.
	 * @param target - world-space point to look at
	 * @returns this camera
	 */
	setLookAt(target: Vector3d): this {
		return this.lookAt(target.x, target.y, target.z);
	}

	/**
	 * Set the target-local follow offset. Called once when configuring
	 * a follow-cam (e.g. behind-and-above third person:
	 * `setFollowOffset(0, -2, -8)`).
	 * @param x - target-local x offset
	 * @param y - target-local y offset
	 * @param z - target-local z offset
	 * @returns this camera
	 */
	setFollowOffset(x: number, y: number, z: number): this {
		this.followOffset.set(x, y, z);
		return this;
	}

	/**
	 * Override Camera2d's 2D follow logic to additionally resolve the
	 * target-local `followOffset` against the target. When `target` is
	 * set, the camera's world position becomes
	 * `target.pos + followOffset`.
	 *
	 * (PR B scope: treats `followOffset` as world-space. Target-rotation
	 * application — so the offset rotates with the followed object —
	 * is deferred until target orientation tracking is needed.)
	 * @param dt - delta time in milliseconds
	 * @ignore
	 */
	override updateTarget(dt?: number): void {
		if (this.target) {
			// move camera to target.pos + followOffset (world-space for
			// now; target-rotation-aware variant lands when AfterBurner
			// needs it for the banking jet)
			this.pos.set(
				this.target.x + this.followOffset.x,
				this.target.y + this.followOffset.y,
				(this.target instanceof Vector3d ? this.target.z : 0) +
					this.followOffset.z,
			);
			this.isDirty = true;
			return;
		}
		// no target — fall through to Camera2d's behavior (no-op when
		// target is null)
		super.updateTarget(dt);
	}
}
