import { parseWGSLBody } from "./wgsl/parse.js";
import { buildWGSLModule } from "./wgsl/scaffold.js";

/**
 * The WGSL realization of a ShaderEffect — the WebGPU counterpart of the
 * GLShader the GLSL branch compiles.
 *
 * WebGPU has no uniform reflection, so this object carries everything the
 * backend needs to drive the effect: the parsed uniform layout (name →
 * byte placement), a CPU-side mirror of the uniform block that
 * `setUniform` writes into, the texture binding table, and the assembled
 * module text. GPU objects (shader module, bind group layout, bind group)
 * are built lazily by the renderer's effect path — uniform VALUES are
 * snapshotted from the mirror into a per-frame arena at every bind, so a
 * shared effect bound twice in a frame with different values stays
 * correct under WebGPU's queue-write-before-draws ordering.
 * @ignore
 */
export default class WGSLEffectRealization {
	/**
	 * Parse + assemble; on any parse failure `valid` is false and `error`
	 * carries the reason (the effect then warns and stays disabled).
	 * @param {string} body - the user WGSL body
	 */
	constructor(body) {
		const parsed = parseWGSLBody(body);

		/**
		 * whether the body parsed into a realizable shape
		 * @type {boolean}
		 */
		this.valid = parsed.ok === true;
		/** @type {string|null} */
		this.error = parsed.ok === true ? null : parsed.error;

		if (!this.valid) {
			return;
		}

		/** name → {offset, size, type} placement in the uniform block */
		this.layout = parsed.layout;
		/** total uniform block byte size (0 = no uniform struct) */
		this.structSize = parsed.structSize;
		/** user texture/sampler pairs (binding table) */
		this.textures = parsed.textures;
		/** builtin usage flags */
		this.builtins = parsed.builtins;

		const module = buildWGSLModule(body, parsed);
		/** the complete assembled WGSL module text */
		this.code = module.code;
		/** builtin binding assignment (ME / capture texture / samplers) */
		this.builtinBindings = module.bindings;

		// CPU mirror of the uniform block; snapshot-uploaded per bind
		this.cpu = new ArrayBuffer(Math.max(this.structSize, 0));
		this.f32 = new Float32Array(this.cpu);
		this.i32 = new Int32Array(this.cpu);
		this.u32 = new Uint32Array(this.cpu);

		// CPU mirror of the engine `MEBuiltins` struct (noise_uv): size_obj
		// at float 0, size_img at 2, offset at 4; 32 bytes with tail padding
		this.meMirror = new Float32Array(8);

		/**
		 * last user-set value per uniform name — the clone-replay source
		 * (exact values, not mirror read-back)
		 * @type {Map<string, number|number[]>}
		 */
		this.values = new Map();

		// names already warned about, so a per-frame setUniform on an
		// unknown name doesn't flood the console
		this.warned = new Set();

		/**
		 * device-scoped GPU state, built lazily by the renderer's effect
		 * path and invalidated via the pipeline-cache epoch (device loss)
		 * @type {object|null}
		 */
		this.gpu = null;
	}

	/**
	 * Write a uniform value into the CPU mirror.
	 * @param {string} name - a struct member name of the body's uniform block
	 * @param {number|number[]|Float32Array|{val: Float32Array}} value - the value
	 *   (objects exposing `.val` — Matrix2d/3d, ColorMatrix — are unwrapped)
	 * @returns {boolean} true when the name exists and the value was written
	 */
	setUniform(name, value) {
		const placement = this.layout.get(name);
		if (typeof placement === "undefined") {
			if (!this.warned.has(name)) {
				this.warned.add(name);
				console.warn(
					`ShaderEffect: unknown WGSL uniform "${name}" (not a member of the effect's uniform struct)`,
				);
			}
			return false;
		}
		// unwrap matrix-like objects the GLSL path also accepts
		if (
			value !== null &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			ArrayBuffer.isView(value) === false &&
			typeof value.val !== "undefined"
		) {
			value = value.val;
		}
		// GLSL accepts booleans for bool/int uniforms — normalize
		if (typeof value === "boolean") {
			value = value ? 1 : 0;
		}
		const index = placement.offset >> 2;
		if (typeof value === "number") {
			if (placement.type === "i32") {
				this.i32[index] = value | 0;
			} else if (placement.type === "u32") {
				this.u32[index] = value >>> 0;
			} else {
				this.f32[index] = value;
			}
			this.values.set(name, value);
		} else if (placement.type === "mat3x3f" && value.length === 9) {
			// a 9-float column-major matrix (the uniformMatrix3fv shape):
			// WGSL mat3x3f columns are vec4-strided — place each column at
			// float offset c*4, or columns 2-3 read scrambled
			for (let column = 0; column < 3; column++) {
				for (let row = 0; row < 3; row++) {
					this.f32[index + column * 4 + row] = value[column * 3 + row];
				}
			}
			this.values.set(name, Array.from(value));
		} else {
			const array = value;
			const count = Math.min(array.length, placement.size >> 2);
			for (let i = 0; i < count; i++) {
				this.f32[index + i] = array[i];
			}
			this.values.set(name, Array.from(array));
		}
		return true;
	}

	/**
	 * whether the uniform block declares the given member (the WGSL
	 * counterpart of the GLSL active-uniform check `setTime` relies on)
	 * @param {string} name - member name
	 * @returns {boolean} true when present
	 */
	hasUniform(name) {
		return this.layout.has(name);
	}

	/**
	 * drop device-scoped state (device loss / destroy) — the CPU mirror
	 * and values survive, so nothing needs replaying on restore
	 */
	releaseGPU() {
		this.gpu = null;
	}
}
