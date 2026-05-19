/**
 * melonJS — Plinko (Planck) example: walls and slot dividers.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Static collision rectangles for:
 *  - the left / right play-field walls (keep balls inside the funnel)
 *  - the vertical dividers between scoring slots at the bottom
 *  - the bottom floor (catches stray balls if a slot sensor fails to fire)
 *
 * Each wall is a `Container` carrying the body, with a `WallVisual`
 * child for the painted glow rectangle — matches the Peg / Slot
 * pattern, the combination known to render reliably under both
 * Canvas and WebGL.
 */

import { Container, collision, Rect, Renderable, type Renderer } from "melonjs";
import {
	COLOR_WALL,
	COLOR_WALL_HOT,
	DROP_BAND_Y,
	PLAY_LEFT,
	PLAY_RIGHT,
	SLOT_COUNT,
	SLOT_TOP,
	SLOT_WALL_TOP,
	VIEWPORT_H,
} from "../constants";

/** Wall thickness for the side and slot dividers (px). */
const WALL_THICKNESS = 6;

class WallVisual extends Renderable {
	constructor(w: number, h: number) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = false;
	}

	override draw(_renderer: Renderer): void {
		// Wall visual is pre-rendered into the `BakedStatics`
		// backdrop. The Wall Container still exists so the
		// collision body remains in the physics simulation; the
		// drawing has been moved off the per-frame path.
		void COLOR_WALL;
		void COLOR_WALL_HOT;
	}
}

class Wall extends Container {
	constructor(x: number, y: number, w: number, h: number) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, w, h)],
			collisionType: collision.types.WORLD_SHAPE,
			collisionMask: collision.types.ALL_OBJECT,
			// Walls absorb energy — restitution well below the ball-peg
			// value so balls don't ping endlessly along the side walls.
			restitution: 0.2,
			friction: 0.1,
		};
		this.addChild(new WallVisual(w, h));
	}
}

/**
 * Build all static walls in one pass:
 *  - left wall (from below the drop band to the slot top so the slot
 *    dividers can join cleanly)
 *  - right wall (mirror image)
 *  - slot dividers — `SLOT_COUNT + 1` vertical bars from `SLOT_WALL_TOP`
 *    to the viewport bottom, evenly spaced
 *  - bottom floor strip
 */
export const buildWalls = (): Wall[] => {
	const walls: Wall[] = [];

	// Tops of the side walls align with the drop-band centerline so
	// the horizontal magenta strip in `DropZone.draw` reads as the
	// top cap of the play-field frame — closed rectangle, not a
	// floating line with a gap below it.
	const fieldTop = DROP_BAND_Y;
	const fieldBottom = SLOT_TOP;

	// left + right side walls
	walls.push(
		new Wall(
			PLAY_LEFT - WALL_THICKNESS,
			fieldTop,
			WALL_THICKNESS,
			fieldBottom - fieldTop,
		),
	);
	walls.push(
		new Wall(PLAY_RIGHT, fieldTop, WALL_THICKNESS, fieldBottom - fieldTop),
	);

	// Slot dividers — `SLOT_COUNT + 1` vertical bars from SLOT_WALL_TOP
	// down to the viewport bottom. The walls extend above SLOT_TOP so
	// balls can't squeeze sideways between slot boundaries.
	const slotWidth = (PLAY_RIGHT - PLAY_LEFT) / SLOT_COUNT;
	const dividerH = VIEWPORT_H - SLOT_WALL_TOP;
	for (let i = 0; i <= SLOT_COUNT; i++) {
		const x = PLAY_LEFT + i * slotWidth - WALL_THICKNESS / 2;
		walls.push(new Wall(x, SLOT_WALL_TOP, WALL_THICKNESS, dividerH));
	}

	// Floor — a single wide bar across the bottom edge. Catches stray
	// balls and also stops the player from accidentally creating an
	// "infinite fall" if a slot sensor fails to fire.
	walls.push(
		new Wall(
			PLAY_LEFT,
			VIEWPORT_H - WALL_THICKNESS,
			PLAY_RIGHT - PLAY_LEFT,
			WALL_THICKNESS,
		),
	);

	return walls;
};
