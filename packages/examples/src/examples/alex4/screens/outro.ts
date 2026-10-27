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
import { PALETTE } from "../constants";
import { gameState } from "../gameState";

/*---------------------------------------------------------------------

	The end: Alex finds Lola... but the story is not over.
	Same choreography as the original outro script.

  ---------------------------------------------------------------------	*/

export class OutroScreen extends Stage {
	private app!: Application;
	private playing = false;
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
				this.playing = true;
				this.play();
			},
		});
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

	private remove(...sprites: Sprite[]) {
		for (const sprite of sprites) {
			this.app.world.removeChild(sprite);
		}
	}

	// both stop for good once we left the screen, which ends the story there
	private wait(ms: number) {
		return new Promise<void>((resolve) =>
			timer.setTimeout(() => this.playing && resolve(), ms),
		);
	}

	/** move by (dx, dy), at the original script speed of one step every 20ms */
	private move(sprite: Sprite, dx: number, dy: number, steps: number) {
		return new Promise<void>((resolve) => {
			new Tween(sprite.pos)
				.to(
					{
						x: sprite.pos.x + dx * steps * 4,
						y: sprite.pos.y + dy * steps * 4,
					},
					{ duration: steps * 20 },
				)
				.onComplete(() => this.playing && resolve())
				.start();
		});
	}

	/** a speech bubble above someone's head */
	private async say(who: Sprite, lines: string[], ms: number) {
		const width = Math.max(...lines.map((line) => line.length)) * 16 + 24;
		const height = lines.length * 16 + 20;
		const x = Math.max(4, Math.min(who.pos.x + 32 - width / 2, 636 - width));
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
		await this.wait(ms);
		this.app.world.removeChild(bubble);
	}

	private async play() {
		const alex = this.actor("alex", 192, 256, true);
		let lola = this.actor("lola", 576, 128);
		const can1 = this.actor("drumcan", 448, 64);
		const can2 = this.actor("drumcan", 448, 128);
		const beam = this.actor("ufobeam", 160, -480, true);
		const ufo = this.actor("ufo0", 44, -120, true);
		const dome = this.actor("ufo1", 156, -56, true);

		await this.wait(200);
		await this.say(alex, ["Lola! Are", "you ok?"], 2000);

		// Lola rolls down, sending the drum cans flying
		this.remove(lola);
		const ball = this.actor("alex_ball0", 576 - 64, 128 - 32);
		await this.move(ball, -2, 0, 10);
		audio.play("crush");
		await Promise.all([
			this.move(ball, -2, 0, 16),
			this.move(can1, -2, -1, 32),
			this.move(can2, -1, -2, 32),
		]);
		this.remove(ball);
		lola = this.actor("lola", 376, 128);
		await this.move(lola, -1, 2, 16);

		await this.say(lola, ["I'm fine. You came", "just in time!"], 2000);
		await this.say(alex, ["I'm so happy", "to see you!"], 2000);
		await this.say(lola, ["Thank you for", "saving me."], 2000);
		const engine = audio.play("engine", true);
		await this.say(alex, ["Wait, what's", "that sound?"], 2000);

		// the UFO comes down, and beams Alex up
		await Promise.all([
			this.move(ufo, 0, 1, 30),
			this.move(dome, 0, 1, 30),
			this.move(beam, 0, 1, 30),
		]);
		await this.wait(1000);
		const energy = audio.play("energy", true);
		await this.move(beam, 0, 1, 90);
		await this.say(lola, ["Alex!"], 1000);
		await this.say(alex, ["Lola!"], 1000);
		await Promise.all([
			this.move(beam, 0, -1, 130),
			this.move(alex, 0, -1, 130),
			this.wait(2000).then(() =>
				Promise.all([this.move(ufo, 0, -1, 30), this.move(dome, 0, -1, 30)]),
			),
		]);
		audio.stop("energy", energy);
		audio.stop("engine", engine);
		await this.say(lola, ["I'll save you!"], 1000);

		// Lola takes the ship, and goes after them
		audio.play("ship");
		const ship = this.actor("ship0", 640, 256);
		await this.move(ship, -2, 0, 43);
		await this.say(lola, ["Yay!"], 500);
		this.remove(ship, lola);
		const ship1 = this.actor("ship1", 296, 256);
		await this.wait(1000);
		audio.play("ship");
		await this.move(ship1, -1, 0, 16);
		await this.move(ship1, -2, -1, 8);
		await this.move(ship1, -2, -2, 8);
		await this.move(ship1, -2, -3, 50);

		if (this.playing) {
			this.finished = true;
			gameState.record();
			for (const [text, y, font] of [
				["THE END ?", 150, "atascii40"],
				[`SCORE ${gameState.score}`, 220, "atascii32"],
				["PRESS JUMP", 290, "atascii32"],
			] as const) {
				const label = new BitmapText(320, y, {
					font,
					text,
					textAlign: "center",
					fillStyle: PALETTE[0],
				});
				this.app.world.addChild(label, 30);
			}
		}
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
		this.playing = false;
		audio.stopTrack();
		audio.stop("engine");
		audio.stop("energy");
		for (const key of ["ENTER", "X", "SPACE", "ESC"] as const) {
			input.unbindKey(input.KEY[key]);
		}
	}
}
