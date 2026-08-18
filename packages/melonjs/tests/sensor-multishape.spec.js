/**
 * A sensor body must not be repositioned — including when it has more than
 * one shape.
 *
 * `body.isSensor` means "detects contacts, is not solid". The main push-out
 * honours it (`detector.js`, the `eitherSensor` gate). But a body with 2+
 * shapes also runs an **extra-pass loop** afterwards, which resolves leftover
 * overlaps at shape junctions (polylines, compound colliders) by writing
 * positions directly — and that loop checks only `isStatic`.
 *
 * So a multi-shape sensor is pushed out anyway. The flag works on a
 * single-shape body and silently stops working the moment a second shape is
 * added, which is the kind of bug that reads as "collision is flaky".
 *
 * It survived because nothing covered the intersection: the sensor specs
 * (`builtin-adapter-collision-contracts`, `trigger`) all use single-shape
 * bodies, and the multi-shape specs (`body`) do not use sensors.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

describe("Physics : a sensor body is never repositioned", () => {
	/** @type {World} */
	let world;
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

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	/**
	 * A sensor overlapping a solid body. `shapes` decides whether the extra-pass
	 * loop runs at all — it is gated on `shapes.length > 1`.
	 * @param {Rect[]} shapes - the sensor body's shapes
	 * @returns {object} the sensor renderable
	 */
	const setup = (shapes) => {
		const sensor = new Renderable(100, 100, 32, 32);
		sensor.alwaysUpdate = true;
		sensor.bodyDef = {
			type: "dynamic",
			shapes,
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			gravityScale: 0,
			isSensor: true,
		};
		world.addChild(sensor);

		// overlaps the sensor by 16px horizontally
		const solid = new Renderable(116, 100, 32, 32);
		solid.alwaysUpdate = true;
		solid.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			gravityScale: 0,
		};
		world.addChild(solid);
		return sensor;
	};

	const step = () => {
		world.update(16);
	};

	// control: proves the sensor flag works at all, so a failure below is
	// specifically about shape count and not about sensors being broken
	it("holds position with ONE shape", () => {
		const sensor = setup([new Rect(0, 0, 32, 32)]);
		const before = { x: sensor.pos.x, y: sensor.pos.y };
		step();
		expect(sensor.pos.x).toBe(before.x);
		expect(sensor.pos.y).toBe(before.y);
	});

	// the bug: identical setup, one extra shape. The extra-pass loop engages
	// and repositions a body that declared itself non-solid.
	it("holds position with TWO shapes", () => {
		const sensor = setup([new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
		const before = { x: sensor.pos.x, y: sensor.pos.y };
		step();
		expect(sensor.pos.x).toBe(before.x);
		expect(sensor.pos.y).toBe(before.y);
	});
});
