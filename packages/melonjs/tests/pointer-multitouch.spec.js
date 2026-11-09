import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, input, Renderable, video } from "../src/index.js";

/**
 * Two fingers on one region: the first finger's release was dropped.
 *
 * A region remembers a single pointer, and a release only reaches it from
 * that pointer. The second finger to touch it took that place, so lifting the
 * first one reached nothing, whichever order the fingers came up in: a full
 * screen touch area, or a big button pressed with two thumbs, missed one
 * release out of two.
 */
describe("several pointers pressing one region", () => {
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

	const index = () => {
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
	};

	const box = (x, y, w, h) => {
		const region = new Renderable(x, y, w, h);
		region.anchorPoint.set(0, 0);
		region.isKinematic = false;
		app.world.addChild(region);
		region.updateBounds(true);
		index();
		regions.push(region);
		return region;
	};

	/** record every event of these types the region gets, as "type:id" */
	const record = (region, types) => {
		const log = [];
		for (const type of types) {
			input.registerPointerEvent(type, region, (p) => {
				log.push(`${type.replace("pointer", "")}:${p.pointerId}`);
			});
		}
		return log;
	};

	// the first finger down is the primary one, as the browser reports it
	let primary = null;
	const send = (type, id, x, y, pointerType = "touch") => {
		if (type === "pointerdown" && primary === null) {
			primary = id;
		}
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new PointerEvent(type, {
				clientX: rect.left + (x * rect.width) / canvas.width,
				clientY: rect.top + (y * rect.height) / canvas.height,
				button: type === "pointermove" ? -1 : 0,
				buttons: type === "pointerup" || type === "pointerleave" ? 0 : 1,
				pointerId: id,
				pointerType,
				width: 1,
				height: 1,
				isPrimary: id === primary || pointerType === "mouse",
				bubbles: true,
			}),
		);
		if ((type === "pointerup" || type === "pointercancel") && id === primary) {
			primary = null;
		}
	};

	/** a finger lifting: the browser follows its pointerup with a pointerleave */
	const lift = (id, x, y) => {
		send("pointerup", id, x, y);
		send("pointerleave", id, x, y);
	};

	it("reaches the region when the first finger lifts while a second is down", () => {
		const region = box(100, 100, 400, 300);
		const log = record(region, ["pointerdown", "pointerup"]);
		send("pointerdown", 11, 150, 150);
		send("pointerdown", 12, 400, 300);
		lift(11, 150, 150);
		lift(12, 400, 300);
		expect(log).toEqual(["down:11", "down:12", "up:11", "up:12"]);
	});

	it("reaches it whichever finger lifts first", () => {
		const region = box(100, 100, 400, 300);
		const log = record(region, ["pointerdown", "pointerup"]);
		send("pointerdown", 21, 150, 150);
		send("pointerdown", 22, 400, 300);
		lift(22, 400, 300);
		lift(21, 150, 150);
		expect(log).toEqual(["down:21", "down:22", "up:22", "up:21"]);
	});

	it("still reaches it after the second finger moved over it", () => {
		const region = box(100, 100, 400, 300);
		const log = record(region, ["pointerdown", "pointerup", "pointermove"]);
		send("pointerdown", 31, 150, 150);
		send("pointerdown", 32, 400, 300);
		send("pointermove", 32, 410, 310);
		lift(31, 150, 150);
		lift(32, 410, 310);
		expect(
			log.filter((e) => {
				return e.startsWith("up");
			}),
		).toEqual(["up:31", "up:32"]);
	});

	it("cancels the first finger after a second one touched", () => {
		const region = box(100, 100, 400, 300);
		const log = record(region, ["pointerdown", "pointercancel"]);
		send("pointerdown", 41, 150, 150);
		send("pointerdown", 42, 400, 300);
		send("pointercancel", 41, 150, 150);
		send("pointercancel", 42, 400, 300);
		expect(log).toEqual(["down:41", "down:42", "cancel:41", "cancel:42"]);
	});

	// ---- what must keep working --------------------------------------------

	it("one finger: one press, one release", () => {
		const region = box(100, 100, 400, 300);
		const log = record(region, ["pointerdown", "pointerup"]);
		send("pointerdown", 51, 150, 150);
		lift(51, 160, 160);
		expect(log).toEqual(["down:51", "up:51"]);
	});

	it("does not get the release of a finger lifted outside it", () => {
		const region = box(100, 100, 200, 200);
		const log = record(region, ["pointerdown", "pointerup", "pointerleave"]);
		send("pointerdown", 61, 150, 150);
		send("pointerdown", 62, 250, 250);
		// the first finger slides off it and lifts outside
		send("pointermove", 61, 350, 150);
		lift(61, 350, 150);
		lift(62, 250, 250);
		expect(
			log.filter((e) => {
				return e.startsWith("up");
			}),
		).toEqual(["up:62"]);
	});

	it("does not get the release of a finger that pressed elsewhere", () => {
		const region = box(100, 100, 200, 200);
		const log = record(region, ["pointerdown", "pointerup"]);
		send("pointerdown", 71, 150, 150);
		// pressed outside, slid on, lifted on it
		send("pointerdown", 72, 400, 400);
		send("pointermove", 72, 200, 200);
		lift(72, 200, 200);
		lift(71, 150, 150);
		expect(log).toEqual(["down:71", "up:71"]);
	});

	it("does not get a release under a region that took the pointer away", () => {
		const below = box(100, 100, 200, 200);
		const above = box(200, 100, 200, 200);
		app.world.moveToTop(above);
		index();
		const log = record(below, ["pointerdown", "pointerup", "pointerleave"]);
		// the region above consumes moves, not releases
		input.registerPointerEvent("pointermove", above, () => {
			return false;
		});
		send("pointerdown", 1, 150, 150, "mouse");
		send("pointermove", 1, 250, 150, "mouse");
		send("pointerup", 1, 250, 150, "mouse");
		expect(log).toEqual(["down:1", "leave:1"]);
	});

	it("a mouse: the release after leaving the region and coming back", () => {
		const region = box(100, 100, 200, 200);
		const log = record(region, [
			"pointerdown",
			"pointerup",
			"pointerenter",
			"pointerleave",
		]);
		send("pointermove", 1, 150, 150, "mouse");
		send("pointerdown", 1, 150, 150, "mouse");
		send("pointermove", 1, 350, 150, "mouse");
		send("pointermove", 1, 160, 150, "mouse");
		send("pointerup", 1, 160, 150, "mouse");
		send("pointermove", 1, 350, 150, "mouse");
		expect(log).toEqual([
			"enter:1",
			"down:1",
			"leave:1",
			"enter:1",
			"up:1",
			"leave:1",
		]);
	});

	it("a mouse released outside does not reach it on the next click elsewhere", () => {
		const region = box(100, 100, 200, 200);
		const log = record(region, ["pointerdown", "pointerup", "pointerleave"]);
		send("pointerdown", 1, 150, 150, "mouse");
		send("pointermove", 1, 350, 150, "mouse");
		send("pointerup", 1, 350, 150, "mouse");
		send("pointerdown", 1, 500, 500, "mouse");
		send("pointerup", 1, 500, 500, "mouse");
		expect(log).toEqual(["down:1", "leave:1"]);
	});
});
