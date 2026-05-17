/**
 * melonJS — Pool (Matter) example: TableSprite + invisible rail bodies.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	collision,
	Rect,
	Renderable,
	type Renderer,
	Sprite,
	Vector2d,
} from "melonjs";
import { RAIL_RESTITUTION } from "../constants";

/**
 * The table backdrop sprite — fills the viewport with the painted
 * pool table (felt + rails + pockets). All collision is handled by
 * invisible Rail bodies; this sprite is purely visual.
 */
class TableSprite extends Sprite {
	constructor() {
		super(0, 0, {
			image: "table",
			anchorPoint: new Vector2d(0, 0),
		});
		this.alwaysUpdate = true;
		// table sits below everything else (rails are invisible so order
		// against them doesn't matter; balls and pockets go on top)
		this.depth = -10;
	}
}

/**
 * A single invisible rail collision body — static rectangle with high
 * restitution. No `draw()` override; the table sprite already shows
 * the rail visually.
 */
class Rail extends Renderable {
	constructor(x: number, y: number, w: number, h: number) {
		super(x, y, w, h);
		// pos is the top-left of the rail; anchor defaults to (0.5, 0.5)
		// which would center the renderable's bounds on pos, but the body
		// sits at (pos.x, pos.y) to (pos.x + w, pos.y + h). Anchor (0, 0)
		// keeps `getBounds()` aligned with the body for viewport culling
		// and debug overlay drawing.
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, w, h)],
			collisionType: collision.types.WORLD_SHAPE,
			restitution: RAIL_RESTITUTION,
		};
	}

	override draw(_renderer: Renderer): void {
		// intentionally empty — the table sprite supplies the rail visual
	}
}

/**
 * Each rail collision body, tuned ONE BY ONE against the painted
 * cushions in `table.png`. Rows are `[x, y, width, height]` (rail's
 * top-left corner + size in viewport coordinates). Edit any row in
 * isolation — adjusting one rail won't shift any other rail or any
 * pocket, since pocket positions live in their own table in
 * `pocket.ts`.
 *
 * Layout:
 *   - top + bottom horizontal rails each split into a left half and a
 *     right half around the mid-pocket gap (4 horizontal rails total).
 *   - left + right vertical rails span the full play area between the
 *     top and bottom corner pockets (2 vertical rails total).
 *
 * Tune interactively against the debug overlay (`S` toggles the panel).
 */
const RAIL_RECTS: ReadonlyArray<readonly [number, number, number, number]> = [
	// Each row is [x, y, width, height], where:
	//   x      — left edge of the rail body, in viewport-space pixels
	//   y      — top edge of the rail body, in viewport-space pixels
	//   width  — rail body width (x extent)
	//   height — rail body height (y extent)
	// Horizontal rails are wide + thin (width ≫ height); vertical rails
	// are tall + thin (height ≫ width). The thin dimension is the rail
	// thickness — make it thick enough that a fast ball can't tunnel.

	// horizontal — top row (split into two halves around the top-mid pocket)
	[108, 44, 488, 30], // top-left half
	[670, 44, 492, 30], // top-right half
	// horizontal — bottom row (mirror of top)
	[106, 651, 490, 30], // bottom-left half
	[670, 651, 496, 30], // bottom-right half
	// vertical — left + right (span between top and bottom corner pockets)
	[45, 108, 30, 502], // left
	[1205, 108, 30, 502], // right
];

/**
 * Build the rail collision bodies + the table sprite.
 */
export const buildTable = (): Renderable[] => {
	const sprite = new TableSprite();
	const rails = RAIL_RECTS.map(([x, y, w, h]) => new Rail(x, y, w, h));
	return [sprite, ...rails];
};
