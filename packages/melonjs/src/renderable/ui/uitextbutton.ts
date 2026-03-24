import { RoundRect } from "../../geometries/roundrect.ts";
import type { Bounds } from "../../physics/bounds.ts";
import type Renderer from "../../video/renderer.js";
import BitmapText from "../text/bitmaptext.js";
import UIBaseElement from "./uibaseelement.ts";

interface UITextButtonSettings {
	font?: string;
	size?: number;
	text?: string;
	bindKey?: string;
	hoverOffColor?: string;
	hoverOnColor?: string;
	borderStrokeColor?: string;
	fillStyle?: string;
	textAlign?: string;
	textBaseline?: string;
	borderWidth?: number;
	borderHeight?: number;
	/** @deprecated use hoverOffColor */
	backgroundColor?: string;
	/** @deprecated use hoverOnColor */
	hoverColor?: string;
	[key: string]: any;
}

/**
 * This is a basic base text button which you can use in your Game UI.
 * @category UI
 */
export default class UITextButton extends UIBaseElement {
	/**
	 * The key to bind the action to
	 */
	bindKey: string | number;

	/**
	 * The css value of a color to be used if the pointer is not hovering over the button
	 */
	hoverOffColor: string;

	/**
	 * The css value of a color to be used if the pointer hovers over the button
	 */
	hoverOnColor: string;

	/**
	 * The css value of a color to be used to draw the border
	 */
	borderStrokeColor: string;

	/**
	 * Set the default text alignment (or justification),<br>
	 * possible values are "left", "right", and "center".
	 * @default "center"
	 */
	textAlign: string;

	/**
	 * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
	 * possible values are "top", "hanging", "middle", "alphabetic", "ideographic", "bottom"<br>
	 * @default "middle"
	 */
	textBaseline: string;

	/**
	 * the bitmapText used by the UITextButton class
	 */
	bitmapText: BitmapText;

	/**
	 * the measured text dimensions
	 */
	dimensions: Bounds;

	/**
	 * the round rect border
	 */
	border: RoundRect;

	/**
	 * A Bitmap Text Button with an outlined background border, filled with background color.
	 * It uses a RoundRect as background and changes the background color on hovering over.
	 * The background will be drawn with 0.5 opacity, so that the background of the button is
	 * slightly shining through.
	 * @param x - x pos of the button
	 * @param y - y pos of the button
	 * @param settings - settings object
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
	constructor(x: number, y: number, settings: UITextButtonSettings) {
		super(x, y);

		this.bindKey = settings.bindKey || -1;

		/* eslint-disable @typescript-eslint/no-deprecated */
		// keep settings.backgroundColor for backward compatibility
		this.hoverOffColor =
			settings.hoverOffColor || settings.backgroundColor || "#00aa0080";

		// keep settings.hoverColor for backward compatibility
		this.hoverOnColor =
			settings.hoverOnColor || settings.hoverColor || "#00ff00ff";
		/* eslint-enable @typescript-eslint/no-deprecated */

		this.borderStrokeColor = settings.borderStrokeColor || "#000000";

		this.textAlign = settings.textAlign = settings.textAlign || "center";

		this.textBaseline = settings.textBaseline =
			settings.textBaseline || "middle";

		this.bitmapText = new BitmapText(0, 0, settings as any);

		// "detect" the button size
		this.dimensions = this.bitmapText.measureText();
		settings.borderWidth = settings.borderWidth || this.dimensions.width + 16;
		settings.borderHeight =
			settings.borderHeight || this.dimensions.height + 16;

		// create the round rect button
		this.border = new RoundRect(
			x,
			y,
			settings.borderWidth,
			settings.borderHeight,
		);

		// resize the container accordingly
		this.resize(this.border.getBounds().width, this.border.getBounds().height);

		// adjust size position
		this.bitmapText.pos.set(this.width / 2, this.height / 2);

		// add bitmapText to the UI container
		this.addChild(this.bitmapText);
	}

	override draw(renderer: Renderer): void {
		const r = renderer as any;
		if (this.hover) {
			r.setColor(this.hoverOnColor);
		} else {
			r.setColor(this.hoverOffColor);
		}
		r.fill(this.border);
		r.setColor(this.borderStrokeColor);
		r.stroke(this.border);
		super.draw(renderer as any);
	}
}
