import { Color, colorPool } from "../../math/color.ts";
import Renderable from "../../renderable/renderable.js";
import type Renderer from "../../video/renderer.js";
import type { TextureAtlas } from "../../video/texture/atlas.js";

/** an image a renderer can draw */
export type TileImage = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

/** the rectangle of a tileset an entity is drawn with in LDtk */
export interface ObjectTile {
	/** a texture atlas over the tileset's image, holding the rectangle as a region */
	atlas: TextureAtlas;
	/** the name of the rectangle's region in the atlas */
	region: string;
	/** the rectangle's left edge in the image, in pixels */
	x: number;
	/** the rectangle's top edge in the image, in pixels */
	y: number;
	/** the rectangle's width, in pixels */
	width: number;
	/** the rectangle's height, in pixels */
	height: number;
	/** how the tile fills the entity's box, as set in LDtk: `Cover`, `FitInside`, `Repeat`, `Stretch`, `FullSizeCropped`, `FullSizeUncropped` or `NineSlice` */
	mode: string;
	/** in `NineSlice` mode, the borders that are not stretched: up, right, down, left */
	borders?: number[];
}

/** what an entity's class is given: the entity as placed in LDtk */
export interface LDtkObjectSettings {
	/** the entity's identifier in LDtk: what a class is registered under */
	name: string;
	/** the same identifier */
	class: string;
	/** the same identifier */
	type: string;
	/** the entity's unique id in LDtk */
	id: string;
	/** the entity's unique id in LDtk */
	iid: string;
	/** the left edge of the entity's box, in the container the level was added to */
	x: number;
	/** the top edge of the entity's box */
	y: number;
	/** the draw order of the entity's layer */
	z: number;
	/** the width of the entity's box, in pixels */
	width: number;
	/** the height of the entity's box, in pixels */
	height: number;
	/** where the entity's pivot is in its box, each from 0 to 1 */
	pivot: { x: number; y: number };
	/** where the entity's pivot is: the point LDtk places it by */
	px: { x: number; y: number };
	/** the entity's tags in LDtk */
	tags: string[];
	/** the entity's custom fields, by name (also copied onto the settings, where the name is free) */
	fields: Record<string, unknown>;
	/** the tile LDtk draws the entity with, if its tileset has an image */
	tileRect?: ObjectTile;
	/**
	 * With a tile: a texture atlas over its tileset's image, which with
	 * `region` is what a `Sprite` is made from, so a class extending `Sprite`
	 * can hand the settings to its constructor. Without one, a field named
	 * `image` is found here, as any field is.
	 */
	image?: unknown;
	/** with a tile: the name of its region in `image` */
	region?: unknown;
	/** the color LDtk shows the entity in, as `#rrggbb` */
	color?: string;
	/** the identifier of the layer the entity is in */
	layer: string;
	/** the identifier of the level the entity is in */
	level: string;
	/** a box is placed by its top left corner */
	anchorPoint: { x: number; y: number };
	[field: string]: unknown;
}

/**
 * a rectangle of an atlas's image as a region of the atlas, added on first use
 * @param atlas - the atlas
 * @param x - the rectangle's left edge in the image
 * @param y - the rectangle's top edge in the image
 * @param width - the rectangle's width
 * @param height - the rectangle's height
 * @returns the region's name
 */
export function regionOf(
	atlas: TextureAtlas,
	x: number,
	y: number,
	width: number,
	height: number,
): string {
	const name = `${String(x)},${String(y)},${String(width)},${String(height)}`;
	if ((atlas.getAtlas() as Record<string, unknown>)[name] === undefined) {
		atlas.addRegion(name, x, y, width, height);
	}
	return name;
}

/**
 * a sprite on a region of an atlas, placed by its top left corner
 * @param atlas - the atlas
 * @param region - the region's name
 * @param x - where its top left corner goes
 * @param y - where its top left corner goes
 * @param scaleX - how much it is stretched across
 * @param scaleY - how much it is stretched down
 * @returns the sprite
 */
export function regionSprite(
	atlas: TextureAtlas,
	region: string,
	x: number,
	y: number,
	scaleX = 1,
	scaleY = 1,
): Renderable {
	const made = atlas.createSpriteFromName(region);
	made.anchorPoint.set(0, 0);
	made.pos.set(x, y);
	if (scaleX !== 1 || scaleY !== 1) {
		made.scale(scaleX, scaleY);
	}
	return made as unknown as Renderable;
}

/**
 * A tile repeated to fill a box, the last column and row cut to it: LDtk's
 * `Repeat` mode, which no renderable of the engine draws from a region of an
 * image (a pattern repeats a whole image).
 */
class RepeatedTile extends Renderable {
	tile: ObjectTile;

	constructor(tile: ObjectTile, width: number, height: number) {
		super(0, 0, width, height);
		this.anchorPoint.set(0, 0);
		this.tile = tile;
	}

	override draw(renderer: Renderer): void {
		const { x, y, width: tw, height: th } = this.tile;
		const image = this.tile.atlas.getTexture() as TileImage;
		for (let dy = 0; dy < this.height; dy += th) {
			const sh = Math.min(th, this.height - dy);
			for (let dx = 0; dx < this.width; dx += tw) {
				const sw = Math.min(tw, this.width - dx);
				renderer.drawImage(
					image,
					x,
					y,
					sw,
					sh,
					this.pos.x + dx,
					this.pos.y + dy,
					sw,
					sh,
				);
			}
		}
	}
}

/**
 * The renderable that shows a tile in a box the way LDtk does, by the
 * entity's tile render mode: a `Sprite` on the tile's region of the tileset,
 * scaled, placed or cut as the mode asks, a `NineSliceSprite` for the
 * nine-slice mode, and a repeated tile for `Repeat`.
 * @param tile - the tile
 * @param width - the box's width
 * @param height - the box's height
 * @param pivotX - where the tile is held in the box, from 0 (left) to 1
 * @param pivotY - where the tile is held in the box, from 0 (top) to 1
 * @returns the renderable, placed from the box's top left corner; undefined for a box or a tile of no size
 */
export function createObjectTile(
	tile: ObjectTile,
	width: number,
	height: number,
	pivotX: number,
	pivotY: number,
): Renderable | undefined {
	const { atlas, width: tw, height: th } = tile;
	if (tw <= 0 || th <= 0 || width <= 0 || height <= 0) {
		return undefined;
	}
	const sprite = (
		region: string,
		x: number,
		y: number,
		scaleX: number,
		scaleY: number,
	) => {
		return regionSprite(atlas, region, x, y, scaleX, scaleY);
	};
	/**
	 * the part of the tile that shows when it is cut to the box
	 * @param sw - the part's width, in the tile's pixels
	 * @param sh - the part's height, in the tile's pixels
	 * @returns the name of its region
	 */
	const cut = (sw: number, sh: number) => {
		return regionOf(
			atlas,
			tile.x + (tw - sw) * pivotX,
			tile.y + (th - sh) * pivotY,
			sw,
			sh,
		);
	};
	switch (tile.mode) {
		case "FitInside": {
			// whole, as large as the box takes
			const scale = Math.min(width / tw, height / th);
			return sprite(
				tile.region,
				(width - tw * scale) * pivotX,
				(height - th * scale) * pivotY,
				scale,
				scale,
			);
		}
		case "Cover": {
			// filling the box, what does not fit cut off
			const scale = Math.max(width / tw, height / th);
			return sprite(cut(width / scale, height / scale), 0, 0, scale, scale);
		}
		case "FullSizeCropped": {
			// at its own size, cut to the box
			const sw = Math.min(tw, width);
			const sh = Math.min(th, height);
			return sprite(
				cut(sw, sh),
				(width - sw) * pivotX,
				(height - sh) * pivotY,
				1,
				1,
			);
		}
		case "FullSizeUncropped":
			// at its own size, held by the pivot
			return sprite(
				tile.region,
				(width - tw) * pivotX,
				(height - th) * pivotY,
				1,
				1,
			);
		case "Repeat":
			return new RepeatedTile(tile, width, height);
		case "NineSlice": {
			// its borders kept, the rest stretched. A nine-slice sprite has
			// one border across and one down: LDtk's left and top ones
			const borders = tile.borders;
			if (borders !== undefined && borders.length === 4) {
				const made = atlas.createSpriteFromName(
					tile.region,
					{ width, height, insetx: borders[3], insety: borders[0] },
					true,
				);
				made.anchorPoint.set(0, 0);
				made.pos.set(0, 0);
				return made as unknown as Renderable;
			}
			return sprite(tile.region, 0, 0, width / tw, height / th);
		}
		default:
			// "Stretch"
			return sprite(tile.region, 0, 0, width / tw, height / th);
	}
}

/**
 * draw a renderable a box holds, placed from the box's top left corner
 * @param renderer - the renderer
 * @param box - the box
 * @param child - what it holds, if anything
 * @param viewport - the view being drawn
 */
function drawInside(
	renderer: Renderer,
	box: Renderable,
	child: Renderable | undefined,
	viewport: unknown,
) {
	if (child === undefined) {
		return;
	}
	renderer.translate(box.pos.x, box.pos.y);
	child.preDraw(renderer);
	child.draw(renderer, viewport as never);
	child.postDraw(renderer);
	renderer.translate(-box.pos.x, -box.pos.y);
}

/**
 * An entity of a level that the game registered no class for: a box of the
 * entity's size at its place, with its fields, showing the tile LDtk shows
 * it with when it has one. It has no body, and does nothing: it is there to
 * be found (`world.getChildByName("PlayerStart")`) and read.
 * @category Tilemap
 */
export class LDtkObject extends Renderable {
	/**
	 * the entity's unique id in LDtk, under the name every object of a level
	 * has its id: `container.getChildByProp("id", iid)` finds it
	 */
	id: string;
	/** the entity's unique id in LDtk */
	iid: string;
	/** the entity's custom fields, by name */
	fields: Record<string, unknown>;
	/** the entity's tags in LDtk */
	tags: string[];
	/** where the entity's pivot is in its box, each from 0 to 1 */
	pivot: { x: number; y: number };
	/** the tile LDtk draws the entity with, if any */
	tile: ObjectTile | undefined;
	/** what shows that tile: a sprite, placed from the box's top left corner */
	tileSprite: Renderable | undefined;
	/** the entity as placed in LDtk: what a class registered for it would be given */
	source: LDtkObjectSettings;

	/**
	 * @param settings - the entity as placed in LDtk
	 */
	constructor(settings: LDtkObjectSettings) {
		super(settings.x, settings.y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		this.name = settings.name;
		this.id = settings.id;
		this.iid = settings.iid;
		this.fields = settings.fields;
		this.tags = settings.tags;
		this.pivot = settings.pivot;
		this.tile = settings.tileRect;
		this.tileSprite =
			this.tile === undefined
				? undefined
				: createObjectTile(
						this.tile,
						this.width,
						this.height,
						this.pivot.x,
						this.pivot.y,
					);
		this.source = settings;
	}

	/**
	 * draw the entity's tile, if it has one
	 * @param renderer - the renderer
	 * @param viewport - the view being drawn
	 */
	override draw(renderer: Renderer, viewport?: unknown): void {
		// the sprite is placed in the box, the box in the world
		drawInside(renderer, this, this.tileSprite, viewport);
	}

	/** let go of the sprite with the entity */
	override destroy(): void {
		this.tileSprite?.destroy();
		this.tileSprite = undefined;
		super.destroy();
	}
}

/**
 * The background of a level: its color over the level's area, and its
 * background image where it has one, placed as in LDtk. The image is a
 * sprite on the part of it that shows; the color is filled here, as no
 * renderable of the engine fills an area of a size (a `ColorLayer` clears the
 * whole view).
 */
export class LDtkBackground extends Renderable {
	/** the color the level's area is filled with; undefined to fill nothing */
	color: Color | undefined;
	/** the level's background image, if any: a sprite, placed from the level's top left corner */
	image: Renderable | undefined;

	/**
	 * @param x - the level's left edge
	 * @param y - the level's top edge
	 * @param width - the level's width
	 * @param height - the level's height
	 * @param color - the color to fill the area with, as `#rrggbb`
	 * @param image - the background image, if any
	 */
	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		color?: string,
		image?: Renderable,
	) {
		super(x, y, width, height);
		this.anchorPoint.set(0, 0);
		this.name = "background";
		this.color =
			color === undefined ? undefined : colorPool.get().parseCSS(color);
		this.image = image;
	}

	/**
	 * draw the background
	 * @param renderer - the renderer
	 * @param viewport - the view being drawn
	 */
	override draw(renderer: Renderer, viewport?: unknown): void {
		if (this.color !== undefined) {
			renderer.setColor(this.color);
			renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
		}
		drawInside(renderer, this, this.image, viewport);
	}

	/** let go of the color and the image with the background */
	override destroy(): void {
		if (this.color !== undefined) {
			colorPool.release(this.color);
			this.color = undefined;
		}
		this.image?.destroy();
		this.image = undefined;
		super.destroy();
	}
}
