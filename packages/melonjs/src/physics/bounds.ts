import { Vector2d } from "../math/vector2d.ts";
import { Point, pointPool } from "../geometries/point.ts";
import { createPool } from "../system/pool.ts";
import { Matrix2d } from "../math/matrix2d.ts";
import { polygonPool } from "../geometries/polygon.ts";
import { XYPoint } from "../utils/types.ts";

/**
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 */
export class Bounds {
	_center: Vector2d;
	type: "Bounds";
	min: XYPoint;
	max: XYPoint;

	/**
	 * Constructs a Bounds object with optional vertices.
	 * @param [vertices] - An array of Vector2d or Point to initialize the bounds.
	 */
	constructor(vertices?: Vector2d[] | Point[] | XYPoint[] | undefined) {
		this._center = new Vector2d();
		this.type = "Bounds";
		this.min = { x: Infinity, y: Infinity };
		this.max = { x: -Infinity, y: -Infinity };
		if (vertices) {
			this.update(vertices);
		}
	}

	/**
	 * Resets the bounds to its initial state.
	 */
	clear() {
		this.setMinMax(Infinity, Infinity, -Infinity, -Infinity);
	}

	/**
	 * Sets the bounds to the given minimum and maximum values.
	 * @param minX - The minimum x value.
	 * @param minY - The minimum y value.
	 * @param maxX - The maximum x value.
	 * @param maxY - The maximum y value.
	 */
	setMinMax(minX: number, minY: number, maxX: number, maxY: number) {
		this.min.x = minX;
		this.min.y = minY;

		this.max.x = maxX;
		this.max.y = maxY;
	}

	/**
	 * Gets the x position of the bounds.
	 * @returns The x position.
	 */
	get x() {
		return this.min.x;
	}

	/**
	 * Sets the x position of the bounds.
	 * @param value - The new x position.
	 */
	set x(value) {
		const deltaX = this.max.x - this.min.x;
		this.min.x = value;
		this.max.x = value + deltaX;
	}

	/**
	 * Gets the y position of the bounds.
	 * @returns The y position.
	 */
	get y() {
		return this.min.y;
	}

	/**
	 * Sets the y position of the bounds.
	 * @param value - The new y position.
	 */
	set y(value) {
		const deltaY = this.max.y - this.min.y;

		this.min.y = value;
		this.max.y = value + deltaY;
	}

	/**
	 * Gets the width of the bounds.
	 * @returns The width.
	 */
	get width() {
		return this.max.x - this.min.x;
	}

	/**
	 * Sets the width of the bounds.
	 * @param value - The new width.
	 */
	set width(value) {
		this.max.x = this.min.x + value;
	}

	/**
	 * Gets the height of the bounds.
	 * @returns The height.
	 */
	get height() {
		return this.max.y - this.min.y;
	}

	/**
	 * Sets the height of the bounds.
	 * @param value - The new height.
	 */
	set height(value) {
		this.max.y = this.min.y + value;
	}

	/**
	 * Gets the left coordinate of the bounds.
	 * @returns The left coordinate.
	 */
	get left() {
		return this.min.x;
	}

	/**
	 * Gets the right coordinate of the bounds.
	 * @returns The right coordinate.
	 */
	get right() {
		return this.max.x;
	}

	/**
	 * Gets the top coordinate of the bounds.
	 * @returns The top coordinate.
	 */
	get top() {
		return this.min.y;
	}

	/**
	 * Gets the bottom coordinate of the bounds.
	 * @returns The bottom coordinate.
	 */
	get bottom() {
		return this.max.y;
	}

	/**
	 * Gets the center position of the bounds on the x axis.
	 * @returns The center x coordinate.
	 */
	get centerX() {
		return this.min.x + this.width / 2;
	}

	/**
	 * Gets the center position of the bounds on the y axis.
	 * @returns The center y coordinate.
	 */
	get centerY() {
		return this.min.y + this.height / 2;
	}

	/**
	 * Gets the center position of the bounds.
	 * @returns The center position as a Vector2d.
	 */
	get center() {
		return this._center.set(this.centerX, this.centerY);
	}

	/**
	 * Centers the bounds position around the given coordinates.
	 * @param x - The x coordinate to center around.
	 * @param y - The y coordinate to center around.
	 * @returns The current Bounds instance for method chaining.
	 */
	centerOn(x: number, y: number) {
		this.shift(x - this.width / 2, y - this.height / 2);
		return this;
	}

	/**
	 * Updates the bounds using the given vertices.
	 * @param vertices - An array of Vector2d or Point to update the bounds.
	 */
	update(vertices: Vector2d[] | Point[] | XYPoint[]) {
		this.add(vertices, true);
	}

	/**
	 * Adds the given vertices to the bounds definition.
	 * @param vertices - An array of Vector2d or Point to add to the bounds.
	 * @param [clear] - Whether to reset the bounds before adding the new vertices. Defaults to false.
	 */
	add(vertices: Vector2d[] | Point[] | XYPoint[], clear = false) {
		if (clear) {
			this.clear();
		}
		for (const vertex of vertices) {
			if (vertex.x > this.max.x) {
				this.max.x = vertex.x;
			}
			if (vertex.x < this.min.x) {
				this.min.x = vertex.x;
			}
			if (vertex.y > this.max.y) {
				this.max.y = vertex.y;
			}
			if (vertex.y < this.min.y) {
				this.min.y = vertex.y;
			}
		}
	}

	/**
	 * Adds the given bounds to the bounds definition.
	 * @param bounds - The bounds to add.
	 * @param [clear] - Whether to reset the bounds before adding the new bounds.
	 */
	addBounds(bounds: Bounds, clear = false) {
		if (clear) {
			this.max.x = bounds.max.x;
			this.min.x = bounds.min.x;
			this.max.y = bounds.max.y;
			this.min.y = bounds.min.y;
		} else {
			if (bounds.max.x > this.max.x) {
				this.max.x = bounds.max.x;
			}
			if (bounds.min.x < this.min.x) {
				this.min.x = bounds.min.x;
			}
			if (bounds.max.y > this.max.y) {
				this.max.y = bounds.max.y;
			}
			if (bounds.min.y < this.min.y) {
				this.min.y = bounds.min.y;
			}
		}
	}

	/**
	 * Adds the given point to the bounds definition.
	 * @param point - The point to add to the bounds.
	 * @param [m] - An optional transform to apply to the given point.
	 */
	addPoint(point: Vector2d | Point, m?: Matrix2d | undefined) {
		const p = m ? m.apply(point) : point;
		this.min.x = Math.min(this.min.x, p.x);
		this.max.x = Math.max(this.max.x, p.x);
		this.min.y = Math.min(this.min.y, p.y);
		this.max.y = Math.max(this.max.y, p.y);
	}

	/**
	 * Adds the given quad coordinates to this bounds definition, multiplied by the given matrix.
	 * @param x0 - The left x coordinate of the quad.
	 * @param y0 - The top y coordinate of the quad.
	 * @param x1 - The right x coordinate of the quad.
	 * @param y1 - The bottom y coordinate of the quad.
	 * @param [m] - An optional transform to apply to the given coordinates.
	 */
	addFrame(
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		m?: Matrix2d | undefined,
	) {
		const v = pointPool.get();

		this.addPoint(v.set(x0, y0), m);
		this.addPoint(v.set(x1, y0), m);
		this.addPoint(v.set(x0, y1), m);
		this.addPoint(v.set(x1, y1), m);

		pointPool.release(v);
	}

	/**
	 * Returns true if the bounds contain the given point or vector.
	 * @param xOrVectorOrBounds - The x coordinate, vector, or bounds to check.
	 * @param [y] - The y coordinate if the first parameter is a number.
	 * @returns True if the bounds contain the point or vector, otherwise false.
	 */
	contains(x: number, y: number): boolean;
	contains(vector: Vector2d | Bounds): boolean;
	contains(xOrVectorOrBounds: Bounds | Vector2d | number, y?: number) {
		let _x1: number;
		let _x2: number;
		let _y1: number;
		let _y2: number;
		if (xOrVectorOrBounds instanceof Vector2d) {
			_x1 = _x2 = xOrVectorOrBounds.x;
			_y1 = _y2 = xOrVectorOrBounds.y;
		} else if (xOrVectorOrBounds instanceof Bounds) {
			_x1 = xOrVectorOrBounds.min.x;
			_x2 = xOrVectorOrBounds.max.x;
			_y1 = xOrVectorOrBounds.min.y;
			_y2 = xOrVectorOrBounds.max.y;
		} else {
			_x1 = _x2 = xOrVectorOrBounds;
			_y1 = _y2 = y!;
		}

		return (
			_x1 >= this.min.x &&
			_x2 <= this.max.x &&
			_y1 >= this.min.y &&
			_y2 <= this.max.y
		);
	}

	/**
	 * Returns true if the two bounds intersect.
	 * @param bounds - The bounds to check for intersection.
	 * @returns True if the bounds overlap, otherwise false.
	 */
	overlaps(bounds: Bounds) {
		return !(
			this.right < bounds.left ||
			this.left > bounds.right ||
			this.bottom < bounds.top ||
			this.top > bounds.bottom
		);
	}

	/**
	 * Determines whether all coordinates of this bounds are finite numbers.
	 * @returns False if any coordinates are positive or negative Infinity or NaN; otherwise, true.
	 */
	isFinite() {
		return (
			isFinite(this.min.x) &&
			isFinite(this.max.x) &&
			isFinite(this.min.y) &&
			isFinite(this.max.y)
		);
	}

	/**
	 * Translates the bounds by the given point or vector.
	 * @param xOrVector - The x coordinate or vector to translate by.
	 * @param [y] - The y coordinate if the first parameter is a number.
	 */
	translate(x: number, y: number): void;
	translate(vector: Vector2d): void;
	translate(xOrVector: Vector2d | number, y?: number) {
		let _x: number;
		let _y: number;
		if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
		} else {
			_x = xOrVector;
			_y = y!;
		}
		this.min.x += _x;
		this.max.x += _x;
		this.min.y += _y;
		this.max.y += _y;
	}

	/**
	 * Shifts the bounds to the given x, y position or vector.
	 * @param xOrVector - The x coordinate or vector to shift to.
	 * @param [y] - The y coordinate if the first parameter is a number.
	 */
	shift(x: number, y: number): void;
	shift(vector: Vector2d): void;
	shift(xOrVector: number | Vector2d, y?: number) {
		let _x: number;
		let _y: number;

		if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
		} else {
			_x = xOrVector;
			_y = y!;
		}

		const deltaX = this.max.x - this.min.x;
		const deltaY = this.max.y - this.min.y;

		this.min.x = _x;
		this.max.x = _x + deltaX;
		this.min.y = _y;
		this.max.y = _y + deltaY;
	}

	/**
	 * Creates a clone of this bounds.
	 * @returns A new Bounds object that is a copy of this bounds.
	 */
	clone() {
		const bounds = new Bounds();
		bounds.addBounds(this);
		return bounds;
	}

	/**
	 * Returns a polygon whose edges are the same as this bounds.
	 * @returns A new Polygon that represents this bounds.
	 */
	toPolygon() {
		return polygonPool.get(this.x, this.y, [
			new Vector2d(0, 0),
			new Vector2d(this.width, 0),
			new Vector2d(this.width, this.height),
			new Vector2d(0, this.height),
		]);
	}
}

/**
 * A pool for creating and reusing Bounds objects.
 */
export const boundsPool = createPool<
	Bounds,
	[vertices?: Vector2d[] | Point[] | undefined]
>((vertices) => {
	const instance = new Bounds(vertices);
	return {
		instance,
		reset(vertices) {
			instance.clear();
			if (vertices) {
				instance.update(vertices);
			}
		},
	};
});
