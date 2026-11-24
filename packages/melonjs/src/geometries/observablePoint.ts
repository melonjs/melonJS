import { Point } from "./point.ts";

/**
 * What a revoked ObservablePoint holds instead of its Point: a proxy revoked
 * here, so reading or writing the ObservablePoint after {@link ObservablePoint#revoke}
 * throws a `TypeError`, as it does on any revoked proxy. A live ObservablePoint
 * keeps a plain Point — no proxy on its hot path.
 * @ignore
 */
const _revoked = Proxy.revocable(new Point(), {});
_revoked.revoke();

/**
 * Represents a point in a 2D coordinate system that can be observed for changes.
 */
/**
 * Represents an observable point in 2D space.
 */
export class ObservablePoint {
	/**
	 * @ignore
	 * @internal
	 */
	private _callback: (() => void) | undefined;
	/**
	 * @ignore
	 * @internal
	 */
	private _point: Point;

	private callBackEnabled: boolean = true;

	type: "ObservablePoint";

	/**
	 * Creates a new ObservablePoint instance.
	 * @param x - The x-coordinate of the point. Default is 0.
	 * @param y - The y-coordinate of the point. Default is 0.
	 * @param callback - The callback function to be called when the point changes. Default is undefined.
	 */
	constructor(x: number = 0, y: number = 0, callback?: () => void) {
		this._point = new Point(x, y);

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
		if (this.callBackEnabled) {
			this._callback?.();
		}
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
		if (this.callBackEnabled) {
			this._callback?.();
		}
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
	equals(xOrPoint: number | ObservablePoint, y?: number) {
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
	 * Revokes this instance: reading or writing it afterwards throws a `TypeError`.
	 */
	revoke() {
		this._point = _revoked.proxy;
	}
}
