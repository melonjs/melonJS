/**
 * Pause on background, resume on return, through Capacitor's
 * `appStateChange`.
 *
 * Bug pinned here: the listener called `state.resume()` on EVERY return to
 * the foreground, so a game the player had paused (a pause menu) was playing
 * again underneath the menu when they came back to the app. Only the pause
 * the plugin itself applied may be undone, the rule the engine already
 * follows for window blur and focus (`Application#pauseOnBlur`).
 *
 * `@capacitor/app` is mocked so the test can deliver `appStateChange` the way
 * the native shell does; everything else is the real engine.
 */

import { Application, event, state, video } from "melonjs";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

type Listener = (payload: { isActive: boolean }) => void;

const capacitor = vi.hoisted(() => {
	return {
		listeners: new Map<string, Listener>(),
	};
});

vi.mock("@capacitor/app", () => {
	return {
		App: {
			addListener: (name: string, fn: Listener) => {
				capacitor.listeners.set(name, fn);
				return {
					remove: () => {
						capacitor.listeners.delete(name);
						return Promise.resolve();
					},
				};
			},
			exitApp: () => {
				return Promise.resolve();
			},
		},
	};
});

// imported after the mock is declared (vitest hoists `vi.mock` anyway)
const { connectCapacitor } = await import("../src/connect.ts");

// what the native shell sends when the app leaves or returns
const appState = (isActive: boolean): void => {
	const fn = capacitor.listeners.get("appStateChange");
	if (!fn) {
		throw new Error("no appStateChange listener");
	}
	fn({ isActive });
};

describe("appStateChange: pause on background, resume on return", () => {
	let teardown: (() => Promise<void>) | undefined;

	beforeAll(async () => {
		const app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		state.resume();
		expect(state.isPaused()).toEqual(false);
	});

	afterEach(async () => {
		await teardown?.();
		teardown = undefined;
		state.resume();
	});

	it("a game the player paused stays paused when the app comes back", () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		// the player opens the pause menu
		state.pause();
		appState(false);
		appState(true);
		expect(state.isPaused()).toEqual(true);
	});

	it("a running game is paused in the background and resumed on return", () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		appState(false);
		expect(state.isPaused()).toEqual(true);
		appState(true);
		expect(state.isPaused()).toEqual(false);
	});

	it("resumes after the app goes inactive twice (iOS: inactive, then background)", () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		appState(false);
		appState(false);
		appState(true);
		expect(state.isPaused()).toEqual(false);
	});

	it("a return with no departure does not resume a paused game", () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		state.pause();
		appState(true);
		expect(state.isPaused()).toEqual(true);
	});

	it("the next background/return cycle after a kept pause works again", () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		state.pause();
		appState(false);
		appState(true);
		expect(state.isPaused()).toEqual(true);
		// the player closes the menu, then leaves and comes back
		state.resume();
		appState(false);
		expect(state.isPaused()).toEqual(true);
		appState(true);
		expect(state.isPaused()).toEqual(false);
	});

	it("resumes when the window blur pauses the game first", () => {
		// the WebView also reports the app leaving as a window blur, and the
		// engine pauses on it (Application#pauseOnBlur), possibly before
		// Capacitor's event arrives
		teardown = connectCapacitor({ forwardBackButton: false });
		event.emit(event.BLUR);
		appState(false);
		expect(state.isPaused()).toEqual(true);
		event.emit(event.FOCUS);
		appState(true);
		expect(state.isPaused()).toEqual(false);
	});

	it("resumes when Capacitor pauses the game before the window blur", () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		appState(false);
		event.emit(event.BLUR);
		expect(state.isPaused()).toEqual(true);
		// the engine resumes only a pause it applied, so focus alone keeps it
		event.emit(event.FOCUS);
		appState(true);
		expect(state.isPaused()).toEqual(false);
	});

	it("pauseOnBackground: false leaves the game running", () => {
		teardown = connectCapacitor({
			pauseOnBackground: false,
			forwardBackButton: false,
		});
		expect(capacitor.listeners.has("appStateChange")).toEqual(false);
	});

	it("teardown removes the listener", async () => {
		teardown = connectCapacitor({ forwardBackButton: false });
		expect(capacitor.listeners.has("appStateChange")).toEqual(true);
		await teardown();
		teardown = undefined;
		expect(capacitor.listeners.has("appStateChange")).toEqual(false);
	});
});
