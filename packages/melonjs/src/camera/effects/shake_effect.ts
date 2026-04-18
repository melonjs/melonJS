import type Camera2d from "../camera2d.ts";
import CameraEffect from "./camera_effect.ts";

/**
 * A camera effect that shakes the viewport by applying random offsets.
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
	}

	override update(dt: number): void {
		this.duration -= dt;
		if (this.duration <= 0) {
			this.duration = 0;
			this.camera.offset.setZero();
			this.isComplete = true;
			if (typeof this.onComplete === "function") {
				this.onComplete();
			}
		} else {
			const axis = this.camera.AXIS;
			if (this.axis === axis.BOTH || this.axis === axis.HORIZONTAL) {
				this.camera.offset.x = (Math.random() - 0.5) * this.intensity;
			}
			if (this.axis === axis.BOTH || this.axis === axis.VERTICAL) {
				this.camera.offset.y = (Math.random() - 0.5) * this.intensity;
			}
		}
	}

	override destroy(): void {
		this.camera.offset.setZero();
	}
}
