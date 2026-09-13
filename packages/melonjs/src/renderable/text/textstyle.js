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
	context.textAlign = style.textAlign;
	context.textBaseline = style.textBaseline;
	return fill;
}
