/**
 * apply the current text style to the given context
 * @ignore
 */
export default function setContextStyle(context, style, stroke = false) {
    context.font = style.font;
    context.fillStyle = style.fillStyle.toRGBA();
    if (stroke === true) {
        context.strokeStyle = style.strokeStyle.toRGBA();
        context.lineWidth = style.lineWidth;
    }
    context.textAlign = style.textAlign;
    context.textBaseline = style.textBaseline;
};
