import { Sprite, game, math } from "melonjs";

export class Fruit extends Sprite {
	gravity: number;
	speedX: number;
	speedY: number;

	constructor(fruitType: string) {
		super(
			math.random(-15, game.viewport.width),
			math.random(-15, game.viewport.height),
			{
				image: fruitType,
			},
		);

		this.gravity = 0.9;
		this.speedX = Math.random() * 10;
		this.speedY = Math.random() * 10 - 5;
		this.alwaysUpdate = true;
	}

	override update() {
		const viewport = game.viewport;
		const pos = this.pos;

		pos.x += this.speedX;
		pos.y += this.speedY;
		this.speedY += this.gravity;

		if (pos.x > viewport.right) {
			this.speedX *= -1;
			pos.x = viewport.right;
		} else if (pos.x < viewport.left) {
			this.speedX *= -1;
			pos.x = viewport.left;
		}

		if (pos.y > viewport.bottom) {
			this.speedY *= -0.85;
			pos.y = viewport.bottom;
			const rand = Math.random();
			if (rand > 0.5) {
				this.speedY -= rand * 6;
			}
		} else if (pos.y < viewport.top) {
			this.speedY = 0;
			pos.y = viewport.top;
		}

		return true;
	}
}
