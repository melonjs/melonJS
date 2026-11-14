import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	audio,
	boot,
	device,
	event,
	input,
	state,
	video,
} from "../src/index.js";

/**
 * `device.setFocusEvents(false)` stops the engine following the browser
 * window's focus, for a game whose host says when it is in the foreground (a
 * web game portal's SDK, such as YouTube Playables, which forbids pausing on
 * the page's visibility). The host's callbacks emit `event.BLUR` and
 * `event.FOCUS` instead, and the game reacts to them as it did to the window.
 *
 * - by default the window's `blur`, `focus` and `visibilitychange` become
 *   `BLUR` and `FOCUS`, as before
 * - off, none of them does; on again, they do, once each
 * - called before boot, as a game's module code is (melonJS boots on
 *   `DOMContentLoaded`, after the page's modules have run), it is what boot
 *   follows
 * - driven by a host: its `BLUR` stops the game, silences it and releases
 *   held keys, its `FOCUS` undoes that, and the window does nothing
 */

const windowBlur = () => {
	globalThis.dispatchEvent(new Event("blur"));
};
const windowFocus = () => {
	globalThis.dispatchEvent(new Event("focus"));
};
// the page hidden or shown, as a tab switch does
const pageVisibility = (visibilityState) => {
	Object.defineProperty(globalThis.document, "visibilityState", {
		configurable: true,
		get: () => {
			return visibilityState;
		},
	});
	globalThis.document.dispatchEvent(new Event("visibilitychange"));
	// back to the document's own getter
	delete globalThis.document.visibilityState;
};
// every way the browser reports the player leaving and coming back
const leaveAndComeBack = () => {
	windowBlur();
	windowFocus();
	pageVisibility("hidden");
	pageVisibility("visible");
};

const counts = { blur: 0, focus: 0 };
const onBlur = () => {
	counts.blur++;
};
const onFocus = () => {
	counts.focus++;
};

describe("device.setFocusEvents()", () => {
	beforeAll(() => {
		boot();
		// the window's focus handler also calls `window.focus()`, which in a
		// headless browser sends a second `focus` event: not what is tested
		device.setAutoFocus(false);
		event.on(event.BLUR, onBlur);
		event.on(event.FOCUS, onFocus);
	});

	afterEach(() => {
		device.setFocusEvents(true);
		counts.blur = 0;
		counts.focus = 0;
	});

	afterAll(() => {
		device.setAutoFocus(true);
		event.off(event.BLUR, onBlur);
		event.off(event.FOCUS, onFocus);
	});

	it("called before boot, it is what boot follows", async () => {
		// the engine here booted on import, so a copy of the device module
		// that has not booted stands in for a game's page; this one's
		// listeners are taken out of the way
		device.setFocusEvents(false);
		const off = await import("../src/system/device.ts?before-boot-off");
		const on = await import("../src/system/device.ts?before-boot-on");

		try {
			// turned off before boot: boot leaves the window alone
			off.setFocusEvents(false);
			off.initVisibilityEvents();
			leaveAndComeBack();
			expect(counts).toEqual({ blur: 0, focus: 0 });
			// and turned on afterwards, the window is followed
			off.setFocusEvents(true);
			windowBlur();
			expect(counts.blur).toBe(1);
			off.setFocusEvents(false);

			// turned on before boot: nothing is listened to until boot
			counts.blur = 0;
			on.setFocusEvents(true);
			windowBlur();
			expect(counts.blur).toBe(0);
			on.initVisibilityEvents();
			windowBlur();
			expect(counts.blur).toBe(1);
		} finally {
			// whatever happened, the copies stop listening
			off.setFocusEvents(false);
			on.setFocusEvents(false);
		}
	});

	it("follows the browser window by default", () => {
		expect(device.focusEvents).toBe(true);
		leaveAndComeBack();
		expect(counts).toEqual({ blur: 2, focus: 2 });
	});

	it("off, the window's blur, focus and visibilitychange emit nothing", () => {
		device.setFocusEvents(false);
		expect(device.focusEvents).toBe(false);
		leaveAndComeBack();
		expect(counts).toEqual({ blur: 0, focus: 0 });
		// what a host emits still goes through
		event.emit(event.BLUR);
		event.emit(event.FOCUS);
		expect(counts).toEqual({ blur: 1, focus: 1 });
	});

	it("on again, the window is followed once, however often it is turned on", () => {
		device.setFocusEvents(false);
		device.setFocusEvents(true);
		device.setFocusEvents(true);
		expect(device.focusEvents).toBe(true);
		leaveAndComeBack();
		expect(counts).toEqual({ blur: 2, focus: 2 });
	});

	it("off twice, then on, still listens once", () => {
		device.setFocusEvents(false);
		device.setFocusEvents(false);
		device.setFocusEvents(true);
		windowBlur();
		expect(counts.blur).toBe(1);
	});
});

describe("a host driving the focus, as YouTube Playables does", () => {
	let app;

	beforeAll(async () => {
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		device.setAutoFocus(false);
	});

	afterAll(() => {
		device.setAutoFocus(true);
	});

	afterEach(() => {
		device.setFocusEvents(true);
		app.stopOnBlur = false;
		app.pauseOnBlur = true;
		if (!state.isRunning()) {
			state.restart();
		}
		if (state.isPaused()) {
			state.resume();
		}
		audio.unmuteAll();
		input.unbindKey(input.KEY.LEFT);
	});

	// the template's four lines
	const hostTakesOver = () => {
		device.setFocusEvents(false);
		app.stopOnBlur = true;
		app.pauseOnBlur = false;
	};

	it("the window no longer stops nor silences the game", () => {
		hostTakesOver();
		leaveAndComeBack();
		windowBlur();
		pageVisibility("hidden");
		expect(state.isRunning()).toBe(true);
		expect(state.isPaused()).toBe(false);
		expect(audio.muted()).toBe(false);
		windowFocus();
		pageVisibility("visible");
	});

	it("the host's BLUR stops the game and silences it; its FOCUS starts it again", () => {
		hostTakesOver();
		event.emit(event.BLUR);
		expect(state.isRunning()).toBe(false);
		expect(audio.muted()).toBe(true);
		event.emit(event.FOCUS);
		expect(state.isRunning()).toBe(true);
		expect(audio.muted()).toBe(false);
	});

	it("the host's BLUR releases a held key", () => {
		hostTakesOver();
		input.bindKey(input.KEY.LEFT, "left");
		globalThis.dispatchEvent(
			new KeyboardEvent("keydown", { keyCode: input.KEY.LEFT }),
		);
		expect(input.isKeyPressed("left")).toBe(true);
		event.emit(event.BLUR);
		expect(input.isKeyPressed("left")).toBe(false);
		event.emit(event.FOCUS);
		globalThis.dispatchEvent(
			new KeyboardEvent("keyup", { keyCode: input.KEY.LEFT }),
		);
	});

	it("a game that muted itself is still muted after the host's pause", () => {
		hostTakesOver();
		audio.muteAll();
		event.emit(event.BLUR);
		event.emit(event.FOCUS);
		expect(audio.muted()).toBe(true);
	});

	it("with pauseOnBlur instead, the host's BLUR pauses and its FOCUS resumes", () => {
		device.setFocusEvents(false);
		event.emit(event.BLUR);
		expect(state.isPaused()).toBe(true);
		// the window coming back is not the host coming back
		windowFocus();
		pageVisibility("visible");
		expect(state.isPaused()).toBe(true);
		event.emit(event.FOCUS);
		expect(state.isPaused()).toBe(false);
	});
});
