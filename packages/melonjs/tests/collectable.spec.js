import { beforeAll, describe, expect, it } from "vitest";
import { boot, Collectable, collision, Rect, video } from "../src/index.js";

let mockImage;

beforeAll(() => {
	boot();
	video.init(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	// Collectable extends Sprite, which throws when constructed without
	// a renderable image. A small offscreen canvas is enough to satisfy
	// the constructor without preloading a real asset.
	mockImage = video.createCanvas(32, 32);
});

describe("Collectable", () => {
	const settings = () => {
		return {
			image: mockImage,
			framewidth: 32,
			frameheight: 32,
			width: 32,
			height: 32,
		};
	};

	describe("default bodyDef", () => {
		it("should declare a static body for collision", () => {
			const c = new Collectable(0, 0, settings());
			expect(c.bodyDef).toBeDefined();
			expect(c.bodyDef.type).toEqual("static");
		});

		it("should restrict collisions to PLAYER_OBJECT by default", () => {
			const c = new Collectable(0, 0, settings());
			expect(c.bodyDef.collisionType).toEqual(
				collision.types.COLLECTABLE_OBJECT,
			);
			expect(c.bodyDef.collisionMask).toEqual(collision.types.PLAYER_OBJECT);
		});

		// Collectables are detection-only — the player picks them up on
		// overlap, doesn't bounce off them. Marking the bodyDef as a
		// sensor makes that intent explicit and portable: under the
		// builtin adapter the SAT detector already skipped push-out (no
		// `onCollision` defined on Collectable), but Matter's solver
		// resolves every contact unless `isSensor` is set.
		it("should declare the body as a sensor", () => {
			const c = new Collectable(0, 0, settings());
			expect(c.bodyDef.isSensor).toEqual(true);
		});

		it("should accept custom shapes via settings", () => {
			const r = new Rect(0, 0, 16, 16);
			const c = new Collectable(0, 0, { ...settings(), shapes: [r] });
			expect(c.bodyDef.shapes[0]).toBe(r);
		});
	});
});
