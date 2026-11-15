/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Container,
	collision,
	Polygon,
	type Renderable,
	type Sprite,
	type Tile,
	type TMXObject,
	type TMXTileset,
	Tween,
	Vector2d,
} from "melonjs";
import { FRAME_H, FRAME_W, TILE_H } from "../constants";
import { type ChestFx, highlightChest, openChest } from "../fx/chests";
import { doorDust } from "../fx/doors";
import { playAt, SFX } from "../fx/sound";
import type { Dungeon } from "./dungeon";

// The classes of the dungeon are set on its tiles in the tileset, so every
// object placed from those tiles is a tile object
export function tileOf(settings: TMXObject): Tile {
	if (settings.tile === undefined) {
		throw new Error("expected a tile object, from a tile with this class");
	}
	return settings.tile;
}

// a tile object the hero can walk up to and use
export abstract class Usable extends Container {
	abstract readonly hint: string;
	used = false;
	// center of the cell it stands on
	readonly spot = new Vector2d();
	// its tile, drawn as Tiled draws it (flipped, resized or animated)
	readonly sprite: Sprite;
	protected readonly tileset: TMXTileset;
	// the tile it turns into once used, set on its tile in the tileset
	private readonly opens: number | undefined;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings.width, settings.height);
		const tile = tileOf(settings);
		// a tile's renderable is always a sprite
		this.sprite = tile.getRenderable(settings) as Sprite;
		this.addChild(this.sprite);
		this.tileset = tile.tileset;
		this.opens = settings.resolvedProperty("opens");
		// Tiled anchors the tile at the bottom corner of its cell
		this.spot.set(x + FRAME_W / 2, y + FRAME_H - TILE_H / 2);
	}

	abstract use(dungeon: Dungeon): void;

	// switch to the "open" tile
	open() {
		this.used = true;
		if (this.opens !== undefined) {
			this.sprite.setRegion(this.tileset.texture.getRegion(this.opens));
		}
	}
}

export class Chest extends Usable {
	readonly hint = "Space: open the chest";
	private fx?: ChestFx;

	override onActivateEvent() {
		const app = this.parentApp;
		if (app) {
			this.fx = highlightChest(app, this, this.spot);
		}
	}

	use(dungeon: Dungeon) {
		this.open();
		playAt(SFX.latch, this.spot.x, this.spot.y, 0.8);
		playAt(SFX.coins, this.spot.x, this.spot.y, 0.9);
		const app = this.parentApp;
		if (app && this.fx) {
			openChest(app, this, this.spot, this.fx);
		}
		dungeon.chestOpened();
	}
}

// a doorway: the part of the cell edge that opens, in Tiled units out of 64
// (the gate's arch, and a unit to spare), and how far its collision reaches
// behind and in front of the edge. That is well past the stone, so the hero
// never stands close enough to the frame to be drawn over it or under it.
// The stone on either side is in the map's collision layer, just as deep
const OPENING = [14, 52];
const JAMB_BACK = 26;
const JAMB_FRONT = 20;

export class Door extends Usable {
	readonly hint: string = "Space: open the door";
	// the wall it stands in, set on its tile in the tileset
	private readonly facing: "N" | "W";
	// the closed door, laid over the open frame as it fades out
	private readonly closed: Renderable;

	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings);
		this.facing = settings.resolvedProperty("facing") === "N" ? "N" : "W";
		this.closed = tileOf(settings).getRenderable(settings);
		// block the doorway until it opens. Points are offsets from the
		// cell's bottom corner in Tiled units, projected on screen
		const [a, b] = OPENING;
		const [dx, dy] =
			this.facing === "N"
				? [
						[a - 64, b - 64],
						[-JAMB_BACK, JAMB_FRONT],
					]
				: [
						[-JAMB_BACK, JAMB_FRONT],
						[a - 64, b - 64],
					];
		// the cell's bottom corner, where Tiled anchors the tile
		const origin = new Vector2d(FRAME_W / 2, FRAME_H);
		const corner = (x: number, y: number) => {
			return new Vector2d(x, y).toIso().add(origin);
		};
		this.bodyDef = {
			type: "static",
			shapes: [
				new Polygon(0, 0, [
					corner(dx[0], dy[0]),
					corner(dx[1], dy[0]),
					corner(dx[1], dy[1]),
					corner(dx[0], dy[1]),
				]),
			],
			collisionType: collision.types.WORLD_SHAPE,
		};
	}

	use(dungeon: Dungeon) {
		playAt(SFX.door, this.spot.x, this.spot.y, 0.9);
		playAt(SFX.creak, this.spot.x, this.spot.y, 0.6);
		this.parentApp?.viewport.shake(2, 220);
		dungeon.openDoorway(this);
	}

	override open() {
		super.open();
		this.body.setCollisionMask(collision.types.NO_OBJECT);
		// the doors fade out of the frame in a cloud of dust
		const app = this.parentApp;
		if (app) {
			const closed = this.closed;
			this.addChild(closed);
			new Tween(closed)
				.to({ alpha: 0 }, { duration: 450, easing: Tween.Easing.Quadratic.In })
				.onComplete(() => {
					this.removeChild(closed);
				})
				.start();
			doorDust(app, this.pos.x, this.pos.y, this.depth, this.facing, OPENING);
		}
	}
}

// locked until every chest is open, then opened by the dungeon
export class Gate extends Door {
	override readonly hint = "The gate is locked";

	override use(dungeon: Dungeon) {
		playAt(SFX.locked, this.spot.x, this.spot.y, 0.8);
		dungeon.events.locked();
	}
}

export class Exit extends Usable {
	readonly hint = "Space: climb the stairs";

	use(dungeon: Dungeon) {
		dungeon.events.exit();
	}
}
