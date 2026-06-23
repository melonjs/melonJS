import { Matrix3d } from "../math/matrix3d.ts";
import type { ObservableVector3d } from "../math/observableVector3d.ts";
import { Vector2d } from "../math/vector2d.ts";
import { Vector3d } from "../math/vector3d.ts";
import type Container from "./../renderable/container.js";
import type Renderable from "./../renderable/renderable.js";
import type Renderer from "./../video/renderer.js";
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
// scratch point for worldToScreen, reused to avoid per-call allocation
const _wsPoint = new Vector3d();
// scratch reused by the orientation-basis accessors (getBasis / getRight / …),
// to avoid per-call allocation on the billboard draw path.
const _basis = new Matrix3d();
const _bScratchA = new Vector3d();
const _bScratchB = new Vector3d();

/**
 * A perspective camera that extends {@link Camera2d} with a view
 * {@link Frustum} (fov / aspect / near / far) and orientation
 * (pitch / yaw / roll). Slots into `Stage.cameras` as a drop-in
 * replacement for `Camera2d` — inherits the post-effect FBO bracket,
 * color-matrix, fade / shake / follow plumbing, and screen viewport.
 *
 * **WebGL required.** Camera3d's perspective projection, depth-buffer
 * painter sort and mesh draw path all live in the WebGL renderer; the
 * Canvas backend has none of these and would render a stuck blank scene.
 * Construct the Application with `renderer: video.WEBGL` to get a hard
 * throw at construction time if WebGL is unavailable. Pairing
 * `cameraClass: Camera3d` with `video.AUTO` will emit a `console.warn`
 * at construction (and silently misrender) when AUTO falls back to
 * Canvas — see {@link ApplicationSettings.renderer} for the contract.
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
	 * Override `Camera2d.defaultSortOn` to declare `"depth"` as this
	 * camera's preferred sort mode. `Application` / `Stage` apply this
	 * to `world.sortOn` at bootstrap, so games opting into Camera3d via
	 * `cameraClass: Camera3d` get camera-distance painter's sort for
	 * free — the only correct sort for alpha-blended sprites under
	 * perspective.
	 */
	static override defaultSortOn: "x" | "y" | "z" | "depth" = "depth";

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
	 * World-space offset from the followed target. When `target` is
	 * set via {@link Camera2d#follow}, the camera position resolves to
	 * `target.pos + followOffset`. Common usage: `(0, -2, -8)` for a
	 * behind-and-above third-person view.
	 *
	 * Treated as world-space in this release — target-rotation-aware
	 * follow (where the offset rotates with the target's orientation,
	 * Cinemachine / Unreal spring-arm style) is deferred until a
	 * showcase needs it (e.g. AfterBurner's banking jet).
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
	 * Update the perspective near/far clip distances and rebuild the
	 * projection matrix in one shot. Anything closer than `near` or
	 * farther than `far` is clipped by the GPU; projection math also
	 * degrades sharply just before `far`, so size the far plane to the
	 * deepest object in your scene with a little headroom. Defaults are
	 * `near = 0.1`, `far = 1000` — typical AfterBurner-class scenes
	 * with enemies spawning at z = 3000+ need to push `far` out.
	 *
	 * **This is the supported way to change near/far at runtime.** The
	 * inherited `Camera2d.near` / `.far` are plain instance fields —
	 * direct assignment (`camera.near = 5`) updates the cached value
	 * but leaves the projection matrix stale until the next
	 * `resize()`. TypeScript's property-vs-accessor rule prevents
	 * shadowing the inherited fields with accessor pairs, so the
	 * convenience method is the public contract instead.
	 * @param near - near clip distance
	 * @param far - far clip distance
	 * @returns this camera (chainable)
	 */
	setClipPlanes(near: number, far: number): this {
		this.near = near;
		this.far = far;
		this.frustum.near = near;
		this.frustum.far = far;
		this.frustum.update();
		this.projectionMatrix.copy(this.frustum.projectionMatrix);
		return this;
	}

	/**
	 * Write the camera's world-space orientation basis into the given vectors:
	 * `right` (camera local +X), `up` (+Y), and `forward` (+Z — the direction the
	 * camera looks). Derived from `yaw` / `pitch` (the inverse of the view
	 * rotation), so they update as the camera turns. Handy for orienting
	 * camera-facing geometry — e.g. {@link Sprite3d} billboards.
	 * @param right - receives the right axis (unit)
	 * @param up - receives the up axis (unit)
	 * @param forward - receives the forward / look axis (unit)
	 * @returns this camera, for chaining
	 */
	getBasis(right: Vector3d, up: Vector3d, forward: Vector3d): this {
		// camera world orientation R = inverse of the view rotation. The view is
		// R(-pitch, X) ∘ R(-yaw, Y) (see _applyContainerViewTransform), so
		// R = R(yaw, Y) ∘ R(pitch, X); the columns of R (column-major `val`) are
		// the camera's right / up / forward axes in world space.
		_basis.identity();
		_basis.rotate(this.yaw, AXIS_Y);
		_basis.rotate(this.pitch, AXIS_X);
		const v = _basis.val;
		right.set(v[0], v[1], v[2]);
		up.set(v[4], v[5], v[6]);
		forward.set(v[8], v[9], v[10]);
		return this;
	}

	/**
	 * The camera's world-space right axis (unit). See {@link Camera3d#getBasis}.
	 * @param out - vector to write into (returned)
	 * @returns `out`
	 */
	getRight(out: Vector3d): Vector3d {
		this.getBasis(out, _bScratchA, _bScratchB);
		return out;
	}

	/**
	 * The camera's world-space up axis (unit). See {@link Camera3d#getBasis}.
	 * @param out - vector to write into (returned)
	 * @returns `out`
	 */
	getUp(out: Vector3d): Vector3d {
		this.getBasis(_bScratchA, out, _bScratchB);
		return out;
	}

	/**
	 * The camera's world-space forward / look axis (unit). See
	 * {@link Camera3d#getBasis}.
	 * @param out - vector to write into (returned)
	 * @returns `out`
	 */
	getForward(out: Vector3d): Vector3d {
		this.getBasis(_bScratchA, _bScratchB, out);
		return out;
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
		// copies the just-built frustum matrix into `projectionMatrix`
		// directly (without re-entering this method — that would
		// overwrite any user-supplied `opts.aspect`). TypeScript can't
		// model "this method runs during super-construction" so the
		// type system sees `this.frustum` as always-defined.
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
		// `screenProjection` stays a flat screen-space ortho so floating
		// renderables (HUDs, Text overlays) can swap to it during draw
		// instead of going through the perspective projection (which
		// would `w=0`-divide and NaN their projected positions).
		// Container.draw consults this for every floating child under
		// any camera, default or not.
		//
		// The ortho z range is wide and centered on 0 (NOT the
		// perspective `near`/`far`) because:
		// - The perspective frustum has `near = 0.1`, so a floating
		//   renderable left at the default `depth = 0` would sit in
		//   front of the near plane and get clipped.
		// - Floating UI doesn't need depth precision — z just has to
		//   be inside the ortho range. `[-1e6, +1e6]` matches Camera2d's
		//   own `near`/`far` defaults and gives the same "z doesn't
		//   matter" behavior 2D code already relies on.
		this.screenProjection.ortho(0, this.width, this.height, 0, -1e6, 1e6);
	}

	/**
	 * Override Camera2d's non-default projection setup so that a Camera3d
	 * used in split-screen / picture-in-picture still renders the world
	 * with perspective instead of falling back to a 2D ortho. The
	 * camera's perspective `projectionMatrix` is mirrored into
	 * `worldProjection`; the surrounding `clipRect` set by the base
	 * `draw()` handles confining the draw region to the camera's
	 * sub-screen rect, and the frustum's `aspect` is already in sync
	 * with the camera's width/height. `screenProjection` is left alone
	 * because it was already set up correctly in
	 * {@link Camera3d#_updateProjectionMatrix}.
	 * @ignore
	 */
	override _setupNonDefaultProjection(renderer: Renderer): void {
		this.worldProjection.copy(this.projectionMatrix);
		renderer.setProjection(this.worldProjection);
		// Confine the perspective NDC `[-1, +1]` to the camera's
		// sub-rect via the GL viewport. Without this, the perspective
		// matrix maps to the FULL canvas and `clipRect` then crops
		// to the sub-rect — producing a cropped slice of the
		// full-screen view rather than a properly-remapped sub-camera
		// (PR #1464 review). WebGL's `gl.viewport` uses bottom-left
		// origin, so the canvas-top-left `screenY` is flipped via
		// `renderer.height - screenY - height`. Canvas renderer's
		// inherited no-op `setViewport` swallows this safely.
		renderer.setViewport(
			this.screenX,
			renderer.height - this.screenY - this.height,
			this.width,
			this.height,
		);
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
		container.translate(-translateX, -translateY, -this.depth);

		// Refresh the container's painter's-algorithm order from the
		// current camera position — but ONLY when the container is on
		// the camera-distance sort that actually depends on the camera
		// moving. For `"x"`/`"y"`/`"z"` sorts the comparator is a pure
		// function of `pos`, so the container's normal "re-sort on
		// child mutation" lifecycle is sufficient and a per-camera
		// `sortNow` would be wasted O(N log N) work each frame. Only
		// `"depth"` keys off `(child.pos − camera.pos)²`, which DOES
		// shift when the camera moves between two frames where no
		// child mutated.
		if (container.sortOn === "depth") {
			container.sortNow(true);
		}
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
		container.translate(translateX, translateY, this.depth);
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
	 * Three call shapes:
	 * - `lookAt(x, y, z)` — raw world coordinates
	 * - `lookAt(vector3d)` — a 3D point
	 * - `lookAt(renderable)` — uses `renderable.pos` (matches the
	 *   `Renderable.lookAt(target)` signature so Camera3d is a structural
	 *   drop-in replacement for Camera2d / Renderable in user code).
	 *
	 * Last-write-wins with manual `pitch` / `yaw` assignment: if you
	 * call `lookAt(...)` then set `camera.pitch = 0.1` directly, the
	 * next frame renders with the manual pitch.
	 * @param xOrTarget - target world x, or a target with `pos` / `x`,`y`,`z`
	 * @param y - target world y (only when first arg is a number)
	 * @param z - target world z (only when first arg is a number)
	 * @returns this camera
	 */
	override lookAt(
		xOrTarget:
			| number
			| {
					x: number;
					y: number;
					z?: number;
					pos?: ObservableVector3d;
			  },
		y?: number,
		z?: number,
	): this {
		let tx: number;
		let ty: number;
		let tz: number;
		if (typeof xOrTarget === "number") {
			tx = xOrTarget;
			ty = y ?? 0;
			tz = z ?? 0;
		} else if (xOrTarget.pos) {
			tx = xOrTarget.pos.x;
			ty = xOrTarget.pos.y;
			tz = xOrTarget.pos.z;
		} else {
			tx = xOrTarget.x;
			ty = xOrTarget.y;
			tz = xOrTarget.z ?? 0;
		}
		const dx = tx - this.pos.x;
		const dy = ty - this.pos.y;
		const dz = tz - this.depth;

		// yaw = atan2(dx, dz) — rotation around Y axis to face the
		// XZ-plane projection of the direction vector
		this.yaw = Math.atan2(dx, dz);

		// Negate `dy` so the result matches the camera's sign
		// convention (positive pitch = camera looks up — see the
		// `pitch` field doc). Under Y-down, a target with positive
		// `dy` sits BELOW the camera; the camera should look DOWN,
		// which is a NEGATIVE pitch — exactly what `atan2(-dy, …)`
		// produces.
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
			// Direct .x/.y assignment + `this.depth` (which proxies to
			// pos.z) avoids the `as unknown as Pos3d` cast — Renderable
			// already exposes `depth` as the proper z accessor.
			this.pos.x = target.x + this.followOffset.x;
			this.pos.y = target.y + this.followOffset.y;
			this.depth = targetZ + this.followOffset.z;
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
		// Use the renderable's WORLD position for the frustum-sphere
		// test, not `bounds.centerX/Y`. The bounds rect is computed
		// with `addFrame()` and can stay in local coords when the
		// renderable is nested inside a Container (e.g. Particle inside
		// ParticleEmitter) — testing local coords against a world-
		// space frustum mis-culls nested children even when their actual
		// world position is inside the view.
		// `getAbsolutePosition` walks the ancestor chain summing
		// parent x/y AND z; previously we read `obj.depth` (local
		// `pos.z`) here, which silently mis-culled children of any
		// container whose own depth was non-zero.
		const bounds = obj.getBounds();
		// A grouping container with no intrinsic size has infinite / cleared
		// bounds (left=+∞, right=-∞). Its width/height are non-finite, so the
		// radius below would be NaN and `intersectsSphere` would silently report
		// it (and its whole subtree) invisible — skipping both its draw AND its
		// update. Such a container can't be frustum-culled meaningfully, so treat
		// it as always visible and let its children be culled individually
		// (matching Camera2d, which special-cases the same sentinel). This is
		// what keeps e.g. a GLTFModel rig (meshes nested under a sizeless
		// container) rendering under a 3D camera.
		if (!bounds.isFinite()) {
			return true;
		}
		// Half-diagonal — the conservative bounding-sphere radius for
		// a rectangular bounds rect. `max(w, h) * 0.5` is the
		// inradius and can mark a renderable invisible while one of
		// its corners is still on-screen near a frustum edge; the
		// circumradius √(w² + h²) / 2 always encloses every corner.
		const radius =
			Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height) *
			0.5;
		const absPos = obj.getAbsolutePosition();
		return this.frustum.intersectsSphere(absPos.x, absPos.y, absPos.z, radius);
	}

	/**
	 * Bulk frustum cull via the world's {@link Octree}. Returns every
	 * renderable whose octant the current frustum overlaps —
	 * conservative (some renderables may still narrow-cull out
	 * via {@link Camera3d#isVisible}'s per-sphere test) but
	 * O(visible + walk) instead of O(scene).
	 *
	 * Only applicable under `cameraClass: Camera3d` (or any setup
	 * where `world.sortOn === "depth"` and the broadphase is an
	 * Octree). Returns an empty array under a 2D broadphase — call
	 * sites can guard on the array length or branch on
	 * `world.sortOn`.
	 *
	 * For a 1000-renderable scene with ~50 visible, expect a 5-20×
	 * speedup over walking every renderable and per-item
	 * {@link Camera3d#isVisible}.
	 * @param world - the world to cull (its broadphase must be an Octree); typed structurally to sidestep the Camera3d → World import cycle
	 * @param world.broadphase - the world's spatial broadphase
	 * @param world.sortOn - guard: returns empty unless this equals `"depth"`
	 * @param [out] - caller-supplied result array (re-entrancy-safe)
	 * @returns visible-renderable candidates
	 * @example
	 * const visible = camera.queryVisible(app.world);
	 * for (const r of visible) {
	 *   // narrow-phase per-renderable visibility (sphere / OBB) if needed
	 *   if (camera.isVisible(r)) r.draw(renderer);
	 * }
	 */
	queryVisible(
		world: { broadphase: unknown; sortOn: string },
		out?: Renderable[],
	): Renderable[] {
		const result = out ?? [];
		result.length = 0;
		if (world.sortOn !== "depth") {
			return result;
		}
		// Duck-typed: the Octree exposes `queryFrustum`; the QuadTree
		// doesn't. We don't import the class here to avoid the cycle.
		const broadphase = world.broadphase as {
			queryFrustum?: (
				planes: Frustum["planes"],
				out?: Renderable[],
			) => Renderable[];
		};
		broadphase.queryFrustum?.(this.frustum.planes, result);
		return result;
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
	 * Project a world-space point to 2D screen (canvas pixel) coordinates
	 * through this camera's view + perspective projection (perspective divide
	 * included). The origin is top-left with **y down**, matching where
	 * geometry at `world` rasterizes and the engine's 2D draw space — so the
	 * result can be fed straight to the 2D draw API (HUD pinned to a 3D object,
	 * picking, debug overlays such as the 3D bounding-box wireframe).
	 *
	 * **Returns `null` when the point is at or behind the camera** (clip
	 * `w ≤ 0`) — projecting it would yield a mirrored/degenerate pixel, so
	 * callers (e.g. a debug wireframe) can skip it cleanly instead of drawing
	 * garbage. Otherwise returns the screen-space pixel coordinates.
	 * @param world - the world-space point to project
	 * @param [out] - optional Vector2d to receive the result (allocated if omitted)
	 * @returns the screen-space pixel coordinates, or `null` if behind the camera
	 */
	worldToScreen(
		world: Vector3d,
		out: Vector2d = new Vector2d(),
	): Vector2d | null {
		// projection × view — built exactly like `_rebuildFrustumPlanes`:
		// rotate (pitch then yaw), translate by -pos, then pre-multiply by the
		// frustum projection.
		_viewMatrix.identity();
		if (this.pitch !== 0) {
			_viewMatrix.rotate(-this.pitch, AXIS_X);
		}
		if (this.yaw !== 0) {
			_viewMatrix.rotate(-this.yaw, AXIS_Y);
		}
		_viewMatrix.translate(-this.pos.x, -this.pos.y, -this.depth);
		_viewProjection.copy(this.frustum.projectionMatrix);
		_viewProjection.multiply(_viewMatrix);

		// clip-space w (column-major): reject points at/behind the camera before
		// the perspective divide would mirror them.
		const m = _viewProjection.val;
		const w = m[3] * world.x + m[7] * world.y + m[11] * world.z + m[15];
		if (w <= 0) {
			return null;
		}

		// `Matrix3d.apply` divides by the clip-space w → normalized device
		// coordinates in [-1, 1].
		_wsPoint.set(world.x, world.y, world.z);
		_viewProjection.apply(_wsPoint);

		// NDC → screen pixels. NDC +y points up, screen +y points down, so the
		// y axis is flipped.
		out.set(
			(_wsPoint.x * 0.5 + 0.5) * this.width,
			(1 - (_wsPoint.y * 0.5 + 0.5)) * this.height,
		);
		return out;
	}

	/**
	 * Recompute the frustum's six bounding planes from the current
	 * `projectionMatrix × viewMatrix` (the world → clip matrix).
	 * Called from {@link Camera3d#update} each frame; `isVisible`
	 * then tests against the cached planes.
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
		_viewMatrix.translate(-this.pos.x, -this.pos.y, -this.depth);

		// projectionMatrix × viewMatrix — the matrix that maps world
		// coords to clip space (column-major / gl-matrix convention),
		// which `Frustum.setFromViewProjection` decomposes into the
		// six bounding planes via Gribb-Hartmann extraction.
		_viewProjection.copy(this.frustum.projectionMatrix);
		_viewProjection.multiply(_viewMatrix);

		this.frustum.setFromViewProjection(_viewProjection);
	}
}
