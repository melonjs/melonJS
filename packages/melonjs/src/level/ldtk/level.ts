import { warnOnce } from "../../lang/console.js";
import { getImage } from "../../loader/cache.js";
import { Bounds } from "../../physics/bounds.ts";
import type Container from "../../renderable/container.js";
import Renderable from "../../renderable/renderable.js";
import { createCanvas } from "../../video/canvas_factory.js";
import { TextureAtlas } from "../../video/texture/atlas.js";
import { getNewTMXRenderer } from "../tiled/renderer/autodetect.js";
import type TMXOrthogonalRenderer from "../tiled/renderer/TMXOrthogonalRenderer.js";
import {
	createLevelObject,
	hasObjectFactory,
} from "../tiled/TMXObjectFactory.js";
import { applyObjectOpacity } from "../tiled/TMXUtils.js";
import { isCollisionLayerName, markWorldShape } from "../tilemap/collision.js";
import type { LayerParallax } from "../tilemap/layer.js";
import PlacedTileLayer from "../tilemap/PlacedTileLayer.js";
import {
	addLevelToContainer,
	isObjectWanted,
	populateContainer,
} from "../tilemap/populate.js";
import TileLayer, { FLIP_H_BIT, FLIP_V_BIT } from "../tilemap/TileLayer.js";
import Tileset from "../tilemap/Tileset.js";
import TilesetGroup from "../tilemap/TilesetGroup.js";
import { releaseViewport } from "../tilemap/viewport.js";
import { IntGrid } from "./intgrid.ts";
import type { LDtkLevelInfo, LDtkProject, LDtkWorldInfo } from "./project.ts";
import { entityLeft, entityTop, fieldValues } from "./project.ts";
import {
	LDtkBackground,
	LDtkObject,
	type LDtkObjectSettings,
	type ObjectTile,
	regionOf,
	regionSprite,
	type TileImage,
} from "./renderables.ts";
import { splitTiles } from "./split.ts";
import type {
	LDtkEntityInstance,
	LDtkLayerInstance,
	LDtkTile,
	LDtkTileRect,
	LDtkTilesetDef,
} from "./types.ts";

/** how a level or a world of an LDtk project is added to the game */
export interface LDtkLoadOptions {
	/**
	 * The IntGrid layers whose cells are solid, by their identifier in LDtk:
	 * each run of solid cells becomes one static body.
	 * @default the IntGrid layers whose identifier contains "collision", in any case
	 */
	collisionLayers?: string[];
	/**
	 * the values of those layers that are solid
	 * @default every value but 0
	 */
	solidValues?: number[];
	/**
	 * draw the IntGrid layers that have no tiles of their own, each value in
	 * the color it has in LDtk: to see a level that is not dressed yet
	 * @default false
	 */
	showIntGrid?: boolean;
	/**
	 * Build the objects LDtk's Entities layers place (its "entities"): all
	 * of them, none, or the ones a function says, given each one's settings
	 * as its class would be, as its level is built (and built again, in a
	 * world whose levels come and go). The way to leave out what the player
	 * took: `(settings) => !taken.has(settings.id)`. The same option as for
	 * a Tiled map.
	 * @default true
	 */
	objects?: boolean | ((settings: LDtkObjectSettings) => boolean);
	/**
	 * have the viewport follow the level's area: its bounds, and a level
	 * smaller than the viewport centred in it
	 * @default true
	 */
	setViewportBounds?: boolean;
	/**
	 * loading a whole world: the levels to start with, by their identifier.
	 * The others are added later with {@link LDtkWorld#loadLevel} or
	 * {@link LDtkWorld#streamAround}
	 * @default every level of the world
	 */
	levels?: string[];
}

/** the names of the options of {@link LDtkLoadOptions}, which a `Trigger` forwards */
export const LOAD_OPTIONS = [
	"collisionLayers",
	"solidValues",
	"showIntGrid",
	"objects",
	"setViewportBounds",
	"levels",
];

/**
 * the flips LDtk saves on a tile (bit 0 across, bit 1 down): the tile
 * layer's own bits for them
 */
const LDTK_FLIPS = FLIP_H_BIT | FLIP_V_BIT;

/**
 * the settings that are the engine's to give, whether an entity has them or
 * not: a field of one of these names is read under `fields` alone, and is
 * never taken for what the engine would have put there
 */
const RESERVED_SETTINGS = new Set(["tileRect", "color"]);

/** the draw orders kept for each layer of LDtk: a layer can become several */
const Z_PER_LAYER = 32;
/**
 * the tiles of a layer: the ones placed by hand on a Tiles layer, the ones
 * its rules placed on an AutoLayer or an IntGrid layer
 * @param layer - the layer
 * @returns its tiles
 */
const tilesOf = (layer: LDtkLayerInstance): LDtkTile[] => {
	return layer.__type === "Tiles" ? layer.gridTiles : layer.autoLayerTiles;
};

/**
 * What LDtk keeps for a tile, its custom data and its enum tags, as the
 * tile's properties in the tileset: read from a tile of a layer as a Tiled
 * tile's are, `tile.tileset.getTileProperties(tile.tileId)`, which gives
 * `{ customData, tags }`.
 * @param tileset - the tileset built for the definition
 * @param def - LDtk's definition of it
 */
const describeTiles = (tileset: Tileset, def: LDtkTilesetDef) => {
	const described = new Map<number, { customData?: string; tags: string[] }>();
	const of = (tileId: number) => {
		let properties = described.get(tileId);
		if (properties === undefined) {
			properties = { tags: [] };
			described.set(tileId, properties);
		}
		return properties;
	};
	for (const entry of def.customData ?? []) {
		of(entry.tileId).customData = entry.data;
	}
	for (const tag of def.enumTags ?? []) {
		for (const tileId of tag.tileIds) {
			of(tileId).tags.push(tag.enumValueId);
		}
	}
	// LDtk numbers a tileset's tiles its own way: the tileset's id for one
	// is found by where the tile is in the image
	const step = def.tileGridSize + def.spacing;
	for (const [tileId, properties] of described) {
		const id = tileset.tileIdAt(
			def.padding + (tileId % def.__cWid) * step,
			def.padding + Math.floor(tileId / def.__cWid) * step,
		);
		if (id >= 0) {
			tileset.setTileProperty(tileset.firstgid + id, properties);
		}
	}
};

/** the draw orders kept for each depth of a world */
const Z_PER_DEPTH = 4096;

/** what a level became in the game */
export interface BuiltLevel {
	/** the level */
	info: LDtkLevelInfo;
	/** everything added to the container for it */
	children: Renderable[];
	/** its tile layers, bottom-most first */
	layers: Renderable[];
	/** the objects built from its entities, each with its unique id in LDtk */
	iids: Map<Renderable, string>;
	/** its IntGrid layers, by their identifier */
	intGrids: Map<string, IntGrid>;
}

/**
 * an image the loader holds, by the path LDtk names it with
 * @param project - the project that names it
 * @param relPath - the path
 * @returns the image, or null if none is loaded for it
 */
const imageOf = (
	project: LDtkProject,
	relPath: string | null | undefined,
): TileImage | null => {
	if (relPath === null || relPath === undefined) {
		return null;
	}
	// under the name the loader kept it by, or the file's own
	return getImage(project.images.get(relPath) ?? relPath) as TileImage | null;
};

/**
 * Builds the levels of a project into a container: the tile layers, the
 * collision bodies and the entities of each.
 */
class LevelBuilder {
	project: LDtkProject;
	container: Container;
	options: LDtkLoadOptions;
	/** the level object the entities' factories are handed */
	map: object & {
		persistentEntity?: (iid: string) => Renderable | undefined;
	};
	/** the tilesets made so far, by their uid; null for one with no image */
	tilesets = new Map<
		number,
		{ tileset: Tileset; group: TilesetGroup } | null
	>();
	/** a texture atlas over each image sprites are made from */
	atlases = new Map<TileImage, TextureAtlas>();
	/** the tilesets drawing the IntGrid layers, by layer definition */
	intGridTilesets = new Map<
		number,
		{ group: TilesetGroup; index: Map<number, number> }
	>();

	constructor(
		project: LDtkProject,
		container: Container,
		options: LDtkLoadOptions,
		map: object & {
			persistentEntity?: (iid: string) => Renderable | undefined;
		},
	) {
		this.project = project;
		this.container = container;
		this.options = options;
		this.map = map;
	}

	/**
	 * the tileset of a layer or an entity
	 * @param uid - the tileset's uid
	 * @returns the tileset, or null when its image was not loaded or it has none
	 */
	tilesetFor(uid: number | null | undefined) {
		if (uid === null || uid === undefined) {
			return null;
		}
		const made = this.tilesets.get(uid);
		if (made !== undefined) {
			return made;
		}
		const def = this.project.tilesets.get(uid);
		const image = imageOf(this.project, def?.relPath);
		let entry = null;
		if (def === undefined || image === null) {
			if (def?.relPath !== null && def?.relPath !== undefined) {
				warnOnce(
					`melonJS LDtk: the image of tileset "${def.identifier}" (${def.relPath}) is not loaded: its tiles are left out`,
				);
			}
		} else {
			const tileset = new Tileset({
				name: def.identifier,
				image,
				tilewidth: def.tileGridSize,
				tileheight: def.tileGridSize,
				spacing: def.spacing,
				margin: def.padding,
			});
			describeTiles(tileset, def);
			entry = { tileset, group: new TilesetGroup([tileset]) };
		}
		this.tilesets.set(uid, entry);
		return entry;
	}

	/**
	 * a tileset of flat colors, one tile for each value of an IntGrid layer
	 * @param layer - the layer
	 * @returns the tileset, and the tile of each value
	 */
	intGridTileset(layer: LDtkLayerInstance) {
		const made = this.intGridTilesets.get(layer.layerDefUid);
		if (made !== undefined) {
			return made;
		}
		const values =
			this.project.layerDefs.get(layer.layerDefUid)?.intGridValues ?? [];
		const size = layer.__gridSize;
		const canvas = createCanvas(Math.max(values.length, 1) * size, size);
		// a page's canvas or an offscreen one: both draw in 2D alike
		const context = (canvas as HTMLCanvasElement).getContext("2d");
		const index = new Map<number, number>();
		for (const [i, value] of values.entries()) {
			index.set(value.value, i);
			if (context !== null) {
				context.fillStyle = value.color;
				context.fillRect(i * size, 0, size, size);
			}
		}
		const tileset = new Tileset({
			name: `${layer.__identifier} values`,
			image: canvas,
			tilewidth: size,
			tileheight: size,
		});
		const entry = { group: new TilesetGroup([tileset]), index };
		this.intGridTilesets.set(layer.layerDefUid, entry);
		return entry;
	}

	/**
	 * How a layer follows the camera, as LDtk shows it: moved by its
	 * parallax factors' share of how far the camera's centre is into the
	 * level, and, with "parallax scaling", drawn smaller by the factor across
	 * from the level's corner, as a layer further away. Without the scaling,
	 * the layer is in its place when the camera is on its centre.
	 * @param layer - the layer
	 * @param levelX - where the level's left edge is
	 * @param levelY - where the level's top edge is
	 * @returns the layer's parallax, or undefined for a layer that scrolls with its level
	 */
	parallaxOf(
		layer: LDtkLayerInstance,
		levelX: number,
		levelY: number,
	): LayerParallax | undefined {
		const def = this.project.layerDefs.get(layer.layerDefUid);
		const x = def?.parallaxFactorX ?? 0;
		const y = def?.parallaxFactorY ?? 0;
		if (x === 0 && y === 0) {
			return undefined;
		}
		if (def?.parallaxScaling ?? true) {
			return {
				x,
				y,
				originX: levelX,
				originY: levelY,
				scale: x === 0 ? 1 : Math.max(0.01, 1 - x),
			};
		}
		return {
			x,
			y,
			originX: levelX + (layer.__cWid * layer.__gridSize) / 2,
			originY: levelY + (layer.__cHei * layer.__gridSize) / 2,
			scale: 1,
		};
	}

	/**
	 * whether an IntGrid layer's cells are solid
	 * @param identifier - the layer's identifier
	 * @returns true if they are
	 */
	isCollisionLayer(identifier: string) {
		const layers = this.options.collisionLayers;
		if (layers !== undefined) {
			return layers.includes(identifier);
		}
		return isCollisionLayerName(identifier);
	}

	/**
	 * add a renderable to the container, at a draw order
	 * @param built - the level it belongs to
	 * @param child - the renderable
	 * @param z - its draw order
	 */
	add(built: BuiltLevel, child: Renderable, z: number) {
		this.container.addChild(child, z);
		built.children.push(child);
	}

	/**
	 * Build a level.
	 * @param info - the level
	 * @param originX - where its top left corner goes in the container
	 * @param originY - where its top left corner goes in the container
	 * @param zBase - the draw order below its first layer
	 * @param fill - fill its area with its background color
	 * @returns what was added
	 */
	build(
		info: LDtkLevelInfo,
		originX: number,
		originY: number,
		zBase: number,
		fill: boolean,
	): BuiltLevel {
		const built: BuiltLevel = {
			info,
			children: [],
			layers: [],
			iids: new Map(),
			intGrids: new Map(),
		};
		const json = info.json;

		// the background: the level's color, and its image as LDtk places it
		let image: Renderable | undefined;
		const bgImage = imageOf(this.project, json.bgRelPath);
		if (json.bgRelPath !== null && json.bgRelPath !== undefined) {
			if (bgImage === null) {
				warnOnce(
					`melonJS LDtk: the background image of level "${info.identifier}" (${json.bgRelPath}) is not loaded`,
				);
			} else if (json.__bgPos !== null && json.__bgPos !== undefined) {
				// a sprite on the part of the image LDtk shows, scaled and
				// placed as LDtk does
				const [cx, cy, cw, ch] = json.__bgPos.cropRect;
				const atlas = this.atlasOf(bgImage);
				image = regionSprite(
					atlas,
					regionOf(atlas, cx, cy, cw, ch),
					json.__bgPos.topLeftPx[0],
					json.__bgPos.topLeftPx[1],
					json.__bgPos.scale[0],
					json.__bgPos.scale[1],
				);
			}
		}
		if (fill || image !== undefined) {
			this.add(
				built,
				new LDtkBackground(
					originX,
					originY,
					info.width,
					info.height,
					fill ? info.bgColor : undefined,
					image,
				),
				zBase,
			);
		}

		// LDtk lists a level's layers from the top one down
		const layers = json.layerInstances ?? [];
		for (let i = layers.length - 1; i >= 0; i--) {
			const layer = layers[i];
			// a layer hidden in LDtk is in the game and not shown, as a
			// hidden layer of a Tiled map is: its walls still stand, and
			// the game can show it
			const opacity = layer.visible ? layer.__opacity : 0;
			// a layer LDtk scrolls at a pace of its own: its tiles follow
			// the camera as they do in the editor (its entities and its
			// walls are things of the level, and stay in it)
			const parallax = this.parallaxOf(layer, originX, originY);
			const z = zBase + 1 + (layers.length - 1 - i) * Z_PER_LAYER;
			const x = originX + layer.__pxTotalOffsetX;
			const y = originY + layer.__pxTotalOffsetY;
			const tiles = tilesOf(layer);

			if (layer.intGridCsv.length > 0) {
				this.buildIntGrid(
					built,
					layer,
					x,
					y,
					z,
					opacity,
					tiles.length === 0,
					parallax,
				);
			}
			if (tiles.length > 0) {
				this.buildTiles(built, layer, x, y, z, opacity, parallax);
			}
			const wanted = this.options.objects;
			if (layer.entityInstances.length > 0 && wanted !== false) {
				// LDtk draws a later entity over an earlier one. Children of
				// one draw order are drawn last added first, so the last
				// entity is added first
				for (let e = layer.entityInstances.length - 1; e >= 0; e--) {
					const entity = layer.entityInstances[e];
					const settings = this.objectSettings(info, layer, entity, x, y, z);
					// one the game does not want is left out
					if (!isObjectWanted(wanted, settings)) {
						continue;
					}
					// a persistent one that stayed when its level left is in
					// the game already: it is the level's again, not built
					// a second time
					const stayed = this.map.persistentEntity?.(entity.iid);
					if (stayed !== undefined) {
						built.children.push(stayed);
						built.iids.set(stayed, entity.iid);
						continue;
					}
					// a class the game registered under the entity's name.
					// Not the engine's own classes: an entity's name is the
					// designer's word ("Trigger", "Text", "Entity"), not a
					// request for the engine class of that name
					const object = hasObjectFactory(settings.class, true)
						? createLevelObject(settings, this.map)
						: new LDtkObject(settings);
					// found by its name in LDtk, whatever built it (and by
					// its id, which the registry sees to: `getChildByName`,
					// `getChildByProp("id", iid)`)
					if (!object.name) {
						object.name = settings.name;
					}
					// an entity is faded as its layer is, like the objects
					// of a Tiled object layer
					if (opacity !== 1 && object.isRenderable) {
						applyObjectOpacity(object, opacity);
					}
					this.add(built, object, z);
					built.iids.set(object, entity.iid);
				}
			}
		}
		return built;
	}

	/**
	 * the values of an IntGrid layer: kept for the game to read, solid where
	 * the layer is a collision layer, and drawn where asked
	 * @param built - the level
	 * @param layer - the layer
	 * @param x - where the layer's top left corner is
	 * @param y - where the layer's top left corner is
	 * @param z - the layer's draw order
	 * @param opacity - the layer's opacity: 0 for a hidden one
	 * @param bare - the layer has no tiles of its own
	 * @param parallax - how the layer follows the camera, if it does
	 */
	buildIntGrid(
		built: BuiltLevel,
		layer: LDtkLayerInstance,
		x: number,
		y: number,
		z: number,
		opacity: number,
		bare: boolean,
		parallax?: LayerParallax,
	) {
		const grid = new IntGrid(
			layer,
			this.project.layerDefs.get(layer.layerDefUid)?.intGridValues ?? [],
			x,
			y,
		);
		built.intGrids.set(grid.name, grid);

		if (this.isCollisionLayer(grid.name)) {
			const solid = this.options.solidValues;
			const rects = grid.rects((value) => {
				return solid === undefined || solid.includes(value);
			});
			for (const rect of rects) {
				// a wall is what an unnamed shape of a Tiled collision layer
				// is: built by the "shape" factory (the game's own, if it
				// registered one) and made a wall of the world
				const wall = createLevelObject(
					{
						x: rect.x,
						y: rect.y,
						z,
						width: rect.width,
						height: rect.height,
						id: `${grid.name}:${String(rect.x)},${String(rect.y)}`,
						layer: grid.name,
						intGridValue: rect.value,
						intGridName: grid.names.get(rect.value),
					},
					this.map,
				);
				markWorldShape(wall);
				wall.name = grid.name;
				// what the wall is made of, for a collision handler to read
				Object.assign(wall, {
					intGridValue: rect.value,
					intGridName: grid.names.get(rect.value),
				});
				this.add(built, wall, z);
			}
		}

		if (bare && this.options.showIntGrid === true) {
			const { group, index } = this.intGridTileset(layer);
			const shown = new TileLayer({
				name: layer.__identifier,
				class: layer.__type,
				cols: grid.cols,
				rows: grid.rows,
				tilewidth: grid.cellSize,
				tileheight: grid.cellSize,
				tilesets: group,
				z,
				opacity,
				offsetx: x,
				offsety: y,
				parallax,
			});
			for (let row = 0; row < grid.rows; row++) {
				for (let col = 0; col < grid.cols; col++) {
					const tile = index.get(grid.values[row * grid.cols + col]);
					if (tile !== undefined) {
						shown.setCell(col, row, tile + 1);
					}
				}
			}
			this.add(built, shown, z);
			built.layers.push(shown);
		}
	}

	/**
	 * the tiles of a layer: grids where they fit one, lists where they do not
	 * @param built - the level
	 * @param layer - the layer
	 * @param x - where the layer's top left corner is
	 * @param y - where the layer's top left corner is
	 * @param z - the layer's draw order
	 * @param opacity - the layer's opacity: 0 for a hidden one
	 * @param parallax - how the layer follows the camera, if it does
	 */
	buildTiles(
		built: BuiltLevel,
		layer: LDtkLayerInstance,
		x: number,
		y: number,
		z: number,
		opacity: number,
		parallax?: LayerParallax,
	) {
		const entry = this.tilesetFor(layer.__tilesetDefUid);
		if (entry === null) {
			return;
		}
		const tiles = tilesOf(layer);
		const size = layer.__gridSize;
		// LDtk names a tile by where it is in the image, and numbers the
		// tiles its own way: the tileset's id for it is found by its place
		const tileset = entry.tileset;
		const ids = new Map<number, number>();
		const idOf = (tile: LDtkTile) => {
			let id = ids.get(tile.t);
			if (id === undefined) {
				id = tileset.tileIdAt(tile.src[0], tile.src[1]);
				ids.set(tile.t, id);
				if (id < 0) {
					warnOnce(
						`melonJS LDtk: layer "${layer.__identifier}" has a tile at ${String(tile.src[0])}, ${String(tile.src[1])} of tileset "${tileset.name}" where the image holds no whole tile: it is left out`,
					);
				}
			}
			return id;
		};
		const chunks = splitTiles(
			tiles,
			size,
			layer.__cWid,
			layer.__cHei,
			entry.tileset.tilewidth,
		);
		for (const [k, chunk] of chunks.entries()) {
			// a layer's parts are drawn in turn, within the layer's own orders
			const partZ = z + Math.min(k, Z_PER_LAYER - 1);
			let part: Renderable;
			if (chunk.kind === "grid") {
				const grid = new TileLayer({
					name: layer.__identifier,
					class: layer.__type,
					cols: chunk.cols,
					rows: chunk.rows,
					startx: chunk.startx,
					starty: chunk.starty,
					tilewidth: size,
					tileheight: size,
					tilesets: entry.group,
					z: partZ,
					opacity,
					offsetx: x,
					offsety: y,
					parallax,
				});
				for (const tile of chunk.tiles) {
					const id = idOf(tile);
					if (id >= 0) {
						grid.setCell(
							tile.px[0] / size,
							tile.px[1] / size,
							id + 1,
							tile.f & LDTK_FLIPS,
						);
					}
				}
				part = grid;
			} else {
				part = new PlacedTileLayer({
					name: layer.__identifier,
					class: layer.__type,
					tileset: entry.tileset,
					z: partZ,
					opacity,
					offsetx: x,
					offsety: y,
					parallax,
					tiles: chunk.tiles
						.filter((tile) => {
							return idOf(tile) >= 0;
						})
						.map((tile) => {
							return {
								// a tile left of or above the layer's origin
								// is the layer's to keep in view
								x: tile.px[0],
								y: tile.px[1],
								tileId: idOf(tile),
								flip: tile.f & LDTK_FLIPS,
								alpha: tile.a ?? 1,
							};
						}),
				});
			}
			this.add(built, part, partZ);
			built.layers.push(part);
		}
	}

	/**
	 * a texture atlas over an image, private to the level: regions of it are
	 * what sprites are made from (an entity's tile, a background). Not the
	 * renderer's cached atlas of the image, which is the tileset's grid.
	 * @param image - the image
	 * @returns the atlas, made on first use
	 */
	atlasOf(image: TileImage): TextureAtlas {
		let atlas = this.atlases.get(image);
		if (atlas === undefined) {
			atlas = new TextureAtlas(
				{
					meta: {
						app: "melonJS",
						size: { w: image.width, h: image.height },
					},
					frames: [],
				},
				image,
				false,
			);
			this.atlases.set(image, atlas);
		}
		return atlas;
	}

	/**
	 * the tile an entity shows, as a region of its tileset's image
	 * @param rect - the rectangle of the tileset
	 * @param mode - how it fills the entity's box
	 * @param borders - in nine-slice mode, the borders that are not stretched
	 * @returns the tile, or undefined when the tileset has no image
	 */
	objectTile(
		rect: LDtkTileRect | null | undefined,
		mode: string,
		borders: number[] | undefined,
	): ObjectTile | undefined {
		if (rect === null || rect === undefined) {
			return undefined;
		}
		const def = this.project.tilesets.get(rect.tilesetUid);
		const image = imageOf(this.project, def?.relPath);
		if (image === null) {
			return undefined;
		}
		const atlas = this.atlasOf(image);
		const region = regionOf(atlas, rect.x, rect.y, rect.w, rect.h);
		const tile: ObjectTile = {
			atlas,
			region,
			x: rect.x,
			y: rect.y,
			width: rect.w,
			height: rect.h,
			mode,
		};
		if (borders !== undefined) {
			tile.borders = borders;
		}
		return tile;
	}

	/**
	 * what an entity's class is given
	 * @param info - the entity's level
	 * @param layer - the entity's layer
	 * @param entity - the entity, as LDtk saves it
	 * @param x - where the layer's top left corner is
	 * @param y - where the layer's top left corner is
	 * @param z - the layer's draw order
	 * @returns the settings
	 */
	objectSettings(
		info: LDtkLevelInfo,
		layer: LDtkLayerInstance,
		entity: LDtkEntityInstance,
		x: number,
		y: number,
		z: number,
	): LDtkObjectSettings {
		const def = this.project.entityDefs.get(entity.defUid);
		const fields = fieldValues(entity.fieldInstances);
		const settings: LDtkObjectSettings = {
			name: entity.__identifier,
			class: entity.__identifier,
			type: entity.__identifier,
			id: entity.iid,
			iid: entity.iid,
			// LDtk places an entity by its pivot; a box is placed by its corner
			x: entityLeft(entity, x),
			y: entityTop(entity, y),
			z,
			width: entity.width,
			height: entity.height,
			pivot: { x: entity.__pivot[0], y: entity.__pivot[1] },
			px: { x: x + entity.px[0], y: y + entity.px[1] },
			tags: entity.__tags,
			fields,
			layer: layer.__identifier,
			level: info.identifier,
			anchorPoint: { x: 0, y: 0 },
		};
		const tile = this.objectTile(
			entity.__tile,
			def?.tileRenderMode ?? "FitInside",
			def?.nineSliceBorders,
		);
		if (tile !== undefined) {
			settings.tileRect = tile;
			// what a `Sprite` is made from: a class extending it can hand
			// the settings to its constructor
			settings.image = tile.atlas;
			settings.region = tile.region;
		}
		if (entity.__smartColor !== undefined) {
			settings.color = entity.__smartColor;
		}
		// a field is also read straight off the settings, as a Tiled
		// property is, unless the name is one of the settings' own
		for (const [name, value] of Object.entries(fields)) {
			if (!(name in settings) && !RESERVED_SETTINGS.has(name)) {
				settings[name] = value;
			}
		}
		return settings;
	}
}

/**
 * the options of a load that are LDtk's own
 * @param given - the options given to `level.load`
 * @returns the options to load with
 */
const optionsOf = (given: LDtkLoadOptions | undefined): LDtkLoadOptions => {
	const options: LDtkLoadOptions = {};
	if (given !== undefined) {
		for (const name of LOAD_OPTIONS as (keyof LDtkLoadOptions)[]) {
			if (given[name] !== undefined) {
				Object.assign(options, { [name]: given[name] });
			}
		}
	}
	return options;
};

/** what a level and a world have in common for the level director */
abstract class LDtkMap {
	/**
	 * The `level.load()` options this format reads, which a `Trigger`
	 * forwards from its settings.
	 * @ignore
	 */
	static loadOptions: readonly string[] = Object.freeze([...LOAD_OPTIONS]);

	/** the format's name, as registered with the level director */
	readonly format = "ldtk";
	/** the project the level or the world belongs to */
	readonly project: LDtkProject;
	/** the id it is loaded by: `level.load(name)` */
	readonly name: string;
	/** the grid is square */
	readonly orientation = "orthogonal";
	/** the size of a cell of the project's default grid, in pixels */
	readonly tilewidth: number;
	/** the size of a cell of the project's default grid, in pixels */
	readonly tileheight: number;
	/** its width in cells of the project's default grid */
	cols = 0;
	/** its height in cells of the project's default grid */
	rows = 0;
	/** its left edge in the container it is added to, in pixels: 0 for a level, LDtk's world coordinate for a world */
	x = 0;
	/** its top edge in the container it is added to, in pixels */
	y = 0;
	/** its width, in pixels */
	width = 0;
	/** its height, in pixels */
	height = 0;
	/** its tile layers, once it is loaded: `TileLayer` and `PlacedTileLayer` */
	layers: Renderable[] = [];
	/** the container it was added to, while it is loaded */
	container: Container | undefined;
	/** @ignore */
	protected builder: LevelBuilder | undefined;
	/** @ignore */
	protected follow: (() => void) | undefined;
	/** @ignore */
	protected gridRenderer: TMXOrthogonalRenderer | undefined;
	/**
	 * the persistent entities that stayed when their level was taken out,
	 * by their unique id in LDtk
	 */
	protected stayed = new Map<string, Renderable>();

	/**
	 * a persistent entity that stayed in the game when its level was taken
	 * out, if it is still there
	 * @param iid - the entity's unique id in LDtk
	 * @returns the entity, or undefined
	 * @ignore
	 */
	persistentEntity(iid: string): Renderable | undefined {
		const entity = this.stayed.get(iid);
		if (entity === undefined) {
			return undefined;
		}
		this.stayed.delete(iid);
		// removed by the game since: gone, and built again with its level
		const parent = entity.ancestor as Container | undefined | null;
		return parent ? entity : undefined;
	}

	constructor(project: LDtkProject, name: string) {
		this.project = project;
		this.name = name;
		this.tilewidth = project.json.defaultGridSize;
		this.tileheight = project.json.defaultGridSize;
	}

	/**
	 * the area it covers, in the container it is added to: from 0 for a
	 * level, in LDtk's world coordinates for a world
	 * @returns the bounds
	 */
	getBounds(): Bounds {
		const bounds = new Bounds();
		bounds.setMinMax(this.x, this.y, this.x + this.width, this.y + this.height);
		return bounds;
	}

	/**
	 * its tile layers, as a Tiled map gives them: what `layers` holds
	 * @returns the tile layers in the world now, bottom-most first
	 */
	getLayers(): Renderable[] {
		return this.layers;
	}

	/**
	 * the renderer of the project's default grid: cells to pixels and back
	 * @returns an orthogonal renderer
	 */
	getRenderer(): TMXOrthogonalRenderer {
		this.gridRenderer ??= getNewTMXRenderer(this);
		return this.gridRenderer;
	}

	/**
	 * add the level or the world to the container, as a Tiled map is
	 * @param container - the container
	 * @param options - LDtk's load options
	 * @param backgroundColor - the color behind it
	 * @param add - adds its layers, bodies and entities
	 */
	protected populate(
		container: Container,
		options: LDtkLoadOptions,
		backgroundColor: string,
		add: () => void,
	) {
		const bounds =
			options.setViewportBounds !== false ? this.getBounds() : undefined;
		this.follow = addLevelToContainer(container, {
			backgroundColor,
			add,
			width: this.width,
			height: this.height,
			bounds,
		}) as (() => void) | undefined;
	}

	/**
	 * let go of what loading built: called by the level director when another
	 * level is loaded
	 */
	destroy(): void {
		releaseViewport(this.follow);
		this.follow = undefined;
		this.builder = undefined;
		this.container = undefined;
		this.layers = [];
	}
}

/**
 * A level of an LDtk project, as the level director holds it:
 * `level.getCurrentLevel()` once it is loaded. It is loaded by its id, the
 * project's name and the level's identifier: `level.load("world:Level_0")`.
 * @category Tilemap
 */
export class LDtkLevel extends LDtkMap {
	/** the level, and where it stands in its world */
	readonly info: LDtkLevelInfo;
	/** the level's identifier in LDtk */
	readonly identifier: string;
	/** the level's custom fields, by name */
	readonly fields: Record<string, unknown>;
	/** the level's background color, as `#rrggbb` */
	readonly backgroundcolor: string;
	private built: BuiltLevel | undefined;

	/**
	 * @param project - the project
	 * @param info - the level
	 */
	constructor(project: LDtkProject, info: LDtkLevelInfo) {
		super(project, info.id);
		this.info = info;
		this.identifier = info.identifier;
		this.fields = info.fields;
		this.backgroundcolor = info.bgColor;
		this.width = info.width;
		this.height = info.height;
		this.cols = Math.ceil(info.width / this.tilewidth);
		this.rows = Math.ceil(info.height / this.tileheight);
	}

	/**
	 * add the level to a container: called by the level director
	 * @param container - the container, emptied
	 * @param options - the options given to `level.load`
	 */
	addTo(container: Container, options?: LDtkLoadOptions): void {
		const resolved = optionsOf(options);
		this.container = container;
		this.builder = new LevelBuilder(this.project, container, resolved, this);
		this.populate(container, resolved, this.info.bgColor, () => {
			this.built = this.builder?.build(this.info, 0, 0, 0, false);
		});
		this.layers = this.built?.layers ?? [];
	}

	/**
	 * the values of an IntGrid layer
	 * @param name - the layer's identifier in LDtk
	 * @returns the grid, or undefined if the level has no such layer or is not loaded
	 */
	getIntGrid(name: string): IntGrid | undefined {
		return this.built?.intGrids.get(name);
	}

	override destroy(): void {
		super.destroy();
		this.built = undefined;
	}
}

/**
 * A world of an LDtk project, as the level director holds it: its levels,
 * each where LDtk puts it. It is loaded by the project's name,
 * `level.load("world")`, with every level or with the ones asked for; the
 * others are added and removed while the game runs.
 * @category Tilemap
 */
export class LDtkWorld extends LDtkMap {
	/** the world: its layout, its levels and the area they cover */
	readonly info: LDtkWorldInfo;
	/** the project's background color, as `#rrggbb` */
	readonly backgroundcolor: string;
	private loaded = new Map<string, BuiltLevel>();
	private minDepth = 0;

	/**
	 * @param project - the project
	 * @param info - the world
	 */
	constructor(project: LDtkProject, info: LDtkWorldInfo) {
		super(project, info.id);
		this.info = info;
		this.x = info.bounds.x;
		this.y = info.bounds.y;
		this.width = info.bounds.width;
		this.height = info.bounds.height;
		this.cols = Math.ceil(this.width / this.tilewidth);
		this.rows = Math.ceil(this.height / this.tileheight);
		this.backgroundcolor = project.json.bgColor;
		for (const level of info.levels) {
			this.minDepth = Math.min(this.minDepth, level.depth);
		}
	}

	/**
	 * add the world to a container: called by the level director
	 * @param container - the container, emptied
	 * @param options - the options given to `level.load`
	 */
	addTo(container: Container, options?: LDtkLoadOptions): void {
		const resolved = optionsOf(options);
		this.container = container;
		this.builder = new LevelBuilder(this.project, container, resolved, this);
		const first = resolved.levels;
		this.populate(container, resolved, this.backgroundcolor, () => {
			for (const level of this.info.levels) {
				if (first === undefined || first.includes(level.identifier)) {
					this.build(level);
				}
			}
		});
	}

	private build(level: LDtkLevelInfo) {
		const builder = this.builder;
		if (builder === undefined) {
			return;
		}
		const built = builder.build(
			level,
			level.x,
			level.y,
			(level.depth - this.minDepth) * Z_PER_DEPTH,
			true,
		);
		this.loaded.set(level.identifier, built);
		for (const layer of built.layers) {
			this.layers.push(layer);
		}
	}

	/**
	 * a level of this world, by its identifier in LDtk or its iid
	 * @param identifier - the identifier, or the iid
	 * @returns the level, or undefined if the world has none of that name
	 */
	private levelOf(identifier: string): LDtkLevelInfo | undefined {
		return this.info.levels.find((candidate) => {
			return (
				candidate.identifier === identifier || candidate.iid === identifier
			);
		});
	}

	private find(identifier: string): LDtkLevelInfo {
		const level = this.levelOf(identifier);
		if (level === undefined) {
			throw new Error(`melonJS LDtk: no level "${identifier}" in ${this.name}`);
		}
		return level;
	}

	/**
	 * whether a level of the world is in the game now
	 * @param identifier - the level's identifier in LDtk, or its iid
	 * @returns true if it is
	 */
	isLoaded(identifier: string): boolean {
		const level = this.levelOf(identifier);
		return level !== undefined && this.loaded.has(level.identifier);
	}

	/**
	 * the levels of the world in the game now
	 * @returns their identifiers
	 */
	loadedLevels(): string[] {
		return [...this.loaded.keys()];
	}

	/**
	 * add a level of the world to the game, where LDtk puts it
	 * @param identifier - the level's identifier in LDtk, or its iid
	 * @returns false if it was there already, or the world is not loaded
	 */
	loadLevel(identifier: string): boolean {
		const level = this.find(identifier);
		const container = this.container;
		if (
			this.builder === undefined ||
			container === undefined ||
			this.loaded.has(level.identifier)
		) {
			return false;
		}
		// in their draw order at once: a frame can be drawn before a timer
		// sorts them, and would show the level's background over its tiles
		// this container alone: the containers the game keeps in it are
		// in an order of their own
		populateContainer(container, () => {
			this.build(level);
		});
		return true;
	}

	/**
	 * Take a level of the world out of the game: its layers, its bodies and
	 * its entities. An entity that is persistent
	 * ({@link Renderable#isPersistent}), as a player is, stays in the game,
	 * and is not built again when its level comes back.
	 * @param identifier - the level's identifier in LDtk, or its iid
	 * @returns false if it was not there
	 */
	unloadLevel(identifier: string): boolean {
		const level = this.find(identifier);
		const built = this.loaded.get(level.identifier);
		if (built === undefined) {
			return false;
		}
		this.loaded.delete(level.identifier);
		for (const child of built.children) {
			// a persistent entity stays, as it does over a level change
			if (child.isPersistent) {
				const iid = built.iids.get(child);
				if (iid !== undefined) {
					this.stayed.set(iid, child);
				}
				continue;
			}
			// an entity may have left by itself since (a coin picked up)
			const parent = child.ancestor as Container | undefined | null;
			parent?.removeChild(child);
		}
		this.layers = this.layers.filter((layer) => {
			return !built.layers.includes(layer);
		});
		return true;
	}

	/**
	 * the levels of the world an area touches
	 * @param x - the area's left edge, in pixels
	 * @param y - the area's top edge, in pixels
	 * @param width - the area's width (0 for a point)
	 * @param height - the area's height (0 for a point)
	 * @param depth - only the levels of this depth: in a world whose levels
	 * are stacked (LDtk's "world depth"), the ones the player is among
	 * @returns the levels
	 */
	levelsAt(
		x: number,
		y: number,
		width = 0,
		height = 0,
		depth?: number,
	): LDtkLevelInfo[] {
		return this.info.levels.filter((level) => {
			return (
				(depth === undefined || level.depth === depth) &&
				x + width >= level.x &&
				x <= level.x + level.width &&
				y + height >= level.y &&
				y <= level.y + level.height
			);
		});
	}

	/**
	 * Keep in the game the levels within reach of an area, and only those:
	 * the ones the area touches once grown by `margin` are added, the others
	 * taken out. Call it as the player moves, with the camera's view or the
	 * player's own box, for a world too large to hold at once.
	 * @param x - the area's left edge, in pixels
	 * @param y - the area's top edge, in pixels
	 * @param width - the area's width
	 * @param height - the area's height
	 * @param margin - how far past the area a level is kept, in pixels
	 * @param depth - keep the levels of this depth only: the levels of the
	 * other depths are taken out, which is how a world whose levels are
	 * stacked shows the ones the player is among
	 * @returns the identifiers of the levels added and of those taken out
	 */
	streamAround(
		x: number,
		y: number,
		width: number,
		height: number,
		margin = 0,
		depth?: number,
	): { loaded: string[]; unloaded: string[] } {
		const wanted = new Set(
			this.levelsAt(
				x - margin,
				y - margin,
				width + margin * 2,
				height + margin * 2,
				depth,
			).map((level) => {
				return level.identifier;
			}),
		);
		const result = { loaded: [] as string[], unloaded: [] as string[] };
		for (const identifier of this.loadedLevels()) {
			if (!wanted.has(identifier) && this.unloadLevel(identifier)) {
				result.unloaded.push(identifier);
			}
		}
		for (const identifier of wanted) {
			if (this.loadLevel(identifier)) {
				result.loaded.push(identifier);
			}
		}
		return result;
	}

	/**
	 * the values of an IntGrid layer of a level in the game
	 * @param level - the level's identifier in LDtk, or its iid
	 * @param name - the layer's identifier in LDtk
	 * @returns the grid, or undefined if the level is not in the game or has no such layer
	 */
	getIntGrid(level: string, name: string): IntGrid | undefined {
		const identifier = this.levelOf(level)?.identifier ?? level;
		return this.loaded.get(identifier)?.intGrids.get(name);
	}

	override destroy(): void {
		super.destroy();
		this.loaded.clear();
		this.stayed.clear();
	}
}
