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

		// build the full fragment shader by wrapping the user's apply() function
		// with the standard texture sampling boilerplate:
		// - uSampler: the texture sampler (automatically bound by the engine)
		// - vColor: the vertex color (tint and opacity, pre-multiplied alpha)
		// - vRegion: the texture UV coordinates for the current sprite region
		// - texColor: the sampled pixel color (texture × vertex color)
		// The user's apply(color, uv) receives texColor and vRegion,
		// and returns the final fragment color.
		const fragment = [
			"uniform sampler2D uSampler;",
			"varying vec4 vColor;",
			"varying vec2 vRegion;",
			// user-provided fragment body (uniforms + apply function)
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

		// Keep the public `enabled` gate in sync with the underlying
		// shader's suspended state. Without this, `enabled` stays true
		// while the GL context is lost, and the renderer's
		// `beginPostEffect` filter (`fx.enabled !== false`) would try
		// to bind a null program. The GLShader itself silently no-ops
		// on its own (defense in depth), but flipping `enabled` lets
		// the render-path filter skip the effect entirely.
		on(ONCONTEXT_LOST, this._onContextLost, this);
		on(ONCONTEXT_RESTORED, this._onContextRestored, this);
	}

	/** @private */
	_onContextLost() {
		if (this.destroyed) {
			return;
		}
		this.enabled = false;
	}

	/** @private */
	_onContextRestored() {
		if (this.destroyed) {
			return;
		}
		// The underlying GLShader recompiles itself in its own
		// ONCONTEXT_RESTORED handler — we just need to re-open the
		// `enabled` gate so the renderer's filter sees us again.
		this.enabled = true;
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

		// Order matters: set `enabled = false` BEFORE calling into
		// `_shader.destroy()`. If the inner destroy throws (e.g. a
		// flaky ANGLE `gl.deleteProgram` on a dead context), the
		// public guards on this effect's setUniform / bind / etc are
		// already in the safe-state, so a still-registered update
		// loop calling `setTime(t)` never reaches a partially-torn-
		// down shader. Without this ordering, the throw between the
		// two statements left `enabled === true` while
		// `_shader.uniforms === null` — the exact partial state
		// that produced the original 19.5.0 "Cannot read properties
		// of null (reading 'uTime')" crash on Windows + ANGLE.
		this.enabled = false;

		off(ONCONTEXT_LOST, this._onContextLost, this);
		off(ONCONTEXT_RESTORED, this._onContextRestored, this);

		// _shader may already be undefined on Canvas-mode effects
		// (constructor early-returned). Guard accordingly.
		if (this._shader) {
			this._shader.destroy();
		}
	}
}
