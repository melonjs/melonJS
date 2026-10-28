/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	audio,
	ColorLayer,
	event,
	input,
	Stage,
	state,
	Text,
} from "melonjs";
import { VIEW_H, VIEW_W } from "../constants";

const STYLE = {
	font: "Arial",
	bold: true,
	fillStyle: "#f6e7c8",
	textAlign: "center",
} as const;

// a separate stage, since state.change() to the current state does nothing
export class EscapedStage extends Stage {
	private onKey?: (action: string | undefined) => void;

	override onResetEvent(app: Application, seconds = 0) {
		audio.stopTrack();
		audio.tone({ freq: 392, duration: 0.12, gain: 0.2 });
		audio.tone({ freq: 587, duration: 0.18, delay: 0.11, gain: 0.2 });
		audio.tone({ freq: [784, 1176], duration: 0.75, delay: 0.23, gain: 0.2 });

		app.world.addChild(new ColorLayer("background", "#06040c"), 0);
		const minutes = Math.floor(seconds / 60);
		const rest = String(Math.floor(seconds % 60)).padStart(2, "0");
		const lines: [string, number, number][] = [
			["You escaped the dungeon!", 42, VIEW_H / 2 - 70],
			[`in ${minutes}:${rest}`, 28, VIEW_H / 2],
			["Press space to go back in", 22, VIEW_H / 2 + 90],
		];
		for (const [text, size, y] of lines) {
			app.world.addChild(new Text(VIEW_W / 2, y, { ...STYLE, size, text }), 1);
		}

		input.bindKey(input.KEY.SPACE, "again", true);
		this.onKey = (action: string | undefined) => {
			if (action === "again") {
				state.change(state.PLAY);
			}
		};
		event.on(event.KEYDOWN, this.onKey);
	}

	override onDestroyEvent() {
		if (this.onKey) {
			event.off(event.KEYDOWN, this.onKey);
		}
		input.unbindKey(input.KEY.SPACE);
	}
}
