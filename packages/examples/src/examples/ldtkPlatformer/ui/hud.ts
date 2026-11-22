/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { BitmapText, Container, type LDtkLevelInfo, Tween } from "melonjs";
import { gameState } from "../gameState";
import { ldtkProject } from "../world/world";

// the font is drawn at 24 px: a third of it is its 8 px grid
const SMALL = 1 / 3;
const LARGE = 2 / 3;
const GOLD = "#f0be3c";

/**
 * a room's name as shown: its identifier in LDtk, and its "roomType" field
 * @param room - a level of the LDtk world
 * @returns the name
 */
function nameOf(room: LDtkLevelInfo | undefined): string {
	const title = (room?.identifier ?? "").replaceAll("_", " ").toUpperCase();
	const kind = room?.fields.roomType;
	return typeof kind === "string" && kind.toUpperCase() !== title
		? `${title} - ${kind.toUpperCase()}`
		: title;
}

/** what the player has found, in a line */
function bagLine(rooms: number): string {
	const gold = gameState.bag.get("Gold") ?? 0;
	const items = gameState.taken.size;
	const visited = gameState.visited.size;
	return `GOLD ${String(gold)} ITEMS ${String(items)} ROOMS ${String(visited)}/${String(rooms)}`;
}

/**
 * The room's name and what the player has found: on the screen, not in the
 * world (`floating`). It shows what the game state holds, and moves a
 * little when that changes.
 */
export class HUD extends Container {
	room: BitmapText;
	bag: BitmapText;
	/** a room's name across the screen, the first time the player enters it */
	title: BitmapText;
	/** the number of rooms of the world */
	rooms = ldtkProject().levels.length;
	/** the rooms the title was shown for */
	announced = 0;
	/** what the two lines say */
	shown = { room: "", bag: "" };

	constructor(width: number, height: number) {
		super(0, 0, width, height);
		this.floating = true;
		this.name = "HUD";
		this.room = new BitmapText(4, 4, {
			font: "PressStart2P",
			size: SMALL,
			text: "",
		});
		this.bag = new BitmapText(4, 15, {
			font: "PressStart2P",
			size: SMALL,
			fillStyle: GOLD,
			text: "",
		});
		this.title = new BitmapText(width / 2, height / 3, {
			font: "PressStart2P",
			size: LARGE,
			textAlign: "center",
			text: "",
		});
		this.title.alpha = 0;
		this.addChild(this.room);
		this.addChild(this.bag);
		this.addChild(this.title);
	}

	override update(dt: number) {
		const name = nameOf(gameState.room);
		if (name !== this.shown.room) {
			this.shown.room = name;
			this.room.setText(name);
		}
		// a room entered for the first time is announced
		if (gameState.visited.size !== this.announced) {
			this.announced = gameState.visited.size;
			this.announce(name);
		}
		const bag = bagLine(this.rooms);
		if (bag !== this.shown.bag) {
			this.shown.bag = bag;
			this.bag.setText(bag);
			this.bump(this.bag);
		}
		return super.update(dt) || true;
	}

	/**
	 * show a room's name across the screen for a moment
	 * @param name - the name
	 */
	announce(name: string) {
		this.title.setText(name);
		const fadeOut = new Tween(this.title).to(
			{ alpha: 0 },
			{ duration: 500, delay: 900 },
		);
		new Tween(this.title)
			.to({ alpha: 1 }, { duration: 250 })
			.chain(fadeOut)
			.start();
	}

	/**
	 * a line of text hops when what it says changes
	 * @param line - the text
	 */
	bump(line: BitmapText) {
		const y = line.pos.y;
		line.pos.y = y - 3;
		new Tween(line.pos)
			.to({ y }, { duration: 250, easing: Tween.Easing.Bounce.Out })
			.start();
	}
}
