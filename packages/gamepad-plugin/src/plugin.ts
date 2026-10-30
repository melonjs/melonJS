import {
	type Application,
	device,
	event,
	input,
	Matrix3d,
	plugin,
	type Renderer,
	Stage,
	Vector2d,
} from "melonjs";
import packageJson from "../package.json" with { type: "json" };
import { type Look, VirtualButton, VirtualStick } from "./controls.ts";
import { VirtualPad } from "./pad.ts";
import type {
	ButtonOptions,
	GamepadPluginOptions,
	StickOptions,
} from "./types.ts";

/**
 * The lowest melonJS version this plugin runs on, from the package's peer
 * range, so it is kept in one place: `plugin.register` refuses an older
 * engine, where the peer range alone only warns at install time.
 * @ignore
 */
function minimumEngineVersion(): string {
	const range = packageJson.peerDependencies.melonjs;
	return range.match(/\d+\.\d+\.\d+/)?.[0] ?? range;
}

/**
 * a list of options from a count or a list
 * @param value - a count, or a list of options
 * @param count - the count when none is given
 */
function listOf<T extends object>(
	value: number | T[] | undefined,
	count: number,
): T[] {
	if (Array.isArray(value)) {
		return value;
	}
	return Array.from({ length: value ?? count }, () => {
		return {} as T;
	});
}

/** whether the browser reports a real gamepad */
function realGamepadConnected(): boolean {
	if (typeof globalThis.navigator?.getGamepads !== "function") {
		return false;
	}
	return globalThis.navigator.getGamepads().some((pad) => {
		return pad !== null;
	});
}

const POINTER_EVENTS = [
	"pointerdown",
	"pointermove",
	"pointerup",
	"pointercancel",
] as const;

/**
 * On-screen touch controls, reported as a gamepad: sticks and buttons drawn
 * over the game, read by the engine as a pad in a gamepad slot. Everything a
 * game binds with `input.bindGamepad` answers to them, so the same code
 * reads a real pad and the touch controls.
 *
 * Register it once the application is created:
 * ```ts
 * plugin.register(GamepadPlugin, "gamepad", { buttons: 2 });
 * ```
 *
 * The controls follow each finger on its own, so a stick can be held while a
 * button is pressed; a touch that starts on a control does not reach the
 * game. They are drawn over the whole frame, above every renderable and
 * every camera, and outlive stage changes.
 * @category Plugins
 * @document ../README.md
 */
export class GamepadPlugin extends plugin.BasePlugin {
	/** the sticks, in the order of the options */
	readonly sticks: readonly VirtualStick[];
	/** the buttons, in the order of the options */
	readonly buttons: readonly VirtualButton[];
	/** the gamepad slot the controls report in */
	readonly index: number;

	private readonly pad: VirtualPad;
	private readonly look: Look;
	private readonly hideOnGamepad: boolean;
	private readonly marginOption: number | undefined;
	private _enabled: boolean;
	/** hidden while a real pad is in use */
	private hiddenByGamepad = false;
	/** whether the pad is in its slot */
	private added = false;
	/** the pointers taken by the controls, and what each one holds */
	private readonly pointers = new Map<
		number,
		VirtualStick | VirtualButton | null
	>();
	private readonly point = new Vector2d();
	private readonly savedProjection = new Matrix3d();
	private laidOut = { width: -1, height: -1 };
	private target: HTMLElement | null = null;
	private destroyed = false;
	private readonly originalDraw: Stage["draw"];
	private readonly drawStage: Stage["draw"];

	/**
	 * @param [options] - the controls, their look and how they behave
	 * @param [app] - the application the controls belong to, the running one
	 * by default: `plugin.register(GamepadPlugin, "gamepad", options, app)`
	 */
	constructor(options: GamepadPluginOptions = {}, app?: Application) {
		super(app);
		this.version = minimumEngineVersion();

		this.index = options.index ?? 0;
		this.hideOnGamepad = options.hideOnGamepad ?? true;
		this.marginOption = options.margin;
		this.look = {
			color: options.color ?? "#ffffff",
			opacity: options.opacity ?? 0.35,
		};
		this.pad = new VirtualPad(options.vibrate ?? true);

		const repaint = (): void => {
			if (this.appAlive) {
				this.app.repaint();
			}
		};
		this.sticks = listOf<StickOptions>(options.sticks, 1)
			.slice(0, 2)
			.map((stick, i) => {
				return new VirtualStick(stick, i === 0 ? "left" : "right", this.pad);
			});
		this.buttons = listOf<ButtonOptions>(options.buttons, 1).map(
			(button, i) => {
				return new VirtualButton(button, i, this.pad, repaint);
			},
		);

		this.hiddenByGamepad = this.hideOnGamepad && realGamepadConnected();
		this._enabled = options.enabled ?? device.touch;
		if (this.appAlive) {
			this.layout();
		}
		// the slot first: taken already, it throws before anything is hooked
		this.update();

		// drawn after the stage, so over every camera and everything in them
		// (called back with the stage as `this`, below)
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = Stage.prototype.draw;
		this.originalDraw = original;
		const drawOver = (renderer: Renderer): void => {
			if (!this.destroyed) {
				this.draw(renderer);
			}
		};
		this.drawStage = function (this: Stage, renderer, world) {
			original.call(this, renderer, world);
			drawOver(renderer);
		};
		Stage.prototype.draw = this.drawStage;

		event.on(event.GAMEPAD_CONNECTED, this.onConnected);
		event.on(event.GAMEPAD_DISCONNECTED, this.onDisconnected);
		event.on(event.VIEWPORT_ONRESIZE, this.onResize);
		this.listen();
	}

	/**
	 * Whether the controls are switched on. Set it to show or hide them at
	 * any time, as on a stage that only needs a tap. Switched off, they let
	 * go of everything they held.
	 *
	 * The controls can be switched on and still hidden, while the player uses
	 * a real pad: {@link GamepadPlugin#visible} says whether they show.
	 */
	get enabled(): boolean {
		return this._enabled;
	}

	set enabled(value: boolean) {
		this._enabled = value;
		this.update();
	}

	/**
	 * Whether the controls are on the screen: switched on, and not hidden for
	 * a real pad. A game can read it to word its prompts ("tap" rather than a
	 * key).
	 */
	get visible(): boolean {
		return this._enabled && !this.hiddenByGamepad && !this.destroyed;
	}

	/**
	 * Take the controls off the screen and out of their gamepad slot, and
	 * stop listening. They cannot be used again.
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.update();
		this.unlisten();
		event.off(event.GAMEPAD_CONNECTED, this.onConnected);
		event.off(event.GAMEPAD_DISCONNECTED, this.onDisconnected);
		event.off(event.VIEWPORT_ONRESIZE, this.onResize);
		// unhooked when nothing was hooked over it since; otherwise the hook
		// stays, and only calls through
		if (Stage.prototype.draw === this.drawStage) {
			Stage.prototype.draw = this.originalDraw;
		}
		for (const button of this.buttons) {
			button.destroy();
		}
	}

	/** apply a change of visibility */
	private update(): void {
		const visible = this.visible;
		if (!visible) {
			this.releaseAll();
		}
		if (visible && !this.added) {
			input.addVirtualGamepad(this.pad, this.index);
			this.added = true;
		} else if (!visible && this.added) {
			input.removeVirtualGamepad(this.pad);
			this.added = false;
		}
		if (this.appAlive) {
			this.app.repaint();
		}
	}

	/** let go of every control */
	private releaseAll(): void {
		for (const stick of this.sticks) {
			if (stick.pointerId !== null) {
				stick.release();
			}
		}
		for (const button of this.buttons) {
			button.releaseAll();
		}
		this.pointers.clear();
		this.pad.reset();
	}

	private readonly onConnected = (): void => {
		if (this.hideOnGamepad && !this.hiddenByGamepad) {
			this.hiddenByGamepad = true;
			this.update();
		}
	};

	private readonly onDisconnected = (): void => {
		if (this.hiddenByGamepad && !realGamepadConnected()) {
			this.hiddenByGamepad = false;
			this.update();
		}
	};

	/**
	 * whether the application is still there: one destroyed before the
	 * plugin leaves it with no viewport or renderer
	 */
	private get appAlive(): boolean {
		return (
			(this.app.viewport as unknown) !== undefined &&
			(this.app.renderer as unknown) !== undefined
		);
	}

	private readonly onResize = (): void => {
		// sent for any camera resized, a minimap's too: laid out again only
		// when the viewport changed size
		if (this.appAlive) {
			this.ensureLayout();
			this.app.repaint();
		}
	};

	/** place the controls for the current viewport */
	private layout(): void {
		const { width, height } = this.app.viewport;
		this.laidOut = { width, height };
		const margin =
			this.marginOption ?? Math.round(Math.min(width, height) * 0.06);
		for (const stick of this.sticks) {
			stick.layout(width, height, margin);
		}
		// the buttons go above a right stick, sharing its corner
		const right = this.sticks.find((stick) => {
			return stick.side === "right";
		});
		const floor = right ? right.radius * 2 + margin : 0;
		for (const button of this.buttons) {
			button.layout(width, height, margin, floor);
		}
	}

	/** listen to the pointers before the engine does */
	private listen(): void {
		const canvas = this.app.renderer.getCanvas();
		// the parent, in the capture phase: called before the engine's own
		// listeners on the canvas, so a touch on the controls can be kept
		// from them
		this.target = canvas.parentElement ?? canvas;
		for (const type of POINTER_EVENTS) {
			this.target.addEventListener(type, this.onPointer, {
				capture: true,
				passive: false,
			});
		}
		// no scrolling or zooming the page from the controls, even in a game
		// that never listens to the pointer itself
		input.setTouchAction(canvas);
	}

	private unlisten(): void {
		for (const type of POINTER_EVENTS) {
			this.target?.removeEventListener(type, this.onPointer, {
				capture: true,
			});
		}
		this.target = null;
	}

	private readonly onPointer = (e: PointerEvent): void => {
		if (!this.appAlive) {
			return;
		}
		const canvas = this.app.renderer.getCanvas();
		const held = this.pointers.has(e.pointerId);

		if (e.type === "pointerdown") {
			if (e.target !== canvas) {
				return;
			}
			// a touch brings back the controls hidden for a real pad
			if (this.hiddenByGamepad && e.pointerType === "touch" && this._enabled) {
				this.hiddenByGamepad = false;
				this.update();
			}
			if (!this.visible) {
				return;
			}
			const { x, y } = this.toViewport(e);
			const control = this.controlAt(x, y);
			if (control === null) {
				// not for the controls: the game has it
				return;
			}
			this.pointers.set(e.pointerId, control);
			if (control instanceof VirtualStick) {
				control.grab(e.pointerId, x, y);
			} else {
				control.press(e.pointerId);
			}
			// moves and the release keep coming here even off the canvas.
			// It throws for a pointer the browser no longer counts as down,
			// which only loses the moves made off the canvas
			try {
				canvas.setPointerCapture(e.pointerId);
			} catch {
				// nothing to capture
			}
			this.consume(e);
			this.app.repaint();
			return;
		}

		if (!held) {
			return;
		}
		const control = this.pointers.get(e.pointerId) ?? null;

		if (e.type === "pointermove") {
			const { x, y } = this.toViewport(e);
			if (control instanceof VirtualStick) {
				control.move(x, y);
			} else {
				// a finger sliding from one button to the next presses the
				// next, as on a pad; off every button it presses none
				const next = this.buttonAt(x, y);
				if (next !== control) {
					control?.release(e.pointerId);
					next?.press(e.pointerId);
					this.pointers.set(e.pointerId, next);
				}
			}
		} else {
			// pointerup, pointercancel
			if (control instanceof VirtualStick) {
				control.release();
			} else {
				control?.release(e.pointerId);
			}
			this.pointers.delete(e.pointerId);
		}
		this.consume(e);
		this.app.repaint();
	};

	/**
	 * keep an event on the controls from the engine and the page
	 * @param e - the pointer event
	 */
	private consume(e: PointerEvent): void {
		e.stopPropagation();
		if (e.cancelable) {
			e.preventDefault();
		}
	}

	/**
	 * where a pointer is, in viewport pixels
	 * @param e - the pointer event
	 */
	private toViewport(e: PointerEvent): Vector2d {
		return input.globalToLocal(e.clientX, e.clientY, this.point);
	}

	/**
	 * the control a finger landing here takes, buttons first
	 * @param x - in viewport pixels
	 * @param y - in viewport pixels
	 */
	private controlAt(x: number, y: number): VirtualStick | VirtualButton | null {
		this.ensureLayout();
		const button = this.buttonAt(x, y);
		if (button !== null) {
			return button;
		}
		const { width } = this.app.viewport;
		// a fixed stick before a floating one, which takes a whole half
		const sticks = [...this.sticks].sort((a, b) => {
			return Number(a.floating) - Number(b.floating);
		});
		for (const stick of sticks) {
			if (stick.pointerId === null && stick.hits(x, y, width)) {
				return stick;
			}
		}
		return null;
	}

	private buttonAt(x: number, y: number): VirtualButton | null {
		for (const button of this.buttons) {
			if (button.hits(x, y)) {
				return button;
			}
		}
		return null;
	}

	/** lay out again if the viewport changed size since */
	private ensureLayout(): void {
		const { width, height } = this.app.viewport;
		if (width !== this.laidOut.width || height !== this.laidOut.height) {
			this.layout();
		}
	}

	/**
	 * draw the controls over the frame, in viewport pixels
	 * @param renderer - the renderer drawing the frame
	 */
	private draw(renderer: Renderer): void {
		if (!this.visible || !this.appAlive || renderer !== this.app.renderer) {
			return;
		}
		this.ensureLayout();
		const lineWidth = renderer.lineWidth;
		this.savedProjection.copy(renderer.projectionMatrix);
		renderer.save();
		renderer.setProjection(this.app.viewport.screenProjection);
		renderer.resetTransform();
		renderer.lineWidth = Math.max(
			2,
			Math.round(Math.min(this.laidOut.width, this.laidOut.height) / 160),
		);
		for (const stick of this.sticks) {
			stick.draw(renderer, this.look);
		}
		for (const button of this.buttons) {
			button.draw(renderer, this.look);
		}
		renderer.restore();
		renderer.lineWidth = lineWidth;
		renderer.setProjection(this.savedProjection);
	}
}
