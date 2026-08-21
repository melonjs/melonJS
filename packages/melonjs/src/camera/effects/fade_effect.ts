import type { Color } from "../../math/color.ts";
import { colorPool } from "../../math/color.ts";
import type Tween from "../../tweens/tween.ts";
import { tweenPool } from "../../tweens/tween.ts";
import type Renderer from "../../video/renderer.js";
import type Camera2d from "../camera2d.ts";
import CameraEffect from "./camera_effect.ts";

/**
 * A camera effect that fades the screen to or from a color overlay.
 * @category Camera
 * @example
 * // fade to black
 * camera.addCameraEffect(new FadeEffect(camera, {
 *     color: "#000",
 *     duration: 500,
 *     direction: "in",
 * }));
 * @example
 * // flash white then fade back
 * camera.addCameraEffect(new FadeEffect(camera, {
 *     color: "#fff",
 *     duration: 200,
 *     direction: "out",
 * }));
 */
export default class FadeEffect extends CameraEffect {
	/**
	 * the overlay color
	 */
	color: Color;

	/**
	 * the tween controlling alpha transition
	 */
	tween: Tween;

	/**
	 * fade direction: "in" fades to the color, "out" fades from the color back to transparent
	 */
	direction: "in" | "out";

	/**
	 * target alpha value for completion check
	 * @ignore
	 */
	_targetAlpha: number;

	/**
	 * @param camera - the camera to apply the fade to
	 * @param options - fade parameters
	 * @param options.color - CSS color value or Color instance
	 * @param [options.duration=1000] - fade duration in milliseconds
	 * @param [options.direction="in"] - "in" fades to color, "out" fades from color to transparent
	 * @param [options.onComplete] - callback when the fade finishes
	 */
	constructor(
		camera: Camera2d,
		options: {
			color: Color | string;
			duration?: number | undefined;
			direction?: "in" | "out" | undefined;
			onComplete?: (() => void) | undefined;
		},
	) {
		super(camera);

		const duration = options.duration ?? 1000;
		this.direction = options.direction ?? "in";
		this.color = colorPool.get(options.color);

		if (this.direction === "in") {
			// fade IN to the color: alpha goes from 0 → target
			this._targetAlpha = this.color.alpha;
			this.color.alpha = 0.0;
			this.tween = tweenPool
				.get(this.color)
				.to({ alpha: this._targetAlpha }, { duration });
		} else {
			// fade OUT from the color: alpha goes from current → 0
			this._targetAlpha = 0.0;
			this.tween = tweenPool.get(this.color).to({ alpha: 0.0 }, { duration });
		}

		if (options.onComplete) {
			this.tween.onComplete(options.onComplete);
		}
		this.tween.isPersistent = true;
		this.tween.start();
	}

	override draw(renderer: Renderer, width: number, height: number): void {
		if (this.color.alpha === 0) {
			return;
		}
		const r = renderer as any;
		r.save();
		r.resetTransform();
		r.setColor(this.color);
		r.fillRect(0, 0, width, height);
		r.restore();
	}

	override update(): void {
		// check if the tween has reached its target
		if (this.direction === "in" && this.color.alpha >= this._targetAlpha) {
			this.isComplete = true;
		} else if (this.direction === "out" && this.color.alpha <= 0.0) {
			this.isComplete = true;
		}
	}

	override destroy(): void {
		// Guarded and cleared so a second destroy() is a no-op rather than a
		// throw. `removePostEffect()` destroys the effect it removes, so a
		// caller that also destroys it explicitly hits this path, and an
		// unguarded re-release throws "Instance is already in pool" from the
		// pool rather than from anything the caller can see. Same defect and
		// same fix as `Body.destroy()` in 20.0.0.
		if (this.tween !== undefined) {
			this.tween.stop();
			tweenPool.release(this.tween);
			this.tween = undefined as unknown as typeof this.tween;
		}
		if (this.color !== undefined) {
			colorPool.release(this.color);
			this.color = undefined as unknown as typeof this.color;
		}
	}
}
