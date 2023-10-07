import BitmapText from "../text/bitmaptext.js";
import RoundRect from "../../geometries/roundrect.js";
import UIBaseElement from "./uibaseelement.js";


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
    constructor(x, y, settings) {
        super(x, y);

        /**
         * The key to bind the action to
         * @type {string}
         */
        this.bindKey = settings.bindKey || -1;

        /**
         * The css value of a color to be used if the pointer is nothovering over the button
         * @type {string}
         */
        // keep settings.backgroundColor for backward compatibility
        this.hoverOffColor = settings.hoverOffColor || settings.backgroundColor || "#00aa0080";

        /**
         * The css value of a color to be used if the pointer hovers over the button
         * @type {string}
         */
        // keep settings.hoverColor for backward compatibility
        this.hoverOnColor = settings.hoverOnColor || settings.hoverColor || "#00ff00ff";

        /**
         * The css value of a color to be used to draw the border
         * @type {string}
         */
        this.borderStrokeColor = settings.borderStrokeColor || "#000000";

        /**
         * Set the default text alignment (or justification),<br>
         * possible values are "left", "right", and "center".
         * @public
         * @type {string}
         * @default "center"
         */
        this.textAlign = settings.textAlign = settings.textAlign || "center";

        /**
         * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
         * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
         * @public
         * @type {string}
         * @default "middle"
         */
        this.textBaseline = settings.textBaseline = settings.textBaseline || "middle";

        /**
         * the bitmapText used by the UITextButton class
         * @type {BitmapText}
         */
        this.bitmapText = new BitmapText(0, 0, settings);

        // "detect" the button size
        this.dimensions = this.bitmapText.measureText();
        settings.borderWidth = settings.borderWidth || this.dimensions.width + 16;
        settings.borderHeight = settings.borderHeight || this.dimensions.height + 16;

        // create the round rect button
        this.border = new RoundRect(x, y, settings.borderWidth, settings.borderHeight);

        // resize the container accordingly
        this.resize(
            this.border.getBounds().width,
            this.border.getBounds().height
        );

        // adjust size position
        this.bitmapText.pos.set(this.width / 2, this.height / 2);

        // add bitmapText to the UI container
        this.addChild(this.bitmapText);
    }

    draw(renderer) {
        if (this.hover === true) {
            renderer.setColor(this.hoverOnColor);
        } else {
            renderer.setColor(this.hoverOffColor);
        }
        renderer.fill(this.border);
        renderer.setColor(this.borderStrokeColor);
        renderer.stroke(this.border);
        super.draw(renderer);
    }
}


