import { preventDefault as preventDefaultAction } from "./input.js";
import { isMobile } from "../system/platform.ts";
import { eventEmitter, KEYDOWN, KEYUP } from "../system/event.ts";

// corresponding actions
const _keyStatus: Record<string, number> = {};

// lock enable flag for keys
const _keyLock: Record<string, boolean> = {};

// actual lock status of each key
const _keyLocked: Record<string, boolean> = {};

// List of binded keys being held
const _keyRefs: Record<string, Record<number, boolean>> = {};

// whether default event should be prevented for a given keypress
const _preventDefaultForKeys: Record<number, boolean> = {};

// list of binded keys
const _keyBindings: Record<number, string> = {};

type KeyEventHandler = (
	options:
		| { keyCode: number; mouseButton?: number | undefined }
		| KeyboardEvent,
) => void;

const keyDownEvent: KeyEventHandler = (options) => {
	const { keyCode } = options;
	const action = _keyBindings[keyCode];

	eventEmitter.emit(
		KEYDOWN,
		action,
		keyCode,
		action ? !_keyLocked[action] : true,
	);

	if (action) {
		if (!_keyLocked[action]) {
			const trigger =
				("mouseButton" in options ? options.mouseButton : undefined) ?? keyCode;
			if (!_keyRefs[action][trigger]) {
				_keyStatus[action]++;
				_keyRefs[action][trigger] = true;
			}
		}
		if ("preventDefault" in options && _preventDefaultForKeys[keyCode]) {
			options.preventDefault();
		}
	}
};

const keyUpEvent: KeyEventHandler = (options) => {
	const { keyCode } = options;
	const action = _keyBindings[keyCode];

	eventEmitter.emit(KEYUP, action, keyCode);

	if (action) {
		const trigger =
			("mouseButton" in options ? options.mouseButton : undefined) ?? keyCode;
		delete _keyRefs[action][trigger];

		if (_keyStatus[action] > 0) {
			_keyStatus[action]--;
		}

		_keyLocked[action] = false;

		if ("preventDefault" in options && _preventDefaultForKeys[keyCode]) {
			options.preventDefault();
		}
	}
};

/*
 * PUBLIC STUFF
 */

/**
 * the default target element for keyboard events (usually the window element in which the game is running)
 */
export const keyBoardEventTarget = null;

export function initKeyboardEvent() {
	if (!isMobile) {
		if (globalThis.addEventListener) {
			globalThis.addEventListener(
				"keydown",
				(e) => {
					keyDownEvent(e);
				},
				false,
			);
			globalThis.addEventListener("keyup", keyUpEvent, false);
		}
	}
}

/**
 * return the key press status of the specified action
 * @param action - user defined corresponding action
 * @returns true if pressed
 * @example
 * if (me.input.isKeyPressed('left')) {
 *    //do something
 * }
 * else if (me.input.isKeyPressed('right')) {
 *    //do something else...
 * }
 */
export function isKeyPressed(action: string) {
	if (_keyStatus[action] && !_keyLocked[action]) {
		if (_keyLock[action]) {
			_keyLocked[action] = true;
		}
		return true;
	}
	return false;
}

/**
 * return the key status of the specified action
 * @param action - user defined corresponding action
 * @returns down (true) or up(false)
 */
export function keyStatus(action: string) {
	return _keyStatus[action] > 0;
}

/**
 * trigger the specified key (simulated) event <br>
 * @param keyCode - (See {@link input.KEY})
 * @param [status=false] - true to trigger a key down event, or false for key up event
 * @param [mouseButton] - the mouse button to trigger
 * @example
 * // trigger a key press
 * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
 */
export function triggerKeyEvent(
	keyCode: number,
	status: boolean,
	mouseButton?: number | undefined,
) {
	const handler = status ? keyDownEvent : keyUpEvent;
	handler({ keyCode, mouseButton });
}

/**
 * associate a user defined action to a keycode
 * @param keyCode - (See {@link input.KEY})
 * @param action - user defined corresponding action
 * @param [lock=false] - cancel the keypress event once read
 * @param [preventDefault=input.preventDefault] - prevent default browser action
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.LEFT,  "left");
 * me.input.bindKey(me.input.KEY.RIGHT, "right");
 * me.input.bindKey(me.input.KEY.X,     "jump", true);
 * me.input.bindKey(me.input.KEY.F1,    "options", true, true);
 */
export const bindKey = (
	keyCode: number,
	action: string,
	lock?: boolean | undefined,
	preventDefault = preventDefaultAction,
) => {
	_keyBindings[keyCode] = action;
	_preventDefaultForKeys[keyCode] = preventDefault;

	_keyStatus[action] = 0;
	_keyLock[action] = lock ? lock : false;
	_keyLocked[action] = false;
	_keyRefs[action] = {};
};

/**
 * return the action associated with the given keycode
 * @param keyCode - (See {@link input.KEY})
 * @returns user defined associated action
 */
export function getBindingKey(keyCode: number) {
	return _keyBindings[keyCode];
}

/**
 * unlock a key manually
 * @param action - user defined corresponding action
 * @example
 * // Unlock jump when touching the ground
 * if (!this.falling && !this.jumping) {
 *     me.input.unlockKey("jump");
 * }
 */
export function unlockKey(action: string) {
	_keyLocked[action] = false;
}

/**
 * unbind the defined keycode
 * @param keyCode - (See {@link input.KEY})
 * @example
 * me.input.unbindKey(me.input.KEY.LEFT);
 */
export function unbindKey(keyCode: number) {
	// clear the event status
	const keybinding = _keyBindings[keyCode];
	_keyStatus[keybinding] = 0;
	_keyLock[keybinding] = false;
	_keyRefs[keybinding] = {};
	// remove the key binding
	delete _keyBindings[keyCode];
	delete _preventDefaultForKeys[keyCode];
}
