/**
 * An effect that cannot run on its renderer (any effect on Canvas, or one with
 * no body in the renderer's shading language) warns once per page, not once
 * per effect created. The warning names no effect, so a repeat tells nothing
 * new, and printed per effect it filled the console of any game that gives
 * every sprite a glow, unless the game checked the renderer before creating
 * each one.
 *
 * The warnings already printed are remembered by `warnOnce` (lang/console.js)
 * for the page, so these tests rely on this file running in a page of its own
 * (vitest isolates each spec file) and on each test using a message no other
 * test in it triggers.
 */
import { describe, expect, it, vi } from "vitest";
import {
	BloomEffect,
	GlowEffect,
	ShaderEffect,
	SquishEffect,
} from "../src/index.js";

const GLSL_BODY = `
vec4 apply(vec4 color, vec2 uv) { return color; }
`;
const WGSL_BODY = `
fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
`;

/** create effects with console.warn spied, return the messages printed */
function warningsWhile(create) {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	try {
		const effects = create();
		return {
			effects,
			messages: warn.mock.calls.map((call) => {
				return call[0];
			}),
		};
	} finally {
		warn.mockRestore();
	}
}

describe("ShaderEffect: a disabled effect warns once per page", () => {
	it("on Canvas, the first effect warns and the next ones, built-in or custom, do not", () => {
		const canvas = { shaderLanguage: null, width: 800, height: 600 };
		const first = warningsWhile(() => {
			return [new BloomEffect(canvas, { threshold: 0.9 })];
		});
		expect(first.messages).toEqual([
			"ShaderEffect requires a GPU backend and is disabled on this renderer (no programmable pipeline)",
		]);

		// another Canvas renderer is the same page: still silent
		const otherCanvas = { shaderLanguage: null, width: 320, height: 240 };
		const next = warningsWhile(() => {
			const glow = new GlowEffect(canvas, { width: 4 });
			return [
				glow,
				new GlowEffect(otherCanvas, { width: 2 }),
				new SquishEffect(canvas, { bulge: 0.5 }),
				new ShaderEffect(canvas, { glsl: GLSL_BODY, wgsl: WGSL_BODY }),
				glow.clone(),
			];
		});
		expect(next.messages).toEqual([]);

		// silent, still disabled: every one of them is the inert stub
		for (const effect of [...first.effects, ...next.effects]) {
			expect(effect.enabled).toBe(false);
		}
	});

	it("a GLSL-only effect on WebGPU warns its own message once", () => {
		const webgpu = { shaderLanguage: "wgsl", width: 800, height: 600 };
		const { effects, messages } = warningsWhile(() => {
			return [
				new ShaderEffect(webgpu, GLSL_BODY),
				new ShaderEffect(webgpu, { glsl: GLSL_BODY }),
				new ShaderEffect(webgpu, GLSL_BODY).clone(),
			];
		});
		expect(messages).toEqual([
			"ShaderEffect has no wgsl body and is disabled on this renderer (provide a { wgsl: ... } source)",
		]);
		for (const effect of effects) {
			expect(effect.enabled).toBe(false);
		}
	});

	it("a WGSL-only effect on WebGL warns its own message once", () => {
		const webgl = { shaderLanguage: "glsl", gl: undefined };
		const { effects, messages } = warningsWhile(() => {
			return [
				new ShaderEffect(webgl, { wgsl: WGSL_BODY }),
				new ShaderEffect(webgl, { wgsl: WGSL_BODY }),
			];
		});
		expect(messages).toEqual([
			"ShaderEffect has no glsl body and is disabled on this renderer (provide a { glsl: ... } source)",
		]);
		for (const effect of effects) {
			expect(effect.enabled).toBe(false);
		}
	});
});
