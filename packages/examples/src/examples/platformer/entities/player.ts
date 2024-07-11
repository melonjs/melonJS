import {
	Entity,
	audio,
	collision,
	game,
	input,
	level,
	timer,
	video,
} from "melonjs";
import { gameState } from "../gameState";

export class PlayerEntity extends Entity {
	constructor(x, y, settings) {
		// call the constructor
		super(x, y, settings);

		// set a "player object" type
		this.body.collisionType = collision.types.PLAYER_OBJECT;

		// player can exit the viewport (jumping, falling into a hole, etc.)
		this.alwaysUpdate = true;

		// walking & jumping speed
		this.body.setMaxVelocity(3, 15);
		this.body.setFriction(0.4, 0);

		this.dying = false;

		this.multipleJump = 1;

		// set the viewport to follow this renderable on both axis, and enable damping
		game.viewport.follow(this, game.viewport.AXIS.BOTH, 0.1);

		// enable keyboard
		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.X, "jump", true);
		input.bindKey(input.KEY.UP, "jump", true);
		input.bindKey(input.KEY.SPACE, "jump", true);
		input.bindKey(input.KEY.DOWN, "down");

		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.W, "jump", true);
		input.bindKey(input.KEY.S, "down");

		//me.input.registerPointerEvent("pointerdown", this, this.onCollision.bind(this));
		//me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.LEFT);

		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 },
			input.KEY.UP,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_2 },
			input.KEY.UP,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.DOWN },
			input.KEY.DOWN,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_3 },
			input.KEY.DOWN,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_4 },
			input.KEY.DOWN,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.LEFT },
			input.KEY.LEFT,
		);
		input.bindGamepad(
			0,
			{ type: "buttons", code: input.GAMEPAD.BUTTONS.RIGHT },
			input.KEY.RIGHT,
		);

		// map axes
		input.bindGamepad(
			0,
			{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: -0.5 },
			input.KEY.LEFT,
		);
		input.bindGamepad(
			0,
			{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: 0.5 },
			input.KEY.RIGHT,
		);
		input.bindGamepad(
			0,
			{ type: "axes", code: input.GAMEPAD.AXES.LY, threshold: -0.5 },
			input.KEY.UP,
		);

		// set a renderable
		this.renderable = gameState.texture.createAnimationFromName([
			"walk0001.png",
			"walk0002.png",
			"walk0003.png",
			"walk0004.png",
			"walk0005.png",
			"walk0006.png",
			"walk0007.png",
			"walk0008.png",
			"walk0009.png",
			"walk0010.png",
			"walk0011.png",
		]);

		// define a basic walking animatin
		this.renderable.addAnimation("stand", [
			{ name: "walk0001.png", delay: 100 },
		]);
		this.renderable.addAnimation("walk", [
			{ name: "walk0001.png", delay: 100 },
			{ name: "walk0002.png", delay: 100 },
			{ name: "walk0003.png", delay: 100 },
		]);
		this.renderable.addAnimation("jump", [
			{ name: "walk0004.png", delay: 150 },
			{ name: "walk0005.png", delay: 150 },
			{ name: "walk0006.png", delay: 150 },
			{ name: "walk0002.png", delay: 150 },
			{ name: "walk0001.png", delay: 150 },
		]);

		// set as default
		this.renderable.setCurrentAnimation("walk");

		// set the renderable position to bottom center
		this.anchorPoint.set(0.5, 1.0);
	}

	/**
	 ** update the force applied
	 */
	update(dt) {
		if (input.isKeyPressed("left")) {
			if (this.body.vel.y === 0) {
				this.renderable.setCurrentAnimation("walk");
			}
			this.body.force.x = -this.body.maxVel.x;
			this.renderable.flipX(true);
		} else if (input.isKeyPressed("right")) {
			if (this.body.vel.y === 0) {
				this.renderable.setCurrentAnimation("walk");
			}
			this.body.force.x = this.body.maxVel.x;
			this.renderable.flipX(false);
		}

		if (input.isKeyPressed("jump")) {
			this.renderable.setCurrentAnimation("jump");
			this.body.jumping = true;
			if (this.multipleJump <= 2) {
				// easy "math" for double jump
				this.body.force.y = -this.body.maxVel.y * this.multipleJump++;
				audio.stop("jump");
				audio.play("jump", false);
			}
		} else {
			if (!this.body.falling && !this.body.jumping) {
				// reset the multipleJump flag if on the ground
				this.multipleJump = 1;
			} else if (this.body.falling && this.multipleJump < 2) {
				// reset the multipleJump flag if falling
				this.multipleJump = 2;
			}
		}

		if (this.body.force.x === 0 && this.body.force.y === 0) {
			this.renderable.setCurrentAnimation("stand");
		}

		// check if we fell into a hole
		if (!this.inViewport && this.getBounds().top > video.renderer.height) {
			// if yes reset the game
			game.world.removeChild(this);
			game.viewport.fadeIn("#fff", 150, () => {
				audio.play("die", false);
				level.reload();
				game.viewport.fadeOut("#fff", 150);
			});
			return true;
		}

		// check if we moved (an "idle" animation would definitely be cleaner)
		if (
			this.body.vel.x !== 0 ||
			this.body.vel.y !== 0 ||
			this.renderable?.isFlickering()
		) {
			super.update(dt);
			return true;
		}
		return false;
	}

	/**
	 * colision handler
	 */
	onCollision(response, other) {
		switch (other.body.collisionType) {
			case collision.types.WORLD_SHAPE:
				// Simulate a platform object
				if (other.type === "platform") {
					if (
						this.body.falling &&
						!input.isKeyPressed("down") &&
						// Shortest overlap would move the player upward
						response.overlapV.y > 0 &&
						// The velocity is reasonably fast enough to have penetrated to the overlap depth
						~~this.body.vel.y >= ~~response.overlapV.y
					) {
						// Disable collision on the x axis
						response.overlapV.x = 0;
						// Repond to the platform (it is solid)
						return true;
					}
					// Do not respond to the platform (pass through)
					return false;
				}

				// Custom collision response for slopes
				if (other.type === "slope") {
					// Always adjust the collision response upward
					response.overlapV.y = Math.abs(response.overlap);
					response.overlapV.x = 0;

					// Respond to the slope (it is solid)
					return true;
				}
				break;

			case collision.types.ENEMY_OBJECT:
				if (!other.isMovingEnemy) {
					// spike or any other fixed danger
					this.body.vel.y -= this.body.maxVel.y * timer.tick;
					this.hurt();
				} else {
					// a regular moving enemy entity
					if (response.overlapV.y > 0 && this.body.falling) {
						// jump
						this.body.vel.y -= this.body.maxVel.y * 1.5 * timer.tick;
					} else {
						this.hurt();
					}
					// Not solid
					return false;
				}
				break;

			default:
				// Do not respond to other objects (e.g. coins)
				return false;
		}

		// Make the object solid
		return true;
	}

	/**
	 * ouch
	 */
	hurt() {
		const sprite = this.renderable;

		if (!sprite.isFlickering()) {
			// tint to red and flicker
			sprite.tint.setColor(255, 192, 192);
			sprite.flicker(750, () => {
				// clear the tint once the flickering effect is over
				sprite.tint.setColor(255, 255, 255);
			});

			// flash the screen
			game.viewport.fadeIn("#FFFFFF", 75);
			audio.play("die", false);
		}
	}
}
