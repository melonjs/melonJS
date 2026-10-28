import type Tween from "../../tweens/tween.ts";
import { tweenPool } from "../../tweens/tween.ts";
import PixelateEffect from "../../video/effects/pixelate.js";
import type Renderer from "../../video/renderer.js";
import type Camera2d from "../camera2d.ts";
import CameraEffect from "./camera_effect.ts";

/**
 * A camera effect that performs a pixelate scene transition: the frame breaks
 * up into blocks that grow to `size` pixels (hide), or shrink from `size` back
 * to the sharp frame (reveal).
 *
 * It works on what the camera draws, through a {@link PixelateEffect} it puts
 * FIRST in the camera's post-effect chain for as long as it runs, so the
 * effects after it (a vignette, scanlines) stay sharp over the blocks. That
 * needs a GPU renderer: on the Canvas renderer the blocks never show, which
 * is why {@link state.transition} falls back to a fade there.
 * @category Camera
 * @example
 * // break the screen up into 32 pixel blocks over 300ms
 * camera.addCameraEffect(new PixelateTransitionEffect(camera, {
 *     renderer: app.renderer,
 *     size: 32,
 *     duration: 300,
 *     direction: "hide",
 * }));
 */
export default class PixelateTransitionEffect extends CameraEffect {
	/**
	 * the largest blocks, at the end of a hide and the start of a reveal, in
	 * screen pixels
	 */
	size: number;

	/**
	 * the transition progress, 0 for the sharp frame and 1 for the largest
	 * blocks
	 */
	progress: { value: number };

	tween: Tween;

	direction: "hide" | "reveal";

	onComplete: (() => void) | undefined;

	/**
	 * the shader effect this transition drives on the camera
	 */
	effect: PixelateEffect;

	/**
	 * @param camera - the camera to apply the effect to
	 * @param options - effect options
	 * @param options.renderer - the renderer drawing the camera
	 * @param [options.size=32] - the largest blocks, in screen pixels
	 * @param [options.duration=500] - expressed in milliseconds
	 * @param [options.direction="hide"] - "hide" to break the frame up, "reveal" to bring it back
	 * @param [options.onComplete] - callback once the effect is over
	 */
	constructor(
		camera: Camera2d,
		options: {
			renderer: Renderer;
			size?: number | undefined;
			duration?: number | undefined;
			direction?: "hide" | "reveal" | undefined;
			onComplete?: (() => void) | undefined;
		},
	) {
		super(camera);

		this.size = Math.max(1, options.size ?? 32);
		this.direction = options.direction ?? "hide";
		this.onComplete = options.onComplete;

		const hide = this.direction === "hide";
		this.progress = { value: hide ? 0 : 1 };

		this.effect = new PixelateEffect(options.renderer, {
			size: hide ? 1 : this.size,
		});
		// first in the chain, so the effects after it draw over the blocks
		camera.addPostEffect(this.effect);
		camera.postEffects.unshift(camera.postEffects.pop()!);

		// eased the way a lens goes out of focus and back: slow to start
		// breaking up, slow to settle
		const duration = options.duration ?? 500;
		this.tween = tweenPool.get(this.progress).to(
			{ value: hide ? 1 : 0 },
			{
				duration,
				easing: (k: number) => (hide ? k * k : k * (2 - k)),
			},
		);
		this.tween.isPersistent = true;
		this.tween.start();
	}

	override update(): void {
		const value = this.progress.value;
		// in whole pixels: a fraction of a block shimmers
		this.effect.setSize(Math.max(1, Math.round(1 + (this.size - 1) * value)));

		if (
			(this.direction === "hide" && value >= 1) ||
			(this.direction === "reveal" && value <= 0)
		) {
			// once, on the transition into complete: a persistent effect is
			// still updated after it finishes (see MaskEffect#update)
			if (!this.isComplete) {
				this.isComplete = true;
				if (typeof this.onComplete === "function") {
					this.onComplete();
				}
			}
		}
	}

	override destroy(): void {
		// guarded so a second call is a no-op, as in FadeEffect#destroy
		if (this.tween !== undefined) {
			this.tween.stop();
			tweenPool.release(this.tween);
			this.tween = undefined as unknown as typeof this.tween;
		}
		if (this.effect !== undefined) {
			// taken off the camera (which destroys it, as it is not shared)
			if (this.camera.postEffects.includes(this.effect)) {
				this.camera.removePostEffect(this.effect);
			} else {
				this.effect.destroy();
			}
			this.effect = undefined as unknown as typeof this.effect;
		}
	}
}
