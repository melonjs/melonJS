import Sprite from "./sprite.js";

/**
 * additional import for TypeScript
 * @import {Color} from "./../math/color.ts";
 * @import { TextureAtlas } from "./../video/texture/atlas.js";
 */

// Reusable scratch for the 9-slice grid, refilled on every draw. A
// NineSliceSprite is drawn synchronously on the main thread (drawImage never
// re-enters another NineSliceSprite.draw), so a shared module-level buffer is
// safe and keeps draw() free of per-frame allocation. These hold the per-axis
// source/dest *offsets*; the slice sizes are derived inline in the draw loop.
const sColX = [0, 0, 0];
const dColX = [0, 0, 0];
const sRowY = [0, 0, 0];
const dRowY = [0, 0, 0];

/**
 * A NineSliceSprite is similar to a Sprite, but it uses 9-slice scaling to stretch its inner area to fit the size of the Renderable,
 * by proportionally scaling a sprite by splitting it in a grid of nine parts (with only parts 1, 3, 7, 9 not being scaled). <br>
 * <img src="images/9-slice-scaling.png"/><br>
 * @category Game Objects
 * @see https://en.wikipedia.org/wiki/9-slice_scaling
 */
export default class NineSliceSprite extends Sprite {
	/**
	 * @param {number} x - the x coordinates of the sprite object
	 * @param {number} y - the y coordinates of the sprite object
	 * @param {object} settings - Configuration parameters for the Sprite object
	 * @param {number} settings.width - the width of the Renderable over which the sprite needs to be stretched
	 * @param {number} settings.height - the height of the Renderable over which the sprite needs to be stretched
	 * @param {number} [settings.insetx] - the width of a corner over which the sprite is unscaled (default is a quarter of the sprite width)
	 * @param {number} [settings.insety] - the height of a corner over which the sprite is unscaled (default is a quarter of the sprite height)
	 * @param {HTMLImageElement|HTMLCanvasElement|TextureAtlas|CompressedImage|string} settings.image - reference to spritesheet image, a texture atlas, a compressed texture, or to a texture atlas
	 * @param {string} [settings.name=""] - name of this object
	 * @param {string} [settings.region] - region name of a specific region to use when using a texture atlas, see {@link TextureAtlas}
	 * @param {number} [settings.framewidth] - Width of a single frame within the spritesheet
	 * @param {number} [settings.frameheight] - Height of a single frame within the spritesheet
	 * @param {string|Color} [settings.tint] - a tint to be applied to this sprite
	 * @param {number} [settings.flipX] - flip the sprite on the horizontal axis
	 * @param {number} [settings.flipY] - flip the sprite on the vertical axis
	 * @param {string|Vector2d|{x:number,y:number}} [settings.anchorPoint={x:0.5, y:0.5}] - Anchor point to draw the frame at (defaults to the center of the frame). Also accepts the named presets `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`.
	 * @example
	 * this.panelSprite = new me.NineSliceSprite(0, 0, {
	 *     image : game.texture,
	 *     region : "grey_panel",
	 *     width : this.width,
	 *     height : this.height
	 * });
	 */
	constructor(x, y, settings) {
		// call the super constructor
		super(x, y, settings);

		// ensure mandatory properties are defined
		if (
			typeof settings.width !== "number" ||
			typeof settings.height !== "number"
		) {
			throw new Error("height and width properties are mandatory");
		}

		// adjust the nss sprite size accordingly to the target "expanded" size
		this.width = Math.floor(settings.width);
		this.height = Math.floor(settings.height);

		// nine slice sprite specific internal variables
		this.nss_width = this.width;
		this.nss_height = this.height;

		this.insetx = settings.insetx;
		this.insety = settings.insety;
	}

	/**
	 * width of the NineSliceSprite
	 * @type {number}
	 */
	get width() {
		return super.width;
	}
	set width(value) {
		super.width = this.nss_width = value;
	}

	/**
	 * height of the NineSliceSprite
	 * @type {number}
	 */
	get height() {
		return super.height;
	}
	set height(value) {
		super.height = this.nss_height = value;
	}

	/**
	 * Apply the current animation/atlas frame. The base {@link Sprite} swaps the
	 * sub-texture, resolves the anchor (honoring trimming) and resizes itself to
	 * the frame — but for a NineSliceSprite the size is the user-specified
	 * "expanded" target that the 9 slices stretch to fill, and must NOT track the
	 * frame. We delegate to the base for the texture/anchor work, then restore the
	 * expanded size it clobbered. (Fixes #1115, where animating a NineSliceSprite
	 * let the per-frame source size shrink the panel to a single frame.)
	 * @param {object} region - the texture region object
	 * @ignore
	 */
	_applyFrame(region) {
		// capture the expanded size BEFORE super runs: its `this.width =` writes
		// route through our setter and overwrite nss_width/nss_height
		const w = this.nss_width;
		const h = this.nss_height;
		super._applyFrame(region);
		// during construction nss_* is still undefined (the constructor sets the
		// expanded size right after super()), so only restore once it exists
		if (w !== undefined) {
			this.width = w;
			this.height = h;
		}
	}

	/**
	 * @ignore
	 */
	draw(renderer) {
		// the frame to draw
		const frame = this.current;

		// cache the current position and size
		let dx = this.pos.x;
		const dy = this.pos.y;

		let w = frame.width;
		let h = frame.height;

		// frame offset in the texture/atlas
		const frame_offset = frame.offset;
		const g_offset = this.offset;

		// remove image's TexturePacker/ShoeBox rotation
		if (frame.angle !== 0) {
			renderer.translate(-dx, -dy);
			renderer.rotate(frame.angle);
			dx -= h;
			w = frame.height;
			h = frame.width;
		}

		const sx = g_offset.x + frame_offset.x;
		const sy = g_offset.y + frame_offset.y;

		// should this be configurable ?
		const corner_width = this.insetx || w / 4;
		const corner_height = this.insety || h / 4;

		const image_center_width = w - (corner_width << 1);
		const image_center_height = h - (corner_height << 1);

		const target_center_width = this.nss_width - (corner_width << 1);
		const target_center_height = this.nss_height - (corner_height << 1);

		// The 9-slice grid is separable per axis: each column/row is an unscaled
		// corner, a stretched center, then an unscaled corner. Fill the shared
		// scratch with the per-axis source/dest offsets (no per-draw allocation).
		sColX[0] = sx;
		sColX[1] = sx + corner_width;
		sColX[2] = sx + w - corner_width;
		dColX[0] = dx;
		dColX[1] = dx + corner_width;
		dColX[2] = dx + this.nss_width - corner_width;
		sRowY[0] = sy;
		sRowY[1] = sy + corner_height;
		sRowY[2] = sy + h - corner_height;
		dRowY[0] = dy;
		dRowY[1] = dy + corner_height;
		dRowY[2] = dy + this.nss_height - corner_height;

		// blit the 9 slices: corners keep their size, the center column/row stretch.
		for (let r = 0; r < 3; r++) {
			const sh = r === 1 ? image_center_height : corner_height;
			const dh = r === 1 ? target_center_height : corner_height;
			for (let c = 0; c < 3; c++) {
				const sw = c === 1 ? image_center_width : corner_width;
				const dw = c === 1 ? target_center_width : corner_width;
				renderer.drawImage(
					this.image,
					sColX[c], // sx
					sRowY[r], // sy
					sw, // sw
					sh, // sh
					dColX[c], // dx
					dRowY[r], // dy
					dw, // dw
					dh, // dh
				);
			}
		}
	}
}
