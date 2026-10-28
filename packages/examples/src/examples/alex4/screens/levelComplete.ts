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
	ColorLayer,
	input,
	Sprite,
	Stage,
	state,
	Tween,
	timer,
} from "melonjs";
import { INSET, LEVELS, WIDTH } from "../constants";
import { bindPads, bindTap, NEXT_PAD, unbindPads, unbindTap } from "../gamepad";
import { gameState } from "../gameState";
import { addParallaxBackground } from "./background";

type Row = {
	label: string;
	count: number;
	bonus: number;
	step: number;
	text?: BitmapText;
};

/*---------------------------------------------------------------------

	A level complete screen: the bonus points are added to the score

  ---------------------------------------------------------------------	*/

export class LevelCompleteScreen extends Stage {
	private rows: Row[] = [];
	private score!: BitmapText;
	private prompt!: BitmapText;
	private counter = -1;
	private counting = false;
	private done = false;

	override onResetEvent(app: Application) {
		addParallaxBackground(app);
		app.world.addChild(new ColorLayer("shade", "rgba(12, 68, 0, 0.6)"), 5);

		// the title bounces down
		const title = new Sprite(0, 0, {
			image: "levelcomplete",
			anchorPoint: { x: 0, y: 0 },
		});
		title.floating = true;
		title.pos.set((app.viewport.width - title.width) / 2, -title.height);
		app.world.addChild(title, 10);
		new Tween(title.pos)
			.to({ y: 0 }, { duration: 750, easing: Tween.Easing.Bounce.Out })
			.onComplete(() => this.startCounting(2000))
			.start();

		this.rows = [
			{
				label: "LEVEL",
				count: gameState.level + 1,
				bonus: (gameState.level + 1) * 100,
				step: 100,
			},
			{
				label: "LIVES",
				count: gameState.lives,
				bonus: gameState.lives * 100,
				step: 100,
			},
			{
				label: "STARS",
				count: gameState.stars,
				bonus: gameState.stars * 100,
				step: 100,
			},
			{
				label: "CHERRIES",
				count: gameState.cherries,
				bonus: gameState.cherries * 10,
				step: 10,
			},
		];
		this.rows.forEach((row, i) => {
			const y = 200 + i * 52;
			const add = (
				x: number,
				text: string | number,
				textAlign: "left" | "right" = "right",
			) => {
				const label = new BitmapText(x, y, {
					font: "atascii32",
					text: String(text),
					textAlign,
				});
				label.floating = true;
				app.world.addChild(label, 10);
				return label;
			};
			add(INSET + 8, row.label, "left");
			add(INSET + 360, row.count);
			add(INSET + 520, `X${row.step}=`);
			row.text = add(INSET + 636, row.bonus);
		});
		this.score = new BitmapText(WIDTH / 2, 410, {
			font: "atascii32",
			textAlign: "center",
		});
		this.prompt = new BitmapText(WIDTH / 2, 446, {
			font: "atascii32",
			textAlign: "center",
		});
		for (const label of [this.score, this.prompt]) {
			label.floating = true;
			app.world.addChild(label, 10);
		}
		this.score.setText(`SCORE ${gameState.score}`);
		this.counting = false;
		this.done = false;

		input.bindKey(input.KEY.ENTER, "enter", true);
		input.bindKey(input.KEY.X, "enter", true);
		input.bindKey(input.KEY.SPACE, "enter", true);
		bindPads(NEXT_PAD);
		// a click or a tap goes on too
		bindTap(app, input.KEY.ENTER);

		audio.play("level_done");
	}

	/** add the bonus points to the score, a little at a time */
	private startCounting(delay: number) {
		if (this.counting || this.done) {
			return;
		}
		this.counting = true;
		this.counter = timer.setTimeout(() => {
			this.counter = timer.setInterval(() => this.count(), 80);
		}, delay);
	}

	private count() {
		let more = false;
		for (const row of this.rows) {
			if (row.bonus > 0) {
				row.bonus -= row.step;
				gameState.score += row.step;
				row.text?.setText(row.bonus);
				more = true;
			}
		}
		this.score.setText(`SCORE ${gameState.score}`);
		if (more) {
			audio.play("point");
		} else {
			timer.clearInterval(this.counter);
			this.counter = -1;
			this.counting = false;
			this.done = true;
			this.prompt.setText("PRESS JUMP");
		}
	}

	override update(dt: number) {
		if (input.isKeyPressed("enter")) {
			if (this.done) {
				gameState.level++;
				gameState.record();
				state.change(
					gameState.level < LEVELS.length ? state.PLAY : state.GAME_END,
				);
			} else if (!this.counting) {
				// don't wait for the title
				this.startCounting(0);
			}
		}
		return super.update(dt);
	}

	override onDestroyEvent(app: Application) {
		timer.clearInterval(this.counter);
		timer.clearTimeout(this.counter);
		this.counter = -1;
		this.counting = false;
		audio.stop("level_done");
		for (const key of ["ENTER", "X", "SPACE"] as const) {
			input.unbindKey(input.KEY[key]);
		}
		unbindPads(NEXT_PAD);
		unbindTap(app);
	}
}
