/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Container, Sprite, Text, Tween, Vector2d } from "melonjs";
import { VIEW_H, VIEW_W } from "../constants";

const STYLE = {
	font: "Arial",
	bold: true,
	fillStyle: "#f6e7c8",
	// the stroke is drawn over the fill, so keep it thin
	strokeStyle: "#120c06",
	lineWidth: 1,
};

// the credit in the bottom right corner: the logo, drawn at half the size of
// its image so it stays sharp when the canvas is scaled up
const MARGIN = 16;
const LOGO_SCALE = 0.45;
const LOGO_W = 288 * LOGO_SCALE;
const LOGO_H = 112 * LOGO_SCALE;

// The HUD, in screen space. It is not in the world: the stage's darkness is
// drawn over the whole world, so the play stage draws the HUD itself, over
// everything the cameras drew.
export class Hud extends Container {
	private readonly count: Text;
	private readonly prompt: Text;
	private readonly message: Text;
	private fade?: Tween;

	constructor() {
		super(0, 0, VIEW_W, VIEW_H);
		this.name = "hud";
		this.count = new Text(24, 20, { ...STYLE, size: 26, text: " " });
		this.prompt = new Text(VIEW_W / 2, VIEW_H - 56, {
			...STYLE,
			size: 22,
			textAlign: "center",
			text: " ",
		});
		this.message = new Text(VIEW_W / 2, VIEW_H / 2 - 120, {
			...STYLE,
			size: 34,
			textAlign: "center",
			text: " ",
		});
		for (const text of [this.count, this.prompt, this.message]) {
			text.floating = true;
			this.addChild(text);
		}

		// the dungeon and the hero are Kenney's
		const logo = new Sprite(VIEW_W - MARGIN, VIEW_H - MARGIN, {
			image: "kenneyLogo",
			anchorPoint: new Vector2d(1, 1),
		});
		logo.scale(LOGO_SCALE);
		const credit = new Text(
			VIEW_W - MARGIN - LOGO_W / 2,
			VIEW_H - MARGIN - LOGO_H - 2,
			{
				...STYLE,
				size: 14,
				textAlign: "center",
				textBaseline: "bottom",
				text: "assets by",
			},
		);
		for (const part of [logo, credit]) {
			part.floating = true;
			part.setOpacity(0.85);
			this.addChild(part);
		}
	}

	chests(opened: number, total: number) {
		this.count.setText(`Chests ${opened} / ${total}`);
	}

	hint(text: string) {
		this.prompt.setText(text || " ");
	}

	// show a message, then fade it out
	say(text: string, hold = 2500) {
		this.fade?.stop();
		this.message.setText(text);
		this.message.setOpacity(1);
		this.fade = new Tween(this.message)
			.to({ alpha: 0 }, { duration: 800, delay: hold })
			.start();
	}
}
