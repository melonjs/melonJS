import { beforeAll, describe, expect, it, vi } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";
import WebGLIndexBuffer from "../src/video/webgl/buffer/index.js";
import WebGLVertexState from "../src/video/webgl/buffer/vertexstate.js";

/**
 * Unit tests for {@link WebGLVertexState} — the GL vertex array object
 * wrapper (the engine's `GPUVertexState` analogue). Exercised directly
 * against a real WebGL 2 context rather than through a Batcher, so each
 * method's contract is pinned independently of its callers.
 */
describe("WebGLVertexState", () => {
	let gl;
	let isWebGL;
	let shader;

	// a 3-attribute layout: vec3 position, vec2 uv, unsigned-byte colour
	const STRIDE = 24;
	const ATTRIBUTES = [
		{ name: "aVertex", size: 3, type: 0, normalized: false, offset: 0 },
		{ name: "aRegion", size: 2, type: 0, normalized: false, offset: 12 },
		{ name: "aColor", size: 4, type: 0, normalized: true, offset: 20 },
	];

	beforeAll(() => {
		boot();
		video.init(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		isWebGL = video.renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = video.renderer.gl;
			// fill in the GL enums now that a context exists
			ATTRIBUTES[0].type = gl.FLOAT;
			ATTRIBUTES[1].type = gl.FLOAT;
			ATTRIBUTES[2].type = gl.UNSIGNED_BYTE;
			shader = video.renderer.batchers.get("quad").defaultShader;
		}
	});

	const requireWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// resolve to fixed locations so the spec doesn't depend on a shader
	const fixedLocations = (name) => {
		return { aVertex: 0, aRegion: 1, aColor: 2 }[name] ?? -1;
	};

	function makeState(overrides = {}) {
		// the helper must be transparent to GL state itself, or the
		// binding-restore assertions below would be testing the helper
		const previous = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(600), gl.STREAM_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, previous);
		return new WebGLVertexState(gl, {
			attributes: ATTRIBUTES,
			stride: STRIDE,
			buffer,
			resolveLocation: fixedLocations,
			...overrides,
		});
	}

	describe("construction", () => {
		it("builds a valid vertex array applying the whole layout", (ctx) => {
			requireWebGL(ctx);
			const state = makeState();
			expect(gl.isVertexArray(state.handle)).toBe(true);

			state.bind();
			for (const attr of ATTRIBUTES) {
				const loc = fixedLocations(attr.name);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
					attr.name,
				).toBe(true);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
					attr.name,
				).toBe(STRIDE);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE),
					attr.name,
				).toBe(attr.size);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
					attr.name,
				).toBe(attr.normalized);
				expect(
					gl.getVertexAttribOffset(loc, gl.VERTEX_ATTRIB_ARRAY_POINTER),
					attr.name,
				).toBe(attr.offset);
			}
			gl.bindVertexArray(null);
			state.destroy();
		});

		it("does not leak the bindings it uses while building", (ctx) => {
			requireWebGL(ctx);
			// this is the invariant whose absence corrupted the current
			// batcher's uploads: building must be transparent to GL state
			const other = makeState();
			const otherBuffer = gl.createBuffer();
			other.bind();
			gl.bindBuffer(gl.ARRAY_BUFFER, otherBuffer);

			const built = makeState();

			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(other.handle);
			expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(otherBuffer);

			gl.bindVertexArray(null);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			built.destroy();
			other.destroy();
			gl.deleteBuffer(otherBuffer);
		});

		it("skips (and warns about) an attribute the shader does not declare", (ctx) => {
			requireWebGL(ctx);
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const state = makeState({
					resolveLocation: (name) => {
						return name === "aColor" ? -1 : fixedLocations(name);
					},
				});
				state.bind();
				expect(gl.getVertexAttrib(2, gl.VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(
					false,
				);
				gl.bindVertexArray(null);
				const warned = warnSpy.mock.calls.filter((args) => {
					return /aColor/.test(String(args[0]));
				});
				expect(warned.length).toBe(1);
				state.destroy();
			} finally {
				warnSpy.mockRestore();
			}
		});
	});

	describe("bind()", () => {
		it("makes this vertex array current", (ctx) => {
			requireWebGL(ctx);
			const a = makeState();
			const b = makeState();
			a.bind();
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(a.handle);
			b.bind();
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(b.handle);
			gl.bindVertexArray(null);
			a.destroy();
			b.destroy();
		});
	});

	describe("build()", () => {
		it("replaces the GL handle while keeping the object identity", (ctx) => {
			requireWebGL(ctx);
			const state = makeState();
			const first = state.handle;
			state.build();
			expect(state.handle).not.toBe(first);
			expect(gl.isVertexArray(first)).toBe(false);
			expect(gl.isVertexArray(state.handle)).toBe(true);
			state.destroy();
		});

		it("re-points the layout at a replaced vertex buffer", (ctx) => {
			requireWebGL(ctx);
			const state = makeState();
			const replacement = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, replacement);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(600), gl.STREAM_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);

			state.build({ buffer: replacement });
			state.bind();
			expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(
				replacement,
			);
			gl.bindVertexArray(null);
			state.destroy();
			gl.deleteBuffer(replacement);
		});

		it("captures an index buffer supplied in the descriptor", (ctx) => {
			requireWebGL(ctx);
			const indexBuffer = new WebGLIndexBuffer(gl, 60, true);
			const state = makeState({ indexBuffer });
			state.bind();
			expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
				indexBuffer.buffer,
			);
			gl.bindVertexArray(null);
			state.destroy();
			indexBuffer.destroy();
		});
	});

	describe("captureIndexBuffer()", () => {
		it("captures a later-created index buffer into this vertex array", (ctx) => {
			requireWebGL(ctx);
			const state = makeState();
			state.bind();
			expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(null);
			gl.bindVertexArray(null);

			let created;
			state.captureIndexBuffer(undefined, () => {
				created = new WebGLIndexBuffer(gl, 60, true);
				created.fillQuadPattern(10);
				state.descriptor.indexBuffer = created;
			});

			state.bind();
			expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
				created.buffer,
			);
			gl.bindVertexArray(null);
			state.destroy();
			created.destroy();
		});

		it("restores the previous bindings, so a foreign state is untouched", (ctx) => {
			requireWebGL(ctx);
			const current = makeState();
			const foreignBuffer = gl.createBuffer();
			current.bind();
			gl.bindBuffer(gl.ARRAY_BUFFER, foreignBuffer);

			const other = makeState();
			const idx = new WebGLIndexBuffer(gl, 60, true);
			other.captureIndexBuffer(idx);

			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(current.handle);
			expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(foreignBuffer);
			// and the capture landed in the OTHER state, not the current one
			current.bind();
			expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(null);
			other.bind();
			expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(idx.buffer);

			gl.bindVertexArray(null);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			current.destroy();
			other.destroy();
			idx.destroy();
			gl.deleteBuffer(foreignBuffer);
		});
	});

	describe("release() / destroy()", () => {
		it("release() deletes the handle and is idempotent", (ctx) => {
			requireWebGL(ctx);
			const state = makeState();
			const handle = state.handle;
			state.release();
			expect(gl.isVertexArray(handle)).toBe(false);
			expect(state.handle).toBe(null);
			expect(() => {
				state.release();
			}).not.toThrow();
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});

		it("destroy() releases the handle and drops the descriptor", (ctx) => {
			requireWebGL(ctx);
			const state = makeState();
			const handle = state.handle;
			state.destroy();
			expect(gl.isVertexArray(handle)).toBe(false);
			expect(state.descriptor).toBe(null);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});

		it("destroy() is safe on a handle from a lost context", (ctx) => {
			requireWebGL(ctx);
			// deleting an object belonging to a lost context queues
			// INVALID_OPERATION — the isVertexArray probe must prevent it.
			// Simulated by handing it a foreign (never-valid) handle.
			const state = makeState();
			state.handle = gl.createVertexArray();
			gl.deleteVertexArray(state.handle);
			while (gl.getError() !== gl.NO_ERROR) {
				/* drain */
			}
			state.destroy();
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	it("integrates with the real batcher shader locations", (ctx) => {
		requireWebGL(ctx);
		// sanity: the production resolveLocation shape (a shader lookup)
		// works exactly like the fixed map used above
		const state = makeState({
			resolveLocation: (name) => {
				return shader.getAttribLocation(name);
			},
		});
		state.bind();
		const loc = shader.getAttribLocation("aVertex");
		expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(true);
		gl.bindVertexArray(null);
		state.destroy();
	});
});
