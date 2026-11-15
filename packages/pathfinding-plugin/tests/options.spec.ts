/**
 * The search's options and edges: every heuristic and diagonal mode checked
 * against a plain shortest-path search on weighted grids, the search cap,
 * points to avoid, smoothing over heavy cells, line of sight, positions off
 * the grid, and what the grid refuses.
 *
 * Maps are drawn as text: `#` a solid cell, `~` a cell that weighs 5, `.`
 * open.
 */
import { Vector2d } from "melonjs";
import { describe, expect, it } from "vitest";
import {
	type DiagonalMode,
	Grid,
	type Heuristic,
	type PathOptions,
} from "../src/index.ts";

const TILE = 10;

/**
 * a grid from rows of text
 * @param rows - one string per row
 * @returns the grid
 */
const grid = (...rows: string[]) => {
	return new Grid({
		cols: rows[0].length,
		rows: rows.length,
		tileWidth: TILE,
		tileHeight: TILE,
		solid: (col, row) => {
			return rows[row][col] === "#";
		},
		weight: (col, row) => {
			return rows[row][col] === "~" ? 5 : 1;
		},
	});
};

const cell = (x: number, y: number) => {
	return { x, y };
};

/**
 * a cell's centre, in world units
 * @param col - the cell's column
 * @param row - the cell's row
 * @returns the point
 */
const at = (col: number, row: number) => {
	return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
};

const text = (list: readonly { x: number; y: number }[]) => {
	return list
		.map((c) => {
			return `${c.x},${c.y}`;
		})
		.join(" ");
};

/**
 * what a path costs, step by step: each step's length (1, or √2 for a
 * diagonal) times the weight of the cell it enters
 * @param g - the grid
 * @param cells - the path's cells
 * @returns its cost
 */
const costOf = (g: Grid, cells: readonly { x: number; y: number }[]) => {
	let cost = 0;
	for (let i = 1; i < cells.length; i++) {
		const diagonal =
			cells[i].x !== cells[i - 1].x && cells[i].y !== cells[i - 1].y;
		cost += (diagonal ? Math.SQRT2 : 1) * g.getWeight(cells[i].x, cells[i].y);
	}
	return cost;
};

/**
 * the cheapest cost from a cell to every other, by a plain Dijkstra search
 * with the grid's moves: a reference written apart from the plugin's
 * @param g - the grid
 * @param mode - the diagonal mode
 * @param start - the start cell
 * @returns the cost of each cell reached, by `col,row`
 */
const dijkstra = (g: Grid, mode: DiagonalMode, start: [number, number]) => {
	const open = (c: number, r: number) => {
		return !g.isSolid(c, r);
	};
	const cost = new Map<string, number>([[start.join(","), 0]]);
	const done = new Set<string>();
	for (;;) {
		let best: string | null = null;
		for (const [key, value] of cost) {
			if (!done.has(key) && (best === null || value < (cost.get(best) ?? 0))) {
				best = key;
			}
		}
		if (best === null) {
			return cost;
		}
		done.add(best);
		const [c, r] = best.split(",").map(Number);
		const base = cost.get(best) ?? 0;
		for (let dc = -1; dc <= 1; dc++) {
			for (let dr = -1; dr <= 1; dr++) {
				if ((dc === 0 && dr === 0) || !open(c + dc, r + dr)) {
					continue;
				}
				const diagonal = dc !== 0 && dr !== 0;
				if (diagonal) {
					const a = open(c + dc, r);
					const b = open(c, r + dr);
					const allowed =
						mode === "always" ||
						(mode === "atLeastOneWalkable" && (a || b)) ||
						(mode === "onlyIfNoObstacles" && a && b);
					if (!allowed) {
						continue;
					}
				}
				const next = `${c + dc},${r + dr}`;
				const step =
					(diagonal ? Math.SQRT2 : 1) * g.getWeight(c + dc, r + dr) + base;
				if (!done.has(next) && step < (cost.get(next) ?? Infinity)) {
					cost.set(next, step);
				}
			}
		}
	}
};

/**
 * a seeded random grid of walls, mud and open cells
 * @param seed - the seed
 * @param size - its width and height
 * @returns the rows, the top left cell open
 */
const randomRows = (seed: number, size: number) => {
	let s = seed;
	const random = () => {
		s = (s * 1103515245 + 12345) % 2147483648;
		return s / 2147483648;
	};
	const rows: string[] = [];
	for (let r = 0; r < size; r++) {
		let line = "";
		for (let c = 0; c < size; c++) {
			const v = random();
			line += r + c === 0 ? "." : v < 0.25 ? "#" : v < 0.45 ? "~" : ".";
		}
		rows.push(line);
	}
	return rows;
};

describe("the search, against a plain shortest-path search", () => {
	const cases: [DiagonalMode, Heuristic[]][] = [
		["never", ["manhattan", "octile", "chebyshev", "euclidean"]],
		["onlyIfNoObstacles", ["octile", "chebyshev", "euclidean"]],
		["atLeastOneWalkable", ["octile", "chebyshev", "euclidean"]],
		[
			"always",
			[
				"octile",
				(dx: number, dy: number) => {
					// a custom estimate: half the octile one, still never over
					return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) / 2;
				},
			],
		],
	];
	for (const [mode, heuristics] of cases) {
		for (const heuristic of heuristics) {
			const name = typeof heuristic === "function" ? "custom" : heuristic;
			it(`finds the cheapest path with ${mode} and ${name}`, () => {
				for (const seed of [3, 11, 29]) {
					const g = grid(...randomRows(seed, 12));
					const reference = dijkstra(g, mode, [0, 0]);
					for (let r = 0; r < 12; r++) {
						for (let c = 0; c < 12; c++) {
							const result = g.findPath(at(0, 0), at(c, r), {
								diagonalMode: mode,
								heuristic,
							});
							const expected = reference.get(`${c},${r}`);
							if (expected === undefined) {
								expect(result.found).toBe(false);
								continue;
							}
							expect(result.found).toBe(true);
							expect(result.cost).toBeCloseTo(expected, 9);
							// the path costs what the search says
							expect(costOf(g, result.cells)).toBeCloseTo(expected, 9);
						}
					}
				}
			});
		}
	}

	it("uses the grid's heuristic, and picks one from the diagonal mode", () => {
		const g = grid(".....", ".....", ".....");
		// manhattan with diagonals overestimates: it can miss the cheapest
		// path, but it still finds one
		g.heuristic = "manhattan";
		g.diagonalMode = "always";
		expect(g.findPath(at(0, 0), at(4, 2)).found).toBe(true);
		g.heuristic = undefined;
		// octile by default with diagonals: two diagonal steps and two straight
		expect(g.findPath(at(0, 0), at(4, 2)).cost).toBeCloseTo(2 * Math.SQRT2 + 2);
		g.diagonalMode = "never";
		expect(g.findPath(at(0, 0), at(4, 2)).cost).toBe(6);
	});
});

describe("maxNodes", () => {
	// a corridor: the goal is 6 cells from the start
	const corridor = () => {
		return grid(".......");
	};

	it("finds the goal when the cap leaves room", () => {
		const r = corridor().findPath(at(0, 0), at(6, 0), { maxNodes: 6 });
		expect(r.found).toBe(true);
		expect(r.explored).toBe(6);
	});

	it("gives up one cell short, with an empty path", () => {
		const r = corridor().findPath(at(0, 0), at(6, 0), { maxNodes: 5 });
		expect(r.found).toBe(false);
		expect(r.path).toEqual([]);
		expect(r.cost).toBe(0);
	});

	it("looks at nothing at 0, and stays where it is with a partial path", () => {
		const r = corridor().findPath(at(0, 0), at(6, 0), {
			maxNodes: 0,
			allowPartialPath: true,
		});
		expect(r.found).toBe(false);
		expect(r.explored).toBe(0);
		expect(text(r.cells)).toBe("0,0");
	});
});

describe("a solid goal", () => {
	it("is not searched for without a partial path", () => {
		const rows = Array.from({ length: 40 }, () => {
			return ".".repeat(40);
		});
		const g = grid(...rows);
		g.setSolid(39, 39);
		const r = g.findPath(at(0, 0), at(39, 39));
		expect(r.found).toBe(false);
		expect(r.explored).toBe(0);
		// with one, the way to the nearest open cell
		const near = g.findPath(at(0, 0), at(39, 39), { allowPartialPath: true });
		const last = near.cells[near.cells.length - 1];
		expect(Math.abs(last.x - 39) + Math.abs(last.y - 39)).toBe(1);
	});

	it("is reached when the start stands on it", () => {
		const g = grid("#..");
		const r = g.findPath(at(0, 0), at(0, 0));
		expect(r.found).toBe(true);
		expect(r.cost).toBe(0);
		expect(r.explored).toBe(0);
		expect(text(r.cells)).toBe("0,0");
	});
});

describe("avoid", () => {
	it("ignores a point off the grid, in world units or in cells", () => {
		const g = grid(".....", ".....", ".....");
		const straight = g.findPath(at(0, 0), at(4, 0));
		const offGrid = g.findPath(at(0, 0), at(4, 0), {
			avoid: [{ x: 25, y: -500 }],
		});
		expect(offGrid.cost).toBe(straight.cost);
		expect(text(offGrid.cells)).toBe(text(straight.cells));
		expect(
			text(g.getIdPath(cell(0, 0), cell(4, 0), { avoid: [cell(2, -50)] })),
		).toBe("0,0 1,0 2,0 3,0 4,0");
	});

	it("weighs an avoided diagonal step by its length", () => {
		const g = grid("...", "...");
		g.diagonalMode = "always";
		// avoiding the straight cell in the way: a diagonal over it, or through
		const r = g.findPath(at(0, 0), at(2, 0), {
			avoid: [at(1, 0)],
			avoidWeight: 0.5,
		});
		// through it costs 1.5 + 1, round it 2√2
		expect(r.cost).toBeCloseTo(2.5);
		const round = g.findPath(at(0, 0), at(2, 0), {
			avoid: [at(1, 0)],
			avoidWeight: 3,
		});
		expect(round.cost).toBeCloseTo(2 * Math.SQRT2);
	});

	it("blocks a diagonal step past an avoided cell, as past a wall", () => {
		const g = grid("..", "..");
		const r = g.findPath(at(0, 0), at(1, 1), {
			diagonalMode: "onlyIfNoObstacles",
			avoid: [at(1, 0)],
		});
		expect(text(r.cells)).toBe("0,0 0,1 1,1");
	});
});

/**
 * whether every line of a smoothed path keeps to light cells (weight 1),
 * but for the cell it ends on, which the path enters either way
 * @param g - the grid
 * @param path - the kept cells
 * @returns true if it does
 */
const keepsToLightCells = (g: Grid, path: readonly Vector2d[]) => {
	for (let i = 1; i < path.length; i++) {
		const { x, y } = path[i];
		const weight = g.getWeight(x, y);
		g.setWeight(x, y, 1);
		const clear = g.lineOfSight(path[i - 1], path[i], 1);
		g.setWeight(x, y, weight);
		if (!clear) {
			return false;
		}
	}
	return true;
};

describe("smoothing", () => {
	it("does not cut through mud next to a heavy goal", () => {
		const g = grid("........", ".~~~~~~~", "........");
		const plain = g.getIdPath(cell(0, 1), cell(7, 1));
		const smooth = g.getIdPath(cell(0, 1), cell(7, 1), { smooth: true });
		// the search goes round the mud, along row 0 or row 2
		const side = plain[1].y;
		expect(side).not.toBe(1);
		// and so does the smoothed path, stepping into the goal from beside it
		expect(text(smooth.slice(-2))).toBe(`7,${side} 7,1`);
		expect(keepsToLightCells(g, smooth)).toBe(true);
	});

	it("does not cut through mud a path passed one heavy cell of", () => {
		const g = grid(".......", "..~~~.~", ".......");
		const smooth = g.getIdPath(cell(0, 1), cell(6, 1), { smooth: true });
		// no line crosses the mud at (2, 1) to (4, 1)
		expect(keepsToLightCells(g, smooth)).toBe(true);
	});

	it("never makes a path longer than the steps it replaces", () => {
		for (const mode of [
			"never",
			"onlyIfNoObstacles",
			"atLeastOneWalkable",
		] as DiagonalMode[]) {
			for (const seed of [5, 17]) {
				const g = grid(...randomRows(seed, 14));
				for (let r = 0; r < 14; r += 3) {
					for (let c = 0; c < 14; c += 3) {
						const options: PathOptions = { diagonalMode: mode };
						const plain = g.findPath(at(0, 0), at(c, r), options);
						const smooth = g.findPath(at(0, 0), at(c, r), {
							...options,
							smooth: true,
						});
						if (!plain.found) {
							continue;
						}
						// as lines: each straight segment, weighed by the
						// heaviest cell it enters, is no costlier than the steps
						let length = 0;
						for (let i = 1; i < smooth.path.length; i++) {
							length += Math.hypot(
								smooth.path[i].x - smooth.path[i - 1].x,
								smooth.path[i].y - smooth.path[i - 1].y,
							);
						}
						let steps = 0;
						for (let i = 1; i < plain.path.length; i++) {
							steps += Math.hypot(
								plain.path[i].x - plain.path[i - 1].x,
								plain.path[i].y - plain.path[i - 1].y,
							);
						}
						expect(length).toBeLessThanOrEqual(steps + 1e-9);
					}
				}
			}
		}
	});
});

describe("lineOfSight", () => {
	it("checks both ends, and what lies between", () => {
		const g = grid("#....", "..#..", ".....");
		expect(g.lineOfSight(cell(0, 0), cell(0, 0))).toBe(false);
		expect(g.lineOfSight(cell(0, 0), cell(4, 0))).toBe(false);
		expect(g.lineOfSight(cell(1, 0), cell(4, 0))).toBe(true);
		// straight through the wall at (2, 1)
		expect(g.lineOfSight(cell(0, 1), cell(4, 1))).toBe(false);
		// a shallow line over the open bottom row
		expect(g.lineOfSight(cell(0, 2), cell(4, 2))).toBe(true);
		// off the grid is solid
		expect(g.lineOfSight(cell(0, 2), cell(9, 2))).toBe(false);
	});

	it("keeps to cells no heavier than maxWeight", () => {
		const g = grid("..~..");
		expect(g.lineOfSight(cell(0, 0), cell(4, 0))).toBe(true);
		expect(g.lineOfSight(cell(0, 0), cell(4, 0), 1)).toBe(false);
		expect(g.lineOfSight(cell(0, 0), cell(4, 0), 5)).toBe(true);
	});
});

describe("positions", () => {
	it("clamps a start and a goal off the grid onto it", () => {
		const g = grid("...", "...");
		const r = g.findPath({ x: -100, y: -100 }, { x: 999, y: 999 });
		expect(text(r.cells)).toBe("0,0 1,0 2,0 2,1");
	});

	it("rounds a fractional cell down, as cellAt does", () => {
		const g = grid(".....");
		expect(text(g.getIdPath(cell(0.5, 0), cell(2.5, 0)))).toBe("0,0 1,0 2,0");
		expect(g.cellAt(25, 5)).toEqual(new Vector2d(2, 0));
	});

	it("refuses a point that is not a number", () => {
		const g = grid("...");
		expect(() => {
			return g.findPath({ x: Number.NaN, y: 0 }, at(2, 0));
		}).toThrow(RangeError);
		expect(() => {
			return g.getIdPath(cell(0, 0), cell(Infinity, 0));
		}).toThrow(RangeError);
	});

	it("puts points at a custom offset, and into a given vector", () => {
		const g = grid("...");
		g.offset.set(0, 0);
		expect(g.findPath(at(0, 0), at(2, 0)).path[2]).toEqual(new Vector2d(20, 0));
		const out = new Vector2d();
		expect(g.getPointPosition(1, 0, out)).toBe(out);
		expect(out).toEqual(new Vector2d(10, 0));
	});
});

describe("what a search refuses", () => {
	it("a negative or missing avoidWeight or maxNodes", () => {
		const g = grid("...");
		for (const options of [
			{ avoid: [at(1, 0)], avoidWeight: -5 },
			{ avoidWeight: Number.NaN },
			{ maxNodes: -1 },
			{ maxNodes: Number.NaN },
		]) {
			expect(() => {
				return g.findPath(at(0, 0), at(2, 0), options);
			}).toThrow(RangeError);
		}
	});
});

describe("cells", () => {
	it("keep the weight they are given", () => {
		const g = grid("...");
		g.setWeight(0, 0, 1.1);
		expect(g.getWeight(0, 0)).toBe(1.1);
	});

	it("go back to their source on refresh and refreshCell", () => {
		const g = grid("..#", "~..");
		g.setSolid(0, 0);
		g.setSolid(2, 0, false);
		g.setWeight(0, 1, 2);
		g.refreshCell(0, 0);
		expect(g.isSolid(0, 0)).toBe(false);
		expect(g.isSolid(2, 0)).toBe(false);
		g.refresh();
		expect(g.isSolid(2, 0)).toBe(true);
		expect(g.getWeight(0, 1)).toBe(5);
		// off the grid: nothing to read
		g.refreshCell(-1, 9);
	});

	it("refuse a weight callback that returns a weight below 1", () => {
		expect(() => {
			return new Grid({
				cols: 2,
				rows: 1,
				tileWidth: 1,
				tileHeight: 1,
				weight: () => {
					return 0.5;
				},
			});
		}).toThrow(RangeError);
	});

	it("clip a region that runs off the grid", () => {
		const g = grid("...", "...");
		g.fillSolidRegion({ x: -2, y: 1, width: 4, height: 9 });
		expect([g.isSolid(0, 1), g.isSolid(1, 1), g.isSolid(2, 1)]).toEqual([
			true,
			true,
			false,
		]);
		expect(g.isSolid(0, 0)).toBe(false);
	});
});

describe("the search marks", () => {
	it("start again when the counter wraps around", () => {
		const g = grid(".....", ".###.", ".....");
		const before = g.findPath(at(0, 1), at(4, 1));
		// just before the wrap
		(g as unknown as { stamp: number }).stamp = 0xfffffffd;
		for (let i = 0; i < 4; i++) {
			const r = g.findPath(at(0, 1), at(4, 1));
			expect(r.cost).toBe(before.cost);
			expect(text(r.cells)).toBe(text(before.cells));
		}
		expect((g as unknown as { stamp: number }).stamp).toBeLessThan(10);
	});
});
