import Vector2d from "../../math/vector2.js";
import BitmapText from "../../text/bitmaptext.js";
import RoundRect from "../../geometries/roundrect.js";
import UIBaseElement from "./uibaseelement.js";


/**
 * @classdesc
 * This is a basic base text button which you can use in your Game UI.
 * @augments UIBaseElement
 */
class UITextButton extends UIBaseElement {
    /**
     * A Text Button with an outlined background border, filled with background color.
     * It uses a RoundRect as background and changes the background color on hovering over.
     * The background will be drawn with 0.5 opacity, so that the background of the button is
     * slightly shining through.
     * @param {number} x x pos of the button
     * @param {number} y y pos of the button
     * @param {string} [settings.font] The name of the BitmapText font to use
     * @param {number} [settings.size] The scale factor of the font (default: 1)
     * @param {string} [settings.text] The text to display (default: 'click me')
     * @param {string} [settings.bindKey] The key to bind the action to (default: none)
     * @param {string} [settings.backgroundColor] The css value of a background color
     * @param {string} [settings.hoverColor] The css value of a color to be used if the pointer hovers over the button
     * @param {string} [settings.borderStrokeColor] The css value of a color to be used to draw the border
     * @param {boolean} [settings.offScreenCanvas] Weather to use an offScreen canvas or not
     * @param {string} [settings.fillStyle] The css value of a tint color to be used to tint the text
     * @param {number} [settings.borderWidth] Width of the button
     * @param {number} [settings.borderHeight] Height of the button
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
    constructor(x, y, settings) {
        super(x, y);
        settings.font = settings.font || "24Outline";
        settings.size = settings.size || 1;
        settings.text = settings.text || "<Click Me>";
        settings.bindKey = settings.bindKey || -1;
        settings.backgroundColor = settings.backgroundColor || "#00aa00";
        settings.hoverColor = settings.hoverColor || "#00ff00";
        settings.borderStrokeColor = settings.borderStrokeColor || "#000000";
        settings.offScreenCanvas = settings.offScreenCanvas || false;
        settings.fillStyle = settings.fillStyle || "#ffffff";
        settings.lineWidth = settings.lineWidth || 1;
        settings.anchorPoint = settings.anchorPoint || new Vector2d(0, 0);

        let font = new BitmapText(x, y, settings);
        let dimensions = font.measureText();
        settings.borderWidth = settings.borderWidth || dimensions.width + 16;
        settings.borderHeight = settings.borderHeight || dimensions.height + 16;

        let border = new RoundRect(
            x,
            y,
            settings.borderWidth,
            settings.borderHeight
        );
        super.setShape(
            x,
            y,
            border.getBounds().width,
            border.getBounds().height
        );

        // build up
        this.font = font;
        this.dimensions = dimensions;
        this.border = border;
        this.settings = settings;

        // adjust text position
        this.font.pos.set(
            Math.round((border.width - dimensions.width) / 2) + this.font.pos.x,
            Math.round((border.height - dimensions.height) / 2) +
                this.font.pos.y
        );
    }

    draw(renderer) {
        renderer.setGlobalAlpha(0.5);
        if (!this.hover) {
            renderer.setColor(this.settings.backgroundColor);
        } else {
            renderer.setColor(this.settings.hoverColor);
        }

        renderer.fill(this.border);
        renderer.setGlobalAlpha(1);
        renderer.setColor(this.settings.borderStrokeColor);
        renderer.stroke(this.border);

        // fix: supporting tint
        renderer.setTint(this.font.tint, this.font.getOpacity());
        this.font.draw(
            renderer,
            this.settings.text,
            this.font.pos.x,
            this.font.pos.y
        );
    }
}
export default UITextButton;

