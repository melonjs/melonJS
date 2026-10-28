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
	Container,
	input,
	Sprite,
	Stage,
	state,
	Tween,
} from "melonjs";
import { WIDTH } from "../constants";
import { bindPads, NEXT_PAD, unbindPads } from "../gamepad";
import { shaders } from "../shaders";
import { go } from "../transition";
import { addParallaxBackground } from "./background";

/** a heading, a name, or a blank line */
type Line = [text: string, kind: "head" | "name" | "gap"];

/** who made the game, rolling up under the title */
const ROLL: Line[] = [
	[">ORIGINAL GAME<", "head"],
	["FREE LUNCH DESIGN", "name"],
	["2003", "name"],
	["", "gap"],
	["DESIGN CODE GFX", "head"],
	["JOHAN PEITZ", "name"],
	["", "gap"],
	["MUSIC SFX", "head"],
	["ANDERS SVENSSON", "name"],
	["", "gap"],
	[">WEB EDITION<", "head"],
	["OLIVIER BIOT", "name"],
	["2012 - 2026", "name"],
	["", "gap"],
	[">GAME ENGINE<", "head"],
	["MELONJS", "name"],
	["MELONJS.ORG", "name"],
	["", "gap"],
	["FREE SOFTWARE", "name"],
	["UNDER THE GNU GPL", "name"],
	["", "gap"],
	["THANKS FOR PLAYING!", "head"],
];

/** where the roll shows, under the title */
const TOP = 150;
const BOTTOM = 470;
/** how far apart the lines are, and how fast they roll (px per second) */
const LINE = 40;
const SPEED = 45;

/*---------------------------------------------------------------------

	A credit screen

  ---------------------------------------------------------------------	*/

export class CreditsScreen extends Stage {
	override onResetEvent(app: Application) {
		addParallaxBackground(app);

		const title = new Sprite(0, 30, {
			image: "menu_title",
			anchorPoint: { x: 0, y: 0 },
		});
		title.pos.x = (app.viewport.width - title.width) / 2;
		title.floating = true;
		app.world.addChild(title, 10);

		// the window the names roll through: it clips them under the title
		const view = new Container(0, TOP, WIDTH, BOTTOM - TOP);
		view.floating = true;
		view.clipping = true;
		app.world.addChild(view, 10);

		const roll = new Container(0, 0, WIDTH, ROLL.length * LINE);
		// the names move with it: without this they keep the bounds they had
		// when added, and are left out as off screen once those are
		roll.enableChildBoundsUpdate = true;
		ROLL.forEach(([text, kind], i) => {
			if (kind !== "gap") {
				const line = new BitmapText(WIDTH / 2, i * LINE, {
					font: kind === "head" ? "atascii40" : "atascii32",
					textAlign: "center",
					text,
				});
				line.addPostEffect(shaders.shadow);
				roll.addChild(line);
			}
		});
		view.addChild(roll);

		// up from under the window until the last line has left it, then again
		const height = view.height;
		const run = height + roll.height;
		roll.pos.y = height;
		new Tween(roll.pos)
			.to(
				{ y: -roll.height },
				{ duration: (run / SPEED) * 1000, repeat: Infinity },
			)
			.start();

		// enable the keyboard
		input.bindKey(input.KEY.ENTER, "enter", true);
		input.bindKey(input.KEY.X, "enter", true);
		input.bindKey(input.KEY.SPACE, "enter", true);
		input.bindKey(input.KEY.ESC, "enter", true);
		bindPads(NEXT_PAD);
		// a click or a tap goes back too
		input.bindPointer(input.KEY.ENTER);

		audio.playTrack("menu_song");
	}

	override update(dt: number) {
		if (input.isKeyPressed("enter")) {
			audio.play("menu");
			go(state.MENU);
		}
		return super.update(dt);
	}

	override onDestroyEvent() {
		for (const key of ["ENTER", "X", "SPACE", "ESC"] as const) {
			input.unbindKey(input.KEY[key]);
		}
		unbindPads(NEXT_PAD);
		input.unbindPointer();
	}
}
