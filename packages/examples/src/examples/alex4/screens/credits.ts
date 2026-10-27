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
import { blit, drawLabel, drawText } from "../gfx";
import { addBackground } from "./background";
import { playMusic, stopMusic } from "./music";

const LINES: [string, number][] = [
	[">ORIGINAL GAME<", 40],
	["DESIGN CODE GFX", 0],
	["  JOHAN PEITZ", 0],
	["MUSIC SFX", 0],
	["  ANDERS SVENSSON", 0],
	[">WEB EDITION<", 40],
	["  OLIVIER BIOT", 0],
];

class Credits extends Renderable {
	constructor() {
		super(0, 0, 640, 480);
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
	}

	override update() {
		if (confirmPressed() || justPressed("escape")) {
			audio.play("menu");
			state.change(state.MENU, false);
		}
		return true;
	}

	override draw(renderer: Renderer) {
		const title = loader.getImage("menu_title") as HTMLImageElement;
		blit(renderer, title, Math.round((640 - title.width) / 2), 30);
		let y = 150;
		for (const [line, size] of LINES) {
			if (size === 40 && y > 150) y += 8;
			drawLabel(renderer, line, 40, y, size === 40 ? 40 : 32);
			y += size === 40 ? 44 : 38;
		}
		drawText(
			renderer,
			"(C) 2003 FREE LUNCH DESIGN",
			320,
			448,
			32,
			"center",
			0.75,
			true,
		);
	}
}

export class CreditsScreen extends Stage {
	override onResetEvent(app: Application) {
		syncControls();
		addBackground(app);
		app.world.addChild(new Credits(), 10);
		playMusic("menu");
	}

	override onDestroyEvent() {
		stopMusic();
	}
}
