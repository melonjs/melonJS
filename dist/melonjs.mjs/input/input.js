/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
export { bindPointer, exitPointerLock, globalToLocal, locked, pointer, pointerEventTarget, registerPointerEvent, releaseAllPointerEvents, releasePointerEvent, requestPointerLock, setTouchAction, throttlingInterval, unbindPointer } from './pointerevent.js';
export { KEY, bindKey, getBindingKey, initKeyboardEvent, isKeyPressed, keyBoardEventTarget, keyStatus, triggerKeyEvent, unbindKey, unlockKey } from './keyboard.js';
export { GAMEPAD, bindGamepad, setGamepadDeadzone, setGamepadMapping, unbindGamepad } from './gamepad.js';

/**
 * @namespace input
 */

/**
 * specify if melonJS should prevent all default browser action on registered events.
 * @public
 * @type {boolean}
 * @default true
 * @name preventDefault
 * @memberof input
 */
let preventDefault = true;

export { preventDefault };
