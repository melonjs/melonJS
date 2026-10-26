import { Vector2d } from "../../math/vector2d.ts";
import type Camera2d from "../camera2d.ts";
import CameraEffect from "./camera_effect.ts";

// For each shaken camera: the offset the game gave it (`base`), and the
// offset as its shakes last left it (`left`: the base plus the jitter of
// every shake running on it). An offset that no longer reads `left` was set
// since, by the game or a reset: it becomes the base, and the shakes go on
// around it. Shared by every shake of a camera, so two at once add up.
const shaken = new WeakMap<Camera2d, { base: Vector2d; left: Vector2d }>();

/**
 * A camera effect that shakes the viewport. Each frame it adds a random
 * jitter to the camera's {@link Camera2d#offset}, and takes it back off when
 * it ends, so an offset the game sets, before or during the shake, is kept.
 * @category Camera
 * @example
 * camera.addCameraEffect(new ShakeEffect(camera, {
 *     intensity: 10,
 *     duration: 500,
 *     axis: camera.AXIS.BOTH,
 * }));
 */
export default class ShakeEffect extends CameraEffect {
	/**
	 * maximum pixel offset during shake
	 */
	intensity: number;

	/**
	 * remaining duration in milliseconds
	 */
	duration: number;

	/**
	 * which axes to shake (use camera.AXIS constants)
	 */
	axis: number;

	/**
	 * optional callback when shake completes
	 */
	onComplete: (() => void) | undefined;

	/**
	 * the jitter this shake has added to the camera's offset
	 * @ignore
	 * @internal
	 */
	_jitter: Vector2d;

	/**
	 * @param camera - the camera to shake
	 * @param options - shake parameters
	 * @param options.intensity - maximum offset in pixels
	 * @param options.duration - duration in milliseconds
	 * @param [options.axis=3] - which axes (NONE=0, HORIZONTAL=1, VERTICAL=2, BOTH=3)
	 * @param [options.onComplete] - callback when the shake finishes
	 */
	constructor(
		camera: Camera2d,
		options: {
			intensity: number;
			duration: number;
			axis?: number | undefined;
			onComplete?: (() => void) | undefined;
		},
	) {
		super(camera);
		this.intensity = options.intensity;
		this.duration = options.duration;
		this.axis = options.axis ?? camera.AXIS.BOTH;
		this.onComplete = options.onComplete;
		this._jitter = new Vector2d();
	}

	/**
	 * set this shake's jitter, and the camera's offset to the game's own plus
	 * the jitter of every shake running on it
	 * @param x - the horizontal jitter
	 * @param y - the vertical jitter
	 * @ignore
	 * @internal
	 */
	_setJitter(x: number, y: number): void {
		const camera = this.camera;
		const offset = camera.offset;
		let state = shaken.get(camera);
		if (state === undefined) {
			state = { base: offset.clone(), left: offset.clone() };
			shaken.set(camera, state);
		} else if (!offset.equals(state.left)) {
			state.base.copy(offset);
		}
		this._jitter.set(x, y);
		offset.copy(state.base);
		let listed = false;
		for (const effect of camera.cameraEffects) {
			if (effect instanceof ShakeEffect) {
				offset.add(effect._jitter);
				listed ||= effect === this;
			}
		}
		// a shake updated without being added to the camera
		if (!listed) {
			offset.add(this._jitter);
		}
		state.left.copy(offset);
	}

	override update(dt: number): void {
		this.duration -= dt;
		if (this.duration <= 0) {
			this.duration = 0;
			this._setJitter(0, 0);
			// once, on the transition into complete: see the same guard in
			// `MaskEffect`, which a persistent effect makes load-bearing
			if (!this.isComplete) {
				this.isComplete = true;
				if (typeof this.onComplete === "function") {
					this.onComplete();
				}
			}
		} else {
			const axis = this.camera.AXIS;
			let x = 0;
			let y = 0;
			if (this.axis === axis.BOTH || this.axis === axis.HORIZONTAL) {
				x = (Math.random() - 0.5) * this.intensity;
			}
			if (this.axis === axis.BOTH || this.axis === axis.VERTICAL) {
				y = (Math.random() - 0.5) * this.intensity;
			}
			this._setJitter(x, y);
		}
	}

	override destroy(): void {
		this._setJitter(0, 0);
	}
}
