import { game } from "../../application/application.ts";
import { getImage } from "../../loader/loader.js";
import { Matrix2d } from "../../math/matrix2d.ts";
import { Vector2d } from "../../math/vector2d.ts";
import timer from "../../system/timer.ts";
import { createCanvas } from "../../video/canvas_factory.js";
import { TextureAtlas } from "../../video/texture/atlas.js";
import { buildFlipTransform } from "../tiled/TMXTile.js";

// shared scratch matrix for flip-transform construction in drawTileRaw — avoids
// per-call allocation in the hot path. Single-threaded JS means it's safe to
// share across all tilesets without contention.
const SCRATCH_MATRIX = new Matrix2d();

/**
 * @typedef {object} TilesetDefinition
 * @property {string} [name] - the tileset name
 * @property {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|string} [image] - the image the tiles are cut from, or the name it was loaded under
 * @property {number} tilewidth - the width of a tile, in pixels
 * @property {number} tileheight - the height of a tile, in pixels
 * @property {number} [spacing=0] - the space between two tiles, in pixels
 * @property {number} [margin=0] - the space around the tiles, in pixels
 * @property {number} [firstgid=1] - the global id of the tileset's first tile
 * @property {number} [columns] - the tiles per row, when not what the image's width gives
 * @property {number} [tilecount] - the number of tiles, when not what the image's size gives
 * @property {{x: number, y: number}} [tileoffset] - an offset every tile is drawn with, in pixels
 * @property {string} [class] - a class name, for the game's own use
 * @property {string} [tilerendersize="tile"] - "tile" to draw a tile at its own size, "grid" at the map's cell size
 * @property {string} [fillmode="stretch"] - "stretch" or "preserve-aspect-fit", with a `tilerendersize` of "grid"
 * @property {string} [objectalignment="unspecified"] - the point of a tile object that sits at its position
 * @property {number} [mapTilewidth] - the width of the map's cells, when not the tile's
 * @property {number} [mapTileheight] - the height of the map's cells, when not the tile's
 */

/**
 * A set of tiles cut from one image on a regular grid, numbered row by row
 * from `firstgid`: what a {@link TileLayer} draws its cells from. Built from a
 * plain description, whatever the map editor. A tile can carry properties
 * ({@link Tileset#setTileProperty}), a class ({@link Tileset#setTileClass}) and
 * an animation ({@link Tileset#setTileAnimation}).
 * @category Tilemap
 * @example
 * // 16 x 16 tiles cut from a loaded image, used by a layer built in code
 * const tilesets = new me.TilesetGroup();
 * tilesets.add(new me.Tileset({ name: "ground", image: "ground", tilewidth: 16, tileheight: 16 }));
 * const layer = new me.TileLayer({ name: "floor", cols: 40, rows: 30, tilewidth: 16, tileheight: 16, tilesets });
 * layer.setCell(3, 2, 1);
 */
export default class Tileset {
	/**
	 * @param {TilesetDefinition} def - what the tileset is made of
	 */
	constructor(def) {
		/**
		 * per-tile properties indexed by gid
		 * @type {Map<number, object>}
		 * @ignore
		 * @internal
		 */
		this.tileProperties = new Map();

		/**
		 * per-tile class indexed by gid
		 * @type {Map<number, string>}
		 * @ignore
		 * @internal
		 */
		this.tileClasses = new Map();

		/**
		 * per-tile images for "Collection of Image" tilesets, indexed by gid
		 * @type {Map<number, HTMLImageElement|HTMLCanvasElement>}
		 * @ignore
		 * @internal
		 */
		this.imageCollection = new Map();

		/**
		 * the first global tile ID of this tileset
		 * @type {number}
		 */
		this.firstgid = +(def.firstgid ?? 1);

		/**
		 * the last global tile ID of this tileset
		 * @type {number}
		 */
		this.lastgid = this.firstgid;

		/**
		 * the tileset name
		 * @type {string}
		 */
		this.name = def.name;

		/**
		 * the width of each tile in pixels
		 * @type {number}
		 */
		this.tilewidth = +def.tilewidth;

		/**
		 * the height of each tile in pixels
		 * @type {number}
		 */
		this.tileheight = +def.tileheight;

		/**
		 * the spacing between tiles in pixels
		 * @type {number}
		 * @default 0
		 */
		this.spacing = +(def.spacing ?? 0);

		/**
		 * the margin around tiles in pixels
		 * @type {number}
		 * @default 0
		 */
		this.margin = +(def.margin ?? 0);

		/**
		 * tile drawing offset
		 * @type {Vector2d}
		 */
		this.tileoffset = new Vector2d();

		/**
		 * Tileset contains animated tiles
		 * @type {boolean}
		 */
		this.isAnimated = false;

		/**
		 * true if the tileset is a "Collection of Image" Tileset
		 * @type {boolean}
		 */
		this.isCollection = false;

		/**
		 * the tileset class (since Tiled 1.9, renamed back to type on tile/object in 1.10)
		 * @type {string}
		 */
		this.class = def.class;

		/**
		 * how tiles render relative to the grid (since Tiled 1.9)
		 * @type {string}
		 * @default "tile"
		 */
		this.tilerendersize = def.tilerendersize ?? "tile";

		/**
		 * fill mode when tiles are not rendered at native size (since Tiled 1.9)
		 * @type {string}
		 * @default "stretch"
		 */
		this.fillmode = def.fillmode ?? "stretch";

		/**
		 * the point of a tile object from this tileset that sits at its
		 * position: "topleft", "top", "topright", "left", "center", "right",
		 * "bottomleft", "bottom" or "bottomright". "unspecified" means the
		 * bottom left, or the bottom center on an isometric map
		 * @type {string}
		 * @default "unspecified"
		 */
		this.objectalignment = def.objectalignment ?? "unspecified";

		/**
		 * the map's tile grid width (used for tilerendersize="grid")
		 * @type {number}
		 * @ignore
		 * @internal
		 */
		this.mapTilewidth = def.mapTilewidth ?? this.tilewidth;

		/**
		 * the map's tile grid height (used for tilerendersize="grid")
		 * @type {number}
		 * @ignore
		 * @internal
		 */
		this.mapTileheight = def.mapTileheight ?? this.tileheight;

		/**
		 * precomputed render scale for tilerendersize="grid" (spritesheet only)
		 * @private
		 * @ignore
		 * @internal
		 */
		this._renderScaleX = 1;
		/**
		 * @ignore
		 * @internal
		 */
		this._renderScaleY = 1;
		/**
		 * @ignore
		 * @internal
		 */
		this._renderDw = this.tilewidth;
		/**
		 * @ignore
		 * @internal
		 */
		this._renderDh = this.tileheight;
		/**
		 * @ignore
		 * @internal
		 */
		this._renderDyOffset = 0;
		/**
		 * @ignore
		 * @internal
		 */
		this._renderDxCenter = 0;
		/**
		 * @ignore
		 * @internal
		 */
		this._renderDyCenter = 0;

		if (this.tilerendersize === "grid") {
			this._renderScaleX = this.mapTilewidth / this.tilewidth;
			this._renderScaleY = this.mapTileheight / this.tileheight;

			if (this.fillmode === "preserve-aspect-fit") {
				const minScale = Math.min(this._renderScaleX, this._renderScaleY);
				this._renderScaleX = minScale;
				this._renderScaleY = minScale;
			}

			this._renderDw = this.tilewidth * this._renderScaleX;
			this._renderDh = this.tileheight * this._renderScaleY;
			this._renderDyOffset = this.tileheight - this._renderDh;

			if (this.fillmode === "preserve-aspect-fit") {
				this._renderDxCenter = (this.mapTilewidth - this._renderDw) / 2;
				this._renderDyCenter = -(this.mapTileheight - this._renderDh) / 2;
			}
		}

		/**
		 * per-tile sub-rectangles (Tiled 1.9+), indexed by local tile id
		 * @type {Map<number, {x: number, y: number, width: number, height: number}>}
		 * @ignore
		 * @internal
		 */
		this.tileSubRects = new Map();

		/**
		 * Tileset animations
		 * @private
		 * @type {Map}
		 */
		this.animations = new Map();

		/**
		 * Remember the last update timestamp to prevent too many animation updates
		 * @private
		 * @ignore
		 * @internal
		 */
		this._lastUpdate = 0;

		// set tile offset
		const offset = def.tileoffset;
		if (offset) {
			this.tileoffset.x = +offset.x;
			this.tileoffset.y = +offset.y;
		}

		// the tiles of a tileset given its image; a tileset of separate
		// images is filled in by what reads it
		if (def.image !== undefined && def.image !== null) {
			this._initAtlas(def);
		}
	}

	/**
	 * Initialize the texture atlas for a spritesheet tileset.
	 * @param {object} def - `image` (an image, or the name of a loaded one), and optionally `columns` and `tilecount`
	 * @ignore
	 * @internal
	 */
	_initAtlas(def) {
		this.image =
			typeof def.image === "string" ? getImage(def.image) : def.image;

		if (!this.image) {
			throw new Error(
				`melonJS: '${def.image}' file for tileset '${this.name}' not found!`,
			);
		}

		// create a texture atlas for the given tileset
		this.texture = game.renderer.cache.get(this.image, {
			framewidth: this.tilewidth,
			frameheight: this.tileheight,
			margin: this.margin,
			spacing: this.spacing,
		});
		this.atlas = this.texture.getAtlas();

		// the tiles the image holds, counted as Tiled does: whole tiles only,
		// from the margin, a tile plus the spacing apart (Tiled lets the
		// last column and row go without their outer margin). A partial
		// tile at the right or bottom edge is not one, and must not take a
		// gid of the next tileset
		const columns = Math.max(
			Math.floor(
				(this.image.width - this.margin + this.spacing) /
					(this.tilewidth + this.spacing),
			),
			0,
		);
		const rows = Math.max(
			Math.floor(
				(this.image.height - this.margin + this.spacing) /
					(this.tileheight + this.spacing),
			),
			0,
		);
		const computed = (+def.columns || columns) * rows;
		// the tile count Tiled saved (always, since Tiled 0.13) is the one
		// its gids were given by
		const tilecount = +def.tilecount > 0 ? +def.tilecount : computed;
		// compute the last gid value in the tileset
		this.lastgid = this.firstgid + Math.max(tilecount - 1, 0);
		if (+def.tilecount > 0 && computed < tilecount) {
			console.warn(
				`melonJS: tileset '${this.name}' image holds ${computed} tiles, fewer than its tilecount (${tilecount})`,
			);
		}
	}

	/**
	 * give a tile a class name, which {@link Tileset#getTileClass} returns
	 * @param {number} gid - global tile ID
	 * @param {string} tileClass - the class name
	 */
	setTileClass(gid, tileClass) {
		this.tileClasses.set(gid, tileClass);
	}

	/**
	 * animate a tile: wherever it is drawn, it shows each frame's tile in
	 * turn, for the frame's duration, and starts over
	 * @param {number} tileId - the tile's id within the tileset (its gid less `firstgid`)
	 * @param {{tileid: number, duration: number}[]} frames - the tiles to show, by their id within the tileset, each with its duration in milliseconds
	 */
	setTileAnimation(tileId, frames) {
		this.isAnimated = true;
		this.animations.set(tileId, {
			dt: 0,
			idx: 0,
			frames,
			cur: frames[0],
		});
	}

	/**
	 * return the tile image from a "Collection of Image" tileset
	 * @param {number} gid
	 * @returns {HTMLImageElement|HTMLCanvasElement|undefined} corresponding image or undefined
	 */
	getTileImage(gid) {
		return this.imageCollection.get(gid);
	}

	/**
	 * the texture the sprite of an animated tile object is cut from: the
	 * tileset image, or for an image collection the images its animations
	 * show, painted side by side once and named by their tile id
	 * @returns {TextureAtlas}
	 * @ignore
	 * @internal
	 */
	getAnimationTexture() {
		if (!this.isCollection) {
			return this.texture;
		}
		if (this._animationTexture === undefined) {
			const ids = new Set();
			for (const animation of this.animations.values()) {
				for (const frame of animation.frames) {
					ids.add(+frame.tileid);
				}
			}
			let width = 0;
			let height = 0;
			for (const id of ids) {
				const image = this.getTileImage(id + this.firstgid);
				width += image.width;
				height = Math.max(height, image.height);
			}
			const canvas = createCanvas(width, height);
			const context = canvas.getContext("2d");
			const frames = [];
			let x = 0;
			for (const id of ids) {
				const image = this.getTileImage(id + this.firstgid);
				context.drawImage(image, x, 0);
				frames.push({
					filename: "" + id,
					frame: { x, y: 0, w: image.width, h: image.height },
				});
				x += image.width;
			}
			this._animationTexture = new TextureAtlas(
				{ meta: { app: "melonJS", size: { w: width, h: height } }, frames },
				canvas,
			);
		}
		return this._animationTexture;
	}

	/**
	 * set the properties of a tile, which {@link Tileset#getTileProperties} returns
	 * @param {number} gid - global tile ID
	 * @param {object} prop - property object
	 */
	setTileProperty(gid, prop) {
		this.tileProperties.set(gid, prop);
	}

	/**
	 * return true if the gid belongs to the tileset
	 * @param {number} gid
	 * @returns {boolean}
	 */
	contains(gid) {
		return gid >= this.firstgid && gid <= this.lastgid;
	}

	/**
	 * Get the view (local) tile ID from a GID, with animations applied
	 * @param {number} gid - Global tile ID
	 * @returns {number} View tile ID
	 */
	getViewTileId(gid) {
		const localId = gid - this.firstgid;

		// return the current corresponding tile id if animated
		const anim = this.animations.get(localId);
		if (anim !== undefined) {
			return anim.cur.tileid;
		}

		return localId;
	}

	/**
	 * return the properties of the specified tile
	 * @param {number} tileId - global tile ID
	 * @returns {object|undefined} tile properties or undefined
	 */
	getTileProperties(tileId) {
		return this.tileProperties.get(tileId);
	}

	/**
	 * return the class of the specified tile, as set on the tile in Tiled's
	 * tileset editor. A tile object with no class of its own is matched by it.
	 * @param {number} tileId - global tile ID
	 * @returns {string|undefined} the tile's class, or undefined if it has none
	 */
	getTileClass(tileId) {
		return this.tileClasses.get(tileId);
	}

	/**
	 * update tile animations
	 * @param {number} dt - time delta in milliseconds
	 * @returns {boolean} true if any animation frame changed
	 * @ignore
	 * @internal
	 */
	update(dt) {
		const now = timer.getTime();
		let result = false;

		if (this._lastUpdate !== now) {
			this._lastUpdate = now;

			for (const anim of this.animations.values()) {
				anim.dt += dt;
				let duration = anim.cur.duration;
				while (anim.dt >= duration) {
					anim.dt -= duration;
					anim.idx = (anim.idx + 1) % anim.frames.length;
					anim.cur = anim.frames[anim.idx];
					duration = anim.cur.duration;
					result = true;
				}
			}
		}

		return result;
	}

	/**
	 * draw a tile at the specified position
	 * @param {Renderer} renderer - a renderer instance
	 * @param {number} dx - destination x position
	 * @param {number} dy - destination y position
	 * @param {Tile} tmxTile - the tile object to draw
	 * @ignore
	 * @internal
	 */
	drawTile(renderer, dx, dy, tmxTile) {
		let dw, dh;

		if (this.isCollection) {
			// collection tiles can have varying sizes; compute scale per-tile
			if (this.tilerendersize === "grid") {
				let scaleX = this.mapTilewidth / tmxTile.width;
				let scaleY = this.mapTileheight / tmxTile.height;

				if (this.fillmode === "preserve-aspect-fit") {
					const scale = Math.min(scaleX, scaleY);
					scaleX = scale;
					scaleY = scale;
				}

				dw = tmxTile.width * scaleX;
				dh = tmxTile.height * scaleY;

				// bottom-align against tileset baseline (renderer uses tileset.tileheight)
				dy += this.tileheight - dh;

				if (this.fillmode === "preserve-aspect-fit") {
					dx += (this.mapTilewidth - dw) / 2;
					dy -= (this.mapTileheight - dh) / 2;
				}
			} else {
				dw = tmxTile.width;
				dh = tmxTile.height;
				// bottom-align against tileset baseline (renderer uses
				// tileset.tileheight, the tallest image of the collection)
				dy += this.tileheight - dh;
			}
		} else {
			// spritesheet: use precomputed values
			dw = this._renderDw;
			dh = this._renderDh;
			dy += this._renderDyOffset;
			dx += this._renderDxCenter;
			dy += this._renderDyCenter;
		}

		// a tile the tileset's image does not hold: nothing to draw (see
		// `drawTileRaw`)
		const frame = this.isCollection
			? undefined
			: this.atlas[this.getViewTileId(tmxTile.tileId)];
		if (!this.isCollection && frame === undefined) {
			return;
		}

		// check if any transformation is required
		if (tmxTile.flipped) {
			renderer.save();
			// apply the tile current transform
			renderer.translate(dx, dy);
			renderer.transform(tmxTile.currentTransform);
			// reset both values as managed through transform()
			dx = dy = 0;
		}

		// check if the tile has an associated image
		if (this.isCollection) {
			// draw the tile from the image collection
			renderer.drawImage(
				this.imageCollection.get(tmxTile.tileId),
				0,
				0,
				tmxTile.width,
				tmxTile.height,
				dx,
				dy,
				dw,
				dh,
			);
		} else {
			// use the tileset texture atlas
			const offset = frame.offset;
			renderer.drawImage(
				this.image,
				offset.x,
				offset.y,
				this.tilewidth,
				this.tileheight,
				dx,
				dy,
				dw,
				dh,
			);
		}

		if (tmxTile.flipped) {
			// restore the context to the previous state
			renderer.restore();
		}
	}

	/**
	 * draw a tile at the specified position from raw (gid, flipMask) data
	 *
	 * Like {@link drawTile} but bypasses the {@link Tile} object entirely:
	 * the renderer hot loop can pass the GID and flip mask straight from
	 * `layer.layerData` without ever allocating a Tile instance.
	 *
	 * @param {Renderer} renderer - a renderer instance
	 * @param {number} dx - destination x position
	 * @param {number} dy - destination y position
	 * @param {number} gid - the tile's global id (with flip bits already stripped)
	 * @param {number} flipMask - 3-bit packed flip mask (H=1, V=2, AD=4)
	 * @ignore
	 * @internal
	 */
	drawTileRaw(renderer, dx, dy, gid, flipMask) {
		let dw, dh;
		let tileImage;

		if (this.isCollection) {
			// collection tiles can have varying sizes; compute scale per-tile
			tileImage = this.imageCollection.get(gid);
			const tileWidth = tileImage.width;
			const tileHeight = tileImage.height;

			if (this.tilerendersize === "grid") {
				let scaleX = this.mapTilewidth / tileWidth;
				let scaleY = this.mapTileheight / tileHeight;

				if (this.fillmode === "preserve-aspect-fit") {
					const scale = Math.min(scaleX, scaleY);
					scaleX = scale;
					scaleY = scale;
				}

				dw = tileWidth * scaleX;
				dh = tileHeight * scaleY;

				// bottom-align against tileset baseline (renderer uses tileset.tileheight)
				dy += this.tileheight - dh;

				if (this.fillmode === "preserve-aspect-fit") {
					dx += (this.mapTilewidth - dw) / 2;
					dy -= (this.mapTileheight - dh) / 2;
				}
			} else {
				dw = tileWidth;
				dh = tileHeight;
				// bottom-align against tileset baseline (renderer uses
				// tileset.tileheight, the tallest image of the collection)
				dy += this.tileheight - dh;
			}
		} else {
			// spritesheet: use precomputed values
			dw = this._renderDw;
			dh = this._renderDh;
			dy += this._renderDyOffset;
			dx += this._renderDxCenter;
			dy += this._renderDyCenter;
		}

		// a tile the tileset's image does not hold (an image cropped since the
		// map was saved, a `tilecount` larger than the image has): nothing
		// to draw, as in Tiled
		const frame = this.isCollection
			? undefined
			: this.atlas[this.getViewTileId(gid)];
		if (!this.isCollection && frame === undefined) {
			return;
		}

		// check if any transformation is required
		if (flipMask !== 0) {
			renderer.save();
			renderer.translate(dx, dy);
			// rebuild the flip transform into the shared scratch matrix
			// (size driven by the tileset's tile dims for spritesheets, the
			// tile image's dims for collections)
			renderer.transform(
				buildFlipTransform(
					SCRATCH_MATRIX,
					flipMask,
					this.isCollection ? tileImage.width : this.tilewidth,
					this.isCollection ? tileImage.height : this.tileheight,
				),
			);
			dx = dy = 0;
		}

		// draw the tile image
		if (this.isCollection) {
			renderer.drawImage(
				tileImage,
				0,
				0,
				tileImage.width,
				tileImage.height,
				dx,
				dy,
				dw,
				dh,
			);
		} else {
			const offset = frame.offset;
			renderer.drawImage(
				this.image,
				offset.x,
				offset.y,
				this.tilewidth,
				this.tileheight,
				dx,
				dy,
				dw,
				dh,
			);
		}

		if (flipMask !== 0) {
			renderer.restore();
		}
	}
}
