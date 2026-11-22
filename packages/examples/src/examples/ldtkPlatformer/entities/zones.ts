/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	collision,
	type LDtkEntityReference,
	type LDtkEntitySettings,
	type LDtkProject,
	loader,
	type PlacedTile,
	PlacedTileLayer,
	Rect,
	Tileset,
} from "melonjs";

const TILE = 16;
// where the tiles used here are in the project's tileset image, in pixels
const LADDER = { x: 96, y: 144 };
const FLAME = { x: 256, y: 304 };

let tiles: Tileset | undefined;
/**
 * The world's own tileset, to draw the areas below with: the image LDtk
 * names is loaded with the project, under a name the project gives.
 * @returns a tileset over that image
 */
const tileset = () => {
	if (tiles === undefined) {
		const project = loader.getLDtk("gridvania") as LDtkProject;
		tiles = new Tileset({
			name: "SunnyLand",
			image: project.images.get("atlas/SunnyLand_by_Ansimuz-extended.png"),
			tilewidth: TILE,
			tileheight: TILE,
		});
	}
	return tiles;
};

/**
 * An entity of the LDtk world that is an area the player can be in: a few
 * tiles of the world's tileset placed over its box (a `PlacedTileLayer`,
 * built in code), with a body that is touched and not bumped into.
 */
class Zone extends PlacedTileLayer {
	/** the entity's fields, as set in LDtk */
	fields: Record<string, unknown>;

	constructor(settings: LDtkEntitySettings, placed: PlacedTile[]) {
		super({
			name: settings.name,
			tileset: tileset(),
			offsetx: settings.x,
			offsety: settings.y,
			width: settings.width,
			height: settings.height,
			tiles: placed,
		});
		this.fields = settings.fields;
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, settings.width, settings.height)],
			isSensor: true,
			collisionType: collision.types.ACTION_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
		};
	}
}

/** a ladder: the player climbs while in it */
export class Ladder extends Zone {
	constructor(_x: number, _y: number, settings: LDtkEntitySettings) {
		const rung = tileset().tileIdAt(LADDER.x, LADDER.y);
		const placed: PlacedTile[] = [];
		// the ladder tile, down the height of the entity's box
		for (let y = 0; y < settings.height; y += TILE) {
			placed.push({ x: (settings.width - TILE) / 2, y, tileId: rung });
		}
		super(settings, placed);
	}
}

/** a teleport: it leads to another, named by its `destination` field */
export class Teleport extends Zone {
	constructor(_x: number, _y: number, settings: LDtkEntitySettings) {
		super(settings, [
			{
				// a flame, standing on the bottom of the entity's box
				x: (settings.width - TILE) / 2,
				y: settings.height - TILE,
				tileId: tileset().tileIdAt(FLAME.x, FLAME.y),
			},
		]);
	}

	/** the entity LDtk's `EntityRef` field points at */
	get destination() {
		return this.fields.destination as LDtkEntityReference | null | undefined;
	}
}
