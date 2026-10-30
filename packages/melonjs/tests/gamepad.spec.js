import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { event, input } from "../src/index.js";

/**
 * A pad that is not there at all, a pad with no motors, and a pad with
 * motors: the three cases every haptics call has to survive.
 */
const padWithoutMotors = () => {
	return {
		index: 0,
		id: "No Rumble Pad (STANDARD GAMEPAD)",
		mapping: "standard",
		connected: true,
		timestamp: 0,
		buttons: Array.from({ length: 17 }, () => {
			return { pressed: false, value: 0 };
		}),
		axes: [0, 0, 0, 0],
	};
};

const padWithMotors = (result = "complete") => {
	const pad = padWithoutMotors();
	pad.id = "Rumble Pad (STANDARD GAMEPAD)";
	pad.vibrationActuator = {
		playEffect: vi.fn(() => {
			return Promise.resolve(result);
		}),
		reset: vi.fn(() => {
			return Promise.resolve("complete");
		}),
	};
	return pad;
};

describe("Gamepad", () => {
	let realGetGamepads;
	/** what `navigator.getGamepads()` hands back for the duration of a test */
	let pads;

	beforeEach(() => {
		realGetGamepads = navigator.getGamepads;
		pads = [null, null, null, null];
		navigator.getGamepads = () => {
			return pads;
		};
	});

	afterEach(() => {
		navigator.getGamepads = realGetGamepads;
	});

	describe("vibration", () => {
		it("reports no vibration when the slot is empty", () => {
			expect(input.hasGamepadVibration(0)).toBe(false);
		});

		it("reports no vibration when the pad has no motors", () => {
			pads[0] = padWithoutMotors();
			expect(input.hasGamepadVibration(0)).toBe(false);
		});

		it("reports vibration when the pad has motors", () => {
			pads[0] = padWithMotors();
			expect(input.hasGamepadVibration(0)).toBe(true);
		});

		it("resolves false rather than throwing when nothing can vibrate", async () => {
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
			pads[0] = padWithoutMotors();
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
		});

		it("defaults to a full-strength dual-rumble", async () => {
			// The web API defaults every magnitude to ZERO, so a bare
			// playEffect is a silent no-op. A bare vibrateGamepad must not be.
			const pad = padWithMotors();
			pads[0] = pad;
			await input.vibrateGamepad(0);
			const [type, params] = pad.vibrationActuator.playEffect.mock.calls[0];
			expect(type).toBe("dual-rumble");
			expect(params.strongMagnitude).toBe(1);
			expect(params.weakMagnitude).toBe(1);
			expect(params.duration).toBe(200);
		});

		it("lets each parameter be overridden", async () => {
			const pad = padWithMotors();
			pads[0] = pad;
			await input.vibrateGamepad(0, {
				duration: 90,
				strongMagnitude: 0.25,
				weakMagnitude: 0.75,
				startDelay: 10,
			});
			const [, params] = pad.vibrationActuator.playEffect.mock.calls[0];
			expect(params).toEqual({
				duration: 90,
				strongMagnitude: 0.25,
				weakMagnitude: 0.75,
				startDelay: 10,
			});
		});

		it("passes the effect type separately from the parameters", async () => {
			// `type` is the first argument to playEffect, not a member of the
			// params object; leaking it into the params would make a
			// trigger-rumble request a malformed dual-rumble one.
			const pad = padWithMotors();
			pads[0] = pad;
			await input.vibrateGamepad(0, { type: "trigger-rumble" });
			const [type, params] = pad.vibrationActuator.playEffect.mock.calls[0];
			expect(type).toBe("trigger-rumble");
			expect(params.type).toBeUndefined();
		});

		it("resolves true only when the effect ran to completion", async () => {
			pads[0] = padWithMotors("complete");
			await expect(input.vibrateGamepad(0)).resolves.toBe(true);
			pads[0] = padWithMotors("preempted");
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
		});

		it("swallows a rejection from the device", async () => {
			// An unhandled rejection here would surface as a page error in a
			// game that only asked for a rumble.
			const pad = padWithMotors();
			pad.vibrationActuator.playEffect = vi.fn(() => {
				return Promise.reject(new Error("device gone"));
			});
			pads[0] = pad;
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
		});

		it("stops an effect through the actuator's own reset", () => {
			const pad = padWithMotors();
			pads[0] = pad;
			input.stopGamepadVibration(0);
			expect(pad.vibrationActuator.reset).toHaveBeenCalledTimes(1);
		});

		it("stays quiet when there is nothing to stop", () => {
			expect(() => {
				input.stopGamepadVibration(0);
			}).not.toThrow();
			pads[0] = padWithoutMotors();
			expect(() => {
				input.stopGamepadVibration(0);
			}).not.toThrow();
			// an actuator from an older implementation, with no reset at all
			const pad = padWithMotors();
			pad.vibrationActuator.reset = undefined;
			pads[0] = pad;
			expect(() => {
				input.stopGamepadVibration(0);
			}).not.toThrow();
		});

		it("declines an actuator that cannot actually play", async () => {
			// An older implementation can expose the object without the
			// method. Every other fixture omits the actuator entirely, so
			// without this the second half of the guard is never run.
			const pad = padWithoutMotors();
			pad.vibrationActuator = {};
			pads[0] = pad;
			expect(input.hasGamepadVibration(0)).toBe(false);
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
		});

		it("does nothing where the browser has no Gamepad API at all", async () => {
			navigator.getGamepads = undefined;
			expect(input.hasGamepadVibration(0)).toBe(false);
			expect(input.activeGamepad()).toBe(-1);
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
			expect(() => {
				input.stopGamepadVibration(0);
			}).not.toThrow();
		});

		it("reads the actuator fresh, so a replugged pad still rumbles", async () => {
			// `getGamepads` hands back new objects, and a pad unplugged and
			// plugged back into the same slot is a DIFFERENT object. Caching
			// the actuator would go on driving the one that went away.
			const first = padWithMotors();
			pads[0] = first;
			await input.vibrateGamepad(0);
			const second = padWithMotors();
			pads[0] = second;
			await input.vibrateGamepad(0);
			expect(first.vibrationActuator.playEffect).toHaveBeenCalledTimes(1);
			expect(second.vibrationActuator.playEffect).toHaveBeenCalledTimes(1);
		});
	});

	describe("activeGamepad", () => {
		it("reports -1 when nothing is connected", () => {
			expect(input.activeGamepad()).toBe(-1);
		});

		it("falls back to the first connected pad before anything is pressed", () => {
			pads[2] = padWithoutMotors();
			expect(input.activeGamepad()).toBe(2);
		});

		it("follows the pad that is actually being used, not slot 0", () => {
			// The case the whole function exists for: something else is
			// sitting in slot 0 and the player is on slot 1. Rumbling slot 0
			// would be useless and invisible in testing.
			input.bindKey(input.KEY.F3, "padActiveTest");
			input.bindGamepad(
				1,
				{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 },
				input.KEY.F3,
			);
			const idle = padWithoutMotors();
			const used = padWithoutMotors();
			used.index = 1;
			pads[0] = idle;
			pads[1] = used;
			expect(input.activeGamepad()).toBe(0); // nothing pressed yet

			used.buttons[input.GAMEPAD.BUTTONS.FACE_1] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.activeGamepad()).toBe(1);

			input.unbindGamepad(1, input.GAMEPAD.BUTTONS.FACE_1);
			input.unbindKey(input.KEY.F3);
		});

		it("is moved by a stick, not only by a button", () => {
			input.bindKey(input.KEY.F8, "padStickActiveTest");
			input.bindGamepad(
				1,
				{ type: "axes", code: input.GAMEPAD.AXES.LY, threshold: -0.2 },
				input.KEY.F8,
			);
			const idle = padWithoutMotors();
			const used = padWithoutMotors();
			used.index = 1;
			used.id = "Stick Pad (STANDARD GAMEPAD)";
			pads[0] = idle;
			pads[1] = used;
			expect(input.activeGamepad()).toBe(0);

			used.axes[input.GAMEPAD.AXES.LY] = -0.9;
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.activeGamepad()).toBe(1);

			used.axes[input.GAMEPAD.AXES.LY] = 0;
			event.emit(event.GAME_BEFORE_UPDATE);
			input.unbindGamepad(1, input.GAMEPAD.AXES.LY, "axes");
			input.unbindKey(input.KEY.F8);
		});

		it("gives up a remembered slot when a DIFFERENT pad fills it", () => {
			// The failure the id is carried for. A slot left behind by one pad
			// can be handed to the next device plugged in, and an index on its
			// own would go on naming it as the pad the player is holding.
			input.bindKey(input.KEY.F9, "padSwapTest");
			input.bindGamepad(
				1,
				{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_4 },
				input.KEY.F9,
			);
			const used = padWithoutMotors();
			used.index = 1;
			used.id = "Player Pad (STANDARD GAMEPAD)";
			pads[1] = used;
			used.buttons[input.GAMEPAD.BUTTONS.FACE_4] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.activeGamepad()).toBe(1);

			// same slot, different device
			const other = padWithoutMotors();
			other.index = 1;
			other.id = "Some Other Device (STANDARD GAMEPAD)";
			pads[0] = padWithoutMotors();
			pads[1] = other;
			expect(input.activeGamepad()).toBe(0);

			input.unbindGamepad(1, input.GAMEPAD.BUTTONS.FACE_4);
			input.unbindKey(input.KEY.F9);
		});

		it("gives up a remembered index once that pad is gone", () => {
			// the slot it left behind may since have been filled by something
			// else, so a remembered index is only good while it is still there
			input.bindKey(input.KEY.F4, "padGoneTest");
			input.bindGamepad(
				1,
				{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_2 },
				input.KEY.F4,
			);
			const used = padWithoutMotors();
			used.index = 1;
			pads[1] = used;
			used.buttons[input.GAMEPAD.BUTTONS.FACE_2] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.activeGamepad()).toBe(1);

			pads[1] = null;
			pads[0] = padWithoutMotors();
			expect(input.activeGamepad()).toBe(0);

			input.unbindGamepad(1, input.GAMEPAD.BUTTONS.FACE_2);
			input.unbindKey(input.KEY.F4);
		});
	});

	describe("bindGamepad", () => {
		it("refuses a keycode that carries no action", () => {
			// F7 is this file's, bound nowhere, so nothing else is disturbed
			// by proving the refusal
			expect(() => {
				input.bindGamepad(
					0,
					{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 },
					input.KEY.F7,
				);
			}).toThrow(/no action defined/);
		});
	});

	describe("unbindGamepad", () => {
		it("really stops a bound button from reaching its action", () => {
			// Asserted rather than assumed, because every teardown in this
			// file leans on it. Spec files are isolated from each other, so
			// nothing escapes this file; what a half-working unbind would
			// leak is into the tests BELOW it, which is quite enough.
			input.bindKey(input.KEY.F5, "padUnbindTest");
			input.bindGamepad(
				0,
				{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_3 },
				input.KEY.F5,
			);
			const pad = padWithoutMotors();
			pads[0] = pad;

			pad.buttons[input.GAMEPAD.BUTTONS.FACE_3] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padUnbindTest")).toBe(true);

			pad.buttons[input.GAMEPAD.BUTTONS.FACE_3] = { pressed: false, value: 0 };
			event.emit(event.GAME_BEFORE_UPDATE);
			input.unbindGamepad(0, input.GAMEPAD.BUTTONS.FACE_3);

			pad.buttons[input.GAMEPAD.BUTTONS.FACE_3] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padUnbindTest")).toBe(false);
			// and the binding is GONE, not merely silent: one left behind
			// with no keycode still answers the poll, and went on marking its
			// pad as the active one
			expect(input.activeGamepad()).toBe(0); // the fallback, not a memory

			input.unbindKey(input.KEY.F5);
		});
	});

	describe("unbindGamepad, axes", () => {
		it("removes an axis binding, which needs the type to find it", () => {
			// `AXES.LX` and `BUTTONS.FACE_1` are both 0. Without the type the
			// call reaches into the buttons table, leaves the axis binding
			// fully live, and removes whatever button shares the number.
			input.bindKey(input.KEY.F11, "padAxisUnbindTest");
			input.bindGamepad(
				0,
				{ type: "axes", code: input.GAMEPAD.AXES.RX, threshold: 0.2 },
				input.KEY.F11,
			);
			const pad = padWithoutMotors();
			pads[0] = pad;

			pad.axes[input.GAMEPAD.AXES.RX] = 0.9;
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padAxisUnbindTest")).toBe(true);

			pad.axes[input.GAMEPAD.AXES.RX] = 0;
			event.emit(event.GAME_BEFORE_UPDATE);
			input.unbindGamepad(0, input.GAMEPAD.AXES.RX, "axes");

			pad.axes[input.GAMEPAD.AXES.RX] = 0.9;
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padAxisUnbindTest")).toBe(false);

			input.unbindKey(input.KEY.F11);
		});
	});

	describe("setGamepadMapping", () => {
		it("routes a logical button to the physical one the mapping names", () => {
			// A remap is consulted ONLY for a pad the browser does not report
			// as "standard", which is the whole reason the built-in table
			// could be trimmed without affecting anyone on a modern pad.
			const buttons = Array.from({ length: 17 }, (_, i) => {
				return i;
			});
			buttons[input.GAMEPAD.BUTTONS.FACE_1] = 7; // FACE_1 lives on 7 here
			// A vendor-product id, registered in the SPARSE spelling. Firefox
			// reports it with leading zeros on Windows and without them on
			// Mac, so `addMapping` stores both; the pad below asks under the
			// other spelling, which is the half of the mechanism the two
			// remaining built-in entries depend on. The entry stays in the
			// module's map afterwards: there is no un-register call, which is
			// harmless only because spec files are isolated.
			input.setGamepadMapping("54c-9cc-melonJS Test Pad", {
				axes: [1, 0, 2, 3],
				buttons,
			});
			input.bindKey(input.KEY.F6, "padRemapTest");
			input.bindGamepad(
				0,
				{ type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 },
				input.KEY.F6,
			);
			const pad = padWithoutMotors();
			pad.id = "054c-09cc-melonJS Test Pad";
			pad.mapping = ""; // non-standard, so the remap is consulted
			pads[0] = pad;

			// the button FACE_1 would be without the mapping does nothing
			pad.buttons[input.GAMEPAD.BUTTONS.FACE_1] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padRemapTest")).toBe(false);

			// the one the mapping names does
			pad.buttons[input.GAMEPAD.BUTTONS.FACE_1] = { pressed: false, value: 0 };
			pad.buttons[7] = { pressed: true, value: 1 };
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padRemapTest")).toBe(true);

			// and the AXES path under the same mapping, which is what runs
			// the default `normalize_fn` that both kept entries rely on: the
			// mapping swaps LX and LY, so the stick's Y drives an LX binding
			input.bindKey(input.KEY.F10, "padRemapAxisTest");
			input.bindGamepad(
				0,
				{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: -0.2 },
				input.KEY.F10,
			);
			pad.axes[input.GAMEPAD.AXES.LY] = -0.9;
			event.emit(event.GAME_BEFORE_UPDATE);
			expect(input.isKeyPressed("padRemapAxisTest")).toBe(true);

			pad.axes[input.GAMEPAD.AXES.LY] = 0;
			event.emit(event.GAME_BEFORE_UPDATE);
			input.unbindGamepad(0, input.GAMEPAD.AXES.LX, "axes");
			input.unbindKey(input.KEY.F10);
			input.unbindGamepad(0, input.GAMEPAD.BUTTONS.FACE_1);
			input.unbindKey(input.KEY.F6);
		});
	});

	describe("axis threshold", () => {
		/** run one poll of the gamepad bindings */
		const poll = () => {
			event.emit(event.GAME_BEFORE_UPDATE);
		};

		beforeEach(() => {
			input.bindKey(input.KEY.F2, "padAxisTest");
			input.setGamepadDeadzone(0.1);
			input.bindGamepad(
				0,
				{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: 0.3 },
				input.KEY.F2,
			);
		});

		afterEach(() => {
			// "axes": LX and FACE_1 are both 0, so without the type this
			// left the axis binding fully live and removed a button instead
			input.unbindGamepad(0, input.GAMEPAD.AXES.LX, "axes");
			input.unbindKey(input.KEY.F2);
			input.setGamepadDeadzone(0.1);
		});

		it("adds the threshold to the deadzone rather than replacing it", () => {
			// deadzone 0.1 + threshold 0.3 puts the gate at 0.4. A value of
			// 0.35 is PAST the threshold on its own and must still not fire:
			// that is the whole difference between the two readings, and the
			// one the documentation used to get wrong.
			const pad = padWithoutMotors();
			pads[0] = pad;

			pad.axes[0] = 0.35;
			poll();
			expect(input.isKeyPressed("padAxisTest")).toBe(false);

			pad.axes[0] = 0.45;
			poll();
			expect(input.isKeyPressed("padAxisTest")).toBe(true);
		});

		it("follows the deadzone when the deadzone moves", () => {
			const pad = padWithoutMotors();
			pads[0] = pad;
			input.setGamepadDeadzone(0.3);

			// the gate is now 0.3 + 0.3 = 0.6, so what fired before does not
			pad.axes[0] = 0.45;
			poll();
			expect(input.isKeyPressed("padAxisTest")).toBe(false);

			pad.axes[0] = 0.65;
			poll();
			expect(input.isKeyPressed("padAxisTest")).toBe(true);
		});

		it("ignores the half of the axis it was not bound to", () => {
			// a positive threshold watches the positive half only
			const pad = padWithoutMotors();
			pads[0] = pad;
			pad.axes[0] = -0.9;
			poll();
			expect(input.isKeyPressed("padAxisTest")).toBe(false);
		});
	});

	describe("virtual gamepad", () => {
		const { BUTTONS, AXES } = input.GAMEPAD;

		const poll = () => {
			event.emit(event.GAME_BEFORE_UPDATE);
		};

		const virtualPad = () => {
			return {
				id: "Virtual Pad",
				buttons: Array.from({ length: 17 }, () => {
					return { pressed: false, value: 0 };
				}),
				axes: [0, 0, 0, 0],
			};
		};

		const press = (pad, button, pressed = true) => {
			pad.buttons[button] = { pressed, value: pressed ? 1 : 0 };
		};

		/** the virtual pads added by a test, taken out after it */
		let added;

		const add = (pad, index) => {
			input.addVirtualGamepad(pad, index);
			added.push(pad);
			return pad;
		};

		beforeEach(() => {
			added = [];
			input.bindKey(input.KEY.Q, "vpadJump");
			input.bindKey(input.KEY.W, "vpadRight");
			input.bindGamepad(
				0,
				{ type: "buttons", code: BUTTONS.FACE_1 },
				input.KEY.Q,
			);
			input.bindGamepad(
				0,
				{ type: "axes", code: AXES.LX, threshold: 0.3 },
				input.KEY.W,
			);
		});

		afterEach(() => {
			for (const pad of added) {
				input.removeVirtualGamepad(pad);
			}
			// let go of whatever a test left held
			poll();
			input.unbindGamepad(0, BUTTONS.FACE_1);
			input.unbindGamepad(0, AXES.LX, "axes");
			input.unbindKey(input.KEY.Q);
			input.unbindKey(input.KEY.W);
		});

		it("presses what is bound to its slot", () => {
			const pad = add(virtualPad());
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);

			press(pad, BUTTONS.FACE_1);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);

			press(pad, BUTTONS.FACE_1, false);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);
		});

		it("moves what is bound to an axis, past the deadzone and threshold", () => {
			const pad = add(virtualPad());
			pad.axes[AXES.LX] = 0.35;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(false);

			pad.axes[AXES.LX] = 0.9;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(true);

			pad.axes[AXES.LX] = 0;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(false);
		});

		it("is read in its own slot only", () => {
			const pad = add(virtualPad(), 1);
			press(pad, BUTTONS.FACE_1);
			poll();
			// the bindings are on slot 0
			expect(input.keyStatus("vpadJump")).toBe(false);
		});

		it("works where the browser has no Gamepad API", () => {
			navigator.getGamepads = undefined;
			const pad = add(virtualPad());
			press(pad, BUTTONS.FACE_1);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);
			expect(input.activeGamepad()).toBe(0);
		});

		it("shares a slot with a real pad: either one presses", () => {
			const real = padWithoutMotors();
			pads[0] = real;
			const pad = add(virtualPad());

			press(real, BUTTONS.FACE_1);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);

			// both held, then the real one let go: still held
			press(pad, BUTTONS.FACE_1);
			press(real, BUTTONS.FACE_1, false);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);

			press(pad, BUTTONS.FACE_1, false);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);
		});

		it("takes the axis furthest from rest when a real pad shares the slot", () => {
			const real = padWithoutMotors();
			pads[0] = real;
			const pad = add(virtualPad());

			// the real stick resting a little left must not hide the virtual one
			real.axes[AXES.LX] = -0.05;
			pad.axes[AXES.LX] = 0.9;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(true);

			pad.axes[AXES.LX] = 0;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(false);
		});

		it("fires a locked key once per press, however long it is held", () => {
			input.bindKey(input.KEY.Q, "vpadJump", true);
			const pad = add(virtualPad());

			press(pad, BUTTONS.FACE_1);
			poll();
			expect(input.isKeyPressed("vpadJump")).toBe(true);
			poll();
			poll();
			expect(input.isKeyPressed("vpadJump")).toBe(false);

			press(pad, BUTTONS.FACE_1, false);
			poll();
			press(pad, BUTTONS.FACE_1);
			poll();
			expect(input.isKeyPressed("vpadJump")).toBe(true);
		});

		it("lets go of what it held when taken out", () => {
			const pad = virtualPad();
			input.addVirtualGamepad(pad);
			press(pad, BUTTONS.FACE_1);
			pad.axes[AXES.LX] = 1;
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);
			expect(input.keyStatus("vpadRight")).toBe(true);

			expect(input.removeVirtualGamepad(pad)).toBe(true);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);
			expect(input.keyStatus("vpadRight")).toBe(false);
		});

		it("lets go of a stick half that springs back just past the centre", () => {
			// only the right half is bound; a stick let go comes to rest a
			// little to the left, which must still release the right
			const real = padWithoutMotors();
			pads[0] = real;
			real.axes[AXES.LX] = 0.9;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(true);

			real.axes[AXES.LX] = -0.05;
			poll();
			expect(input.keyStatus("vpadRight")).toBe(false);
		});

		it("lets go of a stick bound on its negative side when it comes back to 0", () => {
			// 0 counts as the positive half, which has no key here
			input.bindKey(input.KEY.E, "vpadUp");
			input.bindGamepad(
				0,
				{ type: "axes", code: AXES.LY, threshold: -0.3 },
				input.KEY.E,
			);
			const pad = add(virtualPad());
			pad.axes[AXES.LY] = -0.9;
			poll();
			expect(input.keyStatus("vpadUp")).toBe(true);

			pad.axes[AXES.LY] = 0;
			poll();
			expect(input.keyStatus("vpadUp")).toBe(false);
			input.unbindGamepad(0, AXES.LY, "axes");
			input.unbindKey(input.KEY.E);
		});

		it("keeps an action held on the keyboard when the pad lets go of it", () => {
			const pad = add(virtualPad());
			input.triggerKeyEvent(input.KEY.Q, true);
			press(pad, BUTTONS.FACE_1);
			poll();
			press(pad, BUTTONS.FACE_1, false);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);
			input.triggerKeyEvent(input.KEY.Q, false);
			expect(input.keyStatus("vpadJump")).toBe(false);
		});

		it("releases a remapped pad's key with the id it was pressed with", () => {
			// a non-standard pad whose FACE_1 is its raw button 1: the key is
			// pressed with that raw index, and must be let go with it when
			// the slot falls back to the virtual pad, or the next press of
			// the same button is ignored
			input.setGamepadMapping("Remapped Pad", {
				axes: [0, 1, 2, 3],
				buttons: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
			});
			const real = padWithoutMotors();
			real.id = "Remapped Pad";
			real.mapping = "";
			pads[0] = real;
			add(virtualPad());

			real.buttons[1] = { pressed: true, value: 1 };
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);

			// unplugged while held: the virtual pad is all the slot has
			pads[0] = null;
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);

			// plugged back in and pressed again
			pads[0] = real;
			real.buttons[1] = { pressed: false, value: 0 };
			poll();
			real.buttons[1] = { pressed: true, value: 1 };
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);
			real.buttons[1] = { pressed: false, value: 0 };
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);
		});

		it("refuses to put one pad in two slots", () => {
			const pad = add(virtualPad());
			expect(() => {
				input.addVirtualGamepad(pad, 1);
			}).toThrow();
		});

		it("lets go of what a real pad held when it is unplugged", () => {
			const real = padWithoutMotors();
			pads[0] = real;
			press(real, BUTTONS.FACE_1);
			poll();
			expect(input.keyStatus("vpadJump")).toBe(true);

			pads[0] = null;
			poll();
			expect(input.keyStatus("vpadJump")).toBe(false);
		});

		it("is the active gamepad once used, the real pad when it shares the slot", () => {
			const pad = add(virtualPad(), 1);
			input.bindGamepad(
				1,
				{ type: "buttons", code: BUTTONS.FACE_1 },
				input.KEY.Q,
			);
			pads[0] = padWithoutMotors();
			expect(input.activeGamepad()).toBe(0);

			press(pad, BUTTONS.FACE_1);
			poll();
			expect(input.activeGamepad()).toBe(1);
			press(pad, BUTTONS.FACE_1, false);
			poll();
			input.unbindGamepad(1, BUTTONS.FACE_1);
		});

		it("vibrates through its own actuator when no real pad is there", async () => {
			const pad = virtualPad();
			pad.vibrationActuator = {
				playEffect: vi.fn(() => {
					return Promise.resolve("complete");
				}),
				reset: vi.fn(() => {
					return Promise.resolve("complete");
				}),
			};
			add(pad);
			expect(input.hasGamepadVibration(0)).toBe(true);
			await expect(input.vibrateGamepad(0)).resolves.toBe(true);
			expect(pad.vibrationActuator.playEffect).toHaveBeenCalledOnce();

			// a real pad in the slot is the one vibrated
			const real = padWithMotors();
			pads[0] = real;
			await input.vibrateGamepad(0);
			expect(real.vibrationActuator.playEffect).toHaveBeenCalledOnce();
			expect(pad.vibrationActuator.playEffect).toHaveBeenCalledOnce();
		});

		it("does not vibrate without an actuator", async () => {
			add(virtualPad());
			expect(input.hasGamepadVibration(0)).toBe(false);
			await expect(input.vibrateGamepad(0)).resolves.toBe(false);
		});

		it("refuses a slot that already holds one, and a bad index", () => {
			add(virtualPad());
			expect(() => {
				input.addVirtualGamepad(virtualPad());
			}).toThrow();
			expect(() => {
				input.addVirtualGamepad(virtualPad(), -1);
			}).toThrow(RangeError);
			expect(() => {
				input.addVirtualGamepad(virtualPad(), 0.5);
			}).toThrow(RangeError);
		});

		it("reports a pad that was never added as not removed", () => {
			expect(input.removeVirtualGamepad(virtualPad())).toBe(false);
		});

		it("leaves no trace once removed", () => {
			const pad = virtualPad();
			input.addVirtualGamepad(pad, 2);
			expect(input.activeGamepad()).toBe(2);
			input.removeVirtualGamepad(pad);
			expect(input.activeGamepad()).toBe(-1);
			// and the slot can be used again
			input.addVirtualGamepad(pad, 2);
			input.removeVirtualGamepad(pad);
		});
	});
});
