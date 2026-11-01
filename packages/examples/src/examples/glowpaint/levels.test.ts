/**
 * melonJS — Glowpaint: checks that every level can be cleared.
 *
 * Run with `npx tsx src/examples/glowpaint/levels.test.ts` from
 * `packages/examples`. Exits non-zero on the first broken level.
 *
 * For each map it walks every place the player can come to rest, following
 * the same ice and arrow rules as the game (`traceMove`), and checks:
 * - every paintable tile is passed over by some move,
 * - no move goes round forever,
 * - every resting spot has at least one move that does not fall off.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	COLS,
	type Dir,
	isPaintable,
	parseMap,
	ROWS,
	traceMove,
} from "./board.ts";
import { LEVELS } from "./levels.ts";

let failed = false;

for (const [i, level] of LEVELS.entries()) {
	const label = `level ${i + 1} "${level.name}"`;
	const errors: string[] = [];
	const { tiles, start } = parseMap(level.map);
	const key = (x: number, y: number) => y * COLS + x;

	const touched = new Set<number>([key(start.x, start.y)]);
	const rested = new Set<number>([key(start.x, start.y)]);
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
				touched.add(key(p.x, p.y));
			}
			if (move.fell) {
				continue;
			}
			safeMoves++;
			const k = key(move.end.x, move.end.y);
			if (!rested.has(k)) {
				rested.add(k);
				queue.push(move.end);
			}
		}
		if (safeMoves === 0) {
			errors.push(`stuck at ${at.x},${at.y}: every move falls off`);
		}
	}

	for (let y = 0; y < ROWS; y++) {
		for (let x = 0; x < COLS; x++) {
			if (isPaintable(tiles[key(x, y)]) && !touched.has(key(x, y))) {
				errors.push(`tile ${x},${y} can never be reached`);
			}
		}
	}

	if (errors.length > 0) {
		failed = true;
		console.error(`FAIL ${label}`);
		for (const e of errors) {
			console.error(`  - ${e}`);
		}
	} else {
		console.log(`ok   ${label}`);
	}
}

if (failed) {
	process.exit(1);
}
