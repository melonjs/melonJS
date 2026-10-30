import { input } from "melonjs";

/**
 * melonJS's hook for a gamepad driven by code, which is internal to the
 * engine (src/input/gamepad.ts) and so not in its type definitions
 */
interface VirtualGamepadHook {
	addVirtualGamepad(pad: VirtualPad, index: number): void;
	removeVirtualGamepad(pad: VirtualPad): boolean;
}

export const virtualGamepads = input as unknown as VirtualGamepadHook;

/** a button of the pad, written as the controls are pressed */
export interface PadButton {
	pressed: boolean;
	value: number;
}

/** the standard layout: 17 buttons and 4 axes */
const BUTTON_COUNT = 17;
const AXIS_COUNT = 4;

/**
 * Plays a rumble on the phone through `navigator.vibrate`, which has one
 * motor and no strength: the effect runs for its duration, or not at all
 * when both magnitudes are 0.
 */
class PhoneVibration {
	private pending: ((result: GamepadHapticsResult) => void) | null = null;
	private timer: ReturnType<typeof setTimeout> | undefined;

	playEffect(
		_type: GamepadHapticEffectType,
		params: GamepadEffectParameters = {},
	): Promise<GamepadHapticsResult> {
		// a new effect cuts the one playing short, as on a pad
		this.settle("preempted");
		navigator.vibrate(0);
		const {
			duration = 0,
			startDelay = 0,
			strongMagnitude = 0,
			weakMagnitude = 0,
		} = params;
		if (duration <= 0 || (strongMagnitude <= 0 && weakMagnitude <= 0)) {
			return Promise.resolve("complete");
		}
		return new Promise((resolve) => {
			this.pending = resolve;
			this.timer = setTimeout(() => {
				navigator.vibrate(duration);
				this.timer = setTimeout(() => {
					this.settle("complete");
				}, duration);
			}, startDelay);
		});
	}

	reset(): Promise<GamepadHapticsResult> {
		this.settle("preempted");
		navigator.vibrate(0);
		return Promise.resolve("complete");
	}

	private settle(result: GamepadHapticsResult): void {
		clearTimeout(this.timer);
		this.timer = undefined;
		const pending = this.pending;
		this.pending = null;
		pending?.(result);
	}
}

/**
 * The pad the controls write to. In its gamepad slot, the engine reads it
 * every frame as it reads a real pad.
 */
export class VirtualPad {
	readonly id = "melonJS virtual gamepad (STANDARD GAMEPAD)";
	readonly buttons: PadButton[];
	readonly axes: number[];
	readonly vibrationActuator?: GamepadHapticActuator;

	constructor(vibrate: boolean) {
		this.buttons = Array.from({ length: BUTTON_COUNT }, () => {
			return { pressed: false, value: 0 };
		});
		this.axes = new Array<number>(AXIS_COUNT).fill(0);
		if (vibrate && typeof navigator.vibrate === "function") {
			this.vibrationActuator = new PhoneVibration();
		}
	}

	/**
	 * press or release a button
	 * @param button - from `input.GAMEPAD.BUTTONS`
	 * @param pressed - whether it is held
	 */
	setButton(button: number, pressed: boolean): void {
		const state = this.buttons[button] as PadButton | undefined;
		if (state) {
			state.pressed = pressed;
			state.value = pressed ? 1 : 0;
		}
	}

	/** let go of every button and center every axis */
	reset(): void {
		for (const button of this.buttons) {
			button.pressed = false;
			button.value = 0;
		}
		this.axes.fill(0);
	}
}
