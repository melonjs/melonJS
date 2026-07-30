import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, Matrix3d, Mesh, video, WebGLRenderer } from "../src/index.js";

/**
 * Retained-mode mesh rendering (issue #1507).
 *
 * The mesh path used to be immediate-mode: every frame, every mesh baked its
 * transform into every vertex on the CPU, the batcher rebuilt the interleaved
 * stream, and the whole thing was re-uploaded with `STREAM_DRAW`. A model that
 * never changed paid all of that sixty times a second.
 *
 * Now geometry lives on the GPU in **model space** and placement is carried by
 * uniforms (`uModelMatrix` / `uViewMatrix` / `uTint`). Moving, rotating,
 * scaling or re-tinting a mesh therefore touches no buffer at all, and the
 * geometry is rewritten only when the mesh says so by bumping its version.
 *
 * That claim is what these tests pin, and they pin it by counting GL calls
 * rather than by timing frames: call counts are exact and reproducible in CI,
 * whereas a headless software rasterizer's frame times mean nothing. The
 * headline assertion is scenario 1 — **zero** `bufferData` calls and **zero**
 * CPU vertex projections on every frame after the first.
 *
 * Skips (visibly, via `ctx.skip`) when WebGL2 is unavailable.
 */
describe("Retained-mode mesh rendering (issue #1507)", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.WEBGL,
				// headless Chromium's software GL backend trips the "major
				// performance caveat" flag; without this opt-out the renderer
				// silently falls back to Canvas and every test here skips
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
		}
	});

	afterAll(() => {
		try {
			video.init(128, 128, { parent: "screen", renderer: video.AUTO });
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
	 * A real `Mesh` (not a duck-typed POJO — the retained path is driven from
	 * `Mesh.draw`, so the test has to go through it) shaped as a single quad
	 * in model space, centred on its own origin.
	 */
	const makeMesh = (half = 24) => {
		const mesh = new Mesh(0, 0, {
			vertices: [
				-half,
				-half,
				0, // 0: top-left
				half,
				-half,
				0, // 1: top-right
				half,
				half,
				0, // 2: bottom-right
				-half,
				half,
				0, // 3: bottom-left
			],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			// geometry is normalized to a unit box on construction, so world
			// size comes from here — without it `meshScale` is 0 and the model
			// matrix collapses
			width: half * 2,
			height: half * 2,
		});
		mesh.pos.set(64, 64, 0);
		// force the world-space (Camera3d) branch without needing a live stage
		mesh._useWorldSpace = true;
		// culling is exercised on its own below; here it would only decide
		// whether this particular authored winding happens to face the camera
		mesh.cullBackFaces = false;
		return mesh;
	};

	/**
	 * Count the GL traffic that matters for the retained claim, plus the CPU
	 * projection the retained path is supposed to make unnecessary.
	 */
	const spy = () => {
		const gl = renderer.gl;
		const calls = {
			arrayUploads: 0,
			elementUploads: 0,
			drawElements: 0,
			createBuffer: 0,
			deleteBuffer: 0,
		};
		const origBufferData = gl.bufferData.bind(gl);
		const origDraw = gl.drawElements.bind(gl);
		const origCreate = gl.createBuffer.bind(gl);
		const origDelete = gl.deleteBuffer.bind(gl);
		gl.bufferData = (target, ...rest) => {
			if (target === gl.ARRAY_BUFFER) {
				calls.arrayUploads++;
			} else if (target === gl.ELEMENT_ARRAY_BUFFER) {
				calls.elementUploads++;
			}
			return origBufferData(target, ...rest);
		};
		gl.drawElements = (...args) => {
			calls.drawElements++;
			return origDraw(...args);
		};
		gl.createBuffer = () => {
			calls.createBuffer++;
			return origCreate();
		};
		gl.deleteBuffer = (buf) => {
			calls.deleteBuffer++;
			return origDelete(buf);
		};
		const project = vi.spyOn(Mesh.prototype, "_projectVerticesWorld");
		const restore = () => {
			gl.bufferData = origBufferData;
			gl.drawElements = origDraw;
			gl.createBuffer = origCreate;
			gl.deleteBuffer = origDelete;
			project.mockRestore();
		};
		return { calls, project, restore };
	};

	/**
	 * Map the 128x128 canvas 1:1 onto clip space. A bare renderer harness
	 * leaves `projectionMatrix` at identity, which would put every vertex
	 * below far outside the frustum and quietly render nothing at all.
	 */
	const setupOrthoProjection = () => {
		const proj = new Matrix3d();
		proj.ortho(0, 128, 128, 0, -1000, 1000);
		renderer.setProjection(proj);
	};

	/**
	 * Draw one mesh the way a container would: `preDraw` is what publishes
	 * tint and alpha to the renderer, so a bare `draw()` would silently test
	 * an untinted mesh. `Mesh` sets `autoTransform = false`, so this does not
	 * also push the mesh's own transform — that stays the model matrix's job.
	 */
	const drawOne = (mesh) => {
		renderer.save();
		mesh.preDraw(renderer);
		mesh.draw(renderer);
		mesh.postDraw(renderer);
		renderer.restore();
	};

	/** Clear, draw one frame, and force it out to the GPU. */
	const frame = (mesh) => {
		renderer.clearColor("#000000");
		setupOrthoProjection();
		drawOne(mesh);
		renderer.flush();
	};

	const centrePixel = () => {
		const gl = renderer.gl;
		const px = new Uint8Array(4);
		gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return Array.from(px);
	};

	it("uploads geometry once, then draws from VRAM with zero re-uploads", (ctx) => {
		requireWebGL2(ctx);
		const mesh = makeMesh();
		const { calls, project, restore } = spy();
		try {
			frame(mesh);
			// frame 1 primes the GPU: one vertex upload + one index upload
			expect(calls.arrayUploads).toBe(1);
			expect(calls.elementUploads).toBe(1);
			expect(calls.drawElements).toBe(1);

			const after = { ...calls };
			for (let i = 0; i < 10; i++) {
				frame(mesh);
			}
			// ...and every frame after it touches no buffer at all
			expect(calls.arrayUploads).toBe(after.arrayUploads);
			expect(calls.elementUploads).toBe(after.elementUploads);
			expect(calls.drawElements).toBe(after.drawElements + 10);
			// the CPU-side per-vertex transform is gone entirely
			expect(project).not.toHaveBeenCalled();
		} finally {
			restore();
			mesh.destroy();
		}
	});

	it("moving, rotating and scaling a mesh costs no upload", (ctx) => {
		requireWebGL2(ctx);
		const mesh = makeMesh();
		try {
			frame(mesh);
			const { calls, restore } = spy();
			try {
				const before = centrePixel();
				mesh.pos.set(20, 20, 0);
				mesh.currentTransform.rotate(0.4).scale(1.7, 1.7);
				frame(mesh);
				expect(calls.arrayUploads).toBe(0);
				expect(calls.elementUploads).toBe(0);
				// the transform genuinely reached the GPU, it just did so as a
				// uniform — the mesh moved off the centre pixel
				expect(centrePixel()).not.toEqual(before);
			} finally {
				restore();
			}
		} finally {
			mesh.destroy();
		}
	});

	it("re-tinting and fading a mesh costs no upload", (ctx) => {
		requireWebGL2(ctx);
		const mesh = makeMesh();
		try {
			frame(mesh);
			const before = centrePixel();
			const { calls, restore } = spy();
			try {
				mesh.tint.setColor(255, 0, 0);
				mesh.setOpacity(0.5);
				frame(mesh);
				expect(calls.arrayUploads).toBe(0);
				expect(calls.elementUploads).toBe(0);
				expect(centrePixel()).not.toEqual(before);
			} finally {
				restore();
			}
		} finally {
			mesh.destroy();
		}
	});

	it("needsUpdate re-uploads exactly once and changes what is drawn", (ctx) => {
		requireWebGL2(ctx);
		const mesh = makeMesh();
		try {
			frame(mesh);
			const before = centrePixel();
			const { calls, restore } = spy();
			try {
				// collapse the quad to a sliver away from the centre pixel
				mesh.originalVertices.fill(0);
				mesh.needsUpdate = true;
				frame(mesh);
				expect(calls.arrayUploads).toBe(1);
				expect(centrePixel()).not.toEqual(before);

				// the flag is consumed, not sticky
				frame(mesh);
				frame(mesh);
				expect(calls.arrayUploads).toBe(1);
			} finally {
				restore();
			}
		} finally {
			mesh.destroy();
		}
	});

	it("draws a mesh past 65 535 vertices in a single call", (ctx) => {
		requireWebGL2(ctx);
		// 30 000 quads = 120 000 vertices, comfortably past the 16-bit index
		// ceiling that used to force the batcher to split into chunks
		const quads = 30000;
		const verts = new Float32Array(quads * 4 * 3);
		const uvs = new Float32Array(quads * 4 * 2);
		const indices = new Uint32Array(quads * 6);
		for (let q = 0; q < quads; q++) {
			const base = q * 4;
			for (let c = 0; c < 4; c++) {
				verts[(base + c) * 3] = (c === 1 || c === 2 ? 1 : -1) * 24;
				verts[(base + c) * 3 + 1] = (c >= 2 ? 1 : -1) * 24;
			}
			const i = q * 6;
			indices.set([base, base + 1, base + 2, base, base + 2, base + 3], i);
		}
		const mesh = new Mesh(0, 0, {
			vertices: verts,
			uvs,
			indices,
			width: 48,
			height: 48,
		});
		mesh.pos.set(64, 64, 0);
		mesh._useWorldSpace = true;
		const { calls, restore } = spy();
		try {
			frame(mesh);
			expect(mesh.vertexCount).toBeGreaterThan(65535);
			// one call, not one per 16-bit chunk
			expect(calls.drawElements).toBe(1);
		} finally {
			restore();
			mesh.destroy();
		}
	});

	it("culls identically to the legacy path on both winding bridges", (ctx) => {
		requireWebGL2(ctx);
		// The reflection bridge (Y-negate, e.g. an OBJ model) inverts winding.
		// The legacy path compensated with a reversed copy of every index; the
		// retained path uploads the authored order and flips `frontFace`
		// instead. Those are the same operation, and this is the proof: for
		// both bridges and both authored windings, the two paths must agree
		// pixel-for-pixel about what survives culling.
		const litPixels = () => {
			const gl = renderer.gl;
			const buf = new Uint8Array(128 * 128 * 4);
			gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, buf);
			let n = 0;
			for (let i = 0; i < 128 * 128; i++) {
				if (buf[i * 4] || buf[i * 4 + 1] || buf[i * 4 + 2]) {
					n++;
				}
			}
			return n;
		};
		const drawCulled = (rightHanded, reversed) => {
			const mesh = makeMesh();
			mesh.cullBackFaces = true;
			mesh.rightHanded = rightHanded;
			if (reversed) {
				mesh._indicesOriginal.reverse();
			}
			frame(mesh);
			const lit = litPixels();
			mesh.destroy();
			return lit;
		};

		let anyVisible = 0;
		for (const rightHanded of [false, true]) {
			for (const reversed of [false, true]) {
				const retained = drawCulled(rightHanded, reversed);
				renderer.supportsRetainedMesh = false;
				let legacy;
				try {
					legacy = drawCulled(rightHanded, reversed);
				} finally {
					renderer.supportsRetainedMesh = true;
				}
				expect(
					retained,
					`rightHanded: ${rightHanded}, reversed: ${reversed}`,
				).toBe(legacy);
				anyVisible += retained;
			}
		}
		// guard against the whole matrix passing vacuously on an empty frame
		expect(anyVisible).toBeGreaterThan(0);
	});

	it("destroy() releases the GPU geometry it allocated", (ctx) => {
		requireWebGL2(ctx);
		const mesh = makeMesh();
		const survivor = makeMesh();
		frame(mesh);
		frame(survivor);
		const { calls, restore } = spy();
		try {
			mesh.destroy();
			// vertex buffer + index buffer, at minimum
			expect(calls.deleteBuffer).toBeGreaterThanOrEqual(2);
			expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);

			// releasing one mesh's geometry must not disturb another's
			calls.arrayUploads = 0;
			frame(survivor);
			expect(calls.arrayUploads).toBe(0);
			expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
		} finally {
			restore();
			survivor.destroy();
		}
	});

	it("restores batcher state so a following dynamic mesh still renders", (ctx) => {
		requireWebGL2(ctx);
		// the classic vertex-array leak: a retained draw binds its own vertex
		// state, and if it doesn't hand the batcher's own state back, the next
		// accumulating flush reads from the wrong buffer
		const retained = makeMesh();
		const dynamic = makeMesh();
		dynamic._useWorldSpace = false;
		try {
			frame(retained);
			renderer.clearColor("#000000");
			dynamic.pos.set(64, 64, 0);
			frame(dynamic);
			expect(centrePixel()[3]).toBeGreaterThan(0);
			expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
		} finally {
			retained.destroy();
			dynamic.destroy();
		}
	});

	it("resolves depth per pixel regardless of draw order", (ctx) => {
		requireWebGL2(ctx);
		// Placement moved from the vertex data to a uniform, so this checks the
		// depth written by the shader still reflects `depth` — and that it wins
		// over draw order, which is what the shared depth buffer buys.
		const near = makeMesh();
		const far = makeMesh();
		// under this ortho (near = -1000, far = +1000) the z axis maps so that
		// a LARGER `depth` is closer to the camera — don't "correct" these
		// signs without re-deriving the projection
		near.depth = 50;
		far.depth = -50;
		near.tint.setColor(255, 0, 0);
		far.tint.setColor(0, 0, 255);
		try {
			// painter-correct order: far first
			renderer.clearColor("#000000");
			setupOrthoProjection();
			drawOne(far);
			drawOne(near);
			renderer.flush();
			const painterOrder = centrePixel();
			expect(painterOrder[0]).toBeGreaterThan(painterOrder[2]);

			// painter-wrong order: the near mesh is drawn first and must still
			// own the pixel, because the GPU depth test rejects the far one
			renderer.clearColor("#000000");
			setupOrthoProjection();
			drawOne(near);
			drawOne(far);
			renderer.flush();
			const reverseOrder = centrePixel();
			expect(reverseOrder[0]).toBeGreaterThan(reverseOrder[2]);
		} finally {
			near.destroy();
			far.destroy();
		}
	});
	it("warns once when a mesh shader declares no placement uniforms", (ctx) => {
		requireWebGL2(ctx);
		// geometry is model-space now, so a shader carried over from before
		// this change draws the mesh unplaced and without the camera — which
		// looks like the model disappearing, not like an error
		const batcher = renderer.batchers.get("mesh");
		// -1 from `getAttribLocation` means "not declared", which the base
		// attribute check allows — so only the placement-uniform warning fires
		const fakeShader = (uniforms) => {
			return {
				uniforms,
				getAttribLocation: () => {
					return -1;
				},
			};
		};
		const legacyShader = fakeShader({ uProjectionMatrix: {} });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			batcher.validateShaderLocations(legacyShader);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain("uModelMatrix");

			// once per shader, not once per frame
			batcher.validateShaderLocations(legacyShader);
			expect(warn).toHaveBeenCalledTimes(1);

			// a shader that does declare them is silent
			warn.mockClear();
			batcher.validateShaderLocations(
				fakeShader({
					uProjectionMatrix: {},
					uViewMatrix: {},
					uModelMatrix: {},
				}),
			);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	// deliberately last: losing the context leaves it unusable for a while
	// afterwards, so any pixel assertion that followed would read an empty
	// framebuffer and fail for reasons that have nothing to do with it
	it("survives a context-loss cycle by rebuilding lazily", (ctx) => {
		requireWebGL2(ctx);
		const gl = renderer.gl;
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context unavailable");
		}
		const mesh = makeMesh();
		try {
			frame(mesh);
			ext.loseContext();
			ext.restoreContext();
			// the restore is asynchronous in some drivers; drawing into a
			// still-lost context must not throw either way
			expect(() => {
				return frame(mesh);
			}).not.toThrow();
		} finally {
			mesh.destroy();
		}
	});
});
