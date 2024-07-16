import { TupleToUnion } from "type-fest";
import { clamp } from "./math";
import { Vector3d, vector3dPool } from "./vector3d";

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
 * Function type for the observable vector update callback.
 * @param options - The update options.
 * @param options.newX - The new x value.
 * @param options.newY - The new y value.
 * @param options.newZ - The new z value.
 * @param options.currentX - The current x value.
 * @param options.currentY - The current y value.
 * @param options.currentZ - The current z value.
 * @returns - The updated values or undefined. If the values are returned, they will become the new x,y and z values.
 */
export type ObservableVector3dUpdateFn = (options: {
	newX: number;
	newY: number;
	newZ: number;
	currentX: number;
	currentY: number;
	currentZ: number;
}) => {
	x?: number | undefined;
	y?: number | undefined;
	z?: number | undefined;
} | void;

export interface ObservableVector3d extends Vector3d {
	/**
	 * Returns a `Vector3d` copy of this `ObservableVector3d` object.
	 * @returns - The new Vector3d.
	 */
	toVector3d(): Vector3d;

	/**
	 * Sets the vector value without triggering the callback.
	 * @param x - The x value of the vector.
	 * @param y - The y value of the vector.
	 * @returns - Reference to this object for method chaining.
	 */
	setMuted(x: number, y: number, z: number): ObservableVector3d;

	/**
	 * Returns a clone copy of this vector.
	 * @returns - The cloned vector.
	 */
	clone(): ObservableVector3d;

	/**
	 * Negates the vector values.
	 * @returns - The negated vector.
	 */
	negate(): ObservableVector3d;

	/**
	 * Ceils the vector values.
	 * @returns - The ceiled vector.
	 */
	ceil(): ObservableVector3d;

	/**
	 * Floors the vector values.
	 * @returns - The floored vector.
	 */
	floor(): ObservableVector3d;

	/**
	 * Clamps the vector values within the specified value range.
	 * @param low - The lower bound.
	 * @param high - The upper bound.
	 * @returns - The clamped vector.
	 */
	clamp(low: number, high: number): ObservableVector3d;
}

interface CreateObservableVector3dOptions {
	target: Vector3d;
	updateFn: ObservableVector3dUpdateFn;
}

/**
 * Creates an observable vector.
 * This function wraps a given `Vector3d` object with a proxy that intercepts changes to the `x`, `y`, and `z` properties,
 * allowing for custom update logic via the provided `updateFn` callback.
 * @param options - The options for creating the observable vector.
 * @param options.target - The target vector to be made observable.
 * @param options.updateFn - The update function to be called whenever the vector's properties change.
 * @returns - The observable vector with additional methods for vector manipulation.
 */
export const createObservableVector3d = (
	options: CreateObservableVector3dOptions,
) => {
	return new Proxy(options.target, {
		set(target, prop, newValue, receiver) {
			if (isObservableProperty(prop)) {
				const retVal = options.updateFn({
					newX: prop === "x" ? newValue : target.x,
					newY: prop === "y" ? newValue : target.y,
					newZ: prop === "z" ? newValue : target.z,
					currentX: target.x,
					currentY: target.y,
					currentZ: target.z,
				});
				const newVal = retVal && prop in retVal ? retVal[prop] : newValue;
				return Reflect.set(target, prop, newVal, receiver);
			}

			return true;
		},
		get(target, prop: keyof ObservableVector3d, receiver) {
			if (prop === "toVector3d") {
				return () => {
					return vector3dPool.get(target.x, target.y, target.z);
				};
			}

			if (prop === "setMuted") {
				return (x: number, y: number, z: number) => {
					target.x = x;
					target.y = y;
					target.z = z;

					return receiver;
				};
			}

			if (prop === "set") {
				return (x: number, y: number, z: number) => {
					const retVal = options.updateFn({
						newX: x,
						newY: y,
						newZ: z,
						currentX: target.x,
						currentY: target.y,
						currentZ: target.z,
					});
					if (
						retVal &&
						typeof retVal.x === "number" &&
						typeof retVal.y === "number" &&
						typeof retVal.z === "number"
					) {
						target.x = retVal.x;
						target.y = retVal.y;
						target.z = retVal.z;
					} else {
						target.x = x;
						target.y = y;
						target.z = z;
					}
					return receiver;
				};
			}

			if (prop === "clone") {
				return () =>
					createObservableVector3d({
						target: new Vector3d(target.x, target.y, target.z),
						updateFn: options.updateFn,
					});
			}

			if (prop === "clamp") {
				return (low: number, high: number) =>
					createObservableVector3d({
						target: new Vector3d(
							clamp(target.x, low, high),
							clamp(target.y, low, high),
							clamp(target.z, low, high),
						),
						updateFn: options.updateFn,
					});
			}

			if (prop === "negate" || prop === "ceil" || prop === "floor") {
				return () =>
					createObservableVector3d({
						target: target[prop](),
						updateFn: options.updateFn,
					});
			}
			return Reflect.get(target, prop, receiver);
		},
	}) as ObservableVector3d;
};
