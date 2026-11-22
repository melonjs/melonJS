import { warnOnce } from "../../lang/console.js";
import { getImage } from "../../loader/cache.js";
import { Bounds } from "../../physics/bounds.ts";
import type Container from "../../renderable/container.js";
import Renderable from "../../renderable/renderable.js";
import { createCanvas } from "../../video/canvas_factory.js";
import { getNewTMXRenderer } from "../tiled/renderer/autodetect.js";
import type TMXOrthogonalRenderer from "../tiled/renderer/TMXOrthogonalRenderer.js";
import {
	createLevelObject,
	hasObjectFactory,
} from "../tiled/TMXObjectFactory.js";
import { applyObjectOpacity } from "../tiled/TMXUtils.js";
import { isCollisionLayerName, markWorldShape } from "../tilemap/collision.js";
import PlacedTileLayer from "../tilemap/PlacedTileLayer.js";
import { addLevelToContainer, populateContainer } from "../tilemap/populate.js";
import TileLayer, { FLIP_H_BIT, FLIP_V_BIT } from "../tilemap/TileLayer.js";
import Tileset from "../tilemap/Tileset.js";
import TilesetGroup from "../tilemap/TilesetGroup.js";
import { releaseViewport } from "../tilemap/viewport.js";
import { IntGrid } from "./intgrid.ts";
import type { LDtkLevelInfo, LDtkProject, LDtkWorldInfo } from "./project.ts";
import { fieldValues } from "./project.ts";
import {
	type BackgroundImage,
	type EntityTile,
	LDtkBackground,
	LDtkEntity,
	type LDtkEntitySettings,
	type TileImage,
} from "./renderables.ts";
import { splitTiles } from "./split.ts";
import type {
	LDtkEntityInstance,
	LDtkLayerInstance,
	LDtkTileRect,
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
	 * add the entities of the Entities layers
	 * @default true
	 */
	entities?: boolean;
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
	"entities",
	"setViewportBounds",
	"levels",
];

/**
 * the flips LDtk saves on a tile (bit 0 across, bit 1 down): the tile
 * layer's own bits for them
 */
const LDTK_FLIPS = FLIP_H_BIT | FLIP_V_BIT;

/** the draw orders kept for each layer of LDtk: a layer can become several */
const Z_PER_LAYER = 32;
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
	/** its entities */
	entities: Renderable[];
	/** its IntGrid layers, by their identifier */
	intGrids: Map<string, IntGrid>;
}

/**
 * an image the loader holds, by the path LDtk names it with
 * @param relPath - the path
 * @returns the image, or null if none is loaded under the file's name
 */
const imageOf = (relPath: string | null | undefined): TileImage | null => {
	if (relPath === null || relPath === undefined) {
		return null;
	}
	return getImage(relPath) as TileImage | null;
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
	map: object;
	/** the tilesets made so far, by their uid; null for one with no image */
	tilesets = new Map<
		number,
		{ tileset: Tileset; group: TilesetGroup } | null
	>();
	/** the tilesets drawing the IntGrid layers, by layer definition */
	intGridTilesets = new Map<
		number,
		{ group: TilesetGroup; index: Map<number, number> }
	>();

	constructor(
		project: LDtkProject,
		container: Container,
		options: LDtkLoadOptions,
		map: object,
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
		const image = imageOf(def?.relPath);
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
				// as LDtk counts them, so that a tile id names the same tile
				columns: def.__cWid,
				tilecount: def.__cWid * def.__cHei,
			});
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
			entities: [],
			intGrids: new Map(),
		};
		const json = info.json;

		// the background: the level's color, and its image as LDtk places it
		let image: BackgroundImage | undefined;
		const bgImage = imageOf(json.bgRelPath);
		if (json.bgRelPath !== null && json.bgRelPath !== undefined) {
			if (bgImage === null) {
				warnOnce(
					`melonJS LDtk: the background image of level "${info.identifier}" (${json.bgRelPath}) is not loaded`,
				);
			} else if (json.__bgPos !== null && json.__bgPos !== undefined) {
				image = {
					image: bgImage,
					crop: json.__bgPos.cropRect,
					x: json.__bgPos.topLeftPx[0],
					y: json.__bgPos.topLeftPx[1],
					scaleX: json.__bgPos.scale[0],
					scaleY: json.__bgPos.scale[1],
				};
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
			const z = zBase + 1 + (layers.length - 1 - i) * Z_PER_LAYER;
			const x = originX + layer.__pxTotalOffsetX;
			const y = originY + layer.__pxTotalOffsetY;
			const tiles =
				layer.__type === "Tiles" ? layer.gridTiles : layer.autoLayerTiles;

			if (layer.intGridCsv.length > 0) {
				this.buildIntGrid(built, layer, x, y, z, opacity, tiles.length === 0);
			}
			if (tiles.length > 0) {
				this.buildTiles(built, layer, x, y, z, opacity);
			}
			if (layer.entityInstances.length > 0 && this.options.entities !== false) {
				for (const entity of layer.entityInstances) {
					const settings = this.entitySettings(info, layer, entity, x, y, z);
					const object = hasObjectFactory(settings.class)
						? createLevelObject(settings, this.map)
						: new LDtkEntity(settings);
					// an entity is faded as its layer is, like the objects
					// of a Tiled object layer
					if (opacity !== 1 && object.isRenderable) {
						applyObjectOpacity(object, opacity);
					}
					this.add(built, object, z);
					built.entities.push(object);
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
	 */
	buildIntGrid(
		built: BuiltLevel,
		layer: LDtkLayerInstance,
		x: number,
		y: number,
		z: number,
		opacity: number,
		bare: boolean,
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
	 */
	buildTiles(
		built: BuiltLevel,
		layer: LDtkLayerInstance,
		x: number,
		y: number,
		z: number,
		opacity: number,
	) {
		const entry = this.tilesetFor(layer.__tilesetDefUid);
		if (entry === null) {
			return;
		}
		const tiles =
			layer.__type === "Tiles" ? layer.gridTiles : layer.autoLayerTiles;
		const size = layer.__gridSize;
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
				});
				for (const tile of chunk.tiles) {
					grid.setCell(
						tile.px[0] / size,
						tile.px[1] / size,
						tile.t + 1,
						tile.f & LDTK_FLIPS,
					);
				}
				part = grid;
			} else {
				// a layer starts at its top left tile: one left of or above
				// the layer's origin moves the layer there
				let left = 0;
				let top = 0;
				for (const tile of chunk.tiles) {
					left = Math.min(left, tile.px[0]);
					top = Math.min(top, tile.px[1]);
				}
				part = new PlacedTileLayer({
					name: layer.__identifier,
					class: layer.__type,
					tileset: entry.tileset,
					z: partZ,
					opacity,
					offsetx: x + left,
					offsety: y + top,
					tiles: chunk.tiles.map((tile) => {
						return {
							x: tile.px[0] - left,
							y: tile.px[1] - top,
							tileId: tile.t,
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
	 * the tile an entity or a field shows, cut from its tileset's image
	 * @param rect - the rectangle of the tileset
	 * @param mode - how it fills the entity's box
	 * @returns the tile, or undefined when the tileset has no image
	 */
	entityTile(
		rect: LDtkTileRect | null | undefined,
		mode: string,
	): EntityTile | undefined {
		if (rect === null || rect === undefined) {
			return undefined;
		}
		const def = this.project.tilesets.get(rect.tilesetUid);
		const image = imageOf(def?.relPath);
		if (image === null) {
			return undefined;
		}
		return {
			image,
			x: rect.x,
			y: rect.y,
			width: rect.w,
			height: rect.h,
			mode,
		};
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
	entitySettings(
		info: LDtkLevelInfo,
		layer: LDtkLayerInstance,
		entity: LDtkEntityInstance,
		x: number,
		y: number,
		z: number,
	): LDtkEntitySettings {
		const def = this.project.entityDefs.get(entity.defUid);
		const fields = fieldValues(entity.fieldInstances);
		const settings: LDtkEntitySettings = {
			name: entity.__identifier,
			class: entity.__identifier,
			type: entity.__identifier,
			id: entity.iid,
			iid: entity.iid,
			// LDtk places an entity by its pivot; a box is placed by its corner
			x: x + entity.px[0] - entity.__pivot[0] * entity.width,
			y: y + entity.px[1] - entity.__pivot[1] * entity.height,
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
		const tile = this.entityTile(
			entity.__tile,
			def?.tileRenderMode ?? "FitInside",
		);
		if (tile !== undefined) {
			settings.tile = tile;
		}
		if (entity.__smartColor !== undefined) {
			settings.color = entity.__smartColor;
		}
		// a field is also read straight off the settings, as a Tiled
		// property is, unless the name is one of the settings' own
		for (const [name, value] of Object.entries(fields)) {
			if (!(name in settings)) {
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
	protected unfollow: (() => void) | undefined;
	/** @ignore */
	protected gridRenderer: TMXOrthogonalRenderer | undefined;

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
		const follow = addLevelToContainer(container, {
			backgroundColor,
			add,
			width: this.width,
			height: this.height,
			bounds,
		}) as (() => void) | undefined;
		this.unfollow =
			follow === undefined
				? undefined
				: () => {
						releaseViewport(follow);
					};
	}

	/**
	 * let go of what loading built: called by the level director when another
	 * level is loaded
	 */
	destroy(): void {
		this.unfollow?.();
		this.unfollow = undefined;
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

	/**
	 * the level's entities, as added to the container
	 * @param name - an entity identifier, to get only those
	 * @returns the entities
	 */
	getEntities(name?: string): Renderable[] {
		const entities = this.built?.entities ?? [];
		return name === undefined
			? entities.slice()
			: entities.filter((entity) => {
					return entity.name === name;
				});
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

	private find(identifier: string): LDtkLevelInfo {
		const level = this.info.levels.find((candidate) => {
			return (
				candidate.identifier === identifier || candidate.iid === identifier
			);
		});
		if (level === undefined) {
			throw new Error(`melonJS LDtk: no level "${identifier}" in ${this.name}`);
		}
		return level;
	}

	/**
	 * whether a level of the world is in the game now
	 * @param identifier - the level's identifier in LDtk
	 * @returns true if it is
	 */
	isLoaded(identifier: string): boolean {
		return this.loaded.has(identifier);
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
	 * @param identifier - the level's identifier in LDtk
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
		populateContainer(container, () => {
			this.build(level);
		});
		return true;
	}

	/**
	 * take a level of the world out of the game: its layers, its bodies and
	 * its entities
	 * @param identifier - the level's identifier in LDtk
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
	 * @returns the levels
	 */
	levelsAt(x: number, y: number, width = 0, height = 0): LDtkLevelInfo[] {
		return this.info.levels.filter((level) => {
			return (
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
	 * @returns the identifiers of the levels added and of those taken out
	 */
	streamAround(
		x: number,
		y: number,
		width: number,
		height: number,
		margin = 0,
	): { loaded: string[]; unloaded: string[] } {
		const wanted = new Set(
			this.levelsAt(
				x - margin,
				y - margin,
				width + margin * 2,
				height + margin * 2,
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
	 * @param level - the level's identifier in LDtk
	 * @param name - the layer's identifier in LDtk
	 * @returns the grid, or undefined if the level is not in the game or has no such layer
	 */
	getIntGrid(level: string, name: string): IntGrid | undefined {
		return this.loaded.get(level)?.intGrids.get(name);
	}

	/**
	 * the entities of the levels in the game, as added to the container
	 * @param name - an entity identifier, to get only those
	 * @returns the entities
	 */
	getEntities(name?: string): Renderable[] {
		const entities: Renderable[] = [];
		for (const built of this.loaded.values()) {
			for (const entity of built.entities) {
				if (name === undefined || entity.name === name) {
					entities.push(entity);
				}
			}
		}
		return entities;
	}

	override destroy(): void {
		super.destroy();
		this.loaded.clear();
	}
}
