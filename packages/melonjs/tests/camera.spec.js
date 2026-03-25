import { describe, expect, it } from "vitest";
import {
	boot,
	Camera2d,
	game,
	Renderable,
	Vector2d,
	video,
} from "../src/index.js";

const setup = () => {
	boot();
	video.init(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
	});

	// a camera instance
	const camera = new Camera2d(0, 0, 1000, 1000);
	// am infinite camera
	const infiniteCamera = new Camera2d(-Infinity, -Infinity, Infinity, Infinity);
	// a vector instance
	const result = new Vector2d();
	// a 10x10 renderable
	const renderable10x10 = new Renderable(0, 0, 10, 10);

	return { camera, infiniteCamera, result, renderable10x10 };
};

describe("Camera2d", () => {
	it("convert between local and World coords without transforms", async () => {
		const { camera, result } = setup();
		// reset the camera
		camera.reset(0, 0);
		// update position so that it's not just 0
		camera.move(100, 100);
		// convert to word coordinates
		camera.localToWorld(250, 150, result);
		// convert back to local coordinates
		camera.worldToLocal(result.x, result.y, result);

		expect(result.x).toBeCloseTo(250);
		expect(result.y).toBeCloseTo(150);
	});

	it("convert between local and World coords with transforms", async () => {
		const { camera, result } = setup();
		// reset the camera
		camera.reset(0, 0);
		// update position so that it's not just 0
		camera.move(100, 100);
		// rotate the viewport
		camera.currentTransform.rotate(0.5);
		// make sure the camera go through one round of update
		camera.update(0.16);
		// convert to word coordinates
		camera.localToWorld(250, 150, result);
		// convert back to local coordinates
		camera.worldToLocal(result.x, result.y, result);
		expect(result.x).toBeCloseTo(250);
		expect(result.y).toBeCloseTo(150);
	});

	it("isVisible function test", async () => {
		const { camera, renderable10x10, infiniteCamera } = setup();
		// reset the camera
		camera.reset(0, 0);
		// set bounds large enough to allow camera movement
		camera.setBounds(0, 0, 2000, 2000);

		// make it easier by setting anchor point to 0, 0
		renderable10x10.anchorPoint.set(0, 0);
		// check if obj is visible
		expect(camera.isVisible(renderable10x10)).toEqual(true);

		// move the object half-way over the camera origin point
		renderable10x10.pos.set(-5, -5, 0);
		// check if obj is visible
		expect(camera.isVisible(renderable10x10)).toEqual(true);

		// change camera position so that the object is not visible anymore
		camera.move(100, 100);
		// check if obj is visible
		expect(camera.isVisible(renderable10x10)).toEqual(false);

		// set as floating
		renderable10x10.floating = true;
		// should be visible again
		expect(camera.isVisible(renderable10x10)).toEqual(true);

		// should always be visible if camera size is Infinite
		renderable10x10.floating = false;
		expect(infiniteCamera.isVisible(renderable10x10)).toEqual(true);

		// should always be visible if camera size is Infinite
		renderable10x10.floating = true;
		expect(infiniteCamera.isVisible(renderable10x10)).toEqual(true);
	});

	describe("reset()", () => {
		it("should reset the camera position to 0,0 by default", () => {
			const { camera } = setup();
			camera.move(200, 300);
			camera.reset();
			expect(camera.pos.x).toEqual(0);
			expect(camera.pos.y).toEqual(0);
		});

		it("should reset the camera position to specified coordinates", () => {
			const { camera } = setup();
			camera.move(200, 300);
			camera.reset(50, 75);
			expect(camera.pos.x).toEqual(50);
			expect(camera.pos.y).toEqual(75);
		});

		it("should unfollow any target after reset", () => {
			const { camera } = setup();
			const target = new Vector2d(100, 100);
			camera.follow(target, camera.AXIS.BOTH);
			expect(camera.target).not.toBeNull();
			camera.reset();
			expect(camera.target).toBeNull();
			expect(camera.follow_axis).toEqual(camera.AXIS.NONE);
		});

		it("should reset damping to default value", () => {
			const { camera } = setup();
			camera.damping = 0.5;
			camera.reset();
			expect(camera.damping).toEqual(1.0);
			expect(camera.smoothFollow).toEqual(true);
		});
	});

	describe("resize()", () => {
		it("should resize the camera dimensions", () => {
			const { camera } = setup();
			camera.resize(640, 480);
			expect(camera.width).toEqual(640);
			expect(camera.height).toEqual(480);
		});

		it("should return the camera instance for chaining", () => {
			const { camera } = setup();
			const result = camera.resize(640, 480);
			expect(result).toBe(camera);
		});

		it("should update bounds after resize", () => {
			const { camera } = setup();
			camera.resize(640, 480);
			expect(camera.bounds.width).toEqual(640);
			expect(camera.bounds.height).toEqual(480);
		});
	});

	describe("setBounds()", () => {
		it("should set the camera world bounds", () => {
			const { camera } = setup();
			camera.setBounds(0, 0, 2000, 1500);
			expect(camera.bounds.left).toEqual(0);
			expect(camera.bounds.top).toEqual(0);
			expect(camera.bounds.width).toEqual(2000);
			expect(camera.bounds.height).toEqual(1500);
		});

		it("should set bounds with non-zero origin", () => {
			const { camera } = setup();
			camera.setBounds(100, 50, 2000, 1500);
			expect(camera.bounds.left).toEqual(100);
			expect(camera.bounds.top).toEqual(50);
			// bounds.width/height are computed as max - min
			expect(camera.bounds.width).toEqual(2000);
			expect(camera.bounds.height).toEqual(1500);
		});
	});

	describe("move() / moveTo()", () => {
		it("move() should offset the camera position", () => {
			const { camera } = setup();
			camera.reset(0, 0);
			camera.setBounds(0, 0, 2000, 2000);
			camera.moveTo(100, 100);
			camera.move(50, 75);
			expect(camera.pos.x).toEqual(150);
			expect(camera.pos.y).toEqual(175);
		});

		it("moveTo() should set the camera position directly", () => {
			const { camera } = setup();
			camera.reset(0, 0);
			camera.setBounds(0, 0, 2000, 2000);
			camera.moveTo(300, 400);
			expect(camera.pos.x).toEqual(300);
			expect(camera.pos.y).toEqual(400);
		});

		it("moveTo() should clamp position within bounds", () => {
			const { camera } = setup();
			camera.reset(0, 0);
			camera.resize(200, 200);
			camera.setBounds(0, 0, 500, 500);
			// try to move beyond the lower bounds
			camera.moveTo(-100, -100);
			expect(camera.pos.x).toEqual(0);
			expect(camera.pos.y).toEqual(0);
			// try to move beyond the upper bounds (500 - 200 = 300 max)
			camera.moveTo(400, 400);
			expect(camera.pos.x).toEqual(300);
			expect(camera.pos.y).toEqual(300);
		});
	});

	describe("follow() / unfollow()", () => {
		it("follow() should set the target with a Vector2d", () => {
			const { camera } = setup();
			const target = new Vector2d(200, 200);
			camera.follow(target, camera.AXIS.BOTH);
			expect(camera.target).toBe(target);
			expect(camera.follow_axis).toEqual(camera.AXIS.BOTH);
		});

		it("follow() should set the target with a Renderable", () => {
			const { camera } = setup();
			const target = new Renderable(200, 200, 32, 32);
			camera.follow(target, camera.AXIS.BOTH);
			// follow with Renderable stores target.pos
			expect(camera.target).toBe(target.pos);
		});

		it("follow() should accept an axis parameter", () => {
			const { camera } = setup();
			const target = new Vector2d(200, 200);
			camera.follow(target, camera.AXIS.HORIZONTAL);
			expect(camera.follow_axis).toEqual(camera.AXIS.HORIZONTAL);
		});

		it("follow() should set damping when provided", () => {
			const { camera } = setup();
			const target = new Vector2d(200, 200);
			camera.follow(target, camera.AXIS.BOTH, 0.5);
			expect(camera.damping).toEqual(0.5);
		});

		it("follow() should default damping to 1 if not a number", () => {
			const { camera } = setup();
			const target = new Vector2d(200, 200);
			camera.follow(target, camera.AXIS.BOTH);
			expect(camera.damping).toEqual(1);
		});

		it("follow() should throw for invalid target", () => {
			const { camera } = setup();
			expect(() => {
				camera.follow({ x: 0, y: 0 }, camera.AXIS.BOTH);
			}).toThrow("invalid target for me.Camera2d.follow");
		});

		it("unfollow() should clear the target", () => {
			const { camera } = setup();
			const target = new Vector2d(200, 200);
			camera.follow(target, camera.AXIS.BOTH);
			camera.unfollow();
			expect(camera.target).toBeNull();
			expect(camera.follow_axis).toEqual(camera.AXIS.NONE);
		});
	});

	describe("setDeadzone()", () => {
		it("should set the deadzone dimensions", () => {
			const { camera } = setup();
			camera.setDeadzone(100, 80);
			expect(camera.deadzone).toBeDefined();
			expect(camera.deadzone.width).toEqual(100);
			expect(camera.deadzone.height).toEqual(80);
		});

		it("should center the deadzone within the camera", () => {
			const { camera } = setup();
			camera.resize(800, 600);
			camera.setDeadzone(200, 100);
			// deadzone x = ~~((800 - 200) / 2) = 300
			expect(camera.deadzone.pos.x).toEqual(300);
			// deadzone y = ~~((600 - 100) / 2 - 100 * 0.25) = ~~(250 - 25) = 225
			expect(camera.deadzone.pos.y).toEqual(225);
		});
	});

	describe("focusOn()", () => {
		it("should center the camera on a renderable", () => {
			const { camera } = setup();
			camera.reset(0, 0);
			camera.resize(800, 600);
			camera.setBounds(0, 0, 2000, 2000);
			const target = new Renderable(500, 400, 64, 64);
			target.anchorPoint.set(0, 0);
			camera.focusOn(target);
			// focusOn centers camera on target's bounds center
			const bounds = target.getBounds();
			const expectedX = bounds.left + bounds.width / 2 - 800 / 2;
			const expectedY = bounds.top + bounds.height / 2 - 600 / 2;
			expect(camera.pos.x).toBeCloseTo(expectedX);
			expect(camera.pos.y).toBeCloseTo(expectedY);
		});
	});

	describe("screenX / screenY (viewport offset)", () => {
		it("should default to 0, 0", () => {
			const { camera } = setup();
			expect(camera.screenX).toEqual(0);
			expect(camera.screenY).toEqual(0);
		});

		it("should be settable", () => {
			const { camera } = setup();
			camera.screenX = 620;
			camera.screenY = 10;
			expect(camera.screenX).toEqual(620);
			expect(camera.screenY).toEqual(10);
		});

		it("should not affect pos (world position)", () => {
			const { camera } = setup();
			camera.setBounds(0, 0, 2000, 2000);
			camera.screenX = 500;
			camera.screenY = 100;
			camera.moveTo(200, 200);
			expect(camera.pos.x).toEqual(200);
			expect(camera.pos.y).toEqual(200);
			expect(camera.screenX).toEqual(500);
			expect(camera.screenY).toEqual(100);
		});

		it("should allow creating a minimap-style camera", () => {
			setup();
			const minimap = new Camera2d(0, 0, 180, 100);
			minimap.screenX = 620;
			minimap.screenY = 10;
			minimap.name = "minimap";
			expect(minimap.width).toEqual(180);
			expect(minimap.height).toEqual(100);
			expect(minimap.screenX).toEqual(620);
			expect(minimap.screenY).toEqual(10);
			expect(minimap.name).toEqual("minimap");
		});

		it("should support zoom via currentTransform.scale", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			// simulate zoom out
			cam.currentTransform.scale(0.1, 0.1);
			expect(cam.currentTransform.isIdentity()).toBe(false);
			expect(cam.screenX).toEqual(620);
		});

		it("should keep screenX/screenY independent from resize", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.resize(1890, 1050);
			expect(cam.width).toEqual(1890);
			expect(cam.height).toEqual(1050);
			expect(cam.screenX).toEqual(620);
			expect(cam.screenY).toEqual(10);
		});

		it("should preserve screenX/screenY after reset", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.reset(0, 0);
			expect(cam.screenX).toEqual(620);
			expect(cam.screenY).toEqual(10);
		});
	});

	describe("draw() state management", () => {
		it("should restore renderer save/restore stack depth after draw", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 800, 600);
			cam.reset(0, 0);

			const depthBefore = renderer.renderState._stackDepth;
			cam.draw(renderer, game.world);
			const depthAfter = renderer.renderState._stackDepth;

			expect(depthAfter).toEqual(depthBefore);
		});

		it("should restore renderer stack depth for offset cameras", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.reset(0, 0);

			const depthBefore = renderer.renderState._stackDepth;
			cam.draw(renderer, game.world);
			const depthAfter = renderer.renderState._stackDepth;

			expect(depthAfter).toEqual(depthBefore);
		});

		it("should restore container transform after draw", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 800, 600);
			cam.reset(0, 0);
			cam.moveTo(100, 50);

			const txBefore = game.world.currentTransform.tx;
			const tyBefore = game.world.currentTransform.ty;
			cam.draw(renderer, game.world);

			expect(game.world.currentTransform.tx).toBeCloseTo(txBefore);
			expect(game.world.currentTransform.ty).toBeCloseTo(tyBefore);
		});

		it("should restore container transform for offset cameras", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.reset(0, 0);

			const txBefore = game.world.currentTransform.tx;
			const tyBefore = game.world.currentTransform.ty;
			cam.draw(renderer, game.world);

			expect(game.world.currentTransform.tx).toBeCloseTo(txBefore);
			expect(game.world.currentTransform.ty).toBeCloseTo(tyBefore);
		});
	});
});
