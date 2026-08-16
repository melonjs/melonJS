import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	game,
	Matrix3d,
	Mesh,
	NoiseTexture2d,
	ShaderEffect,
	WebGLRenderer,
} from "../src/index.js";
import { emit, RENDER_TARGET_CHANGED } from "../src/system/event.ts";
import Renderer from "../src/video/renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

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
			await getWebGLRenderer(128, 128);
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (game.renderer instanceof WebGLRenderer) {
			renderer = game.renderer;
		}
	});

	afterAll(() => {
		try {
			releaseWebGLRenderer();
		} catch {
			// ignore — nothing to restore if init never succeeded
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// #1585 inverted this: the lit batcher used to permanently reserve
	// `[n, 2n)` for normal maps on first bind, which cost every allocator half
	// the device's units for the rest of the session and collided with the top
	// units ShaderEffect and toFrameTexture claim. Normal maps now take slots
	// from the shared pool, so activating lighting must reserve NOTHING.
	it("activating the lit batcher reserves no units", (ctx) => {
		requireWebGL(ctx);
		const lit = renderer.batchers.get("litQuad");
		renderer.setBatcher("litQuad");
		renderer.setBatcher("quad");

		expect(renderer.cache.reservedUnits.size).toBe(0);
		// and the lit batcher gets the FULL pool, not half of it
		expect(lit.maxBatchTextures).toBe(renderer.maxTextures);

		// every unit stays allocatable — drain past exhaustion to cover the
		// reset path too, and assert the whole range is reachable
		renderer.cache.resetUnitAssignments();
		const handed = new Set();
		for (let i = 0; i < renderer.maxTextures * 2; i++) {
			handed.add(renderer.cache.allocateTextureUnit());
		}
		expect(handed.size).toBe(renderer.maxTextures);
		for (const unit of handed) {
			expect(unit).toBeLessThan(renderer.maxTextures);
		}
		renderer.cache.resetUnitAssignments();
	});

	it("ShaderEffect extra samplers skip units reserved by others", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		renderer.setBatcher("litQuad");
		renderer.setBatcher("quad");

		// a unit reserved by someone else must still be skipped — the lit
		// batcher no longer reserves any (#1585), so stand one in explicitly
		const held = renderer.maxTextures - 1;
		renderer.cache.reserveUnit(held);

		const fx = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		// the trivial fragment declares no extra sampler — stub the uniform
		// upload so only the unit-claiming logic under test runs
		vi.spyOn(fx._shader, "setUniform").mockImplementation(() => {});
		fx.setTexture("uNoise", Renderer.createCanvas(8, 8));
		fx._prepareTextures(quad);

		const claimed = fx._extraTextures.get("uNoise").unit;
		// claiming counts down from the top unit — it must step OVER the
		// reserved one rather than aliasing onto it
		expect(claimed).not.toBe(held);
		expect(renderer.cache.reservedUnits.has(claimed)).toBe(true);
		fx.destroy();
		renderer.cache.releaseUnit(held);
	});

	// The collision #1585 removed: ShaderEffect claims extra samplers counting
	// DOWN from the top unit, and the lit batcher used to own a FIXED upper
	// range for normal maps. An effect that claimed before lighting first
	// activated landed inside that range, and the two aliased silently — wrong
	// lighting, no error. Normal maps now allocate from the shared pool, which
	// respects reservations, so the overlap is structurally impossible.
	it("a normal map never lands on a unit reserved by a ShaderEffect", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		const lit = renderer.batchers.get("litQuad");

		// claim first, exactly the ordering that used to break
		const fx = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		vi.spyOn(fx._shader, "setUniform").mockImplementation(() => {});
		fx.setTexture("uNoise", Renderer.createCanvas(8, 8));
		fx._prepareTextures(quad);
		const claimed = fx._extraTextures.get("uNoise").unit;
		expect(renderer.cache.reservedUnits.has(claimed)).toBe(true);

		// then drive enough distinct normal maps to walk the whole pool
		const landed = new Set();
		for (let i = 0; i < renderer.maxTextures + 2; i++) {
			landed.add(lit.resolveNormalUnit(Renderer.createCanvas(4, 4)));
		}
		// every unit except the reserved one — proves the normal maps walk the
		// WHOLE pool while stepping over the reservation, not just two of them
		expect(landed.size).toBe(renderer.maxTextures - 1);
		expect(landed.has(claimed)).toBe(false);

		fx.destroy();
		renderer.cache.resetUnitAssignments();
	});

	// Regression: `resolveNormalUnit` briefly cleared `boundTextures[unit]` to
	// stop the colour tracker claiming that slot. But that array is exactly what
	// `MaterialBatcher.reset()` walks to DELETE the GL textures it owns, and a
	// normal map's texture lives there — so every reset leaked one GL texture
	// per normal map, unreachable and undeletable.
	it("normal-map GL textures are deleted on reset, not leaked", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		const lit = renderer.batchers.get("litQuad");
		const source = Renderer.createCanvas(8, 8);

		const unit = lit.resolveNormalUnit(source);
		const tex = lit.normalStore.peek(source)?.handle;
		expect(tex).toBeDefined();
		expect(gl.isTexture(tex)).toBe(true);
		// the handle must be reachable from the array reset() walks
		expect(lit.boundTextures[unit]).toBe(tex);

		lit.reset();
		expect(gl.isTexture(tex)).toBe(false);
		renderer.cache.resetUnitAssignments();
	});

	// Regression: a normal map claims its unit through `allocateTextureUnit()`,
	// which is keyless — so nothing released it. Distinct normal maps drained
	// the pool monotonically until something forced a full reset.
	it("evicting a normal map returns its unit to the allocator", (ctx) => {
		requireWebGL(ctx);
		const lit = renderer.batchers.get("litQuad");
		renderer.cache.resetUnitAssignments();
		const source = Renderer.createCanvas(8, 8);

		const unit = lit.resolveNormalUnit(source);
		expect(renderer.cache.usedUnits.has(unit)).toBe(true);

		lit.evictNormalMap(source);
		expect(renderer.cache.usedUnits.has(unit)).toBe(false);
		expect(lit.normalUnits.has(source)).toBe(false);
		// and the freed unit is genuinely handed out again
		expect(renderer.cache.allocateTextureUnit()).toBe(unit);
		renderer.cache.resetUnitAssignments();
	});

	// Colors and normal maps share one pool since #1585. Binding a normal map
	// onto a unit another batcher believes holds its color texture would make
	// that batcher skip the re-bind and sample the normal map instead — the old
	// fixed normal-map reservation made this impossible, so it is a new class.
	it("binding a normal map invalidates that unit on other batchers", (ctx) => {
		requireWebGL(ctx);
		const lit = renderer.batchers.get("litQuad");
		renderer.cache.resetUnitAssignments();

		const spy = vi.spyOn(renderer, "invalidateTextureUnit");
		const unit = lit.resolveNormalUnit(Renderer.createCanvas(8, 8));

		// announced renderer-wide, excluding the batcher that just bound it —
		// its own bookkeeping is already correct and clearing it would force a
		// redundant re-bind on the very next quad
		expect(spy).toHaveBeenCalledWith(unit, lit);

		spy.mockRestore();
		renderer.cache.resetUnitAssignments();
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
		const canvas = Renderer.createCanvas(8, 8);

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
		expect(lit.normalStore.peek(source)).toBeDefined();
		const tex = lit.normalStore.peek(source).handle;

		nm.destroy();
		expect(lit.normalStore.peek(source)).toBeUndefined();
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

		// VAO re-capture (#1509): the vertex states must reference the NEW
		// buffers — a VAO keeps deleted attachments alive and draws stale
		// data, so recreation without re-capture is the classic black-frame
		// bug this pins
		expect(gl.isVertexArray(quad.vertexState.handle)).toBe(true);
		expect(gl.isVertexArray(mesh.vertexState.handle)).toBe(true);
		const previous = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
		gl.bindVertexArray(quad.vertexState.handle);
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
			quad.indexBuffer.buffer,
		);
		gl.bindVertexArray(mesh.vertexState.handle);
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
			mesh.indexBuffer.buffer,
		);
		const meshLoc = mesh.defaultShader.getAttribLocation(
			mesh.attributes[0].name,
		);
		expect(
			gl.getVertexAttrib(meshLoc, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
		).toBe(mesh.glVertexBuffer);
		gl.bindVertexArray(previous);
	});

	describe("retained mesh draws leave the batcher usable (issue #1507)", () => {
		const makeMesh = () => {
			const m = new Mesh(0, 0, {
				vertices: [-24, -24, 0, 24, -24, 0, 24, 24, 0, -24, 24, 0],
				uvs: [0, 0, 1, 0, 1, 1, 0, 1],
				indices: [0, 1, 2, 0, 2, 3],
				width: 48,
				height: 48,
			});
			m.pos.set(64, 64, 0);
			m._useWorldSpace = true;
			m.cullBackFaces = false;
			return m;
		};

		it("restores the batcher's own vertex state and upload buffer", (ctx) => {
			requireWebGL(ctx);
			// a retained draw binds its own vertex array and index buffer; if it
			// doesn't hand the batcher's back, the next accumulating flush reads
			// vertex data from the wrong buffer and silently draws garbage
			const gl = renderer.gl;
			const batcher = renderer.batchers.get("mesh");
			const mesh = makeMesh();
			try {
				const proj = new Matrix3d();
				proj.ortho(0, 128, 128, 0, -1000, 1000);
				renderer.setProjection(proj);
				batcher.bind();
				const expectedArrayObject = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

				mesh.draw(renderer);
				renderer.flush();

				expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(
					expectedArrayObject,
				);
				expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(
					batcher.uploadBuffer,
				);
				expect(gl.getError()).toBe(gl.NO_ERROR);
			} finally {
				mesh.destroy();
			}
		});

		it("releases retained geometry on renderer reset", (ctx) => {
			requireWebGL(ctx);
			const batcher = renderer.batchers.get("mesh");
			const mesh = makeMesh();
			try {
				const proj = new Matrix3d();
				proj.ortho(0, 128, 128, 0, -1000, 1000);
				renderer.setProjection(proj);
				mesh.draw(renderer);
				renderer.flush();
				expect(batcher.retained.size).toBeGreaterThan(0);
				const geometry = batcher.retained.get(mesh);
				expect(geometry.vertexBuffer).not.toBeNull();

				batcher.reset();
				// GPU buffers must not outlive a reset — they'd be orphaned,
				// since the map that owned them is the only handle. Clearing the
				// map alone would satisfy a size check while leaking every VBO,
				// IBO and VAO, so assert the objects were released too.
				expect(batcher.retained.size).toBe(0);
				expect(geometry.vertexBuffer).toBeNull();
				expect(geometry.glIndexBuffer).toBeNull();
				expect(geometry.vertexState).toBeNull();
				expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
			} finally {
				mesh.destroy();
			}
		});
	});
});
