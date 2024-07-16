import { Matrix2d } from "../math/matrix2d.ts";
import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { Bounds, boundsPool } from "../physics/bounds.ts";
import { createPool } from "../system/pool.ts";
import { XYPoint } from "../utils/types.ts";
import { earcut } from "./earcut.ts";

export type PolygonVertices =
	| [XYPoint, XYPoint, XYPoint, ...XYPoint[]]
	| [Vector2d, Vector2d, Vector2d, ...Vector2d[]]
	| [number, number, number, number, number, number, ...number[]];

export type LineVertices =
	| [XYPoint, XYPoint]
	| [Vector2d, Vector2d]
	| [number, number, number, number];

/**
 * a polygon Object.<br>
 * Please do note that melonJS implements a simple Axis-Aligned Boxes collision algorithm, which requires all polygons used for collision to be convex with all vertices defined with clockwise winding.
 * A polygon is convex when all line segments connecting two points in the interior do not cross any edge of the polygon
 * (which means that all angles are less than 180 degrees), as described here below : <br>
 * <center><img src="images/convex_polygon.png"/></center><br>
 * A polygon's `winding` is clockwise if its vertices (points) are declared turning to the right. The image above shows COUNTERCLOCKWISE winding.
 */
export class Polygon {
	/**
	 * origin point of the Polygon
	 */
	pos: Vector2d;

	/**
	 * Array of points defining the Polygon <br>
	 * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
	 */
	points: Vector2d[];

	/**
	 * The edges here are the direction of the `n`th edge of the polygon, relative to
	 * the `n`th point. If you want to draw a given edge from the edge value, you must
	 * first translate to the position of the starting point.
	 */
	edges: Vector2d[];

	/**
	 * a list of indices for all vertices composing this polygon
	 */
	indices: number[];

	/**
	 * The normals here are the direction of the normal for the `n`th edge of the polygon, relative
	 * to the position of the `n`th point. If you want to draw an edge normal, you must first
	 * translate to the position of the starting point.
	 * @ignore
	 */
	normals: Vector2d[];

	/**
	 * The bounding rectangle for this shape
	 * @ignore
	 */
	private _bounds: Bounds;

	/**
	 * the shape type (used internally)
	 */
	type = "Polygon";

	/**
	 * @param [x=0] - origin point of the Polygon
	 * @param [y=0] - origin point of the Polygon
	 * @param vertices - array of vector defining the Polygon
	 */
	constructor(x = 0, y = 0, vertices: PolygonVertices | LineVertices) {
		this.pos = vector2dPool.get(x, y);
		this.points = [];
		this.edges = [];
		this.indices = [];
		this.normals = [];
		this._bounds = boundsPool.get();
		this.setVertices(vertices);
	}

	/**
	 * set new value to the Polygon
	 * @param x - position of the Polygon
	 * @param y - position of the Polygon
	 * @param points - array of vector or vertice defining the Polygon
	 * @returns this instance for objecf chaining
	 */
	setShape(x: number, y: number, points: PolygonVertices | LineVertices) {
		this.pos.set(x, y);
		this.setVertices(points);
		return this;
	}

	/**
	 * set the vertices defining this Polygon
	 * @param vertices - array of vector or vertice defining the Polygon
	 * @returns this instance for objecf chaining
	 */
	setVertices(vertices: PolygonVertices | LineVertices) {
		if (!Array.isArray(vertices)) {
			return this;
		}

		if (vertices.length < 2) {
			throw new Error("You must provide at least two vertices");
		}

		if (typeof vertices[0] === "number") {
			this.points = [];
			for (let p = 0; p < vertices.length; p += 2) {
				this.points.push(
					new Vector2d(
						(vertices as number[])[p],
						(vertices as number[])[p + 1],
					),
				);
			}
		} else if (vertices[0] instanceof Vector2d) {
			this.points = vertices as Vector2d[];
		} else {
			this.points = [];
			for (const vertex of vertices as XYPoint[]) {
				this.points.push(new Vector2d(vertex.x, vertex.y));
			}
		}

		this.recalc();
		this.updateBounds();
		return this;
	}

	/**
	 * apply the given transformation matrix to this Polygon
	 * @param m - the transformation matrix
	 * @returns Reference to this object for method chaining
	 */
	transform(m: Matrix2d) {
		const points = this.points;
		const len = points.length;
		for (let i = 0; i < len; i++) {
			m.apply(points[i]);
		}
		this.recalc();
		this.updateBounds();
		return this;
	}

	/**
	 * apply an isometric projection to this shape
	 * @returns Reference to this object for method chaining
	 */
	toIso() {
		return this.rotate(Math.PI / 4).scale(Math.SQRT2, Math.SQRT1_2);
	}

	/**
	 * apply a 2d projection to this shapen
	 * @returns Reference to this object for method chaining
	 */
	to2d() {
		return this.scale(Math.SQRT1_2, Math.SQRT2).rotate(-Math.PI / 4);
	}

	/**
	 * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
	 * @param angle - The angle to rotate (in radians)
	 * @param [v] - an optional point to rotate around
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v?: Vector2d | XYPoint | undefined) {
		if (angle !== 0) {
			const points = this.points;
			const len = points.length;
			for (let i = 0; i < len; i++) {
				points[i].rotate(angle, v);
			}
			this.recalc();
			this.updateBounds();
		}
		return this;
	}

	/**
	 * Scales the polygon by the given factors along the x and y axes.
	 * @param x - The factor by which to scale the polygon along the x-axis.
	 * @param [y=x] - The factor by which to scale the polygon along the y-axis. Defaults to the value of x.
	 * @returns Reference to this object for method chaining
	 */
	scale(x: number, y = x) {
		const points = this.points;
		const len = points.length;
		for (let i = 0; i < len; i++) {
			points[i].scale(x, y);
		}
		this.recalc();
		this.updateBounds();
		return this;
	}

	/**
	 * Scales the polygon by the given vector.
	 * @param v - A vector containing the scaling factors for the x and y axes.
	 * @returns Reference to this object for method chaining
	 */
	scaleV(v: Vector2d) {
		return this.scale(v.x, v.y);
	}

	/**
	 * Computes the calculated collision polygon.
	 * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
	 * @returns Reference to this object for method chaining
	 */
	recalc() {
		const edges = this.edges;
		const normals = this.normals;
		const indices = this.indices;

		// Copy the original points array and apply the offset/angle
		const points = this.points;
		const len = points.length;

		if (len < 3) {
			throw new Error("Requires at least 3 points");
		}

		// Calculate the edges/normals
		for (let i = 0; i < len; i++) {
			let edge = edges[i];
			if (typeof edge === "undefined") {
				edge = edges[i] = vector2dPool.get();
			}
			edge.copy(points[(i + 1) % len]).sub(points[i]);

			let normal = normals[i];
			if (typeof normal === "undefined") {
				normal = normals[i] = vector2dPool.get();
			}
			normal.copy(edge).perp().normalize();
		}

		// Release any existing Vector2d objects back to the pool
		for (let i = len; i < edges.length; i++) {
			vector2dPool.release(edges[i]);
			vector2dPool.release(normals[i]);
		}

		// trunc array
		edges.length = len;
		normals.length = len;

		// do not do anything here, indices will be computed by
		// getIndices if array is empty upon function call
		indices.length = 0;

		return this;
	}

	/**
	 * returns a list of indices for all triangles defined in this polygon
	 * @returns an array of vertex indices for all triangles forming this polygon.
	 */
	getIndices() {
		if (this.indices.length === 0) {
			this.indices = earcut(
				this.points.flatMap((p) => {
					return [p.x, p.y];
				}),
			);
		}
		return this.indices;
	}

	/**
	 * Returns true if the vertices composing this polygon form a convex shape (vertices must be in clockwise order).
	 * @returns true if the vertices are convex, false if not, null if not computable
	 */
	isConvex() {
		// http://paulbourke.net/geometry/polygonmesh/
		// Copyright (c) Paul Bourke (use permitted)

		let flag = 0;
		const vertices = this.points;
		const n = vertices.length;

		if (n < 3) {
			return null;
		}

		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			const k = (i + 2) % n;
			let z = (vertices[j].x - vertices[i].x) * (vertices[k].y - vertices[j].y);
			z -= (vertices[j].y - vertices[i].y) * (vertices[k].x - vertices[j].x);

			if (z < 0) {
				flag |= 1;
			} else if (z > 0) {
				flag |= 2;
			}

			if (flag === 3) {
				return false;
			}
		}

		if (flag !== 0) {
			return true;
		} else {
			return null;
		}
	}

	/**
	 * Translates the Polygon by the specified offset.
	 * @param x - The x offset or a vector point to translate by.
	 * @param [y] - The y offset. This parameter is required if the first parameter is a number.
	 * @returns Reference to this object for method chaining
	 * @example
	 * polygon.translate(10, 10);
	 * // or
	 * polygon.translate(myVector2d);
	 */
	translate(x: number, y: number): Polygon;
	translate(vector: Vector2d): Polygon;
	translate(xOrVector: Vector2d | number, y?: number) {
		let _x: number;
		let _y: number;

		if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
		} else {
			_x = xOrVector;
			_y = y!;
		}

		this.pos.x += _x;
		this.pos.y += _y;
		this.getBounds().translate(_x, _y);

		return this;
	}

	/**
	 * Shifts the Polygon to the given position vector.
	 * @param x - The x coordinate or a vector point to shift to.
	 * @param [y] - The y coordinate. This parameter is required if the first parameter is a number.
	 * @example
	 * polygon.shift(10, 10);
	 * // or
	 * polygon.shift(myVector2d);
	 */
	shift(x: number, y: number): void;
	shift(vector: Vector2d): void;
	shift(xOrVector: Vector2d | number, y?: number) {
		let _x;
		let _y;
		if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
		} else {
			_x = xOrVector;
			_y = y!;
		}
		this.pos.x = _x;
		this.pos.y = _y;
		this.updateBounds();
	}

	/**
	 * Returns true if the polygon contains the given point. <br>
	 * (Note: it is highly recommended to first do a hit test on the corresponding <br>
	 *  bounding rect, as the function can be highly consuming with complex shapes)
	 * @param x -  x coordinate or a vector point to check
	 * @param [y] - y coordinate
	 * @param args
	 * @returns True if the polygon contain the point, otherwise false
	 * @example
	 * if (polygon.contains(10, 10)) {
	 *   // do something
	 * }
	 * // or
	 * if (polygon.contains(myVector2d)) {
	 *   // do something
	 * }
	 */
	contains(x: number, y: number): boolean;
	contains(vector: Vector2d): boolean;
	contains(xOrVector: Vector2d | number, y?: number) {
		const [_x, _y]: [number, number] =
			xOrVector instanceof Vector2d
				? [xOrVector.x, xOrVector.y]
				: [xOrVector, y!];

		let intersects = false;
		const posx = this.pos.x;
		const posy = this.pos.y;
		const points = this.points;
		const len = points.length;

		//http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
		for (let i = 0, j = len - 1; i < len; j = i++) {
			const iy = points[i].y + posy;
			const ix = points[i].x + posx;
			const jy = points[j].y + posy;
			const jx = points[j].x + posx;
			if (
				iy > _y !== jy > _y &&
				_x < ((jx - ix) * (_y - iy)) / (jy - iy) + ix
			) {
				intersects = !intersects;
			}
		}
		return intersects;
	}

	/**
	 * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
	 * @returns this shape bounding box Rectangle object
	 */
	getBounds() {
		return this._bounds;
	}

	/**
	 * update the bounding box for this shape.
	 * @returns this shape bounding box Rectangle object
	 */
	updateBounds() {
		const bounds = this.getBounds();

		bounds.update(this.points);
		bounds.translate(this.pos);

		return bounds;
	}

	/**
	 * clone this Polygon
	 * @returns new Polygon
	 */
	clone() {
		return polygonPool.get(
			this.pos.x,
			this.pos.y,
			this.points.map((point) => point.clone()) as [
				Vector2d,
				Vector2d,
				Vector2d,
				...Vector2d[],
			],
		);
	}
}

export const polygonPool = createPool<
	Polygon,
	[x: number, y: number, vertices: PolygonVertices]
>((x, y, vertices) => {
	const polygon = new Polygon(x, y, vertices);
	return {
		instance: polygon,
		reset(x, y, points) {
			polygon.pos.set(x, y);
			polygon.setVertices(points);
		},
	};
});
