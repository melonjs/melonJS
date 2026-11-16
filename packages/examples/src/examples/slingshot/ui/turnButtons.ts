/**
 * melonJS — Slingshot: the buttons that turn the camera.
 *
 * ◀ and ▶ turn it a step round the field; VIEW swaps between the side view
 * and the view from behind the slingshot.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { UITextButton, type World } from "melonjs";
import type { OrbitCamera } from "../camera/OrbitCamera";

const BUTTON_STYLE = {
	width: 60,
	height: 60,
	font: "sans-serif",
	fontSize: 26,
	labelFillStyle: "#ffffff",
	hoverOffColor: "#1d3b57cc",
	hoverOnColor: "#2c5a82",
	pressedColor: "#16324a",
	borderColor: "#f6c445",
	hoverScale: 1.06,
	pressScale: 0.94,
};

/**
 * Add the turn buttons along the bottom left of the screen.
 * @param world - the game world
 * @param orbit - the camera they turn
 * @param height - the screen's height
 */
export const addTurnButtons = (
	world: World,
	orbit: OrbitCamera,
	height: number,
) => {
	const y = height - 80;
	const buttons = [
		new UITextButton(20, y, {
			...BUTTON_STYLE,
			text: "◀",
			onClick: () => {
				orbit.stepLeft();
			},
		}),
		new UITextButton(90, y, {
			...BUTTON_STYLE,
			text: "▶",
			onClick: () => {
				orbit.stepRight();
			},
		}),
		new UITextButton(160, y, {
			...BUTTON_STYLE,
			width: 96,
			fontSize: 20,
			text: "VIEW",
			onClick: () => {
				orbit.toggleView();
			},
		}),
	];
	for (const button of buttons) {
		world.addChild(button, 1);
	}
};
