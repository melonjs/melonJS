/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { audio, BitmapText, input, type Sprite, state } from "melonjs";
import { PALETTE, WIDTH } from "../constants";
import { gameState } from "../gameState";
import { Cutscene, SCREEN_W } from "./cutscene";

// Alex rolled up in a ball, turning to the left
const BALL = ["alex_ball0", "alex_ball3", "alex_ball2", "alex_ball1"];

/*---------------------------------------------------------------------

	The end: Alex finds Lola... but the story is not over.
	Same scenes and timing as the original outro script.

  ---------------------------------------------------------------------	*/

export class OutroScreen extends Cutscene {
	private finished = false;

	constructor() {
		super("a4_outro", "outro_song");
	}

	protected play() {
		this.finished = false;
		this.reunion();
	}

	/** Alex finds Lola, until the UFO comes */
	private reunion() {
		const alex = this.actor("alex", 48, 64, "right");
		let lola = this.actor("lola", 144, 32);
		const can1 = this.actor("drumcan", 112, 16);
		const can2 = this.actor("drumcan", 112, 32);
		const dome = this.actor("ufo1", 39, -14, "right", 9);
		const beam = this.actor("ufobeam", 40, -120, "right", 11);
		const ufo = this.actor("ufo0", 11, -30, "right", 12);
		let ball: Sprite;
		let ship: Sprite;

		this.at(200, () =>
			this.speak(60, 60, "left", ["Lola! Are", "you ok?"], 2000),
		);

		// Lola rolls down, sending the drum cans flying
		this.at(2200, () => {
			this.remove(lola);
			// the ball is in the middle of a bigger picture
			ball = this.animated(BALL, 160, 128, 24);
			this.move(ball, -2, 0, 26).start();
		});
		this.at(2400, () => {
			this.sound("crush");
			this.move(can1, -2, -1, 32).start();
			this.move(can2, -1, -2, 32).start();
		});
		this.at(2720, () => {
			this.remove(ball);
			lola = this.actor("lola", 94, 32);
			this.move(lola, -1, 2, 16).start();
		});

		this.at(3040, () =>
			this.speak(
				80,
				50,
				"right",
				["I'm fine. You came", "just in time!"],
				2000,
			),
		);
		this.at(5040, () =>
			this.speak(60, 60, "left", ["I'm so happy", "to see you!"], 2000),
		);
		this.at(7040, () =>
			this.speak(80, 50, "right", ["Thank you for", "saving me."], 2000),
		);
		this.at(9040, () => {
			this.loop("engine", 0.5);
			this.speak(60, 60, "left", ["Wait, what's", "that sound?"], 2000);
		});

		// the UFO comes down, and beams Alex up
		this.at(11040, () => {
			this.loop("engine", 1);
			for (const part of [ufo, dome, beam]) {
				this.move(part, 0, 1, 30).start();
			}
		});
		this.at(12640, () => {
			this.loop("energy", 1);
			this.move(beam, 0, 1, 90).start();
		});
		this.at(14440, () => this.speak(80, 50, "right", ["Alex!"], 1000));
		this.at(15440, () => this.speak(60, 60, "left", ["Lola!"], 1000));
		this.at(16440, () => {
			this.move(beam, 0, -1, 130).start();
			this.move(alex, 0, -1, 130).start();
		});
		this.at(18440, () => {
			this.loop("energy", 0);
			this.loop("engine", 0.5);
			this.move(ufo, 0, -1, 30).start();
			this.move(dome, 0, -1, 30).start();
		});
		this.at(19040, () => {
			this.loop("engine", 0);
			this.speak(80, 50, "right", ["I'll save you!"], 1000);
		});

		// Lola takes the ship, and goes after them: it comes in from the right
		// edge of our wider screen, in the same time
		this.at(20040, () => {
			this.sound("ship");
			ship = this.actor("ship0", SCREEN_W, 64);
			this.move(ship, -(SCREEN_W - 74) / 43, 0, 43).start();
		});
		this.at(20900, () => this.speak(80, 50, "right", ["Yay!"], 500));
		this.at(21400, () => {
			this.remove(lola);
			this.remove(ship);
			ship = this.actor("ship1", 74, 64);
		});
		this.at(22400, () => {
			this.sound("ship");
			this.move(ship, -1, 0, 16)
				.chain(
					this.move(ship, -2, -1, 8).chain(
						this.move(ship, -2, -2, 8).chain(this.move(ship, -2, -3, 50)),
					),
				)
				.start();
		});
		this.cut(24040, () => this.chase());
	}

	/** over the treetops, the UFO flies away, with Lola in pursuit */
	private chase() {
		this.treetops();
		this.loop("engine", 1);
		const ufo = this.actor("ufo_big", -32, 120);
		this.at(300, () => this.move(ufo, 1, -1, 150).start());

		this.at(3300, () => {
			// the ship sound, lower
			audio.rate("ship", 0.6, this.sound("ship"));
			const ship = this.actor("ship1", -32, 80, "right");
			this.move(ship, 2, -1, 100).start();
		});
		this.at(5300, () => {
			this.loop("engine", 0);
			this.speak(SCREEN_W / 2, 60, "none", [" The end  "], 1000);
		});
		this.at(6300, () =>
			this.speak(SCREEN_W / 2, 60, "none", [" The end? "], 1000),
		);
		this.cut(6800, () => this.theEnd());
	}

	/** the score, and on to the credits */
	private theEnd() {
		this.finished = true;
		gameState.record();
		this.fill(PALETTE[3]);
		for (const [text, y, font] of [
			["THE END ?", 150, "atascii40"],
			[`SCORE ${gameState.score}`, 220, "atascii32"],
			["PRESS JUMP", 290, "atascii32"],
		] as const) {
			this.add(
				new BitmapText(WIDTH / 2, y, {
					font,
					text,
					textAlign: "center",
					fillStyle: PALETTE[0],
				}),
				30,
			);
		}
	}

	override update(dt: number) {
		const next = input.isKeyPressed("start") || input.isKeyPressed("jump");
		if (input.isKeyPressed("skip") || (this.finished && next)) {
			state.change(state.CREDITS);
		}
		return super.update(dt);
	}
}
