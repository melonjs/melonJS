/*
 * CanvasRenderingContext2D.ellipse() polyfill
 * Uses cubic bezier curves to approximate the ellipse when native support is unavailable.
 */

/** @ignore */
function ellipse(
	this: CanvasRenderingContext2D | Path2D,
	x: number,
	y: number,
	radiusX: number,
	radiusY: number,
	rotation: number,
	startAngle: number,
	endAngle: number,
	counterclockwise: boolean = false,
) {
	if (radiusX < 0 || radiusY < 0) {
		throw new RangeError("Radius values must be non-negative.");
	}

	// bail out on non-finite inputs to avoid infinite loops
	if (
		!Number.isFinite(x) ||
		!Number.isFinite(y) ||
		!Number.isFinite(radiusX) ||
		!Number.isFinite(radiusY) ||
		!Number.isFinite(rotation) ||
		!Number.isFinite(startAngle) ||
		!Number.isFinite(endAngle)
	) {
		return;
	}

	const ctx = this as CanvasRenderingContext2D;

	// for a full, unrotated ellipse use the fast bezier path
	const isFullEllipse =
		rotation === 0 &&
		startAngle === 0 &&
		(Math.abs(endAngle - Math.PI * 2) < 1e-6 ||
			Math.abs(endAngle - 360) < 1e-6);

	if (isFullEllipse && !counterclockwise) {
		// kappa constant for cubic bezier approximation of a quarter circle
		const kappa = 0.5522848;
		const kx = radiusX * kappa;
		const ky = radiusY * kappa;

		// use lineTo for the first point to continue existing subpaths
		// (matches native ellipse/arc behavior)
		ctx.lineTo(x + radiusX, y);
		ctx.bezierCurveTo(x + radiusX, y + ky, x + kx, y + radiusY, x, y + radiusY);
		ctx.bezierCurveTo(x - kx, y + radiusY, x - radiusX, y + ky, x - radiusX, y);
		ctx.bezierCurveTo(x - radiusX, y - ky, x - kx, y - radiusY, x, y - radiusY);
		ctx.bezierCurveTo(x + kx, y - radiusY, x + radiusX, y - ky, x + radiusX, y);
	} else {
		// general case: approximate with line segments
		const step = Math.PI / 36; // 5-degree increments
		const dir = counterclockwise ? -1 : 1;
		let end = endAngle;

		if (counterclockwise && endAngle > startAngle) {
			end -= Math.PI * 2;
		} else if (!counterclockwise && endAngle < startAngle) {
			end += Math.PI * 2;
		}

		// cap iterations to prevent runaway loops
		const maxSegments = Math.ceil(Math.abs(end - startAngle) / step) + 1;

		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);

		for (let i = 0; i <= maxSegments; i++) {
			const angle = i === maxSegments ? end : startAngle + i * step * dir;
			// stop if we've passed the end angle
			if ((dir > 0 && angle > end) || (dir < 0 && angle < end)) {
				break;
			}
			const px =
				x + radiusX * Math.cos(angle) * cos - radiusY * Math.sin(angle) * sin;
			const py =
				y + radiusX * Math.cos(angle) * sin + radiusY * Math.sin(angle) * cos;
			// lineTo continues existing subpaths (matches native behavior)
			ctx.lineTo(px, py);
		}

		// ensure we hit the exact end angle
		const px =
			x +
			radiusX * Math.cos(endAngle) * cos -
			radiusY * Math.sin(endAngle) * sin;
		const py =
			y +
			radiusX * Math.cos(endAngle) * sin +
			radiusY * Math.sin(endAngle) * cos;
		ctx.lineTo(px, py);
	}
}

if (globalThis.CanvasRenderingContext2D) {
	if (
		typeof globalThis.CanvasRenderingContext2D.prototype.ellipse === "undefined"
	) {
		globalThis.CanvasRenderingContext2D.prototype.ellipse = ellipse;
	}
}
if (globalThis.OffscreenCanvasRenderingContext2D) {
	if (
		typeof globalThis.OffscreenCanvasRenderingContext2D.prototype.ellipse ===
		"undefined"
	) {
		globalThis.OffscreenCanvasRenderingContext2D.prototype.ellipse = ellipse;
	}
}
