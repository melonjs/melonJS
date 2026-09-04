import {
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	off,
	on,
} from "../../system/event.ts";
import Texture2d from "../texture/texture2d.ts";
import GLShader from "../webgl/glshader.js";
import { buildGLSLProgram } from "./glsl_realization.js";
import WGSLEffectRealization from "./wgsl_realization.js";

/**
 * A simplified shader class for applying custom fragment effects to renderables.
 * Only requires a fragment `apply()` function — the vertex shader, uniforms, and
 * texture sampling boilerplate are handled automatically.
 *
 * ## Dual-language bodies
 *
 * An effect body is written in the active renderer's shading language:
 * GLSL on the WebGL renderer, WGSL on the WebGPU renderer. Pass a plain
 * string for a GLSL-only effect (the historical form), or one body per
 * language for an effect that runs on both backends:
 *
 * ```js
 * new ShaderEffect(renderer, { glsl: glslBody, wgsl: wgslBody });
 * ```
 *
 * The renderer compiles the body matching its
 * {@link Renderer#shaderLanguage}. When no matching body exists — a
 * GLSL-only effect on the WebGPU renderer, any effect on the Canvas
 * renderer — the effect warns once and stays **disabled**
 * (`enabled === false`, every method a safe no-op): the scene renders
 * without the effect, it never breaks.
 *
 * ## The WGSL convention
 *
 * A WGSL body mirrors the GLSL one — declarations plus an apply function,
 * compiled verbatim inside engine boilerplate:
 *
 * - `fn apply(color : vec4f, uv : vec2f) -> vec4f` — required; receives
 *   the sampled, tinted pixel and its UV, returns the modified color.
 * - Uniforms are the members of ONE struct bound as
 *   `@group(3) @binding(0) var<uniform> fx : MyUniforms;` — member names
 *   are the {@link ShaderEffect#setUniform} names, so a dual-language
 *   effect uses the same uniform names in both bodies and one
 *   `setUniform` call serves both. Supported member types: `f32`, `i32`,
 *   `u32`, `vec2f`, `vec3f`, `vec4f`, `mat3x3f`, `mat4x4f`,
 *   `array<vec4f, N>`.
 * - Extra {@link ShaderEffect#setTexture} samplers are texture/sampler
 *   pairs at explicit consecutive group-3 bindings (from 1):
 *   `@group(3) @binding(1) var uNoise : texture_2d<f32>;`
 *   `@group(3) @binding(2) var uNoiseSampler : sampler;`
 * - The source texture is available as `uTexture` with `uSampler`
 *   (`textureSample(uTexture, uSampler, uv)` — the WGSL spelling of
 *   GLSL's `texture2D(uSampler, uv)`), and the interpolated tint as
 *   `vColor`, under the same names as the GLSL side.
 * - The shader builtins keep their names: `screen_uv`, `noise_uv`, and
 *   `screen_texture` — sampled through `screen_sampler` (clamped) or
 *   `screen_sampler_repeat` (wrapping), replacing the GLSL
 *   `: screen_texture(repeat)` annotation.
 * - Porting note: a texture sampled after a non-uniform `return` or
 *   inside a varying branch must use
 *   `textureSampleLevel(uTexture, uSampler, uv, 0.0)` (a WGSL
 *   uniform-control-flow rule; identical output for sprite textures).
 *
 * ## Directional UV arithmetic (`uUVYDir`)
 *
 * The vertical orientation of `apply()`'s UV space depends on the draw
 * path: sampling the sprite directly, `uv.y` grows downward, but the
 * WebGL multi-effect (pooled) path composites through capture FBOs whose
 * rows are bottom-up — there `uv.y` grows upward. A body that offsets its
 * sampling coordinate vertically (a drop shadow, a directional smear)
 * would render mirrored on that path. Declare a `float uUVYDir` uniform
 * (WGSL: `uUVYDir : f32` in the uniform struct) and multiply vertical UV
 * offsets by it: the renderer feeds `+1` where `uv.y` grows downward —
 * including every WebGPU path — and `-1` on the WebGL pooled path, so
 * "down" stays down everywhere. Initialize it to `1.0` with `setUniform`;
 * bodies that don't declare it are unaffected. The built-in
 * {@link DropShadowEffect} is the reference use.
 * @category Rendering
 * @example
 * // one effect, both backends: dual-language body
 * const fx = new ShaderEffect(renderer, {
 *     glsl: `
 *         uniform float uStrength;
 *         vec4 apply(vec4 color, vec2 uv) {
 *             return vec4(color.rgb * uStrength, color.a);
 *         }
 *     `,
 *     wgsl: `
 *         struct Fx { uStrength : f32, };
 *         @group(3) @binding(0) var<uniform> fx : Fx;
 *         fn apply(color : vec4f, uv : vec2f) -> vec4f {
 *             return vec4f(color.rgb * fx.uStrength, color.a);
 *         }
 *     `,
 * });
 * mySprite.addPostEffect(fx);
 * fx.setUniform("uStrength", 0.5); // sets either backend
 * @example
 * // create a grayscale effect
 * mySprite.addPostEffect(new ShaderEffect(renderer, `
 *     vec4 apply(vec4 color, vec2 uv) {
 *         float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
 *         return vec4(vec3(gray), color.a);
 *     }
 * `));
 * @example
 * // create an effect with a custom uniform
 * const pulse = new ShaderEffect(renderer, `
 *     uniform float uTime;
 *     vec4 apply(vec4 color, vec2 uv) {
 *         float brightness = 0.8 + 0.2 * sin(uTime * 3.0);
 *         return vec4(color.rgb * brightness, color.a);
 *     }
 * `);
 * mySprite.addPostEffect(pulse);
 * // update the uniform each frame
 * pulse.setUniform("uTime", time);
 * @example
 * // Shader builtins — no JS plumbing, no UV math:
 * // `: screen_texture` keeps the sampler filled with everything drawn so
 * // far (a back-buffer copy; one screen copy per draw of the effect),
 * // `screen_uv` is this fragment's 0..1 screen position, and `noise_uv`
 * // runs 0..1 across the sprite regardless of its atlas frame.
 * const water = new ShaderEffect(renderer, `
 *     uniform sampler2D uNoise;
 *     uniform sampler2D screenTex : screen_texture;
 *     uniform float uTime;
 *     vec4 apply(vec4 color, vec2 uv) {
 *         vec2 flow = texture2D(uNoise, noise_uv + uTime * 0.25).rg;
 *         vec4 refracted = texture2D(screenTex, screen_uv + flow * 0.005);
 *         return refracted * texture2D(uSampler, uv + flow * 0.005);
 *     }
 * `);
 * water.setTexture("uNoise", noiseTexture.getTexture(), "repeat");
 */
export default class ShaderEffect {
	/**
	 * whether this effect is active (false in Canvas mode, false after
	 * {@link destroy}, and false while the WebGL context is suspended
	 * between an `ONCONTEXT_LOST` and the matching `ONCONTEXT_RESTORED`
	 * event).
	 * @type {boolean}
	 */
	enabled = false;

	/**
	 * `true` once {@link destroy} has been called. Distinct from
	 * `enabled` — which also toggles transiently across a context
	 * lost / restored cycle — to give callers a stable signal for
	 * "this effect has been explicitly released."
	 * @type {boolean}
	 * @readonly
	 */
	destroyed = false;

	/**
	 * When `true`, a renderable will NOT auto-destroy this effect when it is
	 * removed from its `postEffects` (via the `shader` setter,
	 * {@link Renderable#removePostEffect}, {@link Renderable#clearPostEffects})
	 * or when the renderable itself is destroyed. Set this on an effect shared
	 * across several renderables so one of them going away doesn't free the GL
	 * program still used by the others — you then own its lifecycle and call
	 * {@link destroy} yourself.
	 * @type {boolean}
	 * @default false
	 */
	shared = false;

	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {string|{glsl?: string, wgsl?: string}} body - the effect body:
	 *   a GLSL string (containing a `vec4 apply(vec4 color, vec2 uv)` function —
	 *   unchanged from previous versions), or an object carrying one body per
	 *   shading language (`glsl` and/or `wgsl`, the WGSL body defining
	 *   `fn apply(color : vec4f, uv : vec2f) -> vec4f`). The renderer picks the
	 *   body matching its {@link Renderer#shaderLanguage}; when no matching body
	 *   exists the effect warns once and stays disabled (`enabled === false`),
	 *   exactly like the Canvas renderer.
	 * @param {string} [precision=auto detected] - float precision ('lowp', 'mediump' or 'highp'), GLSL only
	 */
	constructor(renderer, body, precision) {
		/**
		 * the renderer this effect was created for — kept so destroy and
		 * context-loss can release the texture units reserved on its cache
		 * for extra samplers ({@link setTexture}), and so {@link clone} can
		 * compile an independent copy
		 * @ignore
		 * @internal
		 */
		this._renderer = renderer;

		/**
		 * the construction "recipe" (body + precision), kept VERBATIM so
		 * {@link clone} can compile an independent copy. Stored before the
		 * disabled-stub early return so cloning behaves consistently there too.
		 * @ignore
		 * @internal
		 */
		this._fragmentBody = body;
		/**
		 * @ignore
		 * @internal
		 */
		this._precision = precision;

		// resolve the body matching this renderer's shading language: a bare
		// string keeps meaning GLSL (the historical signature), an object
		// carries one body per language
		const bodies = typeof body === "string" ? { glsl: body } : (body ?? {});
		const language = renderer.shaderLanguage;
		const source = language !== null ? bodies[language] : undefined;

		if (typeof source !== "string") {
			// no body this backend can compile — same inert-stub contract as
			// the Canvas renderer: warn, stay disabled, every method no-ops
			console.warn(
				language === null
					? "ShaderEffect requires a GPU backend and is disabled on this renderer (no programmable pipeline)"
					: `ShaderEffect has no ${language} body and is disabled on this renderer (provide a { ${language}: ... } source)`,
			);
			return;
		}

		/**
		 * extra texture samplers bound via {@link setTexture}, keyed by the
		 * uniform name → `{ image, repeat, tex }` (`tex` is the uploaded GL
		 * texture, created lazily on first draw; unused on WebGPU, where the
		 * bind group is built lazily instead)
		 * @ignore
		 * @internal
		 */
		this._extraTextures = new Map();

		if (language === "glsl") {
			// assemble the GLSL sources (builtin parsing + boilerplate) — the
			// pure-assembly half lives in glsl_realization.js, pinned
			// byte-identical by the generated-GLSL golden spec
			const program = buildGLSLProgram(source);

			/**
			 * samplers annotated `: screen_texture` — the renderer checks this to
			 * know when to refresh the shared frame capture before the effect draws
			 * @type {Array<{name: string, repeat: string}>}
			 * @ignore
			 * @internal
			 */
			this._screenTextureUniforms = program.screenTextures;
			/**
			 * @ignore
			 * @internal
			 */
			this._hasNoiseUV = program.noiseUV;

			/**
			 * @ignore
			 * @internal
			 */
			this._shader = new GLShader(
				renderer.gl,
				program.vertex,
				program.fragment,
				precision || renderer.shaderPrecision,
			);
			this.enabled = true;

			// wire every annotated screen sampler to the renderer's shared frame
			// capture — a live GPU-resident entry, re-bound fresh on each draw and
			// skipped while no capture has been taken yet
			for (const screenTexture of program.screenTextures) {
				this.setTexture(
					screenTexture.name,
					renderer.getSharedFrameTexture(),
					screenTexture.repeat,
				);
			}
		} else {
			// WGSL: parse the body's declarations (WebGPU has no uniform
			// reflection — offsets are computed CPU-side) and assemble the
			// module; GPU objects are built lazily by the renderer's effect
			// path. A parse failure disables the effect like a missing body.
			const realization = new WGSLEffectRealization(source);
			if (!realization.valid) {
				console.warn(
					`ShaderEffect: invalid WGSL body — ${realization.error} (effect disabled)`,
				);
				return;
			}
			/**
			 * @ignore
			 * @internal
			 */
			this.wgslRealization = realization;
			// same renderer-facing capture contract as the GLSL side: a
			// non-empty list means "refresh the frame capture before I draw"
			this._screenTextureUniforms = realization.builtins.screenTexture
				? [
						{
							name: "screen_texture",
							repeat: realization.builtins.screenSamplerRepeat
								? "repeat"
								: "no-repeat",
						},
					]
				: [];
			this._hasNoiseUV = realization.builtins.noiseUV;
			this.enabled = true;
		}

		// flip enabled across context/device loss so beginPostEffect skips us
		on(ONCONTEXT_LOST, this._onContextLost, this);
		on(ONCONTEXT_RESTORED, this._onContextRestored, this);
	}

	/**
	 * @private
	 * @ignore
	 * @internal
	 */
	_onContextLost() {
		if (this.destroyed) {
			return;
		}
		// remember user-set state so restore doesn't override it
		/**
		 * @ignore
		 * @internal
		 */
		this._enabledBeforeSuspend = this.enabled;
		this.enabled = false;
		// GL texture handles + unit reservations are invalid after a context
		// loss — drop the handles and release the reserved units so, on restore,
		// _prepareTextures re-reserves + re-uploads instead of re-binding a
		// stale (black/invalid) handle
		for (const entry of this._extraTextures.values()) {
			if (entry.unit !== undefined) {
				this._renderer.cache.releaseUnit(entry.unit);
				entry.unit = undefined;
			}
			entry.tex = null;
		}
	}

	/**
	 * @private
	 * @ignore
	 * @internal
	 */
	_onContextRestored() {
		if (this.destroyed) {
			return;
		}
		// the inner GLShader recompiles itself; restore the gate to
		// whatever the user had it set to before the suspend
		this.enabled = this._enabledBeforeSuspend !== false;
		this._enabledBeforeSuspend = undefined;
	}

	/**
	 * Set the uniform to the given value
	 * @param {string} name - the uniform name
	 * @param {object|Float32Array} value - the value to assign to that uniform
	 */
	setUniform(name, value) {
		// forward whenever a live shader exists (WebGL mode): GLShader handles
		// the suspended (context-lost) state by deferring to its uniform
		// cache. Gating on `enabled` here silently dropped values set during
		// a loss window — defeating that replay — or while the user had the
		// effect disabled. Canvas stubs (no shader) and destroyed effects
		// (partial-state immunity, see destroy()) keep no-oping.
		if (this.destroyed === true) {
			return;
		}
		if (typeof this._shader !== "undefined") {
			this._shader.setUniform(name, value);
		} else if (typeof this.wgslRealization !== "undefined") {
			// WGSL: write the CPU mirror; the value is snapshot-uploaded at
			// the effect's next bind (survives device loss for free)
			this.wgslRealization.setUniform(name, value);
		}
	}

	/**
	 * Set the shader's `uTime` uniform (elapsed time, in seconds). A convenience
	 * over `setUniform("uTime", ...)`; call it once per frame from your update
	 * loop to animate a shader that declares `uniform float uTime` (e.g. scrolling
	 * a static noise texture's UVs, pulsing, waving). Drive it with whatever clock
	 * you like — real time, a paused/scaled/scrubbed one.
	 *
	 * No-op if the shader does not declare a `uTime` uniform (nothing to update),
	 * or in Canvas mode. The engine does NOT call this for you — animation is
	 * opt-in, exactly like re-baking a {@link NoiseTexture2d} with `update(dt)`.
	 * @param {number} seconds - elapsed time in seconds
	 * @returns {ShaderEffect} this effect for chaining
	 * @example
	 * // a shader that scrolls a static seamless noise texture over time
	 * const flow = new me.ShaderEffect(renderer, `
	 *     uniform float uTime;
	 *     vec4 apply(vec4 color, vec2 uv) {
	 *         return texture2D(uSampler, uv + vec2(uTime * 0.05, 0.0));
	 *     }`);
	 * mySprite.addPostEffect(flow);
	 * // then in your Stage's update(dt):
	 * flow.setTime(me.timer.getTime() / 1000);
	 */
	setTime(seconds) {
		// detect `uTime` from the compiled program's ACTIVE uniforms at call
		// time — not a substring scan of the source (which false-positives on
		// `uTimeScale`, comments, or a `uTime` the compiler optimised out and
		// would make setUniform throw), and not cached (so it stays correct
		// across a context-loss recompile). `enabled` is false while suspended
		// or destroyed, so the uniforms map is never null here.
		// skipped while suspended (uniforms === null mid-context-loss; a
		// per-frame call self-heals on the next frame) and on Canvas stubs;
		// a USER-disabled but live effect still takes the value
		if (
			typeof this._shader !== "undefined" &&
			this.destroyed !== true &&
			!this._shader.suspended &&
			typeof this._shader.uniforms.uTime !== "undefined"
		) {
			this._shader.setUniform("uTime", seconds);
		} else if (
			typeof this.wgslRealization !== "undefined" &&
			this.destroyed !== true &&
			this.wgslRealization.hasUniform("uTime")
		) {
			// WGSL twin of the active-uniform check: the parsed struct map is
			// authoritative (no compiler elimination under WebGPU)
			this.wgslRealization.setUniform("uTime", seconds);
		}
		return this;
	}

	/**
	 * Feed the UV y-direction of the space `apply()` is about to run in:
	 * `+1` where `uv.y` grows downward (direct sprite sampling, and every
	 * WebGPU path), `-1` on the WebGL pooled-blit path, whose capture FBOs
	 * are bottom-up — there, y-directional UV arithmetic inside a body
	 * runs vertically mirrored unless compensated. Directional bodies
	 * (DropShadow) declare a `uUVYDir` uniform and multiply their y
	 * offsets with it, so "down" means down on every path of every
	 * backend. A silent no-op for bodies that don't declare the uniform.
	 * @param {number} dir - +1 (uv.y grows downward) or -1 (upward)
	 * @ignore
	 * @internal
	 */
	_setUVYDir(dir) {
		if (this._uvYDir === dir || this.destroyed === true) {
			return;
		}
		if (
			typeof this._shader !== "undefined" &&
			!this._shader.suspended &&
			typeof this._shader.uniforms.uUVYDir !== "undefined"
		) {
			/**
			 * @ignore
			 * @internal
			 */
			this._uvYDir = dir;
			this._shader.setUniform("uUVYDir", dir);
		} else if (
			typeof this.wgslRealization !== "undefined" &&
			this.wgslRealization.hasUniform("uUVYDir")
		) {
			this._uvYDir = dir;
			this.wgslRealization.setUniform("uUVYDir", dir);
		}
	}

	/**
	 * Feed the `noise_uv` builtin's frame rect for the object about to draw:
	 * the source texture dimensions, the destination (object) dimensions, and
	 * the frame's top-left UV origin. Called by the quad batchers per draw;
	 * a no-op unless this effect's fragment actually uses `noise_uv` (the
	 * `ME_*` uniforms only exist — and are only active — then).
	 * @param {number} sourceWidth - source texture width in pixels
	 * @param {number} sourceHeight - source texture height in pixels
	 * @param {number} objectWidth - destination (object) width in pixels
	 * @param {number} objectHeight - destination (object) height in pixels
	 * @param {number} u0 - the frame's left UV coordinate (flip-normalized)
	 * @param {number} v0 - the frame's top UV coordinate (flip-normalized)
	 * @ignore
	 * @internal
	 */
	_setNoiseUVRect(
		sourceWidth,
		sourceHeight,
		objectWidth,
		objectHeight,
		u0,
		v0,
	) {
		if (this._hasNoiseUV !== true || this.destroyed === true) {
			return;
		}
		if (typeof this.wgslRealization !== "undefined") {
			// WGSL: write the engine ME struct's CPU mirror (size_obj @0,
			// size_img @2, offset @4 — the scaffold's MEBuiltins layout);
			// snapshot-uploaded alongside the uniform block at bind time
			const me = this.wgslRealization.meMirror;
			me[0] = Math.max(Math.abs(objectWidth), 1);
			me[1] = Math.max(Math.abs(objectHeight), 1);
			me[2] = Math.max(sourceWidth, 1);
			me[3] = Math.max(sourceHeight, 1);
			me[4] = u0 * me[2];
			me[5] = v0 * me[3];
			return;
		}
		if (typeof this._shader === "undefined" || this._shader.suspended) {
			return;
		}
		// guard each set on the ACTIVE uniforms map — the compiler eliminates
		// the ME_* uniforms when `noise_uv` ends up unused, and setUniform
		// throws on inactive uniforms
		const uniforms = this._shader.uniforms;
		if (typeof uniforms.ME_size_obj !== "undefined") {
			this._shader.setUniform("ME_size_obj", [
				Math.max(Math.abs(objectWidth), 1),
				Math.max(Math.abs(objectHeight), 1),
			]);
		}
		if (typeof uniforms.ME_size_img !== "undefined") {
			this._shader.setUniform("ME_size_img", [
				Math.max(sourceWidth, 1),
				Math.max(sourceHeight, 1),
			]);
		}
		if (typeof uniforms.ME_offset !== "undefined") {
			this._shader.setUniform("ME_offset", [
				u0 * Math.max(sourceWidth, 1),
				v0 * Math.max(sourceHeight, 1),
			]);
		}
	}

	/**
	 * Apply the wrap mode a `: screen_texture(<repeat>)` annotation asked for
	 * onto the live capture handle. The unit is force-activated first: the
	 * batcher's bind may have been skipped as redundant while the GL active
	 * unit points elsewhere.
	 * @ignore
	 * @internal
	 */
	_applyCaptureWrap(batcher, glTex, entry) {
		const gl = batcher.gl;
		gl.activeTexture(gl.TEXTURE0 + entry.unit);
		gl.bindTexture(gl.TEXTURE_2D, glTex);
		batcher.currentTextureUnit = entry.unit;
		const wrapS = /^repeat(-x)?$/.test(entry.repeat)
			? gl.REPEAT
			: gl.CLAMP_TO_EDGE;
		const wrapT = /^repeat(-y)?$/.test(entry.repeat)
			? gl.REPEAT
			: gl.CLAMP_TO_EDGE;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
	}

	/**
	 * Bind an **extra** texture to a named `sampler2D` uniform in this shader, so
	 * a custom effect can read a *second* texture — a noise map, mask, gradient,
	 * flow/lookup table — besides the sprite/target it post-processes (`uSampler`).
	 * The engine uploads, caches, and re-binds it to a reserved texture unit each
	 * time the effect draws, and points the sampler uniform at it — no raw WebGL
	 * texture-unit juggling.
	 *
	 * Declare the sampler in your fragment (`uniform sampler2D <name>;`) and pass
	 * that name here. Any engine texture works — a {@link Texture2d} asset
	 * (`NoiseTexture2d`, `TextureAtlas`, …) can be passed directly, or a raw
	 * drawable source. No-op in Canvas mode.
	 * @param {string} name - the `sampler2D` uniform name declared in the fragment
	 * @param {Texture2d|HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - the texture: an engine texture asset, or a raw drawable source
	 * @param {"repeat"|"repeat-x"|"repeat-y"|"no-repeat"} [repeat="no-repeat"] - wrap mode; use `"repeat"` for a tiled/scrolled texture
	 * @returns {ShaderEffect} this effect for chaining
	 * @example
	 * // "water": distort the sprite by a static noise texture scrolled over time
	 * const noise = new me.NoiseTexture2d({ width: 256, height: 256, seamless: true });
	 * const water = new me.ShaderEffect(renderer, `
	 *     uniform sampler2D uNoise;
	 *     uniform float uTime;
	 *     vec4 apply(vec4 color, vec2 uv) {
	 *         vec2 flow = texture2D(uNoise, uv + uTime * 0.03).rg - 0.5;
	 *         return texture2D(uSampler, uv + flow * 0.02);
	 *     }`);
	 * water.setTexture("uNoise", noise, "repeat");
	 * waterSprite.addPostEffect(water);
	 * // each frame, in your Stage's update(dt):
	 * water.setTime(me.timer.getTime() / 1000);
	 */
	setTexture(name, image, repeat = "no-repeat") {
		// Explicitly reject HTMLVideoElement — it duck-types past the static
		// upload path, which uploads ONCE (`entry.tex === null` guard in
		// _prepareTextures) and would silently freeze the sampler on the
		// video's first frame. Same contract as Sprite.normalMap. Checked
		// before the Canvas/destroyed no-op guard so the error is raised
		// consistently under every renderer.
		if (typeof image?.videoWidth === "number") {
			throw new TypeError(
				"ShaderEffect.setTexture does not support HTMLVideoElement (extra textures upload once and would freeze on the first frame)",
			);
		}
		// Canvas stub (no realization at all) and destroyed effects: keep the
		// inert no-op
		if (this.destroyed === true) {
			return this;
		}
		if (typeof this.wgslRealization !== "undefined") {
			// WGSL: the sampler must be a texture var the body DECLARED (the
			// bind group is built from the parsed binding table — an
			// undeclared name has no binding to fill)
			const declared = this.wgslRealization.textures.some((t) => {
				return t.name === name;
			});
			if (!declared) {
				console.warn(
					`ShaderEffect.setTexture: "${name}" is not a texture declared in the WGSL body (expected a \`@group(3) @binding(n) var ${name} : texture_2d<f32>;\` + sampler pair)`,
				);
				return this;
			}
			const wgslLive =
				image instanceof Texture2d && image.isGPUResident === true;
			if (!wgslLive && image instanceof Texture2d) {
				image = image.getTexture();
			}
			this._extraTextures.set(name, {
				image,
				repeat,
				tex: null,
				live: wgslLive,
				unit: undefined,
			});
			// the cached bind group (if any) referenced the previous texture
			this.wgslRealization.gpu?.invalidateBindGroup?.();
			return this;
		}
		if (typeof this._shader === "undefined") {
			return this;
		}
		// A GPU-resident LIVE source (a frame capture from
		// renderer.toFrameTexture): keep the wrapper and bind its live GL
		// handle every draw — never upload a static copy — so re-capturing
		// into the same slot each frame is picked up with no re-bind. The live
		// path reads `.glTexture`, so require that handle to be present;
		// otherwise fall through and unwrap like any static Texture2d asset,
		// rather than take the live branch and silently never bind.
		const live =
			image instanceof Texture2d &&
			image.isGPUResident === true &&
			"glTexture" in image;
		if (!live && image instanceof Texture2d) {
			image = image.getTexture();
		}
		// store the entry regardless of `enabled`: the GL work happens lazily
		// in _prepareTextures on the next enabled draw, so a binding set while
		// the effect is disabled — or mid-context-loss, where entries set
		// during the window used to vanish permanently — survives intact.
		const existing = this._extraTextures.get(name);
		if (existing && existing.tex !== null) {
			// drop the old STATIC GL texture we own so the new image re-uploads
			// into the SAME reserved unit (kept below) on the next enabled draw.
			// A live entry never owns a GL texture (tex stays null — the
			// renderer/caller owns the handle), so this correctly skips it.
			this._shader.gl.deleteTexture(existing.tex);
		}
		this._extraTextures.set(name, {
			image,
			repeat,
			tex: null,
			live,
			// keep any unit already reserved for this sampler across the
			// replace: releasing it here (then re-reserving lazily) would open
			// a window — unbounded while the effect is disabled — in which the
			// cache allocator could hand that high unit to a regular texture,
			// reintroducing the collision reserveUnit() exists to prevent. The
			// reservation is released only where the unit is truly invalid:
			// context loss (_onContextLost) and destroy().
			unit: existing ? existing.unit : undefined,
		});
		return this;
	}

	/**
	 * (Re)bind this effect's extra textures ({@link setTexture}) to reserved GL
	 * texture units and point their sampler uniforms at them. Called by the
	 * renderer right after this effect's shader is bound — for both the
	 * post-effect blit and the single-effect `customShader` sprite path — so the
	 * bindings survive the batcher's rotating color-texture pool.
	 * @param {object} batcher - the active batcher (owns the GL texture units)
	 * @ignore
	 * @internal
	 */
	_prepareTextures(batcher) {
		if (!this.enabled || this._extraTextures.size === 0) {
			return;
		}
		const cache = batcher.renderer.cache;
		const filter = batcher.renderer._glTextureFilter();
		// hand out units from the TOP of the batcher's range, counting down, so
		// they never collide with `uSampler` (unit 0 on a blit) or the low,
		// rotating color-texture units. Each unit is reserved in the cache the
		// first time it's claimed, so `allocateTextureUnit` can't hand the same
		// unit to a sprite's own texture in the single-effect customShader path.
		// count down from the RENDERER's top unit rather than the batcher's:
		// which batcher happens to be active must not decide where an effect's
		// extra samplers live (#1585)
		let nextUnit =
			(batcher.renderer?.maxTextures ?? batcher.maxBatchTextures) - 1;
		for (const [name, entry] of this._extraTextures) {
			if (entry.unit === undefined) {
				// skip units other holders already reserved — another effect's
				// extra samplers, say. The lit batcher no longer reserves a
				// fixed normal-map range (#1585), so this is the only claimant
				// class left to step over.
				while (nextUnit >= 1 && cache.reservedUnits.has(nextUnit)) {
					nextUnit--;
				}
				if (nextUnit < 1) {
					// more extra textures than the batcher can hold beside
					// uSampler — bind what fits, warn once, skip the rest
					if (!this._textureOverflowWarned) {
						/**
						 * @ignore
						 * @internal
						 */
						this._textureOverflowWarned = true;
						console.warn(
							`ShaderEffect.setTexture: too many extra textures for ${batcher.maxBatchTextures} texture units — "${name}" and any later ones were not bound`,
						);
					}
					break;
				}
				entry.unit = nextUnit;
				cache.reserveUnit(nextUnit);
			}
			nextUnit = entry.unit - 1;
			let bound = false;
			if (entry.live === true) {
				// live GPU-resident source (frame capture): bind the current
				// handle fresh each draw — the renderer refreshes it in place,
				// so this samples the latest frame. Never uploaded, never freed
				// by this effect. Skip binding if not captured yet (null).
				const glTex = entry.image.glTexture;
				if (glTex !== null && typeof glTex !== "undefined") {
					batcher.bindTexture2D(glTex, entry.unit, false);
					if (entry.repeat !== "no-repeat") {
						// `: screen_texture(repeat)` — captures are created
						// clamped; apply the requested wrap on the live handle
						this._applyCaptureWrap(batcher, glTex, entry);
					}
					this._shader.setUniform(name, entry.unit);
					bound = true;
				}
			} else {
				if (entry.tex === null) {
					batcher.createTexture2D(
						entry.unit,
						entry.image,
						filter,
						entry.repeat,
						entry.image.width,
						entry.image.height,
						false, // premultipliedAlpha — keep raw texel values
						false, // mipmap — not needed for effect inputs
						undefined,
						false, // flush — the following draw flushes with everything bound
					);
					entry.tex = batcher.boundTextures[entry.unit];
				} else {
					batcher.bindTexture2D(entry.tex, entry.unit, false);
				}
				this._shader.setUniform(name, entry.unit);
				bound = true;
			}
			// only when we actually bound: this sampler took a reserved high unit
			// DIRECTLY (bypassing the shared texture cache), which overlaps the
			// lit quad batcher's normal-map units — invalidate it on the OTHER
			// batchers so a later lit draw re-binds its normal there instead of
			// sampling this texture. A skipped live bind (no capture yet) clobbers
			// nothing, so there's nothing to invalidate.
			if (bound) {
				batcher.renderer.invalidateTextureUnit(entry.unit, batcher);
			}
		}
	}

	/**
	 * Create an independent copy of this effect, compiled as its own GL
	 * program. Use it when several renderables need the same effect with
	 * *different* uniform values — a single instance has a single set of
	 * uniforms, shared by everything it is assigned to.
	 *
	 * The clone copies the **recipe**: the fragment source, float precision,
	 * every uniform value set so far, and any extra textures bound via
	 * {@link setTexture} (the clone uploads and owns its own GL copies).
	 * It does NOT copy **ownership or lifecycle** state — in particular the
	 * clone's {@link shared} flag is **always reset to `false`**, even when
	 * cloning a shared shader (such as one returned by `loader.getShader()`):
	 * the clone is caller-owned and will be auto-destroyed by the renderable
	 * it is assigned to, exactly like a hand-constructed effect. Set
	 * `shared = true` on the clone yourself if you intend to reuse it across
	 * several renderables.
	 * @returns {ShaderEffect} a new, caller-owned effect (`shared === false`)
	 * @example
	 * // the loader's shader is ONE shared program — one uniform state for all
	 * sprite.addPostEffect(loader.getShader("flash"));
	 * // the boss needs its own intensity — clone a private, caller-owned copy
	 * const bossFlash = loader.getShader("flash").clone();
	 * boss.addPostEffect(bossFlash);
	 * bossFlash.setUniform("uIntensity", 0.9);
	 */
	clone() {
		if (this.destroyed) {
			throw new Error("ShaderEffect.clone: effect has been destroyed");
		}
		const copy = new ShaderEffect(
			this._renderer,
			this._fragmentBody,
			this._precision,
		);
		// WGSL: replay the exact user-set values recorded by the realization
		// (not a mirror read-back), then re-declare the extra textures
		if (this.wgslRealization && copy.wgslRealization) {
			for (const [name, value] of this.wgslRealization.values) {
				copy.setUniform(name, value);
			}
			for (const [name, entry] of this._extraTextures) {
				copy.setTexture(name, entry.image, entry.repeat);
			}
			return copy;
		}
		// Canvas-mode effects are inert stubs — nothing further to copy
		if (this._shader && copy._shader) {
			// replay this effect's cached uniform values onto the clone (same
			// snapshot store the context-loss recovery replays from). When the
			// clone was constructed during a LOST context its program compiles
			// deferred and `uniforms` is null — skip the active-uniform check
			// and let the suspended setUniform cache the value for the restore
			// replay (which re-validates). Note the cache also holds sampler
			// unit indices written by _prepareTextures — harmless to replay,
			// the clone's own first draw re-reserves and overwrites them.
			for (const name of Object.keys(this._shader._uniformCache)) {
				if (
					copy._shader.suspended ||
					typeof copy._shader.uniforms[name] !== "undefined"
				) {
					copy._shader.setUniform(name, this._shader._uniformCache[name]);
				}
			}
			// re-declare extra textures — the clone uploads + owns its own
			// GL texture and unit reservation on first draw
			for (const [name, entry] of this._extraTextures) {
				copy.setTexture(name, entry.image, entry.repeat);
			}
		}
		return copy;
	}

	// the GL-program pass-throughs below additionally guard on `_shader`:
	// a WGSL-realized effect is `enabled` without ever owning a GL program

	/**
	 * @ignore
	 * @internal
	 */
	bind() {
		if (this.enabled && this._shader) {
			this._shader.bind();
		}
	}

	/**
	 * @ignore
	 * @internal
	 */
	getAttribLocation(name) {
		return this.enabled && this._shader
			? this._shader.getAttribLocation(name)
			: -1;
	}

	/**
	 * @ignore
	 * @internal
	 */
	setVertexAttributes(gl, attributes, stride) {
		if (this.enabled && this._shader) {
			this._shader.setVertexAttributes(gl, attributes, stride);
		}
	}

	/**
	 * @ignore
	 * @internal
	 */
	get program() {
		return this.enabled && this._shader ? this._shader.program : null;
	}

	/**
	 * @ignore
	 * @internal
	 */
	get vertex() {
		return this.enabled && this._shader ? this._shader.vertex : null;
	}

	/**
	 * @ignore
	 * @internal
	 */
	get fragment() {
		return this.enabled && this._shader ? this._shader.fragment : null;
	}

	/**
	 * @ignore
	 * @internal
	 */
	get attributes() {
		return this.enabled && this._shader ? this._shader.attributes : {};
	}

	/**
	 * @ignore
	 * @internal
	 */
	get uniforms() {
		return this.enabled && this._shader ? this._shader.uniforms : {};
	}

	/**
	 * destroy this shader effect. Idempotent — calling destroy twice
	 * is safe. Unsubscribes from the renderer's context-lost / restored
	 * events so a destroyed effect is not auto-reactivated.
	 */
	destroy() {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;

		// flip enabled BEFORE inner destroy so a thrown deleteProgram
		// can't leave us with enabled=true + uniforms=null (19.5.0 bug)
		this.enabled = false;

		off(ONCONTEXT_LOST, this._onContextLost, this);
		off(ONCONTEXT_RESTORED, this._onContextRestored, this);

		// WGSL: retire the effect-owned resident textures (static setTexture
		// uploads), then drop the lazily-built GPU state; the pipeline cache
		// keeps the shared module (bounded retention, rebuilt per epoch)
		if (this.wgslRealization) {
			const gpu = this.wgslRealization.gpu;
			if (gpu?.residentTextures) {
				for (const resident of gpu.residentTextures.values()) {
					this._renderer.retireTexture?.(resident.texture);
				}
			}
			this.wgslRealization.releaseGPU();
			this._extraTextures.clear();
		}
		// _shader is undefined on Canvas-mode effects (early-returned)
		if (this._shader) {
			// release any extra textures bound via setTexture — both the GL
			// handle and the cache unit reservation
			for (const entry of this._extraTextures.values()) {
				if (entry.unit !== undefined) {
					this._renderer.cache.releaseUnit(entry.unit);
				}
				if (entry.tex !== null) {
					this._shader.gl.deleteTexture(entry.tex);
				}
			}
			this._extraTextures.clear();
			this._shader.destroy();
		}
	}
}
