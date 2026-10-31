import {
	Application,
	ColorLayer,
	event,
	input,
	plugin,
	Stage,
	video,
} from "melonjs";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	GamepadPlugin,
	type VirtualButton,
	type VirtualStick,
} from "../src/index.ts";

const { BUTTONS, AXES } = input.GAMEPAD;
const { KEY } = input;

let app: Application;
let canvas: HTMLCanvasElement;
let pads: (Gamepad | null)[];
const realGetGamepads = navigator.getGamepads;

const stageDraw = Stage.prototype.draw;

/** the engine reads the gamepads once a frame */
const poll = (): void => {
	event.emit(event.GAME_BEFORE_UPDATE, performance.now());
};

/**
 * send a pointer event to the canvas, at a point in viewport pixels
 * @param type - the event type
 * @param id - the pointer id
 * @param x - in viewport pixels
 * @param y - in viewport pixels
 * @param pointerType - `touch` or `mouse`
 */
const pointer = (
	type: string,
	id: number,
	x: number,
	y: number,
	pointerType = "touch",
): PointerEvent => {
	const rect = canvas.getBoundingClientRect();
	const e = new PointerEvent(type, {
		pointerId: id,
		pointerType,
		clientX: rect.left + (x * rect.width) / app.viewport.width,
		clientY: rect.top + (y * rect.height) / app.viewport.height,
		bubbles: true,
		cancelable: true,
		isPrimary: id === 1,
	});
	canvas.dispatchEvent(e);
	return e;
};

const down = (id: number, at: { x: number; y: number }) => {
	return pointer("pointerdown", id, at.x, at.y);
};
const move = (id: number, x: number, y: number) => {
	return pointer("pointermove", id, x, y);
};
const up = (id: number, at: { x: number; y: number }) => {
	return pointer("pointerup", id, at.x, at.y);
};

/**
 * a point leaning a stick by this much of its thumb's reach
 * @param stick - the stick
 * @param dx - across, in radii
 * @param dy - down, in radii
 */
const lean = (stick: VirtualStick, dx: number, dy: number) => {
	return {
		x: stick.center.x + dx * stick.reach,
		y: stick.center.y + dy * stick.reach,
	};
};

/**
 * what the canvas shows at a point in viewport pixels
 * @param x - in viewport pixels
 * @param y - in viewport pixels
 */
const pixel = (x: number, y: number): number[] => {
	app.repaint();
	app.draw();
	const context = canvas.getContext("2d")!;
	const sx = canvas.width / app.viewport.width;
	const sy = canvas.height / app.viewport.height;
	return Array.from(
		context.getImageData(Math.round(x * sx), Math.round(y * sy), 1, 1).data,
	);
};

beforeAll(async () => {
	app = new Application(480, 320, {
		parent: document.body,
		renderer: video.CANVAS,
	});
	await app.init();
	canvas = app.renderer.getCanvas();
	input.bindKey(KEY.X, "jump");
	input.bindKey(KEY.LEFT, "left");
	input.bindKey(KEY.RIGHT, "right");
	input.bindKey(KEY.UP, "up");
	input.bindKey(KEY.DOWN, "down");
	input.bindKey(KEY.A, "stickRight");
	input.bindGamepad(0, { type: "buttons", code: BUTTONS.FACE_1 }, KEY.X);
	input.bindGamepad(0, { type: "buttons", code: BUTTONS.LEFT }, KEY.LEFT);
	input.bindGamepad(0, { type: "buttons", code: BUTTONS.RIGHT }, KEY.RIGHT);
	input.bindGamepad(0, { type: "buttons", code: BUTTONS.UP }, KEY.UP);
	input.bindGamepad(0, { type: "buttons", code: BUTTONS.DOWN }, KEY.DOWN);
	input.bindGamepad(0, { type: "axes", code: AXES.LX, threshold: 0.3 }, KEY.A);
});

afterAll(() => {
	app.destroy();
});

beforeEach(() => {
	// no real pad, whatever the machine running the tests has
	pads = [null, null, null, null];
	navigator.getGamepads = () => {
		return pads;
	};
});

afterEach(() => {
	navigator.getGamepads = realGetGamepads;
});

describe("GamepadPlugin", () => {
	let gamepad: GamepadPlugin;
	let button: VirtualButton;
	let stick: VirtualStick;

	beforeEach(() => {
		gamepad = new GamepadPlugin({ enabled: true, buttons: 2 }, app);
		button = gamepad.buttons[0]!;
		stick = gamepad.sticks[0]!;
		// the layout follows the viewport, done on the first draw or touch
		app.repaint();
		app.draw();
	});

	afterEach(() => {
		gamepad.destroy();
		// let go of anything a test left held
		poll();
	});

	it("registers as a plugin, its version taken from the peer range", () => {
		gamepad.destroy();
		plugin.register(GamepadPlugin, "gamepad", { enabled: true }, app);
		const registered = plugin.cache.gamepad as GamepadPlugin;
		expect(registered).toBeInstanceOf(GamepadPlugin);
		expect(registered.version).toMatch(/^\d+\.\d+\.\d+$/);
		registered.destroy();
	});

	it("puts its pad in slot 0 while visible", () => {
		expect(gamepad.visible).toBe(true);
		expect(input.activeGamepad()).toBe(0);
	});

	it("refuses a slot taken by other controls, even switched off", () => {
		expect(() => {
			return new GamepadPlugin({ enabled: false }, app);
		}).toThrow(/already has touch controls/);
	});

	it("refuses a slot already taken, leaving nothing behind", () => {
		const hooked = Stage.prototype.draw;
		expect(() => {
			return new GamepadPlugin({ enabled: true }, app);
		}).toThrow();
		expect(Stage.prototype.draw).toBe(hooked);
		// the first one still has the touches
		down(1, button.center);
		expect(button.pressed).toBe(true);
		up(1, button.center);
	});

	it("is hidden by default where there is no touch screen", () => {
		const desktop = new GamepadPlugin({ index: 3 }, app);
		// the test browser has no touch screen
		expect(desktop.enabled).toBe(false);
		expect(desktop.visible).toBe(false);
		desktop.destroy();
	});

	it("presses the pad button a game binds", () => {
		down(1, button.center);
		poll();
		expect(button.pressed).toBe(true);
		expect(input.keyStatus("jump")).toBe(true);

		up(1, button.center);
		poll();
		expect(button.pressed).toBe(false);
		expect(input.keyStatus("jump")).toBe(false);
	});

	it("presses each button's own pad button, FACE_1 then FACE_2", () => {
		expect(gamepad.buttons[0].button).toBe(BUTTONS.FACE_1);
		expect(gamepad.buttons[1].button).toBe(BUTTONS.FACE_2);
		// and the second does not press the first
		down(1, gamepad.buttons[1].center);
		poll();
		expect(input.keyStatus("jump")).toBe(false);
		up(1, gamepad.buttons[1].center);
	});

	it("leans the stick, past the threshold of an axis binding", () => {
		const at = lean(stick, 0.9, 0);
		down(1, stick.center);
		move(1, at.x, at.y);
		poll();
		expect(stick.value.x).toBeGreaterThan(0.8);
		expect(input.keyStatus("stickRight")).toBe(true);

		up(1, at);
		poll();
		expect(stick.value.x).toBe(0);
		expect(input.keyStatus("stickRight")).toBe(false);
	});

	it("reads nothing inside the deadzone, and full travel at the rim", () => {
		down(1, stick.center);
		const near = lean(stick, 0.05, 0);
		move(1, near.x, near.y);
		expect(stick.value.x).toBe(0);
		const far = lean(stick, 3, 0);
		move(1, far.x, far.y);
		expect(stick.value.x).toBeCloseTo(1, 5);
		up(1, far);
	});

	it("reads full where the thumb stops, with the thumb under the finger", () => {
		down(1, stick.center);
		const edge = lean(stick, 1, 0);
		move(1, edge.x, edge.y);
		expect(stick.value.x).toBeCloseTo(1, 5);
		// half way out reads about half, past the deadzone
		const half = lean(stick, 0.5, 0);
		move(1, half.x, half.y);
		expect(stick.value.x).toBeCloseTo((0.5 - 0.1) / 0.9, 5);
		up(1, half);
	});

	it("presses the D-pad once the thumb is half way out", () => {
		down(1, stick.center);
		const short = lean(stick, 0.45, 0);
		move(1, short.x, short.y);
		poll();
		expect(input.keyStatus("right")).toBe(false);
		const half = lean(stick, 0.52, 0);
		move(1, half.x, half.y);
		poll();
		expect(input.keyStatus("right")).toBe(true);
		up(1, half);
		poll();
	});

	it("presses the D-pad sooner with a lower threshold", () => {
		gamepad.destroy();
		gamepad = new GamepadPlugin(
			{ enabled: true, sticks: [{ dpadThreshold: 0.2 }] },
			app,
		);
		const [soft] = gamepad.sticks;
		down(1, soft.center);
		const near = lean(soft, 0.35, 0);
		move(1, near.x, near.y);
		poll();
		expect(input.keyStatus("right")).toBe(true);
		up(1, near);
		poll();
	});

	it("presses the D-pad in 8 directions", () => {
		down(1, stick.center);
		const upLeft = lean(stick, -0.7, -0.7);
		move(1, upLeft.x, upLeft.y);
		poll();
		expect(input.keyStatus("up")).toBe(true);
		expect(input.keyStatus("left")).toBe(true);
		expect(input.keyStatus("right")).toBe(false);
		expect(input.keyStatus("down")).toBe(false);

		const right = lean(stick, 0.9, 0.1);
		move(1, right.x, right.y);
		poll();
		expect(input.keyStatus("right")).toBe(true);
		expect(input.keyStatus("up")).toBe(false);
		expect(input.keyStatus("left")).toBe(false);
		up(1, right);
	});

	it("holds the stick and a button at once, each by its own finger", () => {
		const at = lean(stick, 0.9, 0);
		down(1, stick.center);
		move(1, at.x, at.y);
		down(2, button.center);
		poll();
		expect(input.keyStatus("stickRight")).toBe(true);
		expect(input.keyStatus("jump")).toBe(true);

		// the button let go, the stick still held
		up(2, button.center);
		move(1, at.x, at.y + 1);
		poll();
		expect(input.keyStatus("jump")).toBe(false);
		expect(input.keyStatus("stickRight")).toBe(true);
		up(1, at);
	});

	it("keeps the stick when the thumb drifts off its base", () => {
		down(1, stick.center);
		const far = lean(stick, 2.5, 0);
		move(1, far.x, far.y);
		poll();
		expect(input.keyStatus("stickRight")).toBe(true);
		up(1, far);
		poll();
		expect(input.keyStatus("stickRight")).toBe(false);
	});

	it("finds the controls on a scrolled page", () => {
		const spacer = document.createElement("div");
		spacer.style.height = "3000px";
		document.body.appendChild(spacer);
		window.scrollTo(0, 200);
		try {
			expect(window.scrollY).toBe(200);
			down(1, button.center);
			expect(button.pressed).toBe(true);
			up(1, button.center);
			expect(button.pressed).toBe(false);
		} finally {
			window.scrollTo(0, 0);
			spacer.remove();
		}
	});

	it("does not let a finger held on the controls select the canvas", () => {
		// (-webkit-touch-callout, for iOS, is not read back by Chromium)
		expect(canvas.style.getPropertyValue("user-select")).toBe("none");

		const touchAt = (x: number, y: number): TouchEvent => {
			const rect = canvas.getBoundingClientRect();
			const touch = new Touch({
				identifier: 1,
				target: canvas,
				clientX: rect.left + (x * rect.width) / app.viewport.width,
				clientY: rect.top + (y * rect.height) / app.viewport.height,
			});
			const e = new TouchEvent("touchstart", {
				touches: [touch],
				changedTouches: [touch],
				bubbles: true,
				cancelable: true,
			});
			canvas.dispatchEvent(e);
			return e;
		};
		// on a control: no selection, magnifier or image menu
		expect(touchAt(button.center.x, button.center.y).defaultPrevented).toBe(
			true,
		);
		expect(touchAt(stick.center.x, stick.center.y).defaultPrevented).toBe(true);
		// elsewhere: the page's and the game's own business
		expect(touchAt(app.viewport.width / 2, 20).defaultPrevented).toBe(false);
	});

	it("blocks the context menu only while the controls show", () => {
		const menu = (): boolean => {
			const e = new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
			});
			canvas.dispatchEvent(e);
			return e.defaultPrevented;
		};
		expect(menu()).toBe(true);
		gamepad.enabled = false;
		expect(menu()).toBe(false);
	});

	it("puts the canvas styles back once destroyed", () => {
		gamepad.destroy();
		expect(canvas.style.getPropertyValue("user-select")).toBe("");
	});

	it("keeps a touch on the controls from the game, and not the others", () => {
		const spy = vi.fn();
		input.registerPointerEvent("pointerdown", app.viewport, spy);

		const onButton = down(1, button.center);
		up(1, button.center);
		expect(spy).not.toHaveBeenCalled();
		expect(onButton.defaultPrevented).toBe(true);

		down(2, { x: app.viewport.width / 2, y: 20 });
		up(2, { x: app.viewport.width / 2, y: 20 });
		expect(spy).toHaveBeenCalledOnce();

		input.releasePointerEvent("pointerdown", app.viewport, spy);
	});

	it("keeps a touch's hover from the game too (#1805)", () => {
		const enter = vi.fn();
		const leave = vi.fn();
		input.registerPointerEvent("pointerenter", app.viewport, enter);
		input.registerPointerEvent("pointerleave", app.viewport, leave);

		// a tap on a button: over and enter before the down, out and leave
		// after the up, as a touch fires them
		const at = button.center;
		const over = pointer("pointerover", 1, at.x, at.y);
		pointer("pointerenter", 1, at.x, at.y);
		down(1, at);
		up(1, at);
		pointer("pointerout", 1, at.x, at.y);
		pointer("pointerleave", 1, at.x, at.y);
		expect(enter).not.toHaveBeenCalled();
		expect(leave).not.toHaveBeenCalled();
		expect(over.defaultPrevented).toBe(false);

		// a tap on the game is the game's
		const game = { x: app.viewport.width / 2, y: 20 };
		pointer("pointerenter", 2, game.x, game.y);
		expect(enter).toHaveBeenCalledOnce();

		// and a mouse over a button is left alone, as its moves are
		pointer("pointerenter", 3, at.x, at.y, "mouse");
		expect(enter).toHaveBeenCalledTimes(2);

		input.releasePointerEvent("pointerenter", app.viewport, enter);
		input.releasePointerEvent("pointerleave", app.viewport, leave);
	});

	it("fires a locked key once per tap, however long it is held", () => {
		input.bindKey(KEY.X, "jump", true);
		down(1, button.center);
		poll();
		expect(input.isKeyPressed("jump")).toBe(true);
		poll();
		poll();
		expect(input.isKeyPressed("jump")).toBe(false);
		up(1, button.center);
		poll();
		down(1, button.center);
		poll();
		expect(input.isKeyPressed("jump")).toBe(true);
		up(1, button.center);
		input.bindKey(KEY.X, "jump");
	});

	it("presses the next button when a finger slides onto it", () => {
		const second = gamepad.buttons[1];
		down(1, button.center);
		move(1, second.center.x, second.center.y);
		expect(button.pressed).toBe(false);
		expect(second.pressed).toBe(true);
		up(1, second.center);
		expect(second.pressed).toBe(false);
	});

	it("can be switched off and on, letting go of what it held", () => {
		down(1, button.center);
		poll();
		expect(input.keyStatus("jump")).toBe(true);

		gamepad.enabled = false;
		poll();
		expect(gamepad.visible).toBe(false);
		expect(input.keyStatus("jump")).toBe(false);
		// hidden, a touch there is the game's
		down(2, button.center);
		expect(button.pressed).toBe(false);
		up(2, button.center);

		gamepad.enabled = true;
		expect(gamepad.visible).toBe(true);
	});

	describe("with a real gamepad", () => {
		const realPad = () => {
			return {
				id: "Real Pad",
				index: 1,
				mapping: "standard",
				connected: true,
				timestamp: 0,
				buttons: [{ pressed: false, value: 0 }],
				axes: [0, 0],
			} as unknown as Gamepad;
		};

		it("hides when one is connected, and shows again when it is gone", () => {
			pads[1] = realPad();
			event.emit(event.GAMEPAD_CONNECTED, pads[1]);
			expect(gamepad.visible).toBe(false);
			expect(gamepad.enabled).toBe(true);

			pads[1] = null;
			event.emit(event.GAMEPAD_DISCONNECTED, realPad());
			expect(gamepad.visible).toBe(true);
		});

		it("shows again when the screen is touched", () => {
			pads[1] = realPad();
			event.emit(event.GAMEPAD_CONNECTED, pads[1]);
			expect(gamepad.visible).toBe(false);

			down(1, button.center);
			expect(gamepad.visible).toBe(true);
			// and the touch presses the button it landed on
			expect(button.pressed).toBe(true);
			up(1, button.center);
		});

		it("hides again when the player goes back to the pad", () => {
			const pad = realPad();
			pads[1] = pad;
			event.emit(event.GAMEPAD_CONNECTED, pad);
			down(1, button.center);
			up(1, button.center);
			expect(gamepad.visible).toBe(true);

			// no event for this one: the pad is watched each frame
			poll();
			expect(gamepad.visible).toBe(true);
			(pad.buttons as unknown as { pressed: boolean }[])[0].pressed = true;
			poll();
			expect(gamepad.visible).toBe(false);
		});

		it("stays hidden on a click of the mouse", () => {
			pads[1] = realPad();
			event.emit(event.GAMEPAD_CONNECTED, pads[1]);
			pointer("pointerdown", 1, button.center.x, button.center.y, "mouse");
			expect(gamepad.visible).toBe(false);
			pointer("pointerup", 1, button.center.x, button.center.y, "mouse");
		});

		it("starts hidden when one is already connected", () => {
			pads[1] = realPad();
			const late = new GamepadPlugin({ enabled: true, index: 1 }, app);
			expect(late.visible).toBe(false);
			late.destroy();
		});

		it("stays visible when asked to", () => {
			const always = new GamepadPlugin(
				{ enabled: true, index: 1, hideOnGamepad: false },
				app,
			);
			pads[2] = realPad();
			event.emit(event.GAMEPAD_CONNECTED, pads[2]);
			expect(always.visible).toBe(true);
			always.destroy();
		});
	});

	describe("buttons that follow the game", () => {
		it("does not press a hidden button, and lets go of one hidden while held", () => {
			down(1, button.center);
			poll();
			button.visible = false;
			poll();
			expect(input.keyStatus("jump")).toBe(false);
			up(1, button.center);

			down(2, button.center);
			expect(button.pressed).toBe(false);
			up(2, button.center);
			button.visible = true;
		});

		it("still presses a dimmed button", () => {
			button.dimmed = true;
			down(1, button.center);
			expect(button.pressed).toBe(true);
			up(1, button.center);
			button.dimmed = false;
		});

		it("takes a new label", () => {
			button.label = "Use";
			expect(button.label).toBe("Use");
			// drawn with it without trouble
			app.repaint();
			app.draw();
		});
	});

	describe("drawing", () => {
		it("draws over a full-screen floating renderable at any depth", () => {
			// a black layer over everything else, as a fade or a darkness
			// overlay is: high, but inside the camera's depth range (1e6)
			const overlay = new ColorLayer("overlay", "#000000");
			app.world.addChild(overlay, 999_999);
			const covered = pixel(app.viewport.width / 2, 20);
			const onButton = pixel(button.center.x, button.center.y);
			app.world.removeChild(overlay);
			// the overlay is drawn, and the button is drawn over it
			expect(covered.slice(0, 3)).toEqual([0, 0, 0]);
			expect(onButton[0]).toBeGreaterThan(40);
		});

		it("draws nothing while hidden", () => {
			const overlay = new ColorLayer("overlay", "#000000");
			app.world.addChild(overlay, 999_999);
			gamepad.enabled = false;
			expect(pixel(button.center.x, button.center.y)[0]).toBe(0);
			app.world.removeChild(overlay);
		});

		it("follows the viewport when it is resized", () => {
			const { x } = button.center;
			const { width, height } = app.viewport;
			app.viewport.resize(width + 100, height);
			expect(button.center.x).toBe(x + 100);
			app.viewport.resize(width, height);
		});
	});

	describe("options", () => {
		it("presses a key, for a game that reads the keyboard", () => {
			gamepad.destroy();
			gamepad = new GamepadPlugin(
				{
					enabled: true,
					buttons: [{ key: KEY.X }],
					sticks: [{ keys: { right: KEY.RIGHT } }],
				},
				app,
			);
			app.draw();
			const [keyButton] = gamepad.buttons;
			const [keyStick] = gamepad.sticks;
			expect(keyButton.button).toBe(null);
			down(1, keyButton.center);
			// no poll: the key is pressed at once
			expect(input.keyStatus("jump")).toBe(true);
			up(1, keyButton.center);
			expect(input.keyStatus("jump")).toBe(false);

			down(2, keyStick.center);
			const at = lean(keyStick, 0.9, 0);
			move(2, at.x, at.y);
			expect(input.keyStatus("right")).toBe(true);
			up(2, at);
			expect(input.keyStatus("right")).toBe(false);
		});

		it("centers a floating stick where the thumb lands", () => {
			gamepad.destroy();
			gamepad = new GamepadPlugin(
				{ enabled: true, sticks: [{ floating: true }] },
				app,
			);
			app.draw();
			const [floating] = gamepad.sticks;
			const home = { ...floating.center };
			down(1, { x: 60, y: 60 });
			expect(floating.center).toEqual({ x: 60, y: 60 });
			expect(floating.value.x).toBe(0);
			up(1, { x: 60, y: 60 });
			expect(floating.center).toEqual(home);

			// the right half of the screen is not its own
			down(2, { x: app.viewport.width - 60, y: 60 });
			expect(floating.pointerId).toBe(null);
			up(2, { x: app.viewport.width - 60, y: 60 });
		});

		it("reports a second stick on the right axes, with the buttons above it", () => {
			gamepad.destroy();
			gamepad = new GamepadPlugin({ enabled: true, sticks: 2 }, app);
			app.draw();
			const [left, right] = gamepad.sticks;
			expect(left.side).toBe("left");
			expect(right.side).toBe("right");
			expect(gamepad.buttons[0].center.y).toBeLessThan(
				right.center.y - right.radius,
			);
			input.bindKey(KEY.D, "aimRight");
			input.bindGamepad(
				0,
				{ type: "axes", code: AXES.RX, threshold: 0.3 },
				KEY.D,
			);
			down(1, right.center);
			const at = lean(right, 0.9, 0);
			move(1, at.x, at.y);
			poll();
			expect(input.keyStatus("aimRight")).toBe(true);
			expect(input.keyStatus("stickRight")).toBe(false);
			// no D-pad from the right stick by default
			expect(input.keyStatus("right")).toBe(false);
			up(1, at);
			poll();
			input.unbindGamepad(0, AXES.RX, "axes");
			input.unbindKey(KEY.D);
		});

		it("uses the gamepad slot it is given", () => {
			gamepad.destroy();
			gamepad = new GamepadPlugin({ enabled: true, index: 2 }, app);
			app.draw();
			down(1, gamepad.buttons[0].center);
			poll();
			// slot 0 is bound, not slot 2
			expect(input.keyStatus("jump")).toBe(false);
			expect(input.activeGamepad()).toBe(2);
			up(1, gamepad.buttons[0].center);
		});

		it("gives a light tick on a button press, unless turned off", () => {
			const vibrate = vi.fn(() => {
				return true;
			});
			const real = navigator.vibrate;
			const tapped = (hasBeenActive: boolean): void => {
				Object.defineProperty(navigator, "userActivation", {
					value: { hasBeenActive },
					configurable: true,
				});
			};
			Object.defineProperty(navigator, "vibrate", {
				value: vibrate,
				configurable: true,
			});
			try {
				// before the first tap has ended, the browser would refuse
				tapped(false);
				down(1, button.center);
				up(1, button.center);
				expect(vibrate).not.toHaveBeenCalled();

				tapped(true);
				down(1, button.center);
				up(1, button.center);
				expect(vibrate).toHaveBeenCalledWith(10);
				// the stick gives none
				vibrate.mockClear();
				down(2, stick.center);
				up(2, stick.center);
				expect(vibrate).not.toHaveBeenCalled();

				gamepad.destroy();
				gamepad = new GamepadPlugin({ enabled: true, haptics: 0 }, app);
				down(3, gamepad.buttons[0].center);
				up(3, gamepad.buttons[0].center);
				expect(vibrate).not.toHaveBeenCalled();
			} finally {
				// back to the browser's own, on the prototype
				delete (navigator as { userActivation?: unknown }).userActivation;
				Object.defineProperty(navigator, "vibrate", {
					value: real,
					configurable: true,
				});
			}
		});

		it("does not cut a rumble short with a tick", async () => {
			const vibrate = vi.fn(() => {
				return true;
			});
			const real = navigator.vibrate;
			Object.defineProperty(navigator, "vibrate", {
				value: vibrate,
				configurable: true,
			});
			try {
				gamepad.destroy();
				gamepad = new GamepadPlugin({ enabled: true }, app);
				const rumble = input.vibrateGamepad(0, { duration: 200 });
				await new Promise((resolve) => {
					setTimeout(resolve, 20);
				});
				vibrate.mockClear();
				down(1, gamepad.buttons[0].center);
				up(1, gamepad.buttons[0].center);
				expect(vibrate).not.toHaveBeenCalled();
				await rumble;
			} finally {
				Object.defineProperty(navigator, "vibrate", {
					value: real,
					configurable: true,
				});
			}
		});

		it("vibrates the phone where the browser can", async () => {
			const vibrate = vi.fn(() => {
				return true;
			});
			const real = navigator.vibrate;
			Object.defineProperty(navigator, "vibrate", {
				value: vibrate,
				configurable: true,
			});
			try {
				gamepad.destroy();
				gamepad = new GamepadPlugin({ enabled: true }, app);
				expect(input.hasGamepadVibration(0)).toBe(true);
				await input.vibrateGamepad(0, { duration: 30 });
				expect(vibrate).toHaveBeenCalledWith(30);
			} finally {
				Object.defineProperty(navigator, "vibrate", {
					value: real,
					configurable: true,
				});
			}
		});
	});

	it("leaves the stage draw and the slot as they were once destroyed", () => {
		gamepad.destroy();
		expect(Stage.prototype.draw).toBe(stageDraw);
		expect(input.activeGamepad()).toBe(-1);
		// a touch is the game's again
		down(1, button.center);
		expect(button.pressed).toBe(false);
		up(1, button.center);
	});

	// last: the engine's pointer input follows the newest application, and
	// this one is destroyed
	it("outlives an application destroyed before it", async () => {
		const other = new Application(200, 100, {
			parent: document.body,
			renderer: video.CANVAS,
		});
		await other.init();
		const orphan = new GamepadPlugin({ enabled: true, index: 3 }, other);
		other.destroy();
		expect(() => {
			event.emit(event.VIEWPORT_ONRESIZE, 300, 200);
			orphan.buttons[0].label = "A";
			app.repaint();
			app.draw();
			orphan.destroy();
		}).not.toThrow();
	});

	it("refuses an application that is not initialized yet", () => {
		const hooked = Stage.prototype.draw;
		const early = new Application(200, 100, {
			parent: document.body,
			renderer: video.CANVAS,
		});
		expect(() => {
			return new GamepadPlugin({ enabled: true, index: 2 }, early);
		}).toThrow(/app.init/);
		expect(Stage.prototype.draw).toBe(hooked);
	});
});
