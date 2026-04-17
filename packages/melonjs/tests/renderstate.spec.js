import { beforeEach, describe, expect, it } from "vitest";
import { RenderState } from "../src/index.js";

/**
 * Tests for the standalone RenderState class.
 * These run without any WebGL or Canvas context — pure JS state management.
 */
describe("RenderState", () => {
	let state;

	beforeEach(() => {
		state = new RenderState();
	});

	// ---- Color ----

	it("should preserve color across save/restore", () => {
		state.currentColor.parseCSS("red");
		const before = state.currentColor.toArray().slice();

		state.save();
		state.currentColor.parseCSS("green");
		const result = state.restore(800, 600);

		expect(result).not.toBeNull();
		const after = state.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(after[i]).toBeCloseTo(before[i], 5);
		}
	});

	it("should preserve color alpha across save/restore", () => {
		state.currentColor.parseCSS("rgba(100, 200, 50, 0.5)");
		const before = state.currentColor.toArray().slice();

		state.save();
		state.currentColor.parseCSS("rgba(0, 0, 0, 1.0)");
		state.restore(800, 600);

		const after = state.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(after[i]).toBeCloseTo(before[i], 5);
		}
	});

	// ---- Tint ----

	it("should preserve tint across save/restore", () => {
		state.currentTint.parseCSS("rgb(128, 64, 32)");
		const before = state.currentTint.toArray().slice();

		state.save();
		state.currentTint.parseCSS("white");
		state.restore(800, 600);

		const after = state.currentTint.toArray();
		for (let i = 0; i < 4; i++) {
			expect(after[i]).toBeCloseTo(before[i], 5);
		}
	});

	// ---- Transform ----

	it("should preserve transform across save/restore", () => {
		state.currentTransform.identity();
		state.save();
		state.currentTransform.translate(100, 200);
		state.currentTransform.rotate(Math.PI / 4);
		state.currentTransform.scale(2, 3);
		state.restore(800, 600);

		const val = state.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[1]).toBeCloseTo(0, 5);
		expect(val[4]).toBeCloseTo(0, 5);
		expect(val[5]).toBeCloseTo(1, 5);
		expect(val[12]).toBeCloseTo(0, 5);
		expect(val[13]).toBeCloseTo(0, 5);
	});

	it("should preserve translation across save/restore", () => {
		state.currentTransform.identity();
		state.currentTransform.translate(50, 75);
		const before = Float64Array.from(state.currentTransform.val);

		state.save();
		state.currentTransform.translate(200, 300);
		state.restore(800, 600);

		const after = state.currentTransform.val;
		for (let i = 0; i < before.length; i++) {
			expect(after[i]).toBeCloseTo(before[i], 5);
		}
	});

	// ---- Blend mode ----

	it("should return saved blend mode on restore", () => {
		state.currentBlendMode = "normal";
		state.save();
		state.currentBlendMode = "multiply";
		const result = state.restore(800, 600);

		expect(result).not.toBeNull();
		expect(result.blendMode).toBe("normal");
	});

	it("should preserve blend mode through multiple levels", () => {
		state.currentBlendMode = "additive";
		state.save();
		state.currentBlendMode = "screen";
		state.save();
		state.currentBlendMode = "multiply";

		let result = state.restore(800, 600);
		expect(result.blendMode).toBe("screen");

		result = state.restore(800, 600);
		expect(result.blendMode).toBe("additive");
	});

	// ---- Custom shader ----

	it("should preserve currentShader across save/restore", () => {
		const fakeShader = { name: "scanline" };
		state.currentShader = fakeShader;

		state.save();
		state.currentShader = { name: "desaturate" };
		state.restore(800, 600);

		expect(state.currentShader).toBe(fakeShader);
	});

	it("should restore currentShader to undefined when it was unset", () => {
		expect(state.currentShader).toBeUndefined();

		state.save();
		state.currentShader = { name: "scanline" };
		state.restore(800, 600);

		expect(state.currentShader).toBeUndefined();
	});

	it("should scope currentShader through nested save/restore", () => {
		const shaderA = { name: "A" };
		const shaderB = { name: "B" };

		state.currentShader = shaderA;
		state.save();

		state.currentShader = shaderB;
		state.save();

		state.currentShader = undefined;

		// restore depth 2 — should get shaderB back
		state.restore(800, 600);
		expect(state.currentShader).toBe(shaderB);

		// restore depth 1 — should get shaderA back
		state.restore(800, 600);
		expect(state.currentShader).toBe(shaderA);
	});

	it("should not leak currentShader when child has no shader", () => {
		const cameraShader = { name: "camera-effect" };

		// simulate camera preDraw: save + set shader
		state.save();
		state.currentShader = cameraShader;

		// simulate child preDraw: save + set undefined (no shader)
		state.save();
		state.currentShader = undefined;

		// child rendering should see no custom shader
		expect(state.currentShader).toBeUndefined();

		// simulate child postDraw: restore
		state.restore(800, 600);
		expect(state.currentShader).toBe(cameraShader);

		// simulate camera postDraw: restore
		state.restore(800, 600);
		expect(state.currentShader).toBeUndefined();
	});

	// ---- Scissor ----

	it("should preserve scissor when active", () => {
		state.currentScissor.set([10, 20, 100, 200]);
		state.save(true); // scissor active

		state.currentScissor.set([50, 60, 300, 400]);
		const result = state.restore(800, 600);

		expect(result.scissorActive).toBe(true);
		expect(state.currentScissor[0]).toBe(10);
		expect(state.currentScissor[1]).toBe(20);
		expect(state.currentScissor[2]).toBe(100);
		expect(state.currentScissor[3]).toBe(200);
	});

	it("should reset scissor to canvas size when not active", () => {
		state.currentScissor.set([10, 20, 100, 200]);
		state.save(false); // scissor not active

		state.currentScissor.set([50, 60, 300, 400]);
		const result = state.restore(800, 600);

		expect(result.scissorActive).toBe(false);
		expect(state.currentScissor[0]).toBe(0);
		expect(state.currentScissor[1]).toBe(0);
		expect(state.currentScissor[2]).toBe(800);
		expect(state.currentScissor[3]).toBe(600);
	});

	// ---- Nested save/restore ----

	it("should handle nested save/restore correctly", () => {
		state.currentTransform.identity();
		state.currentColor.parseCSS("red");
		state.currentBlendMode = "normal";

		// depth 1
		state.save();
		state.currentTransform.translate(10, 20);
		state.currentColor.parseCSS("#00ff00");
		state.currentBlendMode = "additive";

		// depth 2
		state.save();
		state.currentTransform.translate(30, 40);
		state.currentColor.parseCSS("#0000ff");
		state.currentBlendMode = "multiply";

		// depth 3
		state.save();
		state.currentTransform.scale(2, 2);
		state.currentColor.parseCSS("#ffffff");

		// restore depth 3
		let result = state.restore(800, 600);
		expect(state.currentColor.b).toBe(255);
		expect(state.currentColor.r).toBe(0);
		expect(result.blendMode).toBe("multiply");

		// restore depth 2
		result = state.restore(800, 600);
		expect(state.currentColor.g).toBe(255);
		expect(state.currentColor.r).toBe(0);
		expect(result.blendMode).toBe("additive");

		// restore depth 1
		result = state.restore(800, 600);
		expect(state.currentColor.r).toBe(255);
		expect(state.currentColor.g).toBe(0);
		expect(result.blendMode).toBe("normal");

		// transform should be identity again
		const val = state.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[5]).toBeCloseTo(1, 5);
		expect(val[12]).toBeCloseTo(0, 5);
		expect(val[13]).toBeCloseTo(0, 5);
	});

	// ---- Deep nesting ----

	it("should handle deep nesting (20 levels)", () => {
		const depth = 20;
		state.currentTransform.identity();
		state.currentColor.parseCSS("red");

		for (let i = 0; i < depth; i++) {
			state.save();
			state.currentTransform.translate(i, i);
			state.currentColor.parseCSS(`rgb(${i * 10}, ${i * 10}, ${i * 10})`);
		}

		for (let i = 0; i < depth; i++) {
			state.restore(800, 600);
		}

		expect(state.currentColor.r).toBe(255);
		expect(state.currentColor.g).toBe(0);
		expect(state.currentColor.b).toBe(0);

		const val = state.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[5]).toBeCloseTo(1, 5);
		expect(val[12]).toBeCloseTo(0, 5);
		expect(val[13]).toBeCloseTo(0, 5);
	});

	// ---- Stack growth ----

	it("should handle stack growth beyond initial capacity (32+)", () => {
		const depth = 40; // exceeds initial capacity of 32
		state.currentTransform.identity();
		state.currentColor.parseCSS("red");

		for (let i = 0; i < depth; i++) {
			state.save();
			state.currentTransform.translate(i, i);
		}

		for (let i = 0; i < depth; i++) {
			state.restore(800, 600);
		}

		// should be back to identity
		const val = state.currentTransform.val;
		expect(val[0]).toBeCloseTo(1, 5);
		expect(val[5]).toBeCloseTo(1, 5);
		expect(val[12]).toBeCloseTo(0, 5);
		expect(val[13]).toBeCloseTo(0, 5);
		expect(state.currentColor.r).toBe(255);
	});

	// ---- Edge cases ----

	it("should return null on restore with no save", () => {
		const result = state.restore(800, 600);
		expect(result).toBeNull();
	});

	it("should handle save/restore with no state changes", () => {
		state.currentTransform.identity();
		state.currentColor.parseCSS("#abcdef");
		state.currentBlendMode = "normal";
		const colorBefore = state.currentColor.toArray().slice();
		const transformBefore = Float64Array.from(state.currentTransform.val);

		state.save();
		// no changes
		const result = state.restore(800, 600);

		expect(result.blendMode).toBe("normal");
		const colorAfter = state.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(colorAfter[i]).toBeCloseTo(colorBefore[i], 5);
		}
		const transformAfter = state.currentTransform.val;
		for (let i = 0; i < transformBefore.length; i++) {
			expect(transformAfter[i]).toBeCloseTo(transformBefore[i], 5);
		}
	});

	it("should isolate state between sequential save/restore pairs", () => {
		state.currentColor.parseCSS("red");
		state.currentTransform.identity();

		// first pair
		state.save();
		state.currentColor.parseCSS("green");
		state.currentTransform.translate(100, 100);
		state.restore(800, 600);

		expect(state.currentColor.r).toBe(255);
		expect(state.currentColor.g).toBe(0);

		// second pair
		state.save();
		state.currentColor.parseCSS("blue");
		state.currentTransform.translate(200, 200);
		state.restore(800, 600);

		expect(state.currentColor.r).toBe(255);
		expect(state.currentColor.g).toBe(0);
		expect(state.currentColor.b).toBe(0);
		expect(state.currentTransform.val[12]).toBeCloseTo(0, 5);
	});

	// ---- Reset ----

	it("should reset stack depth and state", () => {
		state.save();
		state.save();
		state.save();

		state.reset(1024, 768);

		expect(state._stackDepth).toBe(0);
		expect(state.currentScissor[2]).toBe(1024);
		expect(state.currentScissor[3]).toBe(768);

		// restore should return null (stack empty)
		expect(state.restore(1024, 768)).toBeNull();
	});

	// ---- Combined state integrity ----

	it("should restore ALL state properties simultaneously", () => {
		state.currentTransform.identity();
		state.currentTransform.translate(42, 84);
		state.currentColor.parseCSS("rgba(10, 20, 30, 0.5)");
		state.currentTint.parseCSS("rgb(128, 64, 32)");
		state.currentBlendMode = "additive";
		const shaderBefore = { name: "test-shader" };
		state.currentShader = shaderBefore;

		const colorBefore = state.currentColor.toArray().slice();
		const tintBefore = state.currentTint.toArray().slice();
		const transformBefore = Float64Array.from(state.currentTransform.val);

		state.save();

		// change everything
		state.currentTransform.translate(500, 500);
		state.currentTransform.rotate(Math.PI);
		state.currentTransform.scale(5, 5);
		state.currentColor.parseCSS("rgba(200, 100, 50, 1.0)");
		state.currentTint.parseCSS("white");
		state.currentBlendMode = "multiply";
		state.currentShader = { name: "different-shader" };

		const result = state.restore(800, 600);

		// verify ALL properties restored
		expect(result.blendMode).toBe("additive");
		expect(state.currentShader).toBe(shaderBefore);

		const colorAfter = state.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(colorAfter[i]).toBeCloseTo(colorBefore[i], 4);
		}

		const tintAfter = state.currentTint.toArray();
		for (let i = 0; i < 4; i++) {
			expect(tintAfter[i]).toBeCloseTo(tintBefore[i], 4);
		}

		const transformAfter = state.currentTransform.val;
		for (let i = 0; i < transformBefore.length; i++) {
			expect(transformAfter[i]).toBeCloseTo(transformBefore[i], 4);
		}
	});
});
