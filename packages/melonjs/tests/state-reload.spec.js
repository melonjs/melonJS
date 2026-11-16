/**
 * `state.reload()` builds the current stage again: `onDestroyEvent`, the
 * world reset and `onResetEvent`, as `state.change()` does for another state,
 * which leaves the current one alone. For a "play again" or a level restart.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Renderable,
	Stage,
	state,
	video,
} from "../src/index.js";

describe("state.reload()", () => {
	let app;
	beforeEach(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		// the state manager is a module-wide singleton: start each test from
		// another state, so that entering PLAY is a real change
		state.set(state.MENU, new Stage());
		state.change(state.MENU, true);
	});

	afterEach(() => {
		app?.destroy();
	});

	/** a stage that counts its resets and destroys, and adds one renderable */
	class Counting extends Stage {
		resets = 0;
		destroys = 0;
		args = [];
		onResetEvent(game, ...args) {
			this.resets++;
			this.args = args;
			game.world.addChild(new Renderable(0, 0, 8, 8));
		}
		onDestroyEvent() {
			this.destroys++;
		}
	}

	it("change() to the current state is still a no-op", () => {
		const stage = new Counting();
		state.set(state.PLAY, stage);
		state.change(state.PLAY, true);
		state.change(state.PLAY, true);
		expect(stage.resets).toBe(1);
		expect(stage.destroys).toBe(0);
	});

	it("rebuilds the current stage at once, with forceChange", () => {
		const stage = new Counting();
		state.set(state.PLAY, stage);
		state.change(state.PLAY, true);
		const before = app.world.getChildren().filter((c) => {
			return c instanceof Renderable && c.width === 8;
		}).length;
		state.reload(true);
		expect(stage.destroys).toBe(1);
		expect(stage.resets).toBe(2);
		expect(state.isCurrent(state.PLAY)).toBe(true);
		// the world was reset in between: one renderable, not two
		const after = app.world.getChildren().filter((c) => {
			return c instanceof Renderable && c.width === 8;
		}).length;
		expect(after).toBe(before);
	});

	it("waits for the next frame without forceChange", async () => {
		const stage = new Counting();
		state.set(state.PLAY, stage);
		state.change(state.PLAY, true);
		state.reload();
		expect(stage.resets).toBe(1);
		await new Promise((resolve) => {
			setTimeout(resolve, 50);
		});
		expect(stage.resets).toBe(2);
		expect(stage.destroys).toBe(1);
	});

	it("keeps the arguments the state was entered with, or takes new ones", () => {
		const stage = new Counting();
		state.set(state.PLAY, stage);
		state.change(state.PLAY, true, "level1", 3);
		state.reload(true);
		expect(stage.args).toEqual(["level1", 3]);
		state.reload(true, "level2");
		expect(stage.args).toEqual(["level2"]);
		state.reload(true);
		expect(stage.args).toEqual(["level2"]);
	});
});
