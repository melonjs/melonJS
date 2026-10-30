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
 * A stick of the virtual gamepad.
 * @category Plugins
 */
export interface StickOptions {
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
	 * the stick is centered where the thumb lands on its half of the screen,
	 * rather than at a fixed spot. Off by default.
	 */
	floating?: boolean;
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
	 * how far the stick must lean, from 0 to 1, to press the D-pad and its
	 * `keys`. 0.5 by default: half the thumb's travel.
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
}

/**
 * Options for {@link GamepadPlugin}.
 * @category Plugins
 */
export interface GamepadPluginOptions {
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
}
