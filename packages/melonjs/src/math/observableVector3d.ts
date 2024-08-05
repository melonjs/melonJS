import { TupleToUnion } from "type-fest";
import { Vector2d } from "./vector2d";
import { Vector3d } from "./vector3d";
import { createPool } from "../system/pool.ts";
import { Point } from "../geometries/point.ts";

const propertiesToObserve = ["x", "y", "z"] as const;
type ObservableProperty = keyof Pick<
	Vector3d,
	TupleToUnion<typeof propertiesToObserve>
>;
const setOfProperties = new Set<ObservableProperty>(propertiesToObserve);

const isObservableProperty = (
	property: string | symbol,
): property is ObservableProperty => {
	return setOfProperties.has(property as any);
};

/**
 * Represents a point in a 3D coordinate vector that can be observed for changes.
 */
export class ObservableVector3d {
	private _callback: () => void;
	private _vector3d: Vector3d;
	private _revoke: () => void;

	private callBackEnabled: boolean = true;

	/**
	 * Creates a new ObservableVector3d instance.
	 * @param x - The x-coordinate of the vector. Default is 0.
	 * @param y - The y-coordinate of the vector. Default is 0.
	 * @param z - The z-coordinate of the vector. Default is 0.
	 * @param callback - The callback function to be called when the point changes. Default is undefined.
	 */
	constructor(
		x: number = 0,
		y: number = 0,
		z: number = 0,
		callback?: () => void,
	) {
		const { proxy, revoke } = Proxy.revocable(new Vector3d(x, y, z), {
			set: (target, property, value) => {
				if (isObservableProperty(property)) {
					Reflect.set(target, property, value);
					if (this.callBackEnabled) {
						this._callback?.();
					}
					return true;
				}
				return false;
			},
		});

		this._revoke = revoke;
		this._vector3d = proxy;

		if (callback) {
			this.setCallback(callback);
		}
	}

	/**
	 * Sets the x and y coordinates of the point.
	 * @param x - The new x-coordinate value.
	 * @param y - The new y-coordinate value.
	 * @param z - The new z-coordinate value.
	 * @returns Reference to this object for method chaining.
	 */
	set(x = 0, y = 0, z = 0) {
		this.callBackEnabled = false;
		this._vector3d.x = x;
		this._vector3d.y = y;
		this._vector3d.z = z;
		this._callback?.();
		this.callBackEnabled = true;
		return this;
	}

	/**
	 * Sets the x and y coordinates of the point without triggering the callback.
	 * @param x - The new x-coordinate value.
	 * @param y - The new y-coordinate value.
	 * @param z -
	 * @returns Reference to this object for method chaining.
	 */
	setMuted(x = 0, y = 0, z = 0) {
		this.callBackEnabled = false;
		this._vector3d.x = x;
		this._vector3d.y = y;
		this._vector3d.z = z;
		this.callBackEnabled = true;
		return this;
	}

	/**
	 * Gets the x-coordinate of the point.
	 */
	get x() {
		return this._vector3d.x;
	}

	/**
	 * Sets the x-coordinate of the point.
	 * @param value - The new x-coordinate value.
	 */
	set x(value: number) {
		this._vector3d.x = value;
	}

	/**
	 * Gets the y-coordinate of the point.
	 */
	get y() {
		return this._vector3d.y;
	}

	/**
	 * Sets the y-coordinate of the point.
	 * @param value - The new y-coordinate value.
	 */
	set y(value: number) {
		this._vector3d.y = value;
	}

	get z() {
		return this._vector3d.z;
	}

	set z(value: number) {
		this._vector3d.z = value;
	}

	/**
	 * Sets the callback function to be called when the point changes.
	 * @param callback - The callback function.
	 */
	setCallback(callback: () => void) {
		this._callback = callback;
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
	setV(v: Vector2d | Vector3d | ObservableVector3d) {
		return this.set(v.x, v.y, "z" in v ? v.z : undefined);
	}

	/**
	 * Add the passed vector to this vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	add(v: Vector2d | Vector3d | ObservableVector3d) {
		return this.set(this.x + v.x, this.y + v.y, this.z + ("z" in v ? v.z : 0));
	}

	/**
	 * Substract the passed vector to this vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	sub(v: Vector2d | Vector3d | ObservableVector3d) {
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
	scaleV(v: Vector3d | ObservableVector3d) {
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
		return this._vector3d.clamp(low, high);
	}

	/**
	 * Clamp this vector value within the specified value range
	 * @param low lower bound
	 * @param high upper bound
	 * @returns Reference to this object for method chaining
	 */
	clampSelf(low: number, high: number) {
		return this._vector3d.clampSelf(low, high);
	}

	/**
	 * Update this vector with the minimum value between this and the passed vector
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	minV(v: Vector2d | Vector3d | ObservableVector3d) {
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
	maxV(v: Vector2d | Vector3d | ObservableVector3d) {
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
		return this._vector3d.floor();
	}

	/**
	 * Floor this vector values
	 * @returns Reference to this object for method chaining
	 */
	floorSelf() {
		return this._vector3d.floorSelf();
	}

	/**
	 * Ceil the vector values
	 * @returns new Vector3d
	 */
	ceil() {
		return this._vector3d.ceil();
	}

	/**
	 * Ceil this vector values
	 * @returns Reference to this object for method chaining
	 */
	ceilSelf() {
		return this._vector3d.ceilSelf();
	}

	/**
	 * Negate the vector values
	 * @returns new Vector3d
	 */
	negate() {
		return this._vector3d.negate();
	}

	/**
	 * Negate this vector values
	 * @returns Reference to this object for method chaining
	 */
	negateSelf() {
		return this._vector3d.negateSelf();
	}

	/**
	 * Copy the components of the given vector into this one
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	copy(v: Vector2d | Vector3d | ObservableVector3d) {
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
			| [ObservableVector3d]
			| [number, number]
			| [number, number, number]
	): boolean {
		let _x: number;
		let _y: number;
		let _z: number;

		if (args.length === 1) {
			const arg = args[0];
			if (typeof arg === "object") {
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
		return this._vector3d.normalize();
	}

	/**
	 * change this vector to be perpendicular to what it was before.<br>
	 * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
	 * @returns Reference to this object for method chaining
	 */
	perp() {
		return this._vector3d.perp();
	}

	/**
	 * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
	 * @param angle - The angle to rotate (in radians)
	 * @param [v] - an optional point to rotate around (on the same z axis)
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v?: Vector2d | Point | undefined) {
		let cx = 0;
		let cy = 0;

		if (v) {
			cx = v.x;
			cy = v.y;
		}

		// TODO also rotate on the z axis if the given vector is a 3d one
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
	dot(v: Vector2d | Vector3d | ObservableVector3d) {
		return this._vector3d.dot(v as Vector3d);
	}

	/**
	 * calculate the cross product of this vector and the passed one
	 * @param v other vector
	 * @returns Reference to this object for method chaining
	 */
	cross(v: Vector3d | ObservableVector3d) {
		const ax = this.x;
		const ay = this.y;
		const az = this.z;
		const bx = v.x;
		const by = v.y;
		const bz = v.z;

		this.set(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);

		return this;
	}

	/**
	 * return the square length of this vector
	 * @returns The length^2 of this vector.
	 */
	length2(): number {
		return this._vector3d.length2();
	}

	/**
	 * return the length (magnitude) of this vector
	 * @returns the length of this vector
	 */
	length() {
		return this._vector3d.length();
	}

	/**
	 * Linearly interpolate between this vector and the given one.
	 * @param v other vector
	 * @param alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
	 * @returns Reference to this object for method chaining
	 */
	lerp(v: Vector3d | ObservableVector3d, alpha: number) {
		this.set(
			this.x + (v.x - this.x) * alpha,
			this.y + (v.y - this.y) * alpha,
			this.z + (v.z - this.z) * alpha,
		);
		return this;
	}

	/**
	 * interpolate the position of this vector on the x and y axis towards the given one by the given maximum step.
	 * @param target other vector
	 * @param step - the maximum step per iteration (Negative values will push the vector away from the target)
	 * @returns Reference to this object for method chaining
	 */
	moveTowards(target: Vector2d | Vector3d | ObservableVector3d, step: number) {
		const angle = Math.atan2(target.y - this.y, target.x - this.x);

		const dx = this.x - target.x;
		const dy = this.y - target.y;

		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance === 0 || (step >= 0 && distance <= step * step)) {
			return target;
		}

		this.set(
			this.x + Math.cos(angle) * step,
			this.y + Math.sin(angle) * step,
			this.z,
		);
		return this;
	}

	/**
	 * return the distance between this vector and the passed one
	 * @param v other vector
	 * @returns distance
	 */
	distance(v: Vector2d | Vector3d | ObservableVector3d) {
		return this._vector3d.distance(v as Vector3d);
	}

	/**
	 * return the angle between this vector and the passed one
	 * @param v other vector
	 * @returns angle in radians
	 */
	angle(v: Vector2d | Vector3d | ObservableVector3d) {
		return this._vector3d.angle(v as Vector3d);
	}

	/**
	 * project this vector on to another vector.
	 * @param v - The vector to project onto.
	 * @returns Reference to this object for method chaining
	 */
	project(v: Vector2d | Vector3d | ObservableVector3d) {
		const ratio = this.dot(v) / v.length2();
		return this.scale(ratio, ratio, ratio);
	}

	/**
	 * Project this vector onto a vector of unit length.<br>
	 * This is slightly more efficient than `project` when dealing with unit vectors.
	 * @param v - The unit vector to project onto.
	 * @returns Reference to this object for method chaining
	 */
	projectN(v: Vector2d | Vector3d | ObservableVector3d) {
		const ratio = this.dot(v) / v.length2();
		return this.scale(ratio, ratio, ratio);
	}

	/**
	 * return a clone copy of this vector
	 * @param [cb] callback function to override the clone values
	 * @returns new Vector3d
	 */
	clone(cb?: () => void) {
		return observableVector3dPool.get(this.x, this.y, this.z, cb);
	}

	/**
	 * convert the object to a string representation
	 * @returns stringified representation
	 */
	toString() {
		return this._vector3d.toString();
	}

	/**
	 * Revokes the proxy object, preventing further access to the ObservablePoint instance.
	 */
	revoke() {
		this._revoke();
	}
}

export const observableVector3dPool = createPool<
	ObservableVector3d,
	[
		x?: number | undefined,
		y?: number | undefined,
		z?: number | undefined,
		callback?: () => void,
	]
>((x, y, z, cb) => {
	const vector = new ObservableVector3d(x, y, z, cb);

	return {
		instance: vector,
		reset(x = 0, y = 0, z = 0, cb?: () => void): void {
			vector.setMuted(x, y, z);
			if (cb) {
				vector.setCallback(cb);
			}
		},
	};
});
