/**
 * melonJS — Starsweep: the classes the maps' objects are built with.
 *
 * Each map has an `actors` object layer that places what stands on the
 * board: one `Bolt` object, where Bolt begins, and the portals monsters come
 * out of (the animated portal tile, dropped as a tile object; the tile's
 * class in the tileset is `Portal`, so every portal placed is one). The
 * classes here are registered under those names, and `level.load` builds
 * one for each object. Registered, a tile object also comes without the
 * static body an unregistered one is given.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Container, registerTiledObjectClass, type TMXObject } from "melonjs";
import { Actor } from "./cast";

/**
 * Bolt, built where the map's `Bolt` object is. The field takes it from the
 * level to draw it with the other characters, and moves it from then on.
 */
export class Bolt extends Actor {
	/**
	 * @param x - the object's x, in the map
	 * @param y - the object's y, in the map
	 */
	constructor(x: number, y: number) {
		super("bolt-idle-down");
		this.place(x, y);
	}
}

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

/** register the classes, once, before a level loads */
export const registerObjects = () => {
	registerTiledObjectClass("Bolt", Bolt);
	registerTiledObjectClass("Portal", Portal);
};
