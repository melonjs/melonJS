import type Renderer from "../../video/renderer.js";
import type { TextureAtlas } from "../../video/texture/atlas.js";
import NineSliceSprite from "../nineslicesprite.js";

/**
 * What every widget skin shares: the atlas its regions come from, and how
 * much of each region's edge is kept unscaled when it is stretched.
 *
 * A region drawn bigger than its art is drawn as a nine-slice: the corners
 * keep their size and the edges and middle stretch, so a 190 pixel wide
 * button image makes a button of any width.
 * @category UI
 */
export interface UISkin {
	/** the atlas the regions are read from */
	atlas: TextureAtlas;
	/**
	 * the width of a corner kept unscaled, in pixels; a quarter of the
	 * region's width by default
	 */
	insetx?: number;
	/**
	 * the height of a corner kept unscaled, in pixels; a quarter of the
	 * region's height by default
	 */
	insety?: number;
}

/** the size of an atlas region */
interface RegionSize {
	width: number;
	height: number;
}

/**
 * Draws named regions of a skin's atlas at any size.
 *
 * One `NineSliceSprite`, never added to the scene: a widget draws it inside
 * its own `draw`, behind its label. As a child it would be laid out by a
 * panel, hit-tested by the pointer and returned by `getChildren()`, and a
 * button's background is none of those things.
 * @ignore
 * @internal
 */
export class SkinDrawer {
	readonly atlas: TextureAtlas;
	private _sprite: NineSliceSprite | undefined;
	private _region = "";
	private readonly _insetx: number | undefined;
	private readonly _insety: number | undefined;

	/**
	 * @param skin - the skin to draw from
	 */
	constructor(skin: UISkin) {
		this.atlas = skin.atlas;
		this._insetx = skin.insetx;
		this._insety = skin.insety;
	}

	/**
	 * The size a region was drawn at, or an error naming it.
	 *
	 * Checked when a widget is built, not when it is first drawn, so a typo
	 * in a region name fails where it was written.
	 * @param name - the region
	 * @returns its width and height
	 */
	size(name: string): RegionSize {
		const region = this.atlas.getRegion(name) as RegionSize | undefined;
		if (region === undefined) {
			throw new Error(`UI skin: no region named "${name}" in the atlas`);
		}
		return region;
	}

	/**
	 * Draw a region, stretched as a nine-slice to fill a rectangle.
	 * @param renderer - the renderer to draw with
	 * @param name - the region
	 * @param x - left edge
	 * @param y - top edge
	 * @param w - width
	 * @param h - height
	 */
	draw(
		renderer: Renderer,
		name: string,
		x: number,
		y: number,
		w: number,
		h: number,
	) {
		if (w <= 0 || h <= 0) {
			return;
		}
		let sprite = this._sprite;
		if (sprite === undefined) {
			sprite = new NineSliceSprite(0, 0, {
				image: this.atlas,
				region: name,
				width: Math.max(w, 1),
				height: Math.max(h, 1),
				insetx: this._insetx,
				insety: this._insety,
			});
			sprite.anchorPoint.set(0, 0);
			this._sprite = sprite;
			this._region = name;
		} else if (name !== this._region) {
			sprite.setRegion(this.atlas.getRegion(name));
			this._region = name;
		}
		if (sprite.width !== w) {
			sprite.width = w;
		}
		if (sprite.height !== h) {
			sprite.height = h;
		}
		// `draw` and not `preDraw`/`draw`/`postDraw`: the widget has already
		// applied its own transform and alpha, and the sprite draws at its
		// `pos`, which is the top left corner here. Guarded, because every
		// write to that observable recomputes the sprite's bounds.
		if (sprite.pos.x !== x || sprite.pos.y !== y) {
			sprite.pos.set(x, y);
		}
		sprite.draw(renderer);
	}

	/**
	 * Free the sprite. Call from the owner's `onDestroyEvent`; safe twice.
	 */
	dispose() {
		if (this._sprite !== undefined) {
			this._sprite.destroy();
			this._sprite = undefined;
			this._region = "";
		}
	}
}
