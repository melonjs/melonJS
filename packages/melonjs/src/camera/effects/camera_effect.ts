import type Renderer from "../../video/renderer.js";
import type Camera2d from "../camera2d.ts";

/**
 * Base class for camera effects (shake, fade, flash, transitions, etc.).
 * Subclasses implement update() for per-frame logic and/or draw() for rendering overlays.
 * Effects are automatically removed from the camera when isComplete becomes true.
 * @category Camera
 */
export default class CameraEffect {
	/**
	 * the camera this effect is attached to
	 */
	camera: Camera2d;

	/**
	 * whether this effect has finished and should be removed
	 */
	isComplete: boolean;

	/**
	 * whether this effect should persist across camera/game resets
	 * (e.g. transition effects that span state changes)
	 * @default false
	 */
	isPersistent: boolean;

	/**
	 * @param camera - the camera this effect is attached to
	 */
	constructor(camera: Camera2d) {
		this.camera = camera;
		this.isComplete = false;
		this.isPersistent = false;
	}

	/**
	 * Called each frame to update the effect state (e.g. modify camera offset, countdown duration).
	 * @param _dt - time elapsed since last frame in milliseconds
	 */
	update(_dt: number): void {}

	/**
	 * Called after the scene renders to draw visual overlays (e.g. color fills for fading).
	 * @param _renderer - the renderer to draw with
	 * @param _width - the camera viewport width
	 * @param _height - the camera viewport height
	 */
	draw(_renderer: Renderer, _width: number, _height: number): void {}

	/**
	 * Called when the effect is removed from the camera. Override to clean up resources.
	 */
	destroy(): void {}
}
