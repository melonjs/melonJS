import {
	type CanvasRenderer,
	Polygon,
	Renderable,
	type WebGLRenderer,
} from "melonjs";
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
 * A debug view of a {@link Grid}: solid cells, heavy cells, the cells a
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
	 * draw solid cells
	 * @default true
	 */
	showSolid = true;
	/**
	 * draw cells that weigh more than 1, darker the heavier
	 * @default true
	 */
	showWeight = true;
	/**
	 * draw the cells each search looked at, when it kept them
	 * @default true
	 */
	showTrace = true;

	/** a diamond, moved to each cell drawn on an isometric grid */
	private readonly diamond = new Polygon(0, 0, [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	]);
	private diamondOf: Grid | null = null;

	constructor(grid: Grid) {
		super(grid.x, grid.y, 1, 1);
		this.anchorPoint.set(0, 0);
		this.grid = grid;
		this.alwaysUpdate = true;
		this.fit();
	}

	/** cover the grid: its box, and its place */
	private fit() {
		const { grid } = this;
		const across =
			grid.cellShape === "isometric" ? (grid.cols + grid.rows) / 2 : 0;
		const width =
			across > 0 ? across * grid.tileWidth : grid.cols * grid.tileWidth;
		const height =
			across > 0 ? across * grid.tileHeight : grid.rows * grid.tileHeight;
		if (this.width !== width || this.height !== height) {
			this.resize(width, height);
		}
		if (this.pos.x !== grid.x || this.pos.y !== grid.y) {
			this.pos.set(grid.x, grid.y);
		}
	}

	override update() {
		// follow the grid if it moved, or was swapped for another
		this.fit();
		return true;
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		const { grid, diamond } = this;
		const w = grid.tileWidth;
		const h = grid.tileHeight;
		const isometric = grid.cellShape === "isometric";
		if (isometric && this.diamondOf !== grid) {
			this.diamondOf = grid;
			diamond.setShape(0, 0, [
				{ x: 0, y: 0 },
				{ x: w / 2, y: h / 2 },
				{ x: 0, y: h },
				{ x: -w / 2, y: h / 2 },
			]);
		}
		const fillCell = (col: number, row: number) => {
			// the corner: the top left of a square, the top of a diamond
			const corner = grid.getPointPosition(col, row).sub(grid.offset);
			if (isometric) {
				diamond.pos.set(corner.x, corner.y);
				renderer.fillPolygon(diamond);
			} else {
				renderer.fillRect(corner.x, corner.y, w, h);
			}
		};

		if (this.showTrace) {
			renderer.setGlobalAlpha(0.18);
			renderer.setColor("#3fa9ff");
			for (const { result } of this.paths) {
				for (const cell of result.trace ?? []) {
					fillCell(cell.x, cell.y);
				}
			}
		}

		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.cols; col++) {
				if (this.showSolid && grid.isSolid(col, row)) {
					renderer.setGlobalAlpha(0.35);
					renderer.setColor("#ff3b5c");
					fillCell(col, row);
				} else if (this.showWeight) {
					const weight = grid.getWeight(col, row);
					if (weight > 1) {
						renderer.setGlobalAlpha(Math.min(0.6, 0.12 * weight));
						renderer.setColor("#ff9f1a");
						fillCell(col, row);
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
