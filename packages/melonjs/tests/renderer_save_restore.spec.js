import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";

/**
 * Tests for renderer save/restore through the public API.
 * These run on whatever renderer is available (Canvas or WebGL)
 * and verify that JS-side state is correctly preserved.
 */
describe("Renderer save/restore", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
		renderer = video.renderer;
	});

	beforeEach(() => {
		renderer.setColor("#000000");
		renderer.setGlobalAlpha(1.0);
		renderer.setBlendMode("normal");
		renderer.clearTint();
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	// ---- Color ----

	it("should preserve color across save/restore", () => {
		renderer.setColor("#ff0000");
		const before = renderer.currentColor.toArray().slice();

		renderer.save();
		renderer.setColor("#00ff00");
		renderer.restore();

		const after = renderer.currentColor.toArray();
		expect(after[0]).toBeCloseTo(before[0], 5);
		expect(after[1]).toBeCloseTo(before[1], 5);
		expect(after[2]).toBeCloseTo(before[2], 5);
	});

	// ---- Global alpha / setGlobalAlpha ----

	it("should preserve globalAlpha set via setGlobalAlpha across save/restore", () => {
		renderer.setGlobalAlpha(0.5);
		const alphaBefore = renderer.getGlobalAlpha();

		renderer.save();
		renderer.setGlobalAlpha(1.0);
		expect(renderer.getGlobalAlpha()).toBeCloseTo(1.0, 5);
		renderer.restore();

		expect(renderer.getGlobalAlpha()).toBeCloseTo(alphaBefore, 5);
	});

	it("should not desync globalAlpha when mixing setColor and setGlobalAlpha", () => {
		renderer.setColor("rgba(255, 0, 0, 1.0)");
		renderer.setGlobalAlpha(0.3);
		const alphaBefore = renderer.getGlobalAlpha();

		renderer.save();
		renderer.setColor("rgba(0, 255, 0, 1.0)");
		renderer.setGlobalAlpha(0.9);
		renderer.restore();

		expect(renderer.getGlobalAlpha()).toBeCloseTo(alphaBefore, 5);
	});

	// ---- Blend mode ----

	it("should preserve blend mode across save/restore", () => {
		renderer.setBlendMode("normal");
		renderer.save();
		renderer.setBlendMode("multiply");
		expect(renderer.getBlendMode()).toBe("multiply");
		renderer.restore();

		expect(renderer.getBlendMode()).toBe("normal");
	});

	it("should preserve blend mode through nested save/restore", () => {
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

	// ---- Tint ----

	it("should preserve tint across save/restore", () => {
		renderer.setTint(renderer.currentTint.copy("rgb(128, 64, 32)"));
		const before = renderer.currentTint.toArray().slice();

		renderer.save();
		renderer.clearTint();
		renderer.restore();

		const after = renderer.currentTint.toArray();
		for (let i = 0; i < 3; i++) {
			expect(after[i]).toBeCloseTo(before[i], 4);
		}
	});

	// ---- Nested ----

	it("should handle nested save/restore correctly", () => {
		renderer.setColor("#ff0000");
		renderer.setBlendMode("normal");

		renderer.save();
		renderer.setColor("#00ff00");
		renderer.setBlendMode("additive");

		renderer.save();
		renderer.setColor("#0000ff");
		renderer.setBlendMode("multiply");

		// restore depth 2
		renderer.restore();
		expect(renderer.getBlendMode()).toBe("additive");

		// restore depth 1
		renderer.restore();
		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);
		expect(renderer.getBlendMode()).toBe("normal");
	});

	// ---- Edge cases ----

	it("should handle restore with no matching save", () => {
		renderer.setColor("#ff0000");
		const colorBefore = renderer.currentColor.toArray().slice();

		renderer.restore();

		const colorAfter = renderer.currentColor.toArray();
		expect(colorAfter[0]).toBeCloseTo(colorBefore[0], 5);
	});

	it("should handle save/restore with no state changes", () => {
		renderer.setColor("#abcdef");
		renderer.setBlendMode("normal");
		const colorBefore = renderer.currentColor.toArray().slice();

		renderer.save();
		renderer.restore();

		const colorAfter = renderer.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(colorAfter[i]).toBeCloseTo(colorBefore[i], 5);
		}
		expect(renderer.getBlendMode()).toBe("normal");
	});

	it("should isolate state between sequential save/restore pairs", () => {
		renderer.setColor("#ff0000");
		renderer.setBlendMode("normal");

		// first pair
		renderer.save();
		renderer.setColor("#00ff00");
		renderer.setBlendMode("multiply");
		renderer.restore();

		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);
		expect(renderer.getBlendMode()).toBe("normal");

		// second pair — should start from same restored state
		renderer.save();
		renderer.setColor("#0000ff");
		renderer.setBlendMode("additive");
		renderer.restore();

		expect(renderer.currentColor.r).toBe(255);
		expect(renderer.currentColor.g).toBe(0);
		expect(renderer.currentColor.b).toBe(0);
		expect(renderer.getBlendMode()).toBe("normal");
	});

	// ---- Scissor / clipRect ----
	// Canvas delegates clipping to the native context which handles
	// save/restore natively; currentScissor is just a dedup cache there.
	// These tests only apply to WebGL where we manage scissor state ourselves.

	it("should preserve scissor state across save/restore (WebGL only)", () => {
		if (renderer.type !== "WebGL") {
			return;
		}

		renderer.clipRect(50, 60, 200, 150);
		const scissorBefore = Array.from(renderer.currentScissor);

		renderer.save();
		renderer.clipRect(10, 20, 100, 80);
		expect(renderer.currentScissor[0]).toBe(10);
		expect(renderer.currentScissor[1]).toBe(20);
		renderer.restore();

		expect(renderer.currentScissor[0]).toBe(scissorBefore[0]);
		expect(renderer.currentScissor[1]).toBe(scissorBefore[1]);
		expect(renderer.currentScissor[2]).toBe(scissorBefore[2]);
		expect(renderer.currentScissor[3]).toBe(scissorBefore[3]);
	});

	it("should preserve scissor through nested save/restore (WebGL only)", () => {
		if (renderer.type !== "WebGL") {
			return;
		}

		renderer.clipRect(10, 20, 300, 250);
		const scissor0 = Array.from(renderer.currentScissor);

		renderer.save();
		renderer.clipRect(50, 60, 100, 80);
		const scissor1 = Array.from(renderer.currentScissor);

		renderer.save();
		renderer.clipRect(70, 80, 50, 40);

		renderer.restore();
		expect(renderer.currentScissor[0]).toBe(scissor1[0]);
		expect(renderer.currentScissor[1]).toBe(scissor1[1]);
		expect(renderer.currentScissor[2]).toBe(scissor1[2]);
		expect(renderer.currentScissor[3]).toBe(scissor1[3]);

		renderer.restore();
		expect(renderer.currentScissor[0]).toBe(scissor0[0]);
		expect(renderer.currentScissor[1]).toBe(scissor0[1]);
		expect(renderer.currentScissor[2]).toBe(scissor0[2]);
		expect(renderer.currentScissor[3]).toBe(scissor0[3]);
	});

	// ---- Color alpha channel ----

	it("should preserve full RGBA color (including alpha) across save/restore", () => {
		renderer.setColor("rgba(128, 64, 32, 1.0)");
		renderer.setGlobalAlpha(0.5);
		const rBefore = renderer.currentColor.r;
		const gBefore = renderer.currentColor.g;
		const bBefore = renderer.currentColor.b;
		const alphaBefore = renderer.getGlobalAlpha();

		renderer.save();
		renderer.setColor("rgba(0, 255, 0, 1.0)");
		renderer.setGlobalAlpha(0.9);
		renderer.restore();

		expect(renderer.currentColor.r).toBe(rBefore);
		expect(renderer.currentColor.g).toBe(gBefore);
		expect(renderer.currentColor.b).toBe(bBefore);
		expect(renderer.getGlobalAlpha()).toBeCloseTo(alphaBefore, 5);
	});
});
