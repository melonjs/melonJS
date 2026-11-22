import { getImage, getJSON, getTMX } from "../../loader/loader.js";
import { hasDOM } from "../../system/dom.ts";
import { getBasename, getExtension } from "../../utils/file.ts";
import { createCanvas } from "../../video/canvas_factory.js";
import Tileset from "../tilemap/Tileset.js";
import { applyTransparentColor, resolveEmbeddedImage } from "./TMXUtils.js";

/**
 * the tileset a map names by its file: the TSX/XML/JSON/TSJ it was loaded from
 * @ignore
 * @internal
 */
function resolveSource(tileset) {
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
	return tileset;
}

/**
 * a TMX Tile Set Object: a {@link Tileset} read from a Tiled map, or from the
 * tileset file the map names
 * @category Tilemap
 */
export default class TMXTileset extends Tileset {
	/**
	 *  @param {object} tileset - tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
	 *  @param {number} [mapTilewidth] - the map's tile grid width in pixels
	 *  @param {number} [mapTileheight] - the map's tile grid height in pixels
	 */
	constructor(tileset, mapTilewidth, mapTileheight) {
		// the map gives the first gid, the tileset file the rest
		const firstgid = +tileset.firstgid;
		tileset = resolveSource(tileset);

		super({
			firstgid,
			name: tileset.name,
			tilewidth: tileset.tilewidth,
			tileheight: tileset.tileheight,
			spacing: tileset.spacing,
			margin: tileset.margin,
			tileoffset: tileset.tileoffset,
			// the tileset class (since Tiled 1.9, renamed back to type on tile/object in 1.10)
			class: tileset.class ?? tileset.type,
			tilerendersize: tileset.tilerendersize,
			fillmode: tileset.fillmode,
			objectalignment: tileset.objectalignment,
			mapTilewidth,
			mapTileheight,
		});

		// resolve embedded JSON image data on the tileset itself
		resolveEmbeddedImage(tileset);

		// parse individual tile entries (animations, properties, images)
		this._parseTiles(tileset.tiles);

		// Tiled 1.10+ provides an explicit flag; fall back to detection for older maps
		this.isCollection = tileset.isCollection ?? this.imageCollection.size > 0;

		// an image collection's gids run to its highest tile id (ids can
		// skip numbers, where tiles were removed)
		if (this.isCollection) {
			for (const gid of this.imageCollection.keys()) {
				this.lastgid = Math.max(this.lastgid, gid);
			}
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
			// get the global tileset texture, its transparent color applied
			const image = applyTransparentColor(
				getImage(tileset.image),
				tileset.transparentcolor,
			);
			if (!image) {
				throw new Error(
					`melonJS: '${tileset.image}' file for tileset '${this.name}' not found!`,
				);
			}
			this._initAtlas({
				image,
				columns: tileset.columns,
				tilecount: tileset.tilecount,
			});
			// if the tileset image was loaded from an .aseprite file, the
			// loader produces a JSON sidecar with frame tags. Synthesize per-tile
			// animations from those tags so animated tilesets authored in
			// Aseprite (Tiled 1.11+ workflow) work without manual <animation>
			// markup in the TSX.
			this._applyAsepriteFrameTags(tileset);
		}
	}

	/**
	 * If `tileset.image` was loaded via the .aseprite binary parser, walk
	 * its `meta.frameTags` and synthesize per-tile animations. Each tag
	 * `{ from, to }` becomes an animation on tile `from` that cycles through
	 * tiles `[from..to]` using each frame's `duration`.
	 *
	 * Throws on tag configurations that don't map to Tiled's animation model:
	 * non-forward direction (Tiled animations are forward-only) and non-zero
	 * repeat counts (Tiled animations loop forever).
	 * @ignore
	 * @internal
	 */
	_applyAsepriteFrameTags(tileset) {
		// getJSON is a direct key lookup (no basename normalization, unlike
		// getImage), so use the basename ourselves to match the loader's
		// asset registration convention
		const atlas = getJSON(getBasename("" + tileset.image));
		if (!atlas || !atlas.meta || typeof atlas.meta.app !== "string") {
			return;
		}
		if (!atlas.meta.app.includes("aseprite")) {
			return;
		}
		const tags = atlas.meta.frameTags;
		if (!Array.isArray(tags) || tags.length === 0) {
			return;
		}
		const frames = atlas.meta.frames || atlas.frames || {};

		for (const tag of tags) {
			if (tag.direction !== "forward") {
				throw new Error(
					`melonJS: aseprite tag "${tag.name}" on tileset '${this.name}' uses ` +
						`direction "${tag.direction}" — Tiled tile animations only support ` +
						`forward playback. Re-export the tag as "forward" in Aseprite.`,
				);
			}
			if (typeof tag.repeat === "number" && tag.repeat !== 0) {
				throw new Error(
					`melonJS: aseprite tag "${tag.name}" on tileset '${this.name}' has a ` +
						`finite repeat count (${tag.repeat}) — Tiled tile animations only ` +
						`support infinite looping. Set the tag's repeat to "∞" in Aseprite.`,
				);
			}

			// build the animation: each frame index in [from..to] becomes a
			// tile id; each tile's display duration comes from its frame entry.
			const anim = [];
			for (let f = tag.from; f <= tag.to; f++) {
				const frame = frames[String(f)] || frames[f];
				anim.push({
					tileid: f,
					duration:
						frame && typeof frame.duration === "number" ? frame.duration : 100,
				});
			}
			if (anim.length === 0) {
				continue;
			}

			// Tiled's convention: the animation lives on the tile whose id
			// matches the first frame; the engine cycles through the rest.
			// If `_parseTiles` already attached an explicit Tiled <animation>
			// for this tile, defer to it — hand-authored TSX data wins over
			// the auto-generated Aseprite tag.
			if (this.animations.has(tag.from)) {
				continue;
			}
			this.isAnimated = true;
			this.animations.set(tag.from, {
				dt: 0,
				idx: 0,
				frames: anim,
				cur: anim[0],
			});
		}
	}

	/**
	 * Parse individual tile entries for animations, properties, and images.
	 * @param {object[]|object} [tiles] - tile entries (array in JSON, object in XML)
	 * @ignore
	 * @internal
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

			// the tile's class: `class` in Tiled 1.9, `type` before and since 1.10
			const tileClass = tile.class ?? tile.type;
			if (typeof tileClass === "string" && tileClass !== "") {
				this.tileClasses.set(tileId + this.firstgid, tileClass);
			}

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
				const image = applyTransparentColor(
					getImage(tile.image),
					tile.transparentcolor,
				);
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
						// a <canvas> where there is a page, as before (it also
						// takes a 0-sized region); the factory's OffscreenCanvas
						// where there is none
						const canvas = hasDOM()
							? Object.assign(document.createElement("canvas"), {
									width: sw,
									height: sh,
								})
							: createCanvas(sw, sh);
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
}
