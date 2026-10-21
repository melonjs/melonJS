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
		const THIRD = state.USER + 22;
		let warmed;
		let land;
		let changes;
		let ticks;
		let raf;
		const onChange = () => {
			changes.push(state.isCurrent(HELD) ? "held" : "other");
		};
		const onTick = () => {
			ticks++;
		};
		// The loop asking for its next frame is the state starting to draw,
		// and is known the moment it happens. Counting frames in a fixed
		// window is not: under load a browser can go a whole window without
		// one, whether the loop was started or not.
		const loopRequests = () => {
			return raf.mock.calls.filter(([callback]) => {
				return callback?.name === "_renderFrame";
			}).length;
		};
		const settle = async () => {
			for (let i = 0; i < 10; i++) {
				await Promise.resolve();
			}
		};
		const fades = () => {
			return app.viewport.cameraEffects
				.filter((fx) => {
					return fx instanceof FadeEffect;
				})
				.map((fx) => {
					return fx.direction;
				});
		};
		// a stage that writes what happens to it into `log`
		const logged = (log, name) => {
			return new Stage({
				onResetEvent() {
					log.push(`reset ${name}`);
				},
				onDestroyEvent() {
					log.push(`destroy ${name}`);
				},
			});
		};

		beforeEach(() => {
			changes = [];
			ticks = 0;
			raf = vi.spyOn(globalThis, "requestAnimationFrame");
			warmed = vi.spyOn(app.renderer, "_whenWarmed").mockImplementation(() => {
				return new Promise((resolve) => {
					land = resolve;
				});
			});
			state.set(HELD, new Stage());
			state.set(NEXT, new Stage());
			state.set(THIRD, new Stage());
			// the transition() test above leaves a fade configured for every
			// state; these switch directly unless they say otherwise
			state.setTransition(HELD, false);
			state.setTransition(NEXT, false);
			state.setTransition(THIRD, false);
			event.on(event.STATE_CHANGE, onChange);
			event.on(event.TICK, onTick);
		});

		afterEach(() => {
			event.off(event.STATE_CHANGE, onChange);
			event.off(event.TICK, onTick);
			warmed.mockRestore();
			raf.mockRestore();
			state.transition("fade", "#000000", 0);
			// leave none of them current, or the next test's change to one
			// would be a change to the state it is already in, and do nothing
			state.change(state.DEFAULT, true);
		});

		it("draws nothing until they are built", async () => {
			state.change(HELD, true);
			// the stage is built and current: only its first frame waits
			expect(state.isCurrent(HELD)).toBe(true);
			expect(state.isRunning()).toBe(true);
			await settle();
			expect(loopRequests()).toBe(0);
			expect(changes).toEqual([]);
			land();
			await settle();
			// the change is announced as the loop starts, which also restarts
			// the game clock, so the first frame does not see the wait as time
			expect(changes).toEqual(["held"]);
			expect(loopRequests()).toBe(1);
			await vi.waitFor(
				() => {
					expect(ticks).toBeGreaterThan(0);
				},
				{ timeout: 5000 },
			);
		});

		it("starts at once when nothing is being built", () => {
			warmed.mockReturnValue(undefined);
			state.change(HELD, true);
			expect(changes).toEqual(["held"]);
			expect(loopRequests()).toBe(1);
		});

		it("starts at once with a custom renderer that has no warm-up", () => {
			// a custom renderer need not extend Renderer (see Application#init)
			warmed.mockRestore();
			app.renderer._whenWarmed = undefined;
			try {
				state.change(HELD, true);
				expect(changes).toEqual(["held"]);
				expect(loopRequests()).toBe(1);
			} finally {
				delete app.renderer._whenWarmed;
			}
		});

		it("starts all the same when a warm-up fails", async () => {
			warmed.mockReturnValue(Promise.reject(new Error("device lost")));
			state.change(HELD, true);
			await settle();
			expect(changes).toEqual(["held"]);
			expect(loopRequests()).toBe(1);
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
			await vi.waitFor(
				() => {
					expect(state.isCurrent(HELD)).toBe(true);
				},
				{ timeout: 5000 },
			);
			// still covered, and no reveal yet: started now, it would run its
			// course behind the wait and pop open on the first frame
			expect(fades()).toEqual(["in"]);
			land();
			await settle();
			expect(fades()).toEqual(["out"]);
		});

		it("ends the switch, without starting it, when stopped meanwhile", async () => {
			state.change(HELD, true);
			state.stop();
			// announced all the same: the switch is over, only not drawing
			expect(changes).toEqual(["held"]);
			expect(state.isRunning()).toBe(false);
			land();
			await settle();
			expect(state.isRunning()).toBe(false);
			expect(loopRequests()).toBe(0);
			expect(changes).toEqual(["held"]);
			state.restart();
			expect(loopRequests()).toBe(1);
			await vi.waitFor(
				() => {
					expect(ticks).toBeGreaterThan(0);
				},
				{ timeout: 5000 },
			);
		});

		it("stays stopped when ending the held switch starts another", () => {
			state.change(HELD, true);
			// announcing the held switch makes a listener change state, to one
			// with nothing to build, which starts the loop at once
			const onHeld = () => {
				event.off(event.STATE_CHANGE, onHeld);
				warmed.mockReturnValue(undefined);
				state.change(NEXT, true);
			};
			event.on(event.STATE_CHANGE, onHeld);
			state.stop();
			expect(state.isCurrent(NEXT)).toBe(true);
			expect(state.isRunning()).toBe(false);
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

		it("announces a switch a listener makes while the held one ends", () => {
			const log = [];
			state.set(HELD, logged(log, "held"));
			state.set(THIRD, logged(log, "third"));
			state.set(NEXT, logged(log, "next"));
			state.setTransition(HELD, false);
			state.setTransition(THIRD, false);
			state.setTransition(NEXT, false);
			// HELD and THIRD wait on their warm-ups; NEXT has none
			warmed.mockImplementation(() => {
				return state.isCurrent(NEXT) ? undefined : new Promise(() => {});
			});
			const announce = () => {
				log.push(
					`announce ${state.isCurrent(HELD) ? "held" : state.isCurrent(THIRD) ? "third" : "next"}`,
				);
			};
			// the held switch, once announced, sends the game elsewhere
			const onHeld = () => {
				if (state.isCurrent(HELD)) {
					event.off(event.STATE_CHANGE, onHeld);
					state.change(THIRD, true);
				}
			};
			state.change(HELD, true);
			event.on(event.STATE_CHANGE, announce);
			event.on(event.STATE_CHANGE, onHeld);
			try {
				state.change(NEXT, true);
			} finally {
				event.off(event.STATE_CHANGE, announce);
				event.off(event.STATE_CHANGE, onHeld);
			}
			// THIRD is announced before it is torn down, never dropped
			expect(log).toEqual([
				"reset held",
				"announce held",
				"destroy held",
				"reset third",
				"announce third",
				"destroy third",
				"reset next",
				"announce next",
			]);
		});

		it("keeps a stage's transition when it changes state from its reset", async () => {
			// a fresh application has no viewport until a stage gives it one
			warmed.mockReturnValueOnce(undefined);
			state.change(NEXT, true);
			changes = [];
			// entered with a fade, it forwards straight on from onResetEvent
			state.set(
				HELD,
				new Stage({
					onResetEvent() {
						state.change(THIRD, true);
					},
				}),
			);
			state.transition("fade", "#000000", 40);
			state.setTransition(HELD, true);
			state.change(HELD);
			await vi.waitFor(
				() => {
					expect(state.isCurrent(THIRD)).toBe(true);
				},
				{ timeout: 5000 },
			);
			land();
			await settle();
			// the fade's cover came down and its reveal went up, rather than
			// being taken by the switch made inside its own
			expect(fades()).toEqual(["out"]);
			expect(changes).toHaveLength(2);
		});

		it("still takes the cover down when a listener throws", async () => {
			// a fresh application has no viewport until a stage gives it one
			warmed.mockReturnValueOnce(undefined);
			state.change(NEXT, true);
			state.transition("fade", "#000000", 40);
			state.setTransition(HELD, true);
			state.change(HELD);
			await vi.waitFor(
				() => {
					expect(state.isCurrent(HELD)).toBe(true);
				},
				{ timeout: 5000 },
			);
			const broken = () => {
				throw new Error("a game's listener");
			};
			event.on(event.STATE_CHANGE, broken);
			try {
				// stopping ends the held switch here, so its error lands here
				expect(() => {
					state.stop();
				}).toThrow("a game's listener");
			} finally {
				event.off(event.STATE_CHANGE, broken);
			}
			expect(fades()).toEqual(["out"]);
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
			expect(fades()).toEqual(["in"]);
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
