import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	NoiseTexture2d,
	ShaderEffect,
	video,
	WebGLRenderer,
} from "../src/index.js";
import { emit, RENDER_TARGET_CHANGED } from "../src/system/event.ts";

/**
 * Regression tests for the 2026-07 batchers + texture-cache bug hunt,
 * GL-state cluster: texture-unit collisions between the lit batcher's fixed
 * normal-map range and the renderer-wide unit allocator, per-batcher tracking
 * of global GL state, unit-0 invalidation reach, primitive-batcher buffer
 * overflow, normal-map GPU eviction, per-renderer mesh depth state, and GL
 * buffer lifetime across reset/context-restore.
 */
describe("batcher GL state", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.WEBGL,
				// headless chromium software GL trips the performance-caveat
				// check — opt out so the tests run instead of skipping
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (video.renderer instanceof WebGLRenderer) {
			renderer = video.renderer;
		}
	});

	afterAll(() => {
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.AUTO,
			});
		} catch {
			// ignore — nothing to restore if init never succeeded
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("activating the lit batcher reserves the paired normal-map unit range", (ctx) => {
		requireWebGL(ctx);
		const lit = renderer.batchers.get("litQuad");
		renderer.setBatcher("litQuad");
		renderer.setBatcher("quad");

		const half = lit.maxBatchTextures;
		for (let i = half; i < half * 2; i++) {
			expect(renderer.cache.reservedUnits.has(i)).toBe(true);
		}

		// the allocator must never hand a reserved (normal-map) unit to a
		// color texture — drain it past exhaustion to cover the reset path too
		renderer.cache.resetUnitAssignments();
		const handed = new Set();
		for (let i = 0; i < renderer.maxTextures * 2; i++) {
			handed.add(renderer.cache.allocateTextureUnit());
		}
		for (const unit of handed) {
			expect(unit < half || unit >= half * 2).toBe(true);
		}
		renderer.cache.resetUnitAssignments();
	});

	it("ShaderEffect extra samplers skip units reserved by others", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		const lit = renderer.batchers.get("litQuad");
		// make sure the lit batcher's reservation is in place (idempotent)
		renderer.setBatcher("litQuad");
		renderer.setBatcher("quad");

		const fx = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		// the trivial fragment declares no extra sampler — stub the uniform
		// upload so only the unit-claiming logic under test runs
		vi.spyOn(fx._shader, "setUniform").mockImplementation(() => {});
		fx.setTexture("uNoise", video.createCanvas(8, 8));
		fx._prepareTextures(quad);

		const claimed = fx._extraTextures.get("uNoise").unit;
		// claiming counts down from the batcher's top unit — it must walk
		// PAST the lit batcher's reserved normal range, not land inside it
		expect(claimed).toBeLessThan(lit.maxBatchTextures);
		fx.destroy();
	});

	it("tracks the active texture unit renderer-wide, not per batcher", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		const mesh = renderer.batchers.get("mesh");
		quad.currentTextureUnit = 3;
		expect(mesh.currentTextureUnit).toBe(3);
		expect(renderer._activeTextureUnit).toBe(3);
		mesh.currentTextureUnit = -1;
		expect(quad.currentTextureUnit).toBe(-1);
	});

	it("createTexture2D re-activates its unit even when tracking says it's current", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		const quad = renderer.batchers.get("quad");
		const canvas = video.createCanvas(8, 8);

		// upload once at unit 2 — tracking now says "tex bound at 2, unit 2 active"
		const tex = quad.createTexture2D(
			2,
			canvas,
			gl.NEAREST,
			"no-repeat",
			8,
			8,
			true,
			false,
			undefined,
			false,
		);
		// a foreign gl.activeTexture move the batcher's bookkeeping can't see
		// (another batcher instance, an FBO pass, user GL code)
		gl.activeTexture(gl.TEXTURE0 + 5);

		// force a re-upload into the same handle at unit 2 — the upload must
		// land on unit 2, not on whatever unit is really active
		quad.createTexture2D(
			2,
			canvas,
			gl.NEAREST,
			"no-repeat",
			8,
			8,
			true,
			false,
			tex,
			false,
		);
		expect(gl.getParameter(gl.ACTIVE_TEXTURE)).toBe(gl.TEXTURE0 + 2);
	});

	it("unit-0 invalidation reaches every batcher, not just the current one", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		const quad = renderer.batchers.get("quad");
		const mesh = renderer.batchers.get("mesh");
		const lit = renderer.batchers.get("litQuad");
		const fake = gl.createTexture();

		quad.boundTextures[0] = fake;
		mesh.boundTextures[0] = fake;
		lit.boundTextures[0] = fake;
		renderer.invalidateTextureUnit(0);
		expect(0 in quad.boundTextures).toBe(false);
		expect(0 in mesh.boundTextures).toBe(false);
		expect(0 in lit.boundTextures).toBe(false);

		// integration: a post-effect blit through the QUAD batcher nulls GL
		// unit 0 — the MESH batcher's record must not survive it. Blits are
		// always driven by a ShaderEffect (see WebGLRenderer.blitEffect).
		const fx = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		mesh.boundTextures[0] = fake;
		renderer.setBatcher("quad");
		quad.blitTexture(fake, 0, 0, 16, 16, fx);
		expect(0 in mesh.boundTextures).toBe(false);

		fx.destroy();
		gl.deleteTexture(fake);
	});

	it("fills a shape larger than the vertex buffer without GL errors", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		// drain any pre-existing error flags
		while (gl.getError() !== gl.NO_ERROR) {
			// keep draining
		}

		renderer.setBatcher("primitive");
		renderer.setColor("#ff0000");
		// π(w+h)/arcResolution segments × 3 fan vertices ≈ 4712 — beyond the
		// 4096-vertex buffer, so this only renders if drawVertices chunks
		renderer.fillEllipse(64, 64, 500, 500);
		renderer.flush();

		expect(gl.getError()).toBe(gl.NO_ERROR);
		const px = new Uint8Array(4);
		gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		expect(px[0]).toBe(255);
		expect(px[1]).toBe(0);
		expect(px[2]).toBe(0);
	});

	it("destroying a NoiseTexture2d releases its cached normal-map GL texture", (ctx) => {
		requireWebGL(ctx);
		const lit = renderer.batchers.get("litQuad");
		const nm = new NoiseTexture2d({ width: 8, height: 8, asNormalMap: true });
		const source = nm.getTexture();

		lit.bindNormalMap(source, lit.maxBatchTextures);
		expect(lit.normalMapTextures.has(source)).toBe(true);
		const tex = lit.normalMapTextures.get(source).tex;

		nm.destroy();
		expect(lit.normalMapTextures.has(source)).toBe(false);
		expect(renderer.gl.isTexture(tex)).toBe(false);
	});

	it("RENDER_TARGET_CHANGED re-arms the mesh depth clear only for its own renderer", (ctx) => {
		requireWebGL(ctx);
		renderer._meshDepthDirty = false;
		// another renderer instance's broadcast must not re-arm ours
		emit(RENDER_TARGET_CHANGED, { not: "this renderer" });
		expect(renderer._meshDepthDirty).toBe(false);
		// our own broadcast re-arms
		emit(RENDER_TARGET_CHANGED, renderer);
		expect(renderer._meshDepthDirty).toBe(true);
		// legacy no-argument emit is treated as "mine" (back-compat)
		renderer._meshDepthDirty = false;
		emit(RENDER_TARGET_CHANGED);
		expect(renderer._meshDepthDirty).toBe(true);
	});

	it("reset() replaces GL index/vertex buffers without leaking the old ones", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		const quad = renderer.batchers.get("quad");
		const mesh = renderer.batchers.get("mesh");

		// bind each buffer once so gl.isBuffer can observe deletion
		quad.indexBuffer.bind();
		mesh.indexBuffer.bind();
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.glVertexBuffer);
		const oldQuadIdx = quad.indexBuffer.buffer;
		const oldMeshIdx = mesh.indexBuffer.buffer;
		const oldMeshVbo = mesh.glVertexBuffer;

		renderer.reset();

		expect(quad.indexBuffer.buffer).not.toBe(oldQuadIdx);
		expect(gl.isBuffer(oldQuadIdx)).toBe(false);
		expect(mesh.indexBuffer.buffer).not.toBe(oldMeshIdx);
		expect(gl.isBuffer(oldMeshIdx)).toBe(false);
		expect(mesh.glVertexBuffer).not.toBe(oldMeshVbo);
		expect(gl.isBuffer(oldMeshVbo)).toBe(false);
	});
});
