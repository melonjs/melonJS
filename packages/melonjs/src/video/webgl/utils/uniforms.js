/**
 * Hash map of GLSL data types to WebGL Uniform methods
 * @ignore
 */
const fnHash = {
	bool: "1i",
	int: "1i",
	float: "1f",
	vec2: "2fv",
	vec3: "3fv",
	vec4: "4fv",
	bvec2: "2iv",
	bvec3: "3iv",
	bvec4: "4iv",
	ivec2: "2iv",
	ivec3: "3iv",
	ivec4: "4iv",
	uvec2: "2uiv",
	uvec3: "3uiv",
	uvec4: "4uiv",
	mat2: "Matrix2fv",
	mat3: "Matrix3fv",
	mat4: "Matrix4fv",
	sampler2D: "1i",
	// WebGL2 integer-typed samplers — bound to a unit just like a
	// `sampler2D`; the GLSL `usampler2D` / `isampler2D` types let the
	// shader read raw integer values via `texelFetch` instead of the
	// normalized-float `texture()` path.
	usampler2D: "1i",
	isampler2D: "1i",
};

/**
 * Compare a freshly-incoming uniform value to the last value we sent for
 * the same uniform. Scalars compare by `===`; vec/mat values compare
 * element-wise (callers commonly reuse a scratch `Float32Array`, so
 * reference equality would miss every change).
 * @ignore
 */
function valuesMatch(cached, val) {
	if (cached === undefined) {
		return false;
	}
	if (
		val !== null &&
		typeof val === "object" &&
		typeof val.length === "number"
	) {
		if (cached.length !== val.length) {
			return false;
		}
		for (let i = 0; i < val.length; i++) {
			if (cached[i] !== val[i]) {
				return false;
			}
		}
		return true;
	}
	return cached === val;
}

/**
 * Capture the current value into the cache slot so future `setUniform`
 * calls can short-circuit. Reuses the existing slot (and its allocation)
 * when the length matches — only a length change or a first capture
 * allocates a fresh array.
 * @ignore
 */
function captureValue(prev, val) {
	if (
		val === null ||
		typeof val !== "object" ||
		typeof val.length !== "number"
	) {
		return val;
	}
	if (
		prev !== undefined &&
		typeof prev === "object" &&
		typeof prev.length === "number" &&
		prev.length === val.length
	) {
		for (let i = 0; i < val.length; i++) {
			prev[i] = val[i];
		}
		return prev;
	}
	return typeof val.slice === "function" ? val.slice() : Array.from(val);
}

/**
 * Build the `uniforms` proxy object for a compiled shader program.
 *
 * Each detected uniform gets a defineProperty getter (returns its
 * `WebGLUniformLocation`) and a setter that pushes the value to GL. The
 * setter caches the last value it sent and skips the underlying
 * `gl.uniform*` call when the incoming value matches — uniform writes are
 * cheap individually, but a typical per-frame draw pass sets a dozen of
 * them per shader, and most are layer-lifetime constants (`uMapSize`,
 * `uCellSize`, `uOpacity`, projection matrix on idle frames, etc.).
 *
 * Cache scope is per-shader: each `GLShader` calls `extractUniforms` once
 * and gets its own closure-captured `cache` map, so caches don't leak
 * across programs.
 * @ignore
 */
export function extractUniforms(gl, shader) {
	const uniforms = {};
	const uniRx = /uniform\s+(\w+)\s+(\w+)/g;
	const uniformsData = {};
	const descriptor = {};
	const locations = {};
	// last value sent to GL for each uniform, keyed by name. Filled lazily
	// on first set; reused (in place) on subsequent sets of the same
	// length to avoid steady-state allocation.
	const cache = {};
	let match;

	// Detect all uniform names and types
	[shader.vertex, shader.fragment].forEach((shader) => {
		while ((match = uniRx.exec(shader))) {
			uniformsData[match[2]] = match[1];
		}
	});

	// Get uniform references
	Object.keys(uniformsData).forEach((name) => {
		const type = uniformsData[name];
		locations[name] = gl.getUniformLocation(shader.program, name);

		descriptor[name] = {
			get: (function (name) {
				/*
				 * A getter for the uniform location
				 */
				return function () {
					return locations[name];
				};
			})(name),
			set: (function (name, type, fn) {
				if (/^mat/.test(type)) {
					/*
					 * A generic setter for uniform matrices
					 */
					return function (val) {
						if (valuesMatch(cache[name], val)) {
							return;
						}
						cache[name] = captureValue(cache[name], val);
						gl[fn](locations[name], false, val);
					};
				} else {
					/*
					 * A generic setter for uniform vectors
					 */
					return function (val) {
						let fnv = fn;
						if (val.length && !/v$/.test(fn)) {
							fnv += "v";
						}
						if (valuesMatch(cache[name], val)) {
							return;
						}
						cache[name] = captureValue(cache[name], val);
						gl[fnv](locations[name], val);
					};
				}
			})(name, type, "uniform" + fnHash[type]),
		};
	});
	Object.defineProperties(uniforms, descriptor);

	return uniforms;
}
