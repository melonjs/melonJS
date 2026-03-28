import { Vector2d } from "../math/vector2d.ts";
import { createPool } from "../system/pool.ts";
import { Polygon } from "./polygon.ts";

// https://developer.chrome.com/blog/canvas2d/#round-rect

const DEFAULT_RADIUS = 20;

// number of segments per rounded corner arc
const CORNER_SEGMENTS = 8;

// total vertex count for a rounded rectangle (4 corners × (segments + 1))
const ROUNDED_VERTEX_COUNT = 4 * (CORNER_SEGMENTS + 1);

// precomputed cos/sin for each corner arc step (shared across all instances)
const CORNER_COS: number[] = new Array(CORNER_SEGMENTS + 1);
const CORNER_SIN: number[] = new Array(CORNER_SEGMENTS + 1);
for (let i = 0; i <= CORNER_SEGMENTS; i++) {
	const angle = (i / CORNER_SEGMENTS) * (Math.PI / 2);
	CORNER_COS[i] = Math.cos(angle);
	CORNER_SIN[i] = Math.sin(angle);
}

/**
 * Update existing vertex positions to approximate a rounded rectangle,
 * or create new vertices if the array length doesn't match.
 * Vertices are in clockwise winding order.
 * @param points - existing points array (may be reused)
 * @param w - width
 * @param h - height
 * @param r - corner radius (already clamped)
 * @returns the points array (same reference if reused, or new)
 */
function updateRoundRectVertices(
	points: Vector2d[],
	w: number,
	h: number,
	r: number,
): Vector2d[] {
	if (r <= 0) {
		// plain rectangle — 4 vertices
		if (points.length === 4) {
			points[0].set(0, 0);
			points[1].set(w, 0);
			points[2].set(w, h);
			points[3].set(0, h);
			return points;
		}
		return [
			new Vector2d(0, 0),
			new Vector2d(w, 0),
			new Vector2d(w, h),
			new Vector2d(0, h),
		];
	}

	// reuse existing array if vertex count matches
	const canReuse = points.length === ROUNDED_VERTEX_COUNT;
	let idx = 0;

	function setOrPush(x: number, y: number) {
		if (canReuse) {
			points[idx].set(x, y);
		} else {
			points[idx] = new Vector2d(x, y);
		}
		idx++;
	}

	if (!canReuse) {
		points.length = ROUNDED_VERTEX_COUNT;
	}

	// top-right corner: angle -π/2 to 0
	// cos(-π/2 + t) = sin(t), sin(-π/2 + t) = -cos(t) where t = i/N * π/2
	for (let i = 0; i <= CORNER_SEGMENTS; i++) {
		setOrPush(w - r + r * CORNER_SIN[i], r - r * CORNER_COS[i]);
	}

	// bottom-right corner: angle 0 to π/2
	// cos(t) = cos(t), sin(t) = sin(t)
	for (let i = 0; i <= CORNER_SEGMENTS; i++) {
		setOrPush(w - r + r * CORNER_COS[i], h - r + r * CORNER_SIN[i]);
	}

	// bottom-left corner: angle π/2 to π
	// cos(π/2 + t) = -sin(t), sin(π/2 + t) = cos(t)
	for (let i = 0; i <= CORNER_SEGMENTS; i++) {
		setOrPush(r - r * CORNER_SIN[i], h - r + r * CORNER_COS[i]);
	}

	// top-left corner: angle π to 3π/2
	// cos(π + t) = -cos(t), sin(π + t) = -sin(t)
	for (let i = 0; i <= CORNER_SEGMENTS; i++) {
		setOrPush(r - r * CORNER_COS[i], r - r * CORNER_SIN[i]);
	}

	return points;
}

/**
 * a rectangle object with rounded corners
 * @category Geometry
 */
export class RoundRect extends Polygon {
	/**
	 * Corner radius.
	 */
	_radius: number;

	/**
	 * stored width
	 */
	_width: number;

	/**
	 * stored height
	 */
	_height: number;

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
		// initialize with rectangle vertices; radius setter will rebuild if needed
		super(x, y, [
			new Vector2d(0, 0),
			new Vector2d(width, 0),
			new Vector2d(width, height),
			new Vector2d(0, height),
		]);
		this.type = "RoundRect";
		this._width = width;
		this._height = height;
		this.radius = radius;
	}

	/**
	 * width of the RoundRect
	 */
	get width() {
		return this._width;
	}
	set width(value) {
		this._width = value;
		this._updateVertices();
	}

	/**
	 * height of the RoundRect
	 */
	get height() {
		return this._height;
	}
	set height(value) {
		this._height = value;
		this._updateVertices();
	}

	/**
	 * left coordinate of the RoundRect
	 */
	get left() {
		return this.pos.x;
	}

	/**
	 * right coordinate of the RoundRect
	 */
	get right() {
		return this.pos.x + this._width;
	}

	/**
	 * top coordinate of the RoundRect
	 */
	get top() {
		return this.pos.y;
	}

	/**
	 * bottom coordinate of the RoundRect
	 */
	get bottom() {
		return this.pos.y + this._height;
	}

	/**
	 * absolute center of this RoundRect on the horizontal axis
	 */
	get centerX() {
		return this.pos.x + this._width / 2;
	}

	/**
	 * absolute center of this RoundRect on the vertical axis
	 */
	get centerY() {
		return this.pos.y + this._height / 2;
	}

	/**
	 * the radius of the rounded corner
	 * @default 20
	 */
	get radius() {
		return this._radius;
	}
	set radius(value) {
		// clamp radius to half the shorter side
		if (this._width < 2 * value) {
			value = this._width / 2;
		}
		if (this._height < 2 * value) {
			value = this._height / 2;
		}
		this._radius = value;
		this._updateVertices();
	}

	/**
	 * Rebuild polygon vertices to approximate the rounded corners.
	 * Reuses existing Vector2d instances when the vertex count matches.
	 * @ignore
	 */
	_updateVertices() {
		const updated = updateRoundRectVertices(
			this.points,
			this._width,
			this._height,
			this._radius,
		);
		if (updated !== this.points) {
			// vertex count changed — need full setVertices
			this.setVertices(
				updated as [Vector2d, Vector2d, Vector2d, ...Vector2d[]],
			);
		} else {
			// same array, just recalc edges/normals/bounds
			this.recalc();
			this.updateBounds();
		}
	}

	/**
	 * Set new dimensions for the rounded rectangle.
	 * @param width - The new width.
	 * @param height - The new height.
	 */
	setSize(width: number, height: number) {
		this._width = width;
		this._height = height;
		// re-clamp radius and rebuild vertices
		this.radius = this._radius;
		return this;
	}

	/**
	 * resize the rounded rectangle
	 * @param w - new width
	 * @param h - new height
	 * @returns this rounded rectangle
	 */
	resize(w: number, h: number) {
		return this.setSize(w, h);
	}

	/**
	 * copy the position, size and radius of the given rounded rectangle into this one
	 * @param rrect - source rounded rectangle
	 * @returns this rounded rectangle
	 */
	copy(rrect: RoundRect) {
		this.pos.set(rrect.pos.x, rrect.pos.y);
		this.setSize(rrect.width, rrect.height);
		this.radius = rrect.radius;
		return this;
	}

	/**
	 * Returns true if the rounded rectangle contains the given point
	 * @param x - x coordinate or a vector point
	 * @param [y] - y coordinate
	 * @returns True if the rounded rectangle contains the given point
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
			return false;
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
		const radiusX = Math.max(0, Math.min(this.radius, this._width / 2));
		const radiusY = Math.max(0, Math.min(this.radius, this._height / 2));

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
			return false;
		}

		// Pythagorean theorem
		return tx * tx + ty * ty <= radiusX * radiusY;
	}

	/**
	 * Returns true if the rounded rectangle contains the given rectangle
	 * @param rectangle - rectangle to test
	 * @returns true if contained
	 */
	containsRectangle(rectangle: RoundRect) {
		return (
			rectangle.left >= this.left &&
			rectangle.right <= this.right &&
			rectangle.top >= this.top &&
			rectangle.bottom <= this.bottom
		);
	}

	/**
	 * check if this RoundRect is identical to the specified one
	 * @param rrect - Other rounded rectangle.
	 * @returns true if equals
	 */
	equals(rrect: RoundRect) {
		return (
			this.left === rrect.left &&
			this.right === rrect.right &&
			this.top === rrect.top &&
			this.bottom === rrect.bottom &&
			this.radius === rrect.radius
		);
	}

	/**
	 * clone this RoundRect
	 * @returns new RoundRect
	 */
	override clone() {
		return new RoundRect(
			this.pos.x,
			this.pos.y,
			this._width,
			this._height,
			this._radius,
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
