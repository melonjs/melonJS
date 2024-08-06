import { TupleToUnion } from "type-fest";
import { Vector2d, vector2dPool } from "./vector2d";
import { clamp } from "./math";

const propertiesToObserve = ["x", "y"] as const;
type ObservableProperty = keyof Pick<
	Vector2d,
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
 * @param options.currentX - The current x value.
 * @param options.currentY - The current y value.
 * @returns - The updated values or undefined. If the values are returned, they will become the new x and y values.
 */
export type ObservableVector2dUpdateFn = (options: {
	newX: number;
	newY: number;
	currentX: number;
	currentY: number;
}) => { x?: number | undefined; y?: number | undefined } | void;

export interface ObservableVector2d extends Vector2d {
	/**
	 * Returns a `Vector2d` copy of this `ObservableVector2d` object.
	 * @returns - The new Vector2d.
	 */
	toVector2d(): Vector2d;

	/**
	 * Sets the vector value without triggering the callback.
	 * @param x - The x value of the vector.
	 * @param y - The y value of the vector.
	 * @returns - Reference to this object for method chaining.
	 */
	setMuted(x: number, y: number): ObservableVector2d;

	/**
	 * Returns a clone copy of this vector.
	 * @returns - The cloned vector.
	 */
	clone(): ObservableVector2d;

	/**
	 * Negates the vector values.
	 * @returns - The negated vector.
	 */
	negate(): ObservableVector2d;

	/**
	 * Ceils the vector values.
	 * @returns - The ceiled vector.
	 */
	ceil(): ObservableVector2d;

	/**
	 * Floors the vector values.
	 * @returns - The floored vector.
	 */
	floor(): ObservableVector2d;

	/**
	 * Clamps the vector values within the specified value range.
	 * @param low - The lower bound.
	 * @param high - The upper bound.
	 * @returns - The clamped vector.
	 */
	clamp(low: number, high: number): ObservableVector2d;
}

interface CreateObservableVector2dOptions {
	target: Vector2d;
	updateFn: ObservableVector2dUpdateFn;
}

/**
 * Creates an observable vector.
 * This function wraps a given `Vector2d` object with a proxy that intercepts changes to the `x` and `y` properties,
 * allowing for custom update logic via the provided `updateFn` callback.
 * @param options - The options for creating the observable vector.
 * @param options.target - The target vector to be made observable.
 * @param options.updateFn - The update function to be called whenever the vector's properties change.
 * @returns - The observable vector with additional methods for vector manipulation.
 */
export const createObservableVector2d = (
	options: CreateObservableVector2dOptions,
) => {
	return new Proxy(options.target, {
		set(target, prop, newValue, receiver) {
			if (isObservableProperty(prop)) {
				const retVal = options.updateFn({
					newX: prop === "x" ? newValue : target.x,
					newY: prop === "y" ? newValue : target.y,
					currentX: target.x,
					currentY: target.y,
				});
				const newVal = retVal && prop in retVal ? retVal[prop] : newValue;
				return Reflect.set(target, prop, newVal, receiver);
			}

			return true;
		},
		get(target, prop: keyof ObservableVector2d, receiver) {
			if (prop === "toVector2d") {
				return () => {
					return vector2dPool.get(target.x, target.y);
				};
			}

			if (prop === "setMuted") {
				return (x: number, y: number) => {
					target.x = x;
					target.y = y;

					return receiver;
				};
			}

			if (prop === "set") {
				return (x: number, y: number) => {
					const retVal = options.updateFn({
						newX: x,
						newY: y,
						currentX: target.x,
						currentY: target.y,
					});
					if (
						retVal &&
						typeof retVal.x === "number" &&
						typeof retVal.y === "number"
					) {
						target.x = retVal.x;
						target.y = retVal.y;
					} else {
						target.x = x;
						target.y = y;
					}
					return receiver;
				};
			}

			if (prop === "clone") {
				return () =>
					createObservableVector2d({
						target: new Vector2d(target.x, target.y),
						updateFn: options.updateFn,
					});
			}

			if (prop === "clamp") {
				return (low: number, high: number) =>
					createObservableVector2d({
						target: new Vector2d(
							clamp(target.x, low, high),
							clamp(target.y, low, high),
						),
						updateFn: options.updateFn,
					});
			}

			if (prop === "negate" || prop === "ceil" || prop === "floor") {
				return () =>
					createObservableVector2d({
						target: target[prop](),
						updateFn: options.updateFn,
					});
			}
			return Reflect.get(target, prop, receiver);
		},
	}) as ObservableVector2d;
};
