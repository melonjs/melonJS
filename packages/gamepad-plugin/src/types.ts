import type { TextureAtlas } from "melonjs";

/**
 * Where a control sits: the distance from its center to the edges of the
 * viewport, in viewport pixels. Give one of `left` / `right` and one of
 * `top` / `bottom`; the control keeps that distance when the viewport is
 * resized or turned.
 * @category Plugins
 */
export interface Placement {
	left?: number;
	right?: number;
	top?: number;
	bottom?: number;
}

/**
 * Keys a stick presses as it leans, from {@link input.KEY}.
 * @category Plugins
 */
export interface StickKeys {
	up?: number;
	down?: number;
	left?: number;
	right?: number;
}

/**
 * Where a floating stick or button can be picked up: `"half"`, its half
 * of the screen; `"screen"`, anywhere; or a rectangle, in viewport pixels.
 *
 * Where areas overlap, a finger landing takes the first control free
 * there: fixed buttons, fixed sticks, floating buttons, floating sticks.
 * Floating buttons sharing an area split it: the finger goes to the one
 * resting nearest to it.
 * @category Plugins
 */
export type ControlArea =
	| "half"
	| "screen"
	| { x: number; y: number; width: number; height: number };

/**
 * What a quick tap on a stick presses: see {@link StickOptions.tap}.
 * @category Plugins
 */
export interface StickTap {
	/**
	 * the pad button it presses, from `GAMEPAD.BUTTONS`; `FACE_1` by
	 * default, or none when a `key` is given; `null` for none
	 */
	button?: number | null;
	/** a key to press, instead of a pad button unless `button` is also given */
	key?: number;
	/**
	 * the longest a touch can last and still be a tap, in milliseconds.
	 * 250 by default.
	 */
	time?: number;
}

/**
 * A stick of the virtual gamepad.
 * @category Plugins
 */
export interface StickOptions {
	/** the base region in the plugin's `skin` atlas; shapes when omitted */
	base?: string;
	/** the thumb region in the plugin's `skin` atlas; a circle when omitted */
	thumb?: string;
	/**
	 * which stick of a pad it is: `"left"` reports `GAMEPAD.AXES.LX`/`LY`,
	 * `"right"` reports `RX`/`RY`. The first stick is the left one, the
	 * second the right one.
	 */
	side?: "left" | "right";
	/** where its center sits; the bottom corner on its side by default */
	position?: Placement;
	/** the radius of its base, in viewport pixels */
	radius?: number;
	/**
	 * the stick is centered where the thumb lands inside its `area`, rather
	 * than at a fixed spot, and goes back to its `position` when let go. Off
	 * by default.
	 */
	floating?: boolean;
	/**
	 * where a floating stick can be picked up: `"half"` (the default), its
	 * half of the screen; `"screen"`, anywhere; or a rectangle
	 * `{ x, y, width, height }` in viewport pixels. Buttons and fixed sticks
	 * come first where they overlap it (see {@link ControlArea}). Ignored for
	 * a fixed stick.
	 */
	area?: ControlArea;
	/**
	 * draw a floating stick only while a finger holds it, so it appears
	 * under the thumb and is gone when the thumb lifts. Off by default: it
	 * rests in its corner, to show where it is. Ignored for a fixed stick.
	 */
	hideAtRest?: boolean;
	/**
	 * make a quick tap on the stick press a button or a key, as a button
	 * would: a touch that lifts within `time` and never leans far enough to
	 * press a direction (`dpadThreshold`) is a tap; a cancelled touch is
	 * not. The press lasts one frame, so a locked key fires once, and a
	 * fading ring marks where the tap landed. With a floating stick over the
	 * whole screen (`area: "screen"`), tap anywhere to act, drag to steer,
	 * and no button is needed. Off by default.
	 */
	tap?: StickTap;
	/**
	 * how far the stick must lean, from 0 to 1, before it reads anything.
	 * Past it the reading starts from 0, so it still reaches 1 at full
	 * travel. 0.1 by default, as `input.setGamepadDeadzone`.
	 */
	deadzone?: number;
	/**
	 * also press the D-pad buttons (`GAMEPAD.BUTTONS.UP`, `DOWN`, `LEFT`,
	 * `RIGHT`) in 8 directions as the stick leans. On by default for the left
	 * stick.
	 */
	dpad?: boolean;
	/**
	 * how far the thumb must travel, from 0 to 1, to press the D-pad and its
	 * `keys`. 0.5 by default: half way.
	 */
	dpadThreshold?: number;
	/**
	 * keys to press, as the D-pad would, for a game that reads the keyboard
	 * rather than a pad
	 */
	keys?: StickKeys;
}

/**
 * A button of the virtual gamepad.
 * @category Plugins
 */
export interface ButtonOptions {
	/** the region in the plugin's `skin` atlas; shapes when omitted */
	region?: string;
	/**
	 * the region while held. When omitted, the resting region is drawn slightly
	 * smaller while held (and brighter, while the opacity leaves room)
	 */
	pressed?: string;
	/**
	 * the pad button it presses, from `input.GAMEPAD.BUTTONS`. The buttons
	 * press `FACE_1`, `FACE_2`, `FACE_3` and `FACE_4` in turn by default, or
	 * no pad button when a `key` is given. `null` for none.
	 */
	button?: number | null;
	/**
	 * a key to press, from `input.KEY`, for a game that reads the keyboard
	 * rather than a pad
	 */
	key?: number;
	/** the text shown on it, such as `"A"` or `"Jump"` */
	label?: string;
	/** where its center sits; the buttons gather in the bottom-right corner by default */
	position?: Placement;
	/** its radius, in viewport pixels */
	radius?: number;
	/**
	 * the button is pressed wherever a finger lands inside its `area`, and
	 * drawn under that finger while held, rather than at a fixed spot. It
	 * rests at its `position`. Off by default.
	 */
	floating?: boolean;
	/**
	 * where a floating button can be pressed: `"half"` (the default), the
	 * half of the screen its `position` is on; `"screen"`, anywhere; or a
	 * rectangle `{ x, y, width, height }` in viewport pixels. Fixed controls
	 * come first where they overlap it, and floating buttons sharing an
	 * area split it by distance to where each rests (see
	 * {@link ControlArea}). Ignored for a fixed button.
	 */
	area?: ControlArea;
	/**
	 * draw a floating button only while a finger holds it; let go, it fades
	 * out where it was. Off by default: it rests at its `position`, to show
	 * it is there. Ignored for a fixed button.
	 */
	hideAtRest?: boolean;
}

/**
 * Options for {@link GamepadPlugin}.
 * @category Plugins
 */
export interface GamepadPluginOptions {
	/**
	 * an already-loaded atlas for the controls' named regions. Regions are
	 * scaled to each control's size; positions and hit areas are unchanged.
	 * Omitted regions keep their shapes. Atlas colors are preserved.
	 */
	skin?: TextureAtlas;
	/**
	 * whether the controls are shown, `device.touch` by default: on a phone
	 * or a tablet, and not on a desktop. Can be changed at any time through
	 * {@link GamepadPlugin#enabled}.
	 */
	enabled?: boolean;
	/** the gamepad slot the controls report in, 0 by default */
	index?: number;
	/** how many sticks (0 to 2), or each one's options; one by default */
	sticks?: number | StickOptions[];
	/** how many buttons, or each one's options; one by default */
	buttons?: number | ButtonOptions[];
	/**
	 * hide the controls while the player uses a real gamepad, and show them
	 * again when it is unplugged or the screen is touched. On by default.
	 */
	hideOnGamepad?: boolean;
	/** the color of the controls, white by default */
	color?: string;
	/** how opaque the controls are at rest, 0.35 by default; a press doubles it */
	opacity?: number;
	/**
	 * the space kept between the controls and the edges of the viewport, in
	 * viewport pixels. A fraction of the viewport's shorter side by default.
	 */
	margin?: number;
	/**
	 * let `input.vibrateGamepad` vibrate the phone, where the browser can
	 * (`navigator.vibrate`). On by default.
	 */
	vibrate?: boolean;
	/**
	 * how long the phone vibrates when a button is pressed, in milliseconds,
	 * for the feel of a real button. 10 by default, a light tick; 0 for none.
	 * Where the browser supports it (`navigator.vibrate`).
	 */
	haptics?: number;
}
