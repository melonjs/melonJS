import { Sprite, Tween, audio, input, pool, save } from "melonjs";
import { data } from "./data";

/**
 * a mole entity
 * note : we don"t use EntityObject, since we wont" use regular collision, etc..
 */
export class MoleEntity extends Sprite {
	isVisible: boolean;
	isOut: boolean;
	timer: number;
	initialPos: number;
	displayTween: Tween;
	hideTween: Tween;

	constructor(x: number, y: number) {
		// call the constructor
		super(x, y, { image: "mole", framewidth: 178, frameheight: 140 });

		// idle animation
		this.addAnimation("idle", [0]);
		// laugh animation
		this.addAnimation("laugh", [1, 2, 3, 2, 3, 1]);
		// touch animation
		this.addAnimation("touch", [4, 5, 6, 4, 5, 6]);

		// set default one
		this.setCurrentAnimation("idle");

		// use top left coordinates for positioning
		this.anchorPoint.set(0, 0);

		// means fully hidden in the hole
		this.isVisible = false;
		this.isOut = false;
		this.timer = 0;

		this.initialPos = this.pos.y;

		this.isKinematic = false;

		// register on mouse event
		input.registerPointerEvent(
			"pointerdown",
			this,
			this.onMouseDown.bind(this),
		);
	}

	/**
	 * callback for mouse click
	 */
	onMouseDown() {
		if (this.isOut === true) {
			this.isOut = false;
			// set touch animation
			this.setCurrentAnimation("touch", this.hide.bind(this));
			// make it flicker
			this.flicker(750);
			// play ow FX
			audio.play("ow");

			// add some points
			data.score += 100;

			if (data.hiscore < data.score) {
				// i could save direclty to me.save
				// but that allows me to only have one
				// simple HUD Score Object
				data.hiscore = data.score;
				// save to local storage
				save.hiscore = data.hiscore;
			}

			// stop propagating the event
			return false;
		}
	}

	/**
	 * display the mole
	 * goes out of the hole
	 */
	display() {
		const finalpos = this.initialPos - 140;
		this.displayTween = pool.pull("me.Tween", this.pos) as Tween;
		this.displayTween.to({ y: finalpos }, { duration: 200 });
		this.displayTween.easing(Tween.Easing.Quadratic.Out);
		this.displayTween.onComplete(this.onDisplayed.bind(this));
		this.displayTween.start();
		// the mole is visible
		this.isVisible = true;
	}

	/**
	 * callback when fully visible
	 */
	onDisplayed() {
		this.isOut = true;
		this.timer = 0;
	}

	/**
	 * hide the mole
	 * goes into the hole
	 */
	hide() {
		const finalpos = this.initialPos;
		this.displayTween = pool.pull("me.Tween", this.pos) as Tween;
		this.displayTween.to({ y: finalpos }, { duration: 200 });
		this.displayTween.easing(Tween.Easing.Quadratic.In);
		this.displayTween.onComplete(this.onHidden.bind(this));
		this.displayTween.start();
	}

	/**
	 * callback when fully visible
	 */
	onHidden() {
		this.isVisible = false;
		// set default one
		this.setCurrentAnimation("idle");
	}

	/**
	 * update the mole
	 */
	override update(dt: number) {
		if (this.isVisible) {
			// call the super function to manage animation
			super.update(dt);

			// hide the mode after 1/2 sec
			if (this.isOut === true) {
				this.timer += dt;
				if (this.timer >= 500) {
					this.isOut = false;
					// set default one
					this.setCurrentAnimation("laugh");
					this.hide();
					// play laugh FX
					//me.audio.play("laugh");

					// decrease score by 25 pts
					data.score -= 25;
					if (data.score < 0) {
						data.score = 0;
					}
				}
				return true;
			}
		}
		return this.isVisible;
	}
}
