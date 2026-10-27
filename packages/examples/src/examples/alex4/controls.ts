/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { input } from "melonjs";

const ACTIONS = [
	"left",
	"right",
	"up",
	"down",
	"jump",
	"fire",
	"enter",
	"escape",
	"pause",
] as const;
export type Action = (typeof ACTIONS)[number];

/** bind the keyboard and the first gamepad */
export function bindControls() {
	const K = input.KEY;
	const keys: [number, Action][] = [
		[K.LEFT, "left"],
		[K.A, "left"],
		[K.RIGHT, "right"],
		[K.D, "right"],
		[K.UP, "up"],
		[K.W, "up"],
		[K.DOWN, "down"],
		[K.S, "down"],
		// the original used Alt to jump and Ctrl to spit
		[K.X, "jump"],
		[K.SPACE, "jump"],
		[K.Z, "fire"],
		[K.C, "fire"],
		[K.CTRL, "fire"],
		[K.ENTER, "enter"],
		[K.ESC, "escape"],
		[K.P, "pause"],
	];
	for (const [key, action] of keys) {
		input.bindKey(key, action);
	}
	const B = input.GAMEPAD.BUTTONS;
	const pad: [number, number][] = [
		[B.LEFT, K.LEFT],
		[B.RIGHT, K.RIGHT],
		[B.UP, K.UP],
		[B.DOWN, K.DOWN],
		[B.FACE_1, K.X],
		[B.FACE_2, K.Z],
		[B.FACE_3, K.Z],
		[B.START, K.ENTER],
		[B.SELECT, K.ESC],
	];
	for (const [button, key] of pad) {
		input.bindGamepad(0, { type: "buttons", code: button }, key);
	}
	input.bindGamepad(
		0,
		{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: -0.5 },
		K.LEFT,
	);
	input.bindGamepad(
		0,
		{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: 0.5 },
		K.RIGHT,
	);
}

const previous = new Map<Action, boolean>();

/** true on the frame an action goes from released to pressed */
export function justPressed(action: Action) {
	const now = input.isKeyPressed(action);
	const was = previous.get(action) ?? true;
	previous.set(action, now);
	return now && !was;
}

/** true when any of the "confirm" actions was just pressed */
export function confirmPressed() {
	// evaluate all of them so their state stays in sync
	const a = justPressed("enter");
	const b = justPressed("jump");
	const c = justPressed("fire");
	return a || b || c;
}

/** treat every currently held key as already seen (call on screen change) */
export function syncControls() {
	for (const action of ACTIONS) {
		previous.set(action, input.isKeyPressed(action));
	}
}
