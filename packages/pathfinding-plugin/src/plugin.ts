import {
	type Application,
	type Container,
	event,
	level,
	plugin,
	type TMXLayer,
} from "melonjs";
import { Grid, type TileLayerOptions } from "./grid.ts";

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
		event.on(event.LEVEL_LOADED, this.onLevelLoaded);
		// registered once a level is already loaded: build its grid now
		// (undefined before the first level, whatever its type says)
		if ((level.getCurrentLevel() as unknown) !== undefined) {
			this.onLevelLoaded();
		}
	}

	/**
	 * build the grid of the current level again: after the map changed in a
	 * way the grid did not see
	 * @returns the new grid, or null with no level, no such layer, or a
	 * `build` that returned null
	 * @throws {RangeError} on a staggered or hexagonal map (on a level load,
	 * a warning instead, and no grid)
	 */
	rebuild() {
		// nothing from the last level, whatever happens here
		this.grid = null;
		const { build, layer: name, container: given } = this.options;
		const container = given ?? this.app.world;
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
		const map = level.getCurrentLevel() as
			| {
					cols: number;
					rows: number;
					tilewidth: number;
					tileheight: number;
					orientation: string;
			  }
			| undefined;
		if (
			map !== undefined &&
			map.orientation !== "orthogonal" &&
			map.orientation !== "isometric"
		) {
			throw new RangeError(
				`pathfinding: a "${map.orientation}" map is not supported (orthogonal and isometric maps are)`,
			);
		}
		this.grid =
			map === undefined
				? null
				: Grid.fromBodies(container, {
						cols: map.cols,
						rows: map.rows,
						tileWidth: map.tilewidth,
						tileHeight: map.tileheight,
						cellShape: map.orientation === "isometric" ? "isometric" : "square",
					});
		return this.grid;
	}

	/** stop following level loads */
	destroy() {
		event.off(event.LEVEL_LOADED, this.onLevelLoaded);
		this.grid = null;
	}
}
