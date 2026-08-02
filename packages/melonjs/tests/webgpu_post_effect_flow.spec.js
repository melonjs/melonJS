import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Color, Matrix3d } from "../src/index.js";
import RenderTargetPool from "../src/video/rendertarget/render_target_pool.js";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";

/**
 * The pooled post-effect CONTROL FLOW, exercised through the REAL
 * beginPostEffect/endPostEffect prototype methods on a bare renderer whose
 * primitives (setRenderTarget/captureFrame/blitEffect/clipRect/…) record
 * into a log. This pins the ordering laws the WebGL parity depends on:
 * pool targets fetched BEFORE pool.end(), camera-vs-sprite capture points,
 * ping-pong clears, the camera viewport scissor bracket, and the per-depth
 * projection stack.
 */
describe("WebGPU post-effect control flow (recorded primitives)", () => {
	let renderer;
	let log;

	function fakeTarget(name) {
		return {
			name,
			width: 320,
			height: 200,
			pendingClear: false,
			resize(w, h) {
				this.width = w;
				this.height = h;
			},
			clear() {
				this.pendingClear = true;
			},
			bind() {},
			unbind() {},
			destroy() {},
			getMaterialBindGroup() {
				return { rt: this.name };
			},
		};
	}

	function makeEffect(overrides = {}) {
		return {
			enabled: true,
			_screenTextureUniforms: [],
			...overrides,
		};
	}

	function makeRenderable(effects, options = {}) {
		return {
			postEffects: effects,
			_postEffectManaged: options.camera === true,
			isDefault: options.isDefault === true,
			screenX: options.screenX ?? 10,
			screenY: options.screenY ?? 20,
			width: options.width ?? 180,
			height: options.height ?? 100,
		};
	}

	beforeEach(() => {
		log = [];
		let targetCount = 0;
		renderer = Object.create(WebGPURenderer.prototype);
		Object.assign(renderer, {
			customShader: undefined,
			effectProjectionStack: [],
			effectPassDepth: 0,
			projectionMatrix: new Matrix3d(),
			backgroundColor: new Color(16, 32, 48),
			currentBatcher: null,
			device: {},
			_renderTargetPool: new RenderTargetPool(() => {
				return fakeTarget(`rt${targetCount++}`);
			}),
			getCanvas() {
				return { width: 320, height: 200 };
			},
			save() {
				log.push("save");
			},
			restore() {
				log.push("restore");
			},
			setRenderTarget(target, options = {}) {
				this.currentRenderTarget = target ?? null;
				log.push(
					`target:${target?.name ?? "canvas"}${options.clear ? ":clear" : ""}`,
				);
			},
			captureFrame() {
				log.push(`capture:${this.currentRenderTarget?.name ?? "canvas"}`);
			},
			blitEffect(source, x, y, w, h, effect, keepBlend) {
				log.push(
					`blit:${source.name}→${effect.name}:keep=${keepBlend === true}`,
				);
			},
			clipRect(x, y, w, h) {
				log.push(`clip:${x},${y},${w},${h}`);
			},
			disableScissor() {
				log.push("descissor");
			},
			setGlobalAlpha() {},
			setBlendMode() {},
			pushFrameGlobals() {
				log.push("pushGlobals");
			},
		});
	});

	it("camera chain: capture-before-retarget, viewport clip, ping-pong clears, replace blit", () => {
		const fx1 = makeEffect({
			name: "fx1",
			_screenTextureUniforms: [{ name: "screen_texture" }],
		});
		const fx2 = makeEffect({ name: "fx2" });
		const camera = makeRenderable([fx1, fx2], { camera: true });

		expect(renderer.beginPostEffect(camera)).toBe(true);
		expect(renderer.effectPassDepth).toBe(1);
		log.push("---scene---");
		renderer.endPostEffect(camera);

		expect(log).toEqual([
			"save",
			// camera offscreen pass opens cleared
			"target:rt0:clear",
			"descissor",
			"---scene---",
			// the camera "screen" is the still-active offscreen target
			"capture:rt0",
			// non-default camera: composite clipped to its viewport
			"clip:10,20,180,100",
			"target:canvas",
			// ping-pong: intermediate blit into a CLEARED pool target,
			// blending replaced; final blit onto the parent, still replaced
			// for cameras (fully composited content)
			"target:rt1:clear",
			"blit:rt0→fx1:keep=false",
			"target:canvas",
			"blit:rt1→fx2:keep=false",
			"descissor",
			"restore",
			"pushGlobals",
		]);
		expect(renderer.effectPassDepth).toBe(0);
	});

	it("sprite chain: transparent clear, capture AFTER the parent retarget, final blit keeps blending", () => {
		const fx = makeEffect({
			name: "fx",
			_screenTextureUniforms: [{ name: "screen_texture" }],
		});
		const fx2 = makeEffect({ name: "fx2" });
		const sprite = makeRenderable([fx, fx2]);

		renderer.beginPostEffect(sprite);
		log.push("---sprite---");
		renderer.endPostEffect(sprite);

		// the sprite's "screen" is everything BEHIND it: captured from the
		// parent (canvas), after the retarget
		const captureIndex = log.indexOf("capture:canvas");
		const retargetIndex = log.indexOf("target:canvas");
		expect(captureIndex).toBeGreaterThan(retargetIndex);
		// sprite offscreen pass clears (transparent — no bg value recorded)
		expect(log[1]).toBe("target:rt0:clear");
		// the final blit composites WITH blending (transparent texels must
		// not overwrite the scene)
		expect(log.at(-3)).toBe("blit:rt1→fx2:keep=true");
	});

	it("nesting: a sprite pass inside a camera pass restores the camera's projection slot", () => {
		const cameraFx = [makeEffect({ name: "c1" }), makeEffect({ name: "c2" })];
		const spriteFx = [makeEffect({ name: "s1" }), makeEffect({ name: "s2" })];
		const camera = makeRenderable(cameraFx, { camera: true });
		const sprite = makeRenderable(spriteFx);

		renderer.projectionMatrix.translate(7, 0, 0);
		const cameraProjection = renderer.projectionMatrix.clone();

		renderer.beginPostEffect(camera);
		renderer.projectionMatrix.identity();
		renderer.beginPostEffect(sprite);
		expect(renderer.effectPassDepth).toBe(2);
		renderer.endPostEffect(sprite);
		expect(renderer.effectPassDepth).toBe(1);
		renderer.endPostEffect(camera);

		expect(renderer.effectPassDepth).toBe(0);
		// the OUTER slot restored the camera's projection, not the sprite's
		expect(renderer.projectionMatrix.equals(cameraProjection)).toBe(true);
	});

	it("the single-effect non-camera case takes the fast path (no pool, no bracket)", () => {
		const fx = makeEffect({ name: "solo" });
		const sprite = makeRenderable([fx]);
		expect(renderer.beginPostEffect(sprite)).toBe(false);
		expect(renderer.customShader).toBe(fx);
		expect(log).toEqual([]);
		renderer.endPostEffect(sprite);
		expect(log).toEqual([]);
	});

	it("disabled effects are filtered before any pooling decision", () => {
		const sprite = makeRenderable([
			makeEffect({ name: "off", enabled: false }),
		]);
		expect(renderer.beginPostEffect(sprite)).toBe(false);
		expect(renderer.customShader).toBeUndefined();
	});
});
