import { Color, Renderable, type Renderer } from "melonjs";

/** an image a renderer can draw */
export type TileImage = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

/** the rectangle of an image an entity is drawn with */
export interface EntityTile {
	/** the tileset's image */
	image: TileImage;
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
}

/** what an entity's class is given: the entity as placed in LDtk */
export interface LDtkEntitySettings {
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
	tile?: EntityTile;
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
 * draw a tile into a box the way LDtk does, by the entity's tile render mode
 * @param renderer - the renderer
 * @param tile - the tile
 * @param x - the box's left edge
 * @param y - the box's top edge
 * @param width - the box's width
 * @param height - the box's height
 * @param pivotX - where the tile is held in the box, from 0 (left) to 1
 * @param pivotY - where the tile is held in the box, from 0 (top) to 1
 */
export function drawEntityTile(
	renderer: Renderer,
	tile: EntityTile,
	x: number,
	y: number,
	width: number,
	height: number,
	pivotX: number,
	pivotY: number,
): void {
	const { image, width: tw, height: th } = tile;
	if (tw <= 0 || th <= 0 || width <= 0 || height <= 0) {
		return;
	}
	switch (tile.mode) {
		case "FitInside": {
			// whole, as large as the box takes
			const scale = Math.min(width / tw, height / th);
			const dw = tw * scale;
			const dh = th * scale;
			renderer.drawImage(
				image,
				tile.x,
				tile.y,
				tw,
				th,
				x + (width - dw) * pivotX,
				y + (height - dh) * pivotY,
				dw,
				dh,
			);
			break;
		}
		case "Cover": {
			// filling the box, what does not fit cut off
			const scale = Math.max(width / tw, height / th);
			const sw = width / scale;
			const sh = height / scale;
			renderer.drawImage(
				image,
				tile.x + (tw - sw) * pivotX,
				tile.y + (th - sh) * pivotY,
				sw,
				sh,
				x,
				y,
				width,
				height,
			);
			break;
		}
		case "FullSizeCropped": {
			// at its own size, cut to the box
			const sw = Math.min(tw, width);
			const sh = Math.min(th, height);
			renderer.drawImage(
				image,
				tile.x + (tw - sw) * pivotX,
				tile.y + (th - sh) * pivotY,
				sw,
				sh,
				x + (width - sw) * pivotX,
				y + (height - sh) * pivotY,
				sw,
				sh,
			);
			break;
		}
		case "FullSizeUncropped":
			// at its own size, held by the pivot
			renderer.drawImage(
				image,
				tile.x,
				tile.y,
				tw,
				th,
				x + (width - tw) * pivotX,
				y + (height - th) * pivotY,
				tw,
				th,
			);
			break;
		case "Repeat":
			// side by side, the last ones cut to the box
			for (let dy = 0; dy < height; dy += th) {
				const sh = Math.min(th, height - dy);
				for (let dx = 0; dx < width; dx += tw) {
					const sw = Math.min(tw, width - dx);
					renderer.drawImage(
						image,
						tile.x,
						tile.y,
						sw,
						sh,
						x + dx,
						y + dy,
						sw,
						sh,
					);
				}
			}
			break;
		default:
			// "Stretch", and "NineSlice", whose borders are not read
			renderer.drawImage(image, tile.x, tile.y, tw, th, x, y, width, height);
	}
}

/**
 * An entity of a level that the game registered no class for: a box of the
 * entity's size at its place, with its fields, drawn with the tile LDtk shows
 * it with when it has one. It has no body, and does nothing: it is there to
 * be found (`world.getChildByName("PlayerStart")`) and read.
 */
export class LDtkEntity extends Renderable {
	/** the entity's unique id in LDtk */
	iid: string;
	/** the entity's custom fields, by name */
	fields: Record<string, unknown>;
	/** the entity's tags in LDtk */
	tags: string[];
	/** where the entity's pivot is in its box, each from 0 to 1 */
	pivot: { x: number; y: number };
	/** the tile the entity is drawn with, if any */
	tile: EntityTile | undefined;
	/** the entity as placed in LDtk: what a class registered for it would be given */
	source: LDtkEntitySettings;

	/**
	 * @param settings - the entity as placed in LDtk
	 */
	constructor(settings: LDtkEntitySettings) {
		super(settings.x, settings.y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		this.name = settings.name;
		this.iid = settings.iid;
		this.fields = settings.fields;
		this.tags = settings.tags;
		this.pivot = settings.pivot;
		this.tile = settings.tile;
		this.source = settings;
	}

	/**
	 * draw the entity's tile, if it has one
	 * @param renderer - the renderer
	 */
	override draw(renderer: Renderer): void {
		if (this.tile !== undefined) {
			drawEntityTile(
				renderer,
				this.tile,
				this.pos.x,
				this.pos.y,
				this.width,
				this.height,
				this.pivot.x,
				this.pivot.y,
			);
		}
	}
}

/** the part of an image a level's background shows, and where */
export interface BackgroundImage {
	image: TileImage;
	/** the part of the image that shows: x, y, width, height */
	crop: [number, number, number, number];
	/** where its top left corner is, in pixels from the level's */
	x: number;
	y: number;
	/** how much it is scaled, across and down */
	scaleX: number;
	scaleY: number;
}

/**
 * The background of a level: its color over the level's area, and its
 * background image where it has one, placed as in LDtk.
 */
export class LDtkBackground extends Renderable {
	/** the color the level's area is filled with; undefined to fill nothing */
	color: Color | undefined;
	/** the level's background image, if any */
	image: BackgroundImage | undefined;

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
		image?: BackgroundImage,
	) {
		super(x, y, width, height);
		this.anchorPoint.set(0, 0);
		this.name = "background";
		this.color = color === undefined ? undefined : new Color().parseCSS(color);
		this.image = image;
	}

	/**
	 * draw the background
	 * @param renderer - the renderer
	 */
	override draw(renderer: Renderer): void {
		if (this.color !== undefined) {
			renderer.setColor(this.color);
			renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
		}
		const bg = this.image;
		if (bg !== undefined) {
			renderer.drawImage(
				bg.image,
				bg.crop[0],
				bg.crop[1],
				bg.crop[2],
				bg.crop[3],
				this.pos.x + bg.x,
				this.pos.y + bg.y,
				bg.crop[2] * bg.scaleX,
				bg.crop[3] * bg.scaleY,
			);
		}
	}
}
