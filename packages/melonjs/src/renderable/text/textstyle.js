/**
 * apply the current text style to the given context
 * @ignore
 * @internal
 */
export default function setContextStyle(context, style) {
	context.font = style.font;
	// a Gradient fills the glyphs in place of the flat colour — the same choice
	// `Renderer#setColor` makes, resolved here against the bake's own context
	context.fillStyle =
		style.fillGradient !== undefined
			? style.fillGradient.toCanvasGradient(context)
			: style.fillStyle.toRGBA();
	context.strokeStyle = style.strokeStyle.toRGBA();
	context.lineWidth = style.lineWidth;
	context.textAlign = style.textAlign;
	context.textBaseline = style.textBaseline;
}
