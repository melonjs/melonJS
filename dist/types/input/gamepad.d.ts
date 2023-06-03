/**
 * Associate a gamepad event to a keycode
 * @name bindGamepad
 * @memberof input
 * @public
 * @param {number} index - Gamepad index
 * @param {object} button - Button/Axis definition
 * @param {string} button.type - "buttons" or "axes"
 * @param {number} button.code - button or axis code id (See {@link input.GAMEPAD.BUTTONS}, {@link input.GAMEPAD.AXES})
 * @param {number} [button.threshold=1] - value indicating when the axis should trigger the keycode (e.g. -0.5 or 0.5)
 * @param {number} keyCode - (See {@link input.KEY})
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * ...
 * // map the lower face button on the first gamepad to the X key
 * me.input.bindGamepad(0, {type:"buttons", code: me.input.GAMEPAD.BUTTONS.FACE_1}, me.input.KEY.X);
 * // map the left axis value on the first gamepad to the LEFT key
 * me.input.bindGamepad(0, {type:"axes", code: me.input.GAMEPAD.AXES.LX, threshold: -0.5}, me.input.KEY.LEFT);
 */
export function bindGamepad(index: number, button: {
    type: string;
    code: number;
    threshold?: number | undefined;
}, keyCode: number): void;
/**
 * unbind the defined keycode
 * @name unbindGamepad
 * @memberof input
 * @public
 * @param {number} index - Gamepad index
 * @param {number} button - (See {@link input.GAMEPAD.BUTTONS})
 * @example
 * me.input.unbindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1);
 */
export function unbindGamepad(index: number, button: number): void;
/**
 * Set deadzone for analog gamepad inputs<br>
 * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
 * @name setGamepadDeadzone
 * @memberof input
 * @public
 * @param {number} value - Deadzone value
 */
export function setGamepadDeadzone(value: number): void;
export namespace GAMEPAD {
    namespace AXES {
        let LX: number;
        let LY: number;
        let RX: number;
        let RY: number;
        let EXTRA_1: number;
        let EXTRA_2: number;
        let EXTRA_3: number;
        let EXTRA_4: number;
    }
    namespace BUTTONS {
        export let FACE_1: number;
        export let FACE_2: number;
        export let FACE_3: number;
        export let FACE_4: number;
        export let L1: number;
        export let R1: number;
        export let L2: number;
        export let R2: number;
        export let SELECT: number;
        export let BACK: number;
        export let START: number;
        export let FORWARD: number;
        export let L3: number;
        export let R3: number;
        export let UP: number;
        export let DOWN: number;
        export let LEFT: number;
        export let RIGHT: number;
        export let HOME: number;
        let EXTRA_1_1: number;
        export { EXTRA_1_1 as EXTRA_1 };
        let EXTRA_2_1: number;
        export { EXTRA_2_1 as EXTRA_2 };
        let EXTRA_3_1: number;
        export { EXTRA_3_1 as EXTRA_3 };
        let EXTRA_4_1: number;
        export { EXTRA_4_1 as EXTRA_4 };
    }
}
/**
 * Firefox reports different ids for gamepads depending on the platform:
 * - Windows: vendor and product codes contain leading zeroes
 * - Mac: vendor and product codes are sparse (no leading zeroes)
 *
 * This function normalizes the id to support both formats
 * @ignore
 */
export function setGamepadMapping(id: any, mapping: any): void;
