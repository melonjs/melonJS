import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, event, video, WebGLRenderer } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * VAO recreation across the two buffer-churn flows (#1509): a VAO holding a
 * DELETED buffer keeps it alive per the GL spec and draws stale/dead data —
 * so every buffer-recreation path must rebuild (or re-capture into) the
 * owning vertex state. Pinned flows: plain reset (GAME_RESET) and a real
 * WEBGL_lose_context lose/restore cycle.
 */
describe("WebGL VAO recreation (buffer churn + context loss)", () => {
	let renderer;
	let gl;
	let isWebGL;

	beforeAll(async () => {
		boot();
		await getWebGLRenderer(160, 120);
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
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

	const tick = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	function drawSomething() {
		const tex = document.createElement("canvas");
		tex.width = tex.height = 16;
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
	}

	it("quad batcher: reset() re-captures the recreated static index buffer", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		const oldBuffer = quad.indexBuffer.buffer;

		quad.reset();
		quad.createIndexBuffer();

		// the vertex state must reference the NEW GL buffer
		renderer.setBatcher("primitive"); // move away first
		renderer.setBatcher("quad");
		const bound = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
		expect(bound).toBe(quad.indexBuffer.buffer);
		expect(bound).not.toBe(oldBuffer);

		drawSomething();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("mesh batcher: reset() rebuilds the vertex state against the new buffers", (ctx) => {
		requireWebGL(ctx);
		const mesh = renderer.batchers.get("mesh");
		const oldVao = mesh.vertexState.handle;
		const oldVertexBuffer = mesh.glVertexBuffer;

		mesh.reset();

		// the WebGLVertexState object persists across a rebuild; the GL
		// handle it wraps is replaced
		expect(mesh.vertexState.handle).not.toBe(oldVao);
		expect(gl.isVertexArray(mesh.vertexState.handle)).toBe(true);
		expect(mesh.glVertexBuffer).not.toBe(oldVertexBuffer);

		renderer.setBatcher("mesh");
		expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(
			mesh.vertexState.handle,
		);
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
			mesh.indexBuffer.buffer,
		);
		// attribute pointers reference the NEW vertex buffer
		const loc = mesh.defaultShader.getAttribLocation(mesh.attributes[0].name);
		expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(
			mesh.glVertexBuffer,
		);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("rebuilding a NON-current batcher does not corrupt the current one's uploads", (ctx) => {
		requireWebGL(ctx);
		// regression: `createVertexState()` binds ARRAY_BUFFER (not VAO
		// state) while building. Without restoring it, rebuilding any
		// own-buffer batcher — `meshBatcher.reset()`, or `addBatcher()`
		// mid-scene — left the CURRENT batcher uploading into the wrong
		// buffer while drawing from the old one: vanished geometry, and
		// NO_ERROR to hide it.
		renderer.projectionMatrix.ortho(0, 160, 120, 0, -1, 1);
		renderer.setBatcher("primitive");
		renderer.setBatcher("quad");

		const red = document.createElement("canvas");
		red.width = red.height = 16;
		const r2d = red.getContext("2d");
		r2d.fillStyle = "rgb(255,0,0)";
		r2d.fillRect(0, 0, 16, 16);

		renderer.clearColor("#000000ff");
		renderer.drawImage(red, 0, 0, 16, 16, 4, 60, 16, 16);
		renderer.flush();

		// rebuild another batcher's vertex state while quad is current
		renderer.batchers.get("mesh").reset();

		// draw at a DIFFERENT spot in a DIFFERENT colour, so stale contents
		// of the previous upload cannot masquerade as success
		const green = document.createElement("canvas");
		green.width = green.height = 16;
		const g2d = green.getContext("2d");
		g2d.fillStyle = "rgb(0,255,0)";
		g2d.fillRect(0, 0, 16, 16);

		renderer.clearColor("#000000ff");
		renderer.drawImage(green, 0, 0, 16, 16, 100, 20, 16, 16);
		renderer.flush();

		const px = new Uint8Array(4);
		gl.readPixels(
			108,
			gl.drawingBufferHeight - 1 - 28,
			1,
			1,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			px,
		);
		expect(px[1], "green quad after foreign rebuild").toBeGreaterThan(200);
		expect(px[0], "green quad after foreign rebuild").toBeLessThan(60);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("a real lose/restore cycle leaves every vertex state valid and drawable", async (ctx) => {
		requireWebGL(ctx);
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		drawSomething();

		const restored = new Promise((resolve) => {
			event.once(event.ONCONTEXT_RESTORED, resolve);
		});
		ext.loseContext();
		await tick();
		ext.restoreContext();
		await restored;
		await tick();

		for (const [name, batcher] of renderer.batchers) {
			expect(gl.isVertexArray(batcher.vertexState.handle), name).toBe(true);
		}
		drawSomething();
		renderer.strokeRect(2, 2, 20, 12);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});
});
