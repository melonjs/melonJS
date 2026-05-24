import { Matrix3d } from "../math/matrix3d.ts";
import { Vector3d } from "../math/vector3d.ts";
import type Container from "./../renderable/container.js";
import type Renderable from "./../renderable/renderable.js";
import Camera2d from "./camera2d.ts";
import Frustum, { type FrustumOptions } from "./frustum.ts";

// reusable unit-axis vectors for rotation calls. Pure constants so
// allocation only happens once per module load, not per frame.
const AXIS_X = new Vector3d(1, 0, 0);
const AXIS_Y = new Vector3d(0, 1, 0);

// Scratch matrices reused by `_rebuildFrustumPlanes` to avoid per-frame
// allocation. Single-instance is safe because draw / update is
// single-threaded and these are only touched inside one method.
const _viewMatrix = new Matrix3d();
const _viewProjection = new Matrix3d();

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
 * - **Follow offset (PR B scope).** When a target is set,
 *   `followOffset` is applied in **world space**:
 *   `camera.pos = target.pos + followOffset`. Target-rotation-aware
 *   follow (Cinemachine / Unreal spring-arm style, where the offset
 *   rotates with the target's orientation) is deferred until a
 *   showcase needs it (e.g. AfterBurner's banking jet).
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
 * - `isVisible` (visibility culling) currently returns `true` for
 *   every non-floating renderable — Camera2d's 2D rect-overlap test
 *   doesn't translate to perspective. The GPU still clips fragments
 *   that fall outside the frustum, so this is visually correct but
 *   defeats the CPU-side early-out. Proper plane-based frustum
 *   culling on `Frustum` is a follow-up.
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
	 * Reserved for future follow-look-ahead support — currently unused
	 * by `updateTarget`. The intent is: when wired in, the camera will
	 * look at `target.pos + lookAhead` instead of `target.pos`, so a
	 * follow-cam stays slightly ahead of its target (e.g. for a
	 * cinematic forward-looking shot in AfterBurner). Field is exposed
	 * now so user code can set it without waiting for the wiring.
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
		// Build the view matrix R⁻¹ ∘ T(-cam.pos) via the container's
		// `currentTransform` using post-multiplication semantics.
		//
		// `Renderable.translate` / `.rotate` post-multiply: each call
		// adds `currentTransform = currentTransform × M`. When this
		// matrix is later applied to a world vertex P, the result is
		// `currentTransform × P` — the rightmost matrix in the chain
		// acts on P first.
		//
		// We want the view transform to first subtract the camera
		// position (so vertices are camera-relative), then rotate by
		// the camera's inverse orientation. To achieve
		// `R(-pitch) ∘ R(-yaw) ∘ T(-pos)` as the final matrix, we
		// post-multiply in that same left-to-right order:
		//   1. rotate(-pitch, X)  → currentTransform = R(-pitch)
		//   2. rotate(-yaw,   Y)  → currentTransform = R(-pitch) ∘ R(-yaw)
		//   3. translate(-pos)    → currentTransform = R(-pitch) ∘ R(-yaw) ∘ T(-pos)
		if (this.pitch !== 0) {
			container.rotate(-this.pitch, AXIS_X);
		}
		if (this.yaw !== 0) {
			container.rotate(-this.yaw, AXIS_Y);
		}
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
	 * Override Camera2d's 2D follow logic to additionally resolve
	 * `followOffset` against the target's z. When `target` is set, the
	 * camera's world position becomes `target.pos + followOffset`.
	 *
	 * **Semantic change vs Camera2d.follow:** this override **does not
	 * honor `follow_axis`, `deadzone`, or `smoothFollow` / `damping`**.
	 * Camera3d tracks its target exactly each frame because the typical
	 * 3D use case (behind-the-plane follow-cam, third-person orbit) wants
	 * 1:1 tracking with no scroll-deadzone. If you need damped or
	 * axis-constrained follow under perspective, set `target = null` and
	 * lerp `camera.pos` toward the target manually in your `update()`.
	 *
	 * **PR B scope:** `followOffset` is treated as **world-space**.
	 * Target-rotation-aware follow (where the offset rotates with the
	 * target's orientation, Cinemachine / Unreal-style) lands when a
	 * showcase (AfterBurner's banking jet) demands it.
	 * @param dt - delta time in milliseconds (ignored — no damping)
	 * @ignore
	 */
	override updateTarget(dt?: number): void {
		const target = this.target;
		if (target) {
			// duck-type the z read via `'z' in target` so this works
			// for both `Vector3d` (when the user passed a raw vector to
			// `follow()`) and `ObservableVector3d` (when
			// `follow(renderable)` assigned `renderable.pos`, which is
			// observable not plain). The previous `instanceof Vector3d`
			// check missed the observable variant — Renderable targets
			// silently lost their depth.
			const targetZ =
				"z" in target && typeof target.z === "number" ? target.z : 0;
			this.pos.set(
				target.x + this.followOffset.x,
				target.y + this.followOffset.y,
				targetZ + this.followOffset.z,
			);
			this.isDirty = true;
			return;
		}
		// no target — fall through to Camera2d's behavior (no-op when
		// target is null)
		super.updateTarget(dt);
	}

	/**
	 * Visibility check used by `Container.update` (in turn driving
	 * `Container.draw`) to skip rendering off-screen children.
	 *
	 * Camera2d's implementation tests a 2D bounds-rectangle overlap
	 * against `this.worldView` — that test is invalid under perspective:
	 * the visible region is a frustum that widens with distance and
	 * rotates with the camera's pitch / yaw, not a fixed axis-aligned
	 * rect at the camera's x / y. Camera3d substitutes plane-based
	 * frustum culling — each non-floating renderable's bounding sphere
	 * is tested against the six frustum planes that were extracted in
	 * the most recent `update()` call. Floating elements (HUD / UI)
	 * still use Camera2d's 2D rect test because their bounds are
	 * screen-space and the perspective transform doesn't apply to them.
	 * @param obj - the renderable to test
	 * @param [floating] - test against screen coordinates instead of frustum
	 * @returns true if the renderable's bounds overlap the frustum
	 */
	override isVisible(
		obj: Renderable,
		floating: boolean = obj.floating,
	): boolean {
		if (floating || obj.floating) {
			return super.isVisible(obj, floating);
		}
		// bounding sphere around the renderable's 2D bounds; the z
		// component is the renderable's depth (its world-space z).
		// Sprite billboards face the camera so a sphere bounded by
		// max(width, height) is the right conservative envelope.
		const bounds = obj.getBounds();
		const radius = Math.max(bounds.width, bounds.height) * 0.5;
		return this.frustum.intersectsSphere(
			bounds.centerX,
			bounds.centerY,
			obj.depth,
			radius,
		);
	}

	/**
	 * Per-frame update — extends Camera2d's behavior (target follow,
	 * camera effects) with rebuilding the frustum's six bounding
	 * planes so {@link Camera3d#isVisible} returns accurate results
	 * for the current camera state.
	 * @param dt - delta time in milliseconds
	 * @returns true if the camera's state changed
	 * @ignore
	 */
	override update(dt?: number): boolean {
		const dirty = super.update(dt);
		this._rebuildFrustumPlanes();
		return dirty;
	}

	/**
	 * Recompute the frustum's six bounding planes from the current
	 * `view × projection` matrix. Called from {@link Camera3d#update}
	 * each frame; `isVisible` then tests against the cached planes.
	 * @ignore
	 */
	_rebuildFrustumPlanes(): void {
		// build the view matrix R⁻¹ ∘ T(-pos) the same way
		// `_applyContainerViewTransform` builds it on the container —
		// rotate first (pitch then yaw), then translate.
		_viewMatrix.identity();
		if (this.pitch !== 0) {
			_viewMatrix.rotate(-this.pitch, AXIS_X);
		}
		if (this.yaw !== 0) {
			_viewMatrix.rotate(-this.yaw, AXIS_Y);
		}
		_viewMatrix.translate(-this.pos.x, -this.pos.y, -this.pos.z);

		// view × projection — the matrix that maps world coords to
		// clip space, which `Frustum.setFromViewProjection` decomposes
		// into the six bounding planes via Gribb-Hartmann extraction.
		_viewProjection.copy(this.frustum.projectionMatrix);
		_viewProjection.multiply(_viewMatrix);

		this.frustum.setFromViewProjection(_viewProjection);
	}
}
