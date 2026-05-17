/**
 * melonJS — Whac-A-Mole mini-game example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { BitmapText, Container, video } from "melonjs";

import { data } from "./data";

/**
 * a HUD container
 */
export class HUDContainer extends Container {
	score: BitmapText;
	hiscore: BitmapText;
	private lastScore = -1;
	private lastHiscore = -1;

	constructor() {
		super();

		// persistent across level change
		this.isPersistent = true;

		// make sure our object is always drawn last (on top)
		this.depth = Number.POSITIVE_INFINITY;

		// make sure we use screen coordinates
		this.floating = true;

		// give a name
		this.name = "HUD";

		// score display
		this.score = new BitmapText(10, 10, {
			font: "PressStart2P",
			size: 1.5,
			textAlign: "left",
			textBaseline: "top",
			text: "0",
		});
		this.addChild(this.score);

		// hiscore display
		this.hiscore = new BitmapText(video.renderer.width, 10, {
			font: "PressStart2P",
			size: 1.5,
			textAlign: "right",
			textBaseline: "top",
			text: data.hiscore.toString(),
		});
		this.addChild(this.hiscore);
	}

	override update(dt: number) {
		if (data.score !== this.lastScore) {
			this.lastScore = data.score;
			this.score.setText(data.score.toString());
		}
		if (data.hiscore !== this.lastHiscore) {
			this.lastHiscore = data.hiscore;
			this.hiscore.setText(data.hiscore.toString());
		}
		return super.update(dt);
	}
}
