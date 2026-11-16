/**
 * melonJS — Starsweep: a portal, as a map places it.
 *
 * The portals monsters come out of are tile objects in each map's
 * `actors` layer, dropped from the animated portal tile, whose class in
 * the tileset is `Portal`. This class is registered under that name
 * (`registerTiledObjectClass`, in `ExampleStarsweep.ts`), so `level.load`
 * builds one for each, without the static body an unregistered tile
 * object is given.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Container, type TMXObject } from "melonjs";

/** A portal: its tile, animated, where the map's tile object is. */
export class Portal extends Container {
	/**
	 * @param x - the object's x, in the map
	 * @param y - the object's y, in the map
	 * @param settings - the object, with its `tile`
	 */
	constructor(x: number, y: number, settings: TMXObject) {
		super(x, y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		const tile = settings.tile;
		if (tile) {
			this.addChild(tile.getRenderable(settings));
		}
	}
}
