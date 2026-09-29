/**
 * `hdrOutput` — presenting in the display's full range.
 *
 * The distinction this file exists to keep straight: `hdr` is headroom
 * THROUGH the effect chain, which still ends in a clamp because the surface
 * the browser presents is 8 bits per channel. `hdrOutput` changes that
 * surface, so values above 1 reach the compositor instead.
 *
 * It is WebGPU-only, and not by choice. The WebGL2 equivalent needs
 * `drawingBufferToneMapping`, an unapproved specification change that no
 * browser implements; its colour-space half exists behind a browser flag,
 * which a shipped game cannot rely on. So the same machine answers
 * differently per backend, and that asymmetry is the thing to pin down.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WebGPURenderer } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

describe("hdrOutput — WebGL2 refuses, out loud", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	afterEach(() => {
		renderer?.setHDROutput(false);
		if (renderer !== undefined) {
			renderer._hdrOutputRefusalWarned = false;
		}
	});

	it("records the request and refuses the grant", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			renderer.setHDROutput(true);
			// asking is not getting, and the two stay distinguishable
			expect(renderer.settings.hdrOutput).toBe(true);
			expect(renderer.supportsHDROutput).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0][0])).toContain("hdrOutput");
		} finally {
			warn.mockRestore();
		}
	});

	it("says it once, not on every toggle", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			renderer.setHDROutput(true);
			renderer.setHDROutput(false);
			renderer.setHDROutput(true);
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});

	it("leaves the drawing buffer alone", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the WebGL2 path must be byte-identical to what shipped before this
		// setting existed, whatever is asked of it
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const before = renderer.gl.drawingBufferColorSpace;
			renderer.setHDROutput(true);
			expect(renderer.gl.drawingBufferColorSpace).toBe(before);
		} finally {
			warn.mockRestore();
			releaseWebGLRenderer();
		}
	});
});

describe("hdrOutput — WebGPU, without a device", () => {
	/**
	 * The shipped resolver driven against the prototype. The integration
	 * suites skip wherever WebGPU is unavailable, which is most CI and this
	 * runner, so on their own they would prove nothing where they actually
	 * run.
	 */
	const bare = (settings = {}) => {
		const renderer = Object.create(WebGPURenderer.prototype);
		renderer.settings = { hdr: true, hdrOutput: false, ...settings };
		renderer.supportsHDR = settings.hdr !== false;
		renderer.preferredFormat = "bgra8unorm";
		renderer.device = {};
		renderer.configured = [];
		renderer.context = {
			configure(descriptor) {
				renderer.configured.push(descriptor);
			},
		};
		return renderer;
	};

	it("presents 8-bit and standard when it is off", () => {
		const renderer = bare();
		renderer.setHDROutput(false);
		expect(renderer.supportsHDROutput).toBe(false);
		expect(renderer.canvasFormat).toBe("bgra8unorm");
		const last = renderer.configured.at(-1);
		expect(last.format).toBe("bgra8unorm");
		// "standard" is what every frame got before this setting existed
		expect(last.toneMapping).toEqual({ mode: "standard" });
	});

	it("presents half-float and extended when it is granted", () => {
		const renderer = bare();
		renderer.setHDROutput(true);
		expect(renderer.supportsHDROutput).toBe(true);
		expect(renderer.canvasFormat).toBe("rgba16float");
		const last = renderer.configured.at(-1);
		// BOTH halves. An 8-bit unorm surface cannot hold a value above 1
		// whatever the mode says, and "standard" clamps whatever the format
		// is — either on its own presents SDR.
		expect(last.format).toBe("rgba16float");
		expect(last.toneMapping).toEqual({ mode: "extended" });
	});

	it("refuses without hdr, because there would be nothing to present", () => {
		// the last pass blits from the camera's target; if that is 8-bit
		// there is nothing above 1 left, and the extra cost buys an
		// identical picture
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const renderer = bare({ hdr: false });
			renderer.setHDROutput(true);
			expect(renderer.settings.hdrOutput).toBe(true);
			expect(renderer.supportsHDROutput).toBe(false);
			expect(renderer.canvasFormat).toBe("bgra8unorm");
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});

	it("follows hdr being turned off under it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const renderer = bare();
			renderer.setHDROutput(true);
			expect(renderer.supportsHDROutput).toBe(true);

			// `setHDR` reconfigures the surface too: output cannot outlive
			// the headroom it presents
			renderer._resolveColorFormat = () => {
				renderer.supportsHDR = false;
			};
			renderer.setHDR(false);
			expect(renderer.supportsHDROutput).toBe(false);
			expect(renderer.canvasFormat).toBe("bgra8unorm");
			expect(renderer.configured.at(-1).toneMapping).toEqual({
				mode: "standard",
			});
		} finally {
			warn.mockRestore();
		}
	});

	it("says nothing to a game that never asked", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const renderer = bare();
			renderer.setHDROutput(false);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});
});
