import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	event,
	FadeEffect,
	Stage,
	state,
	video,
} from "../src/index.js";

describe("state", () => {
	let app;
	beforeEach(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterEach(() => {
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
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

	describe("a stage that is still warming up", () => {
		// The renderer is asked, once the stage is built, whether anything it
		// queued is still compiling. The answer is stubbed here so each test
		// decides when the warm-ups land.
		const HELD = state.USER + 20;
		const NEXT = state.USER + 21;
		let warmed;
		let land;
		let changes;
		let ticks;
		const onChange = () => {
			changes.push(state.isCurrent(HELD) ? "held" : "other");
		};
		const onTick = () => {
			ticks++;
		};
		/** a few real frames of the running loop, if it is running */
		const frames = () => {
			return new Promise((resolve) => {
				setTimeout(resolve, 80);
			});
		};
		const settle = async () => {
			for (let i = 0; i < 10; i++) {
				await Promise.resolve();
			}
		};

		beforeEach(() => {
			changes = [];
			ticks = 0;
			warmed = vi.spyOn(app.renderer, "_whenWarmed").mockImplementation(() => {
				return new Promise((resolve) => {
					land = resolve;
				});
			});
			state.set(HELD, new Stage());
			state.set(NEXT, new Stage());
			// the transition() test above leaves a fade configured for every
			// state; these switch directly unless they say otherwise
			state.setTransition(HELD, false);
			state.setTransition(NEXT, false);
			event.on(event.STATE_CHANGE, onChange);
			event.on(event.TICK, onTick);
		});

		afterEach(() => {
			event.off(event.STATE_CHANGE, onChange);
			event.off(event.TICK, onTick);
			warmed.mockRestore();
			state.transition("fade", "#000000", 0);
			// leave neither state current, or the next test's change to it
			// would be a change to the state it is already in, and do nothing
			state.change(state.DEFAULT, true);
		});

		it("draws nothing until they are built", async () => {
			state.change(HELD, true);
			// the stage is built and current: only its first frame waits
			expect(state.isCurrent(HELD)).toBe(true);
			expect(state.isRunning()).toBe(true);
			await frames();
			expect(ticks).toBe(0);
			expect(changes).toEqual([]);
			land();
			await settle();
			// the change is announced as the loop starts, which also restarts
			// the game clock, so the first frame does not see the wait as time
			expect(changes).toEqual(["held"]);
			await frames();
			expect(ticks).toBeGreaterThan(0);
		});

		it("starts at once when nothing is being built", () => {
			warmed.mockReturnValue(undefined);
			state.change(HELD, true);
			expect(changes).toEqual(["held"]);
		});

		it("begins a transition's reveal on the frame it draws", async () => {
			// a fresh application has no viewport until a stage gives it one
			warmed.mockReturnValueOnce(undefined);
			state.change(NEXT, true);
			changes = [];
			state.transition("fade", "#000000", 40);
			state.setTransition(HELD, true);
			state.change(HELD);
			// the cover closes over real frames, then the switch is made
			for (let i = 0; i < 50 && !state.isCurrent(HELD); i++) {
				await frames();
			}
			expect(state.isCurrent(HELD)).toBe(true);
			const fades = () => {
				return app.viewport.cameraEffects.filter((fx) => {
					return fx instanceof FadeEffect;
				});
			};
			// still covered, and no reveal yet: started now, it would run its
			// course behind the wait and pop open on the first frame
			expect(
				fades().map((fx) => {
					return fx.direction;
				}),
			).toEqual(["in"]);
			land();
			await settle();
			const reveal = fades();
			expect(
				reveal.map((fx) => {
					return fx.direction;
				}),
			).toEqual(["out"]);
		});

		it("ends the switch, without starting it, when stopped meanwhile", async () => {
			state.change(HELD, true);
			state.stop();
			// announced all the same: the switch is over, only not drawing
			expect(changes).toEqual(["held"]);
			expect(state.isRunning()).toBe(false);
			land();
			await settle();
			await frames();
			expect(ticks).toBe(0);
			expect(changes).toEqual(["held"]);
			state.restart();
			await frames();
			expect(ticks).toBeGreaterThan(0);
		});

		it("ends the switch first when another one replaces it", async () => {
			state.change(HELD, true);
			const first = land;
			warmed.mockReturnValue(undefined);
			state.change(NEXT, true);
			// the first one is announced before the second is made
			expect(changes).toEqual(["held", "other"]);
			first();
			await settle();
			expect(changes).toEqual(["held", "other"]);
			expect(state.isCurrent(NEXT)).toBe(true);
		});

		it("leaves a change asked for meanwhile its own transition", async () => {
			warmed.mockReturnValueOnce(undefined);
			state.change(NEXT, true);
			state.change(HELD, true);
			// asked while the first frame waits: its cover goes up now, and
			// what takes it down again is its own, for its own switch
			state.transition("fade", "#000000", 40);
			state.setTransition(NEXT, true);
			state.change(NEXT);
			land();
			await settle();
			expect(
				app.viewport.cameraEffects
					.filter((fx) => {
						return fx instanceof FadeEffect;
					})
					.map((fx) => {
						return fx.direction;
					}),
			).toEqual(["in"]);
		});

		it("draws anyway once the wait has gone on too long", async () => {
			vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
			try {
				state.change(HELD, true);
				vi.advanceTimersByTime(1499);
				await settle();
				expect(changes).toEqual([]);
				vi.advanceTimersByTime(1);
				await settle();
				expect(changes).toEqual(["held"]);
			} finally {
				vi.useRealTimers();
			}
		});
	});
});
