/**
 * melonJS — Slingshot: the points that pop up where a rival is knocked out.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Camera3d,
	type Mesh,
	Text,
	Tween,
	Vector2d,
	Vector3d,
	type World,
} from "melonjs";
import { RIVAL_SIZE } from "../constants";
import { HUD_STYLE } from "./Hud";

/**
 * Show `+points` over a rival on screen, rising and fading away: a tween on
 * the label's position, another on the label.
 * @param world - the game world
 * @param camera - the stage's camera, to find the rival on screen
 * @param at - the rival
 * @param points - the points it earned
 */
export const popPoints = (
	world: World,
	camera: Camera3d,
	at: Mesh,
	points: number,
) => {
	const screen = camera.worldToScreen(
		new Vector3d(at.pos.x, at.pos.y - RIVAL_SIZE, at.depth),
		new Vector2d(),
	);
	if (screen === null) {
		// behind the camera
		return;
	}
	const label = new Text(screen.x, screen.y, {
		...HUD_STYLE,
		textAlign: "center",
		text: `+${points}`,
	});
	label.floating = true;
	world.addChild(label, 2);
	new Tween(label.pos)
		.to({ y: screen.y - 70 }, { duration: 900 })
		.easing(Tween.Easing.Quadratic.Out)
		.start();
	new Tween(label)
		.to({ alpha: 0 }, { duration: 900 })
		.onComplete(() => {
			world.removeChild(label);
		})
		.start();
};
