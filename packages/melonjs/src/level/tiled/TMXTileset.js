import { getImage, getTMX } from "./../../loader/loader.js";
import { Vector2d } from "../../math/vector2d.ts";
import timer from "./../../system/timer.ts";
import { getBasename, getExtension } from "../../utils/file.ts";
import { renderer } from "./../../video/video.js";

/**
 * a TMX Tile Set Object
 * @category Tilemap
 */
export default class TMXTileset {
	/**
	 *  @param {object} tileset - tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
	 */
	constructor(tileset) {
		// tile properties (collidable, etc..)
		this.TileProperties = [];

		// hold reference to each tile image
		this.imageCollection = [];

		this.firstgid = this.lastgid = +tileset.firstgid;

		// check if an external tileset is defined
		if (typeof tileset.source !== "undefined") {
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

		this.name = tileset.name;
		this.tilewidth = +tileset.tilewidth;
		this.tileheight = +tileset.tileheight;
		this.spacing = +tileset.spacing || 0;
		this.margin = +tileset.margin || 0;

		// set tile offset properties (if any)
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
		 * the tileset class
		 * @type {boolean}
		 */
		this.class = tileset.class;

		/**
		 * Tileset animations
		 * @private
		 */
		this.animations = new Map();

		/**
		 * Remember the last update timestamp to prevent too many animation updates
		 * @private
		 */
		this._lastUpdate = 0;

		const tiles = tileset.tiles;
		if (tiles) {
			// tiles can be an array (JSON) or an object keyed by id (XML)
			const tileEntries = Array.isArray(tiles) ? tiles : Object.values(tiles);

			for (let t = 0, tLen = tileEntries.length; t < tLen; t++) {
				const tile = tileEntries[t];
				const tileId = +tile.id;

				if (tile.animation) {
					this.isAnimated = true;
					const anim = tile.animation;
					this.animations.set(anim[0].tileid, {
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
						const props = tile.properties;
						for (let j = 0, pLen = props.length; j < pLen; j++) {
							tileProperty[props[j].name] = props[j].value;
						}
						this.setTileProperty(tileId + this.firstgid, tileProperty);
					} else {
						// XML format — flat object
						this.setTileProperty(tileId + this.firstgid, tile.properties);
					}
				}

				if (tile.image) {
					const image = getImage(tile.image);
					if (!image) {
						throw new Error(
							`melonJS: '${tile.image}' file for tile '${tileId + this.firstgid}' not found!`,
						);
					}
					this.imageCollection[tileId + this.firstgid] = image;
				}
			}
		}

		// Tiled 1.10+ provides an explicit flag; fall back to detection for older maps
		this.isCollection = tileset.isCollection ?? this.imageCollection.length > 0;

		const offset = tileset.tileoffset;
		if (offset) {
			this.tileoffset.x = +offset.x;
			this.tileoffset.y = +offset.y;
		}

		// set tile properties, if any (JSON old format)
		const tileInfo = tileset.tileproperties;
		if (tileInfo) {
			const tileIds = Object.keys(tileInfo);
			for (let i = 0, len = tileIds.length; i < len; i++) {
				const id = tileIds[i];
				this.setTileProperty(+id + this.firstgid, tileInfo[id]);
			}
		}

		// if not a tile image collection
		if (this.isCollection === false) {
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
	}

	/**
	 * return the tile image from a "Collection of Image" tileset
	 * @param {number} gid
	 * @returns {Image} corresponding image or undefined
	 */
	getTileImage(gid) {
		return this.imageCollection[gid];
	}

	/**
	 * set the tile properties
	 * @ignore
	 */
	setTileProperty(gid, prop) {
		// set the given tile id
		this.TileProperties[gid] = prop;
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

		if (this.animations.has(localId)) {
			// return the current corresponding tile id if animated
			return this.animations.get(localId).cur.tileid;
		}

		return localId;
	}

	/**
	 * return the properties of the specified tile
	 * @param {number} tileId
	 * @returns {object}
	 */
	getTileProperties(tileId) {
		return this.TileProperties[tileId];
	}

	// update tile animations
	update(dt) {
		let duration = 0;
		const now = timer.getTime();
		let result = false;

		if (this._lastUpdate !== now) {
			this._lastUpdate = now;

			this.animations.forEach((anim) => {
				anim.dt += dt;
				duration = anim.cur.duration;
				while (anim.dt >= duration) {
					anim.dt -= duration;
					anim.idx = (anim.idx + 1) % anim.frames.length;
					anim.cur = anim.frames[anim.idx];
					duration = anim.cur.duration;
					result = true;
				}
			});
		}

		return result;
	}

	// draw the x,y tile
	drawTile(renderer, dx, dy, tmxTile) {
		// check if any transformation is required
		if (tmxTile.flipped) {
			renderer.save();
			// apply the tile current transform
			renderer.translate(dx, dy);
			renderer.transform(tmxTile.currentTransform);
			// reset both values as managed through transform();
			dx = dy = 0;
		}

		// check if the tile has an associated image
		if (this.isCollection === true) {
			// draw the tile
			renderer.drawImage(
				this.imageCollection[tmxTile.tileId],
				0,
				0,
				tmxTile.width,
				tmxTile.height,
				dx,
				dy,
				tmxTile.width,
				tmxTile.height,
			);
		} else {
			// use the tileset texture
			const offset = this.atlas[this.getViewTileId(tmxTile.tileId)].offset;
			// draw the tile
			renderer.drawImage(
				this.image,
				offset.x,
				offset.y,
				this.tilewidth,
				this.tileheight,
				dx,
				dy,
				this.tilewidth + renderer.uvOffset,
				this.tileheight + renderer.uvOffset,
			);
		}

		if (tmxTile.flipped) {
			// restore the context to the previous state
			renderer.restore();
		}
	}
}
