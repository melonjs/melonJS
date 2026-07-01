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
			this._shader.destroy();
		}
	}
}
