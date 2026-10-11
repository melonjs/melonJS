import { createPool } from "../system/pool.ts";
import { XYPoint } from "../utils/types.ts";
import { clamp, damp, lerp } from "./math.ts";

/**
 * a generic 2D Vector Object
 * @category Math
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
	 * @internal
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
	 * Subtract the passed vector from this vector
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
	rotate(angle: number, v?: XYPoint) {
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
	 * Frame-rate dependent at a fixed alpha — for smooth tracking
	 * use {@link Vector2d.damp} instead.
	 * @param v - other vector
	 * @param alpha - distance along the line (alpha = 0 → this vector, alpha = 1 → `v`)
	 * @returns Reference to this object for method chaining
	 */
	lerp(v: Vector2d, alpha: number) {
		this.x = lerp(this.x, v.x, alpha);
		this.y = lerp(this.y, v.y, alpha);
		return this;
	}

	/**
	 * Spherically interpolate between this vector and the given one.
	 *
	 * Where {@link Vector2d.lerp} cuts straight across the chord, this turns
	 * along the arc between the two DIRECTIONS at a constant angular rate,
	 * taking the shorter way round. Reach for it whenever a direction
	 * matters more than the components carrying it: a facing swinging onto a
	 * target, a turret, a steering vector. A lerp between two directions is
	 * not wrong so much as uneven, since it slows at the ends and runs fast
	 * through the middle, and it shortens the vector as it passes the
	 * midpoint.
	 *
	 * The length is interpolated linearly alongside the direction, so two
	 * unit vectors give a unit vector and two of equal length keep it. There
	 * is no need to normalize the inputs or the result.
	 *
	 * For two EXACTLY opposite directions both ways round are the same half
	 * circle, so there is no shorter one to take; the turn then goes the way
	 * {@link Vector2d.rotate} does for a positive angle.
	 * @param v - the vector to interpolate toward
	 * @param alpha - 0 leaves this vector alone, 1 reaches `v`
	 * @returns Reference to this object for method chaining
	 * @example
	 * // swing a facing a quarter of the way onto its target
	 * facing.slerp(toTarget, 0.25);
	 * @example
	 * // frame-rate independent: raise alpha with the frame's own elapsed time
	 * facing.slerp(toTarget, 1 - Math.exp(-6 * dt / 1000));
	 */
	slerp(v: Vector2d, alpha: number) {
		const lenA = Math.sqrt(this.x * this.x + this.y * this.y);
		const lenB = Math.sqrt(v.x * v.x + v.y * v.y);
		// a zero vector has no direction to turn, so there is no arc here
		if (lenA === 0 || lenB === 0) {
			return this.lerp(v, alpha);
		}
		const ax = this.x / lenA;
		const ay = this.y / lenA;
		const bx = v.x / lenB;
		const by = v.y / lenB;
		// In 2D the whole turn is ONE signed angle, and `atan2` gives it
		// exactly. That is why this is shorter than its 3D sibling rather
		// than a trimmed copy of it: there is no sine to divide by, so no
		// near-parallel special case, and no `acos` domain to keep a dot
		// product inside of.
		const cos = ax * bx + ay * by;
		const sin = ax * by - ay * bx;
		// EXACTLY opposite directions are the one case `atan2` cannot be
		// handed: both ways round cover the same half circle and neither is
		// shorter, and the sine is a ZERO whose sign decides the direction.
		// That sign flips with the axis: `(1, 0)` toward `(-1, 0)` produces
		// `+0` and turns one way, `(0, 1)` toward `(0, -1)` produces `-0`
		// and turns the other. Same shape of input, opposite result, which
		// is not something a caller can work around, so pick one. Note the
		// angle is set rather than the sine faked: a unit sine against a
		// cosine of -1 is a turn of 135 degrees, not 180.
		const angle =
			(sin === 0 && cos < 0 ? Math.PI : Math.atan2(sin, cos)) * alpha;
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		const len = lerp(lenA, lenB, alpha);
		this.x = (ax * c - ay * s) * len;
		this.y = (ax * s + ay * c) * len;
		return this;
	}

	/**
	 * Frame-rate independent exponential damping toward `target`.
	 * Wrapper around {@link damp} applied per component.
	 * @param target - vector to approach
	 * @param lambda - decay rate in `1/seconds` (higher = snappier)
	 * @param dt - delta time in **seconds**
	 * @returns Reference to this object for method chaining
	 * @example
	 * // smooth-follow a target point at a frame-rate independent rate:
	 * this.pos.damp(target.pos, 5, dt / 1000);
	 */
	damp(target: Vector2d, lambda: number, dt: number) {
		this.x = damp(this.x, target.x, lambda, dt);
		this.y = damp(this.y, target.y, lambda, dt);
		return this;
	}

	/**
	 * interpolate the position of this vector towards the given one by the given maximum step.
	 * @param target vector to rotate towards
	 * @param step - the maximum step per iteration (Negative values will push the vector away from the target)
	 * @returns Reference to this object for method chaining
	 */
	moveTowards(target: Vector2d, step: number) {
		const distance = this.distance(target);

		// within one step (and not fleeing): land exactly on the target —
		// and always mutate/return `this`, never the caller's target
		if (distance === 0 || (step >= 0 && distance <= step)) {
			this.x = target.x;
			this.y = target.y;
			return this;
		}

		const angle = Math.atan2(target.y - this.y, target.x - this.x);
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
