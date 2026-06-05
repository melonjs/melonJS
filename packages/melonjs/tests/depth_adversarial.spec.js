import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	GLShader,
	NineSliceSprite,
	RenderState,
	ShaderEffect,
	Sprite,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Adversarial integration tests for the per-renderable depth pipeline
 * (PR A — vec3 aVertex + renderer.setDepth, 19.7).
 *
 * The basic shape-of-API tests live in `depth.spec.js`. This file targets
 * bug classes that only surface when the depth plumbing meets other
 * subsystems mid-frame:
 *
 *   - cross-batcher state persistence (depth is *renderer* state, not
 *     batcher state — switching batchers must not lose it)
 *   - per-vertex emission boundaries (mid-batch depth change should
 *     produce per-vertex distinct z without retroactively rewriting
 *     vertices already in the buffer)
 *   - composite renderables (Text → N character quads from one
 *     setDepth call all share that depth)
 *   - parent/child Container nesting (child's preDraw overrides
 *     parent's depth, postDraw pops it back via the save/restore stack)
 *   - blitTexture invariant (post-fx blits ignore currentDepth and emit
 *     z=0, since they live in screen space)
 *   - Mesh batcher independence (Mesh has its own projection — setDepth
 *     must not affect mesh vertices)
 *   - backward compat (custom shaders declaring `attribute vec2 aVertex`
 *     keep rendering without GL errors after the layout widened)
 *   - save/restore stack growth past initial 32-slot capacity
 *   - extreme depth values (NaN / Infinity / very-negative) don't crash GL
 *   - fuzz: random sequences of setDepth + draws produce no GL errors
 */
describe("depth pipeline adversarial integration", () => {
	let renderer;
	let gl;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	// Internal helpers called from inside it() callbacks. By the time
	// we reach these, the calling test has already skipped via
	// `skipIfNoWebGL(ctx)` if WebGL isn't available — so we can use
	// `gl` directly without guarding here.
	function expectNoGLErrors() {
		const err = gl.getError();
		if (err !== gl.NO_ERROR) {
			expect.fail(`GL error after draw: 0x${err.toString(16)}`);
		}
	}

	function drainGLErrors() {
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain stale errors from previous tests */
		}
	}

	const skipIfNoWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
			return true;
		}
		return false;
	};

	// ---- cross-batcher depth persistence ----

	it("currentDepth survives a quad → primitive → quad batcher switch", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		renderer.setDepth(33);
		renderer.setBatcher("quad");
		expect(renderer.currentDepth).toBe(33);
		renderer.setBatcher("primitive");
		expect(renderer.currentDepth).toBe(33);
		renderer.setBatcher("litQuad");
		expect(renderer.currentDepth).toBe(33);
		renderer.setBatcher("quad");
		expect(renderer.currentDepth).toBe(33);

		// reset for following tests
		renderer.setDepth(0);
	});

	// ---- mid-batch per-vertex emission ----

	it("mid-batch depth change produces per-vertex distinct z without retroactive rewrite", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();
		const tex = video.createCanvas(16, 16);

		// first sprite at depth 100
		renderer.save();
		renderer.setDepth(100);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.restore();

		// second sprite at depth 200 — same batcher, same in-flight buffer
		renderer.save();
		renderer.setDepth(200);
		renderer.drawImage(tex, 0, 0, 16, 16, 32, 0, 16, 16);
		renderer.restore();

		const f32 = batcher.vertexData.toFloat32();
		const vs = batcher.vertexSize;
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(8);

		// first quad's 4 vertices should still be at z=100 (not overwritten by setDepth(200))
		for (let v = 0; v < 4; v++) {
			expect(f32[v * vs + 2]).toBeCloseTo(100, 5);
		}
		// second quad's 4 vertices should be at z=200
		for (let v = 4; v < 8; v++) {
			expect(f32[v * vs + 2]).toBeCloseTo(200, 5);
		}
		batcher.vertexData.clear();
	});

	// ---- composite renderable inheritance ----

	it("NineSliceSprite (9-quad renderable) — every emitted quad inherits the same depth", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();

		const tex = video.createCanvas(48, 48);
		const nine = new NineSliceSprite(0, 0, {
			width: 96,
			height: 96,
			image: tex,
			framewidth: 48,
			frameheight: 48,
		});
		nine.depth = 77;

		nine.preDraw(renderer);
		nine.draw(renderer);
		nine.postDraw(renderer);

		const f32 = batcher.vertexData.toFloat32();
		const vs = batcher.vertexSize;
		const n = batcher.vertexData.vertexCount;
		// 9 quads × 4 verts = 36 (some may collapse if a slice is zero-sized,
		// but we should see at least 4 distinct quads worth of vertices)
		expect(n).toBeGreaterThanOrEqual(4 * 4);

		// every emitted vertex should share the same depth — composite
		// renderables call preDraw once, which sets currentDepth once
		for (let v = 0; v < n; v++) {
			expect(f32[v * vs + 2]).toBeCloseTo(77, 5);
		}
		batcher.vertexData.clear();
	});

	// ---- parent/child depth nesting via save/restore stack ----

	it("nested preDraw/postDraw — child's vertices carry child's depth, then stack pops back", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();

		const tex = video.createCanvas(16, 16);
		const sprite = new Sprite(0, 0, {
			framewidth: 16,
			frameheight: 16,
			image: tex,
		});
		sprite.depth = 99;

		// simulate the engine's call order for a Container at depth=5
		// hosting a Sprite at depth=99 (avoids needing a viewport for
		// Container.draw — we directly invoke the relevant preDraw / draw
		// / postDraw chain).
		renderer.save();
		renderer.setDepth(5); // parent's depth — would be set by Container.preDraw
		const depthBeforeChild = renderer.currentDepth;

		sprite.preDraw(renderer);
		sprite.draw(renderer);
		sprite.postDraw(renderer);

		// after child's postDraw, the save/restore stack must have popped
		// back to the parent's depth
		expect(renderer.currentDepth).toBe(depthBeforeChild);

		renderer.restore();

		// vertices emitted during sprite.draw should carry depth 99 (child's),
		// not 5 (parent's)
		const f32 = batcher.vertexData.toFloat32();
		const vs = batcher.vertexSize;
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(4);
		for (let v = 0; v < 4; v++) {
			expect(f32[v * vs + 2]).toBeCloseTo(99, 5);
		}
		batcher.vertexData.clear();
	});

	// ---- blitTexture invariant (post-fx blits always z=0) ----

	it("blitTexture ignores currentDepth and emits z=0 (screen-space invariant)", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		// install a deeply non-zero depth — the blit path should not pick it up
		renderer.setDepth(999);

		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();

		// build a real GL texture (blitTexture's first arg must be a raw
		// WebGLTexture, not a TextureAtlas wrapper)
		const rawTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, rawTex);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([255, 255, 255, 255]),
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.bindTexture(gl.TEXTURE_2D, null);

		// blitTexture expects a shader with a `uSampler` uniform (single-
		// texture path). The batcher's default shader uses multi-texture
		// samplers (`uSampler0..N`), so we build a tiny ShaderEffect that
		// provides the right uniform shape.
		const fx = new ShaderEffect(
			renderer,
			`vec4 apply(vec4 color, vec2 uv) { return color; }`,
		);

		// intercept vertex pushes so we can inspect z values before the
		// internal flush wipes them
		const captured = [];
		const originalPush = batcher.vertexData.push.bind(batcher.vertexData);
		batcher.vertexData.push = (...args) => {
			captured.push(args[2]); // z is the 3rd component (x, y, z, ...)
			originalPush(...args);
		};

		try {
			batcher.blitTexture(rawTex, 0, 0, 32, 32, fx);
		} finally {
			batcher.vertexData.push = originalPush;
			fx.destroy();
		}

		// every blit vertex's z must be 0, regardless of currentDepth=999
		expect(captured.length).toBeGreaterThanOrEqual(4);
		for (const z of captured) {
			expect(z).toBe(0);
		}

		// cleanup
		gl.deleteTexture(rawTex);
		renderer.setDepth(0);
		batcher.vertexData.clear();
	});

	// ---- Mesh batcher independence ----

	it("Mesh batcher's pushMesh ignores currentDepth (Mesh owns its own projection)", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		// poison currentDepth — pushMesh must not pick this up; mesh vertices
		// come from the mesh's own (already-projected) data
		renderer.setDepth(-555);

		const batcher = renderer.setBatcher("mesh");
		batcher.vertexData.clear();

		// minimal mesh-like object: one triangle at known z values
		// (the WebGLRenderer.drawMesh path enables depth test + cull, so we
		// can just push directly through the batcher and inspect the buffer)
		const meshLike = {
			vertices: new Float32Array([
				0,
				0,
				11, // vert 0 at z=11
				1,
				0,
				22, // vert 1 at z=22
				0,
				1,
				33, // vert 2 at z=33
			]),
			uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
			indices: new Uint16Array([0, 1, 2]),
			vertexCount: 3,
			cullBackFaces: false,
			texture: renderer.cache.get(video.createCanvas(8, 8)),
		};

		batcher.addMesh(meshLike, 0xffffffff);

		const f32 = batcher.vertexData.toFloat32();
		const vs = batcher.vertexSize;
		expect(batcher.vertexData.vertexCount).toBe(3);

		// vertices in the mesh buffer must carry the mesh's *own* z values
		// (11, 22, 33), not currentDepth (-555)
		expect(f32[0 * vs + 2]).toBeCloseTo(11, 5);
		expect(f32[1 * vs + 2]).toBeCloseTo(22, 5);
		expect(f32[2 * vs + 2]).toBeCloseTo(33, 5);

		renderer.setDepth(0);
		batcher.vertexData.clear();
	});

	// ---- backward compat: custom shader declaring vec2 aVertex ----

	it("custom GLShader declaring `attribute vec2 aVertex` renders without GL error", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		drainGLErrors();

		// hand-crafted vertex shader using the pre-PR-A vec2 attribute
		// declaration — must keep working because the batcher's stride and
		// downstream attribute offsets stay invariant by *name*
		const vertexSrc = `
			attribute vec2 aVertex;
			attribute vec2 aRegion;
			attribute vec4 aColor;
			attribute float aTextureId;
			uniform mat4 uProjectionMatrix;
			varying vec2 vRegion;
			varying vec4 vColor;
			varying float vTextureId;
			void main(void) {
				gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);
				vColor = vec4(aColor.bgr * aColor.a, aColor.a);
				vRegion = aRegion;
				vTextureId = aTextureId;
			}
		`;
		const fragmentSrc = `
			precision mediump float;
			uniform sampler2D uSampler0;
			varying vec2 vRegion;
			varying vec4 vColor;
			varying float vTextureId;
			void main(void) {
				gl_FragColor = texture2D(uSampler0, vRegion) * vColor;
			}
		`;
		const shader = new GLShader(gl, vertexSrc, fragmentSrc, "mediump");

		const batcher = renderer.setBatcher("quad", shader);
		const tex = video.createCanvas(16, 16);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		batcher.flush();

		expectNoGLErrors();

		shader.destroy();
		// restore default shader for subsequent tests
		renderer.setBatcher("quad");
	});

	// ---- save/restore stack growth ----

	it("RenderState — currentDepth survives save/restore beyond initial 32-slot capacity", () => {
		const state = new RenderState();
		const depths = [];
		// push 40 saves with distinct depths (capacity starts at 32 → forces _growStacks)
		for (let i = 0; i < 40; i++) {
			state.currentDepth = i + 1; // 1..40
			depths.push(state.currentDepth);
			state.save();
		}
		// mutate so restore has something to roll back from
		state.currentDepth = 9999;

		// pop in reverse
		for (let i = 39; i >= 0; i--) {
			state.restore(800, 600);
			expect(state.currentDepth).toBe(depths[i]);
		}
	});

	// ---- extreme values ----

	it("setDepth tolerates extreme values without GL errors", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		drainGLErrors();
		const tex = video.createCanvas(16, 16);

		for (const z of [
			0,
			-1e9,
			1e9,
			-Number.MAX_SAFE_INTEGER,
			Number.MAX_SAFE_INTEGER,
			Number.EPSILON,
			-Number.EPSILON,
		]) {
			renderer.save();
			renderer.setDepth(z);
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
			renderer.restore();
			expectNoGLErrors();
		}

		renderer.setDepth(0);
	});

	it("setDepth(NaN) / setDepth(Infinity) do not throw or produce GL errors", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		drainGLErrors();
		const tex = video.createCanvas(16, 16);

		// NaN and Infinity propagate to the vertex stream — the GPU's behavior
		// is undefined visually but WebGL itself does not error on them
		for (const z of [
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		]) {
			renderer.save();
			expect(() => {
				renderer.setDepth(z);
				renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
				renderer.flush();
			}).not.toThrow();
			renderer.restore();
			expectNoGLErrors();
		}

		renderer.setDepth(0);
	});

	// ---- flush boundary ----

	it("flushing mid-frame and continuing to draw preserves depth correctly", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();
		const tex = video.createCanvas(8, 8);

		renderer.save();
		renderer.setDepth(7);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		// forced flush — vertices are uploaded to the GPU; the next push
		// goes into a freshly-cleared buffer slot 0
		batcher.flush();
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		renderer.restore();

		// the second sprite (post-flush) should still have z=7
		const f32 = batcher.vertexData.toFloat32();
		const vs = batcher.vertexSize;
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(4);
		for (let v = 0; v < 4; v++) {
			expect(f32[v * vs + 2]).toBeCloseTo(7, 5);
		}
		batcher.vertexData.clear();
	});

	// ---- fuzz ----

	it("fuzz: 500 random (setDepth, draw, batcher-switch) ops produce no GL error", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		drainGLErrors();
		const tex = video.createCanvas(8, 8);

		// deterministic LCG for repro
		let seed = 1234567;
		const rand = () => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 0x100000000;
		};

		for (let i = 0; i < 500; i++) {
			const op = Math.floor(rand() * 5);
			const depth = (rand() - 0.5) * 2000;
			renderer.save();
			renderer.setDepth(depth);
			switch (op) {
				case 0:
					renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
					break;
				case 1:
					renderer.fillRect(0, 0, 10, 10);
					break;
				case 2:
					renderer.strokeRect(0, 0, 10, 10);
					break;
				case 3:
					// flush + switch batcher
					renderer.flush();
					renderer.setBatcher(rand() < 0.5 ? "quad" : "primitive");
					break;
				case 4:
					// nested save/restore inside the outer save
					renderer.save();
					renderer.setDepth(depth + 1);
					renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
					renderer.restore();
					break;
				default:
					break;
			}
			renderer.restore();
		}
		renderer.flush();
		expectNoGLErrors();

		// after the burst, depth should be back to 0 (matched save/restore pairs)
		expect(renderer.currentDepth).toBe(0);
	});

	// ---- one final sanity end-to-end ----

	it("end-to-end frame: sprite + primitive + nineslice at varying depths, no error", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		drainGLErrors();
		const tex = video.createCanvas(16, 16);

		const sprite = new Sprite(0, 0, {
			framewidth: 16,
			frameheight: 16,
			image: tex,
		});
		sprite.depth = 10;
		sprite.preDraw(renderer);
		sprite.draw(renderer);
		sprite.postDraw(renderer);

		renderer.save();
		renderer.setDepth(-5);
		renderer.strokeRect(20, 20, 30, 30);
		renderer.restore();

		const tex48 = video.createCanvas(48, 48);
		const nine = new NineSliceSprite(0, 0, {
			width: 96,
			height: 96,
			image: tex48,
			framewidth: 48,
			frameheight: 48,
		});
		nine.depth = 42;
		nine.preDraw(renderer);
		nine.draw(renderer);
		nine.postDraw(renderer);

		renderer.flush();
		expectNoGLErrors();
	});
});
