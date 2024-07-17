import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { Bounds, boundsPool } from "../physics/bounds.ts";
import { createPool } from "../system/pool.ts";

/**
 * an ellipse Object
 */
export class Ellipse {
	/**
	 * the center coordinates of the ellipse
	 */
	pos: Vector2d;

	/**
	 * The bounding rectangle for this shape
	 */
	_bounds: Bounds;

	/**
	 * Maximum radius of the ellipse
	 */
	radius: number;

	/**
	 * Pre-scaled radius vector for ellipse
	 */
	radiusV: Vector2d;

	/**
	 * Radius squared, for pythagorean theorom
	 */
	radiusSq: Vector2d;

	/**
	 * x/y scaling ratio for ellipse
	 */
	ratio: Vector2d;

	/**
	 * the shape type (used internally)
	 */
	type = "Ellipse";

	/**
	 * @param x - the center x coordinate of the ellipse
	 * @param y - the center y coordinate of the ellipse
	 * @param w - width (diameter) of the ellipse
	 * @param h - height (diameter) of the ellipse
	 */
	constructor(x: number, y: number, w: number, h: number) {
		this.pos = new Vector2d();
		this._bounds = new Bounds();
		this.radius = NaN;
		this.radiusV = new Vector2d();
		this.radiusSq = new Vector2d();
		this.ratio = vector2dPool.get();
		this.setShape(x, y, w, h);
	}

	/**
	 * set new value to the Ellipse shape
	 * @param x - the center x coordinate of the ellipse
	 * @param y - the center y coordinate of the ellipse
	 * @param w - width (diameter) of the ellipse
	 * @param h - height (diameter) of the ellipse
	 * @returns this instance for objecf chaining
	 */
	setShape(x: number, y: number, w: number, h: number) {
		const hW = w / 2;
		const hH = h / 2;
		const radius = Math.max(hW, hH);
		const r = radius * radius;

		this.pos.set(x, y);
		this.radius = radius;
		this.ratio.set(hW / radius, hH / radius);
		this.radiusV.set(radius, radius).scaleV(this.ratio);
		this.radiusSq.set(r, r).scaleV(this.ratio);

		const bounds = this.getBounds();
		// update the corresponding bounds
		bounds.setMinMax(x, y, x + w, x + h);
		// elipse position is the center of the cirble, bounds position are top left
		bounds.translate(-this.radiusV.x, -this.radiusV.y);

		return this;
	}

	/**
	 * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
	 * @param angle - The angle to rotate (in radians)
	 * @param [v] - an optional point to rotate around
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v?: Vector2d | undefined) {
		const bounds = this.getBounds();
		// TODO : only works for circle
		this.pos.rotate(angle, v);
		bounds.shift(this.pos);
		bounds.translate(-this.radiusV.x, -this.radiusV.y);
		return this;
	}

	/**
	 * Scale this Ellipse by the specified scalar.
	 * @param x - the scale factor along the x-axis
	 * @param [y=x] - the scale factor along the y-axis
	 * @returns Reference to this object for method chaining
	 */
	scale(x: number, y = x) {
		return this.setShape(
			this.pos.x,
			this.pos.y,
			this.radiusV.x * 2 * x,
			this.radiusV.y * 2 * y,
		);
	}

	/**
	 * Scale this Ellipse by the specified vector.
	 * @param v - Scaling vector.
	 * @returns Reference to this object for method chaining
	 */
	scaleV(v: Vector2d) {
		return this.scale(v.x, v.y);
	}

	/**
	 * apply the given transformation matrix to this ellipse
	 * @returns Reference to this object for method chaining
	 */
	transform() {
		// TODO
		return this;
	}

	/**
	 * translate the circle/ellipse by the specified offset
	 * @param x -  x coordinate or a vector point to translate by
	 * @param [y] - y offset
	 * @returns this ellipse
	 * @example
	 * ellipse.translate(10, 10);
	 * // or
	 * ellipse.translate(myVector2d);
	 */
	translate(x: number, y: number): Ellipse;
	translate(vector: Vector2d): Ellipse;
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

		this.pos.x += _x;
		this.pos.y += _y;
		this.getBounds().translate(_x, _y);

		return this;
	}

	/**
	 * check if this circle/ellipse contains the specified point
	 * @param x -  x coordinate or a vector point to check
	 * @param [y] -  y coordinate
	 * @param args
	 * @returns true if contains
	 * @example
	 * if (circle.contains(10, 10)) {
	 *   // do something
	 * }
	 * // or
	 * if (circle.contains(myVector2d)) {
	 *  // do something
	 * }
	 */
	contains(x: number, y: number): boolean;
	contains(vector: Vector2d): boolean;
	contains(xOrVector: Vector2d | number, y?: number) {
		let _x: number;
		let _y: number;

		if (xOrVector instanceof Vector2d) {
			[_x, _y] = [xOrVector.x, xOrVector.y];
		} else {
			_x = xOrVector;
			_y = y!;
		}

		// Make position relative to object center point.
		_x -= this.pos.x;
		_y -= this.pos.y;
		// Pythagorean theorem.
		return (_x * _x) / this.radiusSq.x + (_y * _y) / this.radiusSq.y <= 1.0;
	}

	/**
	 * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
	 * @returns this shape bounding box Rectangle object
	 */
	getBounds() {
		if (typeof this._bounds === "undefined") {
			this._bounds = boundsPool.get();
		}
		return this._bounds;
	}

	/**
	 * clone this Ellipse
	 * @returns new Ellipse
	 */
	clone() {
		return new Ellipse(
			this.pos.x,
			this.pos.y,
			this.radiusV.x * 2,
			this.radiusV.y * 2,
		);
	}
}

export const ellipsePool = createPool<
	Ellipse,
	[x: number, y: number, width: number, height: number]
>((x, y, width, height) => {
	const instance = new Ellipse(x, y, width, height);

	return {
		instance,
		reset(x, y, width, height) {
			instance.setShape(x, y, width, height);
		},
	};
});
