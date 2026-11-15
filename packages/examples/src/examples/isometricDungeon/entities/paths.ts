/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Grid } from "@melonjs/pathfinding-plugin";
import {
	type Container,
	collision,
	level,
	type Renderable,
	type TMXTileMap,
	Vector2d,
} from "melonjs";
import { Door } from "./usables";

// cells to a tile's side. The walls stand on the tiles' edges, a good part
// of a tile deep, and a doorway is narrower than a tile: a cell the size of
// a tile beside a doorway always touches the stone either side of it, so
// every doorway would read as a wall. A quarter tile leaves the doorways
// open, and the hero's footprint (10 units across) still fits in a cell
const SUBDIVIDE = 4;

// the walls: the shapes of the map's collision layer, and the doors that
// are still shut
const isWall = (renderable: Renderable) => {
	if (renderable instanceof Door && renderable.used) {
		return false;
	}
	const r = renderable as unknown as {
		bodyDef?: { collisionType?: number };
		body?: { collisionType?: number };
	};
	const type = r.bodyDef?.collisionType ?? r.body?.collisionType;
	return type === collision.types.WORLD_SHAPE;
};

/**
 * The pathfinding grid of the dungeon, built by the pathfinding plugin each
 * time the level loads: the map's isometric diamonds, each cut into
 * SUBDIVIDE × SUBDIVIDE smaller ones, over the same ground.
 * @param container - where the level is loaded
 * @returns the grid
 */
export function dungeonGrid(container: Container) {
	const map = level.getCurrentLevel() as TMXTileMap;
	// the grid's corner is the top left of the box around its diamonds
	const corner = map.getRenderer().tileToPixelCoords(0, 0, new Vector2d());
	corner.x -= (map.rows * map.tilewidth) / 2;
	const at = container.getAbsolutePosition();
	return Grid.fromBodies(container, {
		cols: map.cols * SUBDIVIDE,
		rows: map.rows * SUBDIVIDE,
		tileWidth: map.tilewidth / SUBDIVIDE,
		tileHeight: map.tileheight / SUBDIVIDE,
		cellShape: "isometric",
		x: at.x + corner.x,
		y: at.y + corner.y,
		solid: isWall,
	});
}
