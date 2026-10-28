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
} from "melonjs";
import { INSET } from "../constants";
import { shaders } from "../shaders";
import { addParallaxBackground } from "./background";

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

		const lines: [string, number, number, "atascii32" | "atascii40"][] = [
			[">ORIGINAL GAME<", 40, 160, "atascii40"],
			["DESIGN CODE GFX :", 40, 210, "atascii32"],
			["JOHAN PEITZ", 100, 245, "atascii32"],
			["MUSIC SFX :", 40, 285, "atascii32"],
			["ANDERS SVENSSON", 100, 320, "atascii32"],
			[">WEB EDITION<", 40, 365, "atascii40"],
			["OLIVIER BIOT", 100, 410, "atascii32"],
		];
		for (const [text, x, y, font] of lines) {
			const line = new BitmapText(INSET + x, y, { font, text });
			line.floating = true;
			line.addPostEffect(shaders.shadow);
			app.world.addChild(line, 10);
		}

		// enable the keyboard
		input.bindKey(input.KEY.ENTER, "enter", true);
		input.bindKey(input.KEY.X, "enter", true);
		input.bindKey(input.KEY.SPACE, "enter", true);
		input.bindKey(input.KEY.ESC, "enter", true);

		audio.playTrack("menu_song");
	}

	override update(dt: number) {
		if (input.isKeyPressed("enter")) {
			audio.play("menu");
			state.change(state.MENU);
		}
		return super.update(dt);
	}

	override onDestroyEvent() {
		for (const key of ["ENTER", "X", "SPACE", "ESC"] as const) {
			input.unbindKey(input.KEY[key]);
		}
	}
}
