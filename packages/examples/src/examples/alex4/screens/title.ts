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
	UIBaseElement,
} from "melonjs";
import { ALL_LEVELS_UNLOCKED, INSET, LEVELS, WIDTH } from "../constants";
import { bindPads, MENU_PAD, unbindPads } from "../gamepad";
import { gameState } from "../gameState";
import { shaders } from "../shaders";
import { go } from "../transition";
import { addParallaxBackground } from "./background";

const SCROLLER =
	"FREE LUNCH DESIGN PRESENTS ALEX THE ALLEGATOR 4     " +
	"GUIDE ALEX THROUGH THE JUNGLE TO SAVE LOLA FROM THE EVIL HUMANS     " +
	"ARROWS TO MOVE , X OR SPACE TO JUMP , Z OR C TO SPIT EGGS , P TO PAUSE , " +
	"OR USE A GAMEPAD     " +
	"JUMP ON ENEMIES TO EAT THEM , AND PICK UP STARS AND CHERRIES ON THE WAY     " +
	"CODE AND GFX BY JOHAN PEITZ , MUSIC AND SFX BY ANDERS SVENSSON     ";

/**
 * a line of the menu, that the mouse (or a finger) can point at and pick
 */
class MenuItem extends UIBaseElement {
	label: BitmapText;
	private point: () => void;
	private pick: () => void;

	constructor(x: number, y: number, point: () => void, pick: () => void) {
		// as wide as the longest line
		super(x, y, 480, 44);
		this.point = point;
		this.pick = pick;
		this.label = new BitmapText(0, 0, { font: "atascii40" });
		this.label.addPostEffect(shaders.shadow);
		this.addChild(this.label);
	}

	override onOver() {
		this.point();
	}

	override onClick() {
		this.pick();
		// handled: nothing under it gets the click
		return false;
	}
}

/*---------------------------------------------------------------------

	A title screen

  ---------------------------------------------------------------------	*/

export class TitleScreen extends Stage {
	private items: MenuItem[] = [];
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
			const item = new MenuItem(
				INSET + 140,
				205 + i * 50,
				() => this.selectItem(i),
				() => {
					this.selectItem(i);
					// a click on the level picks the next one
					this.activate(i === 1 ? 1 : 0);
				},
			);
			this.items.push(item);
			app.world.addChild(item, 10);
		}
		this.startLevel = Math.min(
			gameState.saved.alex4MaxLevel,
			LEVELS.length - 1,
		);
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
		if (gameState.saved.alex4HiScore > 0) {
			const hiscore = new BitmapText(WIDTH / 2, 405, {
				font: "atascii32",
				textAlign: "center",
				text: `HI SCORE ${gameState.saved.alex4HiScore}`,
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
		// and the gamepads
		bindPads(MENU_PAD);

		// the menu song, on from the title or the credits, where it already plays
		if (audio.getCurrentTrack() !== "menu_song") {
			audio.playTrack("menu_song");
		}
	}

	private updateMenu() {
		this.items[0].label.setText("START GAME");
		this.items[1].label.setText(`LEVEL : ${this.startLevel + 1}`);
		this.items[2].label.setText(`SOUND : ${audio.muted() ? "OFF" : "ON"}`);
		this.items[3].label.setText("CREDITS");
	}

	private selectItem(index: number) {
		if (index < 0 || index >= this.items.length) {
			return;
		}
		if (index === this.selectedItem) {
			return;
		}
		this.selectedItem = index;
		this.arrow.pos.y = this.items[index].pos.y - 4;
		audio.play("menu");
	}

	/**
	 * act on the selected item: pick it (0), or change its value (-1, 1)
	 */
	private activate(step: number) {
		if (step !== 0) {
			if (this.selectedItem !== 1) {
				return;
			}
			const count = ALL_LEVELS_UNLOCKED
				? LEVELS.length
				: Math.min(gameState.saved.alex4MaxLevel, LEVELS.length - 1) + 1;
			this.startLevel = (this.startLevel + step + count) % count;
			this.updateMenu();
			audio.play("menu");
			return;
		}
		audio.play("menu");
		switch (this.selectedItem) {
			case 0:
			case 1:
				gameState.reset(this.startLevel);
				go(state.PLAY);
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
				go(state.CREDITS);
				break;
		}
	}

	override update(dt: number) {
		if (input.isKeyPressed("up")) {
			this.selectItem(this.selectedItem - 1);
		}
		if (input.isKeyPressed("down")) {
			this.selectItem(this.selectedItem + 1);
		}

		// change the starting level (among the ones reached), or pick
		if (input.isKeyPressed("left")) {
			this.activate(-1);
		} else if (input.isKeyPressed("right")) {
			this.activate(1);
		} else if (input.isKeyPressed("enter")) {
			this.activate(0);
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
		unbindPads(MENU_PAD);
	}
}
