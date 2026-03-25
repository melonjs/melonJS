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

	describe("isVisible()", () => {
		it("should detect object inside the camera", () => {
			const { camera, renderable10x10 } = setup();
			camera.reset(0, 0);
			camera.setBounds(0, 0, 2000, 2000);
			renderable10x10.anchorPoint.set(0, 0);
			expect(camera.isVisible(renderable10x10)).toEqual(true);
		});

		it("should detect object partially overlapping the camera origin", () => {
			const { camera, renderable10x10 } = setup();
			camera.reset(0, 0);
			camera.setBounds(0, 0, 2000, 2000);
			renderable10x10.anchorPoint.set(0, 0);
			renderable10x10.pos.set(-5, -5, 0);
			expect(camera.isVisible(renderable10x10)).toEqual(true);
		});

		it("should not detect object outside the camera after move", () => {
			const { camera, renderable10x10 } = setup();
			camera.reset(0, 0);
			camera.setBounds(0, 0, 2000, 2000);
			renderable10x10.anchorPoint.set(0, 0);
			camera.move(100, 100);
			expect(camera.isVisible(renderable10x10)).toEqual(false);
		});

		it("should detect floating object regardless of camera position", () => {
			const { camera, renderable10x10 } = setup();
			camera.reset(0, 0);
			camera.setBounds(0, 0, 2000, 2000);
			renderable10x10.anchorPoint.set(0, 0);
			camera.move(100, 100);
			renderable10x10.floating = true;
			expect(camera.isVisible(renderable10x10)).toEqual(true);
		});

		it("should always detect objects in an infinite camera", () => {
			const { infiniteCamera, renderable10x10 } = setup();
			renderable10x10.anchorPoint.set(0, 0);
			renderable10x10.floating = false;
			expect(infiniteCamera.isVisible(renderable10x10)).toEqual(true);
			renderable10x10.floating = true;
			expect(infiniteCamera.isVisible(renderable10x10)).toEqual(true);
		});

		it("should detect object at the exact right/bottom edge of the camera", () => {
			setup();
			const cam = new Camera2d(0, 0, 200, 200);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(199, 199, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(true);
		});

		it("should not detect object just outside the right edge", () => {
			setup();
			const cam = new Camera2d(0, 0, 200, 200);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(201, 0, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(false);
		});

		it("should not detect object just outside the bottom edge", () => {
			setup();
			const cam = new Camera2d(0, 0, 200, 200);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(0, 201, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(false);
		});

		it("should detect large object spanning the full camera", () => {
			setup();
			const cam = new Camera2d(0, 0, 200, 200);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(0, 0, 500, 500);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(true);
		});

		it("should detect object after camera moves to it", () => {
			setup();
			const cam = new Camera2d(0, 0, 200, 200);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(500, 500, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(false);
			cam.moveTo(495, 495);
			expect(cam.isVisible(obj)).toEqual(true);
		});

		it("should expand visible area when zoomed out", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(150, 150, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(false);
			cam.zoom = 0.5;
			expect(cam.isVisible(obj)).toEqual(true);
		});

		it("should shrink visible area when zoomed in", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			const obj = new Renderable(80, 80, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(true);
			cam.zoom = 2;
			expect(cam.isVisible(obj)).toEqual(false);
		});

		it("should account for camera position when zoomed", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.zoom = 0.5;
			cam.moveTo(300, 300);
			// visible world area: 300,300 to 500,500 (100/0.5 = 200 wide)
			const inside = new Renderable(400, 400, 10, 10);
			inside.anchorPoint.set(0, 0);
			expect(cam.isVisible(inside)).toEqual(true);
			const outside = new Renderable(100, 100, 10, 10);
			outside.anchorPoint.set(0, 0);
			expect(cam.isVisible(outside)).toEqual(false);
		});

		it("should detect floating objects on zoomed cameras", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.zoom = 0.5;
			cam.moveTo(500, 500);
			const obj = new Renderable(10, 10, 10, 10);
			obj.anchorPoint.set(0, 0);
			// not visible in world space (camera is at 500,500)
			expect(cam.isVisible(obj)).toEqual(false);
			// floating: checked against screen coordinates
			obj.floating = true;
			expect(cam.isVisible(obj)).toEqual(true);
		});

		it("should handle object partially overlapping zoomed camera edge", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.zoom = 0.5;
			// visible world area: 0,0 to 200,200
			const obj = new Renderable(195, 195, 20, 20);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(true);
		});
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

	describe("zoom property", () => {
		it("should default to 1", () => {
			const { camera } = setup();
			expect(camera.zoom).toEqual(1);
		});

		it("should be settable", () => {
			const { camera } = setup();
			camera.zoom = 0.5;
			expect(camera.zoom).toEqual(0.5);
		});

		it("should not affect camera dimensions", () => {
			const { camera } = setup();
			camera.zoom = 0.5;
			expect(camera.width).toEqual(1000);
			expect(camera.height).toEqual(1000);
		});

		it("should clamp invalid values to 1", () => {
			const { camera } = setup();
			camera.zoom = 0;
			expect(camera.zoom).toEqual(1);
			camera.zoom = -2;
			expect(camera.zoom).toEqual(1);
			camera.zoom = 0.001;
			expect(camera.zoom).toEqual(0.001);
		});

		it("should affect isVisible with zoomed-out world area", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			// object at (150, 150) is outside a 100x100 camera
			const obj = new Renderable(150, 150, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(false);

			// zoom out — visible world area becomes 200x200
			cam.zoom = 0.5;
			expect(cam.isVisible(obj)).toEqual(true);
		});

		it("should keep objects outside zoomed-in area not visible", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			// object at (80, 80) is inside a 100x100 camera
			const obj = new Renderable(80, 80, 10, 10);
			obj.anchorPoint.set(0, 0);
			expect(cam.isVisible(obj)).toEqual(true);

			// zoom in — visible world area becomes 50x50
			cam.zoom = 2;
			expect(cam.isVisible(obj)).toEqual(false);
		});
	});

	describe("isDefault", () => {
		it("should be true for a default camera", () => {
			const { camera } = setup();
			expect(camera.isDefault).toEqual(true);
		});

		it("should be false when screenX is set", () => {
			const { camera } = setup();
			camera.screenX = 100;
			expect(camera.isDefault).toEqual(false);
		});

		it("should be false when screenY is set", () => {
			const { camera } = setup();
			camera.screenY = 50;
			expect(camera.isDefault).toEqual(false);
		});

		it("should be false when zoom is not 1", () => {
			const { camera } = setup();
			camera.zoom = 0.5;
			expect(camera.isDefault).toEqual(false);
		});

		it("should be false when both offset and zoom are set", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			expect(cam.isDefault).toEqual(false);
		});

		it("should return to true when properties are reset to defaults", () => {
			const { camera } = setup();
			camera.screenX = 100;
			camera.zoom = 0.5;
			expect(camera.isDefault).toEqual(false);
			camera.screenX = 0;
			camera.zoom = 1;
			expect(camera.isDefault).toEqual(true);
		});
	});

	describe("worldView", () => {
		it("should match camera bounds when zoom is 1", () => {
			const { camera } = setup();
			camera.reset(0, 0);
			const view = camera.worldView;
			expect(view.left).toEqual(0);
			expect(view.top).toEqual(0);
			expect(view.width).toEqual(camera.width);
			expect(view.height).toEqual(camera.height);
		});

		it("should expand when zoomed out", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.zoom = 0.5;
			const view = cam.worldView;
			expect(view.width).toEqual(200);
			expect(view.height).toEqual(200);
		});

		it("should shrink when zoomed in", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.zoom = 2;
			const view = cam.worldView;
			expect(view.width).toEqual(50);
			expect(view.height).toEqual(50);
		});

		it("should reflect camera position", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.moveTo(300, 400);
			const view = cam.worldView;
			expect(view.left).toEqual(300);
			expect(view.top).toEqual(400);
		});

		it("should reflect both position and zoom", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.moveTo(200, 200);
			cam.zoom = 0.5;
			const view = cam.worldView;
			expect(view.left).toEqual(200);
			expect(view.top).toEqual(200);
			expect(view.width).toEqual(200);
			expect(view.height).toEqual(200);
		});

		it("should return a cached bounds object", () => {
			const { camera } = setup();
			const view1 = camera.worldView;
			const view2 = camera.worldView;
			expect(view1).toBe(view2);
		});
	});

	describe("setViewport()", () => {
		it("should set screenX and screenY", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.setViewport(620, 10);
			expect(cam.screenX).toEqual(620);
			expect(cam.screenY).toEqual(10);
		});

		it("should not change dimensions when w/h are omitted", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.setViewport(620, 10);
			expect(cam.width).toEqual(180);
			expect(cam.height).toEqual(100);
		});

		it("should set dimensions when w/h are provided", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.setViewport(620, 10, 200, 150);
			expect(cam.screenX).toEqual(620);
			expect(cam.screenY).toEqual(10);
			expect(cam.width).toEqual(200);
			expect(cam.height).toEqual(150);
		});

		it("should return the camera for chaining", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			const result = cam.setViewport(620, 10);
			expect(result).toBe(cam);
		});
	});

	describe("rotation", () => {
		it("should not affect camera dimensions", () => {
			const { camera } = setup();
			camera.currentTransform.rotate(Math.PI / 4);
			expect(camera.width).toEqual(1000);
			expect(camera.height).toEqual(1000);
		});

		it("should preserve rotation after draw", () => {
			setup();
			const r = video.renderer;
			const cam = new Camera2d(0, 0, 800, 600);
			cam.reset(0, 0);
			cam.currentTransform.rotate(0.5);

			const angleBefore = Math.atan2(
				cam.currentTransform.val[1],
				cam.currentTransform.val[0],
			);
			cam.draw(r, game.world);
			const angleAfter = Math.atan2(
				cam.currentTransform.val[1],
				cam.currentTransform.val[0],
			);
			expect(angleAfter).toBeCloseTo(angleBefore);
		});

		it("should restore renderer stack depth after rotated draw", () => {
			setup();
			const r = video.renderer;
			const cam = new Camera2d(0, 0, 800, 600);
			cam.reset(0, 0);
			cam.currentTransform.rotate(0.5);

			const depthBefore = r.renderState._stackDepth;
			cam.draw(r, game.world);
			expect(r.renderState._stackDepth).toEqual(depthBefore);
		});

		it("should work combined with zoom", () => {
			setup();
			const r = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.5;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.currentTransform.rotate(0.3);

			const depthBefore = r.renderState._stackDepth;
			cam.draw(r, game.world);
			expect(r.renderState._stackDepth).toEqual(depthBefore);
			expect(cam.width).toEqual(180);
			expect(cam.height).toEqual(100);
		});

		it("should maintain correct worldView when rotated", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.currentTransform.rotate(0.5);

			// worldView is axis-aligned and based on pos/zoom, not rotation
			const view = cam.worldView;
			expect(view.left).toEqual(0);
			expect(view.top).toEqual(0);
			expect(view.width).toEqual(100);
			expect(view.height).toEqual(100);
		});

		it("should maintain correct worldView when rotated and zoomed", () => {
			setup();
			const cam = new Camera2d(0, 0, 100, 100);
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);
			cam.currentTransform.rotate(0.5);
			cam.zoom = 0.5;

			const view = cam.worldView;
			expect(view.width).toEqual(200);
			expect(view.height).toEqual(200);
		});
	});

	describe("autoResize", () => {
		it("should default to true", () => {
			const { camera } = setup();
			expect(camera.autoResize).toEqual(true);
		});

		it("should skip resize when autoResize is false", () => {
			setup();
			const cam = new Camera2d(0, 0, 180, 100);
			cam.autoResize = false;
			cam.setBounds(0, 0, 2000, 2000);

			cam.resize(1920, 1080);

			// dimensions and bounds should be unchanged
			expect(cam.width).toEqual(180);
			expect(cam.height).toEqual(100);
			expect(cam.bounds.width).toEqual(2000);
			expect(cam.bounds.height).toEqual(2000);
		});

		it("should still resize when autoResize is true", () => {
			setup();
			const cam = new Camera2d(0, 0, 800, 600);
			cam.autoResize = true;

			cam.resize(1920, 1080);

			expect(cam.width).toEqual(1920);
			expect(cam.height).toEqual(1080);
		});
	});

	describe("worldProjection / screenProjection", () => {
		it("should be identity by default", () => {
			const { camera } = setup();
			expect(camera.worldProjection.isIdentity()).toEqual(true);
			expect(camera.screenProjection.isIdentity()).toEqual(true);
		});

		it("should be updated after drawing a non-default camera", () => {
			setup();
			const r = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			cam.draw(r, game.world);

			expect(cam.worldProjection.isIdentity()).toEqual(false);
			expect(cam.screenProjection.isIdentity()).toEqual(false);
		});

		it("should remain identity after drawing a default camera", () => {
			setup();
			const r = video.renderer;
			const cam = new Camera2d(0, 0, 800, 600);
			cam.reset(0, 0);

			cam.draw(r, game.world);

			expect(cam.worldProjection.isIdentity()).toEqual(true);
			expect(cam.screenProjection.isIdentity()).toEqual(true);
		});

		it("should be reset to identity after reset()", () => {
			setup();
			const r = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			cam.draw(r, game.world);
			expect(cam.worldProjection.isIdentity()).toEqual(false);

			cam.reset(0, 0);
			expect(cam.worldProjection.isIdentity()).toEqual(true);
			expect(cam.screenProjection.isIdentity()).toEqual(true);
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

		it("should restore renderer stack depth for zoomed cameras", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

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

		it("should restore container transform for zoomed cameras", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			const txBefore = game.world.currentTransform.tx;
			const tyBefore = game.world.currentTransform.ty;
			cam.draw(renderer, game.world);

			expect(game.world.currentTransform.tx).toBeCloseTo(txBefore);
			expect(game.world.currentTransform.ty).toBeCloseTo(tyBefore);
		});

		it("should restore camera dimensions after zoomed draw", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			cam.draw(renderer, game.world);

			expect(cam.width).toEqual(180);
			expect(cam.height).toEqual(100);
		});

		it("should not fire resize events during zoomed draw", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.zoom = 0.1;
			cam.reset(0, 0);
			cam.setBounds(0, 0, 2000, 2000);

			// projectionMatrix should remain based on camera's actual size (180x100),
			// not the temporarily expanded size
			const projBefore = cam.projectionMatrix.val.slice();
			cam.draw(renderer, game.world);
			const projAfter = cam.projectionMatrix.val.slice();

			expect(projAfter).toEqual(projBefore);
		});

		it("should compensate for container centering offset on non-default cameras", () => {
			setup();
			const renderer = video.renderer;
			const cam = new Camera2d(0, 0, 180, 100);
			cam.screenX = 620;
			cam.screenY = 10;
			cam.reset(0, 0);

			// simulate a centered world container (e.g. viewport wider than level)
			game.world.pos.set(200, 0, 0);

			const txBefore = game.world.currentTransform.tx;
			const tyBefore = game.world.currentTransform.ty;
			cam.draw(renderer, game.world);

			// transform should be fully restored
			expect(game.world.currentTransform.tx).toBeCloseTo(txBefore);
			expect(game.world.currentTransform.ty).toBeCloseTo(tyBefore);

			// restore world pos
			game.world.pos.set(0, 0, 0);
		});
	});
});
