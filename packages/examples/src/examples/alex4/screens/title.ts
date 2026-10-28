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
	Sprite,
	Stage,
	state,
	Tween,
} from "melonjs";
import { ALL_LEVELS_UNLOCKED, INSET, LEVELS, WIDTH } from "../constants";
import { gameState } from "../gameState";
import { shaders } from "../shaders";
import { addParallaxBackground } from "./background";

const SCROLLER =
	"GUIDE ALEX THROUGH THE JUNGLE TO SAVE LOLA FROM THE EVIL HUMANS , " +
	"USING ARROWS TO MOVE , X TO JUMP AND Z TO SPIT EGGS . " +
	"JUMP ON ENEMIES TO EAT THEM , AND PICK UP STARS AND CHERRIES ON THE WAY     ";

/*---------------------------------------------------------------------

	A title screen

  ---------------------------------------------------------------------	*/

export class TitleScreen extends Stage {
	private items: BitmapText[] = [];
	private arrow!: Sprite;
	private selectedItem = 0;
	private startLevel = 0;

	override onResetEvent(app: Application) {
		addParallaxBackground(app);

		// title screen image
		const title = new Sprite(0, 60, {
			image: "menu_title",
			anchorPoint: { x: 0, y: 0 },
		});
		title.pos.x = (app.viewport.width - title.width) / 2;
		title.floating = true;
		title.addPostEffect(shaders.shine);
		app.world.addChild(title, 10);

		// the menu items
		this.items = [];
		for (let i = 0; i < 4; i++) {
			const item = new BitmapText(INSET + 140, 205 + i * 50, {
				font: "atascii40",
			});
			item.floating = true;
			item.addPostEffect(shaders.shadow);
			this.items.push(item);
			app.world.addChild(item, 10);
		}
		this.startLevel = Math.min(gameState.saved.maxLevel, LEVELS.length - 1);
		this.updateMenu();

		// the selection arrow, moving back and forth
		this.arrow = new Sprite(INSET + 80, 0, {
			image: "menu_arrow",
			anchorPoint: { x: 0, y: 0 },
		});
		this.arrow.floating = true;
		app.world.addChild(this.arrow, 10);
		this.selectedItem = 0;
		this.arrow.pos.y = this.items[0].pos.y - 4;
		new Tween(this.arrow.pos)
			.to({ x: INSET + 90 }, { duration: 400, yoyo: true, repeat: Infinity })
			.start();

		// best score, and the scrolling help text
		if (gameState.saved.hiscore > 0) {
			const hiscore = new BitmapText(WIDTH / 2, 405, {
				font: "atascii32",
				textAlign: "center",
				text: `HI SCORE ${gameState.saved.hiscore}`,
			});
			hiscore.floating = true;
			hiscore.addPostEffect(shaders.shadow);
			app.world.addChild(hiscore, 10);
		}
		const scroller = new BitmapText(WIDTH, 444, {
			font: "atascii32",
			text: SCROLLER,
		});
		scroller.floating = true;
		scroller.addPostEffect(shaders.shadow);
		app.world.addChild(scroller, 10);
		const width = scroller.measureText().width;
		new Tween(scroller.pos)
			.to({ x: -width }, { duration: width * 8, repeat: Infinity })
			.start();

		// enable the keyboard
		input.bindKey(input.KEY.UP, "up", true);
		input.bindKey(input.KEY.DOWN, "down", true);
		input.bindKey(input.KEY.LEFT, "left", true);
		input.bindKey(input.KEY.RIGHT, "right", true);
		input.bindKey(input.KEY.ENTER, "enter", true);
		input.bindKey(input.KEY.X, "enter", true);
		input.bindKey(input.KEY.SPACE, "enter", true);

		// play menu song
		audio.playTrack("menu_song");
	}

	private updateMenu() {
		this.items[0].setText("START GAME");
		this.items[1].setText(`LEVEL : ${this.startLevel + 1}`);
		this.items[2].setText(`SOUND : ${audio.muted() ? "OFF" : "ON"}`);
		this.items[3].setText("CREDITS");
	}

	private selectItem(index: number) {
		if (index < 0 || index >= this.items.length) {
			return;
		}
		this.selectedItem = index;
		this.arrow.pos.y = this.items[index].pos.y - 4;
		audio.play("menu");
	}

	override update(dt: number) {
		if (input.isKeyPressed("up")) {
			this.selectItem(this.selectedItem - 1);
		}
		if (input.isKeyPressed("down")) {
			this.selectItem(this.selectedItem + 1);
		}

		// change the starting level, among the ones already reached
		const step = input.isKeyPressed("left")
			? -1
			: input.isKeyPressed("right")
				? 1
				: 0;
		if (step !== 0 && this.selectedItem === 1) {
			const count = ALL_LEVELS_UNLOCKED
				? LEVELS.length
				: Math.min(gameState.saved.maxLevel, LEVELS.length - 1) + 1;
			this.startLevel = (this.startLevel + step + count) % count;
			this.updateMenu();
			audio.play("menu");
		}

		if (input.isKeyPressed("enter")) {
			audio.play("menu");
			switch (this.selectedItem) {
				case 0:
				case 1:
					gameState.reset(this.startLevel);
					state.change(state.PLAY);
					break;
				case 2:
					if (audio.muted()) {
						audio.unmuteAll();
					} else {
						audio.muteAll();
					}
					this.updateMenu();
					break;
				case 3:
					state.change(state.CREDITS);
					break;
			}
		}
		return super.update(dt);
	}

	override onDestroyEvent() {
		for (const key of [
			"UP",
			"DOWN",
			"LEFT",
			"RIGHT",
			"ENTER",
			"X",
			"SPACE",
		] as const) {
			input.unbindKey(input.KEY[key]);
		}
	}
}
