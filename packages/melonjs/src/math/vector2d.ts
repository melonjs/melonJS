import { clamp } from "./math.ts";
import { createPool } from "../system/pool.ts";
import { XYPoint } from "../utils/types.ts";

/**
 * a generic 2D Vector Object
 */
export class Vector2d {
	x: number;
	y: number;

	/**
	 * @param [x] - x value of the vector
	 * @param [y] - y value of the vector
	 */
	constructor(x: number | undefined = 0, y: number | undefined = 0) {
		this.x = x;
		this.y = y;
	}

	/**
	 * @param [x] - x value of the vector
	 * @param [y] - y value of the vector
	 * @ignore
	 */
	onResetEvent(x = 0, y = 0) {
		/**
		 * x value of the vector
		 */
		this.x = x;
		/**
		 * y value of the vector
		 */
		this.y = y;
	}

	/**
	 * set the Vector x and y properties to the given values
	 * @param x - x component of the vector
	 * @param y - y component of the vector
	 * @returns Reference to this object for method chaining
	 */
	set(x: number, y: number) {
		this.x = x;
		this.y = y;
		return this;
	}

	/**
	 * set the Vector x and y properties to 0
	 * @returns Reference to this object for method chaining
	 */
	setZero() {
		return this.set(0, 0);
	}

	/**
	 * set the Vector x and y properties using the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	setV(v: Vector2d) {
		return this.set(v.x, v.y);
	}

	/**
	 * Add the passed vector to this vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	add(v: Vector2d) {
		return this.set(this.x + v.x, this.y + v.y);
	}

	/**
	 * Substract the passed vector to this vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	sub(v: Vector2d) {
		return this.set(this.x - v.x, this.y - v.y);
	}

	/**
	 * Multiply this vector values by the given scalar
	 * @param x x scale value
	 * @param [y] y scale value, if not passed, it uses the x value
	 * @returns Reference to this object for method chaining
	 */
	scale(x: number, y = x) {
		return this.set(this.x * x, this.y * y);
	}

	/**
	 * Convert this vector into isometric coordinate space
	 * @returns Reference to this object for method chaining
	 */
	toIso() {
		return this.set(this.x - this.y, (this.x + this.y) * 0.5);
	}

	/**
	 * Convert this vector into 2d coordinate space
	 * @returns Reference to this object for method chaining
	 */
	to2d() {
		return this.set(this.y + this.x / 2, this.y - this.x / 2);
	}

	/**
	 * Multiply this vector values by the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	scaleV(v: Vector2d) {
		return this.set(this.x * v.x, this.y * v.y);
	}

	/**
	 * Divide this vector values by the passed value
	 * @param n - the value to divide the vector by
	 * @returns Reference to this object for method chaining
	 */
	div(n: number) {
		return this.set(this.x / n, this.y / n);
	}

	/**
	 * Update this vector values to absolute values
	 * @returns Reference to this object for method chaining
	 */
	abs() {
		return this.set(
			this.x < 0 ? -this.x : this.x,
			this.y < 0 ? -this.y : this.y,
		);
	}

	/**
	 * Clamp the vector value within the specified value range
	 * @param low minimum component value
	 * @param high maximum component value
	 * @returns new me.Vector2d
	 */
	clamp(low: number, high: number) {
		return new Vector2d(clamp(this.x, low, high), clamp(this.y, low, high));
	}

	/**
	 * Clamp this vector value within the specified value range
	 * @param low minimum component value
	 * @param high maximum component value
	 * @returns Reference to this object for method chaining
	 */
	clampSelf(low: number, high: number) {
		return this.set(clamp(this.x, low, high), clamp(this.y, low, high));
	}

	/**
	 * Update this vector with the minimum value between this and the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	minV(v: Vector2d) {
		return this.set(this.x < v.x ? this.x : v.x, this.y < v.y ? this.y : v.y);
	}

	/**
	 * Update this vector with the maximum value between this and the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	maxV(v: Vector2d) {
		return this.set(this.x > v.x ? this.x : v.x, this.y > v.y ? this.y : v.y);
	}

	/**
	 * Floor the vector values
	 * @returns new Vector2d
	 */
	floor() {
		return new Vector2d(Math.floor(this.x), Math.floor(this.y));
	}

	/**
	 * Floor this vector values
	 * @returns Reference to this object for method chaining
	 */
	floorSelf() {
		return this.set(Math.floor(this.x), Math.floor(this.y));
	}

	/**
	 * Ceil the vector values
	 * @returns new Vector2d
	 */
	ceil() {
		return new Vector2d(Math.ceil(this.x), Math.ceil(this.y));
	}

	/**
	 * Ceil this vector values
	 * @returns Reference to this object for method chaining
	 */
	ceilSelf() {
		return this.set(Math.ceil(this.x), Math.ceil(this.y));
	}

	/**
	 * Negate the vector values
	 * @returns new Vector2d
	 */
	negate() {
		return new Vector2d(-this.x, -this.y);
	}

	/**
	 * Negate this vector values
	 * @returns Reference to this object for method chaining
	 */
	negateSelf() {
		return this.set(-this.x, -this.y);
	}

	/**
	 * Copy the x,y values of the passed vector to this one
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	copy(v: Vector2d) {
		return this.set(v.x, v.y);
	}

	/**
	 * Checks if this vector is equal to another vector or a pair of coordinates.
	 * @param args - Either two numbers representing x and y coordinates or a single Vector2d object.
	 * @returns True if the coordinates are equal, false otherwise.
	 * @example
	 * let v1 = new Vector2d(3, 4);
	 * let v2 = new Vector2d(3, 4);
	 * v1.equals(v2); // returns true
	 * @example
	 * let v = new Vector2d(3, 4);
	 * v.equals(3, 4); // returns true
	 */
	equals(...args: [number, number] | [Vector2d | XYPoint]) {
		if (args.length === 2) {
			return this.x === args[0] && this.y === args[1];
		}
		return this.x === args[0].x && this.y === args[0].y;
	}

	/**
	 * normalize this vector (scale the vector so that its magnitude is 1)
	 * @returns Reference to this object for method chaining
	 */
	normalize() {
		return this.div(this.length() || 1);
	}

	/**
	 * change this vector to be perpendicular to what it was before.<br>
	 * (Effectively rotates it 90 degrees in a clockwise direction)
	 * @returns Reference to this object for method chaining
	 */
	perp() {
		return this.set(this.y, -this.x);
	}

	/**
	 * Rotate this vector (counter-clockwise) by the specified angle (in radians).
	 * @param angle - The angle to rotate (in radians)
	 * @param [v] - an optional point to rotate around
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v?: XYPoint | undefined) {
		let cx = 0;
		let cy = 0;

		if (v) {
			cx = v.x;
			cy = v.y;
		}

		const x = this.x - cx;
		const y = this.y - cy;

		const c = Math.cos(angle);
		const s = Math.sin(angle);

		return this.set(x * c - y * s + cx, x * s + y * c + cy);
	}

	/**
	 * return the dot product of this vector and the passed one
	 * @param v other vector
	 * @returns The dot product.
	 */
	dot(v: Vector2d) {
		return this.x * v.x + this.y * v.y;
	}

	/**
	 * return the cross product of this vector and the passed one
	 * @param v other vector
	 * @returns The cross product.
	 */
	cross(v: Vector2d) {
		return this.x * v.y - this.y * v.x;
	}

	/**
	 * return the square length of this vector
	 * @returns The length^2 of this vector.
	 */
	length2() {
		return this.dot(this);
	}

	/**
	 * return the length (magnitude) of this vector
	 * @returns the length of this vector
	 */
	length() {
		return Math.sqrt(this.length2());
	}

	/**
	 * Linearly interpolate between this vector and the given one.
	 * @param v other vector
	 * @param alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
	 * @returns Reference to this object for method chaining
	 */
	lerp(v: Vector2d, alpha: number) {
		this.x += (v.x - this.x) * alpha;
		this.y += (v.y - this.y) * alpha;
		return this;
	}

	/**
	 * interpolate the position of this vector towards the given one by the given maximum step.
	 * @param target vector to rotate towards
	 * @param step - the maximum step per iteration (Negative values will push the vector away from the target)
	 * @returns Reference to this object for method chaining
	 */
	moveTowards(target: Vector2d, step: number) {
		const angle = Math.atan2(target.y - this.y, target.x - this.x);

		const distance = this.distance(target);

		if (distance === 0 || (step >= 0 && distance <= step * step)) {
			return target;
		}

		this.x += Math.cos(angle) * step;
		this.y += Math.sin(angle) * step;

		return this;
	}

	/**
	 * Calculates the Euclidean distance between this vector and another vector.
	 * @param v - The vector to which the distance is calculated.
	 * @returns The Euclidean distance between this vector and the given vector.
	 * @example
	 * let v1 = new Vector2d(3, 4);
	 * let v2 = new Vector2d(6, 8);
	 * v1.distance(v2); // returns 5
	 */
	distance(v: Vector2d) {
		const dx = this.x - v.x;
		const dy = this.y - v.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	/**
	 * return the angle between this vector and the passed one
	 * @param v other vector
	 * @returns angle in radians
	 */
	angle(v: Vector2d) {
		return Math.acos(clamp(this.dot(v) / (this.length() * v.length()), -1, 1));
	}

	/**
	 * project this vector on to another vector.
	 * @param v - The vector to project onto.
	 * @returns Reference to this object for method chaining
	 */
	project(v: Vector2d) {
		return this.scale(this.dot(v) / v.length2());
	}

	/**
	 * Project this vector onto a vector of unit length.<br>
	 * This is slightly more efficient than `project` when dealing with unit vectors.
	 * @param v - The unit vector to project onto.
	 * @returns Reference to this object for method chaining
	 */
	projectN(v: Vector2d) {
		return this.scale(this.dot(v));
	}

	/**
	 * return a clone copy of this vector
	 * @returns new Vector2d
	 */
	clone() {
		return vector2dPool.get(this.x, this.y);
	}

	/**
	 * convert the object to a string representation
	 * @returns stringified representation of this vector
	 */
	toString() {
		return `x:${this.x},y:${this.y}` as const;
	}
}

export const vector2dPool = createPool<
	Vector2d,
	[x?: number | undefined, y?: number | undefined]
>((x, y) => {
	const vector = new Vector2d(x, y);

	return {
		instance: vector,
		reset(x = 0, y = 0) {
			vector.x = x;
			vector.y = y;
		},
	};
});
