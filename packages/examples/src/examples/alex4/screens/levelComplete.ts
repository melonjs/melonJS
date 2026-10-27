/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	audio,
	loader,
	Renderable,
	type Renderer,
	Stage,
	state,
	Tween,
} from "melonjs";
import { LEVELS } from "../constants";
import { confirmPressed, syncControls } from "../controls";
import { gameState, saveProgress } from "../gameState";
import { blit, drawLabel } from "../gfx";
import { addBackground } from "./background";

/**
 * The level complete screen: the bonus points count up into the score,
 * as in the original `show_cutscene`
 */
class Tally extends Renderable {
	titleY: number;
	ready = false;
	counting = false;
	done = false;
	/** level number (1 based) */
	levelNumber: number;
	bonus: { level: number; lives: number; stars: number; cherries: number };
	private ticks = 0;
	private waited = 0;

	constructor() {
		super(0, 0, 640, 480);
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
		this.levelNumber = gameState.level + 1;
		this.bonus = {
			level: this.levelNumber * 100,
			lives: gameState.lives * 100,
			stars: gameState.stars * 100,
			cherries: gameState.cherries * 10,
		};
		const title = loader.getImage("levelcomplete") as HTMLImageElement;
		this.titleY = -title.height;
		new Tween(this)
			.to({ titleY: 0 }, { duration: 750, easing: Tween.Easing.Bounce.Out })
			.onComplete(() => {
				this.ready = true;
			})
			.start();
	}

	override update(dt: number) {
		if (!this.ready) return true;
		const pressed = confirmPressed();
		if (!this.counting && !this.done) {
			this.waited += dt;
			if (pressed || this.waited > 4000) {
				this.counting = true;
			}
		} else if (this.counting) {
			// one step every 4 ticks of 20 ms
			this.ticks += dt;
			while (this.ticks >= 80 && this.counting) {
				this.ticks -= 80;
				this.step();
			}
		} else if (pressed) {
			this.next();
		}
		return true;
	}

	private step() {
		const b = this.bonus;
		let any = false;
		if (b.level) {
			gameState.score += 100;
			b.level -= 100;
			any = true;
		}
		if (b.lives) {
			gameState.score += 100;
			b.lives -= 100;
			any = true;
		}
		if (b.stars) {
			gameState.score += 100;
			b.stars -= 100;
			any = true;
		}
		if (b.cherries) {
			gameState.score += 10;
			b.cherries -= 10;
			any = true;
		}
		if (any) {
			audio.play("point");
		} else {
			this.counting = false;
			this.done = true;
		}
	}

	private next() {
		gameState.level++;
		saveProgress();
		if (gameState.level >= LEVELS.length) {
			state.change(state.GAME_END, false);
		} else {
			state.change(state.PLAY, false);
		}
	}

	override draw(renderer: Renderer) {
		renderer.setGlobalAlpha(0.6);
		renderer.setColor("#0c4400");
		renderer.fillRect(0, 0, 640, 480);
		renderer.setGlobalAlpha(1);

		const title = loader.getImage("levelcomplete") as HTMLImageElement;
		blit(
			renderer,
			title,
			Math.round((640 - title.width) / 2),
			Math.round(this.titleY),
		);

		const rows: [string, number, string, number][] = [
			["LEVEL", this.levelNumber, "X100=", this.bonus.level],
			["LIVES", gameState.lives, "X100=", this.bonus.lives],
			["STARS", gameState.stars, "X100=", this.bonus.stars],
			["CHERRIES", gameState.cherries, "X10=", this.bonus.cherries],
		];
		rows.forEach(([label, count, mult, value], i) => {
			const y = 190 + i * 52;
			drawLabel(renderer, label, 8, y);
			drawLabel(renderer, count, 360, y, 32, "right");
			drawLabel(renderer, mult, 520, y, 32, "right");
			drawLabel(renderer, value, 636, y, 32, "right");
		});
		drawLabel(renderer, `SCORE ${gameState.score}`, 320, 398, 32, "center");
		if (this.done) {
			drawLabel(renderer, "PRESS JUMP", 320, 440, 32, "center");
		}
	}
}

export class LevelCompleteScreen extends Stage {
	override onResetEvent(app: Application) {
		syncControls();
		addBackground(app);
		app.world.addChild(new Tally(), 10);
		audio.play("level_done");
	}

	override onDestroyEvent() {
		audio.stop("level_done");
	}
}
