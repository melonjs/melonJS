/**
 * What is particular to a map saved by
 * [Sprite Fusion](https://www.spritefusion.com), for the tile map reader
 * (`TMXTileMap`) and the map parser.
 *
 * Its TMX export is a Tiled map. Its "JSON" export says the same things in
 * words of its own, which the reader takes as they are: `tileSize`,
 * `mapWidth` and `mapHeight` for the map, and for each layer a `collider`
 * switch and the list of its `tiles`, each `{ id, x, y, attributes }`. Two
 * things are not said by a word: the file names no image (the editor saves
 * one next to it, `spritesheet.png`, and a tile's `id` is its place in it),
 * and it lists the layer on top first.
 */

/** the name the editor gives the image it saves with a map */
export const SPRITESHEET = "spritesheet";

/**
 * The name the spritesheet of a `"spritefusion"` asset is loaded under: one
 * for each map, as every map of the editor's comes with a `spritesheet.png`.
 * @param mapName - the name of the map asset
 * @returns the name of its image
 */
export function spritesheetName(mapName: string): string {
	return `${mapName}~${SPRITESHEET}`;
}

/**
 * whether a map's content is in the words of Sprite Fusion's JSON export
 * @param data - a map file's content
 * @returns true if it is
 */
export function isSpriteFusionMap(data: unknown): boolean {
	if (typeof data !== "object" || data === null) {
		return false;
	}
	const map = data as { tileSize?: unknown; tilewidth?: unknown };
	return typeof map.tileSize === "number" && map.tilewidth === undefined;
}
