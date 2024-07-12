import { BitmapText, Container, Renderable, video } from "melonjs";
import { data } from "./data";

/**
 * a basic HUD item to display score
 */
class ScoreItem extends Renderable {
	/**
	 * constructor
	 */
	constructor(score, align, x, y) {
		// call the super constructor
		// (size does not matter here)
		super(x, y, 10, 10);

		// create a font
		this.font = new BitmapText(0, 0, {
			font: "PressStart2P",
			size: 1.5,
			textAlign: align,
			textBaseline: "top",
		});

		// ref to the score variable
		this.scoreRef = score;

		// make sure we use screen coordinates
		this.floating = true;
	}

	/**
	 * draw the score
	 */
	draw(context) {
		this.font.draw(context, data[this.scoreRef], this.pos.x, this.pos.y);
	}
}

/**
 * a HUD container a
 */
export class HUDContainer extends Container {
	constructor() {
		// call the constructor
		super();

		// persistent across level change
		this.isPersistent = true;

		// make sure our object is always draw first
		this.z = Number.POSITIVE_INFINITY;

		// give a name
		this.name = "HUD";

		// add our child score object at position
		this.addChild(new ScoreItem("score", "left", 10, 10));

		// add our child score object at position
		this.addChild(new ScoreItem("hiscore", "right", video.renderer.width, 10));
	}
}
