import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, input, video } from "../src/index.js";

/**
 * `input.bindPointer` maps a mouse button to a key. The bindings live on the
 * global `pointer`, and every pointer event used to replace them: each event
 * is normalized into a pooled `Pointer`, copied onto the global one with
 * `Object.assign`, and every `Pointer` carries its own (empty) `bind` list. A
 * binding was then gone as soon as the mouse entered the canvas, and a click
 * only reached the key when the pooled pointer it had been written into
 * happened to come back.
 */
describe("input.bindPointer", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		input.bindKey(input.KEY.X, "jump");
	});

	afterAll(() => {
		input.unbindKey(input.KEY.X);
		// browsers cap live contexts — a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	afterEach(() => {
		input.unbindPointer();
		// release anything a failing test left pressed
		input.triggerKeyEvent(input.KEY.X, false, 1);
	});

	/** send a pointer event to the canvas, at its middle */
	const send = (type, pointerId = 1) => {
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new PointerEvent(type, {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
				button: 0,
				buttons: type === "pointerup" ? 0 : 1,
				pointerId,
				pointerType: "mouse",
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
			}),
		);
	};

	it("keeps its binding through the events of a click", () => {
		input.bindPointer(input.KEY.X);
		// the mouse comes in, moves around, and clicks
		for (const type of ["pointerover", "pointerenter", "pointermove"]) {
			send(type);
		}
		expect(input.pointer.bind[input.pointer.LEFT]).toBe(input.KEY.X);

		send("pointerdown");
		expect(input.keyStatus("jump")).toBe(true);
		send("pointerup");
		expect(input.keyStatus("jump")).toBe(false);
	});

	it("still works on the second click, and the tenth", () => {
		input.bindPointer(input.KEY.X);
		for (let i = 0; i < 10; i++) {
			send("pointermove");
			send("pointerdown");
			expect(input.keyStatus("jump")).toBe(true);
			send("pointerup");
			expect(input.keyStatus("jump")).toBe(false);
		}
	});

	it("survives events with other pointer ids", () => {
		input.bindPointer(input.KEY.X);
		send("pointerover", 7);
		send("pointerdown", 7);
		send("pointerup", 7);
		send("pointerdown", 1);
		expect(input.keyStatus("jump")).toBe(true);
		send("pointerup", 1);
	});

	it("binds another button without touching the left one", () => {
		input.bindPointer(input.pointer.RIGHT, input.KEY.X);
		send("pointerdown");
		expect(input.keyStatus("jump")).toBe(false);
		send("pointerup");
		expect(input.pointer.bind[input.pointer.RIGHT]).toBe(input.KEY.X);
		input.unbindPointer(input.pointer.RIGHT);
	});

	it("unbindPointer clears it, and pointer events do not bring it back", () => {
		input.bindPointer(input.KEY.X);
		send("pointermove");
		input.unbindPointer();
		send("pointerover");
		send("pointerdown");
		expect(input.keyStatus("jump")).toBe(false);
		send("pointerup");
	});
});
