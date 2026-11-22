import { collision } from "../../physics/collision.js";
import { createLevelObject } from "../tiled/TMXObjectFactory.js";
import { COLLISION_GROUP } from "./constants.js";
import { mergeGridRects } from "./grid.js";

/**
 * additional import for TypeScript
 * @import Renderable from "../../renderable/renderable.js";
 * @import TileLayer from "./TileLayer.js";
 */

/**
 * Whether a layer is a level's collision layer, by its name: it contains
 * "collision", in any case ("collision", "Collisions", "world collision").
 * The convention of every level format: an object layer of a Tiled map, an
 * IntGrid layer of an LDtk level.
 * @param {string} name - the layer's name
 * @returns {boolean} true if it is
 * @ignore
 */
export function isCollisionLayerName(name) {
	return name.toLowerCase().includes(COLLISION_GROUP);
}

/**
 * Make an object a wall of the world: static, of collision type
 * `WORLD_SHAPE`. What an unnamed object of a collision layer becomes.
 *
 * An object built by a factory carries a `bodyDef` (declarative, the same
 * under every physics adapter), which the world makes a body of when the
 * object is added: the definition is what changes. An object that still
 * carries a body made by hand is changed in place.
 * @param {Renderable} obj - the object
 * @ignore
 */
export function markWorldShape(obj) {
	if (obj.bodyDef) {
		obj.bodyDef.collisionType = collision.types.WORLD_SHAPE;
		obj.bodyDef.type = "static";
	} else if (obj.body) {
		obj.body.collisionType = collision.types.WORLD_SHAPE;
		obj.body.isStatic = true;
	}
}

/**
 * A wall of the world over a rectangle: what an unnamed shape of a Tiled
 * collision layer is, built by the "shape" factory (the game's own, if it
 * registered one) and made a static world shape.
 * @param {object} settings - the wall: `x`, `y`, `z`, `width`, `height`, an `id`, and whatever a collision handler is to read of it
 * @param {object} map - the map the wall is built for, handed to the factory
 * @returns {Renderable} the wall
 * @ignore
 */
export function createWall(settings, map) {
	const wall = createLevelObject(settings, map);
	markWorldShape(wall);
	return wall;
}

/**
 * The walls of a tile layer whose tiles are solid: one for each rectangle
 * of cells holding a tile, so a floor of a hundred tiles is one body.
 * Built from the layer as it is now: a tile set or cleared later does not
 * change them.
 * @param {TileLayer} layer - a layer of an orthogonal map
 * @param {object} map - the map the layer is of
 * @returns {Renderable[]} the walls, to add to the container the layer is in
 * @ignore
 */
export function tileLayerWalls(layer, map) {
	const { cols, rows, tilewidth, tileheight, layerData } = layer;
	// where the layer was moved to from its place in the map: its offset
	const movedX = layer.pos.x - layer._mapPos.x;
	const movedY = layer.pos.y - layer._mapPos.y;
	const rects = mergeGridRects(cols, rows, (col, row) => {
		return layerData[(row * cols + col) * 2] !== 0;
	});
	return rects.map((rect) => {
		const x = (layer.startx + rect.x) * tilewidth + movedX;
		const y = (layer.starty + rect.y) * tileheight + movedY;
		const wall = createWall(
			{
				x,
				y,
				z: layer.pos.z,
				width: rect.width * tilewidth,
				height: rect.height * tileheight,
				id: `${layer.name}:${String(x)},${String(y)}`,
			},
			map,
		);
		// the layer the wall is of, for a collision handler to read
		wall.layer = layer.name;
		return wall;
	});
}
