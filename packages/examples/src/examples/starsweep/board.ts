/**
 * melonJS — Starsweep: the board's tiles and the rules of movement.
 *
 * Pure logic with no engine import, so the level checker
 * (`check-levels.ts`) runs it with plain Node, on the very maps the game
 * loads.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/** What a board cell holds, as the rules see it. */
export const Tile = {
	/** open space: anything that steps there falls */
	VOID: 0,
	WALL: 1,
	FLOOR: 2,
	/** keeps whoever lands on it sliding the same way */
	ICE: 3,
	/** conveyor pads: push whoever lands on them that way */
	ARROW_UP: 4,
	ARROW_RIGHT: 5,
	ARROW_DOWN: 6,
	ARROW_LEFT: 7,
	/** gives way once Bolt steps off it, then grows back */
	CRACK: 8,
	/** where monsters come out */
	PORTAL: 9,
	/** sticky: monsters avoid it, and wade through it slowly */
	GOO: 10,
	/** a wall until a switch is lit, then a floor */
	GATE: 11,
	GATE_OPEN: 12,
	/** lighting it opens every gate */
	SWITCH: 13,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;
/** the column step of each direction */
export const DX = [0, 1, 0, -1] as const;
/** the row step of each direction */
export const DY = [-1, 0, 1, 0] as const;
/** each direction's name, which is also its action and animation name */
export const DIR_NAMES = ["up", "right", "down", "left"] as const;
/** the direction back the way a step came */
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir;

/**
 * The direction that best matches a move: along the longer of its two
 * axes, so a one-cell step gives its own direction and a diagonal flight
 * the way it mostly goes.
 * @param dx - the move along x
 * @param dy - the move along y
 * @returns the direction
 */
export const dirOf = (dx: number, dy: number): Dir => {
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0 ? 1 : 3;
	}
	return dy > 0 ? 2 : 0;
};

/** the board's width, in cells */
export const COLS = 11;
/** the board's height, in cells */
export const ROWS = 15;

/** a cell, by its column and row */
export interface Cell {
	x: number;
	y: number;
}

/** a cell's index in the board's arrays */
export const idx = (x: number, y: number) => y * COLS + x;
/** the cell at an index of the board's arrays */
export const cellOf = (i: number): Cell => ({
	x: i % COLS,
	y: Math.floor(i / COLS),
});
/** whether a cell is on the board */
export const inBounds = (x: number, y: number) =>
	x >= 0 && y >= 0 && x < COLS && y < ROWS;

/**
 * Each tile `kind` the tileset uses (its `kind` property in Tiled), and the
 * tile it is to the rules. `start` is a floor where Bolt begins.
 */
export const KIND_TILES: Readonly<Record<string, Tile>> = {
	wall: Tile.WALL,
	floor: Tile.FLOOR,
	start: Tile.FLOOR,
	ice: Tile.ICE,
	"arrow-up": Tile.ARROW_UP,
	"arrow-right": Tile.ARROW_RIGHT,
	"arrow-down": Tile.ARROW_DOWN,
	"arrow-left": Tile.ARROW_LEFT,
	crack: Tile.CRACK,
	portal: Tile.PORTAL,
	goo: Tile.GOO,
	gate: Tile.GATE,
	"gate-open": Tile.GATE_OPEN,
	switch: Tile.SWITCH,
};

/** a level's board, as the rules see it */
interface Board {
	/** each cell's tile, row by row (see {@link idx}) */
	tiles: Tile[];
	/** where Bolt begins */
	start: Cell;
	/** where monsters come out */
	portals: Cell[];
}

/**
 * Read a level's board from its cells' tile kinds.
 * @param kinds - each cell's `kind`, row by row, null for open space
 * @returns the board
 * @throws {Error} when the board is not {@link COLS} by {@link ROWS}, uses
 * an unknown kind, or does not have exactly one start and some portals
 */
export const readBoard = (kinds: readonly (string | null)[]): Board => {
	if (kinds.length !== COLS * ROWS) {
		throw new Error(`board has ${kinds.length} cells, expected ${COLS * ROWS}`);
	}
	const tiles: Tile[] = [];
	let start: Cell | null = null;
	const portals: Cell[] = [];
	kinds.forEach((kind, i) => {
		const { x, y } = cellOf(i);
		const tile = kind === null ? Tile.VOID : KIND_TILES[kind];
		if (tile === undefined) {
			throw new Error(`unknown tile kind "${kind}" at ${x},${y}`);
		}
		if (kind === "start") {
			if (start) {
				throw new Error(`more than one start tile, at ${x},${y}`);
			}
			start = { x, y };
		}
		if (tile === Tile.PORTAL) {
			portals.push({ x, y });
		}
		tiles.push(tile);
	});
	if (!start) {
		throw new Error("the board has no start tile");
	}
	if (portals.length === 0) {
		throw new Error("the board has no portal for the monsters");
	}
	return { tiles, start, portals };
};

/** Tiles that count towards clearing the level (a gate, once it opens). */
export const isPaintable = (t: Tile) => t !== Tile.VOID && t !== Tile.WALL;

/** Tiles anyone can stand on. */
export const isSolidGround = (t: Tile) =>
	t !== Tile.VOID && t !== Tile.WALL && t !== Tile.GATE;

/** Tiles that stop a move: walls, and gates still shut. */
export const isBlocking = (t: Tile) => t === Tile.WALL || t === Tile.GATE;

/**
 * Whether a step may go onto a tile. A step the player chose only goes
 * onto ground; a forced one (an ice slide, an arrow's push) goes anywhere
 * but a blocking tile, off the edge included. The game and the level
 * checker both follow this rule.
 * @param t - the tile ahead
 * @param forced - whether the step is forced
 * @returns true if the step may go there
 */
export const canStep = (t: Tile, forced: boolean) =>
	forced ? !isBlocking(t) : isSolidGround(t);

/** The same board with every gate open, as after a switch is lit. */
export const withGatesOpen = (tiles: readonly Tile[]) =>
	tiles.map((t) => (t === Tile.GATE ? Tile.GATE_OPEN : t));

/**
 * Where you get carried after landing on `tile` while moving in `dir`.
 * Ice keeps you going, arrows redirect you, anything else lets you stop.
 * @returns the direction of the forced step, or -1 for none
 */
export const forcedDir = (tile: Tile, dir: Dir): Dir | -1 => {
	if (tile === Tile.ICE) {
		return dir;
	}
	return tile >= Tile.ARROW_UP && tile <= Tile.ARROW_LEFT
		? ((tile - Tile.ARROW_UP) as Dir)
		: -1;
};

/** where one move goes, from {@link traceMove} */
interface MoveTrace {
	/** every tile entered, in order */
	path: Cell[];
	/** where the move came to rest (last tile of `path` unless it fell) */
	end: Cell;
	fell: boolean;
	/** the move never comes to rest (two arrows facing each other, …) */
	loops: boolean;
}

/**
 * Follow one voluntary step from (x, y) in `dir`, including every ice
 * slide and arrow push it sets off. Cracks are treated as intact: they
 * only crumble behind you and grow back, so they never change where a move
 * can go.
 * @returns where it goes, or null when the step itself is blocked
 */
export const traceMove = (
	tiles: readonly Tile[],
	x: number,
	y: number,
	dir: Dir,
): MoveTrace | null => {
	const at = (cx: number, cy: number) =>
		inBounds(cx, cy) ? tiles[idx(cx, cy)] : Tile.VOID;
	let nx = x + DX[dir];
	let ny = y + DY[dir];
	if (!canStep(at(nx, ny), false)) {
		return null;
	}
	const path = [{ x: nx, y: ny }];
	let d: Dir = dir;
	for (let guard = 0; guard < COLS * ROWS * 4; guard++) {
		const f = forcedDir(at(nx, ny), d);
		if (f === -1) {
			return { path, end: { x: nx, y: ny }, fell: false, loops: false };
		}
		const tx = nx + DX[f];
		const ty = ny + DY[f];
		const next = at(tx, ty);
		if (!canStep(next, true)) {
			return { path, end: { x: nx, y: ny }, fell: false, loops: false };
		}
		if (next === Tile.VOID) {
			return { path, end: { x: nx, y: ny }, fell: true, loops: false };
		}
		d = f;
		nx = tx;
		ny = ty;
		path.push({ x: nx, y: ny });
	}
	return { path, end: { x: nx, y: ny }, fell: false, loops: true };
};
