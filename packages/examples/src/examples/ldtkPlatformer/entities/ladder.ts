/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	collision,
	type LDtkObjectSettings,
	type PlacedTile,
	PlacedTileLayer,
	Rect,
} from "melonjs";
import { TILE } from "../config";
import { TILES, worldTileset } from "../world/tiles";

/**
 * A "Ladder" entity of the LDtk world: an area as tall as the box drawn in
 * LDtk, which the player climbs while in it.
 *
 * It is a small tile layer built in code (a `PlacedTileLayer`): the ladder
 * tile of the world's tileset, repeated down the height of the box, with a
 * body that is touched and not bumped into.
 */
export class Ladder extends PlacedTileLayer {
	constructor(_x: number, _y: number, settings: LDtkObjectSettings) {
		const tileset = worldTileset();
		const rung = tileset.tileIdAt(TILES.ladder.x, TILES.ladder.y);
		const rungs: PlacedTile[] = [];
		for (let y = 0; y < settings.height; y += TILE) {
			rungs.push({ x: (settings.width - TILE) / 2, y, tileId: rung });
		}
		super({
			name: settings.name,
			tileset,
			offsetx: settings.x,
			offsety: settings.y,
			width: settings.width,
			height: settings.height,
			tiles: rungs,
		});
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, settings.width, settings.height)],
			isSensor: true,
			collisionType: collision.types.ACTION_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
		};
	}
}
