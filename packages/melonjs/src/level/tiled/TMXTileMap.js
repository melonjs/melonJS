import { warning, warnOnce } from "../../lang/console.js";
import { getImage } from "../../loader/loader.js";
import { vector2dPool } from "../../math/vector2d.ts";
import { boundsPool } from "../../physics/bounds.ts";
import Container from "../../renderable/container.js";
import ImageLayer from "../../renderable/imagelayer.js";
import { checkVersion } from "../../utils/utils.ts";
import {
	isCollisionLayerName,
	markWorldShape,
	tileLayerWalls,
} from "../tilemap/collision.js";
import { addLevelToContainer, isObjectWanted } from "../tilemap/populate.js";
import { releaseViewport } from "../tilemap/viewport.js";
import { TILED_SUPPORTED_VERSION } from "./constants.js";
import { getNewTMXRenderer } from "./renderer/autodetect.js";
import {
	isSpriteFusionMap,
	SPRITESHEET,
	spritesheetName,
	usesSpritesheet,
} from "./spritefusion.ts";
import TMXGroup from "./TMXGroup.js";
import TMXLayer from "./TMXLayer.js";
import { createTMXObject } from "./TMXObjectFactory.js";
import TMXTileset from "./TMXTileset.js";
import TMXTilesetGroup from "./TMXTilesetGroup.js";

/**
 * additional import for TypeScript
 * @import {Bounds} from "../../physics/bounds.ts";
 * @import Renderable from "../../renderable/renderable.js";
 * @import TMXRenderer from "./renderer/TMXRenderer.js";
 */
import {
	applyObjectOpacity,
	applyTMXProperties,
	applyTransparentColor,
	parseTintColor,
	propagateBlendMode,
	resolveEmbeddedImage,
	tiledBlendMode,
	tiledParallaxFactor,
} from "./TMXUtils.js";

/**
 * the cells an infinite map's level covers, in the map's tile coordinates:
 * the map's own area, grown to every painted tile of its tile layers. Tiled
 * saves whole chunks (16 x 16 cells by default), so a layer's chunks usually
 * reach past its last painted tile: those empty cells are left out
 * @param {TMXTileMap} map - the map
 * @param {Array<object>} layers - the map's layers
 * @returns {{x: number, y: number, cols: number, rows: number}} the area
 * @ignore
 * @internal
 */
function paintedExtent(map, layers) {
	let minX = 0;
	let minY = 0;
	let maxX = map.cols;
	let maxY = map.rows;
	for (const layer of layers) {
		if (!(layer instanceof TMXLayer)) {
			continue;
		}
		const data = layer.layerData;
		const cols = layer.cols;
		for (let i = 0, len = cols * layer.rows; i < len; i++) {
			if (data[i * 2] !== 0) {
				const x = layer.startx + (i % cols);
				const y = layer.starty + Math.floor(i / cols);
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x + 1);
				maxY = Math.max(maxY, y + 1);
			}
		}
	}
	// a staggered or hexagonal grid alternates every other row or column:
	// start on an even one, as its layers do, for the stagger to line up
	if (map.orientation === "staggered" || map.orientation === "hexagonal") {
		minX -= minX & 1;
		minY -= minY & 1;
	}
	return { x: minX, y: minY, cols: maxX - minX, rows: maxY - minY };
}

/**
 * read the layer Data
 * @ignore
 * @internal
 */
function readLayer(map, data, z) {
	return new TMXLayer(
		map,
		data,
		map.tilewidth,
		map.tileheight,
		map.orientation,
		map.tilesets,
		z,
	);
}

/**
 * read the Image Layer Data
 * @ignore
 * @internal
 */
function readImageLayer(map, data, z) {
	// resolve embedded JSON image data if present
	resolveEmbeddedImage(data);

	// the layer's custom values, read into an object of their own: the
	// map's data is left as it is, to be read again on the next load
	const properties = {};
	applyTMXProperties(properties, data);

	// derive repeat mode: legacy custom "repeat" property takes precedence
	// (for backward compatibility), then Tiled 1.8+ native repeatx/repeaty
	const repX = data.repeatx === true || data.repeatx === "1";
	const repY = data.repeaty === true || data.repeaty === "1";
	let repeat = properties.repeat;
	if (typeof repeat === "undefined" && (repX || repY)) {
		if (repX && repY) {
			repeat = "repeat";
		} else if (repX) {
			repeat = "repeat-x";
		} else {
			repeat = "repeat-y";
		}
	}

	// Tiled 1.8+ parallax origin (map-level, baked into layer offset)
	const pox = +(map.data.parallaxoriginx ?? 0);
	const poy = +(map.data.parallaxoriginy ?? 0);
	const ratioX = tiledParallaxFactor(data.parallaxx);
	const ratioY = tiledParallaxFactor(data.parallaxy);
	const ox = +(data.offsetx ?? data.x ?? 0) + pox * ratioX;
	const oy = +(data.offsety ?? data.y ?? 0) + poy * ratioY;

	// create the layer
	const imageLayer = new ImageLayer(
		ox,
		oy,
		Object.assign(
			{
				name: data.name,
				// its transparent color applied, when Tiled gives one
				image:
					typeof data.transparentcolor === "string"
						? (applyTransparentColor(
								getImage(data.image),
								data.transparentcolor,
							) ?? data.image)
						: data.image,
				ratio: vector2dPool.get(ratioX, ratioY),
				tint: parseTintColor(data.tintcolor),
				z: z,
				repeat: repeat,
			},
			properties,
		),
	);

	// set some additional flags
	const visible = data.visible ?? true;
	imageLayer.setOpacity(visible ? +data.opacity : 0);

	// layer blend mode (Tiled 1.12+)
	imageLayer.blendMode = tiledBlendMode(data.mode);

	return imageLayer;
}

/**
 * read the tileset Data
 * @ignore
 * @internal
 */
function readTileset(data, mapTilewidth, mapTileheight) {
	return new TMXTileset(data, mapTilewidth, mapTileheight);
}

/**
 * The walls of a tile layer the map says is solid: one with a custom
 * property `collider` set to true. Every tile of the layer is then a wall of
 * the world. (The Sprite Fusion editor writes that property for a layer
 * with its "collider" box checked; in Tiled it is a boolean custom property
 * of the layer.)
 * @param {TMXTileMap} map - the map
 * @param {object} layer - one of its layers
 * @returns {Renderable[]} the walls: none for any other layer
 * @ignore
 * @internal
 */
function colliderWalls(map, layer) {
	if (!(layer instanceof TMXLayer) || layer.collider !== true) {
		return [];
	}
	if (map.orientation !== "orthogonal") {
		warnOnce(
			`melonJS: tile layer "${layer.name}" has the \`collider\` property, which builds walls on orthogonal maps only`,
		);
		return [];
	}
	return tileLayerWalls(layer, map);
}

/**
 * read the object group Data
 * @ignore
 * @internal
 */
function readObjectGroup(map, data, z) {
	return new TMXGroup(map, data, z);
}

/**
 * the highest object id in a map's layers, group layers included
 * @param {object[]} [layers] - the map's (or a group's) layer data
 * @returns {number} the highest id, or 0 when there is none
 * @ignore
 */
function highestObjectId(layers) {
	let highest = 0;
	if (!Array.isArray(layers)) {
		return highest;
	}
	for (const layer of layers) {
		if (Array.isArray(layer.objects)) {
			for (const object of layer.objects) {
				const id = +object.id;
				if (id > highest) {
					highest = id;
				}
			}
		}
		if (Array.isArray(layer.layers)) {
			highest = Math.max(highest, highestObjectId(layer.layers));
		}
	}
	return highest;
}

/**
 * A tile map as a level: its layers, its tilesets and the objects it places,
 * read from a map description and added to the world by {@link level.load}.
 *
 * The description is what the loader keeps for a `"tmx"`, `"tilemap"` or
 * `"spritefusion"` asset ({@link loader.getTMX}): a
 * [Tiled](https://www.mapeditor.org) map (Tiled QT +0.7.x format), from XML
 * or JSON, or a [Sprite Fusion](https://www.spritefusion.com) `map.json`. It
 * is read in the words of either editor, and left as it is:
 *
 * | | Tiled | Sprite Fusion |
 * | --- | --- | --- |
 * | the map's size, in tiles | `width`, `height` | `mapWidth`, `mapHeight` |
 * | the size of a tile | `tilewidth`, `tileheight` | `tileSize` |
 * | a layer's tiles | `data`: the gid of every cell | `tiles`: a list of `{ id, x, y, attributes }` |
 * | custom values | `properties` | `attributes`, a plain object, kept as written |
 * | a solid tile layer | a `collider` property set to true | the layer's `collider` field |
 * | the tilesets | `tilesets` | none named: the `spritesheet` image |
 * | the order of the layers | the bottom one first | the top one first |
 *
 * `attributes` is read wherever `properties` is (the map, a layer, an object,
 * a tile of a tileset, a tile of a `tiles` list), in a map of either form.
 * @category Tilemap
 */
export default class TMXTileMap {
	/**
	 * The `level.load()` options this format reads. See
	 * {@link GLTFScene.loadOptions} for why the list lives here rather than
	 * in the director or in a forwarder (#1649).
	 *
	 * The director reads these off the options object and passes them to
	 * `loadTMXLevel` as positional arguments, so they are named here rather
	 * than consumed from an `options` bag inside this class.
	 * @type {ReadonlyArray<string>}
	 * @ignore
	 * @internal
	 */
	static loadOptions = Object.freeze([
		"flatten",
		"setViewportBounds",
		"objects",
	]);

	/**
	 * @param {string} levelId - name of the map
	 * @param {object} data - the map's description: a Tiled map in JSON format, or a Sprite Fusion `map.json`
	 * @example
	 * // create a new level object based on the map's description
	 * let level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
	 * // add the level to the game world container
	 * level.addTo(app.world, true);
	 * @example
	 * // a map written by hand, in the shorter words: two tiles, one of them lava
	 * const map = new TMXTileMap("tiny", {
	 *     tileSize: 16,
	 *     mapWidth: 4,
	 *     mapHeight: 2,
	 *     layers: [{
	 *         name: "ground",
	 *         collider: true,
	 *         tiles: [
	 *             { id: 0, x: 0, y: 1 },
	 *             { id: 1, x: 1, y: 1, attributes: { type: "lava", damage: 25 } },
	 *         ],
	 *     }],
	 * });   // drawn from the image loaded as "spritesheet"
	 * map.addTo(app.world, true);
	 */
	constructor(levelId, data) {
		/**
		 * the level data (JSON)
		 * @ignore
		 * @internal
		 */
		this.data = data;

		/**
		 * name of the tilemap
		 * @type {string}
		 */
		this.name = levelId;

		/**
		 * level format discriminator used by the level director's dispatch
		 * @type {string}
		 */
		this.format = "tmx";

		/**
		 * width of the tilemap in tiles
		 * @type {number}
		 */
		this.cols = +(data.width ?? data.mapWidth);

		/**
		 * height of the tilemap in tiles
		 * @type {number}
		 */
		this.rows = +(data.height ?? data.mapHeight);

		/**
		 * Tile width
		 * @type {number}
		 */
		this.tilewidth = +(data.tilewidth ?? data.tileSize);

		/**
		 * Tile height
		 * @type {number}
		 */
		this.tileheight = +(data.tileheight ?? data.tileSize);

		/**
		 * is the map an infinite map
		 * @type {number}
		 * @default 0
		 */
		this.infinite = +data.infinite || 0;

		/**
		 * the map orientation type. melonJS supports “orthogonal”, “isometric”, “staggered”, “hexagonal” and “oblique”.
		 * @type {string}
		 * @default “orthogonal”
		 */
		this.orientation = data.orientation ?? "orthogonal";

		/**
		 * horizontal skew in pixels per tile row (oblique maps, since Tiled 1.12)
		 * @type {number}
		 * @default 0
		 */
		this.skewx = +(data.skewx ?? 0);

		/**
		 * vertical skew in pixels per tile column (oblique maps, since Tiled 1.12)
		 * @type {number}
		 * @default 0
		 */
		this.skewy = +(data.skewy ?? 0);

		/**
		 * the order in which tiles on orthogonal tile layers are rendered.
		 * (valid values are "left-down", "left-up", "right-down", "right-up")
		 * @type {string}
		 * @default "right-down"
		 */
		this.renderorder = data.renderorder || "right-down";

		/**
		 * the TMX format version
		 * @type {string}
		 */
		this.version = "" + data.version;

		/**
		 * The Tiled version used to save the file (since Tiled 1.0.1).
		 * @type {string}
		 */
		this.tiledversion = "" + data.tiledversion;

		/**
		 * The map class.
		 * @type {string}
		 */
		this.class = data.class;

		// tilesets for this map
		this.tilesets = null;

		// layers
		if (typeof this.layers === "undefined") {
			this.layers = [];
		}
		// group objects
		if (typeof this.objectGroups === "undefined") {
			this.objectGroups = [];
		}

		// Check if map is from melon editor
		this.isEditor = data.editor === "melon-editor";

		// the first id free for objects added at runtime: what the map says,
		// or, as Tiled maps may leave it out, one past the highest object id
		// actually in it, so a GUID made from the counter cannot meet one made
		// from a map object's id (#1809)
		this.nextobjectid = +data.nextobjectid || highestObjectId(data.layers) + 1;

		// hex/iso properties
		this.hexsidelength = +data.hexsidelength;
		this.staggeraxis = data.staggeraxis;
		this.staggerindex = data.staggerindex;

		// calculate the map bounding rect
		this.bounds = this.getRenderer().getBounds().clone();

		// background color
		this.backgroundcolor = data.backgroundcolor;

		// if version is undefined or empty it usually means the map was not created with Tiled
		if (this.version !== "undefined" && this.version !== "") {
			// deprecation warning if map tiled version is older than 1.5
			if (checkVersion(this.version, "1.5") < 0) {
				warning(
					`(${this.name}) Tiled Map format version 1.4 and below`,
					"format 1.5 or higher",
					"10.4.4",
				);
			}
			// warning if map version is newer than what we currently support
			if (checkVersion(this.version, TILED_SUPPORTED_VERSION) > 0) {
				console.warn(
					`(${this.name}) Tiled Map format version ${this.version} is newer than the currently supported version ${TILED_SUPPORTED_VERSION}. Some features may not work as expected.`,
				);
			}
		}

		// set additional map properties (if any)
		applyTMXProperties(this, data);

		// internal flag
		this.initialized = false;
	}

	/**
	 * Return the map default renderer
	 * @returns {TMXRenderer} a TMX renderer
	 */
	getRenderer() {
		if (
			typeof this.renderer === "undefined" ||
			!this.renderer.canRender(this)
		) {
			this.renderer = getNewTMXRenderer(this);
		}
		return this.renderer;
	}

	/**
	 * the map's width in pixels: its bounds' width (see {@link TMXTileMap#getBounds})
	 * @type {number}
	 */
	get width() {
		return this.getBounds().width;
	}

	/**
	 * the map's height in pixels: its bounds' height (see {@link TMXTileMap#getBounds})
	 * @type {number}
	 */
	get height() {
		return this.getBounds().height;
	}

	/**
	 * return the map bounding rect: the area its tiles are drawn in. On an
	 * infinite map, the map's own area grown to every painted tile, which can
	 * start left of or above 0
	 * @returns {Bounds}
	 */
	getBounds() {
		// an infinite map's bounds cover its painted tiles, known once its
		// layers are read
		if (this.infinite === 1) {
			this.readMapObjects(this.data);
		}
		return this.bounds;
	}

	/**
	 * parse the map
	 * @ignore
	 * @internal
	 */
	readMapObjects(data) {
		if (this.initialized === true) {
			return;
		}

		// to automatically increment z index
		let zOrder = 0;

		// Tileset information
		if (!this.tilesets) {
			// make sure we have a TilesetGroup Object
			this.tilesets = new TMXTilesetGroup();
		}

		// a Sprite Fusion map draws from the spritesheet saved with it: the
		// one loaded with a "spritefusion" asset, else the game's own
		const fusion = isSpriteFusionMap(data);
		const ownSheet = spritesheetName(this.name);
		const sheet = getImage(ownSheet) !== null ? ownSheet : SPRITESHEET;

		// parse all tileset objects
		if (typeof data.tilesets !== "undefined") {
			const tilesets = data.tilesets;
			for (let i = 0, len = tilesets.length; i < len; i++) {
				let tileset = tilesets[i];
				if (sheet !== SPRITESHEET && usesSpritesheet(tileset)) {
					tileset = { ...tileset, image: sheet };
				}
				this.tilesets.add(
					readTileset(tileset, this.tilewidth, this.tileheight),
				);
			}
		} else if (fusion) {
			// its JSON names no tileset: the spritesheet is the one
			this.tilesets.add(
				readTileset(
					{
						firstgid: 1,
						name: "spritefusion",
						image: sheet,
						tilewidth: this.tilewidth,
						tileheight: this.tileheight,
					},
					this.tilewidth,
					this.tileheight,
				),
			);
		}

		// check if a background image is defined
		if (this.background_image) {
			// add a new image layer
			this.layers.push(
				new ImageLayer(0, 0, {
					name: "background_image",
					image: this.background_image,
					z: zOrder++,
				}),
			);
		}

		// (Sprite Fusion's JSON lists the layer on top first)
		const layers = fusion ? [...data.layers].reverse() : data.layers;
		for (let i = 0, len = layers.length; i < len; i++) {
			const layer = layers[i];
			// a layer that only lists its tiles is a tile layer
			switch (layer.type ?? (Array.isArray(layer.tiles) ? "tilelayer" : "")) {
				case "imagelayer":
					this.layers.push(readImageLayer(this, layer, zOrder++));
					break;

				case "tilelayer":
					this.layers.push(readLayer(this, layer, zOrder++));
					break;

				case "objectgroup":
				case "group":
					this.objectGroups.push(readObjectGroup(this, layer, zOrder++));
					break;

				default:
					break;
			}
		}

		this.initialized = true;

		// an infinite map can be painted past its own width and height, and
		// left of or above its origin: the level covers those tiles too
		if (this.infinite === 1) {
			this._growToPaintedTiles();
		}
	}

	/**
	 * grow the level's bounds, from the map's own area, to every painted tile
	 * of an infinite map
	 * @ignore
	 * @internal
	 */
	_growToPaintedTiles() {
		const area = paintedExtent(this, this.layers);
		if (
			area.x === 0 &&
			area.y === 0 &&
			area.cols === this.cols &&
			area.rows === this.rows
		) {
			return;
		}
		const renderer = this.getRenderer();
		const bounds = renderer.getBounds(area);
		// the area's grid starts at its first cell, not the map's (0, 0)
		const origin = renderer.tileToPixelCoords(
			area.x,
			area.y,
			vector2dPool.get(),
		);
		const zero = renderer.tileToPixelCoords(0, 0, vector2dPool.get());
		const dx = origin.x - zero.x;
		const dy = origin.y - zero.y;
		this.bounds.setMinMax(
			bounds.left + dx,
			bounds.top + dy,
			bounds.right + dx,
			bounds.bottom + dy,
		);
		vector2dPool.release(origin);
		vector2dPool.release(zero);
		boundsPool.release(bounds);
	}

	/**
	 * add all the map layers and objects to the given container.
	 * note : this will not automatically update the camera viewport
	 * @param {Container} container - target container
	 * @param {boolean} [flatten=true] - if true, flatten all objects into the given container, else a `me.Container` object will be created for each corresponding groups
	 * @param {boolean} [setViewportBounds=false] - if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
	 * @param {boolean|Function} [objects=true] - build the map's objects: all of them, none, or the ones a function `(settings) => boolean` says. See {@link level.load}
	 * @example
	 * // create a new level object based on the TMX JSON object
	 * let level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
	 * // add the level to the game world container
	 * level.addTo(app.world, true, true);
	 */
	addTo(container, flatten, setViewportBounds, objects) {
		const levelBounds = this.getBounds();
		if (setViewportBounds === true) {
			releaseViewport(this._followViewport);
		}
		const follow = addLevelToContainer(container, {
			backgroundColor: this.backgroundcolor,
			add: () => {
				// add all layers instances, and the walls of the ones that
				// are solid (see `colliderWalls`)
				this.getLayers().forEach((layer) => {
					container.addChild(layer);
					for (const wall of colliderWalls(this, layer)) {
						container.addChild(wall);
					}
				});
				// add all Object instances
				this.getObjects(flatten, objects).forEach((object) => {
					container.addChild(object);
				});
			},
			width: this.bounds.width,
			height: this.bounds.height,
			// the viewport takes the level's bounds, now and when it is resized
			bounds: setViewportBounds === true ? levelBounds : undefined,
		});
		if (follow !== undefined) {
			/**
			 * what has the viewport follow this map, while it does
			 * @ignore
			 */
			this._followViewport = follow;
		}
	}

	/**
	 * Return an Array of instantiated objects, based on the map object definition.
	 * Objects are created using the Tiled object factory registry, which dispatches
	 * to the appropriate factory based on the object's class, name, or structure.
	 * Custom factories can be registered via {@link registerObjectFactory} or
	 * {@link registerObjectClass}.
	 * @param {boolean} [flatten=true] - if true, flatten all objects into the returned array.
	 * when false, a `me.Container` object will be created for each corresponding groups
	 * @param {boolean|Function} [wanted=true] - the objects to build: all of them, none (`false`), or the ones a function says, given each object's settings
	 * @returns {Renderable[]} Array of Objects
	 */
	getObjects(flatten, wanted) {
		const objects = [];
		let targetContainer;

		// parse the map for objects
		this.readMapObjects(this.data);

		for (let g = 0; g < this.objectGroups.length; g++) {
			const group = this.objectGroups[g];

			// check if this is the collision shape group
			const isCollisionGroup = isCollisionLayerName(group.name);

			if (flatten === false) {
				// create a new container
				targetContainer = new Container(0, 0, this.width, this.height);

				// tiled uses 0,0 by default
				targetContainer.anchorPoint.set(0, 0);

				// set additional properties
				targetContainer.name = group.name;
				targetContainer.pos.z = group.z;
				targetContainer.setOpacity(group.opacity);
				targetContainer.blendMode = group.blendMode;

				// disable auto-sort and auto-depth
				targetContainer.autoSort = false;
				targetContainer.autoDepth = false;
			}

			// iterate through the group and add all objects into their
			// corresponding target Container
			for (let o = 0; o < group.objects.length; o++) {
				const settings = group.objects[o];

				// An object the game does not want is left out. A tile layer
				// of a group layer is listed with the group's objects: it is
				// a layer, and is added whatever the choice of objects
				if (
					!(settings instanceof TMXLayer) &&
					!isObjectWanted(wanted, settings)
				) {
					continue;
				}

				// Tiled uses 0,0 by default
				if (typeof settings.anchorPoint === "undefined") {
					settings.anchorPoint = { x: 0, y: 0 };
				}
				// convert to melonJS renderable argument name
				if (typeof settings.tintcolor !== "undefined") {
					settings.tint = parseTintColor(settings.tintcolor);
				}

				// instantiate the object based on its type
				const obj = createTMXObject(settings, this);

				// an unnamed object of a collision group is a wall of the world
				if (isCollisionGroup && !settings.name) {
					markWorldShape(obj);
				}

				// apply per-object opacity and visibility (skip TMXLayer)
				if (obj.isRenderable === true && !(settings instanceof TMXLayer)) {
					if (!settings.visible) {
						obj.setOpacity(0);
						if (
							typeof obj.renderable !== "undefined" &&
							obj.renderable.isRenderable === true
						) {
							obj.renderable.setOpacity(0);
						}
					} else if (settings.opacity < 1) {
						applyObjectOpacity(obj, settings.opacity);
					}
				}

				// the layers the cameras draw it on, from a custom property
				if (typeof settings.visibilityLayer === "number") {
					obj.visibilityLayer = settings.visibilityLayer;
				}

				// propagate group blend mode to child objects
				propagateBlendMode(obj, group.blendMode);

				if (flatten !== false) {
					// apply group opacity when flattened
					if (obj.isRenderable === true) {
						applyObjectOpacity(obj, group.opacity);
					}
					objects.push(obj);
				} else {
					targetContainer.addChild(obj);
				}

				// a solid tile layer of a group layer comes with its walls
				for (const wall of colliderWalls(this, settings)) {
					if (flatten !== false) {
						objects.push(wall);
					} else {
						targetContainer.addChild(wall);
					}
				}
			}

			// if we created a new container with children
			if (flatten === false && targetContainer.getChildren().length > 0) {
				// re-enable auto-sort and auto-depth
				targetContainer.autoSort = true;
				targetContainer.autoDepth = true;

				// add our container to the world
				objects.push(targetContainer);
			}
		}
		return objects;
	}

	/**
	 * return all the existing layers
	 * @returns {TMXLayer[]} Array of Layers
	 */
	getLayers() {
		// parse the map for objects
		this.readMapObjects(this.data);
		return this.layers;
	}

	/**
	 * destroy function, clean all allocated objects
	 */
	destroy() {
		// the viewport follows the map no longer
		releaseViewport(this._followViewport);
		this._followViewport = undefined;
		this.tilesets = undefined;
		this.layers.length = 0;
		this.objectGroups.length = 0;
		this.initialized = false;
	}
}
