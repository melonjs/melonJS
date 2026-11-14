/**
 * The A* search on a grid built from callbacks: paths, walls, the diagonal
 * modes, weights, the search limit, partial paths, points to avoid for one
 * search, smoothing, region fills and changes at run time.
 *
 * Maps are drawn as text: `#` a solid cell, `~` a cell that weighs 5, `.`
 * open.
 */
import type { Vector2d } from "melonjs";
import { describe, expect, it } from "vitest";
import { Grid, type PathOptions } from "../src/index.ts";

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

const text = (list: readonly Vector2d[]) => {
	return list
		.map((c) => {
			return `${c.x},${c.y}`;
		})
		.join(" ");
};

/**
 * the cells of a path between two cells, as text
 * @param g - the grid
 * @param from - the start cell
 * @param to - the goal cell
 * @param options - the search's options
 * @returns the cells, `col,row` each
 */
const route = (
	g: Grid,
	from: [number, number],
	to: [number, number],
	options: boolean | PathOptions = false,
) => {
	return text(g.getIdPath(cell(...from), cell(...to), options));
};

describe("A* search", () => {
	describe("getIdPath and getPointPath", () => {
		it("go straight across an open grid, start and goal included", () => {
			const g = grid(".....", ".....");
			expect(route(g, [0, 0], [4, 0])).toBe("0,0 1,0 2,0 3,0 4,0");
		});

		it("give points at each cell's offset, its centre by default", () => {
			const g = grid("...");
			g.x = 100;
			g.y = 50;
			const points = g.getPointPath(cell(0, 0), cell(2, 0));
			expect(points.map((p) => [p.x, p.y])).toEqual([
				[105, 55],
				[115, 55],
				[125, 55],
			]);
			g.offset.set(0, 0);
			expect(g.getPointPath(cell(0, 0), cell(1, 0))[1].x).toBe(110);
		});

		it("return the start alone when already there", () => {
			expect(route(grid("..."), [1, 0], [1, 0])).toBe("1,0");
		});

		it("return no path, or a partial one, when the goal cannot be reached", () => {
			const g = grid(
				"....#..", //
				"....#..",
			);
			expect(route(g, [0, 1], [6, 1])).toBe("");
			expect(route(g, [0, 1], [6, 1], true)).toBe("0,1 1,1 2,1 3,1");
		});
	});

	it("goes around a wall", () => {
		const g = grid(
			"...#...", //
			"...#...",
			".......",
		);
		const cells = g.getIdPath(cell(0, 0), cell(6, 0));
		for (const c of cells) {
			expect(g.isSolid(c.x, c.y)).toBe(false);
		}
		expect(cells.length).toBe(11);
	});

	describe("diagonal modes", () => {
		// a wall diagonal: (1,0) and (0,1) solid, so (0,0) to (1,1) squeezes
		// between them
		const squeeze = () => {
			return grid(
				".#.", //
				"#..",
				"...",
			);
		};
		// one wall beside the step: (1,0) solid, (0,1) open
		const corner = () => {
			return grid(
				".#", //
				"..",
			);
		};

		it("never moves diagonally by default", () => {
			const g = grid("...", "...", "...");
			expect(route(g, [0, 0], [2, 2]).split(" ").length).toBe(5);
		});

		it("goes straight across an open grid diagonally", () => {
			const g = grid("...", "...", "...");
			g.diagonalMode = "onlyIfNoObstacles";
			const r = g.findPath(at(0, 0), at(2, 2));
			expect(text(r.cells)).toBe("0,0 1,1 2,2");
			expect(r.cost).toBeCloseTo(2 * Math.SQRT2);
		});

		it("onlyIfNoObstacles never cuts a corner", () => {
			const g = corner();
			g.diagonalMode = "onlyIfNoObstacles";
			expect(route(g, [0, 0], [1, 1])).toBe("0,0 0,1 1,1");
		});

		it("atLeastOneWalkable cuts a corner, but never squeezes between two walls", () => {
			const g = corner();
			g.diagonalMode = "atLeastOneWalkable";
			expect(route(g, [0, 0], [1, 1])).toBe("0,0 1,1");
			const s = squeeze();
			s.diagonalMode = "atLeastOneWalkable";
			expect(route(s, [0, 0], [1, 1])).toBe("");
		});

		it("always squeezes between two walls", () => {
			const s = squeeze();
			s.diagonalMode = "always";
			expect(route(s, [0, 0], [1, 1])).toBe("0,0 1,1");
		});

		it("can be set for one search", () => {
			const g = corner();
			expect(
				route(g, [0, 0], [1, 1], { diagonalMode: "atLeastOneWalkable" }),
			).toBe("0,0 1,1");
		});
	});

	it("goes round a heavy cell when that is cheaper", () => {
		const g = grid(
			".~.", //
			"...",
		);
		const r = g.findPath(at(0, 0), at(2, 0));
		expect(text(r.cells)).toBe("0,0 0,1 1,1 2,1 2,0");
		expect(r.cost).toBe(4);
	});

	it("goes through a heavy cell when going round costs more", () => {
		const g = grid(
			".~.", //
			"###",
		);
		const r = g.findPath(at(0, 0), at(2, 0));
		expect(text(r.cells)).toBe("0,0 1,0 2,0");
		expect(r.cost).toBe(6);
	});

	describe("findPath, when the goal cannot be reached", () => {
		const walled = () => {
			return grid(
				"....#..", //
				"....#..",
				"....#..",
			);
		};

		it("returns no path, and says so", () => {
			const r = walled().findPath(at(0, 1), at(6, 1));
			expect(r.found).toBe(false);
			expect(r.path).toEqual([]);
		});

		it("leads as near as it can with allowPartialPath", () => {
			const r = walled().findPath(at(0, 1), at(6, 1), {
				allowPartialPath: true,
			});
			expect(r.found).toBe(false);
			expect(text(r.cells.slice(-1))).toBe("3,1");
		});

		it("does the same for a goal on a wall", () => {
			const r = grid("..#").findPath(at(0, 0), at(2, 0), {
				allowPartialPath: true,
			});
			expect(r.found).toBe(false);
			expect(text(r.cells.slice(-1))).toBe("1,0");
		});

		it("stops after maxNodes cells, heading for the goal", () => {
			const g = grid(".".repeat(40));
			const r = g.findPath(at(0, 0), at(39, 0), {
				maxNodes: 5,
				allowPartialPath: true,
			});
			expect(r.found).toBe(false);
			expect(r.explored).toBe(5);
			expect(r.cells.length).toBeGreaterThan(1);
		});
	});

	describe("avoid", () => {
		it("blocks the cells it names, for this search only", () => {
			const g = grid("...", "...");
			const r = g.findPath(at(0, 0), at(2, 0), { avoid: [at(1, 0)] });
			expect(text(r.cells)).toBe("0,0 0,1 1,1 2,1 2,0");
			// the next search does not remember it
			expect(route(g, [0, 0], [2, 0])).toBe("0,0 1,0 2,0");
		});

		it("takes cells with getIdPath", () => {
			const g = grid("...", "...");
			expect(route(g, [0, 0], [2, 0], { avoid: [cell(1, 0)] })).toBe(
				"0,0 0,1 1,1 2,1 2,0",
			);
		});

		it("only adds a weight with avoidWeight", () => {
			const g = grid("...", "###");
			const r = g.findPath(at(0, 0), at(2, 0), {
				avoid: [at(1, 0)],
				avoidWeight: 3,
			});
			expect(r.found).toBe(true);
			expect(r.cost).toBe(5);
		});

		it("never avoids the start or the goal", () => {
			const g = grid("...");
			const r = g.findPath(at(0, 0), at(2, 0), { avoid: [at(0, 0), at(2, 0)] });
			expect(r.found).toBe(true);
		});
	});

	describe("smoothing", () => {
		it("keeps only the start and the goal of a clear line", () => {
			const g = grid(".....", ".....", ".....");
			expect(route(g, [0, 0], [4, 2], { smooth: true })).toBe("0,0 4,2");
		});

		it("keeps the corners a wall needs", () => {
			const g = grid(
				"..#..", //
				"..#..",
				".....",
			);
			const cells = g.getIdPath(cell(0, 0), cell(4, 0), { smooth: true });
			for (let i = 1; i < cells.length; i++) {
				expect(g.lineOfSight(cells[i - 1], cells[i])).toBe(true);
			}
			expect(cells.length).toBeLessThan(9);
		});

		it("does not cut through a heavy cell the search went round", () => {
			const g = grid(
				"...", //
				".~.",
				"...",
			);
			const cells = g.getIdPath(cell(0, 0), cell(2, 2), { smooth: true });
			for (const c of cells) {
				expect(g.getWeight(c.x, c.y)).toBe(1);
			}
			expect(cells.length).toBe(3);
		});
	});

	it("lineOfSight never squeezes between two diagonal walls", () => {
		const g = grid(
			".#", //
			"#.",
		);
		expect(g.lineOfSight(cell(0, 0), cell(1, 1))).toBe(false);
	});

	describe("changes at run time", () => {
		it("setSolid closes and opens a cell", () => {
			const g = grid("...");
			g.setSolid(1, 0);
			expect(g.isSolid(1, 0)).toBe(true);
			expect(route(g, [0, 0], [2, 0])).toBe("");
			g.setSolid(1, 0, false);
			expect(route(g, [0, 0], [2, 0])).toBe("0,0 1,0 2,0");
		});

		it("fillSolidRegion and fillWeightRegion change a rectangle of cells", () => {
			const g = grid("....", "....", "....");
			g.fillSolidRegion({ x: 1, y: 0, width: 2, height: 2 });
			expect(g.isSolid(1, 0) && g.isSolid(2, 1)).toBe(true);
			expect(g.isSolid(3, 0) || g.isSolid(1, 2)).toBe(false);
			g.fillWeightRegion({ x: 0, y: 2, width: 4, height: 1 }, 3);
			expect(g.getWeight(2, 2)).toBe(3);
			expect(g.getWeight(0, 0)).toBe(1);
		});

		it("refresh reads every cell again from the callbacks", () => {
			const walls = new Set<number>();
			const g = new Grid({
				cols: 3,
				rows: 1,
				tileWidth: 1,
				tileHeight: 1,
				solid: (col) => {
					return walls.has(col);
				},
			});
			walls.add(1);
			expect(g.isSolid(1, 0)).toBe(false);
			g.refresh();
			expect(g.isSolid(1, 0)).toBe(true);
		});

		it("setWeight changes what a cell costs", () => {
			const g = grid("...", "...");
			g.setWeight(1, 0, 9);
			expect(route(g, [0, 0], [2, 0])).toBe("0,0 0,1 1,1 2,1 2,0");
		});
	});

	it("knows its bounds and where its cells are", () => {
		const g = grid("...", "...");
		g.x = 20;
		expect(g.isInBounds(2, 1)).toBe(true);
		expect(g.isInBounds(3, 0)).toBe(false);
		expect(g.isSolid(-1, 0)).toBe(true);
		expect(g.cellAt(45, 15)?.x).toBe(2);
		expect(g.cellAt(5, 5)).toBe(null);
		const p = g.getPointPosition(1, 1);
		expect([p.x, p.y]).toEqual([35, 15]);
	});

	it("keeps the cells it looked at with trace", () => {
		const r = grid("....").findPath(at(0, 0), at(3, 0), { trace: true });
		expect(r.trace?.length).toBe(r.explored);
		expect(text(r.trace?.slice(0, 1) ?? [])).toBe("0,0");
	});

	it("refuses a size, a weight, a heuristic or a diagonal mode it cannot use", () => {
		expect(() => {
			return new Grid({ cols: 0, rows: 1, tileWidth: 1, tileHeight: 1 });
		}).toThrow(RangeError);
		expect(() => {
			return new Grid({ cols: 1, rows: 1, tileWidth: 0, tileHeight: 1 });
		}).toThrow(RangeError);
		const g = grid("..");
		expect(() => {
			g.setWeight(0, 0, 0.5);
		}).toThrow(RangeError);
		expect(() => {
			g.setWeight(0, 0, Infinity);
		}).toThrow(RangeError);
		expect(() => {
			// @ts-expect-error: not a heuristic
			g.getIdPath(cell(0, 0), cell(1, 0), { heuristic: "nope" });
		}).toThrow(RangeError);
		expect(() => {
			// @ts-expect-error: not a diagonal mode
			g.getIdPath(cell(0, 0), cell(1, 0), { diagonalMode: "sometimes" });
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
				if (!g.isSolid(c + dc, r + dr) && !bfs.has(k)) {
					bfs.set(k, (bfs.get(`${c},${r}`) ?? 0) + 1);
					queue.push([c + dc, r + dr]);
				}
			}
		}
		for (const [key, distance] of bfs) {
			const [c, r] = key.split(",").map(Number);
			const found = g.findPath(at(0, 0), at(c, r));
			expect(found.found).toBe(true);
			expect(found.cost).toBe(distance);
		}
	});
});
