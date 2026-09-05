import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	level,
	Trigger,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import triggerSource from "../src/renderable/trigger.js?raw";
import state from "../src/state/state.ts";

/**
 * `Trigger` level changes, across the awaitable-load refactor (#1646).
 *
 * The fade/mask path used to sequence "hide → load → reveal" by REWRITING the
 * caller's own `settings.onLoaded`: it saved the user's callback, replaced the
 * option with its own, and called theirs from inside. Awaiting the load removes
 * that interception. These pin the behaviour that must not change with it.
 */
describe("Trigger level change (#1646)", () => {
	let app;
	let loaded;
	let originalAddTo;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		originalAddTo = GLTFScene.prototype.addTo;
		GLTFScene.prototype.addTo = function (container) {
			loaded.push(container);
		};
		level.add("gltf", "trigger-target");
	});

	afterAll(() => {
		GLTFScene.prototype.addTo = originalAddTo;
		app?.destroy();
	});

	beforeEach(() => {
		loaded = [];
		state.stop();
	});

	/** a Trigger attached to the world, so `getRootAncestor().app` resolves */
	const trigger = (settings) => {
		const t = new Trigger(0, 0, {
			width: 8,
			height: 8,
			event: "level",
			to: "trigger-target",
			...settings,
		});
		app.world.addChild(t);
		return t;
	};

	it("loads directly when no transition is configured", () => {
		// the plain path, unchanged by the refactor
		const t = trigger({});
		t.triggerEvent();
		expect(loaded).toHaveLength(1);
		app.world.removeChildNow(t);
	});

	it("does NOT overwrite the caller's onLoaded on the transition path", () => {
		// The regression this refactor exists to remove. The old code did
		// `settings.onLoaded = function (…) { …reveal…; userOnLoaded.call(…) }`,
		// mutating an option object the caller owns and handed in.
		const mine = () => {};
		const t = trigger({
			color: "#000000",
			duration: 10,
			onLoaded: mine,
		});
		t.triggerEvent();
		expect(t.getTriggerSettings().onLoaded).toBe(mine);
		app.world.removeChildNow(t);
	});

	it("defers the load until the hide transition completes", () => {
		// the load must not fire on the same tick the trigger is hit — the
		// fade has to play first
		const t = trigger({ color: "#000000", duration: 10 });
		t.triggerEvent();
		expect(loaded).toHaveLength(0);
		app.world.removeChildNow(t);
	});

	it("reveals only after the load, on the CURRENT viewport", async () => {
		// The reveal used to be injected by rewriting `settings.onLoaded`; it is
		// now chained off the awaited load. Driving the hide tween by hand lets
		// this run without a live loop, so the sequencing is asserted for real
		// rather than by reading the source.
		//
		// `Application.reset()` reassigns `app.viewport`, and `safeLoadLevel`
		// calls it — so a viewport captured before the load is stale by the time
		// the reveal runs. The swap below stands in for that.
		const original = app.viewport;
		const swapped = new Camera2d(0, 0, 320, 240);
		const seen = [];
		const record = (who) => {
			return (effect) => {
				seen.push({ who, effect, loadedSoFar: loaded.length });
				return effect;
			};
		};
		original.addCameraEffect = record("original");
		swapped.addCameraEffect = record("swapped");

		// with the loop RUNNING, so the load genuinely defers — with it stopped
		// the load is synchronous and the ordering below proves nothing
		state.restart();
		const t = trigger({ color: "#000000", duration: 10 });
		t.triggerEvent();

		// the hide effect, captured rather than added
		expect(seen).toHaveLength(1);
		expect(seen[0].loadedSoFar).toBe(0);

		// swap the viewport while the load runs, as `game.reset()` would
		const previousAddTo = GLTFScene.prototype.addTo;
		GLTFScene.prototype.addTo = function (container) {
			app.viewport = swapped;
			loaded.push(container);
		};

		// Drive the hide tween to completion -> onComplete -> the load. Stop
		// ticking the moment the load starts: further ticks re-fire onComplete
		// and would queue a second load.
		const tween = seen[0].effect.tween;
		for (let i = 1; i <= 20 && loaded.length === 0; i++) {
			tween._onTick(i * 5);
			await Promise.resolve();
		}
		// let the load's microtask and the reveal chained after it settle
		for (let i = 0; i < 4; i++) {
			await Promise.resolve();
		}

		GLTFScene.prototype.addTo = previousAddTo;
		app.viewport = original;
		app.world.removeChildNow(t);

		// the load happened, then the reveal — and on the viewport that existed
		// AFTER the load, not the one captured before it
		expect(loaded).toHaveLength(1);
		expect(seen).toHaveLength(2);
		expect(seen[1].loadedSoFar).toBe(1);
		expect(seen[1].who).toBe("swapped");
	});

	it("re-reads the viewport AFTER the load, not before it", () => {
		// `Application.reset()` reassigns `app.viewport`, and `safeLoadLevel`
		// calls `game.reset()` — so a viewport captured before the load is stale
		// by the time the reveal runs. The callback this refactor replaced
		// re-read it for exactly that reason.
		//
		// Asserted on the source because the reveal only runs when the hide
		// tween completes, which needs a live game loop this suite does not
		// have. Weaker than a behavioural test, and deliberately narrow: it
		// pins the one line whose removal reintroduces a known bug.
		// anchored on the call shape rather than the exact argument text, so
		// reformatting or an added option does not fail this
		const load = triggerSource.indexOf("load(gotolevel");
		const reveal = triggerSource.indexOf("addCameraEffect", load);
		expect(load).toBeGreaterThan(-1);
		expect(reveal).toBeGreaterThan(load);
		// comment lines stripped: the explanation above this assertion mentions
		// `app.viewport` too, and matching that would make this always pass
		const code = triggerSource
			.slice(load, reveal)
			.split("\n")
			.filter((line) => {
				return !line.trim().startsWith("//");
			})
			.join("\n");
		expect(code).toContain("app.viewport");
	});

	it("guards against re-entry while a transition is already running", () => {
		const t = trigger({ color: "#000000", duration: 10 });
		t.triggerEvent();
		expect(t.fading).toBe(true);
		t.triggerEvent();
		expect(loaded).toHaveLength(0);
		app.world.removeChildNow(t);
	});
});
