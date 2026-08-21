import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Tests for renderer save/restore through the public API.
 * These run on whatever renderer is available (Canvas or WebGL)
 * and verify that JS-side state is correctly preserved.
 */
describe("Renderer save/restore", () => {
	let renderer;

	let app;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		renderer = app.renderer;
	});

	afterAll(() => {
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	beforeEach(() => {
		renderer.setColor("#000000");
		renderer.setGlobalAlpha(1.0);
		renderer.setBlendMode("normal");
		renderer.clearTint();
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

	describe("scissor state (WebGL)", () => {
		// These two used to live in the outer describe behind
		// `if (renderer.type !== "WebGL") return;`. That describe only ever
		// builds a CANVAS renderer, so the guard was always true and both tests
		// returned immediately — reported as passing, never once executed. They
		// now get a real WebGL renderer, and skip VISIBLY when there is none.
		let glRenderer;

		beforeAll(async () => {
			glRenderer = await getWebGLRenderer();
		});

		afterAll(() => {
			releaseWebGLRenderer();
		});

		it("preserves scissor state across save/restore", (ctx) => {
			requireWebGL(ctx, glRenderer);

			glRenderer.clipRect(50, 60, 200, 150);
			const scissorBefore = Array.from(glRenderer.currentScissor);

			glRenderer.save();
			glRenderer.clipRect(10, 20, 100, 80);
			expect(glRenderer.currentScissor[0]).toBe(10);
			expect(glRenderer.currentScissor[1]).toBe(20);
			glRenderer.restore();

			expect(glRenderer.currentScissor[0]).toBe(scissorBefore[0]);
			expect(glRenderer.currentScissor[1]).toBe(scissorBefore[1]);
			expect(glRenderer.currentScissor[2]).toBe(scissorBefore[2]);
			expect(glRenderer.currentScissor[3]).toBe(scissorBefore[3]);
		});

		it("preserves scissor through nested save/restore", (ctx) => {
			requireWebGL(ctx, glRenderer);

			glRenderer.clipRect(10, 20, 300, 250);
			const scissor0 = Array.from(glRenderer.currentScissor);

			glRenderer.save();
			glRenderer.clipRect(50, 60, 100, 80);
			const scissor1 = Array.from(glRenderer.currentScissor);

			glRenderer.save();
			glRenderer.clipRect(70, 80, 50, 40);

			glRenderer.restore();
			expect(glRenderer.currentScissor[0]).toBe(scissor1[0]);
			expect(glRenderer.currentScissor[1]).toBe(scissor1[1]);
			expect(glRenderer.currentScissor[2]).toBe(scissor1[2]);
			expect(glRenderer.currentScissor[3]).toBe(scissor1[3]);

			glRenderer.restore();
			expect(glRenderer.currentScissor[0]).toBe(scissor0[0]);
			expect(glRenderer.currentScissor[1]).toBe(scissor0[1]);
			expect(glRenderer.currentScissor[2]).toBe(scissor0[2]);
			expect(glRenderer.currentScissor[3]).toBe(scissor0[3]);
		});
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
