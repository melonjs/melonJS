/**
 * melonJS — Starsweep: keyboard, touch controls and taps.
 *
 * Keyboard: arrows / WASD to move, Space / X to zap, P / Esc to pause.
 *
 * Touch: the `@melonjs/gamepad-plugin` virtual gamepad, two thumbs and
 * nothing on the screen until touched. The left thumb steers: the stick
 * shows up under it wherever it lands and goes when it lifts. The right
 * thumb zaps: a floating ZAP button shows up under it anywhere on the
 * right half (`floating`, `hideAtRest`), and floating buttons are found
 * before floating sticks, so the right half is the button's and the rest
 * of the screen the stick's. A quick tap on the stick zaps too (`tap`).
 * The plugin presses the same keys the keyboard does, so the game reads
 * one set of actions for both. It only shows on touch screens, and hides
 * itself if a real pad is used.
 *
 * On the title, the start button takes the click or tap. In the game, a
 * click or tap anywhere presses Enter (`input.bindPointer`), and a zap
 * also moves past a message.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { GamepadPlugin } from "@melonjs/gamepad-plugin";
import { device, input, plugin } from "melonjs";
import { DIR_NAMES, type Dir } from "./board";

/**
 * Every key the game binds: the key, the action it presses, and whether
 * the action fires once per press (`true`) or for as long as it is held.
 */
const BINDINGS: readonly [keyof typeof input.KEY, string, boolean][] = [
	["UP", "up", false],
	["W", "up", false],
	["RIGHT", "right", false],
	["D", "right", false],
	["DOWN", "down", false],
	["S", "down", false],
	["LEFT", "left", false],
	["A", "left", false],
	["SPACE", "fire", true],
	["X", "fire", true],
	["P", "pause", true],
	["ESC", "pause", true],
	["ENTER", "start", true],
];

/** The game's controls: keys, the virtual gamepad, and pointer presses. */
export class Controls {
	private held = [false, false, false, false];
	/** most recently pressed direction wins when several are held */
	private keyDir: Dir | -1 = -1;
	private pad: GamepadPlugin | null = null;

	/**
	 * Bind keys and register the touch controls, once for the whole game,
	 * not per screen: a key unbound while it is still held (Enter on the
	 * title, say) stays locked after it is bound again.
	 */
	bind() {
		for (const [key, action, once] of BINDINGS) {
			input.bindKey(input.KEY[key], action, once);
		}

		// the virtual gamepad presses the very keys bound above
		plugin.register(GamepadPlugin, "gamepad", {
			enabled: false,
			color: "#9ff3ff",
			opacity: 0.4,
			sticks: [
				{
					// appears under the thumb wherever it lands, gone when it
					// lifts; a quick tap that does not steer zaps
					floating: true,
					area: "screen",
					hideAtRest: true,
					tap: { key: input.KEY.SPACE },
					dpadThreshold: 0.35,
					keys: {
						up: input.KEY.UP,
						down: input.KEY.DOWN,
						left: input.KEY.LEFT,
						right: input.KEY.RIGHT,
					},
				},
			],
			// two thumbs: a ZAP button that appears under a finger anywhere on
			// the right half; the stick keeps the rest of the screen
			buttons: [
				{
					key: input.KEY.SPACE,
					button: null,
					label: "ZAP",
					radius: 52,
					floating: true,
					hideAtRest: true,
				},
			],
		});
		this.pad = plugin.cache.gamepad as GamepadPlugin;
	}

	/** undo `bind`, when the example is closed */
	unbind() {
		for (const [key] of BINDINGS) {
			input.unbindKey(input.KEY[key]);
		}
		input.unbindPointer();
		this.pad?.destroy();
		this.pad = null;
	}

	/**
	 * Set the controls up for a screen. In the game (`inGame`), the touch
	 * controls show on touch screens, and a click or tap anywhere presses
	 * Enter, to move past a message. On the title, the pointer is left to
	 * its start button.
	 */
	attach(inGame: boolean) {
		if (this.pad) {
			this.pad.enabled = inGame && device.touch;
		}
		if (inGame) {
			input.bindPointer(input.KEY.ENTER);
		} else {
			input.unbindPointer();
		}
		this.reset();
	}

	/** whether the touch controls are on the screen right now */
	get onScreen() {
		return this.pad?.visible === true;
	}

	/** call once per frame, before reading `dir` */
	poll() {
		DIR_NAMES.forEach((action, d) => {
			const now = input.isKeyPressed(action);
			if (now && !this.held[d]) {
				this.keyDir = d as Dir;
			}
			this.held[d] = now;
		});
		if (this.keyDir !== -1 && !this.held[this.keyDir]) {
			// the newest key was let go: fall back to any other held key
			const other = this.held.findIndex(Boolean);
			this.keyDir = other === -1 ? -1 : (other as Dir);
		}
	}

	/** the direction the player is asking for right now, or -1 */
	get dir(): Dir | -1 {
		return this.keyDir;
	}

	/** true once per zap (Space, X, or a tap on a touch screen) */
	fire() {
		return input.isKeyPressed("fire");
	}

	/** true once per Enter, zap or tap (menus and "press to continue") */
	confirm() {
		// both are read, so neither is left waiting
		const start = input.isKeyPressed("start");
		const fire = input.isKeyPressed("fire");
		return start || fire;
	}

	/** true once per P or Esc */
	pause() {
		return input.isKeyPressed("pause");
	}

	/**
	 * Drop a press that came before now (on level start, death, …), so it
	 * does not skip what comes next: a key still held stays spent until it
	 * is let go.
	 */
	reset() {
		input.isKeyPressed("start");
		input.isKeyPressed("fire");
	}
}
