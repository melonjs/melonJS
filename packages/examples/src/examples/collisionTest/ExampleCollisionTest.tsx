import {
	Body,
	Color,
	ColorLayer,
	Ellipse,
	ScaleMethods,
	Sprite,
	device,
	event,
	game,
	input,
	loader,
	math,
	video,
} from "melonjs";
import { useEffect } from "react";
import { createExampleComponent } from "../utils";
import monsterPng from "./assets/monster.png";

class Smilie extends Sprite {
	constructor() {
		super(
			math.random(-15, game.viewport.width),
			math.random(-15, game.viewport.height),
			{
				image: monsterPng,
			},
		);
		// add a physic body with an ellipse as body shape
		this.body = new Body(
			this,
			new Ellipse(6, 6, this.width - 6, this.height - 6),
		);
		this.body.setMaxVelocity(4, 4);
		this.body.force.set(math.randomFloat(-4, 4), math.randomFloat(-4, 4));
		this.body.gravityScale = 0;

		// apply a random tint
		this.tint = new Color().random(64, 255);

		// as we go out of the viewport coordinates
		this.alwaysUpdate = true;
	}

	update() {
		// world limit check
		if (this.pos.x > game.viewport.width) {
			this.body.force.x =
				math.randomFloat(-4, 4) * -Math.sign(this.body.force.x);
		}
		if (this.pos.x < 0) {
			this.body.force.x =
				math.randomFloat(-4, 4) * -Math.sign(this.body.force.x);
		}
		if (this.pos.y > game.viewport.height) {
			this.body.force.y =
				math.randomFloat(-4, 4) * -Math.sign(this.body.force.y);
		}
		if (this.pos.y < 0) {
			this.body.force.y =
				math.randomFloat(-4, 4) * -Math.sign(this.body.force.y);
		}

		// rotate the sprite based on the current velocity
		this.rotate(this.body.force.x < 0 ? -0.05 : 0.05);

		this.setOpacity(0.5);

		return true;
	}

	// collision handler
	onCollision(response) {
		this.setOpacity(1.0);

		this.pos.sub(response.overlapN);

		if (response.overlapN.x !== 0) {
			this.body.force.x =
				math.randomFloat(-4, 4) * -Math.sign(this.body.force.x);
		}
		if (response.overlapN.y !== 0) {
			this.body.force.y =
				math.randomFloat(-4, 4) * -Math.sign(this.body.force.y);
		}

		return false;
	}
}

const createGame = () => {
	// Initialize the video.
	if (!video.init(1024, 768, { scaleMethod: ScaleMethods.Flex })) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// load our monster image and populate the game world
	loader.load({ name: "monster", type: "image", src: monsterPng }, () => {
		// add some keyboard shortcuts
		event.on(event.KEYDOWN, (action, keyCode) => {
			// toggle fullscreen on/off
			if (keyCode === input.KEY.F) {
				if (!device.isFullscreen()) {
					device.requestFullscreen();
				} else {
					device.exitFullscreen();
				}
			}
		});

		// reset/empty the game world
		game.world.reset();

		// add a background layer
		game.world.addChild(new ColorLayer("background", "#5E3F66", 0), 0);

		// Add some objects
		for (let i = 0; i < 255; i++) {
			game.world.addChild(new Smilie(), 3);
		}
	});
};

export const ExampleCollisionTest = createExampleComponent(createGame);
