/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * apply the current text style to the given context
 * @ignore
 */
function setContextStyle(context, style) {
    context.font = style.font;
    context.fillStyle = style.fillStyle.toRGBA();
    context.strokeStyle = style.strokeStyle.toRGBA();
    context.lineWidth = style.lineWidth;
    context.textAlign = style.textAlign;
    context.textBaseline = style.textBaseline;
}

export { setContextStyle as default };
