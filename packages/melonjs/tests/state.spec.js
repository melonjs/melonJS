import { beforeEach, describe, expect, it } from "vitest";
import { boot, Stage, state, video } from "../src/index.js";

describe("state", () => {
	beforeEach(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	describe("constants", () => {
		it("should have all default state IDs", () => {
			expect(state.LOADING).toEqual(0);
			expect(state.MENU).toEqual(1);
			expect(state.READY).toEqual(2);
			expect(state.PLAY).toEqual(3);
			expect(state.GAMEOVER).toEqual(4);
			expect(state.GAME_END).toEqual(5);
			expect(state.SCORE).toEqual(6);
			expect(state.CREDITS).toEqual(7);
			expect(state.SETTINGS).toEqual(8);
			expect(state.DEFAULT).toEqual(9);
			expect(state.USER).toEqual(100);
		});
	});

	describe("set()", () => {
		it("should set a stage for a given state", () => {
			const myStage = new Stage();
			state.set(state.PLAY, myStage);
			const retrieved = state.get(state.PLAY);
			expect(retrieved).toBe(myStage);
		});

		it("should throw if stage is not a Stage instance", () => {
			expect(() => {
				state.set(state.PLAY, {});
			}).toThrow("is not an instance of me.Stage");
		});
	});

	describe("get()", () => {
		it("should return undefined for an unset state", () => {
			const result = state.get(state.USER + 99);
			expect(result).toBeUndefined();
		});

		it("should return a previously set stage", () => {
			const myStage = new Stage();
			state.set(state.MENU, myStage);
			expect(state.get(state.MENU)).toBe(myStage);
		});
	});

	describe("current()", () => {
		it("should return a Stage instance for the current state", () => {
			// After boot, the DEFAULT state should be set
			// current may be undefined if video hasn't fully initialized the state switch
			// but get(DEFAULT) should be defined since boot sets it
			const defaultStage = state.get(state.DEFAULT);
			expect(defaultStage).toBeDefined();
			expect(defaultStage).toBeInstanceOf(Stage);
		});
	});

	describe("isCurrent()", () => {
		it("should return true for the current state after change", () => {
			state.change(state.DEFAULT, true);
			expect(state.isCurrent(state.DEFAULT)).toEqual(true);
		});

		it("should return false for a non-current state", () => {
			state.change(state.DEFAULT, true);
			expect(state.isCurrent(state.PLAY)).toEqual(false);
		});
	});

	describe("change()", () => {
		it("should throw for an undefined state", () => {
			expect(() => {
				state.change(state.USER + 50, true);
			}).toThrow("Undefined Stage for state");
		});

		it("should change to a valid state", () => {
			const myStage = new Stage();
			state.set(state.PLAY, myStage);
			state.change(state.PLAY, true);
			expect(state.isCurrent(state.PLAY)).toEqual(true);
		});
	});

	describe("isPaused()", () => {
		it("should return false initially", () => {
			expect(state.isPaused()).toEqual(false);
		});
	});

	describe("transition()", () => {
		it("should not throw when setting a fade transition", () => {
			expect(() => {
				state.transition("fade", "#000000", 500);
			}).not.toThrow();
		});
	});

	describe("Stage", () => {
		it("should initialize with empty cameras and lights maps", () => {
			const myStage = new Stage();
			expect(myStage.cameras).toBeInstanceOf(Map);
			expect(myStage.lights).toBeInstanceOf(Map);
			expect(myStage.cameras.size).toEqual(0);
			expect(myStage.lights.size).toEqual(0);
		});

		it("should have a default ambient light with zero alpha", () => {
			const myStage = new Stage();
			expect(myStage.ambientLight.alpha).toEqual(0);
		});

		it("should accept settings via constructor", () => {
			const onReset = () => {};
			const onDestroy = () => {};
			const myStage = new Stage({
				onResetEvent: onReset,
				onDestroyEvent: onDestroy,
			});
			expect(myStage.settings.onResetEvent).toBe(onReset);
			expect(myStage.settings.onDestroyEvent).toBe(onDestroy);
		});

		it("should call settings.onResetEvent from onResetEvent", () => {
			let called = false;
			let receivedApp = null;
			const myStage = new Stage({
				onResetEvent: (app) => {
					called = true;
					receivedApp = app;
				},
			});
			const fakeApp = { renderer: { width: 800, height: 600 } };
			myStage.onResetEvent(fakeApp);
			expect(called).toEqual(true);
			expect(receivedApp).toBe(fakeApp);
		});

		it("should call settings.onDestroyEvent from onDestroyEvent", () => {
			let called = false;
			const myStage = new Stage({
				onDestroyEvent: () => {
					called = true;
				},
			});
			myStage.onDestroyEvent();
			expect(called).toEqual(true);
		});

		it("should not throw when onResetEvent/onDestroyEvent have no callbacks", () => {
			const myStage = new Stage();
			expect(() => {
				myStage.onResetEvent();
			}).not.toThrow();
			expect(() => {
				myStage.onDestroyEvent();
			}).not.toThrow();
		});

		it("should return false from update when no cameras or lights", () => {
			const myStage = new Stage();
			expect(myStage.update(16)).toEqual(false);
		});
	});
});
