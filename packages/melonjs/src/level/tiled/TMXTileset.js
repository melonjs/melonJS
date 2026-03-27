import { getImage, getTMX } from "../../loader/loader.js";
import { Vector2d } from "../../math/vector2d.ts";
import timer from "../../system/timer.ts";
import { getBasename, getExtension } from "../../utils/file.ts";
import { renderer } from "../../video/video.js";
import { resolveEmbeddedImage } from "./TMXUtils.js";

/**
 * a TMX Tile Set Object
 * @category Tilemap
 */
export default class TMXTileset {
	/**
	 *  @param {object} tileset - tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
	 *  @param {number} [mapTilewidth] - the map's tile grid width in pixels
	 *  @param {number} [mapTileheight] - the map's tile grid height in pixels
	 */
	constructor(tileset, mapTilewidth, mapTileheight) {
		/**
		 * per-tile properties indexed by gid
		 * @type {Map<number, object>}
		 * @ignore
		 */
		this.tileProperties = new Map();

		/**
		 * per-tile images for "Collection of Image" tilesets, indexed by gid
		 * @type {Map<number, HTMLImageElement|HTMLCanvasElement>}
		 * @ignore
		 */
		this.imageCollection = new Map();

		/**
		 * the first global tile ID of this tileset
		 * @type {number}
		 */
		this.firstgid = +tileset.firstgid;

		/**
		 * the last global tile ID of this tileset
		 * @type {number}
		 */
		this.lastgid = this.firstgid;

		// check if an external tileset is defined
		if (tileset.source !== undefined) {
			const src = tileset.source;
			const ext = getExtension(src);
			if (ext === "tsx" || ext === "xml" || ext === "json" || ext === "tsj") {
				// load the external tileset (TSX/XML/JSON/TSJ)
				tileset = getTMX(getBasename(src));
				if (!tileset) {
					throw new Error(`${src} external tileset not found`);
				}
			}
		}

		/**
		 * the tileset name
		 * @type {string}
		 */
		this.name = tileset.name;

		/**
		 * the width of each tile in pixels
		 * @type {number}
		 */
		this.tilewidth = +tileset.tilewidth;

		/**
		 * the height of each tile in pixels
		 * @type {number}
		 */
		this.tileheight = +tileset.tileheight;

		/**
		 * the spacing between tiles in pixels
		 * @type {number}
		 * @default 0
		 */
		this.spacing = +(tileset.spacing ?? 0);

		/**
		 * the margin around tiles in pixels
		 * @type {number}
		 * @default 0
		 */
		this.margin = +(tileset.margin ?? 0);

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
		this.class = tileset.class ?? tileset.type;

		/**
		 * how tiles render relative to the grid (since Tiled 1.9)
		 * @type {string}
		 * @default "tile"
		 */
		this.tilerendersize = tileset.tilerendersize ?? "tile";

		/**
		 * fill mode when tiles are not rendered at native size (since Tiled 1.9)
		 * @type {string}
		 * @default "stretch"
		 */
		this.fillmode = tileset.fillmode ?? "stretch";

		/**
		 * the map's tile grid width (used for tilerendersize="grid")
		 * @type {number}
		 * @ignore
		 */
		this.mapTilewidth = mapTilewidth ?? this.tilewidth;

		/**
		 * the map's tile grid height (used for tilerendersize="grid")
		 * @type {number}
		 * @ignore
		 */
		this.mapTileheight = mapTileheight ?? this.tileheight;

		/**
		 * precomputed render scale for tilerendersize="grid" (spritesheet only)
		 * @private
		 */
		this._renderScaleX = 1;
		this._renderScaleY = 1;
		this._renderDw = this.tilewidth;
		this._renderDh = this.tileheight;
		this._renderDyOffset = 0;
		this._renderDxCenter = 0;
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
		 */
		this._lastUpdate = 0;

		// resolve embedded JSON image data on the tileset itself
		resolveEmbeddedImage(tileset);

		// parse individual tile entries (animations, properties, images)
		this._parseTiles(tileset.tiles);

		// Tiled 1.10+ provides an explicit flag; fall back to detection for older maps
		this.isCollection = tileset.isCollection ?? this.imageCollection.size > 0;

		// set tile offset
		const offset = tileset.tileoffset;
		if (offset) {
			this.tileoffset.x = +offset.x;
			this.tileoffset.y = +offset.y;
		}

		// set tile properties from old JSON format (tileproperties)
		const tileInfo = tileset.tileproperties;
		if (tileInfo) {
			for (const [id, props] of Object.entries(tileInfo)) {
				this.setTileProperty(+id + this.firstgid, props);
			}
		}

		// initialize atlas for spritesheet tilesets
		if (!this.isCollection) {
			this._initAtlas(tileset);
		}
	}

	/**
	 * Parse individual tile entries for animations, properties, and images.
	 * @param {object[]|object} [tiles] - tile entries (array in JSON, object in XML)
	 * @ignore
	 */
	_parseTiles(tiles) {
		if (!tiles) {
			return;
		}

		// normalize: tiles can be an array (JSON new) or an object keyed by id (XML / JSON old)
		let tileEntries;
		if (Array.isArray(tiles)) {
			tileEntries = tiles;
		} else {
			// convert object-keyed format to array, injecting the key as id
			tileEntries = Object.entries(tiles).map(([key, value]) => {
				return { id: key, ...value };
			});
		}

		for (const tile of tileEntries) {
			const tileId = +tile.id;

			// parse animation frames
			if (tile.animation) {
				this.isAnimated = true;
				const anim = tile.animation;
				// key by the tile's own local id, not the first frame's tileid
				this.animations.set(tileId, {
					dt: 0,
					idx: 0,
					frames: anim,
					cur: anim[0],
				});
			}

			// set tile properties, if any
			if (tile.properties) {
				if (Array.isArray(tile.properties)) {
					// JSON (new format) — array of { name, value }
					const tileProperty = {};
					for (const prop of tile.properties) {
						tileProperty[prop.name] = prop.value;
					}
					this.setTileProperty(tileId + this.firstgid, tileProperty);
				} else {
					// XML format — flat object
					this.setTileProperty(tileId + this.firstgid, tile.properties);
				}
			}

			// resolve embedded JSON image data on individual tiles
			resolveEmbeddedImage(tile);

			// store per-tile image (collection of images tileset)
			if (tile.image) {
				const image = getImage(tile.image);
				if (!image) {
					throw new Error(
						`melonJS: '${tile.image}' file for tile '${tileId + this.firstgid}' not found!`,
					);
				}

				// check for sub-rectangle (Tiled 1.9+)
				const hasSubRect =
					typeof tile.x !== "undefined" ||
					typeof tile.y !== "undefined" ||
					typeof tile.width !== "undefined" ||
					typeof tile.height !== "undefined";

				if (hasSubRect) {
					const sx = +(tile.x ?? 0);
					const sy = +(tile.y ?? 0);
					const sw =
						typeof tile.width !== "undefined" ? +tile.width : image.width;
					const sh =
						typeof tile.height !== "undefined" ? +tile.height : image.height;

					// store the sub-rect metadata
					this.tileSubRects.set(tileId, {
						x: sx,
						y: sy,
						width: sw,
						height: sh,
					});

					// crop and cache a sub-image if the rect differs from the full image
					if (
						sx !== 0 ||
						sy !== 0 ||
						sw !== image.width ||
						sh !== image.height
					) {
						const canvas = document.createElement("canvas");
						canvas.width = sw;
						canvas.height = sh;
						canvas
							.getContext("2d")
							.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
						this.imageCollection.set(tileId + this.firstgid, canvas);
					} else {
						this.imageCollection.set(tileId + this.firstgid, image);
					}
				} else {
					this.imageCollection.set(tileId + this.firstgid, image);
				}
			}
		}
	}

	/**
	 * Initialize the texture atlas for a spritesheet tileset.
	 * @param {object} tileset - tileset data
	 * @ignore
	 */
	_initAtlas(tileset) {
		// get the global tileset texture
		this.image = getImage(tileset.image);

		if (!this.image) {
			throw new Error(
				`melonJS: '${tileset.image}' file for tileset '${this.name}' not found!`,
			);
		}

		// create a texture atlas for the given tileset
		this.texture = renderer.cache.get(this.image, {
			framewidth: this.tilewidth,
			frameheight: this.tileheight,
			margin: this.margin,
			spacing: this.spacing,
		});
		this.atlas = this.texture.getAtlas();

		// calculate the number of tiles per horizontal line
		const hTileCount =
			+tileset.columns ||
			Math.round(this.image.width / (this.tilewidth + this.spacing));
		let vTileCount = Math.round(
			this.image.height / (this.tileheight + this.spacing),
		);
		if (tileset.tilecount % hTileCount > 0) {
			++vTileCount;
		}
		// compute the last gid value in the tileset
		this.lastgid = this.firstgid + (hTileCount * vTileCount - 1 || 0);
		if (
			tileset.tilecount &&
			this.lastgid - this.firstgid + 1 !== +tileset.tilecount
		) {
			console.warn(
				`Computed tilecount (${this.lastgid - this.firstgid + 1}) does not match expected tilecount (${tileset.tilecount})`,
			);
		}
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
	 * set the tile properties
	 * @param {number} gid - global tile ID
	 * @param {object} prop - property object
	 * @ignore
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
	 * update tile animations
	 * @param {number} dt - time delta in milliseconds
	 * @returns {boolean} true if any animation frame changed
	 * @ignore
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
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {number} dx - destination x position
	 * @param {number} dy - destination y position
	 * @param {Tile} tmxTile - the tile object to draw
	 * @ignore
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
			}
		} else {
			// spritesheet: use precomputed values
			dw = this._renderDw;
			dh = this._renderDh;
			dy += this._renderDyOffset;
			dx += this._renderDxCenter;
			dy += this._renderDyCenter;
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
			const offset = this.atlas[this.getViewTileId(tmxTile.tileId)].offset;
			renderer.drawImage(
				this.image,
				offset.x,
				offset.y,
				this.tilewidth,
				this.tileheight,
				dx,
				dy,
				dw + renderer.uvOffset,
				dh + renderer.uvOffset,
			);
		}

		if (tmxTile.flipped) {
			// restore the context to the previous state
			renderer.restore();
		}
	}
}
