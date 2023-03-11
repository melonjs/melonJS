/**
 * @classdesc
 * This is a basic base text button which you can use in your Game UI.
 * @augments UIBaseElement
 */
export default class UITextButton extends UIBaseElement {
    /**
     * A Text Button with an outlined background border, filled with background color.
     * It uses a RoundRect as background and changes the background color on hovering over.
     * The background will be drawn with 0.5 opacity, so that the background of the button is
     * slightly shining through.
     * @param {number} x - x pos of the button
     * @param {number} y - y pos of the button
     * @param {string} [settings.font] - The name of the BitmapText font to use
     * @param {number} [settings.size] - The scale factor of the font (default: 1)
     * @param {string} [settings.text] - The text to display (default: 'click me')
     * @param {string} [settings.bindKey] - The key to bind the action to (default: none)
     * @param {string} [settings.backgroundColor] - The css value of a background color
     * @param {string} [settings.hoverColor] - The css value of a color to be used if the pointer hovers over the button
     * @param {string} [settings.borderStrokeColor] - The css value of a color to be used to draw the border
     * @param {string} [settings.fillStyle] - The css value of a tint color to be used to tint the text
     * @param {number} [settings.borderWidth] - Width of the button
     * @param {number} [settings.borderHeight] - Height of the button
     * @example
     * // Create a new Button
     * class PlayButton extends BaseTextButton {
     *      constructor(x,y) {
     *          super(x,y, {
     *              font: 'my-font',
     *              text: 'Play',
     *              // if you omit the next two, size is calculated by the size of the text
     *              borderWidth: 200,
     *              borderHeight: 20,
     *          });
     *      }
     *
     *      onClick(){
     *          state.change(state.PLAY);
     *      }
     * }
     *
     * game.world.addChild(new PlayButton(15,200));
     */
    constructor(x: number, y: number, settings: any);
    font: BitmapText;
    dimensions: import("../../text/textmetrics.js").default;
    border: RoundRect;
    settings: any;
    draw(renderer: any): void;
}
import UIBaseElement from "./uibaseelement.js";
import BitmapText from "../../text/bitmaptext.js";
import RoundRect from "../../geometries/roundrect.js";
