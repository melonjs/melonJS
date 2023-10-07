/**
 * @classdesc
 * This is a basic base text button which you can use in your Game UI.
 * @augments UIBaseElement
 */
export default class UITextButton extends UIBaseElement {
    /**
     * A Bitmap Text Button with an outlined background border, filled with background color.
     * It uses a RoundRect as background and changes the background color on hovering over.
     * The background will be drawn with 0.5 opacity, so that the background of the button is
     * slightly shining through.
     * @param {number} x - x pos of the button
     * @param {number} y - y pos of the button
     * @param {string} [settings.font] - The name of the BitmapText font to use
     * @param {number} [settings.size=1] - The scale factor of the BitmapText
     * @param {string} [settings.text] - The text to display
     * @param {string} [settings.bindKey] - The key to bind the action to (default: none)
     * @param {string} [settings.hoverOffColor="#00aa0080"] - The css value of a color to be used if the pointer is not hovering over the button
     * @param {string} [settings.hoverOnColor="#00ff00ff"] - The css value of a color to be used if the pointer hovers over the button
     * @param {string} [settings.borderStrokeColor="#000000"] - The css value of a color to be used to draw the border
     * @param {string} [settings.fillStyle] - The css value of a tint color to be used to tint the BitmapText
     * @param {string} [settings.textAlign="center"] - horizontal text alignment
     * @param {string} [settings.textBaseline="middle"] - the text baseline
     * @param {number} [settings.borderWidth] - Width of the button
     * @param {number} [settings.borderHeight] - Height of the button
     * @example
     * // Create a new Button
     * class PlayButton extends UITextButton {
     *      constructor(x,y) {
     *          super(x,y, {
     *              font: 'my-font',
     *              text: 'Play',
     *              // if you omit the next two, size is calculated by the size of the text
     *              borderWidth: 200,
     *              borderHeight: 20,
     *              backgroundColor: '#00aa0080',
     *              hoverColor: '#00ff00ff'
     *          });
     *      }
     *
     *      onClick(){
     *          state.change(state.PLAY);
     *      }
     * }
     *
     * world.addChild(new PlayButton(15,200));
     */
    constructor(x: number, y: number, settings: any);
    /**
     * The key to bind the action to
     * @type {string}
     */
    bindKey: string;
    /**
     * The css value of a color to be used if the pointer is nothovering over the button
     * @type {string}
     */
    hoverOffColor: string;
    /**
     * The css value of a color to be used if the pointer hovers over the button
     * @type {string}
     */
    hoverOnColor: string;
    /**
     * The css value of a color to be used to draw the border
     * @type {string}
     */
    borderStrokeColor: string;
    /**
     * Set the default text alignment (or justification),<br>
     * possible values are "left", "right", and "center".
     * @public
     * @type {string}
     * @default "center"
     */
    public textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @public
     * @type {string}
     * @default "middle"
     */
    public textBaseline: string;
    /**
     * the bitmapText used by the UITextButton class
     * @type {BitmapText}
     */
    bitmapText: BitmapText;
    dimensions: import("../text/textmetrics.js").default;
    border: RoundRect;
    draw(renderer: any): void;
}
import UIBaseElement from "./uibaseelement.js";
import BitmapText from "../text/bitmaptext.js";
import RoundRect from "../../geometries/roundrect.js";
