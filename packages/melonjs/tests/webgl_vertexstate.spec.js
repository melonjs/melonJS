import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, WebGLRenderer } from "../src/index.js";
import WebGLIndexBuffer from "../src/video/webgl/buffer/index.js";
import WebGLVertexState from "../src/video/webgl/buffer/vertexstate.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

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

	beforeAll(async () => {
		boot();
		const renderer = await getWebGLRenderer(64, 64);
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
			// fill in the GL enums now that a context exists
			ATTRIBUTES[0].type = gl.FLOAT;
			ATTRIBUTES[1].type = gl.FLOAT;
			ATTRIBUTES[2].type = gl.UNSIGNED_BYTE;
			shader = renderer.batchers.get("quad").defaultShader;
		}
	});

	afterAll(() => {
		// hand the shared context back and reset renderer state so the next
		// spec file does not inherit ours
		releaseWebGLRenderer();
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

		it("stays bound when it rebuilds while it is the current state", (ctx) => {
			requireWebGL(ctx);
			// `build()` snapshots the live bindings and restores them afterwards.
			// When the state rebuilding IS the bound one, that snapshot names a
			// vertex array `release()` is about to delete — restoring it raised
			// INVALID_OPERATION and left nothing bound, so the next draw read
			// its vertex data from no vertex array at all. This is the path a
			// batcher takes through `reset()` / context restore.
			const state = makeState();
			state.bind();
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(state.handle);
			gl.getError();

			state.build();

			expect(gl.getError()).toBe(gl.NO_ERROR);
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(state.handle);
			gl.bindVertexArray(null);
			state.destroy();
		});

		it("leaves an unrelated bound state alone when rebuilding", (ctx) => {
			requireWebGL(ctx);
			// the converse: rebuilding a state that is NOT current must not
			// steal the binding from whichever one is
			const current = makeState();
			const other = makeState();
			current.bind();
			gl.getError();

			other.build();

			expect(gl.getError()).toBe(gl.NO_ERROR);
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(current.handle);
			gl.bindVertexArray(null);
			current.destroy();
			other.destroy();
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

	/**
	 * Multi-buffer layouts and per-instance step mode (#1508). A vertex state
	 * may now describe several buffer groups, each with its own buffer,
	 * stride and `stepMode` — the `GPUVertexBufferLayout[]` shape. These pin
	 * the new axis AND that the single-buffer path is untouched by it, which
	 * matters because every GL batcher depends on this class.
	 */
	describe("multi-buffer layouts and instance step mode", () => {
		// a per-instance record: a row-major 3x4 transform (3 x vec4)
		const INSTANCE_STRIDE = 48;
		const INSTANCE_ATTRIBUTES = [
			{ name: "aInstanceRow0", size: 4, type: 0, normalized: false, offset: 0 },
			{
				name: "aInstanceRow1",
				size: 4,
				type: 0,
				normalized: false,
				offset: 16,
			},
			{
				name: "aInstanceRow2",
				size: 4,
				type: 0,
				normalized: false,
				offset: 32,
			},
		];

		const allLocations = (name) => {
			return (
				{
					aVertex: 0,
					aRegion: 1,
					aColor: 2,
					aInstanceRow0: 3,
					aInstanceRow1: 4,
					aInstanceRow2: 5,
				}[name] ?? -1
			);
		};

		const makeBuffer = () => {
			const previous = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(600), gl.STREAM_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, previous);
			return buffer;
		};

		// geometry group + instance group, the InstancedMesh shape
		const makeInstanced = (overrides = {}) => {
			for (const attr of INSTANCE_ATTRIBUTES) {
				attr.type = gl.FLOAT;
			}
			const geometryBuffer = makeBuffer();
			const instanceBuffer = makeBuffer();
			const state = new WebGLVertexState(gl, {
				buffers: [
					{
						buffer: geometryBuffer,
						stride: STRIDE,
						attributes: ATTRIBUTES,
					},
					{
						buffer: instanceBuffer,
						stride: INSTANCE_STRIDE,
						stepMode: "instance",
						attributes: INSTANCE_ATTRIBUTES,
					},
				],
				resolveLocation: allLocations,
				...overrides,
			});
			return { state, geometryBuffer, instanceBuffer };
		};

		it("the single-buffer shape issues NO vertexAttribDivisor at all", (ctx) => {
			requireWebGL(ctx);
			// the regression pin: the ordinary path must be byte-identical to
			// what it was before instancing existed. A fresh vertex array
			// already has every divisor at 0, so the calls are not merely
			// redundant — issuing them would be a behaviour change.
			const spy = vi.spyOn(gl, "vertexAttribDivisor");
			try {
				const state = makeState();
				expect(spy).not.toHaveBeenCalled();
				state.bind();
				for (const attr of ATTRIBUTES) {
					expect(
						gl.getVertexAttrib(
							fixedLocations(attr.name),
							gl.VERTEX_ATTRIB_ARRAY_DIVISOR,
						),
						attr.name,
					).toBe(0);
				}
				gl.bindVertexArray(null);
				state.destroy();
			} finally {
				spy.mockRestore();
			}
		});

		it("applies the divisor to instance-step attributes only", (ctx) => {
			requireWebGL(ctx);
			const { state, geometryBuffer, instanceBuffer } = makeInstanced();
			state.bind();
			// geometry group advances per vertex
			for (const attr of ATTRIBUTES) {
				expect(
					gl.getVertexAttrib(
						allLocations(attr.name),
						gl.VERTEX_ATTRIB_ARRAY_DIVISOR,
					),
					attr.name,
				).toBe(0);
			}
			// instance group advances per instance
			for (const attr of INSTANCE_ATTRIBUTES) {
				const loc = allLocations(attr.name);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_DIVISOR),
					attr.name,
				).toBe(1);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
					attr.name,
				).toBe(true);
			}
			expect(gl.getError()).toBe(gl.NO_ERROR);
			gl.bindVertexArray(null);
			state.destroy();
			gl.deleteBuffer(geometryBuffer);
			gl.deleteBuffer(instanceBuffer);
		});

		it("each group's attributes read from that group's own buffer and stride", (ctx) => {
			requireWebGL(ctx);
			// adversarial: both groups declare an attribute at offset 0, so a
			// build that bound only one buffer would silently cross-read
			const { state, geometryBuffer, instanceBuffer } = makeInstanced();
			state.bind();
			expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(
				geometryBuffer,
			);
			expect(gl.getVertexAttrib(3, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(
				instanceBuffer,
			);
			// and each carries its own stride, not the other's
			expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).toBe(STRIDE);
			expect(gl.getVertexAttrib(3, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).toBe(
				INSTANCE_STRIDE,
			);
			// interleaved instance record: offsets within the group resolve
			// against the group's own base
			expect(gl.getVertexAttribOffset(4, gl.VERTEX_ATTRIB_ARRAY_POINTER)).toBe(
				16,
			);
			expect(gl.getVertexAttribOffset(5, gl.VERTEX_ATTRIB_ARRAY_POINTER)).toBe(
				32,
			);
			gl.bindVertexArray(null);
			state.destroy();
			gl.deleteBuffer(geometryBuffer);
			gl.deleteBuffer(instanceBuffer);
		});

		it("divisors never leak into an unrelated vertex state", (ctx) => {
			requireWebGL(ctx);
			// the classic instancing bug. Divisor is vertex-array state and
			// every build creates a fresh array, so this holds by
			// construction — pin it so a future "optimization" that reuses a
			// handle cannot silently reintroduce it.
			const {
				state: instanced,
				geometryBuffer,
				instanceBuffer,
			} = makeInstanced();
			instanced.bind();
			const plain = makeState({ resolveLocation: allLocations });
			plain.bind();
			for (let loc = 0; loc <= 5; loc++) {
				expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)).toBe(0);
			}
			gl.bindVertexArray(null);
			plain.destroy();
			instanced.destroy();
			gl.deleteBuffer(geometryBuffer);
			gl.deleteBuffer(instanceBuffer);
		});

		it("a rebuild re-declares the divisors on the replacement array", (ctx) => {
			requireWebGL(ctx);
			// build() discards the old vertex array; the new one starts with
			// every divisor at 0, so they must be re-issued or the mesh would
			// draw one instance N times on top of itself
			const { state, geometryBuffer, instanceBuffer } = makeInstanced();
			const replacement = makeBuffer();
			state.build({
				buffers: [
					{ buffer: geometryBuffer, stride: STRIDE, attributes: ATTRIBUTES },
					{
						buffer: replacement,
						stride: INSTANCE_STRIDE,
						stepMode: "instance",
						attributes: INSTANCE_ATTRIBUTES,
					},
				],
			});
			state.bind();
			expect(gl.getVertexAttrib(3, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)).toBe(1);
			// only the replaced group was re-pointed
			expect(gl.getVertexAttrib(3, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(
				replacement,
			);
			expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(
				geometryBuffer,
			);
			gl.bindVertexArray(null);
			state.destroy();
			gl.deleteBuffer(geometryBuffer);
			gl.deleteBuffer(instanceBuffer);
			gl.deleteBuffer(replacement);
		});

		it("building a multi-buffer layout leaks none of the bindings it used", (ctx) => {
			requireWebGL(ctx);
			// the existing single-buffer hygiene test, generalized: several
			// buffers are bound during the build now
			const other = makeState();
			const otherBuffer = gl.createBuffer();
			other.bind();
			gl.bindBuffer(gl.ARRAY_BUFFER, otherBuffer);

			const { state, geometryBuffer, instanceBuffer } = makeInstanced();

			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(other.handle);
			expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(otherBuffer);

			gl.bindVertexArray(null);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			state.destroy();
			other.destroy();
			gl.deleteBuffer(otherBuffer);
			gl.deleteBuffer(geometryBuffer);
			gl.deleteBuffer(instanceBuffer);
		});

		it("an undeclared instance attribute is skipped without a bad divisor call", (ctx) => {
			requireWebGL(ctx);
			// vertexAttribDivisor(-1, 1) is INVALID_VALUE — the skip must
			// happen before the divisor, not after
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const divisorSpy = vi.spyOn(gl, "vertexAttribDivisor");
			try {
				const { state, geometryBuffer, instanceBuffer } = makeInstanced({
					resolveLocation: (name) => {
						return name === "aInstanceRow2" ? -1 : allLocations(name);
					},
				});
				for (const call of divisorSpy.mock.calls) {
					expect(call[0]).not.toBe(-1);
				}
				expect(divisorSpy).toHaveBeenCalledTimes(2);
				expect(gl.getError()).toBe(gl.NO_ERROR);
				state.destroy();
				gl.deleteBuffer(geometryBuffer);
				gl.deleteBuffer(instanceBuffer);
			} finally {
				divisorSpy.mockRestore();
				warnSpy.mockRestore();
			}
		});

		it("issues no divisor calls on a lost context", (ctx) => {
			requireWebGL(ctx);
			// every location resolves -1 while the context is lost; the build
			// must stay silent and issue nothing rather than erroring
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const divisorSpy = vi.spyOn(gl, "vertexAttribDivisor");
			const lostSpy = vi.spyOn(gl, "isContextLost").mockReturnValue(true);
			try {
				const { state, geometryBuffer, instanceBuffer } = makeInstanced({
					resolveLocation: () => {
						return -1;
					},
				});
				expect(divisorSpy).not.toHaveBeenCalled();
				expect(warnSpy).not.toHaveBeenCalled();
				state.destroy();
				gl.deleteBuffer(geometryBuffer);
				gl.deleteBuffer(instanceBuffer);
			} finally {
				lostSpy.mockRestore();
				divisorSpy.mockRestore();
				warnSpy.mockRestore();
			}
		});
	});
});
