/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { BitmapText, Container, type LDtkProject } from "melonjs";
import { gameState } from "./gameState";

/** the room's name, and what the player has found: on the screen, not in the world */
export class HUD extends Container {
	room: BitmapText;
	bag: BitmapText;
	shown = "";
	total: number;

	constructor(project: LDtkProject, width: number) {
		super(0, 0, width, 24);
		this.floating = true;
		this.isPersistent = true;
		this.name = "HUD";
		this.total = project.levels.length;
		// the font is drawn at 24 px: a third of it is its 8 px grid
		const font = { font: "PressStart2P", size: 1 / 3 };
		this.room = new BitmapText(4, 4, { ...font, text: "" });
		this.bag = new BitmapText(4, 15, {
			...font,
			fillStyle: "#f0be3c",
			text: "",
		});
		this.addChild(this.room);
		this.addChild(this.bag);
	}

	override update(dt: number) {
		const room = gameState.room;
		// a room's name and its "roomType" field are read from the level
		const kind = room?.fields.roomType;
		const title = (room?.identifier ?? "").replaceAll("_", " ").toUpperCase();
		const name =
			typeof kind === "string" && kind.toUpperCase() !== title
				? `${title} - ${kind.toUpperCase()}`
				: title;
		let items = 0;
		for (const count of gameState.bag.values()) {
			items += count;
		}
		const bag = `GOLD ${String(gameState.bag.get("Gold") ?? 0)} ITEMS ${String(gameState.taken.size)} ROOMS ${String(gameState.visited.size)}/${String(this.total)}`;
		const shown = `${name}|${bag}|${String(items)}`;
		if (shown !== this.shown) {
			this.shown = shown;
			this.room.setText(name);
			this.bag.setText(bag);
		}
		return super.update(dt) || true;
	}
}
