/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { type Application, input } from "melonjs";

const { BUTTONS, AXES } = input.GAMEPAD;
const { KEY } = input;

/**
 * The gamepad buttons and stick of a screen, mapped onto the keyboard keys
 * it binds, so the screen itself only ever deals with its actions.
 */
type PadMapping = {
	buttons: [button: number, key: number][];
	axes?: [axis: number, threshold: number, key: number][];
};

// the pad in use is not always the first one: listen to all of them
const PADS = [0, 1, 2, 3];

// the stick registers past half its travel (the threshold adds to the 0.1
// deadzone)
const HALF = 0.4;

const STICK_X: PadMapping["axes"] = [
	[AXES.LX, -HALF, KEY.LEFT],
	[AXES.LX, HALF, KEY.RIGHT],
];

/** in game: run with the pad or the stick, A jumps, B or X spits */
export const PLAY_PAD: PadMapping = {
	buttons: [
		[BUTTONS.LEFT, KEY.LEFT],
		[BUTTONS.RIGHT, KEY.RIGHT],
		[BUTTONS.FACE_1, KEY.X],
		[BUTTONS.FACE_2, KEY.Z],
		[BUTTONS.FACE_3, KEY.C],
		[BUTTONS.START, KEY.P],
		[BUTTONS.SELECT, KEY.ESC],
	],
	axes: STICK_X,
};

/** the title menu: move with the pad or the stick, pick with A or start */
export const MENU_PAD: PadMapping = {
	buttons: [
		[BUTTONS.UP, KEY.UP],
		[BUTTONS.DOWN, KEY.DOWN],
		[BUTTONS.LEFT, KEY.LEFT],
		[BUTTONS.RIGHT, KEY.RIGHT],
		[BUTTONS.FACE_1, KEY.X],
		[BUTTONS.START, KEY.ENTER],
	],
	axes: [...STICK_X, [AXES.LY, -HALF, KEY.UP], [AXES.LY, HALF, KEY.DOWN]],
};

/** the screens to go through: A or start, and B or select to skip */
export const NEXT_PAD: PadMapping = {
	buttons: [
		[BUTTONS.FACE_1, KEY.X],
		[BUTTONS.START, KEY.ENTER],
		[BUTTONS.FACE_2, KEY.ESC],
		[BUTTONS.SELECT, KEY.ESC],
	],
};

/** bind the pads, once the screen has bound its keys */
export function bindPads(mapping: PadMapping) {
	for (const pad of PADS) {
		for (const [button, key] of mapping.buttons) {
			// a screen without that key (no skip on this one) leaves it out
			if (input.getBindingKey(key)) {
				input.bindGamepad(pad, { type: "buttons", code: button }, key);
			}
		}
		for (const [axis, threshold, key] of mapping.axes ?? []) {
			input.bindGamepad(pad, { type: "axes", code: axis, threshold }, key);
		}
	}
}

export function unbindPads(mapping: PadMapping) {
	for (const pad of PADS) {
		for (const [button] of mapping.buttons) {
			input.unbindGamepad(pad, button);
		}
		for (const [axis] of mapping.axes ?? []) {
			input.unbindGamepad(pad, axis, "axes");
		}
	}
}

/** a short rumble on the pad in use (nothing happens without one) */
export function rumble(duration: number, strong: number, weak: number) {
	input.vibrateGamepad(input.activeGamepad(), {
		duration,
		strongMagnitude: strong,
		weakMagnitude: weak,
	});
}

/**
 * a click or a tap on the screen is that key, while the screen is up
 * (what input.bindPointer is for, but it loses its binding on the next
 * pointer event for now)
 */
export function bindTap(app: Application, key: number) {
	input.registerPointerEvent("pointerdown", app.viewport, () => {
		input.triggerKeyEvent(key, true);
	});
	input.registerPointerEvent("pointerup", app.viewport, () => {
		input.triggerKeyEvent(key, false);
	});
}

export function unbindTap(app: Application) {
	input.releasePointerEvent("pointerdown", app.viewport);
	input.releasePointerEvent("pointerup", app.viewport);
}
