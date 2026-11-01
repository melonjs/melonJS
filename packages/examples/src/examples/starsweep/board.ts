/**
 * melonJS — Starsweep: tile types and movement rules.
 *
 * Pure logic with no engine import, so `levels.test.ts` can check every
 * level with plain `tsx`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

export const Tile = {
	VOID: 0,
	WALL: 1,
	FLOOR: 2,
	ICE: 3,
	ARROW_UP: 4,
	ARROW_RIGHT: 5,
	ARROW_DOWN: 6,
	ARROW_LEFT: 7,
	CRACK: 8,
	NEST: 9,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir;

export const COLS = 15;
export const ROWS = 11;

const CHARS: Record<string, Tile> = {
	" ": Tile.VOID,
	"#": Tile.WALL,
	".": Tile.FLOOR,
	P: Tile.FLOOR,
	"~": Tile.ICE,
	"^": Tile.ARROW_UP,
	">": Tile.ARROW_RIGHT,
	v: Tile.ARROW_DOWN,
	"<": Tile.ARROW_LEFT,
	"%": Tile.CRACK,
	E: Tile.NEST,
};

export interface ParsedMap {
	tiles: Tile[];
	start: { x: number; y: number };
	nests: { x: number; y: number }[];
}

export const parseMap = (rows: readonly string[]): ParsedMap => {
	if (rows.length !== ROWS) {
		throw new Error(`map has ${rows.length} rows, expected ${ROWS}`);
	}
	const tiles: Tile[] = [];
	let start: { x: number; y: number } | null = null;
	const nests: { x: number; y: number }[] = [];
	rows.forEach((row, y) => {
		if (row.length !== COLS) {
			throw new Error(`row ${y} is ${row.length} wide, expected ${COLS}`);
		}
		for (let x = 0; x < COLS; x++) {
			const ch = row[x];
			const tile = CHARS[ch];
			if (tile === undefined) {
				throw new Error(`unknown map char "${ch}" at ${x},${y}`);
			}
			if (ch === "P") {
				start = { x, y };
			}
			if (tile === Tile.NEST) {
				nests.push({ x, y });
			}
			tiles.push(tile);
		}
	});
	if (!start) {
		throw new Error("map has no start tile (P)");
	}
	if (nests.length === 0) {
		throw new Error("map has no enemy nest (E)");
	}
	return { tiles, start, nests };
};

/** Tiles that count towards clearing the level. */
export const isPaintable = (t: Tile) => t !== Tile.VOID && t !== Tile.WALL;

/** Tiles anyone can stand on. */
export const isSolidGround = (t: Tile) => t !== Tile.VOID && t !== Tile.WALL;

/** Direction a tile pushes you in when you land on it, or -1. */
export const arrowDir = (t: Tile): Dir | -1 =>
	t >= Tile.ARROW_UP && t <= Tile.ARROW_LEFT
		? ((t - Tile.ARROW_UP) as Dir)
		: -1;

/**
 * Where you get carried after landing on `tile` while moving in `dir`.
 * Ice keeps you going, arrows redirect you, anything else lets you stop.
 */
export const forcedDir = (tile: Tile, dir: Dir): Dir | -1 => {
	if (tile === Tile.ICE) {
		return dir;
	}
	return arrowDir(tile);
};

export const inBounds = (x: number, y: number) =>
	x >= 0 && y >= 0 && x < COLS && y < ROWS;

export interface MoveTrace {
	/** every tile entered, in order */
	path: { x: number; y: number }[];
	/** where the move came to rest (last tile of `path` unless it fell) */
	end: { x: number; y: number };
	fell: boolean;
	/** the move never comes to rest (two arrows facing each other, …) */
	loops: boolean;
}

/**
 * Follow one voluntary step from (x, y) in `dir`, including every ice
 * slide and arrow push it sets off. Returns null when the step itself is
 * blocked. Cracks are treated as intact: they only crumble behind you and
 * grow back, so they never change where a move can go.
 */
export const traceMove = (
	tiles: readonly Tile[],
	x: number,
	y: number,
	dir: Dir,
): MoveTrace | null => {
	const at = (cx: number, cy: number) =>
		inBounds(cx, cy) ? tiles[cy * COLS + cx] : Tile.VOID;
	let nx = x + DX[dir];
	let ny = y + DY[dir];
	if (!isSolidGround(at(nx, ny))) {
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
		if (next === Tile.WALL) {
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
