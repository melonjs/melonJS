import { Vector2d } from "../math/vector2d.ts";
import { createPool } from "../system/pool.ts";
import { Rect } from "./rectangle.ts";

// https://developer.chrome.com/blog/canvas2d/#round-rect

const DEFAULT_RADIUS = 20;

/**
 * a rectangle object with rounded corners
 */
export class RoundRect extends Rect {
	/**
	 * Corner radius.
	 */
	_radius: number;

	/**
	 * the shape type (used internally)
	 */
	override type = "RoundRect";

	/**
	 * @param x - position of the rounded rectangle
	 * @param y - position of the rounded rectangle
	 * @param width - the rectangle width
	 * @param height - the rectangle height
	 * @param [radius=20] - the radius of the rounded corner
	 */
	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		radius = DEFAULT_RADIUS,
	) {
		super(x, y, width, height);
		this.type = "RoundRect";
		this.radius = radius;
	}

	/**
	 * the radius of the rounded corner
	 * @default 20
	 */
	get radius() {
		return this._radius;
	}
	set radius(value) {
		// verify the rectangle is at least as wide and tall as the rounded corners.
		if (this.width < 2 * value) {
			value = this.width / 2;
		}
		if (this.height < 2 * value) {
			value = this.height / 2;
		}
		this._radius = value;
	}

	/**
	 * copy the position, size and radius of the given rounded rectangle into this one
	 * @param rrect - source rounded rectangle
	 * @returns new rectangle
	 */
	override copy(rrect: RoundRect) {
		this.pos.set(rrect.pos.x, rrect.pos.y);
		this.setSize(rrect.width, rrect.height);
		this.radius = rrect.radius;
		return this;
	}

	/**
	 * Returns true if the rounded rectangle contains the given point or rectangle
	 * @param x -  x coordinate or a vector point, or a Rect to test
	 * @param [y] - y coordinate
	 * @returns True if the rounded rectangle contain the given point or rectangle, otherwise false
	 * @example
	 * if (rect.contains(10, 10)) {
	 *   // do something
	 * }
	 * // or
	 * if (rect.contains(myVector2d)) {
	 *   // do something
	 * }
	 * if (rect.contains(myRect)) {
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

		// check whether point is outside the bounding box
		if (
			_x < this.left ||
			_x >= this.right ||
			_y < this.top ||
			_y >= this.bottom
		) {
			return false; // outside bounding box
		}

		// check whether point is within the bounding box minus radius
		if (
			(_x >= this.left + this.radius && _x <= this.right - this.radius) ||
			(_y >= this.top + this.radius && _y <= this.bottom - this.radius)
		) {
			return true;
		}

		// check whether point is in one of the rounded corner areas
		let tx;
		let ty;
		const radiusX = Math.max(0, Math.min(this.radius, this.width / 2));
		const radiusY = Math.max(0, Math.min(this.radius, this.height / 2));

		if (_x < this.left + radiusX && _y < this.top + radiusY) {
			tx = _x - this.left - radiusX;
			ty = _y - this.top - radiusY;
		} else if (_x > this.right - radiusX && _y < this.top + radiusY) {
			tx = _x - this.right + radiusX;
			ty = _y - this.top - radiusY;
		} else if (_x > this.right - radiusX && _y > this.bottom - radiusY) {
			tx = _x - this.right + radiusX;
			ty = _y - this.bottom + radiusY;
		} else if (_x < this.left + radiusX && _y > this.bottom - radiusY) {
			tx = _x - this.left - radiusX;
			ty = _y - this.bottom + radiusY;
		} else {
			return false; // inside and not within the rounded corner area
		}

		// Pythagorean theorem.
		return tx * tx + ty * ty <= radiusX * radiusY;
	}

	/**
	 * check if this RoundRect is identical to the specified one
	 * @param rrect - Other rounded rectangle.
	 * @returns true if equals
	 */
	override equals(rrect: RoundRect) {
		return super.equals(rrect) && this.radius === rrect.radius;
	}

	/**
	 * clone this RoundRect
	 * @returns new RoundRect
	 */
	override clone() {
		return new RoundRect(
			this.pos.x,
			this.pos.y,
			this.width,
			this.height,
			this.radius,
		);
	}
}

export const roundedRectanglePool = createPool<
	RoundRect,
	[
		x: number,
		y: number,
		width: number,
		height: number,
		radius?: number | undefined,
	]
>((x, y, width, height, radius) => {
	const roundedRectangle = new RoundRect(x, y, width, height, radius);
	return {
		instance: roundedRectangle,
		reset(x, y, width, height, radius = DEFAULT_RADIUS) {
			roundedRectangle.pos.set(x, y);
			roundedRectangle.setSize(width, height);
			roundedRectangle.radius = radius;
		},
	};
});
