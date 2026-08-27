import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
// imported for its side effect of resolving the module graph before the
// renderer is pulled in directly — the same ordering `webgpu_post_effect_flow`
// relies on, without which the deep import hits a cycle
import "../src/index.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";

/**
 * The advanced-blend BRACKET on WebGPU, exercised through the REAL prototype
 * methods (`setBatcher`, `_openAdvancedBlend`, `_closeAdvancedBlend`,
 * `setBlendMode`, `flush`) on a bare renderer whose GPU-facing primitives
 * record into a log.
 *
 * This exists because headless chromium has no WebGPU: the pixel suite in
 * `blend-modes-conformance.spec.js` runs the WebGL backend only, so without
 * this file the entire WebGPU half of the feature would ship on code review.
 * Pixels are out of reach here, but the ordering laws the backend depends on
 * are not, and they are where the bracket actually goes wrong: capture BEFORE
 * the redirect, composite BEFORE `queue.submit`, the parent target restored
 * rather than the canvas assumed, and the re-entrancy guard holding across
 * every internal `setBatcher` caller.
 *
 * The WebGL twin of these laws is pinned by pixel tests instead — a bracket
 * that composited after the submit would simply render nothing there.
 */
describe("WebGPU advanced-blend bracket (recorded primitives)", () => {
	let renderer;
	let log;

	const fakeTarget = (name) => {
		return {
			name,
			width: 320,
			height: 200,
			pendingClear: false,
			resize(w, h) {
				this.width = w;
				this.height = h;
			},
			destroy() {},
		};
	};

	const fakeBatcher = (name) => {
		return {
			name,
			flush() {
				log.push(`flush:${name}`);
			},
			bind() {},
			unbind() {},
		};
	};

	beforeEach(() => {
		log = [];
		renderer = Object.create(WebGPURenderer.prototype);
		Object.assign(renderer, {
			batchers: new Map([
				["quad", fakeBatcher("quad")],
				["primitive", fakeBatcher("primitive")],
				["mesh", fakeBatcher("mesh")],
			]),
			currentBatcher: null,
			currentRenderTarget: null,
			// `currentBlendMode` is a getter/setter on the base Renderer that
			// proxies the render-state stack, so the stub needs the backing
			// object rather than a plain field
			renderState: { currentBlendMode: "normal" },
			premultipliedAlpha: true,
			currentGradient: null,
			maskLevel: 0,
			stencilMode: "none",
			renderPass: {
				end() {
					log.push("pass:end");
				},
			},
			commandEncoder: {
				finish() {
					return "cmdbuf";
				},
			},
			device: {
				queue: {
					submit() {
						log.push("submit");
					},
				},
			},
			retiredTextures: [],
			_advancedBlendEffect: {
				enabled: true,
				setBlendMode(mode) {
					log.push(`effect:mode=${mode}`);
					return true;
				},
				setTexture(name) {
					log.push(`effect:bind=${name}`);
				},
			},
			_advancedBlendCapture: undefined,
			_advancedBlendTarget: fakeTarget("blendRT"),
			_advancedBlendOpen: false,
			_advancedBlendBusy: 0,
			_advancedBlendParent: null,
			_advancedBlendWarned: new Set(),
			getCanvas() {
				return { width: 320, height: 200 };
			},
			toFrameTexture() {
				// the REAL method's re-entrancy guard is what this stands in
				// for; the point here is WHERE the capture happens relative to
				// the retarget, and what it sees when it does
				log.push(`capture:${this.currentRenderTarget?.name ?? "canvas"}`);
				return { name: "capture" };
			},
			setRenderTarget(target, options = {}) {
				this.currentRenderTarget = target ?? null;
				log.push(
					`target:${target?.name ?? "canvas"}${options.clear === true ? ":clear" : ""}`,
				);
			},
			blitEffect(source, x, y, w, h, effect, keepBlend) {
				log.push(`blit:${source.name}:keep=${keepBlend === true}`);
			},
			flushGroundShadows() {},
			destroyRetiredTextures() {},
		});
	});

	it("captures the destination BEFORE redirecting to the offscreen", () => {
		renderer.setBlendMode("overlay");
		renderer.setBatcher("primitive");

		// the capture must read the real destination; if the redirect happened
		// first it would snapshot the freshly-cleared offscreen and every
		// blended pixel would composite against nothing
		const capture = log.findIndex((l) => {
			return l.startsWith("capture:");
		});
		const redirect = log.findIndex((l) => {
			return l === "target:blendRT:clear";
		});
		expect(capture, "no capture recorded").toBeGreaterThan(-1);
		expect(redirect, "no redirect recorded").toBeGreaterThan(-1);
		expect(capture).toBeLessThan(redirect);
		expect(log[capture]).toBe("capture:canvas");
		expect(renderer._advancedBlendOpen).toBe(true);
	});

	it("selects the formula for the mode that is actually current", () => {
		renderer.setBlendMode("soft-light");
		renderer.setBatcher("quad");
		expect(log).toContain("effect:mode=soft-light");
		expect(log).toContain("effect:bind=backdrop");
	});

	it("composites before queue.submit when the frame ends mid-bracket", () => {
		renderer.setBlendMode("difference");
		renderer.setBatcher("quad");
		expect(renderer._advancedBlendOpen).toBe(true);

		renderer.flush();

		// On this backend `flush()` ends the pass AND submits the encoder, so a
		// bracket closed after the submit would record its composite into an
		// encoder that has already shipped — the draw silently disappears from
		// the frame. Nothing calls setBatcher after the last draw, so this hook
		// is the only thing that closes it.
		const blit = log.findIndex((l) => {
			return l.startsWith("blit:");
		});
		const submit = log.indexOf("submit");
		expect(blit, "no composite recorded").toBeGreaterThan(-1);
		expect(submit, "no submit recorded").toBeGreaterThan(-1);
		expect(blit).toBeLessThan(submit);
		expect(renderer._advancedBlendOpen).toBe(false);
	});

	it("composites with blending KEPT so source-over finishes the job", () => {
		renderer.setBlendMode("overlay");
		renderer.setBatcher("quad");
		renderer.flush();
		// the effect emits premultiplied colour and relies on ordinary
		// source-over to produce the final pixel and a correct output alpha
		expect(log).toContain("blit:blendRT:keep=true");
	});

	it("returns to the PARENT target, not to the canvas", () => {
		// a bracket opened inside a post-effect pass must land back in that
		// pass's target; assuming the canvas would drop the draw outside the
		// pass, where the pass then paints over it
		const parent = fakeTarget("parentRT");
		renderer.setRenderTarget(parent);
		log.length = 0;

		renderer.setBlendMode("difference");
		renderer.setBatcher("quad");
		expect(log).toContain("capture:parentRT");
		renderer.flush();

		expect(log).toContain("target:parentRT");
		expect(renderer.currentRenderTarget).toBe(parent);
	});

	it("restores the advanced token after compositing", () => {
		renderer.setBlendMode("color-burn");
		renderer.setBatcher("quad");
		renderer.flush();
		// the composite itself runs under "normal"; leaving it there would
		// silently downgrade every following draw in the same mode
		expect(renderer.currentBlendMode).toBe("color-burn");
	});

	it("brackets each draw separately, closing the previous one first", () => {
		renderer.setBlendMode("difference");
		renderer.setBatcher("quad");
		renderer.setBatcher("primitive");

		const opens = log.filter((l) => {
			return l === "target:blendRT:clear";
		}).length;
		const blits = log.filter((l) => {
			return l.startsWith("blit:");
		}).length;
		expect(opens, "expected two brackets").toBe(2);
		expect(blits, "expected the first bracket to close").toBe(1);
	});

	it("does not re-enter while the bracket machinery is running", () => {
		// blitEffect and toFrameTexture both call setBatcher internally; an
		// unguarded hook would open a bracket inside the close, recursively
		renderer.setBlendMode("overlay");
		renderer.setBatcher("quad");
		renderer._advancedBlendBusy++;
		log.length = 0;
		renderer.setBatcher("primitive");
		renderer._advancedBlendBusy--;
		expect(
			log.filter((l) => {
				return l.startsWith("blit:");
			}),
		).toHaveLength(0);
		expect(
			log.filter((l) => {
				return l === "target:blendRT:clear";
			}),
		).toHaveLength(0);
	});

	it("keeps a fixed-function mode out of the bracket entirely", () => {
		for (const mode of ["normal", "multiply", "additive", "exclusion"]) {
			log.length = 0;
			renderer.setBlendMode(mode);
			renderer.setBatcher("quad");
			expect(renderer._advancedBlendOpen, `${mode} opened a bracket`).toBe(
				false,
			);
			expect(
				log.filter((l) => {
					return l.startsWith("capture:");
				}),
			).toHaveLength(0);
		}
	});

	it("excludes 3D meshes, loudly and without bracketing", () => {
		// The only draw type still excluded. Gradient fills used to be here
		// too, until the renderer's program cache was fixed — that desync,
		// not anything gradient-shaped, was what broke them.
		const warnings = [];
		const original = console.warn;
		console.warn = (...args) => {
			warnings.push(args.join(" "));
		};
		try {
			renderer.setBlendMode("difference");
			renderer.setBatcher("mesh");
			expect(renderer._advancedBlendOpen, "mesh bracketed").toBe(false);
			// the draw after it must bracket normally — the exclusion is per
			// draw, not a latch
			renderer.setBatcher("quad");
			expect(renderer._advancedBlendOpen, "exclusion latched").toBe(true);
		} finally {
			console.warn = original;
		}
		expect(
			warnings.some((w) => {
				return w.includes("3D meshes");
			}),
			`expected a mesh warning, got: ${warnings.join(" | ")}`,
		).toBe(true);
	});

	it("drains a pending bracket when the mode changes underneath it", () => {
		renderer.setBlendMode("difference");
		renderer.setBatcher("quad");
		log.length = 0;
		// the queued geometry belongs to the OUTGOING mode and must composite
		// with it, not with whatever comes next
		renderer.setBlendMode("multiply");
		expect(
			log.filter((l) => {
				return l.startsWith("blit:");
			}),
		).toHaveLength(1);
		expect(renderer._advancedBlendOpen).toBe(false);
	});

	it("tracks the advanced token verbatim and reports it", () => {
		// `normalizeBlendMode` collapses all six to "normal"; storing that
		// would strand an open bracket, because the setBlendMode meant to
		// clear it would compare "normal" against "normal" and early-out
		expect(renderer.setBlendMode("hard-light")).toBe("hard-light");
		expect(renderer.currentBlendMode).toBe("hard-light");
		expect(renderer.setBlendMode("add")).toBe("add");
		expect(renderer.setBlendMode("nonsense")).toBe("normal");
	});
});
