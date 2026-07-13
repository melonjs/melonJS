import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, ShaderEffect, video, WebGLRenderer } from "../src/index.js";

/**
 * Shader builtins in ShaderEffect:
 *
 * - `uniform sampler2D name : screen_texture;` — auto-wired to the
 *   renderer's shared frame capture (back-buffer copy semantics)
 * - `screen_uv` — free varying, fragment position in that capture
 * - `noise_uv`  — free varying, frame-local 0..1 across the drawn object
 *
 * Covers source-level parsing/injection, the live auto-wiring, true
 * screen-capture semantics on the sprite (customShader) path via
 * readPixels, noise_uv frame-locality for an atlas sub-frame, and
 * backward compatibility for shaders that don't use (or self-declare)
 * the builtin names.
 */
describe("ShaderEffect builtins (screen_texture / screen_uv / noise_uv)", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.WEBGL,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// WebGL genuinely unavailable — tests skip below
		}
		if (video.renderer instanceof WebGLRenderer) {
			renderer = video.renderer;
			// a bare harness never runs a frame, which is what normally
			// installs the camera's ortho projection — set it up once so
			// world coordinates land on canvas pixels like in a real game
			renderer.projectionMatrix.ortho(0, 64, 64, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		}
	});

	afterAll(() => {
		try {
			video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const IDENTITY_SCREEN = `
		uniform sampler2D screenTex : screen_texture;
		vec4 apply(vec4 color, vec2 uv) {
			return texture2D(screenTex, screen_uv);
		}
	`;

	it("parses the annotation, compiles, and auto-wires the shared capture", (ctx) => {
		requireWebGL(ctx);
		const fx = new ShaderEffect(renderer, IDENTITY_SCREEN);
		// annotation recorded (with default wrap)
		expect(fx._screenTextureUniforms).toEqual([
			{ name: "screenTex", repeat: "no-repeat" },
		]);
		// the stripped sampler is a real active uniform of the program
		expect(fx._shader.uniforms.screenTex).toBeDefined();
		// auto-wired as a LIVE entry pointing at the shared capture slot
		const entry = fx._extraTextures.get("screenTex");
		expect(entry).toBeDefined();
		expect(entry.live).toBe(true);
		expect(entry.image).toBe(renderer.getSharedFrameTexture());
		fx.destroy();
	});

	it("accepts a wrap mode in the annotation", (ctx) => {
		requireWebGL(ctx);
		const fx = new ShaderEffect(
			renderer,
			`
			uniform sampler2D screenTex : screen_texture(repeat);
			vec4 apply(vec4 color, vec2 uv) {
				return texture2D(screenTex, screen_uv * 2.0);
			}
		`,
		);
		expect(fx._screenTextureUniforms).toEqual([
			{ name: "screenTex", repeat: "repeat" },
		]);
		expect(fx._extraTextures.get("screenTex").repeat).toBe("repeat");
		fx.destroy();
	});

	it("activates noise_uv (ME_* uniforms) only when used", (ctx) => {
		requireWebGL(ctx);
		const withNoise = new ShaderEffect(
			renderer,
			`
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(noise_uv, 0.0, 1.0);
			}
		`,
		);
		expect(withNoise._hasNoiseUV).toBe(true);
		expect(withNoise._shader.uniforms.ME_size_obj).toBeDefined();
		expect(withNoise._shader.uniforms.ME_size_img).toBeDefined();
		expect(withNoise._shader.uniforms.ME_offset).toBeDefined();
		withNoise.destroy();

		const plain = new ShaderEffect(
			renderer,
			`
			vec4 apply(vec4 color, vec2 uv) {
				return color;
			}
		`,
		);
		expect(plain._hasNoiseUV).toBe(false);
		expect(plain._screenTextureUniforms).toEqual([]);
		expect(plain._shader.uniforms.ME_size_obj).toBeUndefined();
		plain.destroy();
	});

	it("leaves a body that declares its own builtin names untouched (back-compat)", (ctx) => {
		requireWebGL(ctx);
		// pre-feature shader that invented its own `noise_uv` uniform — the
		// engine must not inject a conflicting varying
		const fx = new ShaderEffect(
			renderer,
			`
			uniform vec2 noise_uv;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(noise_uv, 0.0, 1.0) * color;
			}
		`,
		);
		expect(fx._hasNoiseUV).toBe(false);
		// user-managed uniform is active and settable, exactly as before
		expect(fx._shader.uniforms.noise_uv).toBeDefined();
		expect(() => {
			fx.setUniform("noise_uv", [0.5, 0.5]);
		}).not.toThrow();
		fx.destroy();
	});

	// draw `source` as a quad through the single-effect customShader path —
	// the same harness as shadereffect-settexture.spec.js
	const drawWithEffect = (effect, source, dx, dy, dw, dh, sx, sy, sw, sh) => {
		renderer.save();
		renderer.customShader = effect;
		renderer.drawImage(
			source,
			sx ?? 0,
			sy ?? 0,
			sw ?? source.width,
			sh ?? source.height,
			dx,
			dy,
			dw,
			dh,
		);
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();
	};

	const readPixel = (canvasX, canvasY) => {
		const gl = renderer.gl;
		const px = new Uint8Array(4);
		// readPixels rows are bottom-up; canvas coords are top-down
		gl.readPixels(
			canvasX,
			renderer.getCanvas().height - 1 - canvasY,
			1,
			1,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			px,
		);
		return px;
	};

	const solidCanvas = (r, g, b, w = 64, h = 64) => {
		const c = video.createCanvas(w, h);
		const ctx2d = c.getContext("2d");
		ctx2d.fillStyle = `rgb(${r}, ${g}, ${b})`;
		ctx2d.fillRect(0, 0, w, h);
		return c;
	};

	it("does not capture the screen for effects without screen_texture", (ctx) => {
		requireWebGL(ctx);
		const spy = vi.spyOn(renderer, "toFrameTexture");
		const plain = new ShaderEffect(
			renderer,
			`
			vec4 apply(vec4 color, vec2 uv) {
				return color;
			}
		`,
		);
		drawWithEffect(plain, solidCanvas(0, 255, 0, 16, 16), 0, 0, 16, 16);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
		plain.destroy();
	});

	it("samples the true scene behind the object (customShader path, readPixels)", (ctx) => {
		requireWebGL(ctx);

		// two-tone backdrop: red top half, blue bottom half (canvas coords)
		renderer.clearColor("#000000ff");
		renderer.drawImage(solidCanvas(255, 0, 0, 64, 32), 0, 0);
		renderer.drawImage(solidCanvas(0, 0, 255, 64, 32), 0, 32);
		renderer.flush();

		// a GRAY source drawn through an effect that returns the SCREEN with
		// channels swizzled (.bgr) — output pixels prove all three at once:
		// the effect ran (not the gray source), it sampled the true backdrop
		// (back-buffer copy), and screen_uv orientation matches (top stays top)
		const fx = new ShaderEffect(
			renderer,
			`
			uniform sampler2D screenTex : screen_texture;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(texture2D(screenTex, screen_uv).bgr, 1.0);
			}
		`,
		);
		drawWithEffect(fx, solidCanvas(64, 64, 64, 32, 32), 16, 16, 32, 32);

		// inside the quad, canvas-top region (y 20 < 32): red backdrop,
		// swizzled → blue
		const top = readPixel(32, 20);
		expect(top[2]).toBeGreaterThan(200);
		expect(top[0]).toBeLessThan(60);
		// inside the quad, canvas-bottom region (y 44): blue backdrop,
		// swizzled → red
		const bottom = readPixel(32, 44);
		expect(bottom[0]).toBeGreaterThan(200);
		expect(bottom[2]).toBeLessThan(60);
		// outside the quad: backdrop untouched (red stays red)
		const outside = readPixel(4, 4);
		expect(outside[0]).toBeGreaterThan(200);

		fx.destroy();
	});

	it("noise_uv is frame-local for an atlas sub-frame", (ctx) => {
		requireWebGL(ctx);

		// 64x32 sheet, drawing ONLY its right half (source rect x 32..64) —
		// noise_uv must still run 0..1 across the DRAWN frame
		const sheet = solidCanvas(0, 0, 0, 64, 32);
		const fx = new ShaderEffect(
			renderer,
			`
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(noise_uv, 0.0, 1.0);
			}
		`,
		);
		renderer.clearColor("#000000ff");
		drawWithEffect(fx, sheet, 16, 16, 32, 32, 32, 0, 32, 32);

		// red channel = noise_uv.x: ~0 at the frame's left edge, ~1 at its
		// right edge — even though the frame starts at u = 0.5 in the sheet
		const left = readPixel(18, 32);
		const right = readPixel(45, 32);
		expect(left[0]).toBeLessThan(40);
		expect(right[0]).toBeGreaterThan(215);
		// green channel = noise_uv.y across the frame height
		const topEdge = readPixel(32, 18);
		const bottomEdge = readPixel(32, 45);
		expect(topEdge[1]).toBeLessThan(40);
		expect(bottomEdge[1]).toBeGreaterThan(215);

		fx.destroy();
	});

	it("samples the scene on the CAMERA post-effect (blit) path", (ctx) => {
		requireWebGL(ctx);

		// swizzling identity effect on a camera-managed chain: the "screen"
		// is the scene captured from the camera FBO before it is unbound
		const fx = new ShaderEffect(
			renderer,
			`
			uniform sampler2D screenTex : screen_texture;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(texture2D(screenTex, screen_uv).bgr, 1.0);
			}
		`,
		);
		const spy = vi.spyOn(renderer, "toFrameTexture");
		const camera = {
			postEffects: [fx],
			_postEffectManaged: true,
			isDefault: true,
		};

		renderer.clearColor("#000000ff");
		expect(renderer.beginPostEffect(camera)).toBe(true);
		// in the real pipeline the camera re-applies its projection at the
		// start of every FBO pass — replay that for the bare harness
		renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		// the scene, drawn INTO the camera FBO: red top half, blue bottom
		renderer.drawImage(solidCanvas(255, 0, 0, 64, 32), 0, 0);
		renderer.drawImage(solidCanvas(0, 0, 255, 64, 32), 0, 32);
		renderer.endPostEffect(camera);
		renderer.flush();

		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();

		// blitted output = the scene swizzled, with orientation preserved
		const top = readPixel(32, 12);
		expect(top[2]).toBeGreaterThan(200); // red scene → blue out
		expect(top[0]).toBeLessThan(60);
		const bottom = readPixel(32, 52);
		expect(bottom[0]).toBeGreaterThan(200); // blue scene → red out
		expect(bottom[2]).toBeLessThan(60);

		fx.destroy();
	});

	it("samples the scene BEHIND the object on the multi-effect chain path", (ctx) => {
		requireWebGL(ctx);

		// two effects on a non-managed renderable force the FBO chain; the
		// last one outputs the screen capture — which must be the MAGENTA
		// backdrop behind the object, not the object's own (gray) rendering
		const passthrough = new ShaderEffect(
			renderer,
			`
			vec4 apply(vec4 color, vec2 uv) {
				return color;
			}
		`,
		);
		const screen = new ShaderEffect(
			renderer,
			`
			uniform sampler2D screenTex : screen_texture;
			vec4 apply(vec4 color, vec2 uv) {
				// opaque only where the object drew, sampling the screen there
				return vec4(texture2D(screenTex, screen_uv).rgb, color.a);
			}
		`,
		);
		const sprite = {
			postEffects: [passthrough, screen],
			_postEffectManaged: false,
		};

		renderer.clearColor("#ff00ffff"); // magenta backdrop
		expect(renderer.beginPostEffect(sprite)).toBe(true);
		// the object: a gray quad in the middle of its capture FBO
		renderer.drawImage(solidCanvas(64, 64, 64, 32, 32), 16, 16, 32, 32);
		renderer.endPostEffect(sprite);
		renderer.flush();

		// where the object drew, the screen (magenta) shows through — true
		// "everything behind me" semantics on the chain path too
		const inside = readPixel(32, 32);
		expect(inside[0]).toBeGreaterThan(200);
		expect(inside[1]).toBeLessThan(60);
		expect(inside[2]).toBeGreaterThan(200);

		passthrough.destroy();
		screen.destroy();
	});

	it("clone keeps the builtins wired", (ctx) => {
		requireWebGL(ctx);
		const fx = new ShaderEffect(renderer, IDENTITY_SCREEN);
		const copy = fx.clone();
		expect(copy._screenTextureUniforms).toEqual(fx._screenTextureUniforms);
		const entry = copy._extraTextures.get("screenTex");
		expect(entry.live).toBe(true);
		expect(entry.image).toBe(renderer.getSharedFrameTexture());
		// destroying an effect never destroys the renderer-owned capture
		fx.destroy();
		copy.destroy();
		expect(renderer.getSharedFrameTexture()).toBeDefined();
	});
});
