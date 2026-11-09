/**
 * The Canvas renderer's placement of a Spine object: the reference the GPU
 * paths are held to (see webgl-transform.spec.ts). The canvas skeleton
 * renderer draws through the renderer's own transform, so the camera and the
 * parent container have always applied here; this pins that, and that
 * `scale()`, `rotate()` and the flips each apply once.
 *
 * Measured on the pixels drawn: the fixture skeleton is one opaque white
 * 40x40 box on a black background.
 */

import { Application, Container, plugin, Vector3d, video } from "melonjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Spine, { SpinePlugin } from "../src/index.js";

interface Box {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

let app: Application;

/** draw one frame and return the box of the lit pixels */
const frame = (): Box => {
	app.world.update(16);
	app.isDirty = true;
	app.draw();
	const canvas = app.renderer.getCanvas();
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
	const { data, width, height } = ctx.getImageData(
		0,
		0,
		canvas.width,
		canvas.height,
	);
	const box = {
		minX: Number.POSITIVE_INFINITY,
		minY: Number.POSITIVE_INFINITY,
		maxX: Number.NEGATIVE_INFINITY,
		maxY: Number.NEGATIVE_INFINITY,
	};
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// fully lit only, so anti-aliased edges do not widen the box
			if (data[(y * width + x) * 4] > 200) {
				box.minX = Math.min(box.minX, x);
				box.minY = Math.min(box.minY, y);
				box.maxX = Math.max(box.maxX, x + 1);
				box.maxY = Math.max(box.maxY, y + 1);
			}
		}
	}
	return box;
};

const expectBox = (box: Box, expected: Box): void => {
	// within a pixel: the box is drawn from an 8x8 texture scaled up
	expect(Math.abs(box.minX - expected.minX)).toBeLessThanOrEqual(1);
	expect(Math.abs(box.minY - expected.minY)).toBeLessThanOrEqual(1);
	expect(Math.abs(box.maxX - expected.maxX)).toBeLessThanOrEqual(1);
	expect(Math.abs(box.maxY - expected.maxY)).toBeLessThanOrEqual(1);
};

const shift = (box: Box, dx: number, dy: number): Box => {
	return {
		minX: box.minX + dx,
		minY: box.minY + dy,
		maxX: box.maxX + dx,
		maxY: box.maxY + dy,
	};
};

describe("Spine on Canvas: camera and parent transforms", () => {
	let spine: Spine;
	let parent: Container | undefined;

	beforeAll(async () => {
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		app.world.backgroundColor.setColor(0, 0, 0);
		plugin.register(SpinePlugin, "SpinePlugin");
		const assets = (plugin.get(SpinePlugin) as SpinePlugin).assetManager;
		assets.setPrefix("/tests/fixtures/");
		assets.loadAsset("box.atlas", "box.json");
		await assets.loadAll();
		app.viewport.setBounds(0, 0, 2000, 2000);
	});

	beforeEach(() => {
		app.viewport.moveTo(0, 0);
		spine = new Spine(100, 120, {
			atlasFile: "box.atlas",
			jsonFile: "box.json",
		});
		parent = undefined;
	});

	afterEach(() => {
		if (parent) {
			app.world.removeChildNow(parent);
		} else {
			app.world.removeChildNow(spine);
		}
	});

	const atRest = (): Box => {
		return { minX: 100, minY: 80, maxX: 140, maxY: 120 };
	};

	it("draws where it is with the camera at the origin", () => {
		app.world.addChild(spine);
		expectBox(frame(), atRest());
	});

	it("scrolls with the camera", () => {
		app.world.addChild(spine);
		app.viewport.moveTo(30, 20);
		expectBox(frame(), shift(atRest(), -30, -20));
	});

	it("is offset by its parent container", () => {
		parent = new Container(50, 40, 400, 400);
		parent.addChild(spine);
		app.world.addChild(parent);
		expectBox(frame(), shift(atRest(), 50, 40));
	});

	it("scale() scales once, around its position", () => {
		app.world.addChild(spine);
		spine.scale(2);
		expectBox(frame(), { minX: 100, minY: 40, maxX: 180, maxY: 120 });
	});

	it("flipX() mirrors once, around its position", () => {
		app.world.addChild(spine);
		spine.flipX(true);
		expectBox(frame(), { minX: 60, minY: 80, maxX: 100, maxY: 120 });
	});

	it("rotate() turns once, around its position", () => {
		app.world.addChild(spine);
		spine.rotate(Math.PI / 2);
		expectBox(frame(), { minX: 100, minY: 120, maxX: 140, maxY: 160 });
	});

	it("rotate() with an axis turns once, through its transform", () => {
		app.world.addChild(spine);
		// \`v\` is handed to the renderable's own transform (an axis, for
		// its 3D matrix): the screen's z axis is the plain quarter turn
		spine.rotate(Math.PI / 2, new Vector3d(0, 0, 1));
		expectBox(frame(), { minX: 100, minY: 120, maxX: 140, maxY: 160 });
	});

	it("follows a scaled parent container", () => {
		parent = new Container(0, 0, 400, 400);
		parent.scale(2);
		parent.addChild(spine);
		app.world.addChild(parent);
		expectBox(frame(), { minX: 200, minY: 160, maxX: 280, maxY: 240 });
	});

	for (const [name, transform] of [
		["at rest", () => {}],
		["scaled", () => spine.scale(2)],
		["rotated", () => spine.rotate(Math.PI / 2)],
		["flipped", () => spine.flipX(true)],
	] as const) {
		it(`its bounds are where it is drawn (${name})`, () => {
			app.world.addChild(spine);
			transform();
			const drawn = frame();
			const bounds = spine.getBounds();
			expect(Math.abs(bounds.left - drawn.minX)).toBeLessThanOrEqual(1);
			expect(Math.abs(bounds.top - drawn.minY)).toBeLessThanOrEqual(1);
			expect(Math.abs(bounds.right - drawn.maxX)).toBeLessThanOrEqual(1);
			expect(Math.abs(bounds.bottom - drawn.maxY)).toBeLessThanOrEqual(1);
		});
	}
});
