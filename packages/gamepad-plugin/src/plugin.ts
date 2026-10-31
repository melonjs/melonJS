import {
	type Application,
	type Camera2d,
	device,
	event,
	input,
	Matrix3d,
	plugin,
	type Renderer,
	Stage,
	utils,
	Vector2d,
	version,
} from "melonjs";
import packageJson from "../package.json" with { type: "json" };
import { type Look, VirtualButton, VirtualStick } from "./controls.ts";
import { VirtualPad, virtualGamepads } from "./pad.ts";
import type {
	ButtonOptions,
	GamepadPluginOptions,
	StickOptions,
} from "./types.ts";

/**
 * the lowest melonJS version supported, taken from the peer dependency
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

/** the gamepads the browser reports */
function realGamepads(): Gamepad[] {
	if (typeof navigator.getGamepads !== "function") {
		return [];
	}
	return navigator.getGamepads().filter((pad) => {
		return pad !== null;
	});
}

/**
 * whether the player is using a real pad: a button down or a stick pushed
 * @param pads - the gamepads the browser reports
 */
function inUse(pads: Gamepad[]): boolean {
	return pads.some((pad) => {
		return (
			pad.buttons.some((button) => {
				return button.pressed;
			}) ||
			pad.axes.some((axis) => {
				return Math.abs(axis) > 0.5;
			})
		);
	});
}

/** the gamepad slots taken by touch controls */
const claimed = new Set<number>();

/** styles that keep a held finger from selecting the canvas or opening a menu */
const NO_SELECTION: [string, string][] = [
	["user-select", "none"],
	["-webkit-user-select", "none"],
	["-webkit-touch-callout", "none"],
	["-webkit-tap-highlight-color", "transparent"],
];

const POINTER_EVENTS = [
	"pointerdown",
	"pointermove",
	"pointerup",
	"pointercancel",
] as const;

/**
 * The hover events a touch also fires: over and enter just before its
 * pointer-down, out and leave just after its pointer-up. The engine listens
 * to them too, so a touch on the controls has to be kept from it here as
 * well, or the widget under a button lights up as it is pressed (#1805).
 */
const HOVER_EVENTS = [
	"pointerover",
	"pointerenter",
	"pointerout",
	"pointerleave",
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
	/** how long a button press vibrates, in milliseconds */
	private readonly haptics: number;
	private readonly look: Look;
	private readonly hideOnGamepad: boolean;
	private readonly marginOption: number | undefined;
	private _enabled: boolean;
	/** hidden while a real pad is in use */
	private hiddenByGamepad = false;
	/** a real pad is connected, so the pads are watched for use */
	private padsConnected = false;
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
	/** the canvas styles changed while listening, to put back */
	private savedStyles: [string, string][] = [];
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

		// checked here rather than left to `plugin.register`, which only
		// checks once the constructor has hooked everything
		if (utils.checkVersion(this.version, version) > 0) {
			throw new Error(
				`GamepadPlugin needs melonJS ${this.version} or later, not ${version}`,
			);
		}
		if (!this.app.isInitialized) {
			throw new Error("GamepadPlugin: register it once app.init() is done");
		}
		this.index = options.index ?? 0;
		if (claimed.has(this.index)) {
			throw new Error(
				`gamepad ${this.index} already has touch controls, give these another index`,
			);
		}

		this.hideOnGamepad = options.hideOnGamepad ?? true;
		this.marginOption = options.margin;
		this.look = {
			color: options.color ?? "#ffffff",
			opacity: options.opacity ?? 0.35,
		};
		this.pad = new VirtualPad(options.vibrate ?? true);
		this.haptics = options.haptics ?? 10;

		const repaint = (): void => {
			if (this.ready) {
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

		this.padsConnected = realGamepads().length > 0;
		this.hiddenByGamepad = this.hideOnGamepad && this.padsConnected;
		this._enabled = options.enabled ?? device.touch;
		if (this.ready) {
			this.layout();
		}
		this.update();
		claimed.add(this.index);

		// drawn after the stage: over every camera and everything they draw
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
		event.on(event.GAME_BEFORE_UPDATE, this.watchPads);
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
		claimed.delete(this.index);
		this.unlisten();
		event.off(event.GAMEPAD_CONNECTED, this.onConnected);
		event.off(event.GAMEPAD_DISCONNECTED, this.onDisconnected);
		event.off(event.GAME_BEFORE_UPDATE, this.watchPads);
		event.off(event.VIEWPORT_ONRESIZE, this.onResize);
		// another plugin may have wrapped the draw since; then ours stays in
		// the chain, and does nothing once destroyed
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
			virtualGamepads.addVirtualGamepad(this.pad, this.index);
			this.added = true;
		} else if (!visible && this.added) {
			virtualGamepads.removeVirtualGamepad(this.pad);
			this.added = false;
		}
		if (this.ready) {
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

	/** hide the controls, for a real pad */
	private hideForGamepad(): void {
		if (this.hideOnGamepad && !this.hiddenByGamepad) {
			this.hiddenByGamepad = true;
			this.update();
		}
	}

	private readonly onConnected = (): void => {
		// browsers report a pad once one of its buttons is pressed
		this.padsConnected = true;
		this.hideForGamepad();
	};

	private readonly onDisconnected = (): void => {
		this.padsConnected = realGamepads().length > 0;
		if (this.hiddenByGamepad && !this.padsConnected) {
			this.hiddenByGamepad = false;
			this.update();
		}
	};

	// hide again when the player goes back to the pad after touching the
	// screen, which no event reports
	private readonly watchPads = (): void => {
		if (this.padsConnected && this.visible && inUse(realGamepads())) {
			this.hideForGamepad();
		}
	};

	/**
	 * whether the application can be drawn to: initialized, not destroyed,
	 * and with a viewport, which comes with its first stage
	 */
	private get ready(): boolean {
		return (
			this.app.isInitialized &&
			(this.app.viewport as Camera2d | undefined) !== undefined
		);
	}

	private readonly onResize = (): void => {
		// sent when any camera is resized, a minimap too
		if (this.ready) {
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
		// capturing on the parent runs before the engine's listeners on the
		// canvas, so touches on the controls can be stopped here
		this.target = canvas.parentElement ?? canvas;
		for (const type of POINTER_EVENTS) {
			this.target.addEventListener(type, this.onPointer, {
				capture: true,
				passive: false,
			});
		}
		for (const type of HOVER_EVENTS) {
			this.target.addEventListener(type, this.onHover, { capture: true });
		}
		// a finger held on the controls starts a selection, the iOS image
		// menu or the context menu, none of which a pointer event can cancel
		this.target.addEventListener("touchstart", this.onTouchStart, {
			capture: true,
			passive: false,
		});
		canvas.addEventListener("contextmenu", this.onContextMenu);
		this.savedStyles = NO_SELECTION.map(([name, value]) => {
			const saved: [string, string] = [
				name,
				canvas.style.getPropertyValue(name),
			];
			canvas.style.setProperty(name, value);
			return saved;
		});
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
		for (const type of HOVER_EVENTS) {
			this.target?.removeEventListener(type, this.onHover, { capture: true });
		}
		this.touchesOnControls.clear();
		this.target?.removeEventListener("touchstart", this.onTouchStart, {
			capture: true,
		});
		this.target = null;
		if (this.app.isInitialized) {
			const canvas = this.app.renderer.getCanvas();
			canvas.removeEventListener("contextmenu", this.onContextMenu);
			// in reverse: browsers alias some of them (user-select and its
			// -webkit- form), so the first saved holds the value from before
			for (const [name, value] of [...this.savedStyles].reverse()) {
				canvas.style.setProperty(name, value);
			}
		}
		this.savedStyles = [];
	}

	private readonly onTouchStart = (e: TouchEvent): void => {
		if (!this.visible || !this.ready) {
			return;
		}
		for (const touch of Array.from(e.changedTouches)) {
			const { x, y } = this.toViewport(touch);
			if (this.onControls(x, y)) {
				e.preventDefault();
				return;
			}
		}
	};

	private readonly onContextMenu = (e: Event): void => {
		if (this.visible) {
			e.preventDefault();
		}
	};

	private readonly onPointer = (e: PointerEvent): void => {
		if (!this.ready) {
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
			this.touchesOnControls.add(e.pointerId);
			if (control instanceof VirtualStick) {
				control.grab(e.pointerId, x, y);
			} else {
				control.press(e.pointerId);
				this.pad.tick(this.haptics);
			}
			// so moves and the release still come here off the canvas
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
					if (next) {
						next.press(e.pointerId);
						this.pad.tick(this.haptics);
					}
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
	 * The pointers whose touch landed on the controls, kept past their
	 * release for the out and leave that follow it.
	 */
	private readonly touchesOnControls = new Set<number>();

	/**
	 * Keep a touch's hover events from the game when the touch is the
	 * controls': over and enter when it lands on one, out and leave once it
	 * lifts from one. A mouse hovering over the controls is left alone, as
	 * its moves are.
	 * @param e - the hover event
	 */
	private readonly onHover = (e: PointerEvent): void => {
		if (!this.ready || e.pointerType === "mouse") {
			return;
		}
		if (e.type === "pointerover" || e.type === "pointerenter") {
			if (!this.visible) {
				return;
			}
			const { x, y } = this.toViewport(e);
			if (this.touchesOnControls.has(e.pointerId) || this.onControls(x, y)) {
				this.touchesOnControls.add(e.pointerId);
				e.stopPropagation();
			}
			return;
		}
		// pointerout, pointerleave
		if (this.touchesOnControls.has(e.pointerId)) {
			e.stopPropagation();
			if (e.type === "pointerleave") {
				this.touchesOnControls.delete(e.pointerId);
			}
		}
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
	 * where a pointer is, in viewport pixels, as `input.globalToLocal` gives
	 * it but on this application's canvas
	 * @param e - the pointer or touch
	 * @param e.clientX - its position in the window
	 * @param e.clientY - its position in the window
	 */
	private toViewport(e: { clientX: number; clientY: number }): Vector2d {
		const rect = this.app.renderer.getCanvas().getBoundingClientRect();
		const scale = this.app.renderer.scaleRatio;
		const ratio = globalThis.devicePixelRatio || 1;
		return this.point.set(
			((e.clientX - rect.left) / scale.x) * ratio,
			((e.clientY - rect.top) / scale.y) * ratio,
		);
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

	/**
	 * whether a point is on a control, held or not
	 * @param x - in viewport pixels
	 * @param y - in viewport pixels
	 */
	private onControls(x: number, y: number): boolean {
		this.ensureLayout();
		const { width } = this.app.viewport;
		return (
			this.buttonAt(x, y) !== null ||
			this.sticks.some((stick) => {
				return stick.hits(x, y, width);
			})
		);
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
		if (!this.visible || !this.ready || renderer !== this.app.renderer) {
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
