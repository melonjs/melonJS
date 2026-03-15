import type { Matrix2d } from "../math/matrix2d.ts";
import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { Bounds, boundsPool } from "../physics/bounds.ts";
import { createPool } from "../system/pool.ts";
import { Polygon } from "./polygon.ts";

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
	 * Radius squared, for pythagorean theorem
	 */
	private radiusSq: Vector2d;

	/**
	 * x/y scaling ratio for ellipse
	 */
	ratio: Vector2d;

	/**
	 * the internal rotation angle of the ellipse in radians
	 */
	private _angle: number;

	/**
	 * cached cosine of the current angle
	 */
	private _cos: number;

	/**
	 * cached sine of the current angle
	 */
	private _sin: number;

	/**
	 * cached polygon approximation, invalidated when shape changes
	 */
	private _polygon: Polygon | null = null;

	/**
	 * the rotation angle of the ellipse in radians
	 */
	get angle() {
		return this._angle;
	}
	set angle(value) {
		this._angle = value;
		this._cos = Math.cos(value);
		this._sin = Math.sin(value);
		this._polygon = null;
		this.updateBounds();
	}

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
		this._angle = 0;
		this._cos = 1;
		this._sin = 0;
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

		this.pos.set(x, y);
		this.radius = radius;
		this.ratio.set(hW / radius, hH / radius);
		this.radiusV.set(radius, radius).scaleV(this.ratio);
		this.radiusSq.set(
			this.radiusV.x * this.radiusV.x,
			this.radiusV.y * this.radiusV.y,
		);
		this._angle = 0;
		this._cos = 1;
		this._sin = 0;
		this._polygon = null;

		this.updateBounds();

		return this;
	}

	/**
	 * update the bounding box for this ellipse, taking rotation into account
	 */
	private updateBounds() {
		// invalidate cached polygon
		this._polygon = null;

		const bounds = this.getBounds();
		const rx = this.radiusV.x;
		const ry = this.radiusV.y;

		if (this._angle !== 0) {
			const cos = this._cos;
			const sin = this._sin;
			const halfW = Math.sqrt(rx * rx * cos * cos + ry * ry * sin * sin);
			const halfH = Math.sqrt(rx * rx * sin * sin + ry * ry * cos * cos);
			bounds.setMinMax(
				this.pos.x - halfW,
				this.pos.y - halfH,
				this.pos.x + halfW,
				this.pos.y + halfH,
			);
		} else {
			bounds.setMinMax(
				this.pos.x - rx,
				this.pos.y - ry,
				this.pos.x + rx,
				this.pos.y + ry,
			);
		}
	}

	/**
	 * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
	 * @param angle - The angle to rotate (in radians)
	 * @param [v] - an optional point to rotate around
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v?: Vector2d) {
		if (v) {
			this.pos.rotate(angle, v);
		}
		this.angle += angle;
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
	 * @param m - the transformation matrix
	 * @returns Reference to this object for method chaining
	 */
	transform(m: Matrix2d) {
		const a = m.val;

		// extract translation and apply to position
		this.pos.x += a[6];
		this.pos.y += a[7];

		// extract scale from the matrix columns
		const sx = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
		const sy = Math.sqrt(a[3] * a[3] + a[4] * a[4]);

		// extract rotation from the matrix
		const rotation = Math.atan2(a[1], a[0]);

		// apply scale to radii
		this.radiusV.x *= sx;
		this.radiusV.y *= sy;
		this.radius = Math.max(this.radiusV.x, this.radiusV.y);
		this.radiusSq.set(
			this.radiusV.x * this.radiusV.x,
			this.radiusV.y * this.radiusV.y,
		);

		// apply rotation (setter updates trig cache, polygon, and bounds)
		this.angle += rotation;

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
		this.updateBounds();

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

		// Un-rotate the point if the ellipse is rotated
		// cos(-θ) = cos(θ), sin(-θ) = -sin(θ)
		if (this._angle !== 0) {
			const cos = this._cos;
			const sin = -this._sin;
			const rx = _x * cos - _y * sin;
			const ry = _x * sin + _y * cos;
			_x = rx;
			_y = ry;
		}

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
	 * Returns a polygon approximation of this ellipse.
	 * The polygon is cached and only recomputed when the ellipse shape changes.
	 * @param [segments=16] - the number of segments to use for the approximation
	 * @returns a Polygon representing this ellipse
	 */
	toPolygon(segments = 16) {
		if (this._polygon !== null) {
			return this._polygon;
		}

		const points: Vector2d[] = [];
		const cos = this._cos;
		const sin = this._sin;
		const rx = this.radiusV.x;
		const ry = this.radiusV.y;
		const step = (2 * Math.PI) / segments;

		for (let i = 0; i < segments; i++) {
			const angle = i * step;
			const px = rx * Math.cos(angle);
			const py = ry * Math.sin(angle);
			points.push(new Vector2d(px * cos - py * sin, px * sin + py * cos));
		}

		this._polygon = new Polygon(
			this.pos.x,
			this.pos.y,
			points as [Vector2d, Vector2d, Vector2d, ...Vector2d[]],
		);
		return this._polygon;
	}

	/**
	 * clone this Ellipse
	 * @returns new Ellipse
	 */
	clone() {
		const clone = new Ellipse(
			this.pos.x,
			this.pos.y,
			this.radiusV.x * 2,
			this.radiusV.y * 2,
		);
		clone._angle = this._angle;
		clone._cos = this._cos;
		clone._sin = this._sin;
		clone.updateBounds();
		return clone;
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
