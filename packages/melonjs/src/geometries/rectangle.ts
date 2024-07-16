import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { createPool } from "../system/pool.ts";
import { Polygon, polygonPool, PolygonVertices } from "./polygon.ts";

/**
 * A rectangle object.
 */
export class Rect extends Polygon {
	/**
	 * The shape type (used internally).
	 */
	override type = "Rectangle";

	/**
	 * Creates a new rectangle.
	 * @param x - The x position of the rectangle.
	 * @param y - The y position of the rectangle.
	 * @param w - The width of the rectangle.
	 * @param h - The height of the rectangle.
	 */
	constructor(x: number, y: number, w: number, h: number) {
		super(x, y, [
			vector2dPool.get(0, 0), // 0, 0
			vector2dPool.get(w, 0), // 1, 0
			vector2dPool.get(w, h), // 1, 1
			vector2dPool.get(0, h), // 0, 1
		]);
	}

	/**
	 * Set new dimensions for the rectangle.
	 * @param width - The new width of the rectangle.
	 * @param height - The new height of the rectangle.
	 */
	setSize(width: number, height: number) {
		this.points[0].set(0, 0); // 0, 0
		this.points[1].set(width, 0); // 1, 0
		this.points[2].set(width, height); // 1, 1
		this.points[3].set(0, height); // 0, 1
		return this;
	}

	/**
	 * The left coordinate of the Rectangle.
	 */
	get left() {
		return this.pos.x;
	}

	/**
	 * right coordinate of the Rectangle
	 */
	get right() {
		const w = this.width;
		return this.left + w || w;
	}

	/**
	 * top coordinate of the Rectangle
	 */
	get top() {
		return this.pos.y;
	}

	/**
	 * bottom coordinate of the Rectangle
	 */
	get bottom() {
		const h = this.height;
		return this.top + h || h;
	}

	/**
	 * width of the Rectangle
	 */
	get width() {
		return this.points[2].x;
	}
	set width(value) {
		this.points[1].x = this.points[2].x = value;
		this.recalc();
		this.updateBounds();
	}

	/**
	 * height of the Rectangle
	 */
	get height() {
		return this.points[2].y;
	}
	set height(value) {
		this.points[2].y = this.points[3].y = value;
		this.recalc();
		this.updateBounds();
	}

	/**
	 * absolute center of this rectangle on the horizontal axis
	 */
	get centerX() {
		if (isFinite(this.width)) {
			return this.left + this.width / 2;
		} else {
			return this.width;
		}
	}
	set centerX(value) {
		this.pos.x = value - this.width / 2;
		this.recalc();
		this.updateBounds();
	}

	/**
	 * absolute center of this rectangle on the vertical axis
	 */
	get centerY() {
		if (isFinite(this.height)) {
			return this.top + this.height / 2;
		} else {
			return this.height;
		}
	}
	set centerY(value) {
		this.pos.y = value - this.height / 2;
		this.recalc();
		this.updateBounds();
	}

	/**
	 * center the rectangle position around the given coordinates
	 * @param x - the x coordinate around which to center this rectangle
	 * @param y - the y coordinate around which to center this rectangle
	 * @returns this rectangle
	 */
	centerOn(x: number, y: number) {
		this.centerX = x;
		this.centerY = y;
		return this;
	}

	/**
	 * resize the rectangle
	 * @param w - new width of the rectangle
	 * @param h - new height of the rectangle
	 * @returns this rectangle
	 */
	resize(w: number, h: number) {
		this.width = w;
		this.height = h;
		return this;
	}

	/**
	 * scale the rectangle
	 * @param x - a number representing the abscissa of the scaling vector.
	 * @param [y=x] - a number representing the ordinate of the scaling vector.
	 * @returns this rectangle
	 */
	override scale(x: number, y = x) {
		this.width *= x;
		this.height *= y;
		return this;
	}

	/**
	 * clone this rectangle
	 * @returns new rectangle
	 */
	override clone() {
		return new Rect(this.left, this.top, this.width, this.height);
	}

	/**
	 * copy the position and size of the given rectangle into this one
	 * @param rect - Source rectangle
	 * @returns new rectangle
	 */
	copy(rect: Rect) {
		this.pos.set(rect.pos.x, rect.pos.y);
		this.setSize(rect.width, rect.height);
		return this;
	}

	/**
	 * merge this rectangle with another one
	 * @param rect - other rectangle to union with
	 * @returns the union(ed) rectangle
	 */
	union(rect: Rect) {
		const x1 = Math.min(this.left, rect.left);
		const y1 = Math.min(this.top, rect.top);

		this.resize(
			Math.max(this.right, rect.right) - x1,
			Math.max(this.bottom, rect.bottom) - y1,
		);

		this.pos.set(x1, y1);

		return this;
	}

	/**
	 * check if this rectangle is intersecting with the specified one
	 * @param rect Other rectangle.
	 * @returns true if overlaps
	 */
	overlaps(rect: Rect) {
		return (
			this.left < rect.right &&
			rect.left < this.right &&
			this.top < rect.bottom &&
			rect.top < this.bottom
		);
	}

	override contains(x: number, y: number): boolean;
	override contains(vector: Vector2d): boolean;
	override contains(xOrVector: Vector2d | number, y?: number): boolean {
		let _x1: number;
		let _x2: number;
		let _y1: number;
		let _y2: number;

		if (xOrVector instanceof Vector2d) {
			_x1 = _x2 = xOrVector.x;
			_y1 = _y2 = xOrVector.y;
		} else {
			_x1 = _x2 = xOrVector;
			_y1 = _y2 = y!;
		}
		return (
			_x1 >= this.left &&
			_x2 <= this.right &&
			_y1 >= this.top &&
			_y2 <= this.bottom
		);
	}

	/**
	 * Returns true if the rectangle contains the given rectangle
	 * @param rectangle - rectangle to test
	 * @returns True if the rectangle contain the given rectangle, otherwise false
	 * @example
	 * if (rect.containsRectangle(myRect)) {
	 *   // do something
	 * }
	 */
	containsRectangle(rectangle: Rect) {
		return (
			rectangle.left >= this.left &&
			rectangle.right <= this.right &&
			rectangle.top >= this.top &&
			rectangle.bottom <= this.bottom
		);
	}

	/**
	 * Check if this rectangle is identical to the specified one.
	 * @param rect Other rectangle.
	 * @returns true if equals
	 */
	equals(rect: Rect) {
		return (
			rect.left === this.left &&
			rect.right === this.right &&
			rect.top === this.top &&
			rect.bottom === this.bottom
		);
	}

	/**
	 * Determines whether all coordinates of this rectangle are finite numbers.
	 * @returns false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
	 */
	isFinite() {
		return (
			isFinite(this.left) &&
			isFinite(this.top) &&
			isFinite(this.width) &&
			isFinite(this.height)
		);
	}

	/**
	 * Returns a polygon whose edges are the same as this box.
	 * @returns a new Polygon that represents this rectangle.
	 */
	toPolygon() {
		return polygonPool.get(this.left, this.top, this.points as PolygonVertices);
	}
}

export const rectPool = createPool<
	Rect,
	[x: number, y: number, width: number, height: number]
>((x, y, width, height) => {
	const rectangle = new Rect(x, y, width, height);
	return {
		instance: rectangle,
		reset(x, y, width, height) {
			rectangle.pos.set(x, y);
			rectangle.setSize(width, height);
		},
	};
});
