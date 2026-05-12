import { describe, expect, it } from "vitest";
import { extractUniforms } from "../src/video/webgl/utils/uniforms.js";

/**
 * Builds a minimal stub GL context that records every `uniform*` call.
 * `extractUniforms` only needs `getUniformLocation` and the `uniformX`
 * methods it actually invokes; everything else can be left out.
 */
function makeStubGL() {
	const calls = [];
	function record(name) {
		return function (...args) {
			calls.push({ name, args });
		};
	}
	return {
		calls,
		getUniformLocation(program, name) {
			return { name };
		},
		uniform1i: record("uniform1i"),
		uniform1f: record("uniform1f"),
		uniform2fv: record("uniform2fv"),
		uniform4fv: record("uniform4fv"),
		uniformMatrix4fv: record("uniformMatrix4fv"),
	};
}

function makeShader(fragmentSrc) {
	return {
		vertex: "",
		fragment: fragmentSrc,
		program: {},
	};
}

function countCalls(gl, name) {
	let n = 0;
	for (const c of gl.calls) {
		if (c.name === name) {
			n++;
		}
	}
	return n;
}

describe("uniform caching", () => {
	it("skips the GL call when the same scalar is set twice", () => {
		const gl = makeStubGL();
		const uniforms = extractUniforms(
			gl,
			makeShader("uniform float uOpacity;\nuniform int uMode;"),
		);

		uniforms.uOpacity = 0.5;
		uniforms.uOpacity = 0.5;
		uniforms.uOpacity = 0.5;
		expect(countCalls(gl, "uniform1f")).toBe(1);

		uniforms.uMode = 7;
		uniforms.uMode = 7;
		expect(countCalls(gl, "uniform1i")).toBe(1);
	});

	it("emits a fresh GL call when the scalar changes", () => {
		const gl = makeStubGL();
		const uniforms = extractUniforms(gl, makeShader("uniform float uOpacity;"));

		uniforms.uOpacity = 0.5;
		uniforms.uOpacity = 0.75;
		uniforms.uOpacity = 0.5;
		expect(countCalls(gl, "uniform1f")).toBe(3);
	});

	it("compares vec values element-wise, not by reference", () => {
		const gl = makeStubGL();
		const uniforms = extractUniforms(gl, makeShader("uniform vec2 uPos;"));

		// Same values, three different array instances — cache hit.
		uniforms.uPos = new Float32Array([10, 20]);
		uniforms.uPos = new Float32Array([10, 20]);
		uniforms.uPos = [10, 20];
		expect(countCalls(gl, "uniform2fv")).toBe(1);
	});

	it("detects in-place mutation of a reused scratch buffer", () => {
		const gl = makeStubGL();
		const uniforms = extractUniforms(gl, makeShader("uniform vec2 uPos;"));

		// Realistic hot-path: caller keeps a scratch Float32Array and
		// rewrites it before each setUniform — the cache must compare by
		// value so a mutated buffer is detected as a change.
		const scratch = new Float32Array(2);
		scratch[0] = 1;
		scratch[1] = 2;
		uniforms.uPos = scratch;

		scratch[0] = 3;
		scratch[1] = 4;
		uniforms.uPos = scratch;

		scratch[0] = 3;
		scratch[1] = 4;
		uniforms.uPos = scratch;

		expect(countCalls(gl, "uniform2fv")).toBe(2);
	});

	it("treats different uniforms with the same value as independent", () => {
		const gl = makeStubGL();
		const uniforms = extractUniforms(
			gl,
			makeShader("uniform vec2 uA;\nuniform vec2 uB;"),
		);

		uniforms.uA = new Float32Array([1, 2]);
		uniforms.uB = new Float32Array([1, 2]);
		// Different uniforms — both must emit.
		expect(countCalls(gl, "uniform2fv")).toBe(2);
	});

	it("caches matrix uploads element-wise", () => {
		const gl = makeStubGL();
		const uniforms = extractUniforms(gl, makeShader("uniform mat4 uProj;"));

		const m = new Float32Array(16);
		m[0] = 1;
		m[5] = 1;
		m[10] = 1;
		m[15] = 1;
		uniforms.uProj = m;
		uniforms.uProj = new Float32Array(m);
		expect(countCalls(gl, "uniformMatrix4fv")).toBe(1);

		m[12] = 100;
		uniforms.uProj = m;
		expect(countCalls(gl, "uniformMatrix4fv")).toBe(2);
	});

	it("keeps caches independent across shaders sharing a GL context", () => {
		const gl = makeStubGL();
		const a = extractUniforms(gl, makeShader("uniform float uOpacity;"));
		const b = extractUniforms(gl, makeShader("uniform float uOpacity;"));

		a.uOpacity = 0.5;
		b.uOpacity = 0.5;
		// Each shader has its own cache — shader B's first write must
		// reach GL or its uniform would be left at the default value.
		expect(countCalls(gl, "uniform1f")).toBe(2);
	});
});
