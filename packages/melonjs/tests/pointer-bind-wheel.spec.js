import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, input, video } from "../src/index.js";

/**
 * Turning the mouse wheel released a key bound to the left button.
 *
 * `bindPointer` presses its key on a pointerdown and releases it on any other
 * pointer event that reports that button. A wheel event is a mouse event
 * whose `button` is always 0, the left one, so scrolling while holding the
 * button (or while holding the same key on the keyboard, which the release
 * counted against) let go of the key.
 */
describe("input.bindPointer and the mouse wheel", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		input.bindKey(input.KEY.X, "fire");
	});

	afterAll(() => {
		input.unbindKey(input.KEY.X);
		app?.destroy();
	});

	afterEach(() => {
		input.unbindPointer(input.pointer.LEFT);
		input.unbindPointer(input.pointer.RIGHT);
		input.releaseAllPointerEvents(app.viewport);
		// rebinding clears whatever a failing test left held
		input.bindKey(input.KEY.X, "fire");
	});

	const centre = () => {
		const rect = app.renderer.getCanvas().getBoundingClientRect();
		return {
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
		};
	};

	const send = (type, button = 0) => {
		app.renderer.getCanvas().dispatchEvent(
			new PointerEvent(type, {
				...centre(),
				button,
				buttons: type === "pointerup" ? 0 : 1 << button,
				pointerId: 1,
				pointerType: "mouse",
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
				cancelable: true,
			}),
		);
	};

	const wheel = (deltaY = 100) => {
		const e = new WheelEvent("wheel", {
			...centre(),
			deltaY,
			// a wheel event always reports the main button
			button: 0,
			bubbles: true,
			cancelable: true,
		});
		app.renderer.getCanvas().dispatchEvent(e);
		return e;
	};

	it("keeps the key held while the bound button is, through a wheel turn", () => {
		input.bindPointer(input.KEY.X);
		send("pointerdown");
		expect(input.keyStatus("fire")).toBe(true);
		wheel();
		wheel(-100);
		expect(input.keyStatus("fire")).toBe(true);
		send("pointerup");
		expect(input.keyStatus("fire")).toBe(false);
	});

	it("keeps the same key held on the keyboard, through a wheel turn", () => {
		input.bindPointer(input.KEY.X);
		globalThis.dispatchEvent(
			new KeyboardEvent("keydown", { keyCode: input.KEY.X }),
		);
		expect(input.keyStatus("fire")).toBe(true);
		wheel();
		expect(input.keyStatus("fire")).toBe(true);
		globalThis.dispatchEvent(
			new KeyboardEvent("keyup", { keyCode: input.KEY.X }),
		);
		expect(input.keyStatus("fire")).toBe(false);
	});

	// ---- what must keep working --------------------------------------------

	it("does not press the key on a wheel turn either", () => {
		input.bindPointer(input.KEY.X);
		wheel();
		expect(input.keyStatus("fire")).toBe(false);
	});

	it("still delivers the wheel to the regions registered for it", () => {
		input.bindPointer(input.KEY.X);
		const deltas = [];
		input.registerPointerEvent("wheel", app.viewport, (pointer) => {
			deltas.push(pointer.deltaY);
		});
		const e = wheel(120);
		expect(deltas).toEqual([120]);
		// and the page does not scroll under the game
		expect(e.defaultPrevented).toBe(true);
	});

	it("still presses on pointerdown and releases on pointerup", () => {
		input.bindPointer(input.KEY.X);
		for (let i = 0; i < 3; i++) {
			send("pointerdown");
			expect(input.keyStatus("fire")).toBe(true);
			send("pointerup");
			expect(input.keyStatus("fire")).toBe(false);
		}
	});

	it("still releases the key when the pointer is cancelled", () => {
		input.bindPointer(input.KEY.X);
		send("pointerdown");
		send("pointercancel");
		expect(input.keyStatus("fire")).toBe(false);
	});

	it("leaves a key bound to another button alone", () => {
		input.bindPointer(input.pointer.RIGHT, input.KEY.X);
		send("pointerdown", 2);
		expect(input.keyStatus("fire")).toBe(true);
		wheel();
		expect(input.keyStatus("fire")).toBe(true);
		send("pointerup", 2);
		expect(input.keyStatus("fire")).toBe(false);
	});
});
