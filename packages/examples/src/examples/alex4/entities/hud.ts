/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { BitmapText, Container, Sprite, Tween, UIPanel } from "melonjs";
import { HEIGHT, PALETTE, WIDTH } from "../constants";
import { gameState } from "../gameState";

/************************************************************************************/
/*      a HUD item: an icon and a number                                            */
/************************************************************************************/
class HUDCounter extends Container {
	label: BitmapText;
	value = -1;

	constructor(
		x: number,
		y: number,
		icon: string,
		private read: () => number,
	) {
		super(x, y, 140, 40);
		const sprite = new Sprite(0, 2, {
			image: icon,
			anchorPoint: { x: 0, y: 0 },
		});
		this.addChild(sprite);
		this.label = new BitmapText(sprite.width, -2, { font: "atascii40" });
		this.addChild(this.label);
	}

	override update(dt: number) {
		const value = this.read();
		if (value !== this.value) {
			this.value = value;
			this.label.setText(value);
		}
		return super.update(dt);
	}
}

/************************************************************************************/
/*      Alex's hearts                                                               */
/************************************************************************************/
class HUDEnergy extends Container {
	hearts: Sprite[] = [];

	constructor(x: number, y: number) {
		super(x, y, 80, 40);
		for (let i = 0; i < 2; i++) {
			const heart = new Sprite(i * 34, 3, {
				image: "hud_heart",
				anchorPoint: { x: 0, y: 0 },
			});
			this.hearts.push(heart);
			this.addChild(heart);
		}
	}

	override update(dt: number) {
		this.hearts.forEach((heart, i) => {
			heart.setOpacity(i < gameState.energy ? 1 : 0);
		});
		return super.update(dt);
	}
}

/************************************************************************************/
/*      the status bar at the bottom of the screen                                  */
/************************************************************************************/
export class HUD extends Container {
	score: BitmapText;

	constructor() {
		super(0, HEIGHT - 40, WIDTH, 40);
		// screen space, kept when the level reloads
		this.floating = true;
		this.isPersistent = true;
		this.name = "HUD";

		this.addChild(
			new UIPanel(0, 0, {
				width: WIDTH,
				height: 40,
				fillColor: PALETTE[0],
				borderColor: null,
			}),
		);
		this.addChild(new HUDCounter(4, 0, "hud_life", () => gameState.lives));
		this.addChild(new HUDEnergy(180, 0));
		this.addChild(new HUDCounter(300, 0, "hud_egg", () => gameState.eggs));
		this.score = new BitmapText(WIDTH - 4, -2, {
			font: "atascii40",
			textAlign: "right",
		});
		this.addChild(this.score);
	}

	override update(dt: number) {
		this.score.setText(gameState.score);
		return super.update(dt);
	}
}

/************************************************************************************/
/*      the bouncing "let's go!" sign, and the level name                           */
/************************************************************************************/
export class LetsGoMessage extends Container {
	constructor(label: string) {
		super(0, 0, WIDTH, HEIGHT);
		this.floating = true;

		const sign = new Sprite(0, 0, {
			image: "lets_go_msg",
			anchorPoint: { x: 0, y: 0 },
		});
		sign.pos.set((this.width - sign.width) / 2, -sign.height);
		this.addChild(sign);

		const title = new BitmapText(0, 250, {
			font: "atascii32",
			text: label.toUpperCase(),
		});
		const width = title.measureText().width;
		title.pos.x = -width;
		this.addChild(title);

		// drop in, bounce, and leave
		new Tween(sign.pos)
			.to({ y: 140 }, { duration: 1500, easing: Tween.Easing.Bounce.Out })
			.chain(
				new Tween(sign.pos)
					.to(
						{ y: this.height },
						{ duration: 1500, easing: Tween.Easing.Circular.Out },
					)
					.onComplete(() => {
						this.parentApp.world.removeChild(this);
					}),
			)
			.start();
		new Tween(title.pos)
			.to({ x: (this.width - width) / 2 }, { duration: 750 })
			.chain(
				new Tween(title.pos).to(
					{ x: this.width },
					{ duration: 500, delay: 750 },
				),
			)
			.start();
	}
}

/************************************************************************************/
/*      the falling "game over" sign                                                */
/************************************************************************************/
export class GameOverMessage extends Sprite {
	constructor(onComplete: () => void) {
		super(0, 0, { image: "gameover", anchorPoint: { x: 0, y: 0 } });
		this.floating = true;
		this.pos.set((WIDTH - this.width) / 2, -this.height);
		new Tween(this.pos)
			.to({ y: 200 }, { duration: 3000, easing: Tween.Easing.Bounce.Out })
			.onComplete(onComplete)
			.start();
	}
}

/************************************************************************************/
/*      the pause sign                                                              */
/************************************************************************************/
export class PauseMessage extends UIPanel {
	constructor() {
		super(0, 210, {
			width: WIDTH,
			height: 60,
			fillColor: "rgba(0, 0, 0, 0.8)",
			borderColor: null,
		});
		this.updateWhenPaused = true;
		this.addChild(
			new BitmapText(WIDTH / 2, 10, {
				font: "atascii40",
				textAlign: "center",
				text: "P A U S E",
			}),
		);
	}
}
