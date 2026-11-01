/**
 * melonJS — Starsweep: keyboard, touch controls and taps.
 *
 * Keyboard: arrows / WASD to move, Space / X to zap, P / Esc to pause.
 *
 * Touch: the `@melonjs/gamepad-plugin` virtual gamepad, a stick and a ZAP
 * button in the zone under the board. The plugin presses the same keys
 * the keyboard does, so the game reads one set of actions for both. It
 * only shows on touch screens, and hides itself if a real pad is used.
 *
 * On screens without the gamepad (title, "level clear", game over) a tap
 * anywhere stands for Enter.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { GamepadPlugin } from "@melonjs/gamepad-plugin";
import {
	device,
	game,
	input,
	type Pointer,
	plugin,
	type Renderable,
} from "melonjs";
import type { Dir } from "./board";

const ACTIONS = ["up", "right", "down", "left"] as const;

/** a press shorter than this, that barely moved, is a tap */
const TAP_MS = 300;
const TAP_SLOP = 24;

const KEYS = [
	"UP",
	"W",
	"RIGHT",
	"D",
	"DOWN",
	"S",
	"LEFT",
	"A",
	"SPACE",
	"X",
	"P",
	"ESC",
	"ENTER",
] as const;

export class Controls {
	private held = [false, false, false, false];
	/** most recently pressed direction wins when several are held */
	private keyDir: Dir | -1 = -1;
	private downAt = new Map<number, { x: number; y: number; t: number }>();
	private tapQueued = false;
	private region: Renderable | null = null;
	private pad: GamepadPlugin | null = null;
	private readonly onWindowUp = (e: PointerEvent) =>
		this.downAt.delete(e.pointerId);

	/**
	 * Bind keys and register the touch controls, once for the whole game,
	 * not per screen: a key unbound while it is still held (Enter on the
	 * title, say) stays locked after it is bound again.
	 */
	bind() {
		input.bindKey(input.KEY.UP, "up");
		input.bindKey(input.KEY.W, "up");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.DOWN, "down");
		input.bindKey(input.KEY.S, "down");
		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.SPACE, "fire", true);
		input.bindKey(input.KEY.X, "fire", true);
		input.bindKey(input.KEY.P, "pause", true);
		input.bindKey(input.KEY.ESC, "pause", true);
		input.bindKey(input.KEY.ENTER, "start", true);

		// the virtual gamepad presses the very keys bound above
		plugin.register(GamepadPlugin, "gamepad", {
			enabled: false,
			color: "#9ff3ff",
			opacity: 0.4,
			sticks: [
				{
					floating: true,
					dpadThreshold: 0.35,
					keys: {
						up: input.KEY.UP,
						down: input.KEY.DOWN,
						left: input.KEY.LEFT,
						right: input.KEY.RIGHT,
					},
				},
			],
			buttons: [
				{ key: input.KEY.SPACE, button: null, label: "ZAP", radius: 52 },
			],
		});
		this.pad = plugin.cache.gamepad as GamepadPlugin;

		// a finger lifted outside the canvas never reaches the engine
		window.addEventListener("pointerup", this.onWindowUp);
		window.addEventListener("pointercancel", this.onWindowUp);
	}

	/** undo `bind`, when the example is closed */
	unbind() {
		for (const key of KEYS) {
			input.unbindKey(input.KEY[key]);
		}
		this.detach();
		this.pad?.destroy();
		this.pad = null;
		window.removeEventListener("pointerup", this.onWindowUp);
		window.removeEventListener("pointercancel", this.onWindowUp);
	}

	/**
	 * Listen for taps on the current camera, which the engine offers every
	 * pointer event. Call on every screen change: a new screen can bring a
	 * new camera. `gamepad` shows the touch controls (on touch screens).
	 */
	attach(gamepad: boolean) {
		this.detach();
		const region = game.viewport;
		this.region = region;
		input.registerPointerEvent("pointerdown", region, (p: Pointer) => {
			this.downAt.set(p.pointerId ?? 0, {
				x: p.gameScreenX,
				y: p.gameScreenY,
				t: performance.now(),
			});
			return false;
		});
		input.registerPointerEvent("pointerup", region, (p: Pointer) => {
			const id = p.pointerId ?? 0;
			const down = this.downAt.get(id);
			this.downAt.delete(id);
			if (
				down &&
				performance.now() - down.t < TAP_MS &&
				Math.hypot(p.gameScreenX - down.x, p.gameScreenY - down.y) < TAP_SLOP
			) {
				this.tapQueued = true;
			}
			return false;
		});
		if (this.pad) {
			this.pad.enabled = gamepad && device.touch;
		}
		this.reset();
	}

	private detach() {
		if (this.region) {
			input.releasePointerEvent("pointerdown", this.region);
			input.releasePointerEvent("pointerup", this.region);
			this.region = null;
		}
	}

	/** whether the touch controls are on the screen right now */
	get onScreen() {
		return this.pad?.visible === true;
	}

	/** call once per frame, before reading `dir` */
	poll() {
		ACTIONS.forEach((action, d) => {
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

	/** true once per zap press (Space, X or the ZAP button) */
	fire() {
		return input.isKeyPressed("fire");
	}

	/** true once per Enter, zap or tap (menus and "press to continue") */
	confirm() {
		const tapped = this.tapQueued;
		this.tapQueued = false;
		return input.isKeyPressed("start") || input.isKeyPressed("fire") || tapped;
	}

	pause() {
		return input.isKeyPressed("pause");
	}

	/** drop any half-finished gesture (on level start, death, …) */
	reset() {
		this.tapQueued = false;
		this.downAt.clear();
	}
}
