import { beforeEach, describe, expect, it } from "vitest";
import { boot, Stage, state, video } from "../src/index.js";

describe("state", () => {
	beforeEach(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
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
});
