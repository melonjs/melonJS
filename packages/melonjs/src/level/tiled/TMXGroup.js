import { clamp } from "../../math/math.ts";
import TMXLayer from "./TMXLayer.js";
import TMXObject from "./TMXObject.js";
import { applyTMXProperties, tiledBlendMode } from "./TMXUtils.js";

/**
 * object group definition as defined in Tiled.
 * (group definition is translated into the virtual `app.world` using `me.Container`)
 * @ignore
 * @internal
 */
export default class TMXGroup {
	constructor(map, data, z) {
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
		 * tint color
		 * @type {string}
		 */
		this.tintcolor = data.tintcolor;

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
		 * group objects list definition
		 * @see {@link TMXObject}
		 * @type {object[]}
		 */
		this.objects = [];

		const visible = data.visible ?? true;
		this.opacity = visible === true ? clamp(+data.opacity || 1.0, 0.0, 1.0) : 0;

		/**
		 * group blend mode (Tiled 1.12+)
		 * @type {string}
		 */
		this.blendMode = tiledBlendMode(data.mode);

		/**
		 * the layer's horizontal offset in Tiled, in pixels: an object layer
		 * moves its objects by it, a group layer the tile layers inside it
		 * @type {number}
		 */
		this.offsetx = +data.offsetx || 0;

		/**
		 * the layer's vertical offset in Tiled, in pixels
		 * @type {number}
		 */
		this.offsety = +data.offsety || 0;

		// check if we have any user-defined properties
		applyTMXProperties(this, data);

		// parse all child objects/layers
		if (data.objects) {
			const objects = data.objects;
			for (let i = 0, len = objects.length; i < len; i++) {
				objects[i].tintcolor = this.tintcolor;
				const object = new TMXObject(map, objects[i], z);
				// Moved on the screen, so once the object stands where its
				// map puts it (an isometric map projects it)
				object.x += this.offsetx;
				object.y += this.offsety;
				this.objects.push(object);
			}
		}

		if (data.layers) {
			const layers = data.layers;
			for (let i = 0, len = layers.length; i < len; i++) {
				const layer = new TMXLayer(
					map,
					layers[i],
					map.tilewidth,
					map.tileheight,
					map.orientation,
					map.tilesets,
					z,
				);
				z++;
				// the group's offset, on top of the layer's own
				layer.pos.x += this.offsetx;
				layer.pos.y += this.offsety;
				// set a renderer
				layer.setRenderer(map.getRenderer());
				// resize container accordingly
				this.width = Math.max(this.width, layer.width);
				this.height = Math.max(this.height, layer.height);
				this.objects.push(layer);
			}
		}
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
