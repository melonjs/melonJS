import {
	Container,
	Sprite,
	UISpriteElement,
	Vector2d,
	event,
	game,
	input,
} from "melonjs";
import { gameState } from "../gameState";

/**
 * a basic control to toggle fullscreen on/off
 */
class Button extends UISpriteElement {
	/**
	 * constructor
	 */
	constructor(x, y) {
		super(x, y, {
			image: gameState.texture,
			region: "shadedDark36.png",
		});
		this.setOpacity(0.25);
		this.anchorPoint.set(0, 0);
	}

	/**
	 * function called when the object is clicked on
	 */
	onClick(event) {
		this.setOpacity(0.5);
		input.triggerKeyEvent(input.KEY.SPACE, true);
		return false;
	}

	/**
	 * function called when the object is clicked on
	 */
	onRelease(event) {
		this.setOpacity(0.25);
		input.triggerKeyEvent(input.KEY.SPACE, false);
		return false;
	}
}

/**
 * a virtual joypad
 */
class Joypad extends UISpriteElement {
	/**
	 * constructor
	 */
	constructor(x, y) {
		super(x, y, {
			// background "fix" part of the joypad
			image: gameState.texture,
			region: "shadedDark07.png",
			anchorPoint: new Vector2d(0, 0),
		});

		// mobile part of the joypad
		this.pad = new Sprite(x, y, {
			image: gameState.texture,
			region: "shadedDark01.png",
			anchorPoint: new Vector2d(0, 0),
		});

		// default relative position from the back of the joypad
		this.relative = new Vector2d(
			this.width / 2 - this.pad.width / 2,
			this.height / 2 - this.pad.height / 2,
		);

		// offset by which the joypad move when pressed/moved
		this.joypad_offset = new Vector2d();

		// default opacity
		this.setOpacity(0.25);

		// cursors status
		// TODO make it configurable
		this.cursors = {
			up: false,
			down: false,
			left: false,
			right: false,
		};

		// register on the pointermove event
		input.registerPointerEvent(
			"pointermove",
			this,
			this.pointerMove.bind(this),
		);
	}

	onDestroyEvent() {
		// release register event event
		input.releasePointerEvent("pointermove", this);
	}

	/**
	 * pointermove function
	 */
	pointerMove(event) {
		if (this.released === false) {
			const x = event.gameScreenX + event.width / 2;
			const y = event.gameScreenY + event.height / 2;
			// pointerMove is a global on the viewport, so check for coordinates
			if (this.getBounds().contains(x, y)) {
				// if any direction is active, update it if necessary
				if (this.cursors.left === true || this.cursors.right === true) {
					this.checkDirection.call(this, x, y);
				}
			} else {
				// release keys/joypad if necessary
				this.onRelease.call(this, event);
			}
		}
	}

	// update the cursors value and trigger key event
	checkDirection(x, y) {
		if (x - this.pos.x < this.width / 2) {
			if (this.cursors.left === false) {
				input.triggerKeyEvent(input.KEY.LEFT, true);
				this.cursors.left = true;
				this.joypad_offset.x = -(
					((this.width / 2 - (x - this.pos.x)) % this.pad.width) /
					4
				);
			}
			// release the right key if it was pressed
			if (this.cursors.right === true) {
				input.triggerKeyEvent(input.KEY.RIGHT, false);
				this.cursors.right = false;
			}
		}
		if (x - this.pos.x > this.width / 2) {
			if (this.cursors.right === false) {
				input.triggerKeyEvent(input.KEY.RIGHT, true);
				this.cursors.right = true;
				this.joypad_offset.x = +(
					((x - this.pos.x - this.width / 2) % this.pad.width) /
					4
				);
			}
			// release the left key is it was pressed
			if (this.cursors.left === true) {
				input.triggerKeyEvent(input.KEY.LEFT, false);
				this.cursors.left = false;
			}
		}
	}

	/**
	 * function called when the object is clicked on
	 */
	onClick(event) {
		const x = event.gameScreenX + event.width / 2;
		const y = event.gameScreenY + event.height / 2;
		this.setOpacity(0.5);
		this.checkDirection.call(this, x, y);
		return false;
	}

	/**
	 * function called when the object is release or cancelled
	 */
	onRelease(event) {
		this.setOpacity(0.25);
		if (this.cursors.left === true) {
			input.triggerKeyEvent(input.KEY.LEFT, false);
			this.cursors.left = false;
		}
		if (this.cursors.right === true) {
			input.triggerKeyEvent(input.KEY.RIGHT, false);
			this.cursors.right = false;
		}
		this.joypad_offset.set(0, 0);
		return false;
	}

	/**
	 * extend the draw function
	 */
	draw(renderer) {
		// call the super constructor
		super.draw(renderer);
		this.pad.pos.setV(this.pos).add(this.relative).add(this.joypad_offset);
		this.pad.draw(renderer);
	}
}

/**
 * a very simple virtual joypad and buttons, that triggers
 * corresponding key events
 */
export class VirtualJoypad extends Container {
	constructor() {
		// call the constructor
		super();

		// persistent across level change
		this.isPersistent = true;

		// Use screen coordinates
		this.floating = true;

		// make sure our object is always draw first
		this.z = Number.POSITIVE_INFINITY;

		// give a name
		this.name = "VirtualJoypad";

		// instance of the virtual joypad
		this.joypad = new Joypad(50, game.viewport.height - 200);

		// instance of the button
		this.button = new Button(
			game.viewport.width - 150,
			game.viewport.height - 150,
		);

		this.addChild(this.joypad);
		this.addChild(this.button);

		event.on(event.VIEWPORT_ONRESIZE, (width, height) => {
			this.button.pos.set(width - 150, height - 150, this.button.pos.z);
		});
	}
}
