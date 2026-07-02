import {
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	off,
	on,
} from "../../system/event.ts";
import GLShader from "./glshader.js";
import quadVertex from "./shaders/quad.vert";

/**
 * A simplified shader class for applying custom fragment effects to renderables.
 * Only requires a fragment `apply()` function — the vertex shader, uniforms, and
 * texture sampling boilerplate are handled automatically.
 * In Canvas mode, the shader is silently disabled (all methods become no-ops).
 * @category Rendering
 * @example
 * // create a grayscale effect
 * mySprite.shader = new ShaderEffect(renderer, `
 *     vec4 apply(vec4 color, vec2 uv) {
 *         float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
 *         return vec4(vec3(gray), color.a);
 *     }
 * `);
 * @example
 * // create an effect with a custom uniform
 * const pulse = new ShaderEffect(renderer, `
 *     uniform float uTime;
 *     vec4 apply(vec4 color, vec2 uv) {
 *         float brightness = 0.8 + 0.2 * sin(uTime * 3.0);
 *         return vec4(color.rgb * brightness, color.a);
 *     }
 * `);
 * mySprite.shader = pulse;
 * // update the uniform each frame
 * pulse.setUniform("uTime", time);
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
	 * @param {WebGLRenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {string} fragmentBody - GLSL code containing a `vec4 apply(vec4 color, vec2 uv)` function
	 *   that receives the sampled pixel color and UV coordinates, and returns the modified color.
	 *   You can declare additional `uniform` variables before the `apply()` function.
	 * @param {string} [precision=auto detected] - float precision ('lowp', 'mediump' or 'highp')
	 */
	constructor(renderer, fragmentBody, precision) {
		/**
		 * the renderer this effect was created for — kept so destroy and
		 * context-loss can release the texture units reserved on its cache
		 * for extra samplers ({@link setTexture}), and so {@link clone} can
		 * compile an independent copy
		 * @ignore
		 */
		this._renderer = renderer;

		/**
		 * the construction "recipe" (fragment body + precision), kept so
		 * {@link clone} can compile an independent copy. Stored before the
		 * Canvas-mode early return so cloning behaves consistently there too.
		 * @ignore
		 */
		this._fragmentBody = fragmentBody;
		/** @ignore */
		this._precision = precision;

		if (typeof renderer.gl === "undefined") {
			console.warn(
				"ShaderEffect requires WebGL and is disabled in Canvas mode",
			);
			return;
		}

		// wrap the user's apply() with the texture-sampling boilerplate
		const fragment = [
			"uniform sampler2D uSampler;",
			"varying vec4 vColor;",
			"varying vec2 vRegion;",
			fragmentBody,
			"void main(void) {",
			"    vec4 texColor = texture2D(uSampler, vRegion) * vColor;",
			"    gl_FragColor = apply(texColor, vRegion);",
			"}",
		].join("\n");

		/** @ignore */
		this._shader = new GLShader(
			renderer.gl,
			quadVertex,
			fragment,
			precision || renderer.shaderPrecision,
		);
		this.enabled = true;

		/**
		 * extra texture samplers bound via {@link setTexture}, keyed by the
		 * uniform name → `{ image, repeat, tex }` (`tex` is the uploaded GL
		 * texture, created lazily on first draw)
		 * @ignore
		 */
		this._extraTextures = new Map();

		// flip enabled across context loss so beginPostEffect skips us
		on(ONCONTEXT_LOST, this._onContextLost, this);
		on(ONCONTEXT_RESTORED, this._onContextRestored, this);
	}

	/** @private */
	_onContextLost() {
		if (this.destroyed) {
			return;
		}
		// remember user-set state so restore doesn't override it
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

	/** @private */
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
		if (this.enabled) {
			this._shader.setUniform(name, value);
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
	 * mySprite.shader = flow;
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
		if (this.enabled && typeof this._shader.uniforms.uTime !== "undefined") {
			this._shader.setUniform("uTime", seconds);
		}
		return this;
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
	 * that name here. Any engine texture works — e.g. `noiseTexture.getTexture()`.
	 * No-op in Canvas mode.
	 * @param {string} name - the `sampler2D` uniform name declared in the fragment
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - the texture source
	 * @param {"repeat"|"repeat-x"|"repeat-y"|"no-repeat"} [repeat="no-repeat"] - wrap mode; use `"repeat"` for a tiled/scrolled texture (power-of-two size under WebGL 1)
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
	 * water.setTexture("uNoise", noise.getTexture(), "repeat");
	 * waterSprite.shader = water;
	 * // each frame, in your Stage's update(dt):
	 * water.setTime(me.timer.getTime() / 1000);
	 */
	setTexture(name, image, repeat = "no-repeat") {
		if (this.enabled) {
			const existing = this._extraTextures.get(name);
			if (existing) {
				// release the previous GL texture + unit reservation before
				// replacing the binding
				if (existing.tex !== null) {
					this._shader.gl.deleteTexture(existing.tex);
				}
				if (existing.unit !== undefined) {
					this._renderer.cache.releaseUnit(existing.unit);
				}
			}
			this._extraTextures.set(name, {
				image,
				repeat,
				tex: null,
				unit: undefined,
			});
		}
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
		let nextUnit = batcher.maxBatchTextures - 1;
		for (const [name, entry] of this._extraTextures) {
			if (entry.unit === undefined) {
				if (nextUnit < 1) {
					// more extra textures than the batcher can hold beside
					// uSampler — bind what fits, warn once, skip the rest
					if (!this._textureOverflowWarned) {
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
			if (entry.tex === null) {
				batcher.createTexture2D(
					entry.unit,
					entry.image,
					filter,
					entry.repeat,
					entry.image.width,
					entry.image.height,
					false, // premultipliedAlpha — keep raw texel values
					false, // mipmap — not needed, and NPOT-unsafe under WebGL 1
					undefined,
					false, // flush — the following draw flushes with everything bound
				);
				entry.tex = batcher.boundTextures[entry.unit];
			} else {
				batcher.bindTexture2D(entry.tex, entry.unit, false);
			}
			this._shader.setUniform(name, entry.unit);
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
	 * sprite.shader = loader.getShader("flash");
	 * // the boss needs its own intensity — clone a private, caller-owned copy
	 * boss.shader = loader.getShader("flash").clone();
	 * boss.shader.setUniform("uIntensity", 0.9);
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

	/** @ignore */
	bind() {
		if (this.enabled) {
			this._shader.bind();
		}
	}

	/** @ignore */
	getAttribLocation(name) {
		return this.enabled ? this._shader.getAttribLocation(name) : -1;
	}

	/** @ignore */
	setVertexAttributes(gl, attributes, stride) {
		if (this.enabled) {
			this._shader.setVertexAttributes(gl, attributes, stride);
		}
	}

	/** @ignore */
	get program() {
		return this.enabled ? this._shader.program : null;
	}

	/** @ignore */
	get vertex() {
		return this.enabled ? this._shader.vertex : null;
	}

	/** @ignore */
	get fragment() {
		return this.enabled ? this._shader.fragment : null;
	}

	/** @ignore */
	get attributes() {
		return this.enabled ? this._shader.attributes : {};
	}

	/** @ignore */
	get uniforms() {
		return this.enabled ? this._shader.uniforms : {};
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
