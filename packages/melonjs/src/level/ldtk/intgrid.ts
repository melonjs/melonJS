import { mergeGridRects } from "../tilemap/grid.js";
import type { LDtkIntGridValueDef, LDtkLayerInstance } from "./types.ts";

/** a rectangle of cells holding one value, in pixels */
export interface IntGridRect {
	x: number;
	y: number;
	width: number;
	height: number;
	/** the value every cell of the rectangle holds */
	value: number;
}

/**
 * The values of an IntGrid layer of a level: a whole number per cell, 0 for an
 * empty one, as painted in LDtk. What a game reads its walls, ladders, water
 * and spawn areas from.
 * @category Tilemap
 */
export class IntGrid {
	/** the layer's identifier in LDtk */
	readonly name: string;
	/** the grid's width, in cells */
	readonly cols: number;
	/** the grid's height, in cells */
	readonly rows: number;
	/** the size of a cell, in pixels */
	readonly cellSize: number;
	/** where the grid's top left corner is, in the container the level was added to */
	readonly x: number;
	/** where the grid's top left corner is, in the container the level was added to */
	readonly y: number;
	/** the values, row by row */
	readonly values: Int32Array;
	/** the name given to each value in LDtk, for the values that have one */
	readonly names: Map<number, string>;
	/** the color given to each value in LDtk, as `#rrggbb` */
	readonly colors: Map<number, string>;

	/**
	 * @param layer - the layer, as LDtk saves it
	 * @param defs - the layer's values, from its definition
	 * @param x - where the layer's top left corner is
	 * @param y - where the layer's top left corner is
	 */
	constructor(
		layer: LDtkLayerInstance,
		defs: LDtkIntGridValueDef[],
		x: number,
		y: number,
	) {
		this.name = layer.__identifier;
		this.cols = layer.__cWid;
		this.rows = layer.__cHei;
		this.cellSize = layer.__gridSize;
		this.x = x;
		this.y = y;
		this.values = Int32Array.from(layer.intGridCsv);
		this.names = new Map();
		this.colors = new Map();
		for (const def of defs) {
			if (def.identifier !== null && def.identifier !== "") {
				this.names.set(def.value, def.identifier);
			}
			this.colors.set(def.value, def.color);
		}
	}

	/**
	 * the value of a cell
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns its value; 0 for an empty cell and outside the grid
	 */
	valueAt(col: number, row: number): number {
		if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
			return 0;
		}
		return this.values[row * this.cols + col];
	}

	/**
	 * the value at a point of the container the level was added to
	 * @param x - the point
	 * @param y - the point
	 * @returns the value of the cell there; 0 for an empty cell and outside the grid
	 */
	valueAtPixel(x: number, y: number): number {
		return this.valueAt(
			Math.floor((x - this.x) / this.cellSize),
			Math.floor((y - this.y) / this.cellSize),
		);
	}

	/**
	 * the name of a cell's value, as given in LDtk
	 * @param col - the cell's column
	 * @param row - the cell's row
	 * @returns the name, or undefined for an empty cell or a value with no name
	 */
	nameAt(col: number, row: number): string | undefined {
		return this.names.get(this.valueAt(col, row));
	}

	/**
	 * Cover the cells holding the values asked for with few rectangles, each
	 * of one value: a wall of a thousand cells is one rectangle.
	 * @param test - true for a value to cover; by default every value but 0
	 * @returns the rectangles, in pixels of the container the level was added to
	 */
	rects(
		test: (value: number) => boolean = (value) => {
			return value !== 0;
		},
	): IntGridRect[] {
		const wanted = new Set<number>();
		for (const value of this.values) {
			if (value !== 0 && !wanted.has(value) && test(value)) {
				wanted.add(value);
			}
		}
		const size = this.cellSize;
		const rects: IntGridRect[] = [];
		for (const value of wanted) {
			const cells = mergeGridRects(this.cols, this.rows, (col, row) => {
				return this.values[row * this.cols + col] === value;
			});
			for (const cell of cells) {
				rects.push({
					x: this.x + cell.x * size,
					y: this.y + cell.y * size,
					width: cell.width * size,
					height: cell.height * size,
					value,
				});
			}
		}
		return rects;
	}
}
