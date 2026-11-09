import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, input, Renderable, video } from "../src/index.js";

/**
 * A region registered for "pointerup" alone never received it.
 *
 * A release only reaches a region holding that pointer, and a region took the
 * pointer only from an event it had callbacks for: with no "pointerdown"
 * callback, the press went past it without claiming the pointer, so the
 * release that followed was refused. The same click reached a region that
 * also had a (possibly empty) "pointerdown" callback.
 */
describe("a region registered for pointerup only", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	const regions = [];
	afterEach(() => {
		for (const region of regions.splice(0)) {
			input.releaseAllPointerEvents(region);
		}
		app.world.reset();
		app.world.broadphase.clear();
	});

	/** a non-kinematic box in the world, at a canvas position */
	const box = (x, y, w = 100, h = 100) => {
		const region = new Renderable(x, y, w, h);
		region.anchorPoint.set(0, 0);
		region.isKinematic = false;
		app.world.addChild(region);
		region.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		regions.push(region);
		return region;
	};

	/** send a pointer event at a canvas position */
	const send = (type, x, y, pointerId = 1) => {
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new PointerEvent(type, {
				clientX: rect.left + (x * rect.width) / canvas.width,
				clientY: rect.top + (y * rect.height) / canvas.height,
				button: 0,
				buttons: type === "pointerup" ? 0 : 1,
				pointerId,
				pointerType: "mouse",
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
			}),
		);
	};

	it("receives the release of a click on it", () => {
		const region = box(100, 100);
		let ups = 0;
		input.registerPointerEvent("pointerup", region, () => {
			ups++;
		});
		send("pointerdown", 150, 150);
		send("pointerup", 150, 150);
		expect(ups).toBe(1);
	});

	it("receives it on every click, not only the first", () => {
		const region = box(100, 100);
		let ups = 0;
		input.registerPointerEvent("pointerup", region, () => {
			ups++;
		});
		for (let i = 0; i < 3; i++) {
			send("pointerdown", 150, 150);
			send("pointerup", 150, 150);
		}
		expect(ups).toBe(3);
	});

	it("can consume the release, as one with a pointerdown callback can", () => {
		const below = box(100, 100);
		const above = box(100, 100);
		app.world.moveToTop(above);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		const got = [];
		input.registerPointerEvent("pointerdown", below, () => {});
		input.registerPointerEvent("pointerup", below, () => {
			got.push("below");
		});
		input.registerPointerEvent("pointerup", above, () => {
			got.push("above");
			return false;
		});
		send("pointerdown", 150, 150);
		send("pointerup", 150, 150);
		expect(got).toEqual(["above"]);
	});

	// ---- the same as a region that also has a pointerdown callback ------------

	/** run one sequence on both kinds of region and return the releases each saw */
	const compare = (sequence) => {
		const upOnly = box(100, 100);
		const downAndUp = box(400, 100);
		const seen = { upOnly: 0, downAndUp: 0 };
		input.registerPointerEvent("pointerup", upOnly, () => {
			seen.upOnly++;
		});
		input.registerPointerEvent("pointerdown", downAndUp, () => {});
		input.registerPointerEvent("pointerup", downAndUp, () => {
			seen.downAndUp++;
		});
		// the same moves, relative to each region's corner
		for (const [type, dx, dy] of sequence) {
			send(type, 100 + dx, 100 + dy);
			send(type, 400 + dx, 100 + dy);
		}
		return seen;
	};

	it("is not released by a press made elsewhere, like one with pointerdown", () => {
		// press beside it, release on it
		const seen = compare([
			["pointerdown", -50, 50],
			["pointermove", 50, 50],
			["pointerup", 50, 50],
		]);
		expect(seen.upOnly).toBe(seen.downAndUp);
	});

	it("does not get a release that happens outside it", () => {
		const seen = compare([
			["pointerdown", 50, 50],
			["pointermove", 150, 50],
			["pointerup", 150, 50],
		]);
		expect(seen).toEqual({ upOnly: 0, downAndUp: 0 });
	});

	it("still gets it after the pointer left and came back", () => {
		const seen = compare([
			["pointerdown", 50, 50],
			["pointermove", 150, 50],
			["pointermove", 50, 50],
			["pointerup", 50, 50],
		]);
		expect(seen).toEqual({ upOnly: 1, downAndUp: 1 });
	});

	it("leaves a normal pointerdown and pointerup region as it was", () => {
		const region = box(100, 100);
		const got = [];
		input.registerPointerEvent("pointerdown", region, (p) => {
			got.push(["down", Math.round(p.gameX), Math.round(p.gameY)]);
		});
		input.registerPointerEvent("pointerup", region, (p) => {
			got.push(["up", Math.round(p.gameX), Math.round(p.gameY)]);
		});
		send("pointerdown", 120, 130);
		send("pointerup", 160, 170);
		// a press outside it reaches neither callback
		send("pointerdown", 300, 300);
		send("pointerup", 300, 300);
		expect(got).toEqual([
			["down", 120, 130],
			["up", 160, 170],
		]);
	});
});
