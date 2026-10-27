/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	audio,
	BitmapText,
	input,
	level,
	Sprite,
	Stage,
	state,
	Tween,
	timer,
	UIPanel,
} from "melonjs";
import { PALETTE, WIDTH } from "../constants";
import { gameState } from "../gameState";

// the original script moved things one step every 20ms, at 1/4 of our scale
const STEP = 20;

/*---------------------------------------------------------------------

	The end: Alex finds Lola... but the story is not over.
	Same timing as the original outro script.

  ---------------------------------------------------------------------	*/

export class OutroScreen extends Stage {
	private app!: Application;
	private timers: number[] = [];
	private finished = false;

	override onResetEvent(app: Application) {
		this.app = app;
		this.finished = false;

		input.bindKey(input.KEY.ENTER, "enter", true);
		input.bindKey(input.KEY.X, "enter", true);
		input.bindKey(input.KEY.SPACE, "enter", true);
		input.bindKey(input.KEY.ESC, "skip", true);

		level.load("a4_outro", {
			container: app.world,
			onLoaded: () => {
				audio.playTrack("level_song");
				this.play();
			},
		});
	}

	/** run something at the given time of the story */
	private at(ms: number, fn: () => void) {
		this.timers.push(timer.setTimeout(fn, ms));
	}

	/** a sprite from the atlas, placed by its top left corner */
	private actor(region: string, x: number, y: number, facingRight = false) {
		const sprite = new Sprite(x, y, {
			image: gameState.atlas,
			region,
			anchorPoint: { x: 0, y: 0 },
		});
		sprite.flipX(facingRight);
		this.app.world.addChild(sprite, 10);
		return sprite;
	}

	/** move a sprite by (dx, dy) during some steps of the original script */
	private move(sprite: Sprite, dx: number, dy: number, steps: number) {
		// relative values: "+8", "-8"
		const by = (d: number) =>
			d < 0 ? `${d * steps * 4}` : `+${d * steps * 4}`;
		return new Tween(sprite.pos).to(
			{ x: by(dx), y: by(dy) },
			{ duration: steps * STEP },
		);
	}

	/** a speech bubble above someone's head */
	private say(who: Sprite, lines: string[], ms: number) {
		const width = Math.max(...lines.map((line) => line.length)) * 16 + 24;
		const height = lines.length * 16 + 20;
		const x = Math.max(
			4,
			Math.min(who.pos.x + 32 - width / 2, WIDTH - 4 - width),
		);
		const bubble = new UIPanel(x, who.pos.y - height - 16, {
			width,
			height,
			fillColor: PALETTE[3],
			borderColor: PALETTE[0],
			borderWidth: 4,
			radius: 8,
		});
		lines.forEach((line, i) => {
			bubble.addChild(
				new BitmapText(12, 10 + i * 16, {
					font: "atascii32",
					size: 0.5,
					fillStyle: PALETTE[0],
					text: line.toUpperCase(),
				}),
			);
		});
		this.app.world.addChild(bubble, 20);
		this.at(ms, () => this.app.world.removeChild(bubble));
	}

	private play() {
		const world = this.app.world;
		const alex = this.actor("alex", 192, 256, true);
		let lola = this.actor("lola", 576, 128);
		const can1 = this.actor("drumcan", 448, 64);
		const can2 = this.actor("drumcan", 448, 128);
		const beam = this.actor("ufobeam", 160, -480, true);
		const ufo = this.actor("ufo0", 44, -120, true);
		const dome = this.actor("ufo1", 156, -56, true);
		let ball: Sprite;
		let ship: Sprite;
		let engine = 0;
		let energy = 0;

		this.at(200, () => this.say(alex, ["Lola! Are", "you ok?"], 2000));

		// Lola rolls down, sending the drum cans flying
		this.at(2200, () => {
			world.removeChild(lola);
			ball = this.actor("alex_ball0", 512, 96);
			this.move(ball, -2, 0, 26).start();
		});
		this.at(2400, () => {
			audio.play("crush");
			this.move(can1, -2, -1, 32).start();
			this.move(can2, -1, -2, 32).start();
		});
		this.at(2720, () => {
			world.removeChild(ball);
			lola = this.actor("lola", 376, 128);
			this.move(lola, -1, 2, 16).start();
		});

		this.at(3040, () =>
			this.say(lola, ["I'm fine. You came", "just in time!"], 2000),
		);
		this.at(5040, () => this.say(alex, ["I'm so happy", "to see you!"], 2000));
		this.at(7040, () => this.say(lola, ["Thank you for", "saving me."], 2000));
		this.at(9040, () => {
			engine = audio.play("engine", true);
			this.say(alex, ["Wait, what's", "that sound?"], 2000);
		});

		// the UFO comes down, and beams Alex up
		this.at(11040, () => {
			for (const part of [ufo, dome, beam]) {
				this.move(part, 0, 1, 30).start();
			}
		});
		this.at(12640, () => {
			energy = audio.play("energy", true);
			this.move(beam, 0, 1, 90).start();
		});
		this.at(14440, () => this.say(lola, ["Alex!"], 1000));
		this.at(15440, () => this.say(alex, ["Lola!"], 1000));
		this.at(16440, () => {
			this.move(beam, 0, -1, 130).start();
			this.move(alex, 0, -1, 130).start();
		});
		this.at(18440, () => {
			this.move(ufo, 0, -1, 30).start();
			this.move(dome, 0, -1, 30).start();
		});
		this.at(19040, () => {
			audio.stop("energy", energy);
			audio.stop("engine", engine);
			this.say(lola, ["I'll save you!"], 1000);
		});

		// Lola takes the ship, and goes after them
		this.at(20040, () => {
			audio.play("ship");
			ship = this.actor("ship0", WIDTH, 256);
			this.move(ship, -2, 0, 43).start();
		});
		this.at(20900, () => this.say(lola, ["Yay!"], 500));
		this.at(21400, () => {
			world.removeChild(ship);
			world.removeChild(lola);
			ship = this.actor("ship1", 296, 256);
		});
		this.at(22400, () => {
			audio.play("ship");
			this.move(ship, -1, 0, 16)
				.chain(
					this.move(ship, -2, -1, 8).chain(
						this.move(ship, -2, -2, 8).chain(this.move(ship, -2, -3, 50)),
					),
				)
				.start();
		});

		this.at(24400, () => {
			this.finished = true;
			gameState.record();
			for (const [text, y, font] of [
				["THE END ?", 150, "atascii40"],
				[`SCORE ${gameState.score}`, 220, "atascii32"],
				["PRESS JUMP", 290, "atascii32"],
			] as const) {
				world.addChild(
					new BitmapText(WIDTH / 2, y, {
						font,
						text,
						textAlign: "center",
						fillStyle: PALETTE[0],
					}),
					30,
				);
			}
		});
	}

	override update(dt: number) {
		if (
			input.isKeyPressed("skip") ||
			(this.finished && input.isKeyPressed("enter"))
		) {
			state.change(state.CREDITS);
		}
		return super.update(dt);
	}

	override onDestroyEvent() {
		for (const id of this.timers) {
			timer.clearTimeout(id);
		}
		this.timers = [];
		audio.stopTrack();
		audio.stop("engine");
		audio.stop("energy");
		for (const key of ["ENTER", "X", "SPACE", "ESC"] as const) {
			input.unbindKey(input.KEY[key]);
		}
	}
}
