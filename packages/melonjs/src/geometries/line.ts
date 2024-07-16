import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { createPool } from "../system/pool.ts";
import { LineVertices, Polygon } from "./polygon.ts";

/**
 * a line segment Object
 * @param {number} x - origin point of the Line
 * @param {number} y - origin point of the Line
 * @param {Vector2d[]} points - array of vectors defining the Line
 */
export class Line extends Polygon {
	/**
	 * Returns true if the Line contains the given point
	 * @param x -  x coordinate or a vector point to check
	 * @param [y] -  y coordinate
	 * @returns true if contains
	 * @example
	 * if (line.contains(10, 10)) {
	 *   // do something
	 * }
	 * // or
	 * if (line.contains(myVector2d)) {
	 *   // do something
	 * }
	 */
	override contains(x: number, y: number): boolean;
	override contains(vector: Vector2d): boolean;
	override contains(xOrVector: Vector2d | number, y?: number) {
		let _x: number;
		let _y: number;

		if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
		} else {
			_x = xOrVector;
			_y = y!;
		}

		// translate the given coordinates,
		// rather than creating temp translated vectors
		_x -= this.pos.x; // Cx
		_y -= this.pos.y; // Cy
		const [start, end] = this.points;

		//(Cy - Ay) * (Bx - Ax) = (By - Ay) * (Cx - Ax)
		return (
			(_y - start.y) * (end.x - start.x) === (end.y - start.y) * (_x - start.x)
		);
	}

	/**
	 * Computes the calculated collision edges and normals.
	 * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
	 * @returns this instance for objecf chaining
	 */
	override recalc() {
		const edges = this.edges;
		const normals = this.normals;
		const indices = this.indices;

		// Copy the original points array and apply the offset/angle
		const points = this.points;

		if (points.length !== 2) {
			throw new Error("Requires exactly 2 points");
		}

		// Calculate the edges/normals
		if (edges[0] === undefined) {
			edges[0] = vector2dPool.get();
		}
		edges[0].copy(points[1]).sub(points[0]);
		if (normals[0] === undefined) {
			normals[0] = vector2dPool.get();
		}
		normals[0].copy(edges[0]).perp().normalize();

		// do not do anything here, indices will be computed by
		// toIndices if array is empty upon function call
		indices.length = 0;

		return this;
	}

	/**
	 * clone this line segment
	 * @returns new Line
	 */
	override clone() {
		return new Line(
			this.pos.x,
			this.pos.y,
			this.points.map((point) => point.clone()) as LineVertices,
		);
	}
}

export const linePool = createPool<
	Line,
	[x: number, y: number, points: LineVertices]
>((x, y, points) => {
	const line = new Line(x, y, points);
	return {
		instance: line,
		reset(x, y, points) {
			line.pos.set(x, y);
			line.setVertices(points);
		},
	};
});
