import { Ellipse, ellipsePool } from "../../geometries/ellipse.ts";
import { Polygon, polygonPool } from "../../geometries/polygon.ts";
import type { Color } from "../../math/color.ts";
import { colorPool } from "../../math/color.ts";
import type Tween from "../../tweens/tween.ts";
import { tweenPool } from "../../tweens/tween.ts";
import type Renderer from "../../video/renderer.js";
import type Camera2d from "../camera2d.ts";
import CameraEffect from "./camera_effect.ts";

type MaskShape = Ellipse | Polygon;

/**
 * A camera effect that performs a mask-based scene transition.
 * A shape (ellipse, polygon) is scaled from full-screen to zero (hide)
 * or from zero to full-screen (reveal), with the area outside the shape
 * filled with a solid color.
 * @category Camera
 * @example
 * // iris transition (circle shrinks to hide the scene)
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: new Ellipse(0, 0, 1, 1),
 *     color: "#000",
 *     duration: 500,
 *     direction: "hide",
 * }));
 * @example
 * // diamond reveal transition
 * camera.addCameraEffect(new MaskEffect(camera, {
 *     shape: new Polygon(0, 0, [
 *         { x: 0, y: -1 }, { x: 1, y: 0 },
 *         { x: 0, y: 1 }, { x: -1, y: 0 },
 *     ]),
 *     color: "#000",
 *     duration: 500,
 *     direction: "reveal",
 * }));
 */
export default class MaskEffect extends CameraEffect {
	/**
	 * the transition fill color
	 */
	color: Color;

	/**
	 * the mask shape template (unit-sized, centered at origin)
	 */
	shape: MaskShape;

	/**
	 * current progress value (0 = fully covered, 1 = fully visible)
	 */
	progress: { value: number };

	/**
	 * the tween controlling progress
	 */
	tween: Tween;

	/**
	 * transition direction
	 */
	direction: "hide" | "reveal";

	/**
	 * optional callback when transition completes
	 */
	onComplete: (() => void) | undefined;

	/**
	 * pooled shape used for rendering (avoids per-frame allocation)
	 * @ignore
	 */
	_maskShape: MaskShape;

	/**
	 * @param camera - the camera to apply the transition to
	 * @param options - transition parameters
	 * @param options.shape - an Ellipse or Polygon (unit-sized, centered at origin) defining the mask shape
	 * @param options.color - CSS color value or Color instance for the transition fill
	 * @param [options.duration=500] - transition duration in milliseconds
	 * @param [options.direction="hide"] - "hide" shrinks the visible area, "reveal" grows it
	 * @param [options.onComplete] - callback when the transition finishes
	 */
	constructor(
		camera: Camera2d,
		options: {
			shape: MaskShape;
			color: Color | string;
			duration?: number | undefined;
			direction?: "hide" | "reveal" | undefined;
			onComplete?: (() => void) | undefined;
		},
	) {
		super(camera);

		this.color = colorPool.get(options.color);
		this.direction = options.direction ?? "hide";
		this.onComplete = options.onComplete;

		this.shape = options.shape;

		// clone the shape for rendering
		this._maskShape = this.shape.clone();

		// progress: 1 = fully visible, 0 = fully covered
		const duration = options.duration ?? 500;
		if (this.direction === "hide") {
			this.progress = { value: 1.0 };
			this.tween = tweenPool
				.get(this.progress)
				.to({ value: 0.0 }, { duration });
		} else {
			this.progress = { value: 0.0 };
			this.tween = tweenPool
				.get(this.progress)
				.to({ value: 1.0 }, { duration });
		}

		this.tween.isPersistent = true;
		this.tween.start();
	}

	override update(): void {
		// check if the transition has completed
		if (
			(this.direction === "hide" && this.progress.value <= 0.0) ||
			(this.direction === "reveal" && this.progress.value >= 1.0)
		) {
			this.progress.value = this.direction === "hide" ? 0.0 : 1.0;
			this.isComplete = true;
			if (typeof this.onComplete === "function") {
				this.onComplete();
			}
			return;
		}

		// update the mask shape based on current progress
		const width = this.camera.width;
		const height = this.camera.height;
		const maxRadius = Math.sqrt(width * width + height * height) / 2;
		const scale = this.progress.value * maxRadius;
		const cx = width / 2;
		const cy = height / 2;

		if (this._maskShape.type === "Ellipse") {
			(this._maskShape as Ellipse).setShape(cx, cy, scale * 2, scale * 2);
		} else {
			// set scaled vertices directly
			const mask = this._maskShape as Polygon;
			const srcPoints = (this.shape as Polygon).points;
			for (let i = 0; i < srcPoints.length; i++) {
				mask.points[i].set(srcPoints[i].x * scale, srcPoints[i].y * scale);
			}
			mask.pos.set(cx, cy);
		}
	}

	override draw(renderer: Renderer, width: number, height: number): void {
		if (this.isComplete && this.direction === "reveal") {
			return;
		}

		const r = renderer as any;
		r.save();
		r.resetTransform();

		if (this.progress.value <= 0.0) {
			// fully covered — just fill with color
			r.setColor(this.color);
			r.fillRect(0, 0, width, height);
		} else {
			// mask: only fill OUTSIDE the shape (invert = true)
			r.setMask(this._maskShape, true);
			r.setColor(this.color);
			r.fillRect(0, 0, width, height);
			r.clearMask();
		}

		r.restore();
	}

	override destroy(): void {
		this.tween.stop();
		tweenPool.release(this.tween);
		colorPool.release(this.color);
		if (this._maskShape.type === "Ellipse") {
			ellipsePool.release(this._maskShape as Ellipse);
		} else {
			polygonPool.release(this._maskShape as Polygon);
		}
	}
}
