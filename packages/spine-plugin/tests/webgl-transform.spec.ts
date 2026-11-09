/**
 * On WebGL a Spine object follows the camera and its parent container.
 *
 * Bug pinned here: the WebGL batcher pushed spine's world vertices with only
 * the renderer's projection, never `renderer.currentTransform`, which is
 * where the camera scroll and every ancestor's translate live (the engine's
 * own batchers apply it to each vertex). So a Spine object ignored the
 * camera: a Spine hero the camera follows slid off screen, and one inside an
 * offset container drew at the container's origin. `scale()` worked around
 * it through the root bone; with the transform applied that must not now
 * scale twice, and neither may `rotate()` or the root-bone flips.
 *
 * Checked on the vertices that reach the GPU: what the batcher hands to its
 * draw call, which the shader multiplies by the projection alone.
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

// spine's two-color vertex: x, y, light rgba, u, v, dark rgba
const STRIDE = 12;

let app: Application;
let isWebGL = false;
// the vertices of every flush in the last frame
let flushed: number[][] = [];

/** the bounding box of the vertices flushed in the last frame */
const flushedBox = (): Box => {
	const box = {
		minX: Number.POSITIVE_INFINITY,
		minY: Number.POSITIVE_INFINITY,
		maxX: Number.NEGATIVE_INFINITY,
		maxY: Number.NEGATIVE_INFINITY,
	};
	for (const v of flushed) {
		for (let i = 0; i < v.length; i += STRIDE) {
			box.minX = Math.min(box.minX, v[i]);
			box.minY = Math.min(box.minY, v[i + 1]);
			box.maxX = Math.max(box.maxX, v[i]);
			box.maxY = Math.max(box.maxY, v[i + 1]);
		}
	}
	return box;
};

/** draw one frame */
const frame = (): void => {
	flushed = [];
	app.world.update(16);
	app.isDirty = true;
	app.draw();
};

const expectBox = (box: Box, expected: Box): void => {
	expect(box.minX).toBeCloseTo(expected.minX, 3);
	expect(box.minY).toBeCloseTo(expected.minY, 3);
	expect(box.maxX).toBeCloseTo(expected.maxX, 3);
	expect(box.maxY).toBeCloseTo(expected.maxY, 3);
};

const shift = (box: Box, dx: number, dy: number): Box => {
	return {
		minX: box.minX + dx,
		minY: box.minY + dy,
		maxX: box.maxX + dx,
		maxY: box.maxY + dy,
	};
};

describe("Spine on WebGL: camera and parent transforms", () => {
	let spine: Spine;
	let parent: Container | undefined;

	beforeAll(async () => {
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
		isWebGL = app.renderer.type === "WebGL2";
		if (!isWebGL) {
			return;
		}
		plugin.register(SpinePlugin, "SpinePlugin");
		const assets = (plugin.get(SpinePlugin) as SpinePlugin).assetManager;
		assets.setPrefix("/tests/fixtures/");
		assets.loadAsset("box.atlas", "box.json");
		await assets.loadAll();
		// room for the camera to scroll
		app.viewport.setBounds(0, 0, 2000, 2000);
	});

	beforeEach((ctx) => {
		if (!isWebGL) {
			ctx.skip();
		}
		app.viewport.moveTo(0, 0);
		spine = new Spine(100, 120, {
			atlasFile: "box.atlas",
			jsonFile: "box.json",
		});
		parent = undefined;
		const batcher = spine.spineBatcher;
		const flush = batcher.flush;
		batcher.flush = function (mode?: number) {
			const n = this.vertexData.vertexCount * STRIDE;
			if (n > 0) {
				flushed.push(Array.from(this.vertexData.bufferF32.subarray(0, n)));
			}
			return flush.call(this, mode);
		};
	});

	afterEach(() => {
		if (!isWebGL) {
			return;
		}
		// restore the shared batcher's own flush
		delete (spine.spineBatcher as { flush?: unknown }).flush;
		if (parent) {
			app.world.removeChildNow(parent);
		} else {
			app.world.removeChildNow(spine);
		}
	});

	// the 40x40 box the fixture skeleton draws, with the camera at the
	// origin and the object in the world container: its root bone is on
	// `pos`, the box spans 40 px right of it and 40 px up from it
	const atRest = (): Box => {
		return { minX: 100, minY: 80, maxX: 140, maxY: 120 };
	};

	it("draws where it is with the camera at the origin", () => {
		app.world.addChild(spine);
		frame();
		expectBox(flushedBox(), atRest());
	});

	it("scrolls with the camera", () => {
		app.world.addChild(spine);
		app.viewport.moveTo(30, 20);
		frame();
		expectBox(flushedBox(), shift(atRest(), -30, -20));
	});

	it("is offset by its parent container", () => {
		parent = new Container(50, 40, 400, 400);
		parent.addChild(spine);
		app.world.addChild(parent);
		frame();
		expectBox(flushedBox(), shift(atRest(), 50, 40));
	});

	it("scale() scales once, around its position", () => {
		app.world.addChild(spine);
		spine.scale(2);
		frame();
		expectBox(flushedBox(), { minX: 100, minY: 40, maxX: 180, maxY: 120 });
	});

	it("scale() with the camera scrolled scales once and scrolls", () => {
		app.world.addChild(spine);
		spine.scale(0.5);
		app.viewport.moveTo(30, 20);
		frame();
		expectBox(
			flushedBox(),
			shift({ minX: 100, minY: 100, maxX: 120, maxY: 120 }, -30, -20),
		);
	});

	it("rotate() turns once, around its position", () => {
		app.world.addChild(spine);
		// a quarter turn clockwise: the box, up and right of `pos`, ends up
		// right of and below it
		spine.rotate(Math.PI / 2);
		frame();
		expectBox(flushedBox(), { minX: 100, minY: 120, maxX: 140, maxY: 160 });
	});

	it("flipX() mirrors once, around its position", () => {
		app.world.addChild(spine);
		spine.flipX(true);
		frame();
		expectBox(flushedBox(), { minX: 60, minY: 80, maxX: 100, maxY: 120 });
	});

	it("flipX() inside a scrolled view mirrors once and scrolls", () => {
		app.world.addChild(spine);
		spine.flipX(true);
		app.viewport.moveTo(30, 20);
		frame();
		expectBox(
			flushedBox(),
			shift({ minX: 60, minY: 80, maxX: 100, maxY: 120 }, -30, -20),
		);
	});

	it("rotate() with an axis turns once, through its transform", () => {
		app.world.addChild(spine);
		// \`v\` is handed to the renderable's own transform (an axis, for
		// its 3D matrix): the screen's z axis is the plain quarter turn
		spine.rotate(Math.PI / 2, new Vector3d(0, 0, 1));
		frame();
		expectBox(flushedBox(), { minX: 100, minY: 120, maxX: 140, maxY: 160 });
	});

	it("follows a scaled parent container", () => {
		parent = new Container(0, 0, 400, 400);
		parent.scale(2);
		parent.addChild(spine);
		app.world.addChild(parent);
		frame();
		expectBox(flushedBox(), { minX: 200, minY: 160, maxX: 280, maxY: 240 });
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
			frame();
			const drawn = flushedBox();
			const bounds = spine.getBounds();
			expect(Math.abs(bounds.left - drawn.minX)).toBeLessThanOrEqual(1);
			expect(Math.abs(bounds.top - drawn.minY)).toBeLessThanOrEqual(1);
			expect(Math.abs(bounds.right - drawn.maxX)).toBeLessThanOrEqual(1);
			expect(Math.abs(bounds.bottom - drawn.maxY)).toBeLessThanOrEqual(1);
		});
	}

	it("the debug overlay follows the camera too", () => {
		app.world.addChild(spine);
		spine.debugRendering = true;
		let mvp: number[] = [];
		const shader = spine.shapesShader as NonNullable<Spine["shapesShader"]>;
		const set = shader.setUniform4x4f;
		shader.setUniform4x4f = function (name: string, value: ArrayLike<number>) {
			mvp = Array.from(value);
			set.call(this, name, value);
		};
		try {
			app.viewport.moveTo(30, 20);
			frame();
		} finally {
			delete (shader as { setUniform4x4f?: unknown }).setUniform4x4f;
			spine.debugRendering = false;
		}
		expect(mvp.length).toEqual(16);
		// the world point (100, 120) lands where the projection puts the
		// view point (70, 100)
		const p = app.renderer.projectionMatrix.val;
		const m = mvp;
		expect(m[0] * 100 + m[4] * 120 + m[12]).toBeCloseTo(
			p[0] * 70 + p[4] * 100 + p[12],
			5,
		);
		expect(m[1] * 100 + m[5] * 120 + m[13]).toBeCloseTo(
			p[1] * 70 + p[5] * 100 + p[13],
			5,
		);
	});
});
