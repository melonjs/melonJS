import {
	type Container,
	collision,
	type Renderable,
	type Tile,
	type TMXLayer,
} from "melonjs";
import { IndexHeap } from "./heap.ts";

/** a point in world units */
export interface PathPoint {
	x: number;
	y: number;
}

/** a cell of the grid, by column and row */
export interface Cell {
	col: number;
	row: number;
}

/**
 * How far a cell looks from the goal, from the column and row distances:
 * `"manhattan"` (`dx + dy`), `"octile"` (diagonal steps cost √2),
 * `"chebyshev"` (diagonal steps cost 1), `"euclidean"`, or your own.
 * The search finds the cheapest path while the estimate never exceeds the
 * real cost; a higher one searches less and finds a path that may not be.
 */
export type Heuristic =
	| "manhattan"
	| "octile"
	| "chebyshev"
	| "euclidean"
	| ((dx: number, dy: number) => number);

/** how {@link Grid#findPath} searches */
export interface FindPathOptions {
	/**
	 * Move diagonally as well. A diagonal step never cuts a corner: both
	 * cells beside it must be open.
	 * @default false
	 */
	diagonal?: boolean;
	/**
	 * The estimate of the distance left.
	 * @default "manhattan", or "octile" with `diagonal`
	 */
	heuristic?: Heuristic;
	/**
	 * The most cells the search looks at before it gives up, so a goal that
	 * cannot be reached does not stall a frame. With `closest`, the path
	 * then leads as near as it got.
	 * @default Infinity
	 */
	maxNodes?: number;
	/**
	 * When the goal cannot be reached (blocked, walled off, or past
	 * `maxNodes`), return the path to the cell nearest to it instead of no
	 * path at all. `found` tells the two apart.
	 * @default true
	 */
	closest?: boolean;
	/**
	 * Straighten the path: drop the points between two that can see each
	 * other in a straight line over open cells, so an agent heads straight
	 * there instead of stepping tile by tile. The line keeps to cells no
	 * costlier than the ones it replaces, so it never cuts through mud the
	 * search went around.
	 * @default false
	 */
	smooth?: boolean;
	/**
	 * Points (in world units, or cells with `tiles`) to keep away from for
	 * this search only: other agents, a hazard. Their cells cost
	 * `avoidCost` more to enter. The start and the goal are never avoided.
	 */
	avoid?: Iterable<PathPoint>;
	/**
	 * What entering an avoided cell costs on top of its own cost.
	 * `Infinity` blocks it.
	 * @default Infinity
	 */
	avoidCost?: number;
	/**
	 * `from`, `to` and `avoid` are cells (`x` the column, `y` the row)
	 * rather than world positions.
	 * @default false
	 */
	tiles?: boolean;
	/**
	 * Keep the cells the search looked at, in order, in `result.trace`: for
	 * a debug view.
	 * @default false
	 */
	trace?: boolean;
}

/** what {@link Grid#findPath} found */
export interface PathResult {
	/** whether the path reaches the goal (otherwise it leads as near as it could) */
	found: boolean;
	/**
	 * the points to go through, in world units: the centre of each cell after
	 * the start, the last one the goal's (or the nearest cell's). Empty when
	 * already there, or when there is nowhere to go.
	 */
	path: PathPoint[];
	/** the same steps, as cells */
	cells: Cell[];
	/** what the path costs, in steps weighted by each cell's cost */
	cost: number;
	/** how many cells the search looked at */
	explored: number;
	/** the cells the search looked at, in order, with `trace` */
	trace?: Cell[];
}

/** how to build a {@link Grid} */
export interface GridSettings {
	/** columns */
	cols: number;
	/** rows */
	rows: number;
	/** a cell's width, in world units */
	tileWidth: number;
	/** a cell's height, in world units */
	tileHeight: number;
	/**
	 * where the grid's top left corner is in the world
	 * @default 0
	 */
	x?: number;
	/** @default 0 */
	y?: number;
	/**
	 * whether a cell can be walked on, read for every cell when the grid
	 * is built and on {@link Grid#refresh}
	 * @default every cell is open
	 */
	walkable?: (col: number, row: number) => boolean;
	/**
	 * what entering a cell costs, 1 or more (mud 3, a road 1), read with
	 * `walkable`
	 * @default 1
	 */
	cost?: (col: number, row: number) => number;
	/**
	 * called before `walkable` and `cost` are read for every cell (when the
	 * grid is built, and on each {@link Grid#refresh}): to gather what they
	 * read, once
	 */
	prepare?: () => void;
}

/** how {@link Grid.fromTileLayer} reads a layer */
export interface TileLayerOptions {
	/**
	 * whether a cell is open, from the tile in it (null for an empty cell)
	 * @default an empty cell is open, a cell with a tile is blocked
	 */
	walkable?: (tile: Tile | null, col: number, row: number) => boolean;
	/**
	 * what entering a cell costs, 1 or more
	 * @default the tile's `cost` custom property (set in Tiled's tileset
	 * editor), or 1
	 */
	cost?: (tile: Tile | null, col: number, row: number) => number;
	/**
	 * where the layer's top left corner is in the world
	 * @default the layer's own position, its containers' included
	 */
	x?: number;
	/** @default the layer's own position, its containers' included */
	y?: number;
}

/** how {@link Grid.fromBodies} reads a level's collision shapes */
export interface BodiesOptions {
	/** columns */
	cols: number;
	/** rows */
	rows: number;
	/** a cell's width, in world units */
	tileWidth: number;
	/** a cell's height, in world units */
	tileHeight: number;
	/**
	 * where the grid's top left corner is in the world
	 * @default 0
	 */
	x?: number;
	/** @default 0 */
	y?: number;
	/**
	 * which renderables are walls
	 * @default those with a `WORLD_SHAPE` body: the collision shapes of a
	 * Tiled map's collision layer, and any body declared as one
	 */
	solid?: (renderable: Renderable) => boolean;
	/**
	 * what entering a cell costs, 1 or more
	 * @default 1
	 */
	cost?: (col: number, row: number) => number;
}

/** a renderable's body, as the built-in physics or a `bodyDef` holds it */
interface WithBody {
	body?: { collisionType?: number; shapes?: Shape[] };
	bodyDef?: { collisionType?: number; shapes?: Shape[] };
}

/** the part of a melonJS shape the grid uses */
interface Shape {
	contains(x: number, y: number): boolean;
	getBounds(): { left: number; top: number; right: number; bottom: number };
}

/** where a cell is sampled for walls, as fractions of its size */
const SAMPLES = [0.125, 0.5, 0.875];

const isWorldShape = (renderable: Renderable) => {
	const r = renderable as unknown as WithBody;
	const type = r.bodyDef?.collisionType ?? r.body?.collisionType;
	return type === collision.types.WORLD_SHAPE;
};

const SQRT2 = Math.SQRT2;
// the four straight neighbours, then the four diagonal ones
const DX = [0, 1, 0, -1, 1, 1, -1, -1];
const DY = [-1, 0, 1, 0, -1, 1, 1, -1];

const HEURISTICS = {
	manhattan: (dx: number, dy: number) => {
		return dx + dy;
	},
	octile: (dx: number, dy: number) => {
		return dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx;
	},
	chebyshev: (dx: number, dy: number) => {
		return dx > dy ? dx : dy;
	},
	euclidean: (dx: number, dy: number) => {
		return Math.sqrt(dx * dx + dy * dy);
	},
};

const checkCost = (cost: number) => {
	if (!(cost >= 1) || cost === Infinity) {
		throw new RangeError(
			`pathfinding: a cell's cost must be a finite number of 1 or more (got ${cost}); make a cell impassable with setWalkable(col, row, false)`,
		);
	}
	return cost;
};

/**
 * A grid of cells a path can be found across, with A*.
 *
 * Each cell is open or blocked and has a cost (1 or more) to enter. Build
 * one from a Tiled tile layer ({@link Grid.fromTileLayer}), from a level's
 * collision shapes ({@link Grid.fromBodies}), or from your own callbacks;
 * change cells as the game goes on with {@link Grid#setWalkable} and
 * {@link Grid#setCost}, and search it with {@link Grid#findPath}.
 *
 * Only square-cell (orthogonal) grids for now: isometric and hexagonal maps
 * are not supported.
 * @example
 * const grid = new Grid({ cols: 20, rows: 15, tileWidth: 32, tileHeight: 32 });
 * grid.setWalkable(5, 3, false);
 * const { path, found } = grid.findPath(enemy.pos, player.pos, { diagonal: true });
 */
export class Grid {
	/** columns */
	readonly cols: number;
	/** rows */
	readonly rows: number;
	/** a cell's width, in world units */
	readonly tileWidth: number;
	/** a cell's height, in world units */
	readonly tileHeight: number;
	/** where the grid's top left corner is in the world */
	x: number;
	/** where the grid's top left corner is in the world */
	y: number;

	private readonly settings: GridSettings;
	private readonly open: Uint8Array;
	private readonly costs: Float32Array;

	// search state, kept between searches so a search allocates nothing
	// but its result. A cell belongs to the current search when its mark
	// equals the search's stamp, so nothing has to be cleared in between
	private readonly g: Float64Array;
	private readonly f: Float64Array;
	private readonly h: Float64Array;
	private readonly parent: Int32Array;
	private readonly seen: Uint32Array;
	private readonly closed: Uint32Array;
	private readonly heap: IndexHeap;
	private stamp = 0;
	private readonly avoided = new Map<number, number>();

	constructor(settings: GridSettings) {
		for (const key of ["cols", "rows"] as const) {
			if (!Number.isInteger(settings[key]) || settings[key] < 1) {
				throw new RangeError(
					`pathfinding: ${key} must be a whole number of 1 or more (got ${settings[key]})`,
				);
			}
		}
		for (const key of ["tileWidth", "tileHeight"] as const) {
			if (!(settings[key] > 0)) {
				throw new RangeError(
					`pathfinding: ${key} must be more than 0 (got ${settings[key]})`,
				);
			}
		}
		this.settings = settings;
		this.cols = settings.cols;
		this.rows = settings.rows;
		this.tileWidth = settings.tileWidth;
		this.tileHeight = settings.tileHeight;
		this.x = settings.x ?? 0;
		this.y = settings.y ?? 0;
		const n = this.cols * this.rows;
		this.open = new Uint8Array(n);
		this.costs = new Float32Array(n);
		this.g = new Float64Array(n);
		this.f = new Float64Array(n);
		this.h = new Float64Array(n);
		this.parent = new Int32Array(n);
		this.seen = new Uint32Array(n);
		this.closed = new Uint32Array(n);
		this.heap = new IndexHeap(n, this.f, this.h);
		this.refresh();
	}

	/**
	 * A grid over a Tiled tile layer: one cell per tile. By default a cell
	 * holding a tile is a wall and an empty one is open (a layer of walls);
	 * pass `walkable` to decide from the tile instead (a tile property, its
	 * id). A tile's `cost` property sets what crossing it costs.
	 *
	 * The layer is read again on {@link Grid#refresh}, so after changing
	 * tiles with `setTile` / `clearTile`, refresh the grid (or just the
	 * changed cell, with {@link Grid#refreshCell}).
	 * @example
	 * const walls = app.world.getChildByName("walls")[0];
	 * const grid = Grid.fromTileLayer(walls);
	 * @example
	 * // a floor layer: walkable where the tile is not a wall
	 * const grid = Grid.fromTileLayer(floor, {
	 *     walkable: (tile) =>
	 *         tile !== null && tile.tileset.getTileProperties(tile.tileId)?.kind !== "wall",
	 * });
	 * @param layer - the tile layer, once its level is loaded
	 * @param options - how to read it
	 * @returns a grid with one cell per tile
	 */
	static fromTileLayer(layer: TMXLayer, options: TileLayerOptions = {}) {
		// not yet in a container: its own position
		const parent = layer.ancestor as Container | undefined;
		const at = parent === undefined ? layer.pos : layer.getAbsolutePosition();
		const { walkable, cost } = options;
		const props = (tile: Tile | null) => {
			return tile === null
				? undefined
				: (tile.tileset.getTileProperties(tile.tileId) as
						| { cost?: unknown }
						| undefined);
		};
		return new Grid({
			cols: layer.cols,
			rows: layer.rows,
			tileWidth: layer.tilewidth,
			tileHeight: layer.tileheight,
			x: options.x ?? at.x,
			y: options.y ?? at.y,
			walkable: (col, row) => {
				// null for an empty cell, whatever its type says
				const tile = layer.cellAt(col, row) as Tile | null;
				return walkable === undefined
					? tile === null
					: walkable(tile, col, row);
			},
			cost: (col, row) => {
				// null for an empty cell, whatever its type says
				const tile = layer.cellAt(col, row) as Tile | null;
				if (cost !== undefined) {
					return cost(tile, col, row);
				}
				const value = props(tile)?.cost;
				return typeof value === "number" ? value : 1;
			},
		});
	}

	/**
	 * A grid over a level's collision shapes: the walls drawn in a Tiled
	 * map's collision layer, or any static body. A cell is blocked when a
	 * wall's shape covers any of nine points spread over it (a wall thinner
	 * than an eighth of a cell can slip between them). Cells are read from
	 * the shapes themselves on the built-in physics, and from each wall's
	 * bounding box otherwise.
	 *
	 * Build it once the level is loaded (the shapes are scanned then, not
	 * found by a physics query, so it works before the world first steps);
	 * {@link Grid#refresh} scans them again.
	 * @param container - where to look for the walls, its children's
	 * children included (usually `app.world`)
	 * @param options - the grid's size, and which renderables are walls
	 * @returns the grid
	 * @example
	 * await level.load("map", { container: app.world, async: true });
	 * const map = level.getCurrentLevel();
	 * const grid = Grid.fromBodies(app.world, {
	 *     cols: map.cols, rows: map.rows,
	 *     tileWidth: map.tilewidth, tileHeight: map.tileheight,
	 * });
	 */
	static fromBodies(container: Container, options: BodiesOptions) {
		const { cols, rows, tileWidth, tileHeight } = options;
		const x0 = options.x ?? 0;
		const y0 = options.y ?? 0;
		const solid = options.solid ?? isWorldShape;
		const blocked = new Uint8Array(cols * rows);

		const scan = () => {
			blocked.fill(0);
			const visit = (parent: Container) => {
				for (const child of parent.getChildren()) {
					if (solid(child)) {
						mark(child);
					}
					const inner = child as unknown as Partial<Container>;
					if (typeof inner.getChildren === "function") {
						visit(child as unknown as Container);
					}
				}
			};
			const mark = (wall: Renderable) => {
				const r = wall as unknown as WithBody;
				const shapes = r.body?.shapes ?? r.bodyDef?.shapes;
				const at = wall.getAbsolutePosition();
				const bounds = wall.getBounds();
				// the area to scan: the shapes' own, which can reach past the
				// renderable they belong to
				let left = bounds.left;
				let top = bounds.top;
				let right = bounds.right;
				let bottom = bounds.bottom;
				if (shapes !== undefined && shapes.length > 0) {
					left = top = Infinity;
					right = bottom = -Infinity;
					for (const shape of shapes) {
						const b = shape.getBounds();
						left = Math.min(left, at.x + b.left);
						top = Math.min(top, at.y + b.top);
						right = Math.max(right, at.x + b.right);
						bottom = Math.max(bottom, at.y + b.bottom);
					}
				}
				const c0 = Math.max(0, Math.floor((left - x0) / tileWidth));
				const r0 = Math.max(0, Math.floor((top - y0) / tileHeight));
				const c1 = Math.min(cols - 1, Math.floor((right - x0) / tileWidth));
				const r1 = Math.min(rows - 1, Math.floor((bottom - y0) / tileHeight));
				for (let row = r0; row <= r1; row++) {
					for (let col = c0; col <= c1; col++) {
						const i = row * cols + col;
						if (blocked[i] === 1) {
							continue;
						}
						for (const fy of SAMPLES) {
							for (const fx of SAMPLES) {
								const px = x0 + (col + fx) * tileWidth;
								const py = y0 + (row + fy) * tileHeight;
								const inside =
									shapes === undefined || shapes.length === 0
										? bounds.contains(px, py)
										: shapes.some((shape) => {
												return shape.contains(px - at.x, py - at.y);
											});
								if (inside) {
									blocked[i] = 1;
								}
							}
						}
					}
				}
			};
			visit(container);
		};

		const grid = new Grid({
			cols,
			rows,
			tileWidth,
			tileHeight,
			x: x0,
			y: y0,
			prepare: scan,
			walkable: (col, row) => {
				return blocked[row * cols + col] === 0;
			},
			...(options.cost !== undefined ? { cost: options.cost } : {}),
		});
		return grid;
	}

	// ---------------------------------------------------------------------
	// cells
	// ---------------------------------------------------------------------

	/**
	 * Read every cell again from the `walkable` and `cost` the grid was
	 * built with: after the map changed in a way the grid did not see.
	 * Undoes {@link Grid#setWalkable} and {@link Grid#setCost}.
	 */
	refresh() {
		this.settings.prepare?.();
		for (let row = 0; row < this.rows; row++) {
			for (let col = 0; col < this.cols; col++) {
				this.refreshCell(col, row);
			}
		}
	}

	/**
	 * read one cell again, as {@link Grid#refresh} does every cell
	 * @param col - the cell's column
	 * @param row - the cell's row
	 */
	refreshCell(col: number, row: number) {
		if (!this.contains(col, row)) {
			return;
		}
		const i = row * this.cols + col;
		const { walkable, cost } = this.settings;
		this.open[i] = walkable === undefined || walkable(col, row) ? 1 : 0;
		this.costs[i] = cost === undefined ? 1 : checkCost(cost(col, row));
	}

	/**
	 * whether a cell is on the grid
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns true if it is
	 */
	contains(col: number, row: number) {
		return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
	}

	/**
	 * whether a cell can be walked on (off the grid, it cannot)
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns true if it can
	 */
	isWalkable(col: number, row: number) {
		return this.contains(col, row) && this.open[row * this.cols + col] === 1;
	}

	/**
	 * open or block a cell: a door, a wall knocked down, a floor fallen away
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @param walkable - false to block it
	 */
	setWalkable(col: number, row: number, walkable = true) {
		if (this.contains(col, row)) {
			this.open[row * this.cols + col] = walkable ? 1 : 0;
		}
	}

	/**
	 * what entering a cell costs
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns its cost, 1 or more
	 */
	getCost(col: number, row: number) {
		return this.contains(col, row) ? this.costs[row * this.cols + col] : 1;
	}

	/**
	 * set what entering the cell costs: 1 or more, a finite number (mud 3,
	 * a road 1). To block it, use {@link Grid#setWalkable}.
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @param cost - 1 or more
	 */
	setCost(col: number, row: number, cost: number) {
		if (this.contains(col, row)) {
			this.costs[row * this.cols + col] = checkCost(cost);
		}
	}

	/**
	 * the cell under a world position
	 * @param x - in world units
	 * @param y - in world units
	 * @returns the cell, or null off the grid
	 */
	cellAt(x: number, y: number): Cell | null {
		const col = Math.floor((x - this.x) / this.tileWidth);
		const row = Math.floor((y - this.y) / this.tileHeight);
		return this.contains(col, row) ? { col, row } : null;
	}

	/**
	 * the centre of a cell
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns the point, in world units
	 */
	cellCenter(col: number, row: number): PathPoint {
		return {
			x: this.x + (col + 0.5) * this.tileWidth,
			y: this.y + (row + 0.5) * this.tileHeight,
		};
	}

	// ---------------------------------------------------------------------
	// search
	// ---------------------------------------------------------------------

	/**
	 * Find the cheapest path from one point to another, with A*.
	 * @param from - where to start, in world units (a cell with `tiles`).
	 * Clamped to the grid; the start may stand on a blocked cell.
	 * @param to - where to go, in world units (a cell with `tiles`).
	 * Clamped to the grid.
	 * @param options - see {@link FindPathOptions}
	 * @returns the path, with whether it reaches the goal
	 */
	findPath(
		from: PathPoint,
		to: PathPoint,
		options: FindPathOptions = {},
	): PathResult {
		const diagonal = options.diagonal === true;
		const tiles = options.tiles === true;
		const maxNodes = options.maxNodes ?? Infinity;
		const closest = options.closest !== false;
		const avoidCost = options.avoidCost ?? Infinity;
		const estimate = this.heuristicOf(options.heuristic, diagonal);
		const trace: Cell[] | undefined = options.trace === true ? [] : undefined;

		const start = this.clampedIndex(from, tiles);
		const goal = this.clampedIndex(to, tiles);
		const cols = this.cols;
		const goalCol = goal % cols;
		const goalRow = (goal - goalCol) / cols;

		// cells to keep away from, for this search only
		const avoided = this.avoided;
		avoided.clear();
		if (options.avoid !== undefined) {
			for (const point of options.avoid) {
				const i = this.clampedIndex(point, tiles);
				if (i !== start && i !== goal) {
					avoided.set(i, avoidCost);
				}
			}
		}

		const stamp = this.nextStamp();
		const { g, f, h, parent, seen, closed, heap, open, costs } = this;
		heap.clear();
		const heuristic = (i: number) => {
			const col = i % cols;
			const row = (i - col) / cols;
			return estimate(Math.abs(col - goalCol), Math.abs(row - goalRow));
		};
		// whether a cell can be stepped on in this search
		const passable = (col: number, row: number) => {
			if (col < 0 || row < 0 || col >= cols || row >= this.rows) {
				return false;
			}
			const i = row * cols + col;
			return open[i] === 1 && avoided.get(i) !== Infinity;
		};

		g[start] = 0;
		h[start] = heuristic(start);
		f[start] = h[start];
		parent[start] = -1;
		seen[start] = stamp;
		heap.push(start);
		let best = start;
		let explored = 0;
		let reached = false;

		while (heap.size > 0) {
			const current = heap.pop();
			if (current === goal) {
				reached = true;
				break;
			}
			if (explored >= maxNodes) {
				break;
			}
			closed[current] = stamp;
			explored++;
			const col = current % cols;
			const row = (current - col) / cols;
			trace?.push({ col, row });
			if (
				h[current] < h[best] ||
				(h[current] === h[best] && g[current] < g[best])
			) {
				best = current;
			}

			for (let d = 0, n = diagonal ? 8 : 4; d < n; d++) {
				const nc = col + DX[d];
				const nr = row + DY[d];
				if (!passable(nc, nr)) {
					continue;
				}
				// a diagonal step never cuts a corner
				if (d >= 4 && !(passable(nc, row) && passable(col, nr))) {
					continue;
				}
				const next = nr * cols + nc;
				if (closed[next] === stamp) {
					continue;
				}
				const step =
					(d >= 4 ? SQRT2 : 1) * (costs[next] + (avoided.get(next) ?? 0));
				const cost = g[current] + step;
				if (seen[next] !== stamp) {
					seen[next] = stamp;
					g[next] = cost;
					h[next] = heuristic(next);
					f[next] = cost + h[next];
					parent[next] = current;
					heap.push(next);
				} else if (cost < g[next]) {
					g[next] = cost;
					f[next] = cost + h[next];
					parent[next] = current;
					heap.decreased(next);
				}
			}
		}

		const end = reached ? goal : closest ? best : -1;
		const path = this.result(reached, end, start, explored, trace, options);
		// the cells avoided were for this search only
		avoided.clear();
		return path;
	}

	private result(
		reached: boolean,
		end: number,
		start: number,
		explored: number,
		trace: Cell[] | undefined,
		options: FindPathOptions,
	) {
		const { g, parent, cols } = this;
		const result: PathResult = {
			found: reached,
			path: [],
			cells: [],
			cost: end === -1 ? 0 : g[end],
			explored,
		};
		if (trace !== undefined) {
			result.trace = trace;
		}
		if (end === -1 || end === start) {
			return result;
		}

		const steps: number[] = [];
		for (let i = end; i !== start; i = parent[i]) {
			steps.push(i);
		}
		steps.reverse();
		const kept = options.smooth === true ? this.smoothed(start, steps) : steps;
		for (const i of kept) {
			const col = i % cols;
			const row = (i - col) / cols;
			result.cells.push({ col, row });
			result.path.push(this.cellCenter(col, row));
		}
		return result;
	}

	/**
	 * Whether a straight line from the centre of one cell to the centre of
	 * another crosses only open cells, never cutting a corner between two
	 * blocked ones.
	 * @param from - one end
	 * @param to - the other end
	 * @param maxCost - only through cells that cost this much or less
	 * @returns true if the line is clear
	 */
	lineOfSight(from: Cell, to: Cell, maxCost = Infinity) {
		return this.clearLine(from.col, from.row, to.col, to.row, maxCost);
	}

	// ---------------------------------------------------------------------
	// internals
	// ---------------------------------------------------------------------

	private heuristicOf(heuristic: Heuristic | undefined, diagonal: boolean) {
		if (typeof heuristic === "function") {
			return heuristic;
		}
		const name = heuristic ?? (diagonal ? "octile" : "manhattan");
		// plain JavaScript can pass any name
		const fn = HEURISTICS[name] as
			| ((dx: number, dy: number) => number)
			| undefined;
		if (fn === undefined) {
			throw new RangeError(`pathfinding: unknown heuristic "${name}"`);
		}
		return fn;
	}

	private clampedIndex(point: PathPoint, tiles: boolean) {
		let col: number;
		let row: number;
		if (tiles) {
			col = Math.round(point.x);
			row = Math.round(point.y);
		} else {
			col = Math.floor((point.x - this.x) / this.tileWidth);
			row = Math.floor((point.y - this.y) / this.tileHeight);
		}
		col = Math.min(this.cols - 1, Math.max(0, col));
		row = Math.min(this.rows - 1, Math.max(0, row));
		return row * this.cols + col;
	}

	private nextStamp() {
		this.stamp++;
		if (this.stamp === 0xffffffff) {
			// wrapped around: start the marks again
			this.seen.fill(0);
			this.closed.fill(0);
			this.stamp = 1;
		}
		return this.stamp;
	}

	/**
	 * Keep only the turning points: from each kept point, go on to the
	 * furthest later step still in a clear line over cells no costlier
	 * than the steps it replaces.
	 * @param start - the start cell's index
	 * @param steps - the path's cell indices, after the start
	 * @returns the cell indices kept
	 */
	private smoothed(start: number, steps: number[]) {
		const cols = this.cols;
		const kept: number[] = [];
		let anchor = start;
		let i = 0;
		while (i < steps.length) {
			let reach = i;
			let maxCost = this.costs[steps[i]];
			for (let j = i + 1; j < steps.length; j++) {
				maxCost = Math.max(maxCost, this.costs[steps[j]]);
				const ac = anchor % cols;
				const bc = steps[j] % cols;
				if (
					!this.clearLine(
						ac,
						(anchor - ac) / cols,
						bc,
						(steps[j] - bc) / cols,
						maxCost,
					)
				) {
					break;
				}
				reach = j;
			}
			kept.push(steps[reach]);
			anchor = steps[reach];
			i = reach + 1;
		}
		return kept;
	}

	/**
	 * a supercover line walk: every cell the segment between two centres
	 * touches must be clear
	 * @param c0 - the first cell's column
	 * @param r0 - the first cell's row
	 * @param c1 - the last cell's column
	 * @param r1 - the last cell's row
	 * @param maxCost - only through cells that cost this much or less
	 * @returns true if the line is clear
	 */
	private clearLine(
		c0: number,
		r0: number,
		c1: number,
		r1: number,
		maxCost: number,
	) {
		const cols = this.cols;
		const clear = (col: number, row: number) => {
			if (!this.contains(col, row)) {
				return false;
			}
			const i = row * cols + col;
			return (
				this.open[i] === 1 &&
				this.avoided.get(i) !== Infinity &&
				this.costs[i] + (this.avoided.get(i) ?? 0) <= maxCost
			);
		};
		const dx = Math.abs(c1 - c0);
		const dy = Math.abs(r1 - r0);
		const sx = c1 > c0 ? 1 : -1;
		const sy = r1 > r0 ? 1 : -1;
		let col = c0;
		let row = r0;
		// the endpoints are where the path already stands
		let error = dx - dy;
		for (let n = dx + dy; n > 0; n--) {
			if (error > 0) {
				col += sx;
				error -= 2 * dy;
			} else if (error < 0) {
				row += sy;
				error += 2 * dx;
			} else {
				// exactly through a corner: both cells beside it must be open
				if (!clear(col + sx, row) || !clear(col, row + sy)) {
					return false;
				}
				col += sx;
				row += sy;
				error += 2 * (dx - dy);
				n--;
			}
			if (!clear(col, row)) {
				return false;
			}
		}
		return true;
	}
}
