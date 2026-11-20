import { BLUR, emit, KEYDOWN, KEYUP, on } from "../system/event.ts";
import { preventDefault as preventDefaultAction } from "./input.ts";

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

// the browser's event for a key with no binding, while the KEYDOWN listeners
// run: one of them that uses the key can stop its default action
let _unboundKeyDown: KeyboardEvent | undefined;

/**
 * The code of the key of a browser event. The engine's key codes (`input.KEY`,
 * the bindings) are the ones browsers have always given in `keyCode`: this is
 * the one place that field is read.
 * @param event - a keyboard event from the browser
 * @returns the code of its key
 */
function keyCodeOf(event: KeyboardEvent): number {
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- the codes the engine's API is in
	return event.keyCode;
}

/**
 * A key goes down: pressed on the keyboard (with the browser's event), or
 * triggered by the engine for a pointer button or from `triggerKeyEvent`.
 * @param keyCode - the key
 * @param [mouseButton] - the pointer button standing in for the key
 * @param [event] - the browser's event, when a keyboard sent it
 */
function keyDown(keyCode: number, mouseButton?: number, event?: KeyboardEvent) {
	const action = _keyBindings[keyCode];

	// a bound key follows its binding's preventDefault; an unbound one is left
	// to the listener that uses it, through preventKeyDefault()
	const outer = _unboundKeyDown;
	_unboundKeyDown = action ? undefined : event;
	try {
		emit(KEYDOWN, action, keyCode, action ? !_keyLocked[action] : true);
	} finally {
		_unboundKeyDown = outer;
	}

	if (action) {
		if (!_keyLocked[action]) {
			const trigger = mouseButton ?? keyCode;
			if (!_keyRefs[action][trigger]) {
				_keyStatus[action]++;
				_keyRefs[action][trigger] = true;
			}
		}
		if (_preventDefaultForKeys[keyCode]) {
			event?.preventDefault();
		}
	}
}

/**
 * A key goes up: see {@link keyDown}.
 * @param keyCode - the key
 * @param [mouseButton] - the pointer button standing in for the key
 * @param [event] - the browser's event, when a keyboard sent it
 */
function keyUp(keyCode: number, mouseButton?: number, event?: KeyboardEvent) {
	const action = _keyBindings[keyCode];

	emit(KEYUP, action, keyCode);

	if (action) {
		const trigger = mouseButton ?? keyCode;
		delete _keyRefs[action][trigger];

		if (_keyStatus[action] > 0) {
			_keyStatus[action]--;
		}

		_keyLocked[action] = false;

		if (_preventDefaultForKeys[keyCode]) {
			event?.preventDefault();
		}
	}
}

// gamepads press keys with a source of 256 and up (keys and mouse buttons
// use their own codes, below that)
const POLLED_SOURCE = 256;

/**
 * Let go of every key and mouse button held when the window loses the focus:
 * their release goes to another window, and would otherwise never arrive.
 * A gamepad is polled every frame and lets go of its own presses, so what it
 * holds is left to it.
 */
const releaseHeldKeys = () => {
	for (const action in _keyRefs) {
		const refs = _keyRefs[action];
		for (const trigger in refs) {
			if (+trigger < POLLED_SOURCE) {
				delete refs[trigger];
				if (_keyStatus[action] > 0) {
					_keyStatus[action]--;
				}
			}
		}
		// unlocked once nothing holds it, as its last keyup would
		if (!(_keyStatus[action] > 0)) {
			_keyLocked[action] = false;
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
	if (typeof globalThis.addEventListener === "function") {
		globalThis.addEventListener(
			"keydown",
			(event) => {
				keyDown(keyCodeOf(event), undefined, event);
			},
			false,
		);
		globalThis.addEventListener(
			"keyup",
			(event) => {
				keyUp(keyCodeOf(event), undefined, event);
			},
			false,
		);
	}
	// emitted on the window's blur and when the page is hidden
	on(BLUR, releaseHeldKeys);
}

/**
 * Stop the browser's own action, such as scrolling the page, for the key
 * press a `KEYDOWN` listener is handling, when that listener uses it. Only
 * for a key with no binding: a bound key follows its binding's
 * `preventDefault`. Nothing is stopped when `input.preventDefault` is off.
 * @ignore
 * @internal
 */
export function preventKeyDefault(): void {
	if (_unboundKeyDown !== undefined && preventDefaultAction) {
		_unboundKeyDown.preventDefault();
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
 * @category Input
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
 * @category Input
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
 * @category Input
 */
export function triggerKeyEvent(
	keyCode: number,
	status: boolean,
	mouseButton?: number,
) {
	if (status) {
		keyDown(keyCode, mouseButton);
	} else {
		keyUp(keyCode, mouseButton);
	}
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
	lock?: boolean,
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
 * @category Input
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
 * @category Input
 */
export function unlockKey(action: string) {
	_keyLocked[action] = false;
}

/**
 * unbind the defined keycode
 * @param keyCode - (See {@link input.KEY})
 * @example
 * me.input.unbindKey(me.input.KEY.LEFT);
 * @category Input
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
