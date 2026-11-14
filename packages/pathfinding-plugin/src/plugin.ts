import {
	type Application,
	type Container,
	event,
	level,
	plugin,
	type Renderable,
	TMXLayer,
	utils,
	Vector2d,
	version,
} from "melonjs";
import { Grid, type TileLayerOptions } from "./grid.ts";

/** the part of a loaded Tiled map the plugin reads */
interface LevelMap {
	cols: number;
	rows: number;
	tilewidth: number;
	tileheight: number;
	orientation: string;
	layers: Renderable[];
	getRenderer(): {
		tileToPixelCoords(x: number, y: number, v: Vector2d): Vector2d;
	};
}

/**
 * the current level, if any
 * @returns the map, or undefined before the first level
 */
const currentLevel = () => {
	// undefined before the first level, whatever its type says
	return level.getCurrentLevel() as unknown as LevelMap | undefined;
};

/**
 * whether a renderable is in a container, or in a container in it
 * @param r - the renderable
 * @param container - the container
 * @returns true if it is
 */
const isIn = (r: Renderable, container: Container) => {
	for (let a = r.ancestor as Renderable | undefined; a; a = a.ancestor) {
		if (a === container) {
			return true;
		}
	}
	return false;
};

/**
 * the cells a map's level covers, in its tile coordinates: the map's own
 * area, grown to every tile layer's, which on an infinite map can start
 * left of or above its origin
 * @param map - the map
 * @returns the first column and row, and how many
 */
const levelArea = (map: LevelMap) => {
	let x0 = 0;
	let y0 = 0;
	let x1 = map.cols;
	let y1 = map.rows;
	for (const layer of map.layers) {
		if (layer instanceof TMXLayer) {
			x0 = Math.min(x0, layer.startx);
			y0 = Math.min(y0, layer.starty);
			x1 = Math.max(x1, layer.startx + layer.cols);
			y1 = Math.max(y1, layer.starty + layer.rows);
		}
	}
	return { x: x0, y: y0, cols: x1 - x0, rows: y1 - y0 };
};

/** how {@link PathfindingPlugin} builds the grid of each level */
export interface PathfindingPluginOptions extends TileLayerOptions {
	/**
	 * the name of the tile layer to build the grid from (see
	 * {@link Grid.fromTileLayer}). Without it, the grid is built from the
	 * level's collision shapes (see {@link Grid.fromBodies}).
	 */
	layer?: string;
	/**
	 * where the level is loaded
	 * @default the application's world
	 */
	container?: Container;
	/**
	 * build the grid yourself instead, from whatever the level holds;
	 * return null for a level with nothing to find a way across
	 */
	build?: (container: Container) => Grid | null;
}

/**
 * Keeps a pathfinding {@link Grid} for the current level: built when a
 * level is loaded, from a tile layer or from the level's collision shapes,
 * and replaced by the next level's.
 *
 * It is only a convenience for games whose grid comes from the level: a
 * {@link Grid} works on its own.
 * @example
 * import { plugin } from "melonjs";
 * import { PathfindingPlugin } from "@melonjs/pathfinding-plugin";
 *
 * plugin.register(PathfindingPlugin, "pathfinding", { layer: "walls" });
 * // once a level is loaded
 * const pathfinding = plugin.cache.pathfinding;
 * const { path } = pathfinding.grid.findPath(enemy.pos, player.pos);
 */
export class PathfindingPlugin extends plugin.BasePlugin {
	/** the current level's grid, or null before a level is loaded */
	grid: Grid | null = null;

	private readonly options: PathfindingPluginOptions;
	private readonly onLevelLoaded = () => {
		// a level loaded by another application (or after this one was
		// destroyed) is not this plugin's: keep its grid
		if (!this.ownsLevel()) {
			return;
		}
		// a level the grid cannot be built for still loads: warn, and keep
		// no grid rather than the last level's
		try {
			this.rebuild();
		} catch (error) {
			console.warn(
				`pathfinding: no grid for this level: ${(error as Error).message}`,
			);
		}
	};

	/**
	 * @param options - how to build each level's grid
	 * @param app - the application, if not the last one initialized
	 */
	constructor(options: PathfindingPluginOptions = {}, app?: Application) {
		super(app);
		this.version = "20.12.0";
		this.options = options;
		// an engine too old for the plugin: `plugin.register` refuses it
		// once it is built, so follow nothing, or the listener would outlive it
		if (utils.checkVersion(this.version, version) > 0) {
			return;
		}
		event.on(event.LEVEL_LOADED, this.onLevelLoaded);
		// registered once a level is already loaded: build its grid now
		if (currentLevel() !== undefined) {
			this.onLevelLoaded();
		}
	}

	/** where the levels are loaded */
	private get container() {
		return this.options.container ?? this.app.world;
	}

	/**
	 * whether the current level is loaded in this plugin's container: the
	 * level registry is shared by every application
	 * @returns true if it is, or if the level has no layer to tell by
	 */
	private ownsLevel() {
		const map = currentLevel();
		if (map === undefined || map.layers.length === 0) {
			return true;
		}
		const container = this.container;
		return map.layers.some((layer) => {
			return isIn(layer, container);
		});
	}

	/**
	 * build the grid of the current level again: after the map changed in a
	 * way the grid did not see
	 * @returns the new grid, or null with no level, no such layer, or a
	 * `build` that returned null. Built from the collision shapes, it covers
	 * the whole level: on an infinite map, from its first painted column
	 * and row, which can be left of or above the map's origin.
	 * @throws {RangeError} on a staggered or hexagonal map (on a level load,
	 * a warning instead, and no grid)
	 */
	rebuild() {
		// nothing from the last level, whatever happens here
		this.grid = null;
		const { build, layer: name } = this.options;
		const container = this.container;
		if (build !== undefined) {
			this.grid = build(container);
			return this.grid;
		}
		if (name !== undefined) {
			const layer = container.getChildByName(name)[0] as unknown as
				| TMXLayer
				| undefined;
			this.grid =
				layer === undefined ? null : Grid.fromTileLayer(layer, this.options);
			return this.grid;
		}
		const map = currentLevel();
		if (map === undefined) {
			return null;
		}
		if (map.orientation !== "orthogonal" && map.orientation !== "isometric") {
			throw new RangeError(
				`pathfinding: a "${map.orientation}" map is not supported (orthogonal and isometric maps are)`,
			);
		}
		// the whole level, an infinite map's tiles left of or above its
		// origin included, where the map's renderer puts it in the container
		const isometric = map.orientation === "isometric";
		const area = levelArea(map);
		const corner = map
			.getRenderer()
			.tileToPixelCoords(area.x, area.y, new Vector2d());
		if (isometric) {
			// the grid's corner is the box around its diamonds
			corner.x -= (area.rows * map.tilewidth) / 2;
		}
		const at = container.getAbsolutePosition();
		this.grid = Grid.fromBodies(container, {
			cols: area.cols,
			rows: area.rows,
			tileWidth: map.tilewidth,
			tileHeight: map.tileheight,
			cellShape: isometric ? "isometric" : "square",
			x: at.x + corner.x,
			y: at.y + corner.y,
		});
		return this.grid;
	}

	/** stop following level loads */
	destroy() {
		event.off(event.LEVEL_LOADED, this.onLevelLoaded);
		this.grid = null;
	}
}
