/**
 * melonJS — Starsweep: the title screen.
 *
 * The game's name, how to play, the best score, a start button, and the
 * credits, over Bolt running across a strip of deck with monsters after
 * it. A `Stage`, drawn in the two layers of `layers.ts`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type Camera3d,
	Stage,
	state,
	UITextButton,
} from "melonjs";
import * as sfx from "../audio/sfx";
import { WIDTH } from "../config/layout";
import { formatScore, loadHiscore } from "../data/score";
import type { DeepSpace } from "../fx/DeepSpace";
import { controls } from "../input/Controls";
import { FONT, makeLabel } from "../ui/label";
import { setUpLayers, withSpaceCamera } from "./layers";
import { START, StartBeacon } from "./StartBeacon";
import { TITLE, TitleBackdrop } from "./TitleBackdrop";

/** The title screen: the game's name, how to play, and a start button. */
export class TitleScreen extends Stage {
	private deep: DeepSpace | null = null;
	private readonly space: Camera3d | null;

	constructor() {
		const { camera, settings } = withSpaceCamera();
		super(settings);
		this.space = camera;
	}

	override onResetEvent(app: Application) {
		app.reset();
		const { game, sky, deep } = setUpLayers(app, this.space);
		const backdrop = new TitleBackdrop(() => {
			sfx.sfxStart();
			state.change(state.PLAY);
		});
		game.addChild(backdrop, 0);
		for (const runner of backdrop.runners) {
			game.addChild(runner, 1);
		}
		this.deep = deep;
		backdrop.deep = deep;
		deep?.setColors(TITLE.dust);
		if (sky) {
			sky.setTheme(TITLE.sky, TITLE.clouds, TITLE.deepClouds);
			backdrop.drawnSky = false;
		}
		controls.attach(false);

		const text = (y: number, size: number, color: string, words: string) => {
			const label = makeLabel(WIDTH / 2, y, size, color, "center", words);
			game.addChild(label, 10);
			return label;
		};
		// the title on two lines, each over its own drop shadow
		for (const [y, word] of [
			[110, "STAR"],
			[220, "SWEEP"],
		] as const) {
			text(y + 7, 104, "#3b1f8a", word).pos.x += 6;
			text(y, 104, "#fff2a8", word);
		}
		text(360, 19, "#c9c3ff", "POWER UP EVERY PANEL.");
		text(390, 19, "#c9c3ff", "DODGE THE MONSTERS!");
		text(620, 15, "#8f88c9", "MOVE: DRAG LEFT, ARROWS OR WASD");
		text(646, 15, "#8f88c9", "ZAP: TOUCH RIGHT, SPACE OR X");
		text(740, 22, "#ffd23d", `HI ${formatScore(loadHiscore())}`);
		// the start button, with a beacon pulsing out of it (Enter or Space
		// starts too)
		game.addChild(new StartBeacon(), 9);
		const play = new UITextButton(START.x, START.y, {
			text: "TAP TO START",
			font: FONT,
			fontSize: 26,
			width: START.width,
			height: START.height,
			labelFillStyle: "#ffffff",
			hoverOffColor: "#e8459f",
			hoverOnColor: "#ff6fbd",
			pressedColor: "#b52f7c",
			borderColor: "#fff2a8",
			hoverScale: 1.05,
			pressScale: 0.94,
			onClick: () => {
				backdrop.start();
			},
		});
		play.floating = true;
		game.addChild(play, 10);
		// the credits (see packages/examples/LICENSE.md)
		text(928, 13, "#a59ee0", "MADE WITH MELONJS");
		text(952, 11, "#6f69a8", "CHARACTERS: KENNEY MONSTER BUILDER PACK (CC0)");
		text(970, 11, "#6f69a8", "FONT: KENNEY FUTURE (CC0)");
	}

	override onDestroyEvent() {
		// the dust and novas are persistent, so the next reset keeps them: take them out
		this.deep?.destroy();
		this.deep = null;
	}
}
