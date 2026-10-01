import { Color } from "../math/color.ts";
import { clamp, EPSILON } from "../math/math.ts";
import { Matrix3d } from "../math/matrix3d.ts";
import type { ObservableVector3d } from "../math/observableVector3d.ts";
import { Vector2d } from "../math/vector2d.ts";
import { Vector3d } from "../math/vector3d.ts";
import type Container from "./../renderable/container.js";
import type Renderable from "./../renderable/renderable.js";
import type Renderer from "./../video/renderer.js";
import Camera2d from "./camera2d.ts";
import type { Fog3dState, FogMode, FogOptions } from "./fog.ts";
import Frustum, { type FrustumOptions } from "./frustum.ts";

export type { Fog3dState, FogMode, FogOptions } from "./fog.ts";

// reusable unit-axis vectors for rotation calls. Pure constants so
// allocation only happens once per module load, not per frame.
const AXIS_X = new Vector3d(1, 0, 0);
const AXIS_Y = new Vector3d(0, 1, 0);
const AXIS_Z = new Vector3d(0, 0, 1);

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
// scratch for setBasis, kept apart from the pair above because those belong to
// getRight / getUp / getForward. Only forward needs one: `rollFromLocalUp`
// takes the up axis as three scalars and never writes to it.
const _sbForward = new Vector3d();

/**
 * True when every component of `v` is finite.
 *
 * Checked per component rather than on the sum: `(1e308, 1e308, 0)` has three
 * perfectly good components and a sum that is `Infinity`, and rejecting that
 * would refuse a direction we can resolve exactly.
 * @param v - the vector to test
 * @ignore
 * @internal
 */
function isFiniteVector(v: Vector3d): boolean {
	return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/**
 * Write the unit vector along `(x, y, z)` into `out`, at any input scale.
 *
 * Divides by the largest component before squaring anything, which puts the
 * sum of squares in `[1, 3]` however large or small the input is. Squaring in
 * the input's own scale instead has two failure modes, and this call site hits
 * both: past ~1e154 the sum is `Infinity` and every component divides to zero,
 * and past ~1e-162 the sum is zero and they divide to `Infinity`. The first
 * scale is unreachable in a game, but the SMALL end is not, and either way the
 * pre-division is exact in binary floating point, so it costs nothing but the
 * three divides.
 * @param out - vector to write into
 * @param x - x of the direction to normalise
 * @param y - y of the same
 * @param z - z of the same
 * @returns false when every component is zero, the one case that carries no
 * direction at all
 * @ignore
 * @internal
 */
function normalizeInto(
	out: Vector3d,
	x: number,
	y: number,
	z: number,
): boolean {
	const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
	if (scale === 0) {
		return false;
	}
	const sx = x / scale;
	const sy = y / scale;
	const sz = z / scale;
	const len = Math.sqrt(sx * sx + sy * sy + sz * sz);
	out.set(sx / len, sy / len, sz / len);
	return true;
}

/**
 * Solve the roll of a camera whose local +Y axis is `(ux, uy, uz)`, given the
 * pitch and yaw already solved from its forward axis.
 *
 * Works by projecting the given axis onto the zero-roll basis for that pitch
 * and yaw: `r0` is where the right axis would sit with no roll, `u0` where the
 * up axis would. The two dot products are then `-sin(roll)` and `cos(roll)`.
 *
 * Deliberately NOT the textbook `atan2(right.y, up.y)`, which divides through
 * by `cos(pitch)`: both of those components vanish at the poles, so that form
 * needs a degenerate branch that pins the roll to zero and loses the
 * orientation. These two operands stay O(1) at every pitch, so there is no
 * pole case to special-case.
 * @param ux - x of the camera's local +Y axis (need not be unit)
 * @param uy - y of the same
 * @param uz - z of the same
 * @param pitch - the pitch already solved from the forward axis
 * @param yaw - the yaw already solved from the forward axis
 * @returns the roll, or `NaN` when the axis is parallel to forward and so
 * determines nothing
 * @ignore
 * @internal
 */
function rollFromLocalUp(
	ux: number,
	uy: number,
	uz: number,
	pitch: number,
	yaw: number,
): number {
	// scale-reduce first. The test below asks whether the projection onto the
	// screen plane is negligible COMPARED WITH the axis itself, which is a
	// question about direction; against a fixed epsilon it would instead call
	// any axis shorter than 1e-6 degenerate and silently drop the roll of a
	// perfectly good `up`. Dividing by the largest component leaves the length
	// in [1, sqrt(3)], so the threshold is relative to within that factor.
	const scale = Math.max(Math.abs(ux), Math.abs(uy), Math.abs(uz));
	if (scale === 0) {
		return Number.NaN;
	}
	const nx = ux / scale;
	const ny = uy / scale;
	const nz = uz / scale;
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	// the zero-roll right (r0) and up (u0) axes for this pitch and yaw
	const dRight = nx * cy - nz * sy;
	const dUp = nx * sy * sp + ny * cp + nz * cy * sp;
	if (dRight * dRight + dUp * dUp < EPSILON * EPSILON) {
		return Number.NaN;
	}
	return Math.atan2(-dRight, dUp);
}

/**
 * A perspective camera that extends {@link Camera2d} with a view
 * {@link Frustum} (fov / aspect / near / far) and orientation
 * (pitch / yaw). Slots into `Stage.cameras` as a drop-in
 * replacement for `Camera2d` — inherits the post-effect FBO bracket,
 * color-matrix, fade / shake / follow plumbing, and screen viewport.
 *
 * **GPU backend required.** Camera3d's perspective projection,
 * depth-buffer painter sort and retained mesh draw path need a renderer
 * with a depth buffer (`renderer.supportsDepthBuffer` — WebGL 2 or
 * WebGPU); the Canvas backend has none of these and would render a
 * stuck blank scene. Construct the Application with
 * `renderer: video.WEBGL` or `video.WEBGPU` to make `app.init()` reject
 * when that backend is unavailable. Pairing `cameraClass: Camera3d`
 * with `video.AUTO` will emit a `console.warn` (and silently misrender)
 * when AUTO falls back to Canvas — see
 * {@link ApplicationSettings.renderer} for the contract.
 *
 * Conventions:
 * - **Y-down + +Z forward.** Sprite at higher `pos.y` appears lower
 *   on screen (same as Camera2d). Sprite at higher `pos.z` is
 *   farther from the camera and renders smaller. Matches melonJS's
 *   2D conventions so existing Camera2d code translates directly.
 * - **Three rotation angles.** `pitch` (X axis, look up/down) and
 *   `yaw` (Y axis, look left/right) and `roll` (Z axis, bank the horizon).
 *   The view is `R(yaw) ∘ R(pitch) ∘ R(roll)` inverted; the frustum planes are
 *   extracted from that same matrix, so culling follows a banked view. The
 *   inherited `currentTransform` is still NOT read — `camera.rotate()` on a
 *   3D camera does nothing, so set `roll` rather than rotating the camera.
 *   The basis those angles produce is readable with
 *   {@link Camera3d#getBasis} and writable with {@link Camera3d#setBasis},
 *   which is how a camera is posed over a curved surface where up is the
 *   surface normal and no pitch and yaw pair expresses it.
 * - **Follow offset (PR B scope).** When a target is set,
 *   `followOffset` is applied in **world space**:
 *   `camera.pos = target.pos + followOffset`. Target-rotation-aware
 *   follow (spring-arm style, where the offset
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
	 * the fog options as given to {@link Camera3d#setFog}, or `null` when fog
	 * is off. Read through the {@link Camera3d#fog} accessor.
	 * @ignore
	 * @internal
	 */
	private _fogOptions: FogOptions | null = null;

	/**
	 * The scalars, COPIED at `setFog` time rather than read back out of the
	 * caller's object.
	 *
	 * Retaining the object made four of the five fields live and the fifth
	 * not: mutating `mode` or `far` afterwards changed the fog and bypassed
	 * every check `setFog` performs, while mutating `color` did nothing. The
	 * documented model — a `Color` is live, everything else is settled at the
	 * call — is now the real one.
	 * @ignore
	 * @internal
	 */
	private _fogMode: FogMode = "linear";
	/**
	 * @ignore
	 * @internal
	 */ private _fogNear: number | undefined = undefined;
	/**
	 * @ignore
	 * @internal
	 */ private _fogFar: number | undefined = undefined;
	/**
	 * @ignore
	 * @internal
	 */ private _fogDensity: number | undefined = undefined;
	/**
	 * @ignore
	 * @internal
	 */ private _fogHeight = 0;
	/**
	 * @ignore
	 * @internal
	 */ private _fogHeightFalloff = 0;

	/**
	 * Owned colour, used only when the caller passed a CSS string or an array.
	 * A caller-supplied `Color` is referenced rather than copied, and the
	 * default tracks `renderer.backgroundColor`, so in both of those cases
	 * this stays `null`.
	 * @ignore
	 * @internal
	 */
	private _fogOwnColor: Color | null = null;

	/**
	 * Resolved fog handed to the renderer. Allocated once and rewritten in
	 * place each frame — fog costs no per-frame allocation.
	 * @ignore
	 * @internal
	 */
	private _fogState: Fog3dState = {
		mode: 0,
		near: 0,
		invRange: 0,
		density: 0,
		color: new Float32Array(3),
		heightAxis: new Float32Array(3),
		heightBase: 1,
	};

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
	 * Z-axis rotation in radians (bank the horizon). Positive values
	 * roll the camera clockwise, so the world tilts anticlockwise —
	 * the view from a cockpit banking right.
	 *
	 * Completes the `pitch` / `yaw` / `roll` trio. Note this is NOT the
	 * inherited {@link Renderable#rotation}: a 3D camera builds its view
	 * from these three angles and never reads `currentTransform`, which
	 * is why `camera.rotate()` on a `Camera3d` is silently inert. A
	 * `Camera2d` is the other way round — it has no `roll` because a
	 * screen-plane rotation IS its only rotation, and `rotate()` already
	 * does it through `currentTransform`.
	 * @default 0
	 * @example
	 * // bank with the player's steering, as a flight game would
	 * camera.roll = (player.pos.x / PLAY_BOUND_X) * MAX_BANK;
	 */
	override get roll(): number {
		return this._roll;
	}

	override set roll(value: number) {
		// Overrides the 2D accessor deliberately. A 2D camera's roll IS a
		// `currentTransform` rotation, but a 3D view is built from its three
		// angles and never reads that matrix — so rotating it here would leave
		// a transform that does nothing in 3D but still skews `worldToLocal`.
		this._roll = value;
	}

	/**
	 * World-space offset from the followed target. When `target` is
	 * set via {@link Camera2d#follow}, the camera position resolves to
	 * `target.pos + followOffset`. Common usage: `(0, -2, -8)` for a
	 * behind-and-above third-person view.
	 *
	 * Treated as world-space in this release — target-rotation-aware
	 * follow (where the offset rotates with the target's orientation,
	 * spring-arm style) is deferred until a
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
		this.roll = 0;
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
	 * Enable, reconfigure, or switch off distance fog for this camera.
	 *
	 * Fog fades mesh geometry toward a colour with distance, which is what
	 * stops a 3D scene reading as flat cut-outs and lets props appear at the
	 * far plane without a visible edge. It is **off until you call this**, and
	 * a scene that never does renders exactly as it did before.
	 *
	 * Two curves, chosen with `mode`:
	 *
	 * | mode | parameters | character |
	 * | --- | --- | --- |
	 * | `"linear"` (default) | `near`, `far` | you name the two distances |
	 * | `"exp2"` | `density` | clear up close, closes fast at range |
	 *
	 * Every parameter is optional, and an omitted one is **resolved live each
	 * frame** rather than captured here: distances track the camera's own clip
	 * planes and the colour tracks `renderer.backgroundColor`. That is
	 * deliberate — fog distances that silently disagreed with the clip planes
	 * after a later {@link Camera3d#setClipPlanes} call would clip geometry
	 * before it finished fading, and a fog colour that did not follow a
	 * day/night background fade would leave a band at the horizon.
	 *
	 * Fog is per camera, so a split-screen or minimap view fogs independently
	 * — and a `Camera2d` never fogs at all.
	 *
	 * `heightFalloff` adds a second falloff with altitude, so mist pools in low
	 * ground instead of hanging at every height equally. It defaults to 0,
	 * which is uniform fog — not a special case, the same integral with the
	 * dial at zero.
	 * @param options - fog settings, or `null` to switch fog off
	 * @returns this camera (chainable)
	 * @throws {Error} on an unknown `mode`, a non-finite or negative distance,
	 * `far` at or below `near`, or a density at or below zero
	 * @example
	 * // A typical outdoor scene: set the sky, size the frustum to the level,
	 * // then let fog take its distances and its colour from both.
	 * class GameStage extends Stage {
	 *   onResetEvent(app) {
	 *     app.renderer.backgroundColor.parseCSS("#cfe6f7");
	 *
	 *     const camera = app.viewport; // a Camera3d
	 *     camera.setClipPlanes(1, 9000);
	 *     // no colour passed: it tracks `backgroundColor`, so the terrain
	 *     // dissolves into the sky and props arrive without a hard edge
	 *     camera.setFog({ near: 1200, far: 7000 });
	 *   }
	 * }
	 * @example
	 * // A single density instead of two distances. Omit it and it resolves to
	 * // `2 / far`, which reads the same at any world scale.
	 * camera.setFog({ mode: "exp2", density: 0.0004 });
	 * @example
	 * // Fog that is deliberately NOT the sky — a green murk under a blue sky.
	 * // Passing a `Color` keeps it by reference, so this fog can be animated
	 * // by mutating the colour, without calling `setFog` again.
	 * const murk = new Color(90, 120, 80);
	 * camera.setFog({ far: 5000, color: murk });
	 * murk.setColor(60, 90, 55); // thickens over the next frame
	 * @example
	 * // Mist pooling in a valley: dense along the floor, thinning up the
	 * // walls so the tree line stays crisp. Render space is Y-down, so
	 * // `fogHeight` is the floor and density rises BELOW it.
	 * camera.setFog({
	 *   near: 1200,
	 *   far: 7000,
	 *   fogHeight: 0,
	 *   heightFalloff: 0.0015,
	 * });
	 * @example
	 * // Everything is optional: with nothing at all, fog spans the camera's
	 * // own clip planes in the backdrop's colour.
	 * camera.setFog({});
	 * camera.setFog(null); // and off again
	 * @see Camera3d#setClipPlanes
	 * @see Mesh#fog
	 */
	setFog(options: FogOptions | null): this {
		if (options === null || options === undefined) {
			this._fogOptions = null;
			this._fogOwnColor = null;
			return this;
		}

		const mode = options.mode ?? "linear";
		if (mode !== "linear" && mode !== "exp2") {
			throw new Error(
				`Camera3d.setFog: unknown mode "${String(options.mode)}" (expected "linear" or "exp2")`,
			);
		}
		// Only EXPLICIT values are validated here. A default that later goes
		// degenerate — `setClipPlanes(5, 5)` after `setFog({})` — cannot throw
		// retroactively from inside a draw, so the resolver drops fog for that
		// frame instead.
		for (const [name, value] of [
			["near", options.near],
			["far", options.far],
			["density", options.density],
		] as const) {
			if (value !== undefined && !Number.isFinite(value)) {
				throw new Error(`Camera3d.setFog: ${name} must be a finite number`);
			}
		}
		if (options.near !== undefined && options.near < 0) {
			throw new Error("Camera3d.setFog: near must not be negative");
		}
		if (
			options.near !== undefined &&
			options.far !== undefined &&
			options.far <= options.near
		) {
			throw new Error("Camera3d.setFog: far must be greater than near");
		}
		if (options.density !== undefined && options.density <= 0) {
			throw new Error("Camera3d.setFog: density must be greater than zero");
		}
		for (const [name, value] of [
			["fogHeight", options.fogHeight],
			["heightFalloff", options.heightFalloff],
		] as const) {
			if (value !== undefined && !Number.isFinite(value)) {
				throw new Error(`Camera3d.setFog: ${name} must be a finite number`);
			}
		}
		if (options.heightFalloff !== undefined && options.heightFalloff < 0) {
			throw new Error("Camera3d.setFog: heightFalloff must not be negative");
		}

		this._fogOptions = options;
		this._fogMode = mode;
		/**
		 * @ignore
		 * @internal
		 */
		this._fogNear = options.near;
		/**
		 * @ignore
		 * @internal
		 */
		this._fogFar = options.far;
		/**
		 * @ignore
		 * @internal
		 */
		this._fogDensity = options.density;
		/**
		 * @ignore
		 * @internal
		 */
		this._fogHeight = options.fogHeight ?? 0;
		// zero is uniform fog — the maths below collapses to the distance-only
		// form exactly, so the default changes nothing
		/**
		 * @ignore
		 * @internal
		 */
		this._fogHeightFalloff = options.heightFalloff ?? 0;
		// A `Color` is referenced so mutating it animates the fog; anything
		// else is parsed once into a colour this camera owns.
		if (options.color === undefined || options.color instanceof Color) {
			this._fogOwnColor = null;
		} else if (Array.isArray(options.color)) {
			// glTF convention: [r, g, b] in 0..1
			this._fogOwnColor = new Color(
				options.color[0] * 255,
				options.color[1] * 255,
				options.color[2] * 255,
				1,
			);
		} else {
			this._fogOwnColor = new Color().parseCSS(options.color);
		}
		return this;
	}

	/**
	 * The fog settings as given to {@link Camera3d#setFog}, or `null` when fog
	 * is off. The omitted fields are not filled in here — they are resolved
	 * per frame against the clip planes and the renderer's background colour.
	 */
	get fog(): FogOptions | null {
		if (this._fogOptions === null) {
			return null;
		}
		// A fresh object, not the one that was passed in: the scalars are
		// copied at `setFog` time, so handing back a live handle would look
		// mutable while changing nothing. Call `setFog` again to change them.
		const out: FogOptions = { mode: this._fogMode };
		if (this._fogNear !== undefined) {
			out.near = this._fogNear;
		}
		if (this._fogFar !== undefined) {
			out.far = this._fogFar;
		}
		if (this._fogDensity !== undefined) {
			out.density = this._fogDensity;
		}
		if (this._fogHeight !== 0) {
			out.fogHeight = this._fogHeight;
		}
		if (this._fogHeightFalloff !== 0) {
			out.heightFalloff = this._fogHeightFalloff;
		}
		const colour = this._fogOwnColor ?? this._fogOptions.color;
		if (colour !== undefined) {
			out.color = colour;
		}
		return out;
	}

	/**
	 * Resolve this camera's fog for one frame, or `null` for no fog.
	 *
	 * Overrides the `Camera2d` hook, which returns `null` — that is what makes
	 * a 2D camera clear fog rather than inherit whatever the previous camera
	 * left behind.
	 * @param renderer - the renderer about to draw with this camera
	 * @param translateY - the world Y the view maps to its origin. Defaults to
	 * this camera's own position plus its offset, which is what the default
	 * camera's view uses; `draw` passes the exact value so a non-default
	 * camera's container offset is included too.
	 * @ignore
	 * @internal
	 */
	override _fog3dState(
		renderer: Renderer,
		translateY: number = this.pos.y + this.offset.y,
	): Fog3dState | null {
		const options = this._fogOptions;
		if (options === null) {
			return null;
		}

		const state = this._fogState;
		const far = this._fogFar ?? this.far;

		if (this._fogMode === "exp2") {
			const density = this._fogDensity ?? (far > 0 ? 2 / far : 0);
			if (!(density > 0) || !Number.isFinite(density)) {
				return null;
			}
			state.mode = 2;
			state.density = density;
			state.near = 0;
			state.invRange = 0;
		} else {
			const near = this._fogNear ?? this.near;
			// a range that collapsed after a later setClipPlanes call: drop fog
			// for this frame rather than dividing by zero into the shader
			if (!(far > near) || !Number.isFinite(near) || !Number.isFinite(far)) {
				return null;
			}
			state.mode = 1;
			state.near = near;
			state.invRange = 1 / (far - near);
			state.density = 0;
		}

		// `Color` stores 0..255 components; the shaders want 0..1, matching how
		// light colours are packed
		const color =
			this._fogOwnColor ??
			(options.color instanceof Color
				? options.color
				: renderer.backgroundColor);
		// Bake the height integral into the two operands the shaders can use
		// directly. It runs from the camera to the fragment, and the only
		// position a vertex stage has is PRE-VIEW — `uModelMatrix * position`,
		// which is the mesh's parent space, not the world, because
		// `Container.draw` folds every ancestor into the view matrix. Reading
		// a height off that put the fog floor at the wrong altitude for
		// anything under a scaled container.
		//
		// So the height difference is taken in view space instead. The camera
		// orientation's columns are its right / up / forward axes in world
		// space (see getBasis), so the matching ROW is the Y component of each
		// — the world-up axis expressed in view space. Dotting it against a
		// view-space position gives that point's height above the camera
		// whatever the ancestors did, since they are inside the view matrix
		// that produced it. The falloff `k` multiplies in here rather than in
		// the shader, so the exponent is a single dot product.
		const k = this._fogHeightFalloff;
		_basis.identity();
		_basis.rotate(this.yaw, AXIS_Y);
		_basis.rotate(this.pitch, AXIS_X);
		_basis.rotate(this.roll, AXIS_Z);
		const b = _basis.val;
		state.heightAxis[0] = k * b[1];
		state.heightAxis[1] = k * b[5];
		state.heightAxis[2] = k * b[9];
		// clamped before the exponential, not after: a camera far below the
		// reference height overflows it otherwise and whitens the frame
		// `translateY`, not `pos.y`: the other end of this integral is a
		// view-space position, so both ends have to be anchored at the world Y
		// the view maps to its origin. That includes `offset` — otherwise a
		// `camera.shake()` walks the two ends apart and modulates the whole
		// scene's fog thickness for the duration of the shake.
		state.heightBase = Math.exp(
			clamp(k * (translateY - this._fogHeight), -30, 30),
		);
		state.color[0] = color.r / 255;
		state.color[1] = color.g / 255;
		state.color[2] = color.b / 255;
		return state;
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
		_basis.rotate(this.roll, AXIS_Z);
		const v = _basis.val;
		right.set(v[0], v[1], v[2]);
		up.set(v[4], v[5], v[6]);
		forward.set(v[8], v[9], v[10]);
		return this;
	}

	/**
	 * Restore the camera to its initial state: at the given position, looking
	 * straight down the z axis with a level horizon.
	 *
	 * Overridden because the inherited 2D version resets only what a 2D
	 * camera has. It clears `roll`, since in 2D the roll IS the transform
	 * matrix it identity-resets, and it writes `pos.x` and `pos.y`. A 3D
	 * camera also has `pitch`, `yaw` and a depth, none of which it knows
	 * about, so `reset()` used to leave a camera pointing wherever it had
	 * been left and standing at whatever depth it had reached.
	 * @param [x=0] - world x to reset to
	 * @param [y=0] - world y to reset to
	 * @param [z=0] - depth to reset to
	 */
	override reset(x = 0, y = 0, z = 0): void {
		// clears the 2D state, `roll` included: that one lives in the
		// transform matrix this identity-resets
		super.reset(x, y);
		this.pitch = 0;
		this.yaw = 0;
		this.depth = z;
	}

	/**
	 * Pose the camera FROM a basis: the writable counterpart of
	 * {@link Camera3d#getBasis}, taking the same three vectors in the same
	 * order. `setBasis(...)` straight after `getBasis(...)` is the identity.
	 *
	 * This is what a view over a curved surface needs. Up there is the
	 * surface normal and differs at every point, so no pitch and yaw pair
	 * expresses it, and integrating angles towards it drifts and gimbals at
	 * the poles. Hand over the frame the game already has instead.
	 *
	 * The basis is decoded into `pitch`, `yaw` and `roll`, which remain the
	 * camera's only orientation state, so the view transform, the frustum
	 * planes, the fog axis and {@link Sprite3d} billboards all follow with
	 * nothing to invalidate. A consequence worth knowing: the camera can
	 * never end up holding something that is not a rotation. A non-unit or
	 * slightly sheared triple is absorbed rather than rejected, `forward`
	 * winning, then the component of `up` perpendicular to it, with `right`
	 * consulted only when `up` decides nothing. A surface frame integrated
	 * over thousands of steps drifts off orthonormal, and this is the
	 * difference between a camera that tolerates that and one that renders a
	 * sheared view.
	 *
	 * The vectors passed in are never modified.
	 *
	 * Note `up` here is the camera's local +Y column, which under this
	 * engine's Y-down render space points DOWN the screen. That is the
	 * opposite of {@link Camera3d#lookAt}'s `up`, which is the direction that
	 * should appear up on screen. The two are one negation apart, and each
	 * is the natural sense for its own call.
	 * @param right - the camera's local +X axis, in world space
	 * @param up - the camera's local +Y axis, in world space
	 * @param forward - the camera's local +Z axis: where it looks
	 * @returns this camera, for chaining
	 * @throws {Error} if any component is not finite, or every component of
	 * `forward` is zero. The axes need not be unit, or even close to it: only
	 * their directions are read.
	 * @see Camera3d#getBasis
	 * @example
	 * // a camera standing on the surface of a globe, looking along it
	 * const up = surfaceNormal(player);          // differs at every point
	 * const forward = heading(player);
	 * const right = forward.clone().cross(up).normalize();
	 * camera.setBasis(right, up, forward);
	 */
	setBasis(right: Vector3d, up: Vector3d, forward: Vector3d): this {
		if (
			!isFiniteVector(right) ||
			!isFiniteVector(up) ||
			!isFiniteVector(forward)
		) {
			throw new Error(
				"Camera3d.setBasis: right, up and forward must all be finite vectors",
			);
		}
		// writes a copy, so a caller handing over a shared read-only axis
		// keeps it. Only an all-zero forward is refused: every other length is
		// a direction, and the magnitude of one carries no meaning.
		if (!normalizeInto(_sbForward, forward.x, forward.y, forward.z)) {
			throw new Error("Camera3d.setBasis: forward must have a non-zero length");
		}

		// `clamp` is belt and braces: after the normalise above the component
		// is within [-1, 1] by construction. It stays because `asin` of a
		// value a single ulp past 1 is NaN, which blanks the view with nothing
		// in the console, and one comparison is a poor price for ruling that
		// out. No test covers it: I could not construct an input that reaches
		// it.
		const pitch = Math.asin(clamp(-_sbForward.y, -1, 1));
		const yaw = Math.atan2(_sbForward.x, _sbForward.z);

		// roll from `up` where it determines one, else from `right`, else
		// leave the roll alone: with up parallel to forward there is no
		// rotation about the view axis to recover
		let roll = rollFromLocalUp(up.x, up.y, up.z, pitch, yaw);
		if (Number.isNaN(roll)) {
			// `right` lands a quarter turn from `up`, hence the offset
			const fromRight = rollFromLocalUp(right.x, right.y, right.z, pitch, yaw);
			roll = Number.isNaN(fromRight) ? this.roll : fromRight + Math.PI / 2;
		}

		this.pitch = pitch;
		this.yaw = yaw;
		this.roll = roll;
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
	 * @internal
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
	 * @internal
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
	 * @internal
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
		if (this.roll !== 0) {
			container.rotate(-this.roll, AXIS_Z);
		}
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
	 * @internal
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
		if (this.roll !== 0) {
			container.rotate(this.roll, AXIS_Z);
		}
	}

	/**
	 * Point the camera at a world-space target by deriving pitch and
	 * yaw from the direction (target − camera.pos).
	 *
	 * Three call shapes:
	 * - `lookAt(x, y, z)` — raw world coordinates
	 * - `lookAt(vector3d)` — a 3D point
	 * - `lookAt(renderable)` — uses `renderable.pos` (matches the
	 *   `Renderable.lookAt(target)` signature so Camera3d is a structural
	 *   drop-in replacement for Camera2d / Renderable in user code).
	 *
	 * **With no `up`, roll is untouched**, exactly as before this argument
	 * existed. Pass one to bank the horizon as well: it is the direction that
	 * should appear UP ON SCREEN, so a level horizon is `(0, -1, 0)` — this
	 * engine renders Y-down, which is why the visual up axis is negative Y.
	 * It is given no default on purpose, because defaulting it would silently
	 * zero the roll of every camera that had one.
	 *
	 * Note this is the opposite sense to {@link Camera3d#setBasis}'s `up`,
	 * which is the camera's local +Y column and points down the screen. Each
	 * is the natural reading for its own call, and they are one negation
	 * apart.
	 *
	 * When the direction to the target is parallel to `up` there is no
	 * rotation about the view axis to solve, so the roll is left as it was
	 * and the camera still points exactly at the target.
	 *
	 * Last-write-wins with manual `pitch` / `yaw` assignment: if you
	 * call `lookAt(...)` then set `camera.pitch = 0.1` directly, the
	 * next frame renders with the manual pitch. The same holds for
	 * {@link Camera3d#setBasis}.
	 * @param xOrTarget - target world x, or a target to look at: any renderable, or anything carrying `pos` or `x`/`y`/`z`
	 * @param yOrUp - target world y when the first argument is a number, otherwise the up direction
	 * @param z - target world z (only when first arg is a number)
	 * @param up - the direction to appear up on screen (only when first arg is a number)
	 * @returns this camera
	 * @example
	 * camera.lookAt(target);                        // pitch and yaw only
	 * camera.lookAt(target, surfaceNormal);         // and bank to the surface
	 */
	override lookAt(
		target:
			| Renderable
			| {
					x: number;
					y: number;
					z?: number;
					pos?: ObservableVector3d;
			  },
		up?: Vector3d,
	): this;
	override lookAt(x: number, y?: number, z?: number, up?: Vector3d): this;
	override lookAt(
		xOrTarget:
			| number
			| Renderable
			| {
					x: number;
					y: number;
					z?: number;
					pos?: ObservableVector3d;
			  },
		yOrUp?: number | Vector3d,
		z?: number,
		up?: Vector3d,
	): this {
		let tx: number;
		let ty: number;
		let tz: number;
		// the object form carries `up` as its SECOND argument, the numeric
		// form as its fourth
		let wantedUp: Vector3d | undefined;
		if (typeof xOrTarget === "number") {
			wantedUp = up;
		} else {
			wantedUp = yOrUp instanceof Vector3d ? yOrUp : undefined;
		}
		const y = typeof yOrUp === "number" ? yOrUp : undefined;
		if (typeof xOrTarget === "number") {
			tx = xOrTarget;
			ty = y ?? 0;
			tz = z ?? 0;
		} else {
			// A renderable carries its position in `pos`; anything else IS the
			// position. Stated as one weak shape both arms satisfy, so neither
			// needs an assertion to read. `z` is optional throughout, which is
			// what lets a 2D vector target land on depth 0.
			const target: {
				x?: number;
				y?: number;
				z?: number;
				pos?: { x: number; y: number; z?: number };
			} = xOrTarget;
			const at = target.pos ?? target;
			tx = at.x ?? 0;
			ty = at.y ?? 0;
			tz = at.z ?? 0;
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
		// `hypot`, not `sqrt(dx * dx + dz * dz)`: that sum overflows to
		// Infinity for a target far enough out, and the pitch then collapses
		// to a level zero instead of pointing at it
		const horizontalDist = Math.hypot(dx, dz);
		this.pitch = Math.atan2(-dy, horizontalDist);

		if (wantedUp !== undefined) {
			// `up` is what should read as up on SCREEN, and the camera's own
			// +Y points screen-down under Y-down, so the local up axis it
			// asks for is the negation
			const roll = rollFromLocalUp(
				-wantedUp.x,
				-wantedUp.y,
				-wantedUp.z,
				this.pitch,
				this.yaw,
			);
			// NaN means the target lies along `up`, where no roll is
			// determined; keep the one we had rather than lurching to zero
			if (!Number.isNaN(roll)) {
				this.roll = roll;
			}
		}

		return this;
	}

	/**
	 * Convenience overload of `lookAt` accepting a {@link Vector3d}.
	 * @param target - world-space point to look at
	 * @param up - optional direction to appear up on screen; see {@link Camera3d#lookAt}
	 * @returns this camera
	 */
	setLookAt(target: Vector3d, up?: Vector3d): this {
		return this.lookAt(target.x, target.y, target.z, up);
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
	 * target's orientation, spring-arm style) lands when a
	 * showcase (AfterBurner's banking jet) demands it.
	 * @param dt - delta time in milliseconds (ignored — no damping)
	 * @ignore
	 * @internal
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
			this.setPosition(
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
	 * @internal
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
		if (this.roll !== 0) {
			_viewMatrix.rotate(-this.roll, AXIS_Z);
		}
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
	 * @internal
	 */
	_rebuildFrustumPlanes(): void {
		// build the view matrix R⁻¹ ∘ T(-pos) the same way
		// `_applyContainerViewTransform` builds it on the container —
		// rotate first (pitch then yaw), then translate.
		_viewMatrix.identity();
		if (this.roll !== 0) {
			_viewMatrix.rotate(-this.roll, AXIS_Z);
		}
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
