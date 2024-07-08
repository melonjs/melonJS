import { describe, expect, it } from "vitest";
import { Camera2d, Renderable, Vector2d, boot, video } from "../src/index.js";

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
});
