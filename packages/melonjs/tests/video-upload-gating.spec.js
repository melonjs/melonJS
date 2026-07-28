import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";

/**
 * WebGL upload gating for video texture sources.
 *
 * `WebGLRenderer.drawImage` historically force-re-uploaded any source with a
 * `videoWidth` on every call. When a Sprite tracks the element via
 * requestVideoFrameCallback it stamps a monotonic `version` counter on it —
 * drawImage then re-uploads only when the version changed since the last
 * upload (recorded per cached atlas), and just re-binds otherwise. Sources
 * without the stamp (no rVFC support, manual drawImage callers) keep the
 * legacy per-frame re-upload.
 *
 * A real video element with actual frames isn't reliable in a headless
 * runner, so the specs use an uploadable canvas duck-typed as a video
 * (`videoWidth`/`videoHeight` grafted on) — the gate only looks at those
 * properties, and texImage2D accepts a canvas.
 */

function makeVideoLikeCanvas(w, h) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	canvas.videoWidth = w;
	canvas.videoHeight = h;
	return canvas;
}

describe("Video texture upload gating (WebGL)", () => {
	let webglReady = false;

	beforeAll(() => {
		boot();
		try {
			video.init(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.WEBGL,
				failIfMajorPerformanceCaveat: false,
			});
			webglReady = video.renderer instanceof WebGLRenderer;
		} catch {
			// CI runners without GL acceleration can't construct a WebGL
			// renderer; the tests below mark themselves skipped at runtime.
		}
	});

	afterAll(() => {
		// hand the world back to the default renderer for any later test files
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	const requireWebGL = (ctx) => {
		if (!webglReady) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// count createTexture2D calls (actual texImage2D uploads) on the quad
	// batcher while fn runs; restores the prototype method afterwards
	function countUploads(fn) {
		const quad = video.renderer.batchers.get("quad");
		const proto = Object.getPrototypeOf(quad);
		let uploads = 0;
		quad.createTexture2D = function (...args) {
			uploads++;
			return proto.createTexture2D.apply(this, args);
		};
		try {
			fn();
		} finally {
			delete quad.createTexture2D;
		}
		return uploads;
	}

	it("unversioned video sources keep the legacy per-frame re-upload", (ctx) => {
		requireWebGL(ctx);
		const renderer = video.renderer;
		const src = makeVideoLikeCanvas(32, 32);

		const uploads = countUploads(() => {
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
		});
		expect(uploads).toBe(2);
	});

	it("versioned video sources upload once per presented frame", (ctx) => {
		requireWebGL(ctx);
		const renderer = video.renderer;
		const src = makeVideoLikeCanvas(32, 32);
		src.version = 0;

		const uploads = countUploads(() => {
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
			// same frame (e.g. a second sprite sharing the element, or a
			// 60Hz tick between 30fps video frames) → bind only, no upload
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
			// new frame presented
			src.version++;
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
		});
		expect(uploads).toBe(2);
	});

	it("a texture-unit cache reset re-uploads even with an unchanged version", (ctx) => {
		requireWebGL(ctx);
		const renderer = video.renderer;
		const src = makeVideoLikeCanvas(32, 32);
		src.version = 0;

		const uploads = countUploads(() => {
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
			// eviction safety: the version gate must not survive a unit
			// reassignment — the batcher's per-unit bookkeeping was cleared,
			// so the (recreated) GL texture needs actual pixels again
			renderer.cache.resetUnitAssignments();
			renderer.drawImage(src, 0, 0, 32, 32, 0, 0, 32, 32);
		});
		expect(uploads).toBe(2);
	});
});
