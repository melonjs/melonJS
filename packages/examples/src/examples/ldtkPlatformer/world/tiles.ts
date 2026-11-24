/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { loader, Tileset } from "melonjs";
import { TILE } from "../config";
import { ldtkProject } from "./world";

/** the tileset image of the sample, by the path the project names it with */
const IMAGE = "atlas/SunnyLand_by_Ansimuz-extended.png";

/** where the tiles the game's own objects use are in that image, in pixels */
export const TILES = {
	ladder: { x: 96, y: 144 },
	flame: { x: 256, y: 304 },
};

/**
 * The world's tileset image, by the name the loader keeps it under. It is
 * loaded with the project: no entry of its own in the game's resources.
 * @returns the image's name
 */
export function worldTilesetImage(): string {
	const name = ldtkProject().images.get(IMAGE);
	if (name === undefined) {
		throw new Error(`the project has no image "${IMAGE}"`);
	}
	return name;
}

let tileset: Tileset | undefined;

/**
 * The world's tileset, for the objects the game draws with its tiles: LDtk
 * shows this world's entities with its own icons, which are not in the
 * project's files, so the ladders and the teleports are given tiles here.
 * @returns a tileset over the project's image
 */
export function worldTileset(): Tileset {
	// (made once for an image: the example can be started more than once)
	const image = loader.getImage(worldTilesetImage());
	if (tileset?.image !== image) {
		tileset = new Tileset({
			name: "SunnyLand",
			image: worldTilesetImage(),
			tilewidth: TILE,
			tileheight: TILE,
		});
	}
	return tileset;
}
