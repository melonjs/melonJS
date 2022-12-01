/*!
 * melonJS Game Engine - v14.1.2
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * apply the current text style to the given context
 * @ignore
 */
function setContextStyle(context, style, stroke = false) {
    context.font = style.font;
    context.fillStyle = style.fillStyle.toRGBA();
    if (stroke === true) {
        context.strokeStyle = style.strokeStyle.toRGBA();
        context.lineWidth = style.lineWidth;
    }
    context.textAlign = style.textAlign;
    context.textBaseline = style.textBaseline;
}

export { setContextStyle as default };
