import { createPool } from "../system/pool.ts";
import { XYPoint } from "../utils/types.ts";
import { clamp, damp, lerp } from "./math.ts";
import { Vector2d } from "./vector2d.ts";

/**
 * How near parallel (or antiparallel) two directions have to be before
 * {@link Vector3d.slerp} stops trusting the great circle between them.
 *
 * `sin(angle)` is the divisor, and it is what vanishes at both ends. This is
 * stated as a COSINE rather than an angle so the test costs no `acos`: at
 * 1e-6 it trips about a twentieth of a degree from either extreme, where the
 * sine has already fallen to roughly 1.4e-3 and the weights it divides are
 * starting to lose their meaning.
 */
const SLERP_EPSILON = 1e-6;

/**
 * a generic 3D Vector Object
 * @category Math
 */
export class Vector3d {
	x: number;
	y: number;
	z: number;

	/**
	 * @param [x] - x value of the vector
	 * @param [y] - y value of the vector
	 * @param [z] - z value of the vector
	 */
	constructor(x = 0, y = 0, z = 0) {
		this.onResetEvent(x, y, z);
	}

	onResetEvent(x = 0, y = 0, z = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	/**
	 * set the Vector x and y properties to the given values
	 * @param x x component
	 * @param y y component
	 * @param [z] z component
	 * @returns Reference to this object for method chaining
	 */
	set(x: number, y: number, z: number | undefined = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}

	/**
	 * set the Vector x and y properties to 0
	 * @returns Reference to this object for method chaining
	 */
	setZero() {
		return this.set(0, 0, 0);
	}

	/**
	 * set the Vector x and y properties using the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	setV(v: Vector2d | Vector3d) {
		return this.set(v.x, v.y, "z" in v ? v.z : undefined);
	}

	/**
	 * Add the passed vector to this vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	add(v: Vector2d | Vector3d) {
		return this.set(this.x + v.x, this.y + v.y, this.z + ("z" in v ? v.z : 0));
	}

	/**
	 * Subtract the passed vector from this vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	sub(v: Vector2d | Vector3d) {
		return this.set(this.x - v.x, this.y - v.y, this.z - ("z" in v ? v.z : 0));
	}

	/**
	 * Multiply this vector values by the given scalar
	 * @param x x component
	 * @param [y] y component
	 * @param [z] z component
	 * @returns Reference to this object for method chaining
	 */
	scale(x: number, y = x, z = 1) {
		return this.set(this.x * x, this.y * y, this.z * z);
	}

	/**
	 * Multiply this vector values by the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	scaleV(v: Vector3d) {
		return this.scale(v.x, v.y, v.z);
	}

	/**
	 * Convert this vector into isometric coordinate space
	 * @returns Reference to this object for method chaining
	 */
	toIso() {
		return this.set(this.x - this.y, (this.x + this.y) * 0.5, this.z);
	}

	/**
	 * Convert this vector into 2d coordinate space
	 * @returns Reference to this object for method chaining
	 */
	to2d() {
		return this.set(this.y + this.x / 2, this.y - this.x / 2, this.z);
	}

	/**
	 * Divide this vector values by the passed value
	 * @param n - the value to divide the vector by
	 * @returns Reference to this object for method chaining
	 */
	div(n: number) {
		return this.set(this.x / n, this.y / n, this.z / n);
	}

	/**
	 * Update this vector values to absolute values
	 * @returns Reference to this object for method chaining
	 */
	abs() {
		return this.set(
			this.x < 0 ? -this.x : this.x,
			this.y < 0 ? -this.y : this.y,
			this.z < 0 ? -this.z : this.z,
		);
	}

	/**
	 * Clamp the vector value within the specified value range
	 * @param low lower bound
	 * @param high upper bound
	 * @returns new Vector3d
	 */
	clamp(low: number, high: number) {
		return new Vector3d(
			clamp(this.x, low, high),
			clamp(this.y, low, high),
			clamp(this.z, low, high),
		);
	}

	/**
	 * Clamp this vector value within the specified value range
	 * @param low lower bound
	 * @param high upper bound
	 * @returns Reference to this object for method chaining
	 */
	clampSelf(low: number, high: number) {
		return this.set(
			clamp(this.x, low, high),
			clamp(this.y, low, high),
			clamp(this.z, low, high),
		);
	}

	/**
	 * Update this vector with the minimum value between this and the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	minV(v: Vector2d | Vector3d) {
		const _vz = "z" in v ? v.z : 0;
		return this.set(
			this.x < v.x ? this.x : v.x,
			this.y < v.y ? this.y : v.y,
			this.z < _vz ? this.z : _vz,
		);
	}

	/**
	 * Update this vector with the maximum value between this and the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	maxV(v: Vector2d | Vector3d) {
		const _vz = "z" in v ? v.z : 0;
		return this.set(
			this.x > v.x ? this.x : v.x,
			this.y > v.y ? this.y : v.y,
			this.z > _vz ? this.z : _vz,
		);
	}

	/**
	 * Floor the vector values
	 * @returns new Vector3d
	 */
	floor() {
		return new Vector3d(
			Math.floor(this.x),
			Math.floor(this.y),
			Math.floor(this.z),
		);
	}

	/**
	 * Floor this vector values
	 * @returns Reference to this object for method chaining
	 */
	floorSelf() {
		return this.set(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
	}

	/**
	 * Ceil the vector values
	 * @returns new Vector3d
	 */
	ceil() {
		return new Vector3d(
			Math.ceil(this.x),
			Math.ceil(this.y),
			Math.ceil(this.z),
		);
	}

	/**
	 * Ceil this vector values
	 * @returns Reference to this object for method chaining
	 */
	ceilSelf() {
		return this.set(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
	}

	/**
	 * Negate the vector values
	 * @returns new Vector3d
	 */
	negate() {
		return new Vector3d(-this.x, -this.y, -this.z);
	}

	/**
	 * Negate this vector values
	 * @returns Reference to this object for method chaining
	 */
	negateSelf() {
		return this.set(-this.x, -this.y, -this.z);
	}

	/**
	 * Copy the components of the given vector into this one
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	copy(v: Vector2d | Vector3d) {
		return this.set(v.x, v.y, "z" in v ? v.z : 0);
	}

	/**
	 * return true if this vector is equal to the given values or vector
	 * @param args other vector or vector components
	 * @returns true if both vectors are equal
	 */
	equals(
		...args:
			| [number]
			| [Vector2d]
			| [Vector3d]
			| [number, number]
			| [number, number, number]
	): boolean {
		let _x: number;
		let _y: number;
		let _z: number;

		if (args.length === 1) {
			const arg = args[0];
			if (arg instanceof Vector2d || arg instanceof Vector3d) {
				[_x, _y, _z] = [arg.x, arg.y, "z" in arg ? arg.z : this.z];
			} else {
				_x = arg;
				_y = this.y;
				_z = this.z;
			}
		} else if (args.length === 2) {
			[_x, _y, _z] = [args[0], args[1], this.z];
		} else {
			[_x, _y, _z] = args;
		}

		return this.x === _x && this.y === _y && this.z === _z;
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
	 * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
	 * @returns Reference to this object for method chaining
	 */
	perp() {
		return this.set(this.y, -this.x, this.z);
	}

	/**
	 * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
	 * @param angle - The angle to rotate (in radians)
	 * @param [v] - an optional point to rotate around
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v?: XYPoint | Vector3d) {
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

		return this.set(x * c - y * s + cx, x * s + y * c + cy, this.z);
	}

	/**
	 * return the dot product of this vector and the passed one
	 * @param v other vector
	 * @returns The dot product.
	 */
	dot(v: Vector2d | Vector3d) {
		return this.x * v.x + this.y * v.y + this.z * ("z" in v ? v.z : this.z);
	}

	/**
	 * calculate the cross product of this vector and the passed one
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	cross(v: Vector3d) {
		const ax = this.x;
		const ay = this.y;
		const az = this.z;
		const bx = v.x;
		const by = v.y;
		const bz = v.z;

		this.x = ay * bz - az * by;
		this.y = az * bx - ax * bz;
		this.z = ax * by - ay * bx;

		return this;
	}

	/**
	 * return the square length of this vector
	 * @returns The length^2 of this vector.
	 */
	length2(): number {
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
	 * use {@link Vector3d.damp} instead.
	 * @param v - other vector
	 * @param alpha - distance along the line (alpha = 0 → this vector, alpha = 1 → `v`)
	 * @returns Reference to this object for method chaining
	 */
	lerp(v: Vector3d, alpha: number) {
		this.x = lerp(this.x, v.x, alpha);
		this.y = lerp(this.y, v.y, alpha);
		this.z = lerp(this.z, v.z, alpha);
		return this;
	}

	/**
	 * Spherically interpolate between this vector and the given one.
	 *
	 * Where {@link Vector3d.lerp} cuts straight across the chord, this runs
	 * along the great circle between the two DIRECTIONS at constant angular
	 * speed. Reach for it whenever a direction matters more than the
	 * components carrying it: a camera swinging to look somewhere, a body
	 * moving across the face of a planet, one axis turning onto another. A
	 * lerp between two directions is not wrong so much as uneven, since it
	 * slows at the ends and runs fast through the middle, and it shortens
	 * the vector as it passes the midpoint.
	 *
	 * The length is interpolated linearly alongside the direction, so two
	 * unit vectors give a unit vector and two of equal length keep it. There
	 * is no need to normalize the inputs or the result.
	 *
	 * Two cases have no great circle to run along, and both are reached by
	 * ordinary game code rather than by abuse:
	 *
	 * - the two directions are the SAME, so every path between them is the
	 *   same path. Falls back to a straight interpolation.
	 * - the two directions are OPPOSITE, where infinitely many great circles
	 *   pass through both and none of them is the answer. Rather than divide
	 *   by a vanishing sine and hand back `NaN`, an axis perpendicular to
	 *   both is chosen and the turn runs through that, which is stable from
	 *   frame to frame as the inputs drift past each other.
	 * @param v - the vector to interpolate toward
	 * @param alpha - 0 leaves this vector alone, 1 reaches `v`
	 * @returns Reference to this object for method chaining
	 * @example
	 * // swing a camera's facing a third of the way onto its target
	 * facing.slerp(toTarget, 0.33);
	 * @example
	 * // frame-rate independent: raise alpha with the frame's own elapsed time
	 * facing.slerp(toTarget, 1 - Math.exp(-6 * dt / 1000));
	 */
	slerp(v: Vector3d, alpha: number) {
		const lenA = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
		const lenB = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
		// a zero vector has no direction to turn, so there is nothing a
		// great circle could mean here
		if (lenA === 0 || lenB === 0) {
			return this.lerp(v, alpha);
		}
		const ax = this.x / lenA;
		const ay = this.y / lenA;
		const az = this.z / lenA;
		const bx = v.x / lenB;
		const by = v.y / lenB;
		const bz = v.z / lenB;
		// No clamp before the `acos` below, and that is deliberate rather
		// than an oversight. The dot of two freshly normalized vectors does
		// routinely land a few ulps past 1, where `Math.acos` returns `NaN`
		// — but the two branches below intercept everything within
		// `SLERP_EPSILON` of either extreme, so by the time `acos` is
		// reached the value is well inside its domain. A clamp here would be
		// unreachable, which is worse than absent: it would read as the
		// thing keeping `acos` safe, and the branches would be free to
		// change out from under it.
		const cos = ax * bx + ay * by + az * bz;
		const len = lerp(lenA, lenB, alpha);

		let dx: number;
		let dy: number;
		let dz: number;
		if (cos > 1 - SLERP_EPSILON) {
			// the same direction: interpolate straight and renormalize
			dx = lerp(ax, bx, alpha);
			dy = lerp(ay, by, alpha);
			dz = lerp(az, bz, alpha);
			const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
			dx /= l;
			dy /= l;
			dz /= l;
		} else if (cos < SLERP_EPSILON - 1) {
			// OPPOSITE directions. Any axis perpendicular to `a` serves, and
			// the one chosen has to be stable: crossing with whichever world
			// axis `a` leans on least cannot itself degenerate, where a fixed
			// choice collapses whenever `a` happens to lie along it.
			let px = 0;
			let py = 0;
			let pz = 0;
			if (Math.abs(ax) <= Math.abs(ay) && Math.abs(ax) <= Math.abs(az)) {
				px = 1;
			} else if (Math.abs(ay) <= Math.abs(az)) {
				py = 1;
			} else {
				pz = 1;
			}
			// perpendicular = normalize(a x p)
			let ux = ay * pz - az * py;
			let uy = az * px - ax * pz;
			let uz = ax * py - ay * px;
			const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
			ux /= ul;
			uy /= ul;
			uz /= ul;
			// turn `a` through half a circle about that axis
			const theta = Math.PI * alpha;
			const c = Math.cos(theta);
			const sn = Math.sin(theta);
			dx = ax * c + ux * sn;
			dy = ay * c + uy * sn;
			dz = az * c + uz * sn;
		} else {
			const angle = Math.acos(cos);
			const sin = Math.sin(angle);
			const wa = Math.sin((1 - alpha) * angle) / sin;
			const wb = Math.sin(alpha * angle) / sin;
			dx = ax * wa + bx * wb;
			dy = ay * wa + by * wb;
			dz = az * wa + bz * wb;
		}

		this.x = dx * len;
		this.y = dy * len;
		this.z = dz * len;
		return this;
	}

	/**
	 * Frame-rate independent exponential damping toward `target`.
	 * Wrapper around {@link damp} applied per component.
	 * @param target - vector to approach (Vector2d treats `z` as 0)
	 * @param lambda - decay rate in `1/seconds` (higher = snappier)
	 * @param dt - delta time in **seconds**
	 * @returns Reference to this object for method chaining
	 * @example
	 * // smooth-follow a Camera3d target at a frame-rate independent rate:
	 * camera.pos.damp(target.pos, 5, dt / 1000);
	 */
	damp(target: Vector2d | Vector3d, lambda: number, dt: number) {
		this.x = damp(this.x, target.x, lambda, dt);
		this.y = damp(this.y, target.y, lambda, dt);
		this.z = damp(this.z, "z" in target ? target.z : 0, lambda, dt);
		return this;
	}

	/**
	 * interpolate the position of this vector on the x and y axis towards the given one by the given maximum step.
	 * @param target other vector
	 * @param step - the maximum step per iteration (Negative values will push the vector away from the target)
	 * @returns Reference to this object for method chaining
	 */
	moveTowards(target: Vector2d | Vector3d, step: number) {
		const dx = target.x - this.x;
		const dy = target.y - this.y;

		const distance = Math.sqrt(dx * dx + dy * dy);

		// within one step (and not fleeing): land exactly on the target (x/y
		// only, this is a 2D interpolation) — and always mutate/return `this`,
		// never the caller's target
		if (distance === 0 || (step >= 0 && distance <= step)) {
			this.x = target.x;
			this.y = target.y;
			return this;
		}

		const angle = Math.atan2(dy, dx);
		this.x += Math.cos(angle) * step;
		this.y += Math.sin(angle) * step;

		return this;
	}

	/**
	 * return the distance between this vector and the passed one
	 * @param v other vector
	 * @returns distance
	 */
	distance(v: Vector2d | Vector3d) {
		const dx = this.x - v.x;
		const dy = this.y - v.y;
		const dz = this.z - ("z" in v ? v.z : 0);
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	/**
	 * return the angle between this vector and the passed one
	 * @param v other vector
	 * @returns angle in radians
	 */
	angle(v: Vector2d | Vector3d) {
		return Math.acos(clamp(this.dot(v) / (this.length() * v.length()), -1, 1));
	}

	/**
	 * project this vector on to another vector.
	 * @param v - The vector to project onto.
	 * @returns Reference to this object for method chaining
	 */
	project(v: Vector2d | Vector3d) {
		const ratio = this.dot(v) / v.length2();
		return this.scale(ratio, ratio, ratio);
	}

	/**
	 * Project this vector onto a vector of unit length.<br>
	 * This is slightly more efficient than `project` when dealing with unit vectors.
	 * @param v - The unit vector to project onto.
	 * @returns Reference to this object for method chaining
	 */
	projectN(v: Vector2d | Vector3d) {
		// no division: `v` is unit, so `v.length2()` is 1. That divide was
		// here, which made this an exact copy of `project` and the method
		// pointless; the 2D classes never had it.
		const ratio = this.dot(v);
		return this.scale(ratio, ratio, ratio);
	}

	/**
	 * return a clone copy of this vector
	 * @returns new Vector3d
	 */
	clone() {
		return vector3dPool.get(this.x, this.y, this.z);
	}

	/**
	 * convert the object to a string representation
	 * @returns stringified representation
	 */
	toString() {
		return `x:${this.x},y:${this.y},z:${this.z}` as const;
	}
}

export const vector3dPool = createPool<
	Vector3d,
	[x?: number | undefined, y?: number | undefined, z?: number | undefined]
>((x, y, z) => {
	const vector = new Vector3d(x, y, z);

	return {
		instance: vector,
		reset(x = 0, y = 0, z = 0) {
			vector.x = x;
			vector.y = y;
			vector.z = z;
		},
	};
});
