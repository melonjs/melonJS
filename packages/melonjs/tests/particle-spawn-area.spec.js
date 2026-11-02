import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, ParticleEmitter, video } from "../src/index.js";

/**
 * Where the spawn area is. The constructor centres it on the point it is
 * given; after that, `pos` is its top left corner, as for any renderable.
 */
describe("particle spawn area", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app.destroy?.();
	});

	const spawned = (emitter) => {
		app.world.addChild(emitter);
		emitter.burstParticles(200);
		const xs = emitter.getChildren().map((p) => {
			return p.pos.x;
		});
		const ys = emitter.getChildren().map((p) => {
			return p.pos.y;
		});
		app.world.removeChildNow(emitter);
		return {
			minX: Math.min(...xs),
			maxX: Math.max(...xs),
			minY: Math.min(...ys),
			maxY: Math.max(...ys),
		};
	};

	it("the constructor centres the area on (x, y)", () => {
		const emitter = new ParticleEmitter(200, 150, {
			width: 100,
			height: 60,
			referenceSpace: "world",
		});
		expect(emitter.pos.x).toBe(150);
		expect(emitter.pos.y).toBe(120);
		const area = spawned(emitter);
		expect(area.minX).toBeGreaterThanOrEqual(150);
		expect(area.maxX).toBeLessThanOrEqual(250);
		expect(area.minY).toBeGreaterThanOrEqual(120);
		expect(area.maxY).toBeLessThanOrEqual(180);
		// and it is spread around that centre, not piled in one corner
		expect(area.minX).toBeLessThan(170);
		expect(area.maxX).toBeGreaterThan(230);
	});

	it("moving pos afterwards places the area's top left corner", () => {
		const emitter = new ParticleEmitter(0, 0, {
			width: 100,
			height: 60,
			referenceSpace: "world",
		});
		emitter.pos.set(300, 200);
		const area = spawned(emitter);
		expect(area.minX).toBeGreaterThanOrEqual(300);
		expect(area.maxX).toBeLessThanOrEqual(400);
		expect(area.minY).toBeGreaterThanOrEqual(200);
		expect(area.maxY).toBeLessThanOrEqual(260);
	});
});
