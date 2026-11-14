/**
 * The pathfinding plugin's visual test page, for developers. A 20 x 15 grid
 * to paint walls and mud on, three agents chasing a target, and toggles for
 * each option of the search, with the debug overlay. The "shapes" source
 * builds the grid from static collision bodies instead of painted cells.
 * `?renderer=canvas|webgl|webgpu` picks the renderer.
 */
import {
	Application,
	collision,
	input,
	Polygon,
	Rect,
	Renderable,
	type Renderer,
	video,
} from "melonjs";
import {
	type FindPathOptions,
	Grid,
	PathfindingDebug,
	type PathPoint,
	type PathResult,
} from "../src/index.ts";

const COLS = 20;
const ROWS = 15;
const TILE = 32;
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

const app = new Application(COLS * TILE, ROWS * TILE, {
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

const paintedGrid = () => {
	return new Grid({
		cols: COLS,
		rows: ROWS,
		tileWidth: TILE,
		tileHeight: TILE,
		walkable: (col, row) => {
			return cells[row * COLS + col] !== WALL;
		},
		cost: (col, row) => {
			return cells[row * COLS + col] === MUD ? 4 : 1;
		},
	});
};

/** a static wall body, as a Tiled collision layer makes */
const wall = (x: number, y: number, shape: Polygon | Rect) => {
	const r = new Renderable(x, y, 1, 1) as Renderable & {
		shape: Polygon | Rect;
	};
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
const shapes = [
	wall(5 * TILE, 3 * TILE, new Rect(0, 0, TILE, 9 * TILE)),
	// a diagonal slab
	wall(
		9 * TILE,
		2 * TILE,
		new Polygon(0, 0, [
			{ x: 0, y: 0 },
			{ x: TILE, y: 0 },
			{ x: 6 * TILE, y: 8 * TILE },
			{ x: 5 * TILE, y: 8 * TILE },
		]),
	),
];

let source: "painted" | "shapes" = "painted";
let grid = paintedGrid();

const useSource = (next: "painted" | "shapes") => {
	source = next;
	for (const shape of shapes) {
		if (next === "shapes" && !shape.ancestor) {
			app.world.addChild(shape, 1);
		} else if (next === "painted" && shape.ancestor) {
			app.world.removeChild(shape);
		}
	}
	grid =
		next === "shapes"
			? Grid.fromBodies(app.world, {
					cols: COLS,
					rows: ROWS,
					tileWidth: TILE,
					tileHeight: TILE,
				})
			: paintedGrid();
	overlay.grid = grid;
};

// ---------------------------------------------------------------------------
// the agents and the target
// ---------------------------------------------------------------------------

interface Agent {
	pos: PathPoint;
	color: string;
	result: PathResult | null;
	from: PathPoint;
	next: number;
}
const agents: Agent[] = [
	{ pos: { x: 48, y: 48 }, color: "#3cf0c8" },
	{ pos: { x: 48, y: 432 }, color: "#ff5fb8" },
	{ pos: { x: 304, y: 240 }, color: "#b98bff" },
].map((a) => {
	return { ...a, result: null, from: { ...a.pos }, next: 0 };
});
const target: PathPoint = { x: 560, y: 240 };

const options: FindPathOptions & { avoidOthers: boolean } = {
	diagonal: false,
	smooth: false,
	maxNodes: Infinity,
	trace: true,
	avoidOthers: false,
};

const overlay = new PathfindingDebug(grid);

class Scene extends Renderable {
	private replan = 0;

	constructor() {
		super(0, 0, COLS * TILE, ROWS * TILE);
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
								avoidCost: 6,
							}
						: {}),
				});
				agent.next = 0;
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
				const slow = cell ? grid.getCost(cell.col, cell.row) : 1;
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
		r.setColor("#15172a");
		r.fillRect(0, 0, COLS * TILE, ROWS * TILE);
		if (source === "painted") {
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					const kind = cells[row * COLS + col];
					if (kind !== OPEN) {
						r.setColor(kind === WALL ? "#5a5f86" : "#5b4126");
						r.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2);
					}
				}
			}
		} else {
			r.setColor("#8a8fbf");
			r.lineWidth = 2;
			for (const shape of shapes) {
				const def = shape.shape;
				if (def instanceof Rect) {
					r.strokeRect(shape.pos.x, shape.pos.y, def.width, def.height);
				} else if (def instanceof Polygon) {
					const p = def.points;
					for (let i = 0; i < p.length; i++) {
						const a = p[i];
						const b = p[(i + 1) % p.length];
						r.strokeLine(
							shape.pos.x + a.x,
							shape.pos.y + a.y,
							shape.pos.x + b.x,
							shape.pos.y + b.y,
						);
					}
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
		cells[cell.row * COLS + cell.col] = kind;
		grid.refreshCell(cell.col, cell.row);
	} else {
		// on a grid built from shapes, change the cell itself
		grid.setWalkable(cell.col, cell.row, kind !== WALL);
		grid.setCost(cell.col, cell.row, kind === MUD ? 4 : 1);
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
				: `agent ${i + 1}: ${r.found ? "found" : "closest"}, ${r.path.length} points, cost ${r.cost.toFixed(1)}, explored ${r.explored}`;
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
toggle(
	"diagonal",
	() => {
		return options.diagonal === true;
	},
	(on) => {
		options.diagonal = on;
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
