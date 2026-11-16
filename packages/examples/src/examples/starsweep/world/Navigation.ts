/**
 * melonJS — Starsweep: where the monsters can go, with
 * `@melonjs/pathfinding-plugin`.
 *
 * Two grids, one cell per board cell:
 * - **walking**: read from the map's station layer by the plugin
 *   (`Grid.fromTileLayer`), each tile's `kind` deciding: walls, shut gates
 *   and open space are solid, and goo costs more to cross, so monsters go
 *   round it when they can. A tile set or cleared on the layer is seen by
 *   refreshing its cell.
 * - **flying**: for drones, which cross open space too: only walls and
 *   shut gates stop them.
 *
 * A force-field makes cells solid on both for a while, so plans go round
 * it. The routes the monsters plan are drawn on the board with the plugin's
 * debug overlay, `PathfindingDebug`, showing the paths only.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type DebugPath,
	Grid,
	PathfindingDebug,
} from "@melonjs/pathfinding-plugin";
import type { Container } from "melonjs";
import { centreX, centreY, OX, OY, STAND_LIFT, TILE } from "../config/layout";
import { POWER_COLORS } from "../entities/PowerUp";
import {
	type Cell,
	COLS,
	cellOf,
	idx,
	isBlocking,
	isSolidGround,
	ROWS,
} from "../rules/board";
import { drawGlow, type Renderer } from "../utils/draw";
import { kindOf, type Station } from "./Station";

/** what crossing goo costs a monster's search: it goes round when it can */
const GOO_COST = 4;
/** a force-field starts to fade this many seconds before it goes */
const FIELD_FADE = 1.5;

/** The grids the monsters plan across, the force-fields, and their routes. */
export class Navigation {
	/** where monsters walk */
	walk: Grid | null = null;
	/** where drones fly: anywhere but walls and shut gates */
	fly: Grid | null = null;

	/** force-field cells, and the seconds each has left */
	private readonly fields = new Map<number, number>();
	/** the plugin's debug overlay, showing the monsters' routes */
	private readonly routes: PathfindingDebug;

	/**
	 * @param layer - where the routes are drawn, under the characters
	 */
	constructor(private readonly layer: Container) {
		// any grid will do until the first level is built
		this.routes = new PathfindingDebug(
			new Grid({ cols: COLS, rows: ROWS, tileWidth: TILE, tileHeight: TILE }),
		);
		this.routes.showSolid = false;
		this.routes.showWeight = false;
		this.routes.showTrace = false;
		this.routes.isPersistent = true;
	}

	/** build both grids for a freshly loaded level */
	build(station: Station) {
		const layer = station.layers?.station;
		if (!layer) {
			return;
		}
		this.walk = Grid.fromTileLayer(layer, {
			solid: (tile) => {
				const kind = kindOf(tile);
				return kind === undefined || kind === "wall" || kind === "gate";
			},
			weight: (tile) => {
				return kindOf(tile) === "goo" ? GOO_COST : 1;
			},
		});
		this.fly = new Grid({
			cols: COLS,
			rows: ROWS,
			tileWidth: TILE,
			tileHeight: TILE,
			x: OX,
			y: OY,
			solid: (col, row) => {
				return isBlocking(station.tiles[idx(col, row)]);
			},
		});
		this.routes.grid = this.walk;
		this.fields.clear();
	}

	/** a cell changed on the map: read it again, keeping any force-field */
	refreshCell(cell: Cell) {
		this.walk?.refreshCell(cell.x, cell.y);
		this.fly?.refreshCell(cell.x, cell.y);
		if (this.fields.has(idx(cell.x, cell.y))) {
			this.walk?.setSolid(cell.x, cell.y);
			this.fly?.setSolid(cell.x, cell.y);
		}
	}

	/** keep walkers off a cell until it is refreshed (a crack giving way) */
	keepOff(cell: Cell) {
		this.walk?.setSolid(cell.x, cell.y);
	}

	/** whether a force-field stands on a cell */
	hasField(x: number, y: number) {
		return this.fields.has(idx(x, y));
	}

	/** the seconds the longest-lasting force-field has left, 0 for none */
	get fieldTimeLeft() {
		return Math.max(0, ...this.fields.values());
	}

	/**
	 * Raise a force-field on every open cell around one that no monster is
	 * on: monsters cannot plan through them, so their plans go round. Bolt
	 * can cross them.
	 * @param at - the cell in the middle (where Bolt is)
	 * @param station - the board, for which cells are open
	 * @param taken - the cells monsters are on
	 * @param seconds - how long they stand
	 */
	raiseFieldsAround(
		at: Cell,
		station: Station,
		taken: readonly Cell[],
		seconds: number,
	) {
		const occupied = new Set(taken.map((c) => idx(c.x, c.y)));
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const x = at.x + dx;
				const y = at.y + dy;
				if (
					(dx !== 0 || dy !== 0) &&
					isSolidGround(station.ground(x, y)) &&
					!occupied.has(idx(x, y))
				) {
					this.fields.set(idx(x, y), seconds);
					this.walk?.setSolid(x, y);
					this.fly?.setSolid(x, y);
				}
			}
		}
	}

	/** count the force-fields down; a cell is read again when one goes */
	update(dt: number) {
		for (const [i, left] of this.fields) {
			if (left - dt <= 0) {
				this.fields.delete(i);
				this.refreshCell(cellOf(i));
			} else {
				this.fields.set(i, left - dt);
			}
		}
	}

	/**
	 * Draw the monsters' routes, or stop drawing them.
	 * @param paths - each route and where it starts, or null to hide them
	 */
	showRoutes(paths: DebugPath[] | null) {
		if (paths === null) {
			if (this.routes.ancestor) {
				this.layer.removeChild(this.routes, true);
			}
			return;
		}
		if (!this.routes.ancestor) {
			this.layer.addChild(this.routes, -1);
		}
		this.routes.paths = paths;
	}

	/** whether the routes are on screen */
	get showingRoutes() {
		return this.routes.ancestor !== undefined;
	}

	/** a pulsing barrier on each force-field cell, fading as it runs out */
	drawFields(r: Renderer, time: number) {
		const color = POWER_COLORS.field;
		for (const [i, left] of this.fields) {
			const { x, y } = cellOf(i);
			const px = centreX(x) - TILE / 2;
			const py = centreY(y) - TILE / 2;
			const fade = Math.min(1, left / FIELD_FADE);
			const pulse = 0.55 + 0.25 * Math.sin(time * 9 + i);
			drawGlow(r, centreX(x), centreY(y) - STAND_LIFT, 30, color, fade);
			r.setGlobalAlpha(pulse * fade);
			r.setColor(color);
			r.lineWidth = 3;
			r.strokeRoundRect(px + 5, py + 3, TILE - 10, TILE - 14, 8);
			r.setGlobalAlpha(1);
		}
	}
}
