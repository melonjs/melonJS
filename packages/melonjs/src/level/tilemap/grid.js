/**
 * Cover the cells of a grid that pass a test with as few rectangles as a
 * simple sweep gives: each row's runs of cells, a run joined to the one right
 * above it when both span the same columns. A wall of a thousand solid tiles
 * becomes one rectangle rather than a thousand, which is what a physics world
 * wants for the static bodies of a level, and no cell is covered twice.
 * @category Tilemap
 * @param {number} cols - the grid's width, in cells
 * @param {number} rows - the grid's height, in cells
 * @param {(col: number, row: number) => boolean} test - true for a cell to cover
 * @returns {{x: number, y: number, width: number, height: number}[]} the rectangles, in cells
 * @example
 * // one static body per run of solid tiles of a layer
 * const { tilewidth, tileheight } = layer;
 * for (const r of me.mergeGridRects(layer.cols, layer.rows, (c, r) => layer.cellAt(c, r) !== null)) {
 *     const wall = new me.Renderable(r.x * tilewidth, r.y * tileheight, r.width * tilewidth, r.height * tileheight);
 *     wall.anchorPoint.set(0, 0);
 *     wall.bodyDef = {
 *         type: "static",
 *         shapes: [new me.Rect(0, 0, wall.width, wall.height)],
 *         collisionType: me.collision.types.WORLD_SHAPE,
 *     };
 *     app.world.addChild(wall);
 * }
 */
export function mergeGridRects(cols, rows, test) {
	const rects = [];
	// the rectangles still growing down, by the column they start at
	let open = new Map();
	for (let row = 0; row < rows; row++) {
		const next = new Map();
		let col = 0;
		while (col < cols) {
			if (!test(col, row)) {
				col++;
				continue;
			}
			const start = col;
			while (col < cols && test(col, row)) {
				col++;
			}
			const width = col - start;
			const above = open.get(start);
			if (above !== undefined && above.width === width) {
				// the same columns as the run above: one rectangle, a row taller
				above.height++;
				next.set(start, above);
			} else {
				const rect = { x: start, y: row, width, height: 1 };
				rects.push(rect);
				next.set(start, rect);
			}
		}
		open = next;
	}
	return rects;
}
