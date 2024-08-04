import { Point } from "./point.ts";

/**
 * Represents a point in a 2D coordinate system that can be observed for changes.
 */
/**
 * Represents an observable point in 2D space.
 */
export class ObservablePoint {
	private _callback: () => void;
	private _point: Point;
	private _revoke: () => void;

	private callBackEnabled: boolean = true;

	type: "ObservablePoint";

	/**
	 * Creates a new ObservablePoint instance.
	 * @param x - The x-coordinate of the point. Default is 0.
	 * @param y - The y-coordinate of the point. Default is 0.
	 * @param callback - The callback function to be called when the point changes. Default is undefined.
	 */
	constructor(x: number = 0, y: number = 0, callback?: () => void) {
		const { proxy, revoke } = Proxy.revocable(new Point(x, y), {
			set: (target, property, value) => {
				if (property === "x" || property === "y") {
					Reflect.set(target, property, value);
					if (this.callBackEnabled) {
						this._callback?.();
					}
					return true;
				}
				return false;
			},
		});

		this.callBackEnabled = true;
		this._revoke = revoke;
		this._point = proxy;

		if (callback) {
			this.setCallback(callback);
		}
	}

	/**
	 * Sets the x and y coordinates of the point.
	 * @param x - The new x-coordinate value.
	 * @param y - The new y-coordinate value.
	 * @returns Reference to this object for method chaining.
	 */
	set(x = 0, y = 0) {
		this.callBackEnabled = false;
		this._point.x = x;
		this._point.y = y;
		this._callback?.();
		this.callBackEnabled = true;
		return this;
	}

	/**
	 * Sets the x and y coordinates of the point without triggering the callback.
	 * @param x - The new x-coordinate value.
	 * @param y - The new y-coordinate value.
	 * @returns Reference to this object for method chaining.
	 */
	setMuted(x = 0, y = 0) {
		this.callBackEnabled = false;
		this._point.x = x;
		this._point.y = y;
		this.callBackEnabled = true;
		return this;
	}

	/**
	 * Gets the x-coordinate of the point.
	 */
	get x() {
		return this._point.x;
	}

	/**
	 * Sets the x-coordinate of the point.
	 * @param value - The new x-coordinate value.
	 */
	set x(value: number) {
		this._point.x = value;
	}

	/**
	 * Gets the y-coordinate of the point.
	 */
	get y() {
		return this._point.y;
	}

	/**
	 * Sets the y-coordinate of the point.
	 * @param value - The new y-coordinate value.
	 */
	set y(value: number) {
		this._point.y = value;
	}

	/**
	 * Sets the callback function to be called when the point changes.
	 * @param callback - The callback function.
	 */
	setCallback(callback: () => void) {
		this._callback = callback;
	}

	/**
	 * Checks if the point is equal to the given coordinates or another ObservablePoint.
	 * @param x - The x-coordinate or the ObservablePoint to compare.
	 * @param y - The y-coordinate. Required if the first parameter is a number.
	 * @returns True if the point is equal to the given coordinates or another ObservablePoint, false otherwise.
	 */
	equals(x: number, y: number): boolean;
	equals(point: ObservablePoint): boolean;
	equals(xOrPoint: number | ObservablePoint, y?: number | undefined) {
		return this._point.equals(xOrPoint as any, y as any);
	}

	/**
	 * Creates a clone of the ObservablePoint.
	 * @returns A new ObservablePoint instance with the same coordinates and callback function.
	 */
	clone() {
		return new ObservablePoint(this._point.x, this._point.y, this._callback);
	}

	/**
	 * Revokes the proxy object, preventing further access to the ObservablePoint instance.
	 */
	revoke() {
		this._revoke();
	}
}
