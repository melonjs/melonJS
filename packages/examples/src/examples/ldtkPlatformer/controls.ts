/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { input } from "melonjs";

const { KEY, GAMEPAD } = input;

/** the keys of each action of the game */
const KEYS = {
	left: [KEY.LEFT, KEY.A],
	right: [KEY.RIGHT, KEY.D],
	up: [KEY.UP, KEY.W],
	down: [KEY.DOWN, KEY.S],
	jump: [KEY.SPACE, KEY.X],
};

/** what the player is asking for this frame */
export type Controls = Record<keyof typeof KEYS, boolean>;

/**
 * Bind the keyboard, and a gamepad to the same actions: a gamepad's buttons
 * and stick stand for keys. The on-screen stick and button of a touch
 * screen (the gamepad plugin) are a gamepad too.
 */
export function bindControls() {
	for (const [action, keys] of Object.entries(KEYS)) {
		for (const key of keys) {
			// a jump is one press: holding the key does not jump again
			input.bindKey(key, action, action === "jump");
		}
	}

	const button = (code: number, key: number) => {
		input.bindGamepad(0, { type: "buttons", code }, key);
	};
	button(GAMEPAD.BUTTONS.FACE_1, KEY.SPACE);
	button(GAMEPAD.BUTTONS.LEFT, KEY.LEFT);
	button(GAMEPAD.BUTTONS.RIGHT, KEY.RIGHT);
	button(GAMEPAD.BUTTONS.UP, KEY.UP);
	button(GAMEPAD.BUTTONS.DOWN, KEY.DOWN);

	const stick = (code: number, threshold: number, key: number) => {
		input.bindGamepad(0, { type: "axes", code, threshold }, key);
	};
	stick(GAMEPAD.AXES.LX, -0.5, KEY.LEFT);
	stick(GAMEPAD.AXES.LX, 0.5, KEY.RIGHT);
	stick(GAMEPAD.AXES.LY, -0.5, KEY.UP);
	stick(GAMEPAD.AXES.LY, 0.5, KEY.DOWN);
}

/**
 * read the actions asked for this frame
 * @returns each action, pressed or not
 */
export function readControls(): Controls {
	return {
		left: input.isKeyPressed("left"),
		right: input.isKeyPressed("right"),
		up: input.isKeyPressed("up"),
		down: input.isKeyPressed("down"),
		jump: input.isKeyPressed("jump"),
	};
}
