/**
 * melonJS — Glowpaint: keyboard and touch input.
 *
 * Keyboard: arrows / WASD to move, Space / X to fire, P / Esc to pause.
 * Touch (or mouse): press and drag anywhere for a floating joystick,
 * tap anywhere to fire. A second finger can tap while the first steers.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { game, input, type Pointer, type Renderable } from "melonjs";
import type { Dir } from "./board";

const ACTIONS = ["up", "right", "down", "left"] as const;

/** how far (px) a drag must go before it counts as a direction */
const DEADZONE = 18;
/** a press shorter than this, that barely moved, is a tap */
const TAP_MS = 260;

export class Controls {
	/** the joystick, for drawing; null when no finger is steering */
	stick: { x: number; y: number; kx: number; ky: number } | null = null;

	private held = [false, false, false, false];
	/** most recently pressed key direction wins when several are held */
	private keyDir: Dir | -1 = -1;
	private stickDir: Dir | -1 = -1;
	private stickId: number | null = null;
	private downAt = new Map<number, { x: number; y: number; t: number }>();
	private tapQueued = false;
	private region: Renderable | null = null;
	private readonly onWindowUp = (e: PointerEvent) =>
		this.release(e.pointerId, false);

	/**
	 * Bind once for the whole game, not per screen: a key unbound while
	 * it is still held (Enter on the title, say) stays locked after it is
	 * bound again. Pointers listen on the camera, which the engine offers
	 * every pointer event, so a press counts wherever it lands.
	 */
	bind() {
		const region = game.viewport;
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

		this.region = region;
		input.registerPointerEvent("pointerdown", region, (p: Pointer) => {
			this.press(p);
			return false;
		});
		input.registerPointerEvent("pointermove", region, (p: Pointer) => {
			this.drag(p);
			return false;
		});
		input.registerPointerEvent("pointerup", region, (p: Pointer) => {
			this.release(p.pointerId ?? 0, true, p);
			return false;
		});
		// a finger lifted outside the canvas never reaches the engine
		window.addEventListener("pointerup", this.onWindowUp);
		window.addEventListener("pointercancel", this.onWindowUp);
	}

	/** undo `bind`, when the example is closed */
	unbind() {
		for (const key of [
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
		] as const) {
			input.unbindKey(input.KEY[key]);
		}
		if (this.region) {
			input.releasePointerEvent("pointerdown", this.region);
			input.releasePointerEvent("pointermove", this.region);
			input.releasePointerEvent("pointerup", this.region);
			this.region = null;
		}
		window.removeEventListener("pointerup", this.onWindowUp);
		window.removeEventListener("pointercancel", this.onWindowUp);
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
		return this.keyDir !== -1 ? this.keyDir : this.stickDir;
	}

	/** true once per fire press or tap */
	fire() {
		const tapped = this.tapQueued;
		this.tapQueued = false;
		return input.isKeyPressed("fire") || tapped;
	}

	/** true once per Enter press or tap (menus and "press to continue") */
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
		this.stick = null;
		this.stickDir = -1;
		this.stickId = null;
		this.downAt.clear();
	}

	private press(p: Pointer) {
		const id = p.pointerId ?? 0;
		const x = p.gameScreenX;
		const y = p.gameScreenY;
		this.downAt.set(id, { x, y, t: performance.now() });
		if (this.stickId === null) {
			this.stickId = id;
			this.stick = { x, y, kx: x, ky: y };
		}
	}

	private drag(p: Pointer) {
		const id = p.pointerId ?? 0;
		if (id !== this.stickId || !this.stick) {
			return;
		}
		const dx = p.gameScreenX - this.stick.x;
		const dy = p.gameScreenY - this.stick.y;
		const len = Math.hypot(dx, dy);
		// keep the knob inside the ring
		const max = 46;
		const k = len > max ? max / len : 1;
		this.stick.kx = this.stick.x + dx * k;
		this.stick.ky = this.stick.y + dy * k;
		if (len < DEADZONE) {
			this.stickDir = -1;
		} else if (Math.abs(dx) > Math.abs(dy)) {
			this.stickDir = dx > 0 ? 1 : 3;
		} else {
			this.stickDir = dy > 0 ? 2 : 0;
		}
	}

	private release(id: number, inside: boolean, p?: Pointer) {
		const down = this.downAt.get(id);
		if (!down) {
			return;
		}
		this.downAt.delete(id);
		if (inside && p) {
			const moved = Math.hypot(p.gameScreenX - down.x, p.gameScreenY - down.y);
			if (moved < DEADZONE && performance.now() - down.t < TAP_MS) {
				this.tapQueued = true;
			}
		}
		if (id === this.stickId) {
			this.stickId = null;
			this.stick = null;
			this.stickDir = -1;
		}
	}
}
