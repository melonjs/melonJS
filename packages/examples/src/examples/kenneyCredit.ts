/**
 * melonJS — the "assets by Kenney" credit shared by the examples built on
 * Kenney's CC0 packs: the word "assets by" over Kenney's logo, pinned to the
 * bottom-right corner as a floating (screen-space) renderable, so it stays put
 * whatever the camera does, a perspective `Camera3d` included.
 *
 * Crediting Kenney is not required by the CC0 licence; it is a courtesy. The
 * logo itself is Kenney's (see `packages/examples/LICENSE.md`).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { type Application, Sprite, Text } from "melonjs";

/** the logo, to add to an example's preload list */
export const KENNEY_LOGO = {
	name: "kenneyLogo",
	type: "image",
	src: `${import.meta.env.BASE_URL}assets/mesh3d/kenney/kenney_logo.png`,
};

// the logo is 288 × 112; drawn at this scale it sits small in the corner
const LOGO_SCALE = 0.4;
const LOGO_W = 288 * LOGO_SCALE;
const LOGO_H = 112 * LOGO_SCALE;
const MARGIN = 14;

/**
 * Pin the credit to the bottom-right corner of the app's view.
 * @param app - the running application (its world receives the credit)
 * @param color - the label colour, chosen against the example's background
 */
export function addKenneyCredit(app: Application, color = "#ffffff") {
	const w = app.viewport.width;
	const h = app.viewport.height;

	const logo = new Sprite(w - MARGIN, h - MARGIN, {
		image: "kenneyLogo",
		anchorPoint: { x: 1, y: 1 },
	});
	logo.scale(LOGO_SCALE);
	const label = new Text(w - MARGIN - LOGO_W / 2, h - MARGIN - LOGO_H - 2, {
		font: "sans-serif",
		size: 13,
		fillStyle: color,
		textAlign: "center",
		textBaseline: "bottom",
		text: "assets by",
	});
	for (const part of [logo, label]) {
		part.floating = true;
		part.setOpacity(0.85);
		app.world.addChild(part, 1000);
	}
}
