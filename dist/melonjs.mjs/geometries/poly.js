/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import earcut from '../node_modules/earcut/src/earcut.js';
import Vector2d from '../math/vector2.js';
import pool from '../system/pooling.js';

/**
 * @classdesc
 * a polygon Object.<br>
 * Please do note that melonJS implements a simple Axis-Aligned Boxes collision algorithm, which requires all polygons used for collision to be convex with all vertices defined with clockwise winding.
 * A polygon is convex when all line segments connecting two points in the interior do not cross any edge of the polygon
 * (which means that all angles are less than 180 degrees), as described here below : <br>
 * <center><img src="images/convex_polygon.png"/></center><br>
 *
 * A polygon's `winding` is clockwise if its vertices (points) are declared turning to the right. The image above shows COUNTERCLOCKWISE winding.
 */
 class Polygon {
    /**
     * @param {number} x - origin point of the Polygon
     * @param {number} y - origin point of the Polygon
     * @param {Vector2d[]} points - array of vector defining the Polygon
     */
    constructor(x, y, points) {
        /**
         * origin point of the Polygon
         * @public
         * @type {Vector2d}
         * @name pos
         * @memberof Polygon
         */
        this.pos = pool.pull("Vector2d");

        /**
         * The bounding rectangle for this shape
         * @ignore
         * @member {Bounds}
         * @name _bounds
         * @memberof Polygon
         */
        this._bounds;

        /**
         * Array of points defining the Polygon <br>
         * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
         * @public
         * @type {Vector2d[]}
         * @name points
         * @memberof Polygon
         */
        this.points = [];

        /**
         * The edges here are the direction of the `n`th edge of the polygon, relative to
         * the `n`th point. If you want to draw a given edge from the edge value, you must
         * first translate to the position of the starting point.
         * @ignore
         */
        this.edges = [];

        /**
         * a list of indices for all vertices composing this polygon (@see earcut)
         * @ignore
         */
        this.indices = [];

        /**
         * The normals here are the direction of the normal for the `n`th edge of the polygon, relative
         * to the position of the `n`th point. If you want to draw an edge normal, you must first
         * translate to the position of the starting point.
         * @ignore
         */
        this.normals = [];

        // the shape type
        this.shapeType = "Polygon";
        this.setShape(x, y, points);
    }

    /** @ignore */
    onResetEvent(x, y, points) {
        this.setShape(x, y, points);
    }

    /**
     * set new value to the Polygon
     * @name setShape
     * @memberof Polygon
     * @param {number} x - position of the Polygon
     * @param {number} y - position of the Polygon
     * @param {Vector2d[]|number[]} points - array of vector or vertice defining the Polygon
     * @returns {Polygon} this instance for objecf chaining
     */
    setShape(x, y, points) {
        this.pos.set(x, y);
        this.setVertices(points);
        return this;
    }

    /**
     * set the vertices defining this Polygon
     * @name setVertices
     * @memberof Polygon
     * @param {Vector2d[]} vertices - array of vector or vertice defining the Polygon
     * @returns {Polygon} this instance for objecf chaining
     */
    setVertices(vertices) {

        if (!Array.isArray(vertices)) {
            return this;
        }

        // convert given points to me.Vector2d if required
        if (!(vertices[0] instanceof Vector2d)) {
            this.points.length = 0;

            if (typeof vertices[0] === "object") {
                // array of {x,y} object
                vertices.forEach((vertice) => {
                   this.points.push(pool.pull("Vector2d", vertice.x, vertice.y));
                });

            } else {
                // it's a flat array
                for (let p = 0; p < vertices.length; p += 2) {
                    this.points.push(pool.pull("Vector2d", vertices[p], vertices[p + 1]));
                }
            }
        } else {
            // array of me.Vector2d
            this.points = vertices;
        }

        this.recalc();
        this.updateBounds();
        return this;
    }

    /**
     * apply the given transformation matrix to this Polygon
     * @name transform
     * @memberof Polygon
     * @param {Matrix2d} m - the transformation matrix
     * @returns {Polygon} Reference to this object for method chaining
     */
    transform(m) {
        let points = this.points;
        let len = points.length;
        for (let i = 0; i < len; i++) {
            m.apply(points[i]);
        }
        this.recalc();
        this.updateBounds();
        return this;
    }

    /**
     * apply an isometric projection to this shape
     * @name toIso
     * @memberof Polygon
     * @returns {Polygon} Reference to this object for method chaining
     */
    toIso() {
        return this.rotate(Math.PI / 4).scale(Math.SQRT2, Math.SQRT1_2);
    }

    /**
     * apply a 2d projection to this shape
     * @name to2d
     * @memberof Polygon
     * @returns {Polygon} Reference to this object for method chaining
     */
    to2d() {
        return this.scale(Math.SQRT1_2, Math.SQRT2).rotate(-Math.PI / 4);
    }

    /**
     * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof Polygon
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Polygon} Reference to this object for method chaining
     */
    rotate(angle, v) {
        if (angle !== 0) {
            let points = this.points;
            let len = points.length;
            for (let i = 0; i < len; i++) {
                points[i].rotate(angle, v);
            }
            this.recalc();
            this.updateBounds();
        }
        return this;
    }

    /**
     * Scale this Polygon by the given scalar.
     * @name scale
     * @memberof Polygon
     * @param {number} x
     * @param {number} [y=x]
     * @returns {Polygon} Reference to this object for method chaining
     */
    scale(x, y = x) {
        let points = this.points;
        let len = points.length;
        for (let i = 0; i < len; i++) {
            points[i].scale(x, y);
        }
        this.recalc();
        this.updateBounds();
        return this;
    }

    /**
     * Scale this Polygon by the given vector
     * @name scaleV
     * @memberof Polygon
     * @param {Vector2d} v
     * @returns {Polygon} Reference to this object for method chaining
     */
    scaleV(v) {
        return this.scale(v.x, v.y);
    }

    /**
     * Computes the calculated collision polygon.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @name recalc
     * @memberof Polygon
     * @returns {Polygon} Reference to this object for method chaining
     */
    recalc() {
        let i;
        let edges = this.edges;
        let normals = this.normals;
        let indices = this.indices;

        // Copy the original points array and apply the offset/angle
        let points = this.points;
        let len = points.length;

        if (len < 3) {
            throw new Error("Requires at least 3 points");
        }

        // Calculate the edges/normals
        for (i = 0; i < len; i++) {
            if (edges[i] === undefined) {
                edges[i] = pool.pull("Vector2d");
            }
            edges[i].copy(points[(i + 1) % len]).sub(points[i]);

            if (normals[i] === undefined) {
                normals[i] = pool.pull("Vector2d");
            }
            normals[i].copy(edges[i]).perp().normalize();
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
     * @name getIndices
     * @memberof Polygon
     * @returns {Array} an array of vertex indices for all triangles forming this polygon.
     */
    getIndices() {
        if (this.indices.length === 0) {
            this.indices = earcut(this.points.flatMap(p => [p.x, p.y]));
        }
        return this.indices;
    }

    /**
     * Returns true if the vertices composing this polygon form a convex shape (vertices must be in clockwise order).
     * @name isConvex
     * @memberof Polygon
     * @returns {boolean} true if the vertices are convex, false if not, null if not computable
     */
    isConvex() {
        // http://paulbourke.net/geometry/polygonmesh/
        // Copyright (c) Paul Bourke (use permitted)

        let flag = 0,
            vertices = this.points,
            n = vertices.length,
            i,
            j,
            k,
            z;

        if (n < 3) {
            return null;
        }

        for (i = 0; i < n; i++) {
            j = (i + 1) % n;
            k = (i + 2) % n;
            z = (vertices[j].x - vertices[i].x) * (vertices[k].y - vertices[j].y);
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
     * translate the Polygon by the specified offset
     * @name translate
     * @memberof Polygon
     * @method
     * @param {number} x - x offset
     * @param {number} y - y offset
     * @returns {Polygon} this Polygon
     */
    /**
     * translate the Polygon by the specified vector
     * @name translate
     * @memberof Polygon
     * @param {Vector2d} v - vector offset
     * @returns {Polygon} Reference to this object for method chaining
     */
    translate() {
        let _x, _y;

        if (arguments.length === 2) {
            // x, y
            _x = arguments[0];
            _y = arguments[1];
        } else {
            // vector
            _x = arguments[0].x;
            _y = arguments[0].y;
        }

        this.pos.x += _x;
        this.pos.y += _y;
        this.getBounds().translate(_x, _y);

        return this;
    }

    /**
     * Shifts the Polygon to the given position vector.
     * @name shift
     * @memberof Polygon
     * @method
     * @param {Vector2d} position
     */
    /**
     * Shifts the Polygon to the given x, y position.
     * @name shift
     * @memberof Polygon
     * @param {number} x
     * @param {number} y
     */
    shift() {
        let _x, _y;
        if (arguments.length === 2) {
            // x, y
            _x = arguments[0];
            _y = arguments[1];
        } else {
            // vector
            _x = arguments[0].x;
            _y = arguments[0].y;
        }
        this.pos.x = _x;
        this.pos.y = _y;
        this.updateBounds();
    }

    /**
     * Returns true if the polygon contains the given point.
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name contains
     * @memberof Polygon
     * @method
     * @param {Vector2d} point
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the polygon contains the given point. <br>
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @name contains
     * @memberof Polygon
     * @param  {number} x -  x coordinate
     * @param  {number} y -  y coordinate
     * @returns {boolean} true if contains
     */
    contains() {
        let _x, _y;

        if (arguments.length === 2) {
          // x, y
          _x = arguments[0];
          _y = arguments[1];
        } else {
          // vector
          _x = arguments[0].x;
          _y = arguments[0].y;
        }

        let intersects = false;
        let posx = this.pos.x, posy = this.pos.y;
        let points = this.points;
        let len = points.length;

        //http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
        for (let i = 0, j = len - 1; i < len; j = i++) {
            const iy = points[i].y + posy, ix = points[i].x + posx,
                  jy = points[j].y + posy, jx = points[j].x + posx;
            if (((iy > _y) !== (jy > _y)) && (_x < (jx - ix) * (_y - iy) / (jy - iy) + ix)) {
                intersects = !intersects;
            }
        }
        return intersects;
    }

    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @name getBounds
     * @memberof Polygon
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    getBounds() {
        if (typeof this._bounds === "undefined") {
            this._bounds = pool.pull("Bounds");
        }
        return this._bounds;
    }

    /**
     * update the bounding box for this shape.
     * @name updateBounds
     * @memberof Polygon
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    updateBounds() {
        let bounds = this.getBounds();

        bounds.update(this.points);
        bounds.translate(this.pos);

        return bounds;
    }

    /**
     * clone this Polygon
     * @name clone
     * @memberof Polygon
     * @returns {Polygon} new Polygon
     */
    clone() {
        let copy = [];
        this.points.forEach((point) => {
            copy.push(point.clone());
        });
        return new Polygon(this.pos.x, this.pos.y, copy);
    }
}

export { Polygon as default };
