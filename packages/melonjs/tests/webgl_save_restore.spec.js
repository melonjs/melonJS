import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";

/**
 * Test suite for the WebGL renderer save()/restore() state stack.
 *
 * Validates that renderer state (color, transform, blend mode, scissor)
 * is correctly preserved across save/restore pairs, including nested calls
 * and edge cases. These tests should catch regressions if the internal
 * stack implementation is changed (e.g. from pool-based cloning to
 * pre-allocated index-based stacks).
 */
describe("WebGL Renderer save/restore", () => {
	let renderer;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	// ---- Color state (available on all renderers) ----

	it("should preserve color across save/restore", () => {
		if (!isWebGL) {
			return;
		}
		renderer.setColor("#ff0000");
		const before = renderer.currentColor.toArray().slice();

		renderer.save();
		renderer.setColor("#00ff00");
		expect(renderer.currentColor.g).toBe(255);
		renderer.restore();

		const after = renderer.currentColor.toArray();
		expect(after[0]).toBeCloseTo(before[0], 5);
		expect(after[1]).toBeCloseTo(before[1], 5);
		expect(after[2]).toBeCloseTo(before[2], 5);
		expect(after[3]).toBeCloseTo(before[3], 5);
	});

	it("should preserve color alpha across save/restore", () => {
		if (!isWebGL) {
			return;
		}
		renderer.setColor("rgba(100, 200, 50, 0.5)");
		const before = renderer.currentColor.toArray().slice();

		renderer.save();
		renderer.setColor("rgba(0, 0, 0, 1.0)");
		renderer.restore();

		const after = renderer.currentColor.toArray();
		expect(after[0]).toBeCloseTo(before[0], 5);
		expect(after[1]).toBeCloseTo(before[1], 5);
		expect(after[2]).toBeCloseTo(before[2], 5);
		expect(after[3]).toBeCloseTo(before[3], 5);
	});

	// ---- Transform state (WebGL only — Canvas delegates to native context) ----

	it("should preserve transform across save/restore", () => {
		if (!isWebGL) {
			return;
		}
		renderer.currentTransform.identity();
		renderer.save();
		renderer.translate(100, 200);
		renderer.rotate(Math.PI / 4);
		renderer.scale(2, 3);
		renderer.restore();

		const val = renderer.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[1]).toBeCloseTo(0, 5);
		expect(val[3]).toBeCloseTo(0, 5);
		expect(val[4]).toBeCloseTo(1, 5);
		expect(val[6]).toBeCloseTo(0, 5);
		expect(val[7]).toBeCloseTo(0, 5);
	});

	it("should preserve translate across save/restore", () => {
		if (!isWebGL) {
			return;
		}
		renderer.currentTransform.identity();
		renderer.translate(50, 75);
		const before = Float64Array.from(renderer.currentTransform.val);

		renderer.save();
		renderer.translate(200, 300);
		renderer.restore();

		const after = renderer.currentTransform.val;
		for (let i = 0; i < before.length; i++) {
			expect(after[i]).toBeCloseTo(before[i], 5);
		}
	});

	// ---- Blend mode state ----

	it("should preserve blend mode across save/restore", () => {
		if (!isWebGL) {
			return;
		}
		renderer.setBlendMode("normal");
		expect(renderer.getBlendMode()).toBe("normal");

		renderer.save();
		renderer.setBlendMode("multiply");
		expect(renderer.getBlendMode()).toBe("multiply");
		renderer.restore();

		expect(renderer.getBlendMode()).toBe("normal");
	});

	it("should preserve blend mode through multiple modes", () => {
		if (!isWebGL) {
			return;
		}
		renderer.setBlendMode("additive");

		renderer.save();
		renderer.setBlendMode("screen");
		renderer.save();
		renderer.setBlendMode("multiply");
		expect(renderer.getBlendMode()).toBe("multiply");
		renderer.restore();
		expect(renderer.getBlendMode()).toBe("screen");
		renderer.restore();

		expect(renderer.getBlendMode()).toBe("additive");
	});

	// ---- Scissor state (WebGL only) ----

	it("should preserve scissor across save/restore", () => {
		if (!isWebGL) {
			return;
		}
		renderer.clipRect(10, 20, 100, 200);
		const before = Int32Array.from(renderer.currentScissor);

		renderer.save();
		renderer.clipRect(50, 60, 300, 400);
		// scissor should have changed
		expect(renderer.currentScissor[0]).not.toBe(before[0]);
		renderer.restore();

		const after = renderer.currentScissor;
		expect(after[0]).toBe(before[0]);
		expect(after[1]).toBe(before[1]);
		expect(after[2]).toBe(before[2]);
		expect(after[3]).toBe(before[3]);
	});

	// ---- Nested save/restore ----

	it("should handle nested save/restore correctly", () => {
		if (!isWebGL) {
			return;
		}
		// set initial state
		renderer.currentTransform.identity();
		renderer.setColor("#ff0000");
		renderer.setBlendMode("normal");

		// depth 1
		renderer.save();
		renderer.translate(10, 20);
		renderer.setColor("#00ff00");
		renderer.setBlendMode("additive");

		// depth 2
		renderer.save();
		renderer.translate(30, 40);
		renderer.setColor("#0000ff");
		renderer.setBlendMode("multiply");

		// depth 3
		renderer.save();
		renderer.scale(2, 2);
		renderer.setColor("#ffffff");

		// verify innermost state
		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(255);
		expect(renderer.currentColor.b).toBe(255);
		expect(renderer.getBlendMode()).toBe("multiply");

		// restore depth 3 → depth 2 state
		renderer.restore();
		expect(renderer.currentColor.b).toBe(255);
		expect(renderer.currentColor.r).toBe(0);
		expect(renderer.getBlendMode()).toBe("multiply");

		// restore depth 2 → depth 1 state
		renderer.restore();
		expect(renderer.currentColor.g).toBe(255);
		expect(renderer.currentColor.r).toBe(0);
		expect(renderer.getBlendMode()).toBe("additive");

		// restore depth 1 → original state
		renderer.restore();
		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);
		expect(renderer.getBlendMode()).toBe("normal");

		// transform should be identity again
		const val = renderer.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[4]).toBeCloseTo(1, 5);
		expect(val[6]).toBeCloseTo(0, 5);
		expect(val[7]).toBeCloseTo(0, 5);
	});

	// ---- Deep nesting (stress test) ----

	it("should handle deep nesting (20 levels)", () => {
		if (!isWebGL) {
			return;
		}
		const depth = 20;
		renderer.currentTransform.identity();
		renderer.setColor("#ff0000");

		for (let i = 0; i < depth; i++) {
			renderer.save();
			renderer.translate(i, i);
			renderer.setColor(`rgb(${i * 10}, ${i * 10}, ${i * 10})`);
		}

		for (let i = 0; i < depth; i++) {
			renderer.restore();
		}

		// should be back to the original state
		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);
		expect(renderer.currentColor.b).toBe(0);

		const val = renderer.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[4]).toBeCloseTo(1, 5);
		expect(val[6]).toBeCloseTo(0, 5);
		expect(val[7]).toBeCloseTo(0, 5);
	});

	// ---- Edge cases ----

	it("should handle restore with no matching save (no-op)", () => {
		if (!isWebGL) {
			return;
		}
		renderer.setColor("#ff0000");
		const colorBefore = renderer.currentColor.toArray().slice();
		const transformBefore = Float64Array.from(renderer.currentTransform.val);

		// restore without save should be a no-op for color/transform
		renderer.restore();

		const colorAfter = renderer.currentColor.toArray();
		expect(colorAfter[0]).toBeCloseTo(colorBefore[0], 5);
		expect(colorAfter[1]).toBeCloseTo(colorBefore[1], 5);

		const transformAfter = renderer.currentTransform.val;
		for (let i = 0; i < transformBefore.length; i++) {
			expect(transformAfter[i]).toBeCloseTo(transformBefore[i], 5);
		}
	});

	it("should handle save/restore with no state changes in between", () => {
		if (!isWebGL) {
			return;
		}
		renderer.currentTransform.identity();
		renderer.setColor("#abcdef");
		renderer.setBlendMode("normal");
		const colorBefore = renderer.currentColor.toArray().slice();
		const transformBefore = Float64Array.from(renderer.currentTransform.val);

		renderer.save();
		// no changes
		renderer.restore();

		const colorAfter = renderer.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(colorAfter[i]).toBeCloseTo(colorBefore[i], 5);
		}
		const transformAfter = renderer.currentTransform.val;
		for (let i = 0; i < transformBefore.length; i++) {
			expect(transformAfter[i]).toBeCloseTo(transformBefore[i], 5);
		}
		expect(renderer.getBlendMode()).toBe("normal");
	});

	it("should isolate state between sequential save/restore pairs", () => {
		if (!isWebGL) {
			return;
		}
		// first pair: red + translated
		renderer.setColor("#ff0000");
		renderer.currentTransform.identity();
		renderer.save();
		renderer.setColor("#00ff00");
		renderer.translate(100, 100);
		renderer.restore();

		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);

		// second pair: should start from the restored state
		renderer.save();
		renderer.setColor("#0000ff");
		renderer.translate(200, 200);
		renderer.restore();

		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);
		expect(renderer.currentColor.b).toBe(0);
		expect(renderer.currentTransform.val[6]).toBeCloseTo(0, 5);
	});

	// ---- Combined state integrity ----

	it("should restore ALL state properties simultaneously", () => {
		if (!isWebGL) {
			return;
		}
		// set a known initial state
		renderer.currentTransform.identity();
		renderer.translate(42, 84);
		renderer.setColor("rgba(10, 20, 30, 0.5)");
		renderer.setBlendMode("additive");

		const colorBefore = renderer.currentColor.toArray().slice();
		const transformBefore = Float64Array.from(renderer.currentTransform.val);
		const blendBefore = renderer.getBlendMode();

		renderer.save();

		// change everything
		renderer.translate(500, 500);
		renderer.rotate(Math.PI);
		renderer.scale(5, 5);
		renderer.setColor("rgba(200, 100, 50, 1.0)");
		renderer.setBlendMode("multiply");

		renderer.restore();

		// verify ALL properties restored
		const colorAfter = renderer.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(colorAfter[i]).toBeCloseTo(colorBefore[i], 4);
		}

		const transformAfter = renderer.currentTransform.val;
		for (let i = 0; i < transformBefore.length; i++) {
			expect(transformAfter[i]).toBeCloseTo(transformBefore[i], 4);
		}

		expect(renderer.getBlendMode()).toBe(blendBefore);
	});
});
