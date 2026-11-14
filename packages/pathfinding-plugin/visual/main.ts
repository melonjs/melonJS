/**
 * The pathfinding plugin's visual test page, for developers. A 20 x 15 grid
 * to paint walls and mud on, three agents chasing a target, and toggles for
 * each option of the search, with the debug overlay. The "shapes" source
 * builds the grid from static collision bodies instead of painted cells,
 * and "cells: isometric" lays the same grid out as diamonds.
 * `?renderer=canvas|webgl|webgpu` picks the renderer.
 */
import {
	Application,
	collision,
	input,
	Polygon,
	Renderable,
	type Renderer,
	video,
} from "melonjs";
import {
	type CellShape,
	type DiagonalMode,
	Grid,
	PathfindingDebug,
	type PathOptions,
	type PathResult,
} from "../src/index.ts";

const COLS = 20;
const ROWS = 15;
const TILE = 32;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
const SPEED = 110; // px per second
const REPLAN = 250; // ms

const renderers: Record<string, (typeof video)[keyof typeof video]> = {
	canvas: video.CANVAS,
	webgl: video.WEBGL,
	webgpu: video.WEBGPU,
	auto: video.AUTO,
};
const rendererName =
	location.hash.slice(1) ||
	(new URLSearchParams(location.search).get("renderer") ?? "auto");

const app = new Application(WIDTH, HEIGHT, {
	parent: "screen",
	scaleMethod: "fit",
	renderer: renderers[rendererName] ?? video.AUTO,
});
await app.init();

// ---------------------------------------------------------------------------
// the map: painted cells, or collision shapes
// ---------------------------------------------------------------------------

const OPEN = 0;
const WALL = 1;
const MUD = 2;
const cells = new Uint8Array(COLS * ROWS);
// a wall with a gap, and a mud pond
for (let row = 2; row < 13; row++) {
	if (row !== 7) {
		cells[row * COLS + 9] = WALL;
	}
}
for (let row = 9; row < 14; row++) {
	for (let col = 12; col < 17; col++) {
		cells[row * COLS + col] = MUD;
	}
}

/** where the cells are: squares filling the screen, or diamonds across it */
const layouts: Record<
	CellShape,
	{ tileWidth: number; tileHeight: number; x: number; y: number }
> = {
	square: { tileWidth: TILE, tileHeight: TILE, x: 0, y: 0 },
	// 36 x 18 diamonds: a box of 630 x 315, in the middle of the screen
	isometric: {
		tileWidth: 36,
		tileHeight: 18,
		x: (WIDTH - ((COLS + ROWS) * 36) / 2) / 2,
		y: (HEIGHT - ((COLS + ROWS) * 18) / 2) / 2,
	},
};
let cellShape: CellShape = "square";

/**
 * a point of the grid, in cells (fractions too), to world units: for the
 * shapes, which are drawn in cells
 * @param col - columns from the grid's corner
 * @param row - rows from the grid's corner
 * @returns the point
 */
const project = (col: number, row: number) => {
	const { tileWidth: w, tileHeight: h, x, y } = layouts[cellShape];
	return cellShape === "isometric"
		? { x: x + ((ROWS + col - row) * w) / 2, y: y + ((col + row) * h) / 2 }
		: { x: x + col * w, y: y + row * h };
};

const paintedGrid = () => {
	return new Grid({
		cols: COLS,
		rows: ROWS,
		cellShape,
		...layouts[cellShape],
		solid: (col, row) => {
			return cells[row * COLS + col] === WALL;
		},
		weight: (col, row) => {
			return cells[row * COLS + col] === MUD ? 4 : 1;
		},
	});
};

/**
 * a static wall body, as a Tiled collision layer makes
 * @param corners - its outline, in cells
 * @returns the body
 */
const wall = (
	corners: [
		[number, number],
		[number, number],
		[number, number],
		[number, number],
	],
) => {
	const [a, b, c, d] = corners.map(([col, row]) => {
		return project(col, row);
	});
	const shape = new Polygon(0, 0, [a, b, c, d]);
	const r = new Renderable(0, 0, 1, 1) as Renderable & { shape: Polygon };
	r.shape = shape;
	r.anchorPoint.set(0, 0);
	r.bodyDef = {
		type: "static",
		shapes: [shape],
		collisionType: collision.types.WORLD_SHAPE,
	};
	r.alwaysUpdate = true;
	return r;
};
const makeShapes = () => {
	return [
		// a post
		wall([
			[5, 3],
			[6, 3],
			[6, 12],
			[5, 12],
		]),
		// a diagonal slab
		wall([
			[9, 2],
			[10, 2],
			[15, 10],
			[14, 10],
		]),
	];
};
let shapes: ReturnType<typeof wall>[] = [];

let source: "painted" | "shapes" = "painted";
let grid = paintedGrid();

/**
 * build the grid again, from the painted cells or the shapes, in the
 * current cell shape
 * @param next - where the grid comes from
 */
const useSource = (next: "painted" | "shapes") => {
	source = next;
	for (const shape of shapes) {
		app.world.removeChild(shape);
	}
	shapes = next === "shapes" ? makeShapes() : [];
	for (const shape of shapes) {
		app.world.addChild(shape, 1);
	}
	const before = grid;
	grid =
		next === "shapes"
			? Grid.fromBodies(app.world, {
					cols: COLS,
					rows: ROWS,
					cellShape,
					...layouts[cellShape],
				})
			: paintedGrid();
	overlay.grid = grid;
	// keep the agents and the target on the same cells
	for (const point of [target, ...agents.map((agent) => agent.pos)]) {
		const cell = before.cellAt(point.x, point.y) ?? { x: 0, y: 0 };
		const moved = grid.getPointPosition(cell.x, cell.y);
		point.x = moved.x;
		point.y = moved.y;
	}
	for (const agent of agents) {
		agent.result = null;
	}
};

// ---------------------------------------------------------------------------
// the agents and the target
// ---------------------------------------------------------------------------

interface Point {
	x: number;
	y: number;
}

interface Agent {
	pos: Point;
	color: string;
	result: PathResult | null;
	from: Point;
	next: number;
}
const agents: Agent[] = [
	{ pos: { x: 48, y: 48 }, color: "#3cf0c8" },
	{ pos: { x: 48, y: 432 }, color: "#ff5fb8" },
	{ pos: { x: 304, y: 240 }, color: "#b98bff" },
].map((a) => {
	return { ...a, result: null, from: { ...a.pos }, next: 0 };
});
const target: Point = { x: 560, y: 240 };

const options: PathOptions & { avoidOthers: boolean } = {
	allowPartialPath: true,
	smooth: false,
	maxNodes: Infinity,
	trace: true,
	avoidOthers: false,
};

const overlay = new PathfindingDebug(grid);

class Scene extends Renderable {
	private replan = 0;

	private readonly diamond = new Polygon(0, 0, [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	]);

	constructor() {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		this.replan -= dt;
		if (this.replan <= 0) {
			this.replan = REPLAN;
			for (const agent of agents) {
				agent.from = { ...agent.pos };
				agent.result = grid.findPath(agent.pos, target, {
					...options,
					...(options.avoidOthers
						? {
								avoid: agents
									.filter((other) => {
										return other !== agent;
									})
									.map((other) => {
										return other.pos;
									}),
								avoidWeight: 6,
							}
						: {}),
				});
				// the first point is the agent's own cell
				agent.next = 1;
			}
			overlay.paths = agents.map((agent) => {
				return {
					result: agent.result as PathResult,
					from: agent.from,
					color: agent.color,
				};
			});
			report();
		}
		for (const agent of agents) {
			const path = agent.result?.path ?? [];
			let step = (SPEED * dt) / 1000;
			while (step > 0 && agent.next < path.length) {
				const to = path[agent.next];
				const dx = to.x - agent.pos.x;
				const dy = to.y - agent.pos.y;
				const d = Math.hypot(dx, dy);
				// slower through mud
				const cell = grid.cellAt(agent.pos.x, agent.pos.y);
				const slow = cell ? grid.getWeight(cell.x, cell.y) : 1;
				const move = step / slow;
				if (d <= move) {
					agent.pos.x = to.x;
					agent.pos.y = to.y;
					agent.next++;
					step -= d * slow;
				} else {
					agent.pos.x += (dx / d) * move;
					agent.pos.y += (dy / d) * move;
					step = 0;
				}
			}
		}
		return true;
	}

	override draw(r: Renderer) {
		r.setColor("#0b0c18");
		r.fillRect(0, 0, WIDTH, HEIGHT);
		// the cells: floor, then walls and mud a little inside their outline
		const { diamond } = this;
		const cell = (col: number, row: number, inset: number) => {
			const a = project(col + inset, row + inset);
			const b = project(col + 1 - inset, row + inset);
			const c = project(col + 1 - inset, row + 1 - inset);
			const d = project(col + inset, row + 1 - inset);
			diamond.setShape(0, 0, [a, b, c, d]);
			r.fill(diamond);
		};
		r.setColor("#15172a");
		diamond.setShape(0, 0, [
			project(0, 0),
			project(COLS, 0),
			project(COLS, ROWS),
			project(0, ROWS),
		]);
		r.fill(diamond);
		if (source === "painted") {
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					const kind = cells[row * COLS + col];
					if (kind !== OPEN) {
						r.setColor(kind === WALL ? "#5a5f86" : "#5b4126");
						cell(col, row, 0.04);
					}
				}
			}
		} else {
			r.setColor("#8a8fbf");
			r.lineWidth = 2;
			for (const shape of shapes) {
				const p = shape.shape.points;
				for (let i = 0; i < p.length; i++) {
					const a = p[i];
					const b = p[(i + 1) % p.length];
					r.strokeLine(a.x, a.y, b.x, b.y);
				}
			}
		}
		// the target
		r.setColor("#ffd23d");
		r.lineWidth = 3;
		r.strokeLine(target.x - 10, target.y, target.x + 10, target.y);
		r.strokeLine(target.x, target.y - 10, target.x, target.y + 10);
		for (const agent of agents) {
			r.setColor(agent.color);
			r.fillEllipse(agent.pos.x, agent.pos.y, 10, 10);
		}
	}
}

app.world.addChild(new Scene(), 0);
app.world.addChild(overlay, 5);

// ---------------------------------------------------------------------------
// painting and the target
// ---------------------------------------------------------------------------

let tool: "target" | "wall" | "mud" | "erase" = "target";
let painting = false;

const apply = (x: number, y: number) => {
	if (tool === "target") {
		target.x = x;
		target.y = y;
		return;
	}
	const cell = grid.cellAt(x, y);
	if (cell === null) {
		return;
	}
	const kind = tool === "wall" ? WALL : tool === "mud" ? MUD : OPEN;
	if (source === "painted") {
		cells[cell.y * COLS + cell.x] = kind;
		grid.refreshCell(cell.x, cell.y);
	} else {
		// on a grid built from shapes, change the cell itself
		grid.setSolid(cell.x, cell.y, kind === WALL);
		grid.setWeight(cell.x, cell.y, kind === MUD ? 4 : 1);
	}
};

input.registerPointerEvent("pointerdown", app.viewport, (e) => {
	painting = true;
	apply(e.gameWorldX, e.gameWorldY);
});
input.registerPointerEvent("pointermove", app.viewport, (e) => {
	if (painting || tool === "target") {
		apply(e.gameWorldX, e.gameWorldY);
	}
});
input.registerPointerEvent("pointerup", app.viewport, () => {
	painting = false;
});

// ---------------------------------------------------------------------------
// the panel
// ---------------------------------------------------------------------------

const stateEl = document.getElementById("state") as HTMLElement;
const toggles = document.getElementById("toggles") as HTMLElement;

const report = () => {
	stateEl.textContent = agents
		.map((agent, i) => {
			const r = agent.result;
			return r === null
				? `agent ${i + 1}: -`
				: `agent ${i + 1}: ${r.found ? "found" : "partial"}, ${r.path.length} points, cost ${r.cost.toFixed(1)}, explored ${r.explored}`;
		})
		.join("\n");
};

const toggle = (
	label: string,
	get: () => boolean,
	set: (on: boolean) => void,
) => {
	const button = document.createElement("button");
	button.textContent = label;
	const show = () => {
		button.setAttribute("aria-pressed", String(get()));
	};
	button.addEventListener("click", () => {
		set(!get());
		show();
	});
	show();
	toggles.append(button);
};

const select = (
	label: string,
	values: string[],
	set: (value: string) => void,
	initial = values[0],
) => {
	const el = document.createElement("select");
	el.title = label;
	for (const value of values) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = `${label}: ${value}`;
		el.append(option);
	}
	el.value = initial;
	el.addEventListener("change", () => {
		set(el.value);
	});
	toggles.append(el);
};

select("tool", ["target", "wall", "mud", "erase"], (value) => {
	tool = value as typeof tool;
});
select("grid", ["painted", "shapes"], (value) => {
	useSource(value as "painted" | "shapes");
});
select("cells", ["square", "isometric"], (value) => {
	cellShape = value as CellShape;
	useSource(source);
});
select(
	"diagonal",
	["never", "onlyIfNoObstacles", "atLeastOneWalkable", "always"],
	(value) => {
		options.diagonalMode = value as DiagonalMode;
	},
);
toggle(
	"smooth",
	() => {
		return options.smooth === true;
	},
	(on) => {
		options.smooth = on;
	},
);
toggle(
	"avoid each other",
	() => {
		return options.avoidOthers;
	},
	(on) => {
		options.avoidOthers = on;
	},
);
toggle(
	"overlay",
	() => {
		return overlay.ancestor !== undefined;
	},
	(on) => {
		if (on) {
			app.world.addChild(overlay, 5);
		} else {
			app.world.removeChild(overlay, true);
		}
	},
);
select("maxNodes", ["Infinity", "200", "50", "10"], (value) => {
	options.maxNodes = Number(value);
});
select(
	"renderer",
	["auto", "canvas", "webgl", "webgpu"],
	(value) => {
		location.hash = value;
		location.reload();
	},
	rendererName,
);
