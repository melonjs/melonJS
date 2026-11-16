/**
 * melonJS — Starsweep: checks that every level can be cleared.
 *
 * Run `pnpm check:starsweep` in `packages/examples` after editing a level in
 * Tiled. It reads the very `.tmj` files the game loads, prints `ok` or
 * `FAIL` for each level, and exits non-zero if any level is broken.
 *
 * For each map it walks every place the player can come to rest, following
 * the same ice, arrow and gate rules as the game (`traceMove` and
 * `canStep` in `board.ts`), and checks:
 * - every paintable tile is passed over by some move,
 * - no move goes round forever,
 * - every resting spot has at least one move that does not fall off,
 * - with gates, a switch can be reached while they are still shut (the rest
 *   is then checked with them open).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/// <reference types="node" />
import { readFileSync } from "node:fs";
import {
	type Cell,
	COLS,
	type Dir,
	idx,
	isPaintable,
	ROWS,
	readBoard,
	Tile,
	traceMove,
	withGatesOpen,
} from "./board.ts";
import {
	LEVEL_FILES,
	type LevelDef,
	levelFromTiled,
	TILESET_FILE,
} from "./levels.ts";

const DIR = new URL(
	"../../../../public/assets/starsweep/levels/",
	import.meta.url,
);
const readJson = (name: string) =>
	JSON.parse(readFileSync(new URL(name, DIR), "utf8"));

/**
 * Every tile some move passes over, from the start, and the problems met
 * on the way.
 * @param tiles - the board
 * @param start - where Bolt begins
 * @param errors - where problems are added
 * @returns the indices of every tile passed over
 */
const explore = (tiles: readonly Tile[], start: Cell, errors: string[]) => {
	const touched = new Set<number>([idx(start.x, start.y)]);
	const rested = new Set<number>([idx(start.x, start.y)]);
	const queue = [start];
	for (let q = 0; q < queue.length; q++) {
		const at = queue[q];
		let safeMoves = 0;
		for (const dir of [0, 1, 2, 3] as Dir[]) {
			const move = traceMove(tiles, at.x, at.y, dir);
			if (!move) {
				continue;
			}
			if (move.loops) {
				errors.push(`move ${dir} from ${at.x},${at.y} never stops`);
				continue;
			}
			for (const p of move.path) {
				touched.add(idx(p.x, p.y));
			}
			if (move.fell) {
				continue;
			}
			safeMoves++;
			const k = idx(move.end.x, move.end.y);
			if (!rested.has(k)) {
				rested.add(k);
				queue.push(move.end);
			}
		}
		if (safeMoves === 0) {
			errors.push(`stuck at ${at.x},${at.y}: every move falls off`);
		}
	}
	return touched;
};

/**
 * Check one level.
 * @param level - the level
 * @returns its problems, none when it can be cleared
 */
const checkLevel = (level: LevelDef) => {
	const errors: string[] = [];
	let board: ReturnType<typeof readBoard>;
	try {
		board = readBoard(level.kinds, level.start, level.portals);
	} catch (e) {
		return [(e as Error).message];
	}
	let tiles = board.tiles;
	if (tiles.includes(Tile.GATE)) {
		const shut = explore(tiles, board.start, errors);
		const switches = tiles
			.map((t, i) => (t === Tile.SWITCH ? i : -1))
			.filter((i) => i !== -1);
		if (!switches.some((i) => shut.has(i))) {
			errors.push("gates, but no switch can be reached while they are shut");
		}
		tiles = withGatesOpen(tiles);
	}
	const touched = explore(tiles, board.start, errors);
	for (let y = 0; y < ROWS; y++) {
		for (let x = 0; x < COLS; x++) {
			if (isPaintable(tiles[idx(x, y)]) && !touched.has(idx(x, y))) {
				errors.push(`tile ${x},${y} can never be reached`);
			}
		}
	}
	return errors;
};

const tileset = readJson(`${TILESET_FILE}.tsj`);
let failed = false;
LEVEL_FILES.forEach((file, i) => {
	let level: LevelDef;
	try {
		level = levelFromTiled(readJson(`${file}.tmj`), tileset, file);
	} catch (e) {
		failed = true;
		console.error(`FAIL ${(e as Error).message}`);
		return;
	}
	const label = `level ${i + 1} "${level.name}"`;
	const errors = checkLevel(level);
	if (errors.length > 0) {
		failed = true;
		console.error(`FAIL ${label}`);
		for (const e of errors) {
			console.error(`  - ${e}`);
		}
	} else {
		console.log(`ok   ${label}`);
	}
});

if (failed) {
	process.exit(1);
}
