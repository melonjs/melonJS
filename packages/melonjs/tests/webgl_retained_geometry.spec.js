import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";
import RetainedGeometry from "../src/video/webgl/buffer/retained_geometry.js";

/**
 * Unit tests for {@link RetainedGeometry} — the persistent per-mesh vertex
 * buffer, index buffer and vertex state behind retained-mode mesh rendering
 * (issue #1507).
 *
 * `webgl_mesh_retained.spec.js` covers the behaviour through `Mesh.draw`;
 * this covers the class directly, including the cases the integration tests
 * can't easily reach — 32-bit index promotion, idempotent teardown, and the
 * binding-leak guard.
 */
describe("RetainedGeometry (issue #1507)", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		await boot();
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.WEBGL,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (
			video.renderer instanceof WebGLRenderer &&
			typeof video.renderer.gl !== "undefined"
		) {
			renderer = video.renderer;
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		try {
			video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore — nothing to restore if init never succeeded
		}
	});

	const requireWebGL2 = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	/**
	 * Borrow the live mesh batcher's layout so attribute locations resolve
	 * against a real compiled shader. Deliberately no fallback stub: if the
	 * batcher ever stops being reachable here, these tests should fail rather
	 * than quietly start exercising a made-up layout.
	 */
	const makeGeometry = () => {
		const batcher = renderer.batchers.get("mesh");
		expect(batcher, 'mesh batcher not registered as "mesh"').toBeDefined();
		return new RetainedGeometry(
			gl,
			batcher.attributes,
			batcher.stride,
			(name) => {
				return batcher.defaultShader.getAttribLocation(name);
			},
		);
	};

	const floats = (n) => {
		const a = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			a[i] = i;
		}
		return a;
	};

	it("allocates its own buffers and vertex state", (ctx) => {
		requireWebGL2(ctx);
		const geometry = makeGeometry();
		try {
			expect(geometry.vertexBuffer).not.toBeNull();
			expect(geometry.glIndexBuffer).not.toBeNull();
			expect(geometry.vertexState).toBeDefined();
			// nothing uploaded yet, so no version can match
			expect(geometry.uploadedVersion).toBe(-1);
			expect(geometry.indexCount).toBe(0);
		} finally {
			geometry.destroy();
		}
	});

	it("records the uploaded version, index count and 16-bit index type", (ctx) => {
		requireWebGL2(ctx);
		const geometry = makeGeometry();
		try {
			geometry.upload(floats(64), 64, new Uint16Array([0, 1, 2]), 7);
			expect(geometry.uploadedVersion).toBe(7);
			expect(geometry.indexCount).toBe(3);
			expect(geometry.indexType).toBe(gl.UNSIGNED_SHORT);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		} finally {
			geometry.destroy();
		}
	});

	it("keeps 32-bit indices wide instead of narrowing them", (ctx) => {
		requireWebGL2(ctx);
		const geometry = makeGeometry();
		try {
			// a Uint32Array stays wide even when its values would fit in 16 bits
			geometry.upload(floats(64), 64, new Uint32Array([0, 1, 2]), 1);
			expect(geometry.indexType).toBe(gl.UNSIGNED_INT);

			// and a plain array is promoted based on its values — narrowing
			// index 70 000 to 16 bits would silently draw the wrong triangle
			geometry.upload(floats(64), 64, [0, 1, 70000], 2);
			expect(geometry.indexType).toBe(gl.UNSIGNED_INT);

			// ...but a small plain array stays compact
			geometry.upload(floats(64), 64, [0, 1, 2], 3);
			expect(geometry.indexType).toBe(gl.UNSIGNED_SHORT);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		} finally {
			geometry.destroy();
		}
	});

	it("uploads only the floats in use, as a byte view", (ctx) => {
		requireWebGL2(ctx);
		const geometry = makeGeometry();
		const orig = gl.bufferData.bind(gl);
		let uploaded = null;
		gl.bufferData = (target, data, usage) => {
			if (target === gl.ARRAY_BUFFER) {
				uploaded = data;
			}
			return orig(target, data, usage);
		};
		try {
			// a scratch buffer is reused across meshes and is sized for the
			// largest, so uploading all of it would send stale trailing data
			geometry.upload(floats(1024), 12, new Uint16Array([0, 1, 2]), 1);
			expect(uploaded.byteLength).toBe(12 * Float32Array.BYTES_PER_ELEMENT);
			// same discipline as the batchers' own uploads: some drivers
			// canonicalize NaN bit patterns on a float upload, which would
			// corrupt packed colour values
			expect(uploaded).toBeInstanceOf(Uint8Array);
			expect(uploaded).not.toBeInstanceOf(Float32Array);
		} finally {
			gl.bufferData = orig;
			geometry.destroy();
		}
	});

	it("re-uploads in place, keeping its buffer handles", (ctx) => {
		requireWebGL2(ctx);
		const geometry = makeGeometry();
		try {
			geometry.upload(floats(64), 64, new Uint16Array([0, 1, 2]), 1);
			const vbo = geometry.vertexBuffer;
			const ibo = geometry.glIndexBuffer;
			const state = geometry.vertexState;

			geometry.upload(floats(128), 128, new Uint16Array([0, 1, 2, 0, 2, 3]), 2);
			// the vertex state points at these handles, so replacing them would
			// mean rebuilding it too — the data is replaced, the objects aren't
			expect(geometry.vertexBuffer).toBe(vbo);
			expect(geometry.glIndexBuffer).toBe(ibo);
			expect(geometry.vertexState).toBe(state);
			expect(geometry.indexCount).toBe(6);
			expect(geometry.uploadedVersion).toBe(2);
		} finally {
			geometry.destroy();
		}
	});

	it("does not leak the vertex-array or index-buffer binding", (ctx) => {
		requireWebGL2(ctx);
		// uploading into a fresh geometry must not disturb whatever was
		// current — the bug class that made a non-current batcher's rebuild
		// silently corrupt the current batcher's uploads
		const other = makeGeometry();
		other.upload(floats(64), 64, new Uint16Array([0, 1, 2]), 1);
		other.bind();
		const boundArrayObject = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
		const boundIndex = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);

		const geometry = makeGeometry();
		try {
			geometry.upload(floats(64), 64, new Uint16Array([0, 1, 2]), 1);
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(boundArrayObject);
			expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(boundIndex);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		} finally {
			geometry.destroy();
			other.destroy();
			gl.bindVertexArray(null);
		}
	});

	it("destroy() releases everything and is safe to repeat", (ctx) => {
		requireWebGL2(ctx);
		const geometry = makeGeometry();
		geometry.upload(floats(64), 64, new Uint16Array([0, 1, 2]), 1);
		geometry.destroy();

		expect(geometry.vertexBuffer).toBeNull();
		expect(geometry.glIndexBuffer).toBeNull();
		expect(geometry.vertexState).toBeNull();
		expect(geometry.indexCount).toBe(0);
		// a stale version would let a rebuilt geometry skip its first upload
		expect(geometry.uploadedVersion).toBe(-1);

		// context loss and explicit disposal can both land on the same object
		expect(() => {
			return geometry.destroy();
		}).not.toThrow();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});
});
