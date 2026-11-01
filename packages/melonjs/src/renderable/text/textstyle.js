/**
 * How far from vertical a linear gradient may lean and still be treated as a
 * per-line ramp. A gradient running mostly across the label is one the caller
 * meant to span it, not one to repeat.
 * @ignore
 * @internal
 */
const VERTICAL_TOLERANCE = 0.1;

/**
 * The fill style a bake should use: a flat colour, the gradient as authored,
 * or — for a multi-line label under `gradientPerLine` — one gradient spanning
 * the whole block with the caller's stops REPEATED once per line.
 *
 * Repeating the stops rather than re-anchoring the gradient per line keeps this
 * to a single `fillStyle` and leaves the canvas transform alone. `fillText` is
 * already where the browsers disagree most about rasterization; moving the
 * transform underneath it during text drawing is not a place to add variables.
 * @param {CanvasRenderingContext2D} context - the bake's context
 * @param {object} style - the Text being drawn
 * @returns {string|CanvasGradient} a value for `context.fillStyle`
 * @ignore
 * @internal
 */
function resolveFill(context, style) {
	const gradient = style.fillGradient;

	if (gradient === undefined) {
		return style.fillStyle.toRGBA();
	}

	const lines = style._text?.length ?? 1;
	if (
		style.gradientPerLine !== true ||
		lines <= 1 ||
		gradient.type !== "linear"
	) {
		return gradient.toCanvasGradient(context);
	}

	const [x0, y0, x1, y1] = gradient.coords;
	const span = y1 - y0;
	// only a (near) vertical ramp repeats: a horizontal one has nothing to say
	// about lines, and a diagonal one was authored for the whole block
	if (span === 0 || Math.abs(x1 - x0) > Math.abs(span) * VERTICAL_TOLERANCE) {
		return gradient.toCanvasGradient(context);
	}

	const lineHeight = style.metrics.lineHeight();
	const blockHeight = lines * lineHeight;
	if (blockHeight <= 0) {
		return gradient.toCanvasGradient(context);
	}

	const repeated = context.createLinearGradient(x0, 0, x1, blockHeight);
	for (let line = 0; line < lines; line++) {
		for (const stop of gradient.colorStops) {
			const y = line * lineHeight + y0 + stop.offset * span;
			repeated.addColorStop(
				Math.min(1, Math.max(0, y / blockHeight)),
				stop.color,
			);
		}
	}
	return repeated;
}

/**
 * The canvas default for `miterLimit`, kept when a Text is given a value the
 * canvas would refuse (zero, negative, infinite or NaN).
 * @ignore
 * @internal
 */
const DEFAULT_MITER_LIMIT = 10;

/**
 * The miter limit a Text's outline is drawn with.
 * @param {object} style - the Text being drawn
 * @returns {number} its `miterLimit`, or the canvas default for one the
 * canvas would refuse
 * @ignore
 * @internal
 */
function miterLimitOf(style) {
	const limit = style.miterLimit;
	return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_MITER_LIMIT;
}

/**
 * How far a Text's outline can reach past the glyph's own outline, in pixels.
 *
 * The stroke is centred on the outline, so it reaches half `lineWidth` past it
 * on curves and edges, and at corners too with "round" or "bevel" joins. A
 * "miter" join extends a corner to a point instead, and the canvas lets that
 * point reach up to `miterLimit` half widths past the corner before it cuts it
 * flat: on a sharp glyph like an "A" or an "M", several times further.
 * @param {object} style - the Text being drawn
 * @returns {number} the reach in pixels, 0 when there is no visible outline
 * @ignore
 * @internal
 */
export function strokeReach(style) {
	if (!(style.lineWidth > 0) || !(style.strokeStyle?.alpha > 0)) {
		return 0;
	}
	const half = style.lineWidth / 2;
	if (style.lineJoin !== "miter") {
		return half;
	}
	// below 1 every corner is past the limit and is cut flat: half a width
	return half * Math.max(1, miterLimitOf(style));
}

/**
 * apply the current text style to the given context
 * @param {CanvasRenderingContext2D} context - the bake's context
 * @param {object} style - the Text being drawn
 * @returns {string|CanvasGradient} the resolved fill, so a caller that repaints
 * the glyphs through it does not have to resolve it a second time
 * @ignore
 * @internal
 */
export default function setContextStyle(context, style) {
	const fill = resolveFill(context, style);
	context.font = style.font;
	context.fillStyle = fill;
	context.strokeStyle = style.strokeStyle.toRGBA();
	context.lineWidth = style.lineWidth;
	context.lineJoin = style.lineJoin ?? "round";
	context.miterLimit = miterLimitOf(style);
	context.textAlign = style.textAlign;
	context.textBaseline = style.textBaseline;
	return fill;
}
