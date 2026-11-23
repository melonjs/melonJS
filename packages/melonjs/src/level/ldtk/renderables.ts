import Container from "../../renderable/container.js";
import Renderable from "../../renderable/renderable.js";
import { ONCONTEXT_RESTORED, off, on } from "../../system/event.ts";
import { createCanvas } from "../../video/canvas_factory.js";
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

/** what every renderer has to draw an image repeated: see `ImageLayer` */
interface PatternRenderer {
	createPattern(image: unknown, repeat: string): unknown;
	drawPattern(
		pattern: unknown,
		x: number,
		y: number,
		width: number,
		height: number,
	): void;
	releaseImage(image: unknown): void;
}

/** a tile cut from its tileset into an image of its own, and how many show it */
interface CutTile {
	image: HTMLCanvasElement | OffscreenCanvas;
	users: number;
}

/** the tiles cut so far, by their atlas and their region: one image a tile */
const cutTiles = new WeakMap<TextureAtlas, Map<string, CutTile>>();

/**
 * the image of a tile on its own, cut from its tileset the first time it is
 * asked for and shared from then on
 * @param tile - the tile
 * @returns the image, with one more user
 */
function acquireCutTile(tile: ObjectTile): CutTile {
	let regions = cutTiles.get(tile.atlas);
	if (regions === undefined) {
		regions = new Map();
		cutTiles.set(tile.atlas, regions);
	}
	let cut = regions.get(tile.region);
	if (cut === undefined) {
		const image = createCanvas(tile.width, tile.height);
		// a page's canvas or an offscreen one: both draw in 2D alike
		(image as HTMLCanvasElement)
			.getContext("2d")
			?.drawImage(
				tile.atlas.getTexture(),
				tile.x,
				tile.y,
				tile.width,
				tile.height,
				0,
				0,
				tile.width,
				tile.height,
			);
		cut = { image, users: 0 };
		regions.set(tile.region, cut);
	}
	cut.users++;
	return cut;
}

/**
 * let go of a tile's image: with its last user, the texture the renderer
 * made of it is freed
 * @param tile - the tile
 * @param cut - its image
 * @param renderer - the renderer that drew it, if it was drawn
 */
function releaseCutTile(
	tile: ObjectTile,
	cut: CutTile,
	renderer: PatternRenderer | undefined,
) {
	cut.users--;
	if (cut.users <= 0) {
		cutTiles.get(tile.atlas)?.delete(tile.region);
		renderer?.releaseImage(cut.image);
	}
}

/**
 * A tile repeated to fill a box, the last column and row cut to it: LDtk's
 * `Repeat` mode. It is drawn as a pattern of the renderer's, as an
 * `ImageLayer` that repeats is. A pattern repeats a whole image, so the tile
 * is cut from its tileset once, into an image of its own that every entity
 * showing that tile shares.
 */
class RepeatedTile extends Renderable {
	tile: ObjectTile;
	/** the tile on its own */
	image: HTMLCanvasElement | OffscreenCanvas;
	/** the renderer's pattern of it, made when the tile is added to a scene */
	pattern: unknown;
	/** the tile's image, shared: let go of with this renderable */
	private cut: CutTile | undefined;
	/** the renderer that made the pattern, to free its texture with the tile */
	private owner: PatternRenderer | undefined;
	/** makes the pattern: when added to a scene, and when the GPU context comes back */
	private readonly createPattern = () => {
		this.owner = this.parentApp?.renderer as unknown as
			| PatternRenderer
			| undefined;
		this.pattern = this.owner?.createPattern(this.image, "repeat");
	};

	constructor(tile: ObjectTile, width: number, height: number) {
		super(0, 0, width, height);
		this.anchorPoint.set(0, 0);
		this.tile = tile;
		this.cut = acquireCutTile(tile);
		this.image = this.cut.image;
	}

	override onActivateEvent(): void {
		this.createPattern();
		on(ONCONTEXT_RESTORED, this.createPattern);
	}

	override onDeactivateEvent(): void {
		off(ONCONTEXT_RESTORED, this.createPattern);
	}

	override draw(renderer: Renderer): void {
		if (this.pattern !== undefined) {
			// repeated from the box's corner, and cut to the box
			(renderer as unknown as PatternRenderer).drawPattern(
				this.pattern,
				this.pos.x,
				this.pos.y,
				this.width,
				this.height,
			);
		}
	}

	/** let go of the tile's image, and of its texture with its last user */
	override destroy(): void {
		off(ONCONTEXT_RESTORED, this.createPattern);
		if (this.cut !== undefined) {
			releaseCutTile(this.tile, this.cut, this.owner);
			this.cut = undefined;
		}
		this.owner = undefined;
		this.pattern = undefined;
		super.destroy();
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
 * An entity of a level that the game registered no class for: a box of the
 * entity's size at its place, with its fields, showing the tile LDtk shows
 * it with when it has one. It has no body, and does nothing: it is there to
 * be found (`world.getChildByName("PlayerStart")`) and read.
 *
 * It is a container: the sprite of its tile is its child, placed in the box,
 * and whatever a game adds to it goes where it goes.
 * @category Tilemap
 */
export class LDtkObject extends Container {
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
	/** what shows that tile: a sprite, the box's child, placed from its top left corner */
	tileSprite: Renderable | undefined;
	/** the entity as placed in LDtk: what a class registered for it would be given */
	source: LDtkObjectSettings;

	/**
	 * @param settings - the entity as placed in LDtk
	 */
	constructor(settings: LDtkObjectSettings) {
		super(settings.x, settings.y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		// it has no body: left out of the collision checks, as a plain
		// renderable is (a container is not, by default)
		this.isKinematic = true;
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
		if (this.tileSprite !== undefined) {
			this.addChild(this.tileSprite);
		}
		this.source = settings;
	}
}
