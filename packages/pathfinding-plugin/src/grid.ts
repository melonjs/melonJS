import {
	Container,
	collision,
	math,
	type Renderable,
	type Tile,
	type TMXLayer,
	Vector2d,
} from "melonjs";
import { IndexHeap } from "./heap.ts";

/**
 * When a path may move diagonally:
 * - `"never"`: up, down, left and right only
 * - `"always"`: diagonally too, even between two walls
 * - `"atLeastOneWalkable"`: diagonally past a corner, when one of the two
 *   cells beside the step is open
 * - `"onlyIfNoObstacles"`: diagonally only when both cells beside the step
 *   are open, so a path never cuts a corner
 */
export type DiagonalMode =
	| "never"
	| "always"
	| "atLeastOneWalkable"
	| "onlyIfNoObstacles";

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

/**
 * How cells sit in the world:
 * - `"square"`: side by side in columns and rows, an orthogonal map
 * - `"isometric"`: as diamonds, columns running down to the right and rows
 *   down to the left, a Tiled "isometric" map. The grid's `x` and `y` are
 *   the top left corner of the box around every diamond, the first column's
 *   diamond is at the top, and `tileWidth` and `tileHeight` are a diamond's
 *   width and height.
 *
 * The search is the same for both: only where a cell is in the world
 * differs.
 */
export type CellShape = "square" | "isometric";

/** how a search goes, for {@link Grid#findPath}, {@link Grid#getIdPath} and {@link Grid#getPointPath} */
export interface PathOptions {
	/**
	 * When the goal cannot be reached (blocked, walled off, or past
	 * `maxNodes`), return the path to the cell nearest to it instead of an
	 * empty one.
	 * @default false
	 */
	allowPartialPath?: boolean;
	/**
	 * when the path may move diagonally, for this search
	 * @default the grid's {@link Grid#diagonalMode}
	 */
	diagonalMode?: DiagonalMode;
	/**
	 * the estimate of the distance left, for this search
	 * @default the grid's {@link Grid#heuristic}
	 */
	heuristic?: Heuristic;
	/**
	 * The most cells the search looks at before it gives up, 0 or more, so
	 * a goal that cannot be reached does not stall a frame.
	 * @default Infinity
	 */
	maxNodes?: number;
	/**
	 * Straighten the path: drop the points between two that can see each
	 * other in a straight line over open cells, so an agent heads straight
	 * there instead of stepping tile by tile. The line keeps to cells no
	 * heavier than the ones it replaces, so it never cuts through mud the
	 * search went around.
	 * @default false
	 */
	smooth?: boolean;
	/**
	 * Points to keep away from, for this search only: other agents, a
	 * hazard. In world units for {@link Grid#findPath}, in cells for the
	 * others. The start and the goal are never avoided, nor is a point off
	 * the grid.
	 */
	avoid?: Iterable<Readonly<{ x: number; y: number }>>;
	/**
	 * What entering an avoided cell costs on top of its own weight: 0 or
	 * more, `Infinity` to block it.
	 * @default Infinity
	 */
	avoidWeight?: number;
	/**
	 * Keep the cells the search looked at, in order, in `result.trace`: for
	 * a debug view ({@link Grid#findPath} only).
	 * @default false
	 */
	trace?: boolean;
}

/** what {@link Grid#findPath} found */
export interface PathResult {
	/** whether the path reaches the goal (otherwise it leads as near as it could) */
	found: boolean;
	/**
	 * the points of the path, in world units, from the start to the goal (or
	 * to the nearest cell): each cell's position, see {@link Grid#offset}.
	 * Empty when there is no path.
	 */
	path: Vector2d[];
	/** the same steps, as cells (`x` the column, `y` the row) */
	cells: Vector2d[];
	/** what the path costs: its steps, each weighted by the cell it enters */
	cost: number;
	/** how many cells the search looked at (the goal, once reached, is not counted) */
	explored: number;
	/** the cells the search looked at, in order, with `trace` (the goal is not among them) */
	trace?: Vector2d[];
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
	 * how cells sit in the world
	 * @default "square"
	 */
	cellShape?: CellShape;
	/**
	 * where the grid's top left corner is in the world
	 * @default 0
	 */
	x?: number;
	/** @default 0 */
	y?: number;
	/**
	 * whether a cell is solid (a wall), read for every cell when the grid is
	 * built and on {@link Grid#refresh}
	 * @default no cell is solid
	 */
	solid?: (col: number, row: number) => boolean;
	/**
	 * what entering a cell costs, 1 or more (mud 3, a road 1), read with
	 * `solid`
	 * @default 1
	 */
	weight?: (col: number, row: number) => number;
	/**
	 * called before `solid` and `weight` are read for every cell (when the
	 * grid is built, and on each {@link Grid#refresh}): to gather what they
	 * read, once
	 */
	prepare?: () => void;
}

/** how {@link Grid.fromTileLayer} reads a layer */
export interface TileLayerOptions {
	/**
	 * whether a cell is solid, from the tile in it (null for an empty cell)
	 * @default a cell with a tile is solid, an empty one is open
	 */
	solid?: (tile: Tile | null, col: number, row: number) => boolean;
	/**
	 * what entering a cell costs, 1 or more
	 * @default the tile's `weight` custom property (set in Tiled's tileset
	 * editor), or 1
	 */
	weight?: (tile: Tile | null, col: number, row: number) => number;
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
	 * how cells sit in the world: `"isometric"` for an isometric map
	 * @default "square"
	 */
	cellShape?: CellShape;
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
	weight?: (col: number, row: number) => number;
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

/** a rectangle of cells, `x` and `y` its top left column and row */
export interface CellRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** where cells sit in the world, as a grid or its settings hold it */
interface Layout {
	cellShape?: CellShape | undefined;
	x?: number | undefined;
	y?: number | undefined;
	rows: number;
	tileWidth: number;
	tileHeight: number;
}

/**
 * a point of the grid, in cells (fractions too), to world units. The same
 * projection as the engine's orthogonal and isometric map renderers
 * (`tileToPixelCoords`), which a grid built by hand has none of.
 * @param layout - where the cells are
 * @param col - columns from the grid's corner
 * @param row - rows from the grid's corner
 * @param out - the vector to set
 * @returns `out`, in world units
 */
const cellToWorld = (
	layout: Layout,
	col: number,
	row: number,
	out: Vector2d,
) => {
	const { tileWidth: w, tileHeight: h } = layout;
	const x = layout.x ?? 0;
	const y = layout.y ?? 0;
	return layout.cellShape === "isometric"
		? out.set(
				x + ((layout.rows + col - row) * w) / 2,
				y + ((col + row) * h) / 2,
			)
		: out.set(x + col * w, y + row * h);
};

/**
 * a point in world units to the grid's cells (with fractions): the
 * renderers' `pixelToTileCoords`
 * @param layout - where the cells are
 * @param px - in world units
 * @param py - in world units
 * @param out - the vector to set
 * @returns `out`, `x` in columns and `y` in rows
 */
const worldToCell = (layout: Layout, px: number, py: number, out: Vector2d) => {
	const u = (px - (layout.x ?? 0)) / layout.tileWidth;
	const v = (py - (layout.y ?? 0)) / layout.tileHeight;
	if (layout.cellShape === "isometric") {
		const across = u - layout.rows / 2;
		return out.set(v + across, v - across);
	}
	return out.set(u, v);
};

/** a vector for the conversions above, so the grid's own use allocates nothing */
const scratch = new Vector2d();

/**
 * How far a renderable's shapes sit from its position: its anchor point
 * moves where it is drawn, and its shapes with it (the engine measures
 * collision shapes the same way). Nothing for a renderable that does not
 * apply its anchor, or has no finite size (a container).
 * @param r - the renderable
 * @param out - the vector to set
 * @returns `out`
 */
const anchorOffset = (r: Renderable, out: Vector2d) => {
	const apply = (r as { applyAnchorTransform?: boolean }).applyAnchorTransform;
	if (apply === false) {
		return out.set(0, 0);
	}
	return out.set(
		Number.isFinite(r.width) ? r.width * r.anchorPoint.x : 0,
		Number.isFinite(r.height) ? r.height * r.anchorPoint.y : 0,
	);
};

/**
 * a number option of a search, checked
 * @param name - the option's name
 * @param value - its value
 * @param fallback - when it is not given
 * @returns the value, 0 or more
 */
const nonNegative = (
	name: string,
	value: number | undefined,
	fallback: number,
) => {
	if (value === undefined) {
		return fallback;
	}
	if (!(value >= 0)) {
		throw new RangeError(
			`pathfinding: ${name} must be 0 or more (got ${value})`,
		);
	}
	return value;
};

const CELL_SHAPES: readonly string[] = ["square", "isometric"];

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

const DIAGONAL_MODES: readonly string[] = [
	"never",
	"always",
	"atLeastOneWalkable",
	"onlyIfNoObstacles",
];

const checkWeight = (weight: number) => {
	if (!(weight >= 1) || weight === Infinity) {
		throw new RangeError(
			`pathfinding: a cell's weight must be a finite number of 1 or more (got ${weight}); make a cell impassable with setSolid(col, row)`,
		);
	}
	return weight;
};

/** what one search found, before it is turned into points */
interface Search {
	reached: boolean;
	/** the cell the path ends on, or -1 for no path */
	end: number;
	start: number;
	explored: number;
	trace: number[] | undefined;
	mode: DiagonalMode;
}

/**
 * A grid of cells a path can be found across, with A*.
 *
 * Each cell is open or solid and has a weight (1 or more) to enter. Build
 * one from a Tiled tile layer ({@link Grid.fromTileLayer}), from a level's
 * collision shapes ({@link Grid.fromBodies}), or from your own callbacks;
 * change cells as the game goes on with {@link Grid#setSolid} and
 * {@link Grid#setWeight}, and search it by cell with {@link Grid#getIdPath}
 * and {@link Grid#getPointPath}, or by world position with
 * {@link Grid#findPath}.
 *
 * Cells are `Vector2d`s, `x` the column and `y` the row. Points in world
 * units are each cell's position: its corner plus {@link Grid#offset},
 * which is its centre by default.
 *
 * Cells are square (an orthogonal map) or diamonds (an isometric map), see
 * {@link CellShape}. Staggered and hexagonal maps are not supported.
 * @example
 * const grid = new Grid({ cols: 20, rows: 15, tileWidth: 32, tileHeight: 32 });
 * grid.diagonalMode = "onlyIfNoObstacles";
 * grid.setSolid(5, 3);
 * const cells = grid.getIdPath(new Vector2d(0, 0), new Vector2d(10, 8));
 * const { path, found } = grid.findPath(enemy.pos, player.pos);
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
	/** how cells sit in the world */
	readonly cellShape: CellShape;
	/** where the grid's top left corner is in the world */
	x: number;
	/** where the grid's top left corner is in the world */
	y: number;
	/**
	 * where a cell's position is, from its corner (the top left of a square,
	 * the top of a diamond): the points of a path are cell positions
	 * @default the centre: half a cell across and down for a square, half a
	 * cell down for a diamond
	 */
	offset: Vector2d;
	/**
	 * when a path may move diagonally
	 * @default "never"
	 */
	diagonalMode: DiagonalMode = "never";
	/**
	 * the estimate of the distance left
	 * @default "manhattan" when `diagonalMode` is `"never"`, "octile" otherwise
	 */
	heuristic: Heuristic | undefined = undefined;

	private readonly settings: GridSettings;
	private readonly solid: Uint8Array;
	private readonly weights: Float64Array;

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
		const shape = settings.cellShape ?? "square";
		if (!CELL_SHAPES.includes(shape)) {
			throw new RangeError(`pathfinding: unknown cellShape "${shape}"`);
		}
		this.settings = settings;
		this.cellShape = shape;
		this.cols = settings.cols;
		this.rows = settings.rows;
		this.tileWidth = settings.tileWidth;
		this.tileHeight = settings.tileHeight;
		this.x = settings.x ?? 0;
		this.y = settings.y ?? 0;
		this.offset = new Vector2d(
			shape === "isometric" ? 0 : this.tileWidth / 2,
			this.tileHeight / 2,
		);
		const n = this.cols * this.rows;
		this.solid = new Uint8Array(n);
		this.weights = new Float64Array(n);
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
	 * A grid over a Tiled tile layer: one cell per tile, square on an
	 * orthogonal map and diamonds on an isometric one (staggered and
	 * hexagonal maps throw a `RangeError`). By default a cell
	 * holding a tile is solid and an empty one is open (a layer of walls);
	 * pass `solid` to decide from the tile instead (a tile property, its
	 * id). A tile's `weight` property sets what crossing it costs.
	 *
	 * The layer is read again on {@link Grid#refresh}, so after changing
	 * tiles with `setTile` / `clearTile`, refresh the grid (or just the
	 * changed cell, with {@link Grid#refreshCell}).
	 * @example
	 * const walls = app.world.getChildByName("walls")[0];
	 * const grid = Grid.fromTileLayer(walls);
	 * @example
	 * // a floor layer: solid where the tile is a wall, or missing
	 * const grid = Grid.fromTileLayer(floor, {
	 *     solid: (tile) =>
	 *         tile === null || tile.tileset.getTileProperties(tile.tileId)?.kind === "wall",
	 * });
	 * @param layer - the tile layer, once its level is loaded
	 * @param options - how to read it
	 * @returns a grid with one cell per tile
	 */
	static fromTileLayer(layer: TMXLayer, options: TileLayerOptions = {}) {
		const orientation =
			(layer as { orientation?: string }).orientation ?? "orthogonal";
		if (orientation !== "orthogonal" && orientation !== "isometric") {
			throw new RangeError(
				`pathfinding: a "${orientation}" map is not supported (orthogonal and isometric maps are)`,
			);
		}
		const isometric = orientation === "isometric";
		// the layer draws its tiles where its map's renderer puts them, in
		// its container: find there the corner of its first cell (the top
		// left of a square, the top of a diamond), which on an infinite map
		// is the tile (startx, starty), left of or above the map's origin
		const parent = layer.ancestor as Container | undefined;
		const corner = new Vector2d(0, 0);
		const renderer = layer.getRenderer() as
			| { tileToPixelCoords(x: number, y: number, v: Vector2d): Vector2d }
			| undefined;
		renderer?.tileToPixelCoords(layer.startx, layer.starty, corner);
		if (parent !== undefined) {
			// the container's place in the world
			const at = layer.getAbsolutePosition();
			corner.x += at.x - layer.pos.x;
			corner.y += at.y - layer.pos.y;
		}
		if (isometric) {
			// the grid's corner is the box around its diamonds
			corner.x -= (layer.rows * layer.tilewidth) / 2;
		}
		// the layer's cells are read by the map's tile coordinates
		const cellOf = (col: number, row: number) => {
			// null for an empty cell, whatever its type says
			return layer.cellAt(
				col + layer.startx,
				row + layer.starty,
			) as Tile | null;
		};
		const { solid, weight } = options;
		const props = (tile: Tile | null) => {
			return tile === null
				? undefined
				: (tile.tileset.getTileProperties(tile.tileId) as
						| { weight?: unknown }
						| undefined);
		};
		return new Grid({
			cols: layer.cols,
			rows: layer.rows,
			tileWidth: layer.tilewidth,
			tileHeight: layer.tileheight,
			cellShape: isometric ? "isometric" : "square",
			x: options.x ?? corner.x,
			y: options.y ?? corner.y,
			solid: (col, row) => {
				const tile = cellOf(col, row);
				return solid === undefined ? tile !== null : solid(tile, col, row);
			},
			weight: (col, row) => {
				const tile = cellOf(col, row);
				if (weight !== undefined) {
					return weight(tile, col, row);
				}
				const value = props(tile)?.weight;
				return typeof value === "number" ? value : 1;
			},
		});
	}

	/**
	 * A grid over a level's collision shapes: the walls drawn in a Tiled
	 * map's collision layer, or any static body. A cell is solid when a
	 * wall's shape covers any of nine points spread over it (a wall thinner
	 * than an eighth of a cell can slip between them). Cells are read from
	 * the shapes themselves, from the body or the `bodyDef`, and from each
	 * wall's bounding box when it has none.
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
		// where the cells are: the grid's own once it is built, so a grid
		// moved since scans where it now is
		const built: { grid?: Grid } = {};
		const first: Layout = {
			cellShape: options.cellShape,
			x: x0,
			y: y0,
			rows,
			tileWidth,
			tileHeight,
		};
		const isWall = options.solid ?? isWorldShape;
		const walls = new Uint8Array(cols * rows);
		const anchor = new Vector2d();
		const point = new Vector2d();

		const mark = (wall: Renderable) => {
			const r = wall as unknown as WithBody;
			const shapes = r.body?.shapes ?? r.bodyDef?.shapes;
			// shapes are placed from the renderable's drawn corner
			const at = wall.getAbsolutePosition().sub(anchorOffset(wall, anchor));
			const bounds = wall.getBounds();
			const cells = built.grid ?? first;
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
			// the cells under the area's four corners, and those between
			let c0 = Infinity;
			let r0 = Infinity;
			let c1 = -Infinity;
			let r1 = -Infinity;
			for (const [cx, cy] of [
				[left, top],
				[right, top],
				[left, bottom],
				[right, bottom],
			]) {
				const cell = worldToCell(cells, cx, cy, point);
				c0 = Math.min(c0, Math.floor(cell.x));
				r0 = Math.min(r0, Math.floor(cell.y));
				c1 = Math.max(c1, Math.floor(cell.x));
				r1 = Math.max(r1, Math.floor(cell.y));
			}
			c0 = Math.max(0, c0);
			r0 = Math.max(0, r0);
			c1 = Math.min(cols - 1, c1);
			r1 = Math.min(rows - 1, r1);
			for (let row = r0; row <= r1; row++) {
				for (let col = c0; col <= c1; col++) {
					const i = row * cols + col;
					if (walls[i] === 1) {
						continue;
					}
					for (const fy of SAMPLES) {
						for (const fx of SAMPLES) {
							const { x: px, y: py } = cellToWorld(
								cells,
								col + fx,
								row + fy,
								point,
							);
							const inside =
								shapes === undefined || shapes.length === 0
									? bounds.contains(px, py)
									: shapes.some((shape) => {
											return shape.contains(px - at.x, py - at.y);
										});
							if (inside) {
								walls[i] = 1;
							}
						}
					}
				}
			}
		};
		const visit = (parent: Container) => {
			for (const child of parent.getChildren()) {
				if (isWall(child)) {
					mark(child);
				}
				if (child instanceof Container) {
					visit(child);
				}
			}
		};

		const grid = new Grid({
			cols,
			rows,
			tileWidth,
			tileHeight,
			...(options.cellShape !== undefined
				? { cellShape: options.cellShape }
				: {}),
			x: x0,
			y: y0,
			prepare: () => {
				walls.fill(0);
				visit(container);
			},
			solid: (col, row) => {
				return walls[row * cols + col] === 1;
			},
			...(options.weight !== undefined ? { weight: options.weight } : {}),
		});
		built.grid = grid;
		return grid;
	}

	// ---------------------------------------------------------------------
	// cells
	// ---------------------------------------------------------------------

	/**
	 * Read every cell again from the `solid` and `weight` the grid was built
	 * with: after the map changed in a way the grid did not see. Undoes
	 * {@link Grid#setSolid} and {@link Grid#setWeight}.
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
		if (!this.isInBounds(col, row)) {
			return;
		}
		const i = row * this.cols + col;
		const { solid, weight } = this.settings;
		this.solid[i] = solid !== undefined && solid(col, row) ? 1 : 0;
		this.weights[i] = weight === undefined ? 1 : checkWeight(weight(col, row));
	}

	/**
	 * whether a cell is on the grid
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns true if it is
	 */
	isInBounds(col: number, row: number) {
		return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
	}

	/**
	 * whether a cell is solid (off the grid, it is)
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns true if it is
	 */
	isSolid(col: number, row: number) {
		return (
			!this.isInBounds(col, row) || this.solid[row * this.cols + col] === 1
		);
	}

	/**
	 * make a cell solid or open: a door, a wall knocked down, a floor fallen
	 * away
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @param solid - false to open it
	 */
	setSolid(col: number, row: number, solid = true) {
		if (this.isInBounds(col, row)) {
			this.solid[row * this.cols + col] = solid ? 1 : 0;
		}
	}

	/**
	 * make every cell of a rectangle solid or open
	 * @param region - the cells, `x` and `y` its top left column and row
	 * @param solid - false to open them
	 */
	fillSolidRegion(region: CellRegion, solid = true) {
		this.forRegion(region, (col, row) => {
			this.setSolid(col, row, solid);
		});
	}

	/**
	 * what entering a cell costs
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns its weight, 1 or more
	 */
	getWeight(col: number, row: number) {
		return this.isInBounds(col, row) ? this.weights[row * this.cols + col] : 1;
	}

	/**
	 * set what entering a cell costs: 1 or more, a finite number (mud 3, a
	 * road 1). To block it, use {@link Grid#setSolid}.
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @param weight - 1 or more
	 */
	setWeight(col: number, row: number, weight: number) {
		if (this.isInBounds(col, row)) {
			this.weights[row * this.cols + col] = checkWeight(weight);
		}
	}

	/**
	 * set what entering every cell of a rectangle costs
	 * @param region - the cells, `x` and `y` its top left column and row
	 * @param weight - 1 or more
	 */
	fillWeightRegion(region: CellRegion, weight: number) {
		checkWeight(weight);
		this.forRegion(region, (col, row) => {
			this.setWeight(col, row, weight);
		});
	}

	/**
	 * the cell under a world position
	 * @param x - in world units
	 * @param y - in world units
	 * @returns the cell (`x` the column, `y` the row), or null off the grid
	 */
	cellAt(x: number, y: number) {
		const cell = worldToCell(this, x, y, scratch);
		const col = Math.floor(cell.x);
		const row = Math.floor(cell.y);
		return this.isInBounds(col, row) ? new Vector2d(col, row) : null;
	}

	/**
	 * a cell's position in the world: its corner (the top left of a square,
	 * the top of a diamond) plus {@link Grid#offset}
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @param out - a vector to set instead of a new one, to allocate nothing
	 * @returns the point, in world units
	 */
	getPointPosition(col: number, row: number, out = new Vector2d()) {
		return cellToWorld(this, col, row, out).add(this.offset);
	}

	// ---------------------------------------------------------------------
	// search
	// ---------------------------------------------------------------------

	/**
	 * The cheapest path between two cells, as cells, from the start to the
	 * goal. Empty when there is none, unless `allowPartialPath`.
	 * @param from - the start cell (`x` the column, `y` the row; a fraction
	 * is rounded down). Clamped to the grid.
	 * @param to - the goal cell. Clamped to the grid.
	 * @param options - `allowPartialPath`, or the search's options
	 * @returns the cells, start and goal included
	 */
	getIdPath(
		from: Readonly<{ x: number; y: number }>,
		to: Readonly<{ x: number; y: number }>,
		options: boolean | PathOptions = false,
	) {
		const opts =
			typeof options === "boolean" ? { allowPartialPath: options } : options;
		const search = this.search(
			this.clampedIndex(from, false),
			this.clampedIndex(to, false),
			opts,
			false,
		);
		return this.toCells(this.steps(search, opts));
	}

	/**
	 * The cheapest path between two cells, as points in world units (each
	 * cell's position, see {@link Grid#offset}), from the start to the goal.
	 * Empty when there is none, unless `allowPartialPath`.
	 * @param from - the start cell (`x` the column, `y` the row; a fraction
	 * is rounded down). Clamped to the grid.
	 * @param to - the goal cell. Clamped to the grid.
	 * @param options - `allowPartialPath`, or the search's options
	 * @returns the points, start and goal included
	 */
	getPointPath(
		from: Readonly<{ x: number; y: number }>,
		to: Readonly<{ x: number; y: number }>,
		options: boolean | PathOptions = false,
	) {
		const opts =
			typeof options === "boolean" ? { allowPartialPath: options } : options;
		const search = this.search(
			this.clampedIndex(from, false),
			this.clampedIndex(to, false),
			opts,
			false,
		);
		return this.toPoints(this.steps(search, opts));
	}

	/**
	 * Find the cheapest path between two world positions, with what the
	 * search found: whether it reached the goal, the path as points and as
	 * cells, its cost and how much it looked at.
	 * @param from - where to start, in world units: a renderable's `pos`, a
	 * `Vector2d`, any `{ x, y }`. Clamped to the grid; the start may stand on
	 * a solid cell.
	 * @param to - where to go, in world units. Clamped to the grid.
	 * @param options - see {@link PathOptions}; `avoid` is in world units
	 * @returns the path, with whether it reaches the goal
	 */
	findPath(
		from: Readonly<{ x: number; y: number }>,
		to: Readonly<{ x: number; y: number }>,
		options: PathOptions = {},
	): PathResult {
		const search = this.search(
			this.clampedIndex(from, true),
			this.clampedIndex(to, true),
			options,
			true,
		);
		const steps = this.steps(search, options);
		const result: PathResult = {
			found: search.reached,
			path: this.toPoints(steps),
			cells: this.toCells(steps),
			cost: search.end === -1 ? 0 : this.g[search.end],
			explored: search.explored,
		};
		if (search.trace !== undefined) {
			result.trace = this.toCells(search.trace);
		}
		return result;
	}

	/**
	 * Whether a straight line from the centre of one cell to the centre of
	 * another crosses only open cells, the two ends included, never cutting
	 * a corner between two solid ones.
	 * @param from - one end (`x` the column, `y` the row)
	 * @param to - the other end
	 * @param maxWeight - only through cells this heavy or lighter
	 * @returns true if the line is clear
	 */
	lineOfSight(
		from: Readonly<{ x: number; y: number }>,
		to: Readonly<{ x: number; y: number }>,
		maxWeight = Infinity,
	) {
		return this.clearLine(
			from.x,
			from.y,
			to.x,
			to.y,
			maxWeight,
			"onlyIfNoObstacles",
			true,
		);
	}

	// ---------------------------------------------------------------------
	// internals
	// ---------------------------------------------------------------------

	private forRegion(
		region: CellRegion,
		fn: (col: number, row: number) => void,
	) {
		const c0 = math.clamp(Math.floor(region.x), 0, this.cols);
		const r0 = math.clamp(Math.floor(region.y), 0, this.rows);
		const c1 = math.clamp(Math.floor(region.x + region.width), 0, this.cols);
		const r1 = math.clamp(Math.floor(region.y + region.height), 0, this.rows);
		for (let row = r0; row < r1; row++) {
			for (let col = c0; col < c1; col++) {
				fn(col, row);
			}
		}
	}

	/**
	 * the cell holding a point, in cells or in world units, whole cells
	 * rounded down as {@link Grid#cellAt} does
	 * @param point - the point
	 * @param world - whether it is in world units (or cells)
	 * @returns the cell, in `scratch`
	 */
	private cellOf(point: Readonly<{ x: number; y: number }>, world: boolean) {
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
			throw new RangeError(
				`pathfinding: a point must have a finite x and y (got ${point.x}, ${point.y})`,
			);
		}
		const cell = world
			? worldToCell(this, point.x, point.y, scratch)
			: scratch.set(point.x, point.y);
		return cell.set(Math.floor(cell.x), Math.floor(cell.y));
	}

	/**
	 * the index of the cell holding a start or a goal, moved onto the grid
	 * @param point - the point
	 * @param world - whether it is in world units (or cells)
	 * @returns the cell's index
	 */
	private clampedIndex(
		point: Readonly<{ x: number; y: number }>,
		world: boolean,
	) {
		const cell = this.cellOf(point, world);
		const col = math.clamp(cell.x, 0, this.cols - 1);
		const row = math.clamp(cell.y, 0, this.rows - 1);
		return row * this.cols + col;
	}

	private heuristicOf(heuristic: Heuristic | undefined, mode: DiagonalMode) {
		if (typeof heuristic === "function") {
			return heuristic;
		}
		const name = heuristic ?? (mode === "never" ? "manhattan" : "octile");
		// plain JavaScript can pass any name
		const fn = HEURISTICS[name] as
			| ((dx: number, dy: number) => number)
			| undefined;
		if (fn === undefined) {
			throw new RangeError(`pathfinding: unknown heuristic "${name}"`);
		}
		return fn;
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
	 * what entering a cell costs in the current search, avoidance included
	 * @param i - the cell's index
	 * @returns its weight
	 */
	private costOf(i: number) {
		return this.weights[i] + (this.avoided.get(i) ?? 0);
	}

	/**
	 * whether a cell can be stepped on in the current search
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns true if it can
	 */
	private passable(col: number, row: number) {
		if (!this.isInBounds(col, row)) {
			return false;
		}
		const i = row * this.cols + col;
		return this.solid[i] === 0 && this.avoided.get(i) !== Infinity;
	}

	/**
	 * whether a diagonal step past the two cells beside it is allowed
	 * @param mode - the diagonal mode
	 * @param a - whether one cell beside the step is open
	 * @param b - whether the other is
	 * @returns true if it is
	 */
	private diagonalAllowed(mode: DiagonalMode, a: boolean, b: boolean) {
		switch (mode) {
			case "always":
				return true;
			case "atLeastOneWalkable":
				return a || b;
			default:
				return a && b;
		}
	}

	/**
	 * the A* search itself
	 * @param start - the start cell's index
	 * @param goal - the goal cell's index
	 * @param options - the search's options
	 * @param world - whether `avoid` is in world units (or cells)
	 * @returns what it found
	 */
	private search(
		start: number,
		goal: number,
		options: PathOptions,
		world: boolean,
	): Search {
		const mode = options.diagonalMode ?? this.diagonalMode;
		if (!DIAGONAL_MODES.includes(mode)) {
			throw new RangeError(`pathfinding: unknown diagonalMode "${mode}"`);
		}
		const estimate = this.heuristicOf(
			options.heuristic ?? this.heuristic,
			mode,
		);
		const maxNodes = nonNegative("maxNodes", options.maxNodes, Infinity);
		const avoidWeight = nonNegative(
			"avoidWeight",
			options.avoidWeight,
			Infinity,
		);
		const trace: number[] | undefined = options.trace === true ? [] : undefined;
		const cols = this.cols;
		const goalCol = goal % cols;
		const goalRow = (goal - goalCol) / cols;

		// cells to keep away from, for this search only
		const avoided = this.avoided;
		avoided.clear();
		for (const point of options.avoid ?? []) {
			// a point off the grid keeps nothing away
			const cell = this.cellOf(point, world);
			if (!this.isInBounds(cell.x, cell.y)) {
				continue;
			}
			const i = cell.y * cols + cell.x;
			if (i !== start && i !== goal) {
				avoided.set(i, avoidWeight);
			}
		}

		// a solid goal can never be entered: without a partial path, there
		// is nothing to look for
		if (
			goal !== start &&
			this.solid[goal] === 1 &&
			options.allowPartialPath !== true
		) {
			return {
				reached: false,
				end: -1,
				start,
				explored: 0,
				trace,
				mode,
			};
		}

		const stamp = this.nextStamp();
		const { g, f, h, parent, seen, closed, heap, weights } = this;
		heap.clear();
		const heuristic = (i: number) => {
			const col = i % cols;
			const row = (i - col) / cols;
			return estimate(Math.abs(col - goalCol), Math.abs(row - goalRow));
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
			trace?.push(current);
			if (
				h[current] < h[best] ||
				(h[current] === h[best] && g[current] < g[best])
			) {
				best = current;
			}
			const col = current % cols;
			const row = (current - col) / cols;
			for (let d = 0, n = mode === "never" ? 4 : 8; d < n; d++) {
				const nc = col + DX[d];
				const nr = row + DY[d];
				if (!this.passable(nc, nr)) {
					continue;
				}
				if (
					d >= 4 &&
					!this.diagonalAllowed(
						mode,
						this.passable(nc, row),
						this.passable(col, nr),
					)
				) {
					continue;
				}
				const next = nr * cols + nc;
				if (closed[next] === stamp) {
					continue;
				}
				const step =
					(d >= 4 ? SQRT2 : 1) * (weights[next] + (avoided.get(next) ?? 0));
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

		const end = reached ? goal : options.allowPartialPath === true ? best : -1;
		return { reached, end, start, explored, trace, mode };
	}

	/**
	 * the cells of a search's path, start first, smoothed if asked
	 * @param search - what the search found
	 * @param options - the search's options
	 * @returns the cell indices
	 */
	private steps(search: Search, options: PathOptions) {
		const { end, start } = search;
		const steps: number[] = [];
		if (end !== -1) {
			for (let i = end; i !== -1; i = this.parent[i]) {
				steps.push(i);
				if (i === start) {
					break;
				}
			}
			steps.reverse();
		}
		const kept =
			options.smooth === true && steps.length > 2
				? this.smoothed(steps, search.mode)
				: steps;
		// the cells avoided were for this search only
		this.avoided.clear();
		return kept;
	}

	private toCells(indices: readonly number[]) {
		return indices.map((i) => {
			const col = i % this.cols;
			return new Vector2d(col, (i - col) / this.cols);
		});
	}

	private toPoints(indices: readonly number[]) {
		return indices.map((i) => {
			const col = i % this.cols;
			return this.getPointPosition(col, (i - col) / this.cols);
		});
	}

	/**
	 * Keep only the turning points: from each kept point, go on to the
	 * furthest later step still in a clear line over cells no heavier than
	 * the steps it replaces (the step it ends on is entered either way).
	 * @param steps - the path's cell indices, start first
	 * @param mode - the search's diagonal mode, for corners
	 * @returns the cell indices kept, start first
	 */
	private smoothed(steps: number[], mode: DiagonalMode) {
		const cols = this.cols;
		const kept = [steps[0]];
		let anchor = steps[0];
		let i = 1;
		while (i < steps.length) {
			let reach = i;
			// the heaviest of the steps the line would replace, those before
			// the one it ends on
			let maxWeight = this.costOf(steps[i]);
			for (let j = i + 1; j < steps.length; j++) {
				const ac = anchor % cols;
				const bc = steps[j] % cols;
				if (
					!this.clearLine(
						ac,
						(anchor - ac) / cols,
						bc,
						(steps[j] - bc) / cols,
						maxWeight,
						mode,
						false,
					)
				) {
					break;
				}
				reach = j;
				maxWeight = Math.max(maxWeight, this.costOf(steps[j]));
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
	 * @param maxWeight - only through cells this heavy or lighter
	 * @param mode - how a line may pass the corner between two cells
	 * @param ends - whether the two end cells must be clear too (or are
	 * where a path already goes)
	 * @returns true if the line is clear
	 */
	private clearLine(
		c0: number,
		r0: number,
		c1: number,
		r1: number,
		maxWeight: number,
		mode: DiagonalMode,
		ends: boolean,
	) {
		const cols = this.cols;
		const clear = (col: number, row: number) => {
			if (!this.passable(col, row)) {
				return false;
			}
			// the end of a path's line is entered either way
			return (
				(!ends && col === c1 && row === r1) ||
				this.costOf(row * cols + col) <= maxWeight
			);
		};
		if (ends && !clear(c0, r0)) {
			return false;
		}
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
				// exactly through a corner, as a diagonal step would go
				if (
					!this.diagonalAllowed(
						mode === "never" ? "onlyIfNoObstacles" : mode,
						clear(col + sx, row),
						clear(col, row + sy),
					)
				) {
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
