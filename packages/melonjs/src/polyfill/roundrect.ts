/*
 * based on https://www.npmjs.com/package/canvas-roundrect-polyfill
 * @version 0.0.1
 */

/** @ignore */
function roundRect(
	this: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	radii: unknown,
) {
	if (
		![x, y, w, h].every((input) => {
			return Number.isFinite(input);
		})
	) {
		return;
	}

	const parsedRadii = parseRadiiArgument(radii);

	let upperLeft;
	let upperRight;
	let lowerRight;
	let lowerLeft;

	if (parsedRadii.length === 4) {
		upperLeft = toCornerPoint(parsedRadii[0]);
		upperRight = toCornerPoint(parsedRadii[1]);
		lowerRight = toCornerPoint(parsedRadii[2]);
		lowerLeft = toCornerPoint(parsedRadii[3]);
	} else if (parsedRadii.length === 3) {
		upperLeft = toCornerPoint(parsedRadii[0]);
		upperRight = toCornerPoint(parsedRadii[1]);
		lowerLeft = toCornerPoint(parsedRadii[1]);
		lowerRight = toCornerPoint(parsedRadii[2]);
	} else if (parsedRadii.length === 2) {
		upperLeft = toCornerPoint(parsedRadii[0]);
		lowerRight = toCornerPoint(parsedRadii[0]);
		upperRight = toCornerPoint(parsedRadii[1]);
		lowerLeft = toCornerPoint(parsedRadii[1]);
	} else if (parsedRadii.length === 1) {
		upperLeft = toCornerPoint(parsedRadii[0]);
		upperRight = toCornerPoint(parsedRadii[0]);
		lowerRight = toCornerPoint(parsedRadii[0]);
		lowerLeft = toCornerPoint(parsedRadii[0]);
	} else {
		throw new Error(
			`${parsedRadii.length} is not a valid size for radii sequence.`,
		);
	}

	const corners = [upperLeft, upperRight, lowerRight, lowerLeft];
	const negativeCorner = corners.find(({ x, y }) => {
		return x < 0 || y < 0;
	});
	//const negativeValue = negativeCorner?.x < 0 ? negativeCorner.x : negativeCorner?.y

	if (
		corners.some(({ x, y }) => {
			return !Number.isFinite(x) || !Number.isFinite(y);
		})
	) {
		return;
	}

	if (negativeCorner) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
		throw new Error(`Radius value ${negativeCorner} is negative.`);
	}

	fixOverlappingCorners(corners);

	if (w < 0 && h < 0) {
		this.moveTo(x - upperLeft.x, y);
		this.ellipse(
			x + w + upperRight.x,
			y - upperRight.y,
			upperRight.x,
			upperRight.y,
			0,
			-Math.PI * 1.5,
			-Math.PI,
		);
		this.ellipse(
			x + w + lowerRight.x,
			y + h + lowerRight.y,
			lowerRight.x,
			lowerRight.y,
			0,
			-Math.PI,
			-Math.PI / 2,
		);
		this.ellipse(
			x - lowerLeft.x,
			y + h + lowerLeft.y,
			lowerLeft.x,
			lowerLeft.y,
			0,
			-Math.PI / 2,
			0,
		);
		this.ellipse(
			x - upperLeft.x,
			y - upperLeft.y,
			upperLeft.x,
			upperLeft.y,
			0,
			0,
			-Math.PI / 2,
		);
	} else if (w < 0) {
		this.moveTo(x - upperLeft.x, y);
		this.ellipse(
			x + w + upperRight.x,
			y + upperRight.y,
			upperRight.x,
			upperRight.y,
			0,
			-Math.PI / 2,
			-Math.PI,
			true,
		);
		this.ellipse(
			x + w + lowerRight.x,
			y + h - lowerRight.y,
			lowerRight.x,
			lowerRight.y,
			0,
			-Math.PI,
			-Math.PI * 1.5,
			true,
		);
		this.ellipse(
			x - lowerLeft.x,
			y + h - lowerLeft.y,
			lowerLeft.x,
			lowerLeft.y,
			0,
			Math.PI / 2,
			0,
			true,
		);
		this.ellipse(
			x - upperLeft.x,
			y + upperLeft.y,
			upperLeft.x,
			upperLeft.y,
			0,
			0,
			-Math.PI / 2,
			true,
		);
	} else if (h < 0) {
		this.moveTo(x + upperLeft.x, y);
		this.ellipse(
			x + w - upperRight.x,
			y - upperRight.y,
			upperRight.x,
			upperRight.y,
			0,
			Math.PI / 2,
			0,
			true,
		);
		this.ellipse(
			x + w - lowerRight.x,
			y + h + lowerRight.y,
			lowerRight.x,
			lowerRight.y,
			0,
			0,
			-Math.PI / 2,
			true,
		);
		this.ellipse(
			x + lowerLeft.x,
			y + h + lowerLeft.y,
			lowerLeft.x,
			lowerLeft.y,
			0,
			-Math.PI / 2,
			-Math.PI,
			true,
		);
		this.ellipse(
			x + upperLeft.x,
			y - upperLeft.y,
			upperLeft.x,
			upperLeft.y,
			0,
			-Math.PI,
			-Math.PI * 1.5,
			true,
		);
	} else {
		this.moveTo(x + upperLeft.x, y);
		this.ellipse(
			x + w - upperRight.x,
			y + upperRight.y,
			upperRight.x,
			upperRight.y,
			0,
			-Math.PI / 2,
			0,
		);
		this.ellipse(
			x + w - lowerRight.x,
			y + h - lowerRight.y,
			lowerRight.x,
			lowerRight.y,
			0,
			0,
			Math.PI / 2,
		);
		this.ellipse(
			x + lowerLeft.x,
			y + h - lowerLeft.y,
			lowerLeft.x,
			lowerLeft.y,
			0,
			Math.PI / 2,
			Math.PI,
		);
		this.ellipse(
			x + upperLeft.x,
			y + upperLeft.y,
			upperLeft.x,
			upperLeft.y,
			0,
			Math.PI,
			Math.PI * 1.5,
		);
	}

	this.closePath();
	this.moveTo(x, y);

	/** @ignore */
	function toDOMPointInit(value: {
		x: number;
		y: number;
		z: number;
		w: number;
	}) {
		const { x, y, z, w } = value;
		return { x, y, z, w };
	}

	/** @ignore */
	function parseRadiiArgument(
		value: any,
	):
		| [number, number, number, number]
		| [number, number, number]
		| [number, number]
		| [number]
		| unknown[] {
		// https://webidl.spec.whatwg.org/#es-union
		// with 'optional (unrestricted double or DOMPointInit
		//   or sequence<(unrestricted double or DOMPointInit)>) radii = 0'
		const type = typeof value;

		if (type === "undefined" || value === null) {
			return [0];
		}
		if (type === "function") {
			return [NaN];
		}
		if (type === "object") {
			if (typeof value[Symbol.iterator] === "function") {
				return [...value].map((elem) => {
					// https://webidl.spec.whatwg.org/#es-union
					// with '(unrestricted double or DOMPointInit)'
					const elemType = typeof elem;
					if (elemType === "undefined" || elem === null) {
						return 0;
					}
					if (elemType === "function") {
						return NaN;
					}
					if (elemType === "object") {
						return toDOMPointInit(elem);
					}
					return toUnrestrictedNumber(elem);
				});
			}

			return [toDOMPointInit(value)];
		}

		return [toUnrestrictedNumber(value)];
	}

	/** @ignore */
	function toUnrestrictedNumber(value: any) {
		return +value;
	}

	/** @ignore */
	function toCornerPoint(value: any) {
		const asNumber = toUnrestrictedNumber(value);
		if (Number.isFinite(asNumber)) {
			return {
				x: asNumber,
				y: asNumber,
			};
		}
		if (Object(value) === value) {
			return {
				x: toUnrestrictedNumber(value.x || 0),
				y: toUnrestrictedNumber(value.y || 0),
			};
		}

		return {
			x: NaN,
			y: NaN,
		};
	}

	/** @ignore */
	function fixOverlappingCorners(corners: any) {
		const [upperLeft, upperRight, lowerRight, lowerLeft] = corners;
		const factors = [
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			Math.abs(w) / (upperLeft.x + upperRight.x),
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			Math.abs(h) / (upperRight.y + lowerRight.y),
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			Math.abs(w) / (lowerRight.x + lowerLeft.x),
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			Math.abs(h) / (upperLeft.y + lowerLeft.y),
		];
		const minFactor = Math.min(...factors);
		if (minFactor <= 1) {
			corners.forEach((radii: any) => {
				radii.x *= minFactor;
				radii.y *= minFactor;
			});
		}
	}
}

if (globalThis.CanvasRenderingContext2D) {
	if (typeof globalThis.Path2D.prototype.roundRect === "undefined") {
		globalThis.Path2D.prototype.roundRect = roundRect;
	}
}
if (globalThis.CanvasRenderingContext2D) {
	if (
		typeof globalThis.CanvasRenderingContext2D.prototype.roundRect ===
		"undefined"
	) {
		globalThis.CanvasRenderingContext2D.prototype.roundRect = roundRect;
	}
}
if (globalThis.OffscreenCanvasRenderingContext2D) {
	if (
		typeof globalThis.OffscreenCanvasRenderingContext2D.prototype.roundRect ===
		"undefined"
	) {
		globalThis.OffscreenCanvasRenderingContext2D.prototype.roundRect =
			roundRect;
	}
}
