import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Application, boot, level, Trigger, video } from "../src/index.js";
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
