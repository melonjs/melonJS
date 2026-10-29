/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { BitmapText, Container, Sprite, Tween, UIPanel } from "melonjs";
import { HEIGHT, PALETTE, WIDTH } from "../constants";
import { gameState } from "../gameState";
import { shaders } from "../shaders";
import { wave } from "./effects";

/** the status bar is cut in four equal columns, one item centered in each */
const COLUMN = WIDTH / 4;
/** one digit of the atascii40 font */
const DIGIT = 40;

/** the x to center an item `width` wide in the given column */
const column = (index: number, width: number) =>
	Math.round(COLUMN * index + (COLUMN - width) / 2);

/************************************************************************************/
/*      a HUD item: an icon and a number                                            */
/************************************************************************************/
class HUDCounter extends Container {
	label: BitmapText;
	value = -1;

	constructor(
		index: number,
		icon: string,
		private read: () => number,
	) {
		super(0, 0, 140, 40);
		const sprite = new Sprite(0, 2, {
			image: icon,
			anchorPoint: { x: 0, y: 0 },
		});
		// centered as the icon and a single digit: more digits grow rightward
		this.pos.x = column(index, sprite.width + DIGIT);
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

	constructor(index: number) {
		super(0, 0, 80, 40);
		for (let i = 0; i < 2; i++) {
			const heart = new Sprite(i * 34, 3, {
				image: "hud_heart",
				anchorPoint: { x: 0, y: 0 },
			});
			this.hearts.push(heart);
			this.addChild(heart);
		}
		this.pos.x = column(index, 34 + this.hearts[0].width);
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
	private shown = -1;

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
		// lives, hearts, eggs and score, spread evenly over the bar
		this.addChild(new HUDCounter(0, "hud_life", () => gameState.lives));
		this.addChild(new HUDEnergy(1));
		this.addChild(new HUDCounter(2, "hud_egg", () => gameState.eggs));
		this.score = new BitmapText(COLUMN * 3.5, -2, {
			font: "atascii40",
			textAlign: "center",
		});
		this.addChild(this.score);
	}

	override update(dt: number) {
		// only when it changes: setText measures the text again on every call
		if (this.shown !== gameState.score) {
			this.shown = gameState.score;
			this.score.setText(this.shown);
		}
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
		// the same shadow as the menus, to read it over the level
		title.addPostEffect(shaders.shadow);
		title.glyphEffect = wave;
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
export class PauseMessage extends Container {
	/** @param hint - what brings the game back, on the line under the title */
	constructor(hint: string) {
		super(0, 0, WIDTH, HEIGHT);
		this.floating = true;
		// it waves while everything else holds still
		this.updateWhenPaused = true;

		// the jungle, dimmed in its own darkest green
		this.addChild(
			new UIPanel(0, 0, {
				width: WIDTH,
				height: HEIGHT,
				fillColor: "rgba(12, 68, 0, 0.55)",
				borderColor: null,
			}),
		);

		// a sign in the colors of the speech bubbles of the cut scenes
		const width = 480;
		const height = 136;
		const sign = new UIPanel((WIDTH - width) / 2, (HEIGHT - height) / 2 - 20, {
			width,
			height,
			fillColor: PALETTE[3],
			borderColor: PALETTE[0],
			borderWidth: 4,
			radius: 8,
		});
		const title = new BitmapText(width / 2, 24, {
			font: "atascii40",
			textAlign: "center",
			fillStyle: PALETTE[0],
			text: "P A U S E",
		});
		title.glyphEffect = wave;
		sign.addChild(title);
		sign.addChild(
			new BitmapText(width / 2, 84, {
				font: "atascii32",
				textAlign: "center",
				fillStyle: PALETTE[1],
				text: hint,
			}),
		);
		this.addChild(sign);
	}
}
