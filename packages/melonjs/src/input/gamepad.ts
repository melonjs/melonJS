import {
	emit,
	GAME_BEFORE_UPDATE,
	GAMEPAD_CONNECTED,
	GAMEPAD_DISCONNECTED,
	GAMEPAD_UPDATE,
	has,
	on,
} from "../system/event.ts";
import { getBindingKey, triggerKeyEvent } from "./keyboard.ts";

interface GamepadMapping {
	axes: number[];
	buttons: number[];
	analog: number[];
	normalize_fn: (value: number, axis: number, button: number) => number;
}

interface ButtonBinding {
	keyCode: number;
	value: number;
	pressed: boolean;
	threshold?: number | undefined;
	/** the source the key was pressed with, to release it with the same */
	trigger?: number | undefined;
}

interface GamepadBindings {
	axes: Record<string, Record<number, ButtonBinding>>;
	buttons: Record<string, ButtonBinding>;
}

// Analog deadzone
let deadzone = 0.1;

/**
 * The pad that last did something, as a slot AND the id that was in it.
 *
 * Which pad the PLAYER is holding cannot be asked of the browser: slots are
 * handed out in plug order and a keyboard-shaped device, a wheel or a spare
 * pad left plugged in can sit in slot 0 for the whole session. The one thing
 * that does identify it is use, so this follows the last bound input.
 *
 * The id is kept beside the index because the index alone goes stale in the
 * one way that matters: a pad unplugged leaves its slot behind, and the next
 * device plugged in can be handed the same slot. Checking only that the slot
 * is occupied would then report a DIFFERENT pad as the active one, which is
 * the whole failure this is here to avoid.
 * @ignore
 * @internal
 */
let lastActiveIndex = -1;
/**
 * @ignore
 * @internal
 */
let lastActiveId = "";

// Match vendor and product codes for Firefox
const vendorProductRE = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i;

// Match leading zeros
const leadingZeroRE = /^0+/;

/**
 * Firefox reports different ids for gamepads depending on the platform:
 * - Windows: vendor and product codes contain leading zeroes
 * - Mac: vendor and product codes are sparse (no leading zeroes)
 *
 * This function normalizes the id to support both formats
 * @ignore
 * @internal
 */
function addMapping(id: string, mapping: Partial<GamepadMapping>): void {
	const expanded_id = id.replace(
		vendorProductRE,
		(_: string, a: string, b: string) => {
			return `${"000".slice(a.length - 1) + a}-${"000".slice(b.length - 1)}${b}-`;
		},
	);
	const sparse_id = id.replace(
		vendorProductRE,
		(_: string, a: string, b: string) => {
			return `${a.replace(leadingZeroRE, "")}-${b.replace(leadingZeroRE, "")}-`;
		},
	);

	// Normalize optional parameters
	mapping.analog =
		mapping.analog ||
		mapping.buttons!.map(() => {
			return -1;
		});
	mapping.normalize_fn =
		mapping.normalize_fn ||
		function (value: number) {
			return value;
		};

	remap.set(expanded_id, mapping as GamepadMapping);
	remap.set(sparse_id, mapping as GamepadMapping);
}

// binding list
const bindings: Record<string, GamepadBindings | undefined> = {};

// mapping list
const remap: Map<string, GamepadMapping> = new Map();

/**
 * A gamepad driven by code, such as the gamepad plugin's touch controls.
 * Added to a slot with `addVirtualGamepad`, it is read every frame like a
 * real pad there. Buttons and axes follow the standard layout and are
 * updated in place.
 * @ignore
 * @internal
 */
export interface VirtualGamepad {
	/** an identifier, as a real pad's `id` */
	readonly id: string;
	/**
	 * the buttons, indexed by {@link input.GAMEPAD}.BUTTONS. A button that is
	 * not there reads as released.
	 */
	readonly buttons: readonly {
		readonly pressed: boolean;
		readonly value: number;
	}[];
	/**
	 * the axes, indexed by {@link input.GAMEPAD}.AXES, each from -1 to 1. An
	 * axis that is not there is not read.
	 */
	readonly axes: readonly number[];
	/**
	 * what {@link input.vibrateGamepad} drives when the slot holds no real
	 * pad, such as one built on `navigator.vibrate`. Without it a vibration
	 * on the virtual pad does nothing.
	 */
	readonly vibrationActuator?: GamepadHapticActuator;
}

// virtual pads, by slot
const virtualGamepads: (VirtualGamepad | undefined)[] = [];

// Default gamepad mappings
(
	[
		// Firefox reports its own ids for pads it has no standard mapping for.
		// Only entries for hardware still in use are worth carrying: a remap is
		// consulted ONLY when `gamepad.mapping !== "standard"`, and every browser
		// now reports "standard" for the pads it knows, so these are a fallback
		// for old hardware and nothing else.
		[
			"54c-268-PLAYSTATION(R)3 Controller",
			{
				axes: [0, 1, 2, 3],
				buttons: [14, 13, 15, 12, 10, 11, 8, 9, 0, 3, 1, 2, 4, 6, 7, 5, 16],
			},
		],
		[
			"54c-5c4-Wireless Controller", // PS4 Controller
			{
				axes: [0, 1, 2, 3],
				buttons: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 12, 13],
			},
		],
	] as [string, Partial<GamepadMapping>][]
).forEach((value) => {
	addMapping(value[0], value[1]);
});

/**
 * A button that is not there reads as released
 * @ignore
 * @internal
 */
const RELEASED: Readonly<{ value: number; pressed: boolean }> = Object.freeze({
	value: 0,
	pressed: false,
});

/**
 * A button of a real pad, after its mapping, or null when the mapping has no
 * such button.
 * @ignore
 * @internal
 */
function readButton(
	gamepad: Gamepad,
	mapping: GamepadMapping | null,
	button: number,
): { value: number; pressed: boolean } | null {
	let mapped_button = button;
	let mapped_axis = -1;

	// Remap buttons if necessary
	if (mapping) {
		mapped_button = mapping.buttons[button];
		mapped_axis = mapping.analog[button];
		if (mapped_button < 0 && mapped_axis < 0) {
			// Button is not mapped
			return null;
		}
	}

	// Get mapped button
	let current: { value: number; pressed: boolean } =
		gamepad.buttons[mapped_button] || RELEASED;

	// Remap an axis to an analog button
	if (mapping && mapped_axis >= 0) {
		const value = mapping.normalize_fn(gamepad.axes[mapped_axis], -1, button);

		// Create a new object, because GamepadButton is read-only
		current = {
			value: value,
			pressed: current.pressed || Math.abs(value) >= deadzone,
		};
	}
	return current;
}

/**
 * An axis of a real pad, after its mapping, or undefined when the mapping
 * has no such axis or the pad does not report it.
 * @ignore
 * @internal
 */
function readAxis(
	gamepad: Gamepad,
	mapping: GamepadMapping | null,
	axis: number,
): number | undefined {
	let mapped_axis = axis;

	// Remap axes if necessary
	if (mapping) {
		mapped_axis = mapping.axes[axis];
		if (mapped_axis < 0) {
			// axe is not mapped
			return undefined;
		}
	}

	// retrieve the current value and normalize if necessary
	const value = gamepad.axes[mapped_axis];
	if (typeof value === "undefined") {
		return undefined;
	}
	return mapping ? mapping.normalize_fn(value, axis, -1) : value;
}

/**
 * Let go of a pressed binding, with the source it was pressed with
 * @ignore
 * @internal
 */
function release(binding: ButtonBinding): void {
	triggerKeyEvent(binding.keyCode, false, binding.trigger);
	binding.value = 0;
	binding.pressed = false;
}

/**
 * Let go of everything a slot holds pressed
 * @ignore
 * @internal
 */
function releaseAll(index: string): void {
	const binding = bindings[index];
	if (!binding) {
		return;
	}
	for (const button of Object.values(binding.buttons)) {
		if (button.pressed) {
			release(button);
		}
	}
	for (const axis of Object.values(binding.axes)) {
		for (const half of Object.values(axis)) {
			if (half.pressed) {
				release(half);
			}
		}
	}
}

/**
 * The pads the browser reports, as an array that is empty without the
 * Gamepad API
 * @ignore
 * @internal
 */
function browserGamepads(): readonly (Gamepad | null)[] {
	return hasGamepadApi() ? globalThis.navigator.getGamepads() : [];
}

/**
 * Every pad the game can read: the real ones, and the virtual ones, such as
 * on-screen controls, each on its own even when it shares a slot with a
 * real pad, as `updateGamepads` reads both. For a reader that wants the raw
 * button state, such as the UI focus.
 * @returns the pads, real first
 * @ignore
 * @internal
 */
export function readGamepads(): readonly (
	| Pick<Gamepad, "buttons" | "axes">
	| VirtualGamepad
	| null
)[] {
	const pads: (Pick<Gamepad, "buttons" | "axes"> | VirtualGamepad | null)[] = [
		...browserGamepads(),
	];
	for (const virtual of virtualGamepads) {
		if (virtual !== undefined) {
			pads.push(virtual);
		}
	}
	return pads;
}

/**
 * Whether the browser has the Gamepad API
 * @ignore
 * @internal
 */
function hasGamepadApi(): boolean {
	// typed as always there, which it is not outside a browser window
	return typeof globalThis.navigator?.getGamepads === "function";
}

/**
 * Update gamepad status
 *
 * A slot is read from the pad the browser reports in it and from the virtual
 * pad added to it, whichever has one: a button is pressed when either has it
 * pressed, and an axis takes the value furthest from rest. A real pad's
 * mapping applies to the real pad only, as a virtual pad is in the standard
 * layout already.
 * @ignore
 * @internal
 */
const updateGamepads = function (): void {
	const gamepads = browserGamepads();

	// Trigger button bindings
	Object.keys(bindings).forEach((index) => {
		const gamepad = gamepads[index as any] ?? null;
		const virtual = virtualGamepads[index as any];
		if (!gamepad && !virtual) {
			// the pad is gone: let go of what it held, or it stays pressed
			releaseAll(index);
			return;
		}

		let mapping: GamepadMapping | null = null;
		if (gamepad && gamepad.mapping !== "standard") {
			mapping = remap.get(gamepad.id) || null;
		}

		const binding = bindings[index];
		if (!binding) {
			return;
		}

		// the slot is known by its real pad when it has one, as
		// `activeGamepad` and the vibration calls see it
		const id = gamepad ? gamepad.id : (virtual?.id ?? "");

		// Iterate all buttons that have active bindings
		Object.keys(binding.buttons).forEach((button) => {
			const last = binding.buttons[button];

			const fromPad = gamepad ? readButton(gamepad, mapping, +button) : null;
			const fromVirtual = virtual ? virtual.buttons[+button] || RELEASED : null;
			let current = fromPad ?? fromVirtual;
			if (!current) {
				// Button is not mapped
				return;
			}
			if (fromPad && fromVirtual) {
				current = {
					value: Math.max(fromPad.value, fromVirtual.value),
					pressed: fromPad.pressed || fromVirtual.pressed,
				};
			}

			emit(GAMEPAD_UPDATE, index, "buttons", +button, current);

			// the trigger id: the raw index on a remapped real pad, the
			// standard one otherwise
			const mapped_button =
				mapping && fromPad ? mapping.buttons[+button] : +button;

			// Edge detection
			if (!last.pressed && current.pressed) {
				// No guard on the keycode here, unlike the axes path below: a
				// BUTTON binding only ever exists with a real one, because
				// `bindGamepad` refuses a keycode with no action and
				// `unbindGamepad` deletes the entry outright. An axis binding
				// can legitimately hold a zero, since binding one half auto
				// creates the other.
				lastActiveIndex = Number(index);
				lastActiveId = id;
				last.trigger = mapped_button + 256;
				triggerKeyEvent(last.keyCode, true, last.trigger);
			} else if (last.pressed && !current.pressed) {
				release(last);
			}

			// Update last button state
			last.value = current.value;
			last.pressed = current.pressed;
		});

		// Iterate all axes that have active bindings
		Object.keys(binding.axes).forEach((axis) => {
			const last = binding.axes[axis];

			const fromPad = gamepad ? readAxis(gamepad, mapping, +axis) : undefined;
			const fromVirtual = virtual ? virtual.axes[+axis] : undefined;
			let value: number;
			if (fromPad !== undefined && fromVirtual !== undefined) {
				value =
					Math.abs(fromVirtual) > Math.abs(fromPad) ? fromVirtual : fromPad;
			} else if (fromPad !== undefined) {
				value = fromPad;
			} else if (fromVirtual !== undefined) {
				value = fromVirtual;
			} else {
				// axis is not mapped, or not reported
				return;
			}

			const mapped_axis =
				mapping && fromPad !== undefined ? mapping.axes[+axis] : +axis;

			// normalize value into a [-1, 1] range value (treat 0 as positive)
			let range: number = Math.sign(value) || 1;
			// a half bound to no key never presses, but the stick crossing
			// into it still lets go of the other half: a stick released hard
			// often comes to rest just past the centre
			const bound = last[range].keyCode !== 0;
			const pressed =
				bound &&
				Math.abs(value) >= deadzone + Math.abs(last[range].threshold || 0);

			if (bound) {
				emit(GAMEPAD_UPDATE, index, "axes", +axis, value as any);
			}

			// Edge detection
			if (!last[range].pressed && pressed) {
				// Release the opposite direction, if necessary
				if (last[-range].pressed) {
					release(last[-range]);
				}

				lastActiveIndex = Number(index);
				lastActiveId = id;
				last[range].trigger = mapped_axis + 256;
				triggerKeyEvent(last[range].keyCode, true, last[range].trigger);
			} else if ((last[range].pressed || last[-range].pressed) && !pressed) {
				range = last[range].pressed ? range : -range;
				release(last[range]);
			}

			// Update last axis state
			last[range].value = value;
			last[range].pressed = pressed;
		});
	});
};

// gamepad connected callback
if (hasGamepadApi()) {
	globalThis.addEventListener(
		"gamepadconnected",
		(e: GamepadEvent) => {
			emit(GAMEPAD_CONNECTED, e.gamepad);
		},
		false,
	);

	/*
	 * gamepad disconnected callback
	 */
	globalThis.addEventListener(
		"gamepaddisconnected",
		(e: GamepadEvent) => {
			emit(GAMEPAD_DISCONNECTED, e.gamepad);
		},
		false,
	);
}

/*
 * PUBLIC STUFF
 */

/**
 * Namespace for standard gamepad mapping constants
 */
export const GAMEPAD = {
	/**
	 * Standard gamepad mapping information for axes<br>
	 * <ul>
	 *   <li>Left control stick: <code>LX</code> (horizontal), <code>LY</code> (vertical)</li>
	 *   <li>Right control stick: <code>RX</code> (horizontal), <code>RY</code> (vertical)</li>
	 *   <li>Extras: <code>EXTRA_1</code>, <code>EXTRA_2</code>, <code>EXTRA_3</code>, <code>EXTRA_4</code></li>
	 * </ul>
	 * @see {@link https://w3c.github.io/gamepad/#remapping}
	 */
	AXES: {
		LX: 0,
		LY: 1,
		RX: 2,
		RY: 3,
		EXTRA_1: 4,
		EXTRA_2: 5,
		EXTRA_3: 6,
		EXTRA_4: 7,
	},

	/**
	 * Standard gamepad mapping information for buttons<br>
	 * <ul>
	 *   <li>Face buttons: <code>FACE_1</code>, <code>FACE_2</code>, <code>FACE_3</code>, <code>FACE_4</code></li>
	 *   <li>D-Pad: <code>UP</code>, <code>DOWN</code>, <code>LEFT</code>, <code>RIGHT</code></li>
	 *   <li>Shoulder buttons: <code>L1</code>, <code>L2</code>, <code>R1</code>, <code>R2</code></li>
	 *   <li>Analog stick (clicks): <code>L3</code>, <code>R3</code></li>
	 *   <li>Navigation: <code>SELECT</code> (<code>BACK</code>), <code>START</code> (<code>FORWARD</code>), <code>HOME</code></li>
	 *   <li>Extras: <code>EXTRA_1</code>, <code>EXTRA_2</code>, <code>EXTRA_3</code>, <code>EXTRA_4</code></li>
	 * </ul>
	 * @see {@link https://w3c.github.io/gamepad/#remapping}
	 */
	BUTTONS: {
		FACE_1: 0,
		FACE_2: 1,
		FACE_3: 2,
		FACE_4: 3,
		L1: 4,
		R1: 5,
		L2: 6,
		R2: 7,
		SELECT: 8,
		BACK: 8,
		START: 9,
		FORWARD: 9,
		L3: 10,
		R3: 11,
		UP: 12,
		DOWN: 13,
		LEFT: 14,
		RIGHT: 15,
		HOME: 16,
		EXTRA_1: 17,
		EXTRA_2: 18,
		EXTRA_3: 19,
		EXTRA_4: 20,
	},
} as const;

/**
 * Associate a gamepad event to a keycode
 * @param index - Gamepad index
 * @param button - Button/Axis definition
 * @param button.type - "buttons" or "axes"
 * @param button.code - button or axis code id
 * @param button.threshold - how far past the deadzone the axis must travel to
 * trigger the keycode. It is ADDED to {@link input.setGamepadDeadzone}, it does
 * not replace it, so with the default deadzone of 0.1 a threshold of 0.5 fires
 * at 0.6 of full deflection. Its SIGN picks the half of the axis to watch:
 * negative for left/up, positive for right/down, and the two halves are bound
 * separately. Ignored for `"buttons"`, which take the browser's own pressed
 * state; the deadzone reaches a button only where a non-standard mapping
 * routes an axis onto one through its `analog` array.
 * @param keyCode - (See {@link input.KEY})
 * @throws {Error} if `keyCode` has no action bound to it yet — call
 * {@link input.bindKey} first.
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * ...
 * // map the lower face button on the first gamepad to the X key
 * me.input.bindGamepad(0, {type:"buttons", code: me.input.GAMEPAD.BUTTONS.FACE_1}, me.input.KEY.X);
 * // map the left half of the stick to LEFT, firing at 0.6 of full travel
 * // (0.1 deadzone + 0.5 threshold), and the right half to RIGHT
 * me.input.bindGamepad(0, {type:"axes", code: me.input.GAMEPAD.AXES.LX, threshold: -0.5}, me.input.KEY.LEFT);
 * me.input.bindGamepad(0, {type:"axes", code: me.input.GAMEPAD.AXES.LX, threshold: 0.5}, me.input.KEY.RIGHT);
 * @category Input
 */
export function bindGamepad(
	index: number,
	button: { type: "buttons" | "axes"; code: number; threshold?: number },
	keyCode: number,
): void {
	// Throw an exception if no action is defined for the specified keycode
	if (!getBindingKey(keyCode)) {
		throw new Error(`no action defined for keycode ${keyCode}`);
	}

	// register to the update event if not yet done. Without the Gamepad API
	// the loop still runs, for the virtual pads, and finds no real ones
	if (!has(GAME_BEFORE_UPDATE, updateGamepads)) {
		on(GAME_BEFORE_UPDATE, updateGamepads);
	}

	// Allocate bindings if not defined
	if (!bindings[index]) {
		bindings[index] = {
			axes: {},
			buttons: {},
		};
	}

	const mapping: ButtonBinding = {
		keyCode: keyCode,
		value: 0,
		pressed: false,
		threshold: button.threshold, // can be undefined
	};
	const binding = bindings[index][button.type] as any;

	// Map the gamepad button or axis to the keycode
	if (button.type === "buttons") {
		// buttons are defined by a `gamePadButton` object
		binding[button.code] = mapping;
	} else if (button.type === "axes") {
		// normalize threshold into a value that can represent both side of the axis
		const range = Math.sign(button.threshold!) || 1;
		// axes are defined using two objects; one for negative and one for positive
		if (!binding[button.code]) {
			binding[button.code] = {};
		}
		const axes = binding[button.code];
		axes[range] = mapping;

		// Ensure the opposite axis exists
		if (!axes[-range]) {
			axes[-range] = {
				keyCode: 0,
				value: 0,
				pressed: false,
				threshold: -range,
			};
		}
	}
}

/**
 * unbind the defined keycode
 *
 * Takes the `type` the binding was made with, because a button code and an
 * axis code are both small integers from different sets and they collide:
 * `GAMEPAD.AXES.LX` and `GAMEPAD.BUTTONS.FACE_1` are both 0. Without it an
 * axis could not be unbound at all, and asking for one by its code removed
 * whatever button happened to share the number.
 * @param index - Gamepad index
 * @param button - (See {@link input.GAMEPAD})
 * @param type - which table the binding is in, `"buttons"` by default
 * @example
 * me.input.unbindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1);
 * me.input.unbindGamepad(0, me.input.GAMEPAD.AXES.LX, "axes");
 * @category Input
 */
export function unbindGamepad(
	index: number,
	button: number,
	type: "buttons" | "axes" = "buttons",
): void {
	if (!bindings[index]) {
		throw new Error(`no bindings for gamepad ${index}`);
	}
	// deleted rather than overwritten with an empty object: a binding left
	// behind with no keycode still answers the poll, which made an unbound
	// button go on marking its pad as the active one
	delete bindings[index][type][button];
}

/**
 * Set deadzone for analog gamepad inputs<br>
 * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
 *
 * For axes it is the floor that a binding's own `threshold` is added to: one
 * bound with `threshold: 0.5` under this default fires at 0.6, so raising it
 * moves every axis binding with it. An ordinary button never consults it at
 * all, since its pressed state comes from the browser; it reaches a button
 * only where a non-standard mapping routes an axis onto one through its
 * `analog` array.
 * @param value - Deadzone value
 * @see {@link input.bindGamepad}
 * @category Input
 */
export function setGamepadDeadzone(value: number): void {
	deadzone = value;
}

/**
 * specify a custom mapping for a specific gamepad id<br>
 * see below for the default mapping : <br>
 * <center><img src="images/gamepad_diagram.png"/></center><br>
 * @param id - Gamepad id string
 * @param mapping - A hash table
 * @example
 * // A weird controller that has its axis mappings reversed
 * me.input.setGamepadMapping("Generic USB Controller", {
 *   "axes" : [ 3, 2, 1, 0 ],
 *   "buttons" : [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ]
 * });
 *
 * // Mapping extra axes to analog buttons
 * me.input.setGamepadMapping("Generic Analog Controller", {
 *   "axes" : [ 0, 1, 2, 3 ],
 *   "buttons" : [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ],
 *
 *   // Raw axis 4 is mapped to GAMEPAD.BUTTONS.FACE_1
 *   // Raw axis 5 is mapped to GAMEPAD.BUTTONS.FACE_2
 *   // etc...
 *   // Also maps left and right triggers
 *   "analog" : [ 4, 5, 6, 7, -1, -1, 8, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
 *
 *   // Normalize the value of button L2: [-1.0..1.0] => [0.0..1.0]
 *   "normalize_fn" : function (value, axis, button) {
 *     return ((button === me.input.GAMEPAD.BUTTONS.L2) ? ((value + 1) / 2) : value) || 0;
 *   }
 * });
 */
export const setGamepadMapping: (
	id: string,
	mapping: Partial<GamepadMapping>,
) => void = addMapping;

/**
 * Options for {@link input.vibrateGamepad}.
 * @category Input
 */
export interface GamepadVibration {
	/** how long the effect runs, milliseconds */
	duration?: number;
	/** the heavy, low-frequency motor, `0` to `1` */
	strongMagnitude?: number;
	/** the light, high-frequency motor, `0` to `1` */
	weakMagnitude?: number;
	/** how long to wait before it starts, milliseconds */
	startDelay?: number;
	/** left trigger motor, `0` to `1`. `"trigger-rumble"` only */
	leftTrigger?: number;
	/** right trigger motor, `0` to `1`. `"trigger-rumble"` only */
	rightTrigger?: number;
	/**
	 * Which effect to play. `"dual-rumble"` is the one every haptic pad
	 * supports; `"trigger-rumble"` drives the motors inside the triggers and
	 * is not widely implemented.
	 */
	type?: GamepadHapticEffectType;
}

/**
 * The pad in each slot: the one the browser reports, else the virtual pad
 * added there. Undefined where the browser has no Gamepad API and no virtual
 * pad was added.
 *
 * `vibrationActuator` is restated as OPTIONAL here. lib.dom declares it
 * always present, which is optimistic: a pad without motors does not have
 * one, and narrowing through a plain annotation would make the runtime check
 * for it dead in the type system while it is very much alive at run time.
 * @ignore
 * @internal
 */
function gamepads():
	| readonly ({
			readonly id: string;
			readonly vibrationActuator?: GamepadHapticActuator | undefined;
	  } | null)[]
	| undefined {
	if (virtualGamepads.length === 0) {
		return hasGamepadApi() ? globalThis.navigator.getGamepads() : undefined;
	}
	const real = browserGamepads();
	const slots = [];
	const count = Math.max(real.length, virtualGamepads.length);
	for (let i = 0; i < count; i++) {
		slots.push(real[i] ?? virtualGamepads[i] ?? null);
	}
	return slots;
}

/**
 * Put a virtual gamepad in a slot, for the gamepad plugin. A real pad in the
 * same slot is still read: a button is pressed when either has it pressed.
 * No GAMEPAD_CONNECTED is sent for it, so that event stays about hardware.
 * @param gamepad - the virtual pad
 * @param [index=0] - the slot
 * @throws {RangeError} if the index is not a slot number
 * @throws {Error} if the slot already holds a virtual pad, or the pad is
 * already in a slot
 * @ignore
 * @internal
 */
export function addVirtualGamepad(gamepad: VirtualGamepad, index = 0): void {
	if (!Number.isInteger(index) || index < 0) {
		throw new RangeError(`invalid gamepad index ${index}`);
	}
	if (virtualGamepads[index]) {
		throw new Error(`gamepad ${index} already holds a virtual gamepad`);
	}
	if (virtualGamepads.includes(gamepad)) {
		throw new Error("this virtual gamepad is already in a slot");
	}
	virtualGamepads[index] = gamepad;
}

/**
 * Take a virtual gamepad out of its slot. What it held is released on the
 * next frame, as when a real pad is unplugged.
 * @param gamepad - the virtual pad
 * @returns false when it was not in any slot
 * @ignore
 * @internal
 */
export function removeVirtualGamepad(gamepad: VirtualGamepad): boolean {
	const index = virtualGamepads.indexOf(gamepad);
	if (index < 0) {
		return false;
	}
	virtualGamepads[index] = undefined;
	// drop the empty slots at the end, so no virtual pad means none at all
	while (
		virtualGamepads.length > 0 &&
		virtualGamepads[virtualGamepads.length - 1] === undefined
	) {
		virtualGamepads.length--;
	}
	return true;
}

/**
 * The haptic hardware on a pad, or undefined when there is none to drive.
 *
 * Read fresh every call rather than cached: `navigator.getGamepads()` returns
 * new objects as the browser sees fit, and a pad unplugged and plugged back in
 * is a different object in the same slot. `vibrationActuator` is typed as
 * always present but is absent on a pad without motors, and present without a
 * usable `playEffect` on older implementations, so both are checked.
 * @ignore
 * @internal
 */
function vibrationActuatorOf(index: number): GamepadHapticActuator | undefined {
	const pad = gamepads()?.[index];
	if (!pad) {
		return undefined;
	}
	const actuator = pad.vibrationActuator;
	// `playEffect` as well as the actuator itself: an older implementation
	// can expose the object without the method
	if (!actuator || typeof actuator.playEffect !== "function") {
		return undefined;
	}
	return actuator;
}

/**
 * Whether the pad at this index can vibrate.
 *
 * For deciding what to OFFER — a rumble toggle in an options screen, say.
 * Nothing needs to call it before {@link input.vibrateGamepad}, which is a
 * no-op on a pad without motors.
 * @param index - Gamepad index
 * @returns true when there is haptic hardware to drive
 * @category Input
 */
export function hasGamepadVibration(index: number): boolean {
	return vibrationActuatorOf(index) !== undefined;
}

/**
 * Vibrate a gamepad.
 *
 * Safe to call blind: with no pad in that slot, no motors, or a browser
 * without the Gamepad API at all, it resolves `false` and does nothing. That
 * is the whole error path, so game code never has to branch on support.
 *
 * Magnitudes default to FULL, unlike the underlying web API where every
 * parameter defaults to zero and a bare `playEffect("dual-rumble")` is a
 * silent no-op. `vibrateGamepad(0)` vibrates.
 *
 * A second call preempts the first on the same pad, which is what makes a
 * rapid series of hits read as a rapid series of hits rather than a queue.
 * That is for DISTINCT events: a sustained rumble should be one effect with
 * a long `duration`, not a call per frame, which would spend a promise and a
 * preempted effect every frame to produce one continuous one.
 * @param index - Gamepad index
 * @param options - how hard and how long; see {@link GamepadVibration}
 * @returns whether the effect ran to completion. `false` covers unsupported,
 * preempted by a later call, and rejected by the device alike — a rumble is
 * feedback, and nothing sensible branches on which of those happened.
 * @example
 * // a short, sharp knock
 * input.vibrateGamepad(0, { duration: 90, strongMagnitude: 0.4, weakMagnitude: 0.8 });
 * // and a long heavy one for something big
 * input.vibrateGamepad(0, { duration: 600, strongMagnitude: 1, weakMagnitude: 0.5 });
 * @category Input
 */
export function vibrateGamepad(
	index: number,
	options: GamepadVibration = {},
): Promise<boolean> {
	const actuator = vibrationActuatorOf(index);
	if (actuator === undefined) {
		return Promise.resolve(false);
	}
	const { type = "dual-rumble", ...params } = options;
	return actuator
		.playEffect(type, {
			duration: 200,
			strongMagnitude: 1,
			weakMagnitude: 1,
			...params,
		})
		.then((result) => result === "complete")
		.catch(() => false);
}

/**
 * Stop whatever a gamepad is currently playing.
 *
 * For cutting a long effect short — the player pausing, or a run ending under
 * a rumble that would otherwise outlive it. A no-op where there is nothing to
 * stop.
 * @param index - Gamepad index
 * @category Input
 */
export function stopGamepadVibration(index: number): void {
	const actuator = vibrationActuatorOf(index);
	if (actuator !== undefined && typeof actuator.reset === "function") {
		// the rejection is ignored on purpose: asking a device that is gone to
		// stop is already the outcome wanted
		actuator.reset().catch(() => undefined);
	}
}

/**
 * The index of the pad the player is actually using.
 *
 * Slots are handed out in plug order, so index 0 is a guess rather than an
 * answer: a wheel, a spare pad or a keyboard-shaped device left plugged in
 * can hold slot 0 for a whole session while the player presses buttons on
 * slot 1. Nothing in the browser reports which is "the" controller, and the
 * one thing that identifies it is use.
 *
 * So this reports the last pad to produce a BOUND input, falling back to the
 * first connected one before anything has been pressed, and to -1 when there
 * is no pad at all. Pass it wherever an index is wanted —
 * {@link input.vibrateGamepad} most of all, since rumbling the wrong pad is
 * both useless and impossible to notice in testing.
 *
 * It follows bound inputs only, which is what makes it an answer about the
 * player rather than about electrical noise: a resting stick on a worn pad
 * reports movement for ever, and would otherwise claim to be the active one.
 * @returns the gamepad index, or -1 when no gamepad is connected
 * @example
 * // rumble whichever pad the player is holding
 * input.vibrateGamepad(input.activeGamepad(), { duration: 120 });
 * @category Input
 */
export function activeGamepad(): number {
	const pads = gamepads();
	if (pads === undefined) {
		return -1;
	}
	// Still the active one only while the SAME pad is still in that slot. A
	// pad that was unplugged leaves its index behind and the next device
	// plugged in can be handed it, so an index on its own would go on
	// reporting a slot that now holds something else.
	if (lastActiveIndex >= 0 && pads[lastActiveIndex]?.id === lastActiveId) {
		return lastActiveIndex;
	}
	for (let i = 0; i < pads.length; i++) {
		if (pads[i]) {
			return i;
		}
	}
	return -1;
}
