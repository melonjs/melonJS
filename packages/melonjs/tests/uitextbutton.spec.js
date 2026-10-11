import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Container,
	event,
	input,
	loader,
	UITextButton,
	video,
} from "../src/index.js";

// Regression coverage for https://github.com/melonjs/melonJS/issues/1499 —
// UITextButton.draw() dropped the viewport argument when chaining to
// Container.draw(), which dereferences `viewport.isDefault` and crashed
// with a TypeError for every UITextButton added to the world.

// Minimal fake camera mimicking the Camera2d surface Container.draw touches.
function makeFakeCamera({ isDefault } = { isDefault: true }) {
	return {
		isDefault,
		screenProjection: { __id: "screenProjection" },
		projectionMatrix: { __id: "projectionMatrix" },
		worldProjection: { __id: "worldProjection" },
		width: 800,
		height: 600,
		pos: { x: 0, y: 0 },
		colorMatrix: {
			isIdentity: () => {
				return true;
			},
		},
		isVisible: () => {
			return true;
		},
	};
}

// Minimal fake renderer covering Container.draw, UITextButton.draw
// (setColor/fill/stroke) and the BitmapText child draw path (drawImage).
function makeFakeRenderer() {
	const noop = () => {};
	return {
		setProjection: vi.fn(),
		save: noop,
		restore: noop,
		resetTransform: noop,
		translate: noop,
		transform: noop,
		clearColor: noop,
		clipRect: noop,
		setColor: noop,
		fill: noop,
		stroke: noop,
		drawImage: noop,
		clearMask: noop,
		setMask: noop,
		setBlendMode: noop,
		getBlendMode: () => {
			return "normal";
		},
		setTint: noop,
		clearTint: noop,
		setDepth: noop,
		setGlobalAlpha: noop,
		globalAlpha: () => {
			return 1;
		},
		getGlobalAlpha: () => {
			return 1;
		},
		setCustomShader: noop,
		clearCustomShader: noop,
		beginPostEffect: noop,
		endPostEffect: noop,
		currentTransform: {
			isIdentity: () => {
				return true;
			},
		},
	};
}

function makeButton(settings = {}) {
	return new UITextButton(50, 50, {
		font: "xolo12",
		text: "Play",
		borderWidth: 200,
		borderHeight: 50,
		...settings,
	});
}

let app;

describe("UITextButton", () => {
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "xolo12",
						type: "image",
						src: "/data/fnt/xolo12.png",
					},
					{
						name: "xolo12",
						type: "binary",
						src: "/data/fnt/xolo12.fnt",
					},
				],
				resolve,
			);
		});
	});

	it("draw() forwards the viewport to Container.draw (#1499)", () => {
		const button = makeButton();
		const cam = makeFakeCamera();
		const superDraw = vi.spyOn(Container.prototype, "draw");

		try {
			button.draw(makeFakeRenderer(), cam);
			expect(superDraw).toHaveBeenCalled();
			const lastCall = superDraw.mock.calls[superDraw.mock.calls.length - 1];
			expect(lastCall[1]).toBe(cam);
		} finally {
			superDraw.mockRestore();
		}
	});

	it("draw() does not throw when called by a parent Container draw pass", () => {
		const parent = new Container(0, 0, 800, 600, true);
		const button = makeButton();
		parent.addChild(button);
		button.inViewport = true;

		expect(() => {
			parent.draw(makeFakeRenderer(), makeFakeCamera());
		}).not.toThrow();

		parent.removeChildNow(button);
	});

	describe("keyboard binding", () => {
		let button;

		const addButton = (bindKey) => {
			button = makeButton({ bindKey });
			button.anchorPoint.set(0, 0);
			vi.spyOn(button, "onClick");
			vi.spyOn(button, "onRelease");
			app.world.addChild(button);
			return button;
		};

		const pointer = (type, x, y) => {
			app.world.broadphase.clear();
			app.world.broadphase.insertContainer(app.world);
			const canvas = app.renderer.getCanvas();
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(
				new PointerEvent(type, {
					clientX: rect.left + (x * rect.width) / canvas.width,
					clientY: rect.top + (y * rect.height) / canvas.height,
					pointerId: 1,
					isPrimary: true,
					bubbles: true,
				}),
			);
		};

		afterEach(() => {
			if (button?.ancestor) {
				button.ancestor.removeChildNow(button);
			} else {
				button?.destroy();
			}
			input.unbindKey(input.KEY.ENTER);
			input.unbindKey(input.KEY.SPACE);
			button = undefined;
			vi.restoreAllMocks();
		});

		it("clicks once per numeric key press and releases only the initiating key", () => {
			addButton(input.KEY.ENTER);
			button.isDirty = false;
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledExactlyOnceWith();
			expect(button.released).toBe(false);
			expect(button.isDirty).toBe(true);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			input.triggerKeyEvent(input.KEY.SPACE, false);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			expect(button.onRelease).not.toHaveBeenCalled();
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.released).toBe(true);
			expect(button.onRelease).toHaveBeenCalledExactlyOnceWith();
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(2);
		});

		it("uses an existing action without replacing its global binding", () => {
			input.bindKey(input.KEY.ENTER, "play");
			input.bindKey(input.KEY.SPACE, "play");
			addButton("play");
			input.triggerKeyEvent(input.KEY.ENTER, true);
			input.triggerKeyEvent(input.KEY.SPACE, true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			input.triggerKeyEvent(input.KEY.SPACE, false);
			expect(button.released).toBe(false);
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
			app.world.removeChildNow(button, true);
			expect(input.getBindingKey(input.KEY.ENTER)).toBe("play");
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(input.keyStatus("play")).toBe(true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			input.triggerKeyEvent(input.KEY.ENTER, false);
		});

		it("receives real browser keyboard events", () => {
			addButton(input.KEY.ENTER);
			for (const type of ["keydown", "keydown", "keyup"]) {
				globalThis.dispatchEvent(
					new KeyboardEvent(type, { keyCode: input.KEY.ENTER }),
				);
			}
			expect(button.onClick).toHaveBeenCalledTimes(1);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
		});

		it("ignores unrelated keys, unbound buttons and non-clickable buttons", () => {
			addButton();
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).not.toHaveBeenCalled();
			button.bindKey = input.KEY.ENTER;
			input.triggerKeyEvent(input.KEY.SPACE, true);
			button.isClickable = false;
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).not.toHaveBeenCalled();
			button.isClickable = true;
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
		});

		it("subscribes only while active and resets a held key on removal", () => {
			button = makeButton({ bindKey: input.KEY.ENTER });
			vi.spyOn(button, "onClick");
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).not.toHaveBeenCalled();
			app.world.addChild(button);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			app.world.removeChildNow(button, true);
			expect(button.released).toBe(true);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			app.world.addChild(button);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(2);
		});

		it("unsubscribes its key handlers when deactivated", async () => {
			// `keyboardActive` gates both handlers, so dropping the `off()`
			// calls changes no BEHAVIOUR at all: every assertion above still
			// passes while each add/remove cycle leaks two listeners onto the
			// global bus, and every later key press walks all of them.
			// Counting net subscriptions is the only thing that sees it.
			const { EventEmitter } = await import("../src/system/eventEmitter.js");
			const net = { [event.KEYDOWN]: 0, [event.KEYUP]: 0 };
			const proto = EventEmitter.prototype;
			const on = proto.addListener;
			const off = proto.removeListener;
			proto.addListener = function (e, ...rest) {
				if (e in net) {
					net[e]++;
				}
				return on.call(this, e, ...rest);
			};
			proto.removeListener = function (e, ...rest) {
				if (e in net) {
					net[e]--;
				}
				return off.call(this, e, ...rest);
			};
			try {
				for (let i = 0; i < 20; i++) {
					const b = makeButton({ bindKey: input.KEY.ENTER });
					app.world.addChild(b);
					app.world.removeChildNow(b, true);
				}
				expect(net[event.KEYDOWN]).toBe(0);
				expect(net[event.KEYUP]).toBe(0);
			} finally {
				proto.addListener = on;
				proto.removeListener = off;
			}
		});

		it("cancels a held key on blur without firing a release callback", () => {
			addButton(input.KEY.ENTER);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			event.emit(event.BLUR);
			expect(button.released).toBe(true);
			expect(button.onRelease).not.toHaveBeenCalled();
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(2);
		});

		it("releases the original physical key even if bindKey changes", () => {
			addButton(input.KEY.ENTER);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			button.bindKey = input.KEY.SPACE;
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
		});

		it("allows the click callback to remove the button", () => {
			addButton(input.KEY.ENTER);
			button.onClick.mockImplementation(() => {
				app.world.removeChildNow(button, true);
			});
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.released).toBe(true);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
		});

		it("does not let pointer presses or leaving release a held shortcut", () => {
			addButton(input.KEY.ENTER);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			pointer("pointermove", 75, 70);
			pointer("pointerdown", 75, 70);
			pointer("pointerup", 75, 70);
			pointer("pointermove", 400, 400);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			expect(button.onRelease).not.toHaveBeenCalled();
			expect(button.released).toBe(false);
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
		});

		it("does not let a shortcut release an existing pointer press", () => {
			addButton(input.KEY.ENTER);
			pointer("pointerdown", 75, 70);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			expect(button.onRelease).not.toHaveBeenCalled();
			expect(button.released).toBe(false);
			pointer("pointerup", 75, 70);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
		});

		it("still releases a shortcut disabled while held", () => {
			addButton(input.KEY.ENTER);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			button.isClickable = false;
			input.triggerKeyEvent(input.KEY.ENTER, false);
			expect(button.released).toBe(true);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
			input.triggerKeyEvent(input.KEY.ENTER, true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
		});

		it("preserves a numeric keycode of zero", () => {
			addButton(0);
			input.triggerKeyEvent(0, true);
			expect(button.onClick).toHaveBeenCalledTimes(1);
			input.triggerKeyEvent(0, false);
			expect(button.onRelease).toHaveBeenCalledTimes(1);
		});

		it("ignores a queued shortcut after an earlier listener removes the button", () => {
			button = makeButton({ bindKey: input.KEY.ENTER });
			vi.spyOn(button, "onClick");
			const remove = event.on(event.KEYDOWN, () => {
				app.world.removeChildNow(button, true);
			});
			try {
				app.world.addChild(button);
				input.triggerKeyEvent(input.KEY.ENTER, true);
				expect(button.ancestor).toBeUndefined();
				expect(button.onClick).not.toHaveBeenCalled();
			} finally {
				remove();
			}
		});
	});
});

describe("UITextButton in a real draw pass (#1499 repro)", () => {
	// The exact scenario from the issue: a UITextButton added to
	// app.world, drawn by the real default camera through the real
	// renderer — no fakes anywhere. The earlier unit tests pin the
	// viewport forwarding; this pins the whole production chain
	// (Camera2d.draw → World.draw → UITextButton.draw → Container.draw).
	it("draws through Camera2d → world → button without throwing", () => {
		const button = makeButton();
		app.world.addChild(button);
		// the draw walk skips children that are neither in-viewport nor
		// floating — force visibility so the button genuinely draws and
		// this test cannot pass vacuously
		button.inViewport = true;
		const drawSpy = vi.spyOn(button, "draw");

		try {
			expect(() => {
				app.viewport.draw(app.renderer, app.world);
			}).not.toThrow();

			// prove the button was actually reached by the draw walk...
			expect(drawSpy).toHaveBeenCalled();
			// ...and that the real camera was delivered as its viewport
			expect(drawSpy.mock.calls[0][1]).toBe(app.viewport);
		} finally {
			drawSpy.mockRestore();
			app.world.removeChildNow(button);
		}
	});
});

describe("Container.draw with omitted viewport (legacy super.draw(renderer))", () => {
	// `viewport` is documented optional — subclass overrides written
	// against the pre-multi-camera API chain up with super.draw(renderer).
	it("does not throw without a viewport", () => {
		const c = new Container(0, 0, 800, 600, true);
		const child = new (class extends Container {})(0, 0, 10, 10);
		c.addChild(child);
		child.inViewport = true;

		expect(() => {
			c.draw(makeFakeRenderer());
		}).not.toThrow();
	});

	it("skips the projection swap for floating children without a viewport", () => {
		const c = new Container(0, 0, 800, 600, true);
		const child = new (class extends Container {})(0, 0, 10, 10);
		child.floating = true;
		c.addChild(child);

		const r = makeFakeRenderer();
		expect(() => {
			c.draw(r);
		}).not.toThrow();
		expect(r.setProjection).not.toHaveBeenCalled();
	});
});
