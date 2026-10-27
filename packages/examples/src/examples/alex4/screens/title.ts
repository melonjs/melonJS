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
} from "melonjs";
import { confirmPressed, justPressed, syncControls } from "../controls";
import { gameState, newGame } from "../gameState";
import { blit, drawLabel } from "../gfx";
import { addBackground } from "./background";
import { playMusic, stopMusic } from "./music";

const SCROLLER =
	"GUIDE ALEX THROUGH THE JUNGLE TO SAVE LOLA FROM THE EVIL HUMANS ... " +
	"ARROWS TO MOVE , X OR SPACE TO JUMP , Z TO SPIT EGGS ... " +
	"JUMP ON ENEMIES AND EAT THEM , PICK UP STARS AND CHERRIES ON THE WAY ... " +
	"P TO PAUSE , ESC TO QUIT ...       ";

class TitleMenu extends Renderable {
	selected = 0;
	startLevel = 0;
	private time = 0;

	constructor() {
		super(0, 0, 640, 480);
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
		this.startLevel = gameState.maxLevel;
	}

	private items() {
		return [
			"START GAME",
			`LEVEL : ${this.startLevel + 1}`,
			`SOUND : ${audio.muted() ? "OFF" : "ON"}`,
			"CREDITS",
		];
	}

	override update(dt: number) {
		this.time += dt;
		const count = this.items().length;
		if (justPressed("up") && this.selected > 0) {
			this.selected--;
			audio.play("menu");
		}
		if (justPressed("down") && this.selected < count - 1) {
			this.selected++;
			audio.play("menu");
		}
		const left = justPressed("left");
		const right = justPressed("right");
		if (this.selected === 1 && (left || right)) {
			const max = gameState.maxLevel;
			this.startLevel = left
				? (this.startLevel + max) % (max + 1)
				: (this.startLevel + 1) % (max + 1);
			audio.play("menu");
		}
		if (this.selected === 2 && (left || right)) {
			this.toggleSound();
		}
		if (confirmPressed()) {
			switch (this.selected) {
				case 0:
				case 1:
					audio.play("menu");
					newGame(this.startLevel);
					state.change(state.PLAY, false);
					break;
				case 2:
					this.toggleSound();
					break;
				case 3:
					audio.play("menu");
					state.change(state.CREDITS, false);
					break;
			}
		}
		return true;
	}

	private toggleSound() {
		if (audio.muted()) {
			audio.unmuteAll();
			audio.play("menu");
		} else {
			audio.muteAll();
		}
	}

	override draw(renderer: Renderer) {
		const title = loader.getImage("menu_title") as HTMLImageElement;
		blit(renderer, title, Math.round((640 - title.width) / 2), 40);

		const items = this.items();
		items.forEach((label, i) => {
			drawLabel(renderer, label, 150, 180 + i * 56, 40);
		});

		// the bouncing selection arrow
		const arrow = loader.getImage("menu_arrow") as HTMLImageElement;
		const dx = Math.round(Math.abs(Math.sin(this.time / 250)) * 10);
		blit(renderer, arrow, 84 + dx, 176 + this.selected * 56);

		if (gameState.hiscore > 0) {
			drawLabel(
				renderer,
				`HISCORE ${gameState.hiscore}`,
				320,
				404,
				32,
				"center",
			);
		}

		// the scrolling help text
		const width = SCROLLER.length * 32;
		const x = 640 - ((this.time * 0.15) % (width + 640));
		drawLabel(renderer, SCROLLER, Math.round(x), 444);
	}
}

export class TitleScreen extends Stage {
	override onResetEvent(app: Application) {
		syncControls();
		addBackground(app);
		app.world.addChild(new TitleMenu(), 10);
		playMusic("menu");
	}

	override onDestroyEvent() {
		stopMusic();
	}
}
