import { beforeAll, describe, expect, it } from "vitest";
import { boot, Matrix3d, video } from "../src/index.js";

/**
 * Regression guard: under a 2D ortho camera a sprite's `depth` / `pos.z` is a
 * painter's sort key only (the world is CPU-sorted on it). Since 19.7 the quad
 * batcher writes `renderer.currentDepth` into the vertex `z`, which participates
 * in clip-space — so a large sort value (e.g. a `baseZ + pos.y` Y-sort, or
 * `Container.autoDepth` on a big world) would clip the sprite against the
 * camera near/far and it would silently vanish.
 *
 * The fix: `Renderer.setDepth()` only feeds depth into the vertex stream under a
 * perspective projection (Camera3d, which genuinely uses z for parallax/depth);
 * under an orthographic projection (Camera2d) it keeps `currentDepth` at 0 so a
 * sort key can never clip. Perspective ⇔ `projectionMatrix.val[11] !== 0`.
 */
describe("2D sprite depth is sort-only under an ortho projection", () => {
	let renderer;
	const ortho = new Matrix3d().ortho(0, 320, 240, 0, -1e6, 1e6);
	const perspective = new Matrix3d().perspective(Math.PI / 4, 1.333, 0.1, 2000);

	beforeAll(() => {
		boot();
		video.init(320, 240, { parent: "screen", renderer: video.CANVAS });
		renderer = video.renderer;
	});

	it("ortho projection: a large sort key is kept out of clip-space (depth → 0)", () => {
		renderer.setProjection(ortho);
		renderer.setDepth(1_000_500); // past the default Camera2d far plane (1e6)
		expect(renderer.currentDepth).toBe(0);
	});

	it("ortho projection: even a tiny depth is zeroed (sort happens on CPU, not z)", () => {
		renderer.setProjection(ortho);
		renderer.setDepth(5);
		expect(renderer.currentDepth).toBe(0);
	});

	it("perspective projection (Camera3d): real depth passes through unchanged", () => {
		renderer.setProjection(perspective);
		renderer.setDepth(123.5);
		expect(renderer.currentDepth).toBe(123.5);
	});

	it("switching back to ortho re-gates the depth to 0", () => {
		renderer.setProjection(perspective);
		renderer.setDepth(900);
		expect(renderer.currentDepth).toBe(900);
		renderer.setProjection(ortho);
		renderer.setDepth(900);
		expect(renderer.currentDepth).toBe(0);
	});
});
