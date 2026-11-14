/**
 * The A* search on a grid built from callbacks: paths, walls, corners,
 * costs, the search limit, the closest-point fallback, blockers for one
 * search, smoothing and changes at run time.
 *
 * Maps are drawn as text: `#` a wall, `~` a cell that costs 5, `.` open.
 */
import { describe, expect, it } from "vitest";
import { type Cell, Grid } from "../src/index.ts";

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
		walkable: (col, row) => {
			return rows[row][col] !== "#";
		},
		cost: (col, row) => {
			return rows[row][col] === "~" ? 5 : 1;
		},
	});
};

const at = (col: number, row: number) => {
	return { x: col, y: row };
};

const cells = (list: Cell[]) => {
	return list
		.map((c) => {
			return `${c.col},${c.row}`;
		})
		.join(" ");
};

describe("A* search", () => {
	it("goes straight across an open grid", () => {
		const g = grid(".....", ".....");
		const r = g.findPath(at(0, 0), at(4, 0), { tiles: true });
		expect(r.found).toBe(true);
		expect(cells(r.cells)).toBe("1,0 2,0 3,0 4,0");
		expect(r.cost).toBe(4);
	});

	it("gives points in world units, the centre of each cell", () => {
		const g = grid("...");
		g.x = 100;
		g.y = 50;
		const r = g.findPath({ x: 101, y: 51 }, { x: 129, y: 59 });
		expect(r.path).toEqual([
			{ x: 115, y: 55 },
			{ x: 125, y: 55 },
		]);
	});

	it("returns an empty path when already there", () => {
		const r = grid("...").findPath(at(1, 0), at(1, 0), { tiles: true });
		expect(r.found).toBe(true);
		expect(r.path).toEqual([]);
	});

	it("goes around a wall", () => {
		const g = grid(
			"...#...", //
			"...#...",
			".......",
		);
		const r = g.findPath(at(0, 0), at(6, 0), { tiles: true });
		expect(r.found).toBe(true);
		for (const c of r.cells) {
			expect(g.isWalkable(c.col, c.row)).toBe(true);
		}
		expect(r.cells.length).toBe(10);
	});

	it("moves diagonally, but never cuts a corner", () => {
		const open = grid("...", "...", "...");
		const diag = open.findPath(at(0, 0), at(2, 2), {
			tiles: true,
			diagonal: true,
		});
		expect(cells(diag.cells)).toBe("1,1 2,2");
		expect(diag.cost).toBeCloseTo(2 * Math.SQRT2);

		// the only way past the corner is round it
		const corner = grid(
			".#", //
			"..",
		);
		const r = corner.findPath(at(0, 0), at(1, 1), {
			tiles: true,
			diagonal: true,
		});
		expect(cells(r.cells)).toBe("0,1 1,1");
	});

	it("goes round a costly cell when that is cheaper", () => {
		const g = grid(
			".~.", //
			"...",
		);
		const r = g.findPath(at(0, 0), at(2, 0), { tiles: true });
		expect(cells(r.cells)).toBe("0,1 1,1 2,1 2,0");
		expect(r.cost).toBe(4);
	});

	it("goes through a costly cell when going round costs more", () => {
		const g = grid(
			".~.", //
			"###",
		);
		const r = g.findPath(at(0, 0), at(2, 0), { tiles: true });
		expect(cells(r.cells)).toBe("1,0 2,0");
		expect(r.cost).toBe(6);
	});

	describe("when the goal cannot be reached", () => {
		const walled = () => {
			return grid(
				"....#..", //
				"....#..",
				"....#..",
			);
		};

		it("leads as near as it can, and says it did not get there", () => {
			const r = walled().findPath(at(0, 1), at(6, 1), { tiles: true });
			expect(r.found).toBe(false);
			expect(r.cells.at(-1)).toEqual({ col: 3, row: 1 });
		});

		it("returns no path with closest: false", () => {
			const r = walled().findPath(at(0, 1), at(6, 1), {
				tiles: true,
				closest: false,
			});
			expect(r.found).toBe(false);
			expect(r.path).toEqual([]);
		});

		it("does the same for a goal on a wall", () => {
			const r = grid("..#").findPath(at(0, 0), at(2, 0), { tiles: true });
			expect(r.found).toBe(false);
			expect(r.cells.at(-1)).toEqual({ col: 1, row: 0 });
		});

		it("stops after maxNodes cells, heading for the goal", () => {
			const g = grid(".".repeat(40));
			const r = g.findPath(at(0, 0), at(39, 0), {
				tiles: true,
				maxNodes: 5,
			});
			expect(r.found).toBe(false);
			expect(r.explored).toBe(5);
			expect(r.cells.at(-1)?.col).toBeGreaterThan(0);
		});
	});

	describe("avoid", () => {
		it("blocks the cells it names, for this search only", () => {
			const g = grid("...", "...");
			const r = g.findPath(at(0, 0), at(2, 0), {
				tiles: true,
				avoid: [at(1, 0)],
			});
			expect(cells(r.cells)).toBe("0,1 1,1 2,1 2,0");
			// the next search does not remember it
			const next = g.findPath(at(0, 0), at(2, 0), { tiles: true });
			expect(cells(next.cells)).toBe("1,0 2,0");
		});

		it("only adds a cost with avoidCost", () => {
			const g = grid("...", "###");
			const r = g.findPath(at(0, 0), at(2, 0), {
				tiles: true,
				avoid: [at(1, 0)],
				avoidCost: 3,
			});
			expect(r.found).toBe(true);
			expect(r.cost).toBe(5);
		});

		it("never avoids the start or the goal", () => {
			const g = grid("...");
			const r = g.findPath(at(0, 0), at(2, 0), {
				tiles: true,
				avoid: [at(0, 0), at(2, 0)],
			});
			expect(r.found).toBe(true);
		});
	});

	describe("smoothing", () => {
		it("keeps only the turning points of a clear line", () => {
			const g = grid(".....", ".....", ".....");
			const r = g.findPath(at(0, 0), at(4, 2), { tiles: true, smooth: true });
			expect(r.found).toBe(true);
			expect(cells(r.cells)).toBe("4,2");
		});

		it("keeps the corners a wall needs", () => {
			const g = grid(
				"..#..", //
				"..#..",
				".....",
			);
			const r = g.findPath(at(0, 0), at(4, 0), { tiles: true, smooth: true });
			for (const c of r.cells) {
				expect(g.isWalkable(c.col, c.row)).toBe(true);
			}
			// each straight leg is clear
			let from = { col: 0, row: 0 };
			for (const c of r.cells) {
				expect(g.lineOfSight(from, c)).toBe(true);
				from = c;
			}
			expect(r.cells.length).toBeLessThan(8);
		});

		it("does not cut through a costly cell the search went round", () => {
			const g = grid(
				"...", //
				".~.",
				"...",
			);
			const r = g.findPath(at(0, 0), at(2, 2), { tiles: true, smooth: true });
			for (const c of r.cells) {
				expect(g.getCost(c.col, c.row)).toBe(1);
			}
			expect(r.cells.length).toBe(2);
		});
	});

	it("lineOfSight never squeezes between two diagonal walls", () => {
		const g = grid(
			".#", //
			"#.",
		);
		expect(g.lineOfSight({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe(false);
	});

	describe("changes at run time", () => {
		it("setWalkable opens and closes a cell", () => {
			const g = grid("...");
			g.setWalkable(1, 0, false);
			expect(g.findPath(at(0, 0), at(2, 0), { tiles: true }).found).toBe(false);
			g.setWalkable(1, 0, true);
			expect(g.findPath(at(0, 0), at(2, 0), { tiles: true }).found).toBe(true);
		});

		it("refresh reads every cell again from the callbacks", () => {
			const walls = new Set<string>();
			const g = new Grid({
				cols: 3,
				rows: 1,
				tileWidth: 1,
				tileHeight: 1,
				walkable: (col) => {
					return !walls.has(`${col}`);
				},
			});
			walls.add("1");
			expect(g.isWalkable(1, 0)).toBe(true);
			g.refresh();
			expect(g.isWalkable(1, 0)).toBe(false);
		});

		it("setCost changes what a cell costs", () => {
			const g = grid("...", "...");
			g.setCost(1, 0, 9);
			const r = g.findPath(at(0, 0), at(2, 0), { tiles: true });
			expect(cells(r.cells)).toBe("0,1 1,1 2,1 2,0");
		});
	});

	it("keeps the cells it looked at with trace", () => {
		const r = grid("....").findPath(at(0, 0), at(3, 0), {
			tiles: true,
			trace: true,
		});
		expect(r.trace?.length).toBe(r.explored);
		expect(r.trace?.[0]).toEqual({ col: 0, row: 0 });
	});

	it("refuses a size, a cost or a heuristic it cannot use", () => {
		expect(() => {
			return new Grid({ cols: 0, rows: 1, tileWidth: 1, tileHeight: 1 });
		}).toThrow(RangeError);
		expect(() => {
			return new Grid({ cols: 1, rows: 1, tileWidth: 0, tileHeight: 1 });
		}).toThrow(RangeError);
		const g = grid("..");
		expect(() => {
			g.setCost(0, 0, 0.5);
		}).toThrow(RangeError);
		expect(() => {
			g.setCost(0, 0, Infinity);
		}).toThrow(RangeError);
		expect(() => {
			// @ts-expect-error: not a heuristic
			g.findPath(at(0, 0), at(1, 0), { tiles: true, heuristic: "nope" });
		}).toThrow(RangeError);
	});

	it("finds the same path cost as a breadth-first search on a maze", () => {
		// a seeded random maze, checked against a plain BFS
		let seed = 7;
		const random = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		const rows: string[] = [];
		for (let r = 0; r < 30; r++) {
			let line = "";
			for (let c = 0; c < 30; c++) {
				line += (r === 0 && c === 0) || random() > 0.3 ? "." : "#";
			}
			rows.push(line);
		}
		const g = grid(...rows);
		const bfs = new Map<string, number>([["0,0", 0]]);
		const queue = [[0, 0]];
		for (let q = 0; q < queue.length; q++) {
			const [c, r] = queue[q];
			for (const [dc, dr] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const k = `${c + dc},${r + dr}`;
				if (g.isWalkable(c + dc, r + dr) && !bfs.has(k)) {
					bfs.set(k, (bfs.get(`${c},${r}`) ?? 0) + 1);
					queue.push([c + dc, r + dr]);
				}
			}
		}
		for (const [key, distance] of bfs) {
			const [c, r] = key.split(",").map(Number);
			const found = g.findPath(at(0, 0), at(c, r), { tiles: true });
			expect(found.found).toBe(true);
			expect(found.cost).toBe(distance);
		}
	});
});
