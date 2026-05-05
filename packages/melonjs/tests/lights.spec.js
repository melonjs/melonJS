import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Container,
	game,
	Light2d,
	Stage,
	state,
	video,
} from "../src/index.js";

describe("Light2d + Stage lighting", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	afterAll(() => {
		// leave the world clean for any later test files
		const stage = state.current();
		if (stage instanceof Stage) {
			const children = stage._activeLights ? [...stage._activeLights] : [];
			for (const light of children) {
				if (light.ancestor) {
					light.ancestor.removeChildNow(light);
				}
			}
			stage.lights.clear();
		}
	});

	describe("auto-registration via lifecycle", () => {
		it("adds the light to _activeLights when added to the world", () => {
			const stage = state.current();
			expect(stage).toBeInstanceOf(Stage);
			const before = stage._activeLights.size;

			const light = new Light2d(0, 0, 50);
			game.world.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);

			game.world.removeChildNow(light, true);
			expect(stage._activeLights.has(light)).toBe(false);
			expect(stage._activeLights.size).toBe(before);
		});

		it("works for lights parented to any container in the world tree", () => {
			const stage = state.current();
			const before = stage._activeLights.size;

			const parent = new Container(0, 0, 100, 100);
			game.world.addChild(parent);
			const light = new Light2d(0, 0, 50);
			parent.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);

			game.world.removeChildNow(parent, true);
			// removing the parent fires onDeactivateEvent on its descendants
			expect(stage._activeLights.has(light)).toBe(false);
		});

		it("does not double-register when reparented from one container to another", () => {
			// Real game pattern: a torch held by one character is handed to
			// another. The recommended reparenting flow is detach with
			// `keepalive=true` first (so the engine doesn't recycle/destroy
			// the instance), then `addChild` on the new parent. The
			// active-lights set must end up with exactly one entry.
			const stage = state.current();
			const before = stage._activeLights.size;

			const a = new Container(0, 0, 100, 100);
			const b = new Container(0, 0, 100, 100);
			game.world.addChild(a);
			game.world.addChild(b);

			const light = new Light2d(0, 0, 50);
			a.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);

			a.removeChildNow(light, true);
			b.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);
			expect(light.ancestor).toBe(b);

			// cleanup
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
		});

		it("re-registers when added back after being removed", () => {
			const stage = state.current();
			const light = new Light2d(0, 0, 50);

			game.world.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);

			game.world.removeChildNow(light, true);
			expect(stage._activeLights.has(light)).toBe(false);

			game.world.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);

			game.world.removeChildNow(light, true);
		});

		it("tracks multiple lights independently", () => {
			const stage = state.current();
			const before = stage._activeLights.size;

			const a = new Light2d(0, 0, 50);
			const b = new Light2d(50, 50, 30);
			const c = new Light2d(100, 100, 80);
			game.world.addChild(a);
			game.world.addChild(b);
			game.world.addChild(c);
			expect(stage._activeLights.size).toBe(before + 3);

			game.world.removeChildNow(b, true);
			expect(stage._activeLights.has(a)).toBe(true);
			expect(stage._activeLights.has(b)).toBe(false);
			expect(stage._activeLights.has(c)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 2);

			// cleanup
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(c, true);
		});
	});

	describe("ambient overlay (Stage.drawLighting)", () => {
		it("Stage.drawLighting is a no-op when ambient alpha is 0", () => {
			const stage = state.current();
			stage.ambientLight.setColor(0, 0, 0, 0);

			const calls = [];
			const stub = {
				save: () => {
					calls.push("save");
				},
				setMask: () => {
					calls.push("setMask");
				},
				setColor: () => {
					calls.push("setColor");
				},
				fillRect: () => {
					calls.push("fillRect");
				},
				clearMask: () => {
					calls.push("clearMask");
				},
				restore: () => {
					calls.push("restore");
				},
			};

			stage.drawLighting(stub, game.viewport);
			expect(calls).toEqual([]);
		});

		it("Stage.drawLighting fills + masks once per active light", () => {
			const stage = state.current();
			// reset state
			while (stage._activeLights.size > 0) {
				const light = [...stage._activeLights][0];
				if (light.ancestor) {
					light.ancestor.removeChildNow(light);
				} else {
					stage._activeLights.delete(light);
				}
			}
			stage.ambientLight.setColor(0, 0, 0, 0.5);

			const a = new Light2d(0, 0, 30);
			const b = new Light2d(50, 50, 30);
			game.world.addChild(a);
			game.world.addChild(b);

			const calls = [];
			const stub = {
				save: () => {
					calls.push("save");
				},
				setMask: () => {
					calls.push("setMask");
				},
				setColor: () => {
					calls.push("setColor");
				},
				fillRect: () => {
					calls.push("fillRect");
				},
				clearMask: () => {
					calls.push("clearMask");
				},
				restore: () => {
					calls.push("restore");
				},
			};

			stage.drawLighting(stub, game.viewport);

			// expected sequence: save, setMask×N, setColor, fillRect, clearMask, restore
			expect(calls[0]).toBe("save");
			expect(calls[calls.length - 1]).toBe("restore");
			const setMaskCount = calls.filter((c) => {
				return c === "setMask";
			}).length;
			expect(setMaskCount).toBe(2);
			expect(calls).toContain("setColor");
			expect(calls).toContain("fillRect");
			expect(calls).toContain("clearMask");

			// reset for next tests
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});
	});

	describe("backward compatibility — legacy `lights.set` API", () => {
		it("a light registered via stage.lights.set is adopted into the world on reset", () => {
			// reset() is what adopts entries from `lights` into the world
			// tree. We simulate the legacy pattern (set BEFORE reset adopts)
			// by populating the active stage's `lights` Map then calling
			// `reset(game)` so the adoption pass runs.
			const stage = state.current();
			expect(stage).toBeInstanceOf(Stage);

			const light = new Light2d(0, 0, 30);
			stage.lights.set("test_legacy", light);
			expect(light.ancestor).toBeUndefined();

			stage.reset(game);

			expect(light.ancestor).toBeDefined();
			expect(stage._activeLights.has(light)).toBe(true);

			// cleanup
			if (light.ancestor) {
				light.ancestor.removeChildNow(light);
			}
			stage.lights.clear();
		});
	});
});
