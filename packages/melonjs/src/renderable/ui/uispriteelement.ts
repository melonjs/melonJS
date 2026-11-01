import type Camera2d from "../../camera/camera2d.ts";
import type Renderer from "../../video/renderer.js";
import Sprite from "./../sprite.js";
import type { UIJuiceSettings } from "./uibaseelement.ts";
import UIBaseElement from "./uibaseelement.ts";

/**
 * Settings for a {@link UISpriteElement}: the {@link Sprite} settings for its
 * image, plus the bounce shared by every UI element.
 * @category UI
 */
export type UISpriteElementSettings = {
	/**
	 * The image: a loader key, an image, or a {@link TextureAtlas} (with
	 * `region`). Every other {@link Sprite} setting is accepted too:
	 * `region`, `framewidth`, `frameheight`, `anchorPoint`, `tint`...
	 */
	image: any;
	/**
	 * Whether the element starts turned on.
	 * @default true
	 */
	enabled?: boolean;
	[key: string]: any;
} & UIJuiceSettings;

/**
 * An image that takes clicks: use it for an image-only button or a clickable
 * icon, such as a pause or a sound toggle, with no label.
 *
 * It is a {@link UIBaseElement} holding a {@link Sprite}, so it behaves like
 * every other UI element: the same pointer callbacks, `enabled`,
 * `cancelPress()` / `onCancel()`, dragging, the bounce (`hoverScale`,
 * `pressScale`), and keyboard and gamepad focus once `focusable` is set. A
 * press stops here by default, so what is under it does not get it too.
 *
 * The image is {@link UISpriteElement#sprite}: change its region, add and
 * play animations or tint it there. It takes the {@link Sprite} settings, and
 * as a sprite does, `(x, y)` is where its anchor point goes, the centre by
 * default (`anchorPoint` 0.5, 0.5). The element covers the image, so
 * `pos` is its top left corner and `width` / `height` its size.
 *
 * A disabled element (`enabled = false`) is drawn at half opacity.
 * @category UI
 * @example
 * // a sound toggle icon from an atlas, swapping its region on each click
 * import { UISpriteElement, audio } from "melonjs";
 *
 * class SoundIcon extends UISpriteElement {
 *     constructor(x, y) {
 *         super(x, y, { image: atlas, region: "sound_on", hoverScale: 1.1 });
 *         this.muted = false;
 *     }
 *     onClick() {
 *         this.muted = !this.muted;
 *         if (this.muted) {
 *             audio.muteAll();
 *         } else {
 *             audio.unmuteAll();
 *         }
 *         this.sprite.setRegion(atlas.getRegion(this.muted ? "sound_off" : "sound_on"));
 *         return false;
 *     }
 * }
 *
 * app.world.addChild(new SoundIcon(40, 40));
 * @example
 * // a pause button from a spritesheet: frame 0 at rest, frame 1 under the pointer
 * import { UISpriteElement, state } from "melonjs";
 *
 * class PauseButton extends UISpriteElement {
 *     constructor(x, y) {
 *         super(x, y, { image: "pause_button", framewidth: 64, frameheight: 64 });
 *         this.sprite.addAnimation("idle", [0]);
 *         this.sprite.addAnimation("over", [1]);
 *         this.sprite.setCurrentAnimation("idle");
 *     }
 *     onOver() {
 *         this.sprite.setCurrentAnimation("over");
 *     }
 *     onOut() {
 *         this.sprite.setCurrentAnimation("idle");
 *     }
 *     onRelease() {
 *         state.pause();
 *         return false;
 *     }
 * }
 * @example
 * // placed by its top left corner, and reachable with the arrow keys
 * const icon = new UISpriteElement(16, 16, {
 *     image: atlas,
 *     region: "gear",
 *     anchorPoint: { x: 0, y: 0 },
 * });
 * icon.focusable = true;
 */
export default class UISpriteElement extends UIBaseElement {
	/**
	 * The image, drawn to fill the element. Change its region, animations
	 * or tint here.
	 * @example
	 * icon.sprite.setRegion(atlas.getRegion("sound_off"));
	 */
	readonly sprite: Sprite;

	/** the sprite's size and anchor the element was last fitted to */
	private readonly _fitted = { w: 0, h: 0, ax: 0, ay: 0 };

	/**
	 * @param x - where the image's anchor point goes (its centre by
	 * default), in screen pixels
	 * @param y - where the image's anchor point goes (its centre by
	 * default), in screen pixels
	 * @param settings - the {@link Sprite} settings, and the bounce
	 * @example
	 * // a button image loaded as "button", logging each press
	 * class MyButton extends UISpriteElement {
	 *     constructor(x, y) {
	 *         super(x, y, { image: "button" });
	 *     }
	 *     onClick() {
	 *         console.log("clicked!");
	 *         return false;
	 *     }
	 * }
	 *
	 * app.world.addChild(new MyButton(100, 50));
	 */
	constructor(x: number, y: number, settings: UISpriteElementSettings) {
		// built first, for its size and anchor
		const sprite = new Sprite(0, 0, settings);
		const ax = sprite.anchorPoint.x;
		const ay = sprite.anchorPoint.y;
		super(
			x - sprite.width * ax,
			y - sprite.height * ay,
			sprite.width,
			sprite.height,
		);
		// the sprite keeps its anchor, placed so it covers the element
		sprite.pos.set(sprite.width * ax, sprite.height * ay);
		this.sprite = sprite;
		this.addChild(sprite);
		this.rememberFit();

		this.hoverScale = settings.hoverScale ?? 1;
		this.pressScale = settings.pressScale ?? 1;
		if (settings.enabled === false) {
			this.enabled = false;
		}
	}

	/**
	 * Show another region of the texture: a shortcut for
	 * `sprite.setRegion(region)`. The element takes the region's size, with
	 * the image's anchor point staying where it was, as a sprite's does.
	 * @param region - a region from {@link TextureAtlas#getRegion}
	 * @returns this element
	 * @example
	 * icon.setRegion(atlas.getRegion("sound_off"));
	 */
	setRegion(region: object): this {
		this.sprite.setRegion(region);
		this.fitToSprite();
		this.isDirty = true;
		return this;
	}

	/**
	 * Follow the sprite after its frame, region or anchor changed: the
	 * element takes the image's size, and the image's anchor point stays
	 * where it was on screen, as a sprite's `pos` does. Runs every update, so
	 * a `sprite.setRegion()` or an animation with frames of different sizes
	 * is followed too.
	 * @ignore
	 */
	private fitToSprite() {
		const sprite = this.sprite;
		const f = this._fitted;
		const w = sprite.width;
		const h = sprite.height;
		const ax = sprite.anchorPoint.x;
		const ay = sprite.anchorPoint.y;
		if (w === f.w && h === f.h && ax === f.ax && ay === f.ay) {
			return;
		}
		// the image's anchor point, on screen, before the change
		const px = this.pos.x + f.w * f.ax;
		const py = this.pos.y + f.h * f.ay;
		sprite.pos.set(w * ax, h * ay);
		this.pos.x = px - w * ax;
		this.pos.y = py - h * ay;
		this.resize(w, h);
		this.updateBounds();
		this.rememberFit();
		this.isDirty = true;
	}

	/**
	 * note the sprite's size and anchor the element now fits
	 * @ignore
	 */
	private rememberFit() {
		const f = this._fitted;
		f.w = this.sprite.width;
		f.h = this.sprite.height;
		f.ax = this.sprite.anchorPoint.x;
		f.ay = this.sprite.anchorPoint.y;
	}

	/**
	 * update the sprite, its animation included, and follow its frame
	 * @param dt - the time since the last update, in milliseconds
	 * @returns whether anything changed
	 * @ignore
	 */
	override update(dt: number): boolean {
		const dirty = super.update(dt);
		this.fitToSprite();
		return dirty;
	}

	/**
	 * A shortcut for `sprite.addAnimation(...)`: see
	 * {@link Sprite#addAnimation}.
	 * @param name - the animation name
	 * @param index - the frames, by index or region name
	 * @param animationspeed - the time between frames, in milliseconds
	 * @returns the number of frames added
	 */
	addAnimation(
		name: string,
		index: number[] | string[] | object[],
		animationspeed?: number,
	): number {
		return this.sprite.addAnimation(name, index, animationspeed);
	}

	/**
	 * A shortcut for `sprite.setCurrentAnimation(...)`: see
	 * {@link Sprite#setCurrentAnimation}.
	 * @param name - the animation to play
	 * @param resetAnim - what to do at the end, see {@link Sprite#setCurrentAnimation}
	 * @returns this element
	 */
	setCurrentAnimation(name: string, resetAnim?: any): this {
		this.sprite.setCurrentAnimation(name, resetAnim);
		this.fitToSprite();
		this.isDirty = true;
		return this;
	}

	/**
	 * A shortcut for `sprite.isCurrentAnimation(name)`.
	 * @param name - the animation name
	 * @returns whether it is the one playing
	 */
	isCurrentAnimation(name: string): boolean {
		return this.sprite.isCurrentAnimation(name);
	}

	/**
	 * draw the image, at half opacity while disabled
	 * @param renderer - the renderer
	 * @param viewport - the camera being drawn through
	 * @ignore
	 */
	override draw(renderer: Renderer, viewport?: Camera2d): void {
		if (this.enabled) {
			super.draw(renderer, viewport);
			return;
		}
		const alpha = renderer.globalAlpha();
		renderer.setGlobalAlpha(alpha * 0.5);
		super.draw(renderer, viewport);
		renderer.setGlobalAlpha(alpha);
	}
}
