import { clamp } from "../../math/math.ts";
import { setLayerScrolling } from "../tilemap/layer.js";
import { readImageLayer } from "./TMXImageLayer.js";
import TMXLayer from "./TMXLayer.js";
import TMXObject from "./TMXObject.js";
import {
	applyTMXProperties,
	tiledBlendMode,
	tiledParallax,
	tiledParallaxFactor,
} from "./TMXUtils.js";

/**
 * An object layer or a group layer of a Tiled map: the objects of the first,
 * and for the second the layers it holds, each read as what it is: tile
 * layers, image layers, object layers and other groups. A group gives the
 * layers inside it its offset, its opacity, its tint, its blend mode and its
 * parallax factor, on top of their own, as in Tiled.
 * (group definition is translated into the virtual `app.world` using `me.Container`)
 * @ignore
 * @internal
 */
export default class TMXGroup {
	/**
	 * @param {object} map - the map
	 * @param {object} data - the layer, as Tiled saves it
	 * @param {number} z - the layer's depth: its objects', or its first layer's
	 * @param {TMXGroup} [parent] - the group layer this one is in
	 */
	constructor(map, data, z, parent) {
		/**
		 * group name
		 * @type {string}
		 */
		this.name = data.name;

		/**
		 * group width
		 * @type {number}
		 */
		this.width = data.width || 0;

		/**
		 * group height
		 * @type {number}
		 */
		this.height = data.height || 0;

		/**
		 * tint color: the layer's own, or else the one of the group it is in
		 * @type {string}
		 */
		this.tintcolor = data.tintcolor ?? parent?.tintcolor;

		/**
		 * the group class
		 * @type {string}
		 */
		this.class = data.class;

		/**
		 * group z order
		 * @type {number}
		 */
		this.z = z;

		/**
		 * what the layer holds, in Tiled's order: the objects of an object
		 * layer ({@link TMXObject}), and for a group layer its tile layers
		 * and image layers, built, and a `TMXGroup` for each object layer or
		 * group inside it
		 * @type {object[]}
		 */
		this.objects = [];

		const visible = data.visible ?? true;
		this.opacity = visible === true ? clamp(+data.opacity || 1.0, 0.0, 1.0) : 0;

		/**
		 * group blend mode (Tiled 1.12+): the layer's own, or else the one
		 * of the group it is in
		 * @type {string}
		 */
		this.blendMode = tiledBlendMode(data.mode);
		if (this.blendMode === "normal" && parent !== undefined) {
			this.blendMode = parent.blendMode;
		}

		/**
		 * the layer's horizontal offset in Tiled, in pixels: an object layer
		 * moves its objects by it, a group layer the layers inside it
		 * @type {number}
		 */
		this.offsetx = +data.offsetx || 0;

		/**
		 * the layer's vertical offset in Tiled, in pixels
		 * @type {number}
		 */
		this.offsety = +data.offsety || 0;

		/**
		 * how far the layer is moved in all, across and down: its own
		 * offset and those of the groups it is in
		 * @type {number}
		 */
		this.shiftx = this.offsetx + (parent?.shiftx ?? 0);
		this.shifty = this.offsety + (parent?.shifty ?? 0);

		/**
		 * the layer's parallax factor, across and down: its own, times
		 * those of the groups it is in
		 * @type {number}
		 */
		this.factorx = tiledParallaxFactor(data.parallaxx) * (parent?.factorx ?? 1);
		this.factory = tiledParallaxFactor(data.parallaxy) * (parent?.factory ?? 1);

		// check if we have any user-defined properties
		applyTMXProperties(this, data);

		// the depth of the next layer read: each takes one, in Tiled's order
		let next = z;

		// parse all child objects/layers
		if (data.objects) {
			const objects = data.objects;
			for (let i = 0, len = objects.length; i < len; i++) {
				objects[i].tintcolor = this.tintcolor;
				const object = new TMXObject(map, objects[i], z);
				// Moved on the screen, so once the object stands where its
				// map puts it (an isometric map projects it)
				object.x += this.shiftx;
				object.y += this.shifty;
				this.objects.push(object);
			}
			next = z + 1;
		}

		if (data.layers) {
			const layers = data.layers;
			for (let i = 0, len = layers.length; i < len; i++) {
				const child = layers[i];
				switch (child.type) {
					case "tilelayer":
						this.objects.push(this.readTileLayer(map, child, next++));
						break;

					case "imagelayer":
						this.objects.push(this.readImageLayer(map, child, next++));
						break;

					case "objectgroup":
					case "group": {
						const group = new TMXGroup(map, child, next, this);
						next = group.zEnd;
						// resize container accordingly
						this.width = Math.max(this.width, group.width);
						this.height = Math.max(this.height, group.height);
						this.objects.push(group);
						break;
					}

					default:
						break;
				}
			}
		}

		/**
		 * the depth that follows the layer: past its last layer's, for a
		 * group layer
		 * @type {number}
		 */
		this.zEnd = Math.max(next, z + 1);
	}

	/**
	 * a tile layer of the group, with what the group gives it
	 * @param {object} map - the map
	 * @param {object} data - the tile layer, as Tiled saves it
	 * @param {number} z - its depth
	 * @returns {TMXLayer} the layer
	 * @ignore
	 */
	readTileLayer(map, data, z) {
		const layer = new TMXLayer(
			map,
			data,
			map.tilewidth,
			map.tileheight,
			map.orientation,
			map.tilesets,
			z,
		);
		// the group's offset, on top of the layer's own
		layer.pos.x += this.shiftx;
		layer.pos.y += this.shifty;
		// its parallax factor, times the layer's own (Tiled's factor, or
		// the layer's `ratio` property); the origin follows, unless the
		// layer gave its own
		const scrolling = tiledParallax(
			map,
			this.factorx * layer.ratio.x,
			this.factory * layer.ratio.y,
		);
		setLayerScrolling(
			layer,
			layer._parallaxOriginGiven === true
				? { ratio: scrolling.ratio }
				: scrolling,
		);
		// and its tint, when the layer has none of its own
		if (
			typeof data.tintcolor !== "string" &&
			typeof this.tintcolor === "string"
		) {
			layer.tint.parseHex(this.tintcolor, true);
		}
		// set a renderer
		layer.setRenderer(map.getRenderer());
		// resize container accordingly
		this.width = Math.max(this.width, layer.width);
		this.height = Math.max(this.height, layer.height);
		return layer;
	}

	/**
	 * an image layer of the group, with what the group gives it
	 * @param {object} map - the map
	 * @param {object} data - the image layer, as Tiled saves it
	 * @param {number} z - its depth
	 * @returns {object} the layer
	 * @ignore
	 */
	readImageLayer(map, data, z) {
		// (a copy: the map's data is left as it is, to be read again)
		return readImageLayer(
			map,
			{
				...data,
				offsetx: +(data.offsetx ?? data.x ?? 0) + this.shiftx,
				offsety: +(data.offsety ?? data.y ?? 0) + this.shifty,
				parallaxx: this.factorx * tiledParallaxFactor(data.parallaxx),
				parallaxy: this.factory * tiledParallaxFactor(data.parallaxy),
				tintcolor: data.tintcolor ?? this.tintcolor,
			},
			z,
		);
	}

	/**
	 * reset function
	 * @ignore
	 * @internal
	 */
	destroy() {
		// clear all allocated objects
		this.objects = null;
	}

	/**
	 * return the object count
	 * @ignore
	 * @internal
	 */
	getObjectCount() {
		return this.objects.length;
	}

	/**
	 * returns the object at the specified index
	 * @ignore
	 * @internal
	 */
	getObjectByIndex(idx) {
		return this.objects[idx];
	}
}
