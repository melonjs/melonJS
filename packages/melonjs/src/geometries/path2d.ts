import { TAU } from "./../math/math.ts";
import { earcut } from "./earcut.ts";
import { type Point, pointPool } from "./point.ts";
import { endpointToCenterParameterization } from "./toarccanvas.ts";

/**
 * A 2D path builder used by both the WebGL and Canvas renderers to build and
 * interpolate paths from SVG command strings or direct method calls. Its method
 * semantics follow the standard
 * [Path2D](https://developer.mozilla.org/en-US/docs/Web/API/Path2D) API.
 *
 * Each renderer exposes a reusable instance as `renderer.path2D`; you can also
 * create your own with `new Path2D()`. Build a path (via {@link parseSVGPath} or
 * the imperative {@link moveTo}/{@link lineTo}/curve methods), then draw it with
 * the renderer's `stroke()` (outline) and `fill()` (solid) methods. Curves and
 * arcs are flattened into line segments; {@link arcResolution} controls how fine
 * that approximation is.
 *
 * **Sub-paths & holes:** a new sub-path begins on every {@link moveTo} (and on
 * each `M` in an SVG string). When filled, the first sub-path is the outer
 * contour and each subsequent sub-path is treated as a hole — so shapes with
 * holes or disconnected regions (a donut, a ring, the letter "O", text outlines)
 * fill correctly. The Canvas renderer fills via the native non-zero winding rule
 * (so holes should be wound opposite to the outer contour); the WebGL renderer
 * triangulates with holes via earcut, which matches that result for the usual
 * case of oppositely-wound holes. Sub-path boundaries are tracked in
 * {@link subPaths}.
 *
 * Supported SVG commands: `M`, `L`, `H`, `V`, `Q`, `C`, `A`, `Z` (uppercase /
 * absolute only; `H` and `V` take a relative offset).
 * @example
 * // build a path with the imperative API, then fill and outline it
 * const path = renderer.path2D;
 * path.beginPath();
 * path.moveTo(50, 0);
 * path.lineTo(100, 100);
 * path.lineTo(0, 100);
 * path.closePath();
 * renderer.setColor("#4CAF50");
 * renderer.fill(); // fill the current path
 * renderer.setColor("#1B5E20");
 * renderer.stroke(); // outline the current path
 * @example
 * // the same triangle from an SVG path string
 * renderer.path2D.parseSVGPath("M 50 0 L 100 100 L 0 100 Z");
 * renderer.fill();
 * @category Geometry
 */
class Path2D {
	/**
	 * the points defining the current path
	 */
	points: Point[] = [];

	/**
	 * start index (into {@link points}) of each sub-path after the first; used
	 * as the hole indices when triangulating, and as the `moveTo` boundaries
	 * when the Canvas renderer replays the path.
	 */
	subPaths: number[] = [];

	/**
	 * space between interpolated points for quadratic and bezier curve approx. in pixels.
	 * @default 2
	 */
	arcResolution = 2;

	/* @ignore */
	vertices: Point[] = [];

	/* @ignore */
	startPoint: Point = pointPool.get();

	/* @ignore */
	isDirty = false;

	constructor(svgPath?: string) {
		if (typeof svgPath === "string") {
			this.parseSVGPath(svgPath);
		}
	}

	/**
	 * Parses an SVG path string and generates interpolated points for rendering.
	 * Clears any existing path data before parsing (calls {@link beginPath} internally).
	 *
	 * Supported commands:
	 * - **M** x y — move to (starts a new sub-path)
	 * - **L** x y — line to
	 * - **H** dx — horizontal line (relative offset from current x)
	 * - **V** dy — vertical line (relative offset from current y)
	 * - **Q** cx cy x y — quadratic Bézier curve
	 * - **C** cx1 cy1 cx2 cy2 x y — cubic Bézier curve
	 * - **A** rx ry xRot largeArc sweep x y — elliptical arc
	 * - **Z** — close the current sub-path (line back to its starting point)
	 *
	 * Multiple `M` commands define separate sub-paths; when filled the first is
	 * the outer contour and the rest are holes. After parsing, the generated
	 * points are available in {@link points} and can be rendered using the
	 * renderer's `stroke()` and `fill()` methods.
	 * @example
	 * // draw a heart shape
	 * renderer.path2D.parseSVGPath(
	 *   "M 10 30 A 20 20 0 0 1 50 30 A 20 20 0 0 1 90 30 Q 90 60 50 90 Q 10 60 10 30 Z"
	 * );
	 * renderer.setColor("#EF5350");
	 * renderer.fill();
	 * @example
	 * // a donut: an outer ring with an inner hole (two `M` sub-paths)
	 * renderer.path2D.parseSVGPath(
	 *   "M 0 40 A 40 40 0 1 0 80 40 A 40 40 0 1 0 0 40 Z " +
	 *   "M 20 40 A 20 20 0 1 0 60 40 A 20 20 0 1 0 20 40 Z"
	 * );
	 * renderer.fill();
	 * @param svgPath - An SVG path data string (e.g. "M 0 0 L 100 0 L 50 100 Z").
	 * Only uppercase (absolute) commands are supported.
	 */
	parseSVGPath(svgPath: string) {
		// Split path into commands and coordinates
		const pathCommands = svgPath.match(/([a-df-z])[^a-df-z]*/gi);
		const startPoint = this.startPoint;

		this.beginPath();

		if (pathCommands === null) {
			return;
		}

		// Process each command and corresponding coordinates
		for (let i = 0; i < pathCommands.length; i++) {
			const pathCommand = pathCommands[i];
			const command = pathCommand[0].toUpperCase();
			const coordinates = pathCommand
				.slice(1)
				.trim()
				.split(/[\s,]+/)
				.map(parseFloat);

			switch (command) {
				case "A":
					{
						// SVG A command: rx ry xAxisRotation largeArcFlag sweepFlag x y
						// the current pen position is always tracked by startPoint (set
						// by the preceding M/line/curve). Use it rather than the last
						// pushed point so an arc that is the first command of a new
						// sub-path (e.g. a circular hole) starts from the right place.
						const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] =
							coordinates;
						const p = endpointToCenterParameterization(
							startPoint.x,
							startPoint.y,
							x,
							y,
							// SVG flags are parsed as 0/1; the parameterization expects booleans
							largeArcFlag !== 0,
							sweepFlag !== 0,
							rx,
							ry,
							xAxisRotation,
						);
						// generate arc points inline using lineTo (not ellipse/arc
						// which call moveTo and break path continuity)
						{
							let { startAngle, endAngle } = p;
							const {
								cx,
								cy,
								rx: arcRx,
								ry: arcRy,
								xAxisRotation: rot,
								anticlockwise,
							} = p;

							if (startAngle === endAngle) {
								break;
							}

							const fullCircle = anticlockwise
								? Math.abs(startAngle - endAngle) >= TAU
								: Math.abs(endAngle - startAngle) >= TAU;

							startAngle = startAngle % TAU;
							endAngle = endAngle % TAU;
							if (startAngle < 0) {
								startAngle += TAU;
							}
							if (endAngle < 0) {
								endAngle += TAU;
							}
							if (startAngle >= endAngle) {
								endAngle += TAU;
							}

							let diff = endAngle - startAngle;
							let direction = 1;
							if (anticlockwise) {
								direction = -1;
								diff = TAU - diff;
							}
							if (fullCircle) {
								diff = TAU;
							}

							const length = (diff * arcRx + diff * arcRy) / 2;
							const nr = length / this.arcResolution;
							const angleStep = (diff / nr) * direction;
							const cosRot = Math.cos(rot);
							const sinRot = Math.sin(rot);

							let angle = startAngle;
							for (let j = 0; j < nr; j++) {
								const ex = arcRx * Math.cos(angle);
								const ey = arcRy * Math.sin(angle);
								this.lineTo(
									cx + ex * cosRot - ey * sinRot,
									cy + ex * sinRot + ey * cosRot,
								);
								angle += angleStep;
							}
							// end exactly at the SVG endpoint
							this.lineTo(x, y);
						}
					}
					break;
				case "H":
					// H take 1 coordinate, relative to the current pen position
					this.lineTo(startPoint.x + coordinates[0], startPoint.y);
					break;
				case "V":
					// V take 1 coordinate, relative to the current pen position
					this.lineTo(startPoint.x, startPoint.y + coordinates[0]);
					break;
				case "M":
					// M takes 2 coordinates (starts a new sub-path)
					this.moveTo(coordinates[0], coordinates[1]);
					break;
				case "L":
					// L takes 2 coordinates
					this.lineTo(coordinates[0], coordinates[1]);
					break;
				case "Q":
					// Q takes 4 coordinates
					this.quadraticCurveTo(
						coordinates[0],
						coordinates[1],
						coordinates[2],
						coordinates[3],
					);
					break;
				case "C":
					// C takes 6 coordinates
					this.bezierCurveTo(
						coordinates[0],
						coordinates[1],
						coordinates[2],
						coordinates[3],
						coordinates[4],
						coordinates[5],
					);
					break;
				case "Z":
					this.closePath();
					break;
				default:
					console.warn("Unsupported command:", command);
					break;
			}
		}
	}

	/**
	 * begin a new (empty) path, discarding all previously recorded points and
	 * sub-paths. Called automatically by {@link parseSVGPath}.
	 * @example
	 * path.beginPath();
	 * path.rect(0, 0, 100, 60);
	 * renderer.fill();
	 */
	beginPath() {
		// empty the cache and recycle all vectors
		this.points.forEach((point) => {
			pointPool.release(point);
		});
		this.isDirty = true;
		this.points.length = 0;
		this.subPaths.length = 0;
		this.startPoint.set(0, 0);
	}

	/**
	 * causes the point of the pen to move back to the start of the current sub-path.
	 * It tries to draw a straight line from the current point to the start.
	 * If the shape has already been closed or has only one point, this function does nothing.
	 * @example
	 * path.beginPath();
	 * path.moveTo(0, 0);
	 * path.lineTo(50, 0);
	 * path.lineTo(25, 40);
	 * path.closePath(); // draw the final edge back to (0, 0)
	 */
	closePath() {
		const points = this.points;
		if (points.length === 0) {
			return;
		}
		// if the pen has moved (via moveTo / `M`) without drawing since, the
		// current sub-path is empty — closing it is a no-op (matches native
		// Path2D). Detected the same way lineTo detects a new sub-path: a
		// significant gap between the pen (startPoint) and the last drawn point.
		const lastPoint = points[points.length - 1];
		const dx = this.startPoint.x - lastPoint.x;
		const dy = this.startPoint.y - lastPoint.y;
		if (dx * dx + dy * dy > 1e-6) {
			return;
		}
		// the start of the current sub-path (the last recorded boundary, or
		// the very first point when there is only one sub-path)
		const startIndex =
			this.subPaths.length > 0 ? this.subPaths[this.subPaths.length - 1] : 0;
		const firstPoint = points[startIndex];
		if (!firstPoint.equals(lastPoint)) {
			this.lineTo(firstPoint.x, firstPoint.y);
		}
		this.isDirty = true;
	}

	/**
	 * triangulate the shape defined by this path into a flat list of triangle
	 * vertices (every three consecutive points form one triangle). Sub-paths
	 * after the first are treated as holes. Used by the WebGL renderer to fill,
	 * and cached until the path changes.
	 * @returns the triangulated vertices, three per triangle
	 * @example
	 * path.parseSVGPath("M 0 0 L 100 0 L 50 100 Z");
	 * const verts = path.triangulatePath(); // 3 vertices = 1 triangle
	 */
	triangulatePath() {
		const vertices = this.vertices;

		if (this.isDirty) {
			const points = this.points;
			const data: number[] = [];
			for (let i = 0; i < points.length; i++) {
				data.push(points[i].x, points[i].y);
			}
			// sub-paths after the first become holes (their start indices)
			const indices = earcut(
				data,
				this.subPaths.length > 0 ? this.subPaths : null,
			);
			const indicesLength = indices.length;

			// pre-allocate vertices if necessary
			while (vertices.length < indicesLength) {
				vertices.push(pointPool.get());
			}

			// calculate all vertices
			for (let i = 0; i < indicesLength; i++) {
				const point = points[indices[i]];
				vertices[i].set(point.x, point.y);
			}

			// recycle overhead from a previous triangulation
			while (vertices.length > indicesLength) {
				pointPool.release(vertices[vertices.length - 1]);
				vertices.length -= 1;
			}
			this.isDirty = false;
		}

		return vertices;
	}

	/**
	 * moves the starting point of a new sub-path to the (x, y) coordinates.
	 * @param x - the x-axis (horizontal) coordinate of the point.
	 * @param y - the y-axis (vertical) coordinate of the point.
	 * @example
	 * path.beginPath();
	 * path.moveTo(20, 20); // lift the pen to (20, 20): starts a new sub-path
	 * path.lineTo(80, 20);
	 */
	moveTo(x: number, y: number) {
		this.startPoint.set(x, y);
		this.isDirty = true;
	}

	/**
	 * connects the last point in the current sub-path to the (x, y) coordinates with a straight line.
	 * @param x - the x-axis coordinate of the line's end point.
	 * @param y - the y-axis coordinate of the line's end point.
	 * @example
	 * path.beginPath();
	 * path.moveTo(0, 0);
	 * path.lineTo(50, 0); // horizontal segment
	 * path.lineTo(50, 50); // vertical segment (an "L" shape)
	 */
	lineTo(x: number, y: number) {
		const points = this.points;
		const startPoint = this.startPoint;
		const lastPoint =
			points.length === 0 ? startPoint : points[points.length - 1];

		if (!startPoint.equals(lastPoint)) {
			// the pen moved without drawing: start this segment from the pen
			// position. A *significant* gap marks a genuinely new sub-path (e.g.
			// an SVG `M` mid-path) → record its start so fill treats it as a hole
			// and the Canvas replay can `moveTo` across it. Float-precision noise
			// from arc/roundRect joins (well below this threshold) is ignored, so
			// those stay single sub-paths.
			if (points.length > 0) {
				const dx = startPoint.x - lastPoint.x;
				const dy = startPoint.y - lastPoint.y;
				if (dx * dx + dy * dy > 1e-6) {
					this.subPaths.push(points.length);
				}
			}
			points.push(pointPool.get(startPoint.x, startPoint.y));
		} else {
			points.push(pointPool.get(lastPoint.x, lastPoint.y));
		}
		points.push(pointPool.get(x, y));

		startPoint.x = x;
		startPoint.y = y;

		this.isDirty = true;
	}

	/**
	 * adds an arc to the current path which is centered at (x, y) position with the given radius,
	 * starting at startAngle and ending at endAngle going in the given direction by counterclockwise (defaulting to clockwise).
	 * @param x - the horizontal coordinate of the arc's center.
	 * @param y - the vertical coordinate of the arc's center.
	 * @param radius - the arc's radius. Must be positive.
	 * @param startAngle - the angle at which the arc starts in radians, measured from the positive x-axis.
	 * @param endAngle - the angle at which the arc ends in radians, measured from the positive x-axis.
	 * @param [anticlockwise=false] - an optional boolean value. If true, draws the arc counter-clockwise between the start and end angles.
	 * @example
	 * // a full circle of radius 40 centred at (50, 50)
	 * path.beginPath();
	 * path.arc(50, 50, 40, 0, Math.PI * 2);
	 * renderer.stroke();
	 */
	arc(
		x: number,
		y: number,
		radius: number,
		startAngle: number,
		endAngle: number,
		anticlockwise = false,
	) {
		// based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
		//bring angles all in [0, 2*PI] range
		if (startAngle === endAngle) {
			return;
		}
		const fullCircle = anticlockwise
			? Math.abs(startAngle - endAngle) >= TAU
			: Math.abs(endAngle - startAngle) >= TAU;

		startAngle = startAngle % TAU;
		endAngle = endAngle % TAU;

		if (startAngle < 0) {
			startAngle += TAU;
		}
		if (endAngle < 0) {
			endAngle += TAU;
		}

		if (startAngle >= endAngle) {
			endAngle += TAU;
		}

		let diff = endAngle - startAngle;
		let direction = 1;
		if (anticlockwise) {
			direction = -1;
			diff = TAU - diff;
		}

		if (fullCircle) {
			diff = TAU;
		}

		const length = diff * radius;
		const nr_of_interpolation_points = length / this.arcResolution;
		const dangle = diff / nr_of_interpolation_points;
		const angleStep = dangle * direction;

		this.moveTo(
			x + radius * Math.cos(startAngle),
			y + radius * Math.sin(startAngle),
		);

		let angle = startAngle;
		for (let j = 0; j < nr_of_interpolation_points; j++) {
			this.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
			angle += angleStep;
		}

		this.lineTo(
			x + radius * Math.cos(endAngle),
			y + radius * Math.sin(endAngle),
		);

		this.isDirty = true;
	}

	/**
	 * adds a circular arc to the path with the given control points and radius, connected to the previous point by a straight line.
	 * @param x1 - the x-axis coordinate of the first control point.
	 * @param y1 - the y-axis coordinate of the first control point.
	 * @param x2 - the x-axis coordinate of the second control point.
	 * @param y2 - the y-axis coordinate of the second control point.
	 * @param radius - the arc's radius. Must be positive.
	 * @example
	 * // round the corner where two segments meet at (50, 0)
	 * path.beginPath();
	 * path.moveTo(0, 0);
	 * path.arcTo(50, 0, 50, 50, 20);
	 * path.lineTo(50, 50);
	 */
	arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
		const points = this.points;
		const startPoint = this.startPoint;
		const lastPoint =
			points.length === 0 ? startPoint : points[points.length - 1];

		// based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
		const x0 = lastPoint.x;
		const y0 = lastPoint.y;
		//a = -incoming vector, b = outgoing vector to x1, y1
		let a0 = x0 - x1;
		let a1 = y0 - y1;
		let b0 = x2 - x1;
		let b1 = y2 - y1;

		//normalize
		const l_a = Math.sqrt(a0 * a0 + a1 * a1);
		const l_b = Math.sqrt(b0 * b0 + b1 * b1);
		a0 /= l_a;
		a1 /= l_a;
		b0 /= l_b;
		b1 /= l_b;
		const angle = Math.atan2(a1, a0) - Math.atan2(b1, b0);

		//work out tangent points using tan(θ) = opposite / adjacent; angle/2 because hypotenuse is the bisection of a,b
		const tan_angle_div2 = Math.tan(angle / 2);
		const adj_l = radius / tan_angle_div2;

		const tangent1_pointx = x1 + a0 * adj_l;
		const tangent1_pointy = y1 + a1 * adj_l;
		const tangent2_pointx = x1 + b0 * adj_l;
		const tangent2_pointy = y1 + b1 * adj_l;

		this.moveTo(tangent1_pointx, tangent1_pointy);

		let bisec0 = (a0 + b0) / 2.0;
		let bisec1 = (a1 + b1) / 2.0;
		const bisec_l = Math.sqrt(bisec0 * bisec0 + bisec1 * bisec1);
		bisec0 /= bisec_l;
		bisec1 /= bisec_l;

		const hyp_l = Math.sqrt(radius * radius + adj_l * adj_l);
		const centerx = x1 + hyp_l * bisec0;
		const centery = y1 + hyp_l * bisec1;

		const startAngle = Math.atan2(
			tangent1_pointy - centery,
			tangent1_pointx - centerx,
		);
		const endAngle = Math.atan2(
			tangent2_pointy - centery,
			tangent2_pointx - centerx,
		);

		this.arc(centerx, centery, radius, startAngle, endAngle);
	}

	/**
	 * adds an elliptical arc to the path which is centered at (x, y) position with the radii radiusX and radiusY
	 * starting at startAngle and ending at endAngle going in the given direction by counterclockwise.
	 * @param x - the x-axis (horizontal) coordinate of the ellipse's center.
	 * @param y - the  y-axis (vertical) coordinate of the ellipse's center.
	 * @param radiusX - the ellipse's major-axis radius. Must be non-negative.
	 * @param radiusY - the ellipse's minor-axis radius. Must be non-negative.
	 * @param rotation - the rotation of the ellipse, expressed in radians.
	 * @param startAngle - the angle at which the ellipse starts, measured clockwise from the positive x-axis and expressed in radians.
	 * @param endAngle - the angle at which the ellipse ends, measured clockwise from the positive x-axis and expressed in radians.
	 * @param [anticlockwise=false] - an optional boolean value which, if true, draws the ellipse counterclockwise (anticlockwise).
	 * @example
	 * // a 45°-rotated ellipse, filled
	 * path.beginPath();
	 * path.ellipse(50, 50, 60, 30, Math.PI / 4, 0, Math.PI * 2);
	 * renderer.fill();
	 */
	ellipse(
		x: number,
		y: number,
		radiusX: number,
		radiusY: number,
		rotation: number,
		startAngle: number,
		endAngle: number,
		anticlockwise = false,
	) {
		// based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
		if (startAngle === endAngle) {
			return;
		}
		const fullCircle = anticlockwise
			? Math.abs(startAngle - endAngle) >= TAU
			: Math.abs(endAngle - startAngle) >= TAU;

		//bring angles all in [0, 2*PI] range
		startAngle = startAngle % TAU;
		endAngle = endAngle % TAU;
		if (startAngle < 0) {
			startAngle += TAU;
		}
		if (endAngle < 0) {
			endAngle += TAU;
		}

		if (startAngle >= endAngle) {
			endAngle += TAU;
		}

		let diff = endAngle - startAngle;

		let direction = 1;
		if (anticlockwise) {
			direction = -1;
			diff = TAU - diff;
		}

		if (fullCircle) {
			diff = TAU;
		}

		const length = (diff * radiusX + diff * radiusY) / 2;
		const nr_of_interpolation_points = length / this.arcResolution;
		const dangle = diff / nr_of_interpolation_points;
		const angleStep = dangle * direction;

		let angle = startAngle;
		const cos_rotation = Math.cos(rotation);
		const sin_rotation = Math.sin(rotation);

		const sx = radiusX * Math.cos(startAngle);
		const sy = radiusY * Math.sin(startAngle);
		this.moveTo(
			x + sx * cos_rotation - sy * sin_rotation,
			y + sx * sin_rotation + sy * cos_rotation,
		);

		for (let j = 0; j < nr_of_interpolation_points; j++) {
			const _x1 = radiusX * Math.cos(angle);
			const _y1 = radiusY * Math.sin(angle);
			const _x2 = x + _x1 * cos_rotation - _y1 * sin_rotation;
			const _y2 = y + _x1 * sin_rotation + _y1 * cos_rotation;
			this.lineTo(_x2, _y2);
			angle += angleStep;
		}
		// close the ellipse
		this.lineTo(
			x + sx * cos_rotation - sy * sin_rotation,
			y + sx * sin_rotation + sy * cos_rotation,
		);
		this.isDirty = true;
	}

	/**
	 * Adds a quadratic Bézier curve to the path.
	 * @param cpX - The x-coordinate of the control point.
	 * @param cpY - The y-coordinate of the control point.
	 * @param x - The x-coordinate of the end point of the curve.
	 * @param y - The y-coordinate of the end point of the curve.
	 * @example
	 * path.beginPath();
	 * path.moveTo(0, 50);
	 * path.quadraticCurveTo(50, 0, 100, 50); // one control point at (50, 0)
	 */
	quadraticCurveTo(cpX: number, cpY: number, x: number, y: number) {
		const points = this.points;
		const startPoint = this.startPoint;
		// capture coordinates (not reference) since lineTo mutates startPoint
		const lx = points.length === 0 ? startPoint.x : points[points.length - 1].x;
		const ly = points.length === 0 ? startPoint.y : points[points.length - 1].y;
		const endPoint = pointPool.get().set(x, y);
		const controlPoint = pointPool.get().set(cpX, cpY);
		// estimate curve length via control polygon
		const polyLen =
			Math.sqrt((cpX - lx) ** 2 + (cpY - ly) ** 2) +
			Math.sqrt((x - cpX) ** 2 + (y - cpY) ** 2);
		const resolution = Math.max(4, Math.ceil(polyLen / this.arcResolution));

		const t = 1 / resolution;
		for (let i = 1; i <= resolution; i++) {
			const ti = t * i;
			const omt = 1 - ti;
			const omt2 = omt * omt;
			const ti2 = ti * ti;
			this.lineTo(
				lx * omt2 + controlPoint.x * 2 * omt * ti + endPoint.x * ti2,
				ly * omt2 + controlPoint.y * 2 * omt * ti + endPoint.y * ti2,
			);
		}
		pointPool.release(endPoint);
		pointPool.release(controlPoint);
		this.isDirty = true;
	}

	/**
	 * Adds a cubic Bézier curve to the path.
	 * @param cp1X - The x-coordinate of the first control point.
	 * @param cp1Y - The y-coordinate of the first control point.
	 * @param cp2X - The x-coordinate of the second control point.
	 * @param cp2Y - The y-coordinate of the second control point.
	 * @param x - The x-coordinate of the end point of the curve.
	 * @param y - The y-coordinate of the end point of the curve.
	 * @example
	 * path.beginPath();
	 * path.moveTo(0, 50);
	 * path.bezierCurveTo(25, 0, 75, 100, 100, 50); // two control points
	 */
	bezierCurveTo(
		cp1X: number,
		cp1Y: number,
		cp2X: number,
		cp2Y: number,
		x: number,
		y: number,
	) {
		const points = this.points;
		const startPoint = this.startPoint;
		// capture coordinates (not reference) since lineTo mutates startPoint
		const lx = points.length === 0 ? startPoint.x : points[points.length - 1].x;
		const ly = points.length === 0 ? startPoint.y : points[points.length - 1].y;
		const endPoint = pointPool.get().set(x, y);
		const controlPoint1 = pointPool.get().set(cp1X, cp1Y);
		const controlPoint2 = pointPool.get().set(cp2X, cp2Y);
		// estimate curve length via control polygon
		const polyLen =
			Math.sqrt((cp1X - lx) ** 2 + (cp1Y - ly) ** 2) +
			Math.sqrt((cp2X - cp1X) ** 2 + (cp2Y - cp1Y) ** 2) +
			Math.sqrt((x - cp2X) ** 2 + (y - cp2Y) ** 2);
		const resolution = Math.max(4, Math.ceil(polyLen / this.arcResolution));

		const t = 1 / resolution;
		for (let i = 1; i <= resolution; i++) {
			const ti = t * i;
			const omt = 1 - ti;
			const omt2 = omt * omt;
			const omt3 = omt2 * omt;
			const ti2 = ti * ti;
			const ti3 = ti2 * ti;
			this.lineTo(
				lx * omt3 +
					controlPoint1.x * 3 * omt2 * ti +
					controlPoint2.x * 3 * omt * ti2 +
					endPoint.x * ti3,
				ly * omt3 +
					controlPoint1.y * 3 * omt2 * ti +
					controlPoint2.y * 3 * omt * ti2 +
					endPoint.y * ti3,
			);
		}

		pointPool.release(endPoint);
		pointPool.release(controlPoint1);
		pointPool.release(controlPoint2);
		this.isDirty = true;
	}

	/**
	 * creates a path for a rectangle at position (x, y) with a size that is determined by width and height.
	 * @param x - the x-axis coordinate of the rectangle's starting point.
	 * @param y - the y-axis coordinate of the rectangle's starting point.
	 * @param width - the rectangle's width. Positive values are to the right, and negative to the left.
	 * @param height - the rectangle's height. Positive values are down, and negative are up.
	 * @example
	 * path.beginPath();
	 * path.rect(10, 10, 80, 50);
	 * renderer.fill();
	 */
	rect(x: number, y: number, width: number, height: number) {
		this.moveTo(x, y);
		this.lineTo(x + width, y);
		this.lineTo(x + width, y + height);
		this.lineTo(x, y + height);
		this.lineTo(x, y);

		this.isDirty = true;
	}

	/**
	 * adds an rounded rectangle to the current path.
	 * @param x - the x-axis coordinate of the rectangle's starting point.
	 * @param y - the y-axis coordinate of the rectangle's starting point.
	 * @param width - the rectangle's width. Positive values are to the right, and negative to the left.
	 * @param height - the rectangle's height. Positive values are down, and negative are up.
	 * @param radius - the arc's radius to draw the borders. Must be positive.
	 * @example
	 * path.beginPath();
	 * path.roundRect(10, 10, 80, 50, 12); // 12px corner radius
	 * renderer.fill();
	 */
	roundRect(
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number,
	) {
		this.moveTo(x + radius, y);
		this.lineTo(x + width - radius, y);
		this.arcTo(x + width, y, x + width, y + radius, radius);

		this.lineTo(x + width, y + height - radius);
		this.arcTo(x + width, y + height, x + width - radius, y + height, radius);

		this.lineTo(x + radius, y + height);
		this.arcTo(x, y + height, x, y + height - radius, radius);

		this.lineTo(x, y + radius);
		this.arcTo(x, y, x + radius, y, radius);

		this.isDirty = true;
	}
}

export default Path2D;
