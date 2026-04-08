import { degToRad } from "../../math/math.ts";
import { Matrix2d } from "../../math/matrix2d.ts";
import { Bounds } from "../../physics/bounds.ts";
import Sprite from "../../renderable/sprite.js";
import {
	TMX_CLEAR_BIT_MASK,
	TMX_FLIP_AD,
	TMX_FLIP_H,
	TMX_FLIP_V,
} from "./constants.js";

/**
 * a basic tile object
 * @category Tilemap
 */
export default class Tile extends Bounds {
	/**
	 * @param {number} x - x index of the Tile in the map
	 * @param {number} y - y index of the Tile in the map
	 * @param {number} gid - tile gid
	 * @param {TMXTileset} tileset - the corresponding tileset object
	 */
	constructor(x, y, gid, tileset) {
		super();

		// determine the tile size from per-tile image or tileset grid
		let width;
		let height;
		if (tileset.isCollection) {
			const tileImage = tileset.getTileImage(gid & TMX_CLEAR_BIT_MASK);
			width = tileImage.width;
			height = tileImage.height;
		} else {
			width = tileset.tilewidth;
			height = tileset.tileheight;
		}

		this.setMinMax(0, 0, width, height);

		/**
		 * the corresponding tileset
		 * @type {TMXTileset}
		 */
		this.tileset = tileset;

		/**
		 * the tile transformation matrix (if flipped)
		 * @type {Matrix2d|null}
		 * @ignore
		 */
		this.currentTransform = null;

		/**
		 * tile column position in the map
		 * @type {number}
		 */
		this.col = x;

		/**
		 * tile row position in the map
		 * @type {number}
		 */
		this.row = y;

		/**
		 * the global tile ID (with flip bits cleared)
		 * @type {number}
		 */
		this.tileId = gid;

		/**
		 * True if the tile is flipped horizontally
		 * @type {boolean}
		 */
		this.flippedX = (this.tileId & TMX_FLIP_H) !== 0;

		/**
		 * True if the tile is flipped vertically
		 * @type {boolean}
		 */
		this.flippedY = (this.tileId & TMX_FLIP_V) !== 0;

		/**
		 * True if the tile is flipped anti-diagonally
		 * @type {boolean}
		 */
		this.flippedAD = (this.tileId & TMX_FLIP_AD) !== 0;

		/**
		 * Global flag that indicates if the tile is flipped
		 * @type {boolean}
		 */
		this.flipped = this.flippedX || this.flippedY || this.flippedAD;

		// create and apply transformation matrix if required
		if (this.flipped) {
			this.currentTransform = new Matrix2d();
			this.setTileTransform(this.currentTransform.identity());
		}

		// clear out the flip flags and keep the actual tileId
		this.tileId &= TMX_CLEAR_BIT_MASK;
	}

	/**
	 * set the transformation matrix for this tile
	 * @param {Matrix2d} transform - the transformation matrix to apply
	 * @ignore
	 */
	setTileTransform(transform) {
		const halfW = this.width / 2;
		const halfH = this.height / 2;

		transform.translate(halfW, halfH);
		if (this.flippedAD) {
			transform.rotate(degToRad(-90));
			transform.scale(-1, 1);
		}
		if (this.flippedX) {
			transform.scale(this.flippedAD ? 1 : -1, this.flippedAD ? -1 : 1);
		}
		if (this.flippedY) {
			transform.scale(this.flippedAD ? -1 : 1, this.flippedAD ? 1 : -1);
		}
		transform.translate(-halfW, -halfH);
	}

	/**
	 * return a renderable object for this Tile object
	 * @param {object} [settings] - see {@link Sprite}
	 * @returns {Renderable} a me.Sprite object
	 */
	getRenderable(settings) {
		let renderable;
		const tileset = this.tileset;

		const localId = this.tileId - tileset.firstgid;

		if (tileset.animations.has(localId)) {
			// animated tile — create an animated sprite
			const frames = [];
			const frameId = [];
			for (const frame of tileset.animations.get(localId).frames) {
				frameId.push(frame.tileid);
				frames.push({
					name: "" + frame.tileid,
					delay: frame.duration,
				});
			}
			renderable = tileset.texture.createAnimationFromName(frameId, settings);
			renderable.addAnimation(localId, frames);
			renderable.setCurrentAnimation(localId);
		} else if (tileset.isCollection) {
			// collection tile — create a sprite from the tile image
			const image = tileset.getTileImage(this.tileId);
			renderable = new Sprite(0, 0, { image });
			renderable.anchorPoint.set(0, 0);
			renderable.scale(
				settings.width / this.width,
				settings.height / this.height,
			);
			if (settings.rotation !== undefined) {
				renderable.anchorPoint.set(0.5, 0.5);
				renderable.rotate(settings.rotation);
				renderable.translate(settings.width / 2, settings.height / 2);
				// clear rotation to prevent double-application by the caller
				settings.rotation = undefined;
			}
		} else {
			// regular tile — create a sprite from the tileset atlas
			renderable = tileset.texture.createSpriteFromName(
				this.tileId - tileset.firstgid,
				settings,
			);
			renderable.anchorPoint.set(0, 0);
		}

		// apply any H/V/AD flip transforms
		this.setTileTransform(renderable.currentTransform);

		return renderable;
	}
}
