/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Container,
	loader,
	Renderable,
	type Renderer,
	Tween,
} from "melonjs";
import { PALETTE } from "../constants";
import { gameState } from "../gameState";
import { blit, drawLabel, drawText, textWidth } from "../gfx";

const image = (name: string) => loader.getImage(name) as HTMLImageElement;

/** the status bar at the bottom of the screen */
export class HUD extends Renderable {
	paused = false;

	constructor() {
		super(0, 440, 640, 40);
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
	}

	override update() {
		return true;
	}

	override draw(renderer: Renderer) {
		renderer.setColor(PALETTE[0]);
		renderer.fillRect(0, 440, 640, 40);

		const life = image("hud_life");
		blit(renderer, life, 4, 444);
		drawText(renderer, gameState.lives, 4 + life.width, 442, 40);

		const heart = image("hud_heart");
		for (let i = 0; i < gameState.health; i++) {
			blit(renderer, heart, 180 + i * heart.width, 443);
		}

		const egg = image("hud_egg");
		blit(renderer, egg, 300, 443);
		drawText(renderer, gameState.ammo, 300 + egg.width, 442, 40);

		drawText(renderer, gameState.score, 636, 442, 40, "right");

		if (this.paused) {
			renderer.setGlobalAlpha(0.8);
			renderer.setColor("#000000");
			renderer.fillRect(0, 210, 640, 60);
			renderer.setGlobalAlpha(1);
			drawText(renderer, "P A U S E", 320, 220, 40, "center");
		}
	}
}

/** the bouncing "let's go!" sign, with the level name sliding in */
export class LetsGo extends Renderable {
	label: string;
	signY: number;
	labelX: number;
	tween: Tween;
	labelTween: Tween;

	constructor(label: string) {
		super(0, 0, 640, 480);
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
		this.label = label.toUpperCase();
		const sign = image("lets_go_msg");
		this.signY = -sign.height;
		const width = textWidth(this.label);
		this.labelX = -width;

		this.tween = new Tween(this)
			.to({ signY: 140 }, { duration: 1500, easing: Tween.Easing.Bounce.Out })
			.onComplete(() => this.leave());
		this.labelTween = new Tween(this).to(
			{ labelX: (640 - width) / 2 },
			{ duration: 750 },
		);
		this.tween.start();
		this.labelTween.start();
	}

	private leave() {
		this.tween = new Tween(this)
			.to({ signY: 520 }, { duration: 1500, easing: Tween.Easing.Circular.Out })
			.onComplete(() => {
				(this.ancestor as Container | undefined)?.removeChild(this);
			})
			.start();
		this.labelTween = new Tween(this)
			.to({ labelX: 640 }, { duration: 500 })
			.start();
	}

	override update() {
		return true;
	}

	override draw(renderer: Renderer) {
		const sign = image("lets_go_msg");
		blit(
			renderer,
			sign,
			Math.round((640 - sign.width) / 2),
			Math.round(this.signY),
		);
		drawLabel(renderer, this.label, Math.round(this.labelX), 260);
	}
}

/** the falling "game over" sign */
export class GameOverSign extends Renderable {
	signY: number;

	constructor(onDone: () => void) {
		super(0, 0, 640, 480);
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
		this.signY = -image("gameover").height;
		new Tween(this)
			.to({ signY: 180 }, { duration: 3000, easing: Tween.Easing.Bounce.Out })
			.onComplete(onDone)
			.start();
	}

	override update() {
		return true;
	}

	override draw(renderer: Renderer) {
		const sign = image("gameover");
		blit(
			renderer,
			sign,
			Math.round((640 - sign.width) / 2),
			Math.round(this.signY),
		);
	}
}
