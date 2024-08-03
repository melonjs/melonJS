import { createPool } from "../system/pool";

/**
 * represents a point in a 2d space
 */
export class Point {
	/**
	 * the position of the point on the horizontal axis
	 * @default 0
	 */
	x: number;

	/**
	 * the position of the point on the vertical axis
	 * @default 0
	 */
	y: number;

	/**
	 * the shape type (used internally)
	 * @default "Point"
	 */
	type: "Point";

	constructor(x?: number | undefined, y?: number | undefined) {
		this.x = x ?? 0;
		this.y = y ?? 0;
		this.type = "Point";
	}

	/**
	 * set the Point x and y properties to the given values
	 * @param x horizontal coordinate
	 * @param y vertical coordinate
	 * @returns Reference to this object for method chaining
	 */
	set(x = 0, y = 0) {
		this.x = x;
		this.y = y;
		return this;
	}

	/**
	 * return true if this point is equal to the given point
	 * @param x horizontal coordinate
	 * @param [y] vertical coordinate
	 * @param args
	 * @returns
	 */
	equals(x: number, y: number): boolean;
	equals(point: Point): boolean;
	equals(xOrPoint: number | Point, y?: number | undefined) {
		if (typeof xOrPoint === "object") {
			return this.x === xOrPoint.x && this.y === xOrPoint.y;
		}
		return this.x === xOrPoint && this.y === y;
	}

	/**
	 * clone this Point
	 * @returns new Point
	 */
	clone() {
		return new Point(this.x, this.y);
	}
}

export const pointPool = createPool<
	Point,
	[x?: number | undefined, y?: number | undefined]
>((x, y) => {
	const instance = new Point(x, y);

	return {
		instance: instance,
		reset(x = 0, y = 0) {
			instance.x = x;
			instance.y = y;
		},
	};
});
