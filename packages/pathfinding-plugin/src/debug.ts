import { type CanvasRenderer, Renderable, type WebGLRenderer } from "melonjs";
import type { Grid, PathResult } from "./grid.ts";

/** a path for {@link PathfindingDebug} to draw */
export interface DebugPath {
	/** what a search returned */
	result: PathResult;
	/** where the path starts, in world units: it is drawn from there */
	from?: { x: number; y: number };
	/** @default "#ffd23d" */
	color?: string;
}

/**
 * A debug view of a {@link Grid}: blocked cells, costly cells, the cells a
 * search looked at (with `trace: true`) and the paths it found. Add it to the
 * world over the level while working on movement.
 * @example
 * const overlay = new PathfindingDebug(grid);
 * app.world.addChild(overlay, 100);
 * const result = grid.findPath(a, b, { trace: true });
 * overlay.paths = [{ result, from: a }];
 */
export class PathfindingDebug extends Renderable {
	/** the grid shown */
	grid: Grid;
	/** the paths drawn, each with the cells its search looked at */
	paths: DebugPath[] = [];
	/**
	 * draw blocked cells
	 * @default true
	 */
	showBlocked = true;
	/**
	 * draw cells that cost more than 1, darker the costlier
	 * @default true
	 */
	showCost = true;
	/**
	 * draw the cells each search looked at, when it kept them
	 * @default true
	 */
	showTrace = true;

	constructor(grid: Grid) {
		super(
			grid.x,
			grid.y,
			grid.cols * grid.tileWidth,
			grid.rows * grid.tileHeight,
		);
		this.anchorPoint.set(0, 0);
		this.grid = grid;
		this.alwaysUpdate = true;
	}

	override update() {
		// follow the grid if it moved
		const { grid } = this;
		if (this.pos.x !== grid.x || this.pos.y !== grid.y) {
			this.pos.set(grid.x, grid.y);
		}
		return true;
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		const { grid } = this;
		const w = grid.tileWidth;
		const h = grid.tileHeight;
		const cellX = (col: number) => {
			return grid.x + col * w;
		};
		const cellY = (row: number) => {
			return grid.y + row * h;
		};

		if (this.showTrace) {
			renderer.setGlobalAlpha(0.18);
			renderer.setColor("#3fa9ff");
			for (const { result } of this.paths) {
				for (const cell of result.trace ?? []) {
					renderer.fillRect(cellX(cell.col), cellY(cell.row), w, h);
				}
			}
		}

		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.cols; col++) {
				if (this.showBlocked && !grid.isWalkable(col, row)) {
					renderer.setGlobalAlpha(0.35);
					renderer.setColor("#ff3b5c");
					renderer.fillRect(cellX(col), cellY(row), w, h);
				} else if (this.showCost) {
					const cost = grid.getCost(col, row);
					if (cost > 1) {
						renderer.setGlobalAlpha(Math.min(0.6, 0.12 * cost));
						renderer.setColor("#ff9f1a");
						renderer.fillRect(cellX(col), cellY(row), w, h);
					}
				}
			}
		}

		renderer.setGlobalAlpha(1);
		renderer.lineWidth = 3;
		for (const { result, from, color } of this.paths) {
			renderer.setColor(color ?? "#ffd23d");
			let last = from;
			for (const point of result.path) {
				if (last !== undefined) {
					renderer.strokeLine(last.x, last.y, point.x, point.y);
				}
				renderer.fillEllipse(point.x, point.y, 3, 3);
				last = point;
			}
		}
		renderer.setGlobalAlpha(1);
	}
}
