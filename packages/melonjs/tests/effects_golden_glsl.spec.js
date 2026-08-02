import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShaderEffect, VignetteEffect } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Golden test for the GLSL sources ShaderEffect assembles around a user
 * fragment body — the backward-compatibility proof for the neutral-effects
 * refactor: hoisting ShaderEffect out of the WebGL tree and splitting the
 * realization must keep the generated GLSL BYTE-IDENTICAL, so existing
 * custom effects compile to exactly the same programs.
 *
 * The snapshots (tests/__snapshots__/effects_golden_glsl.spec.js.snap) were
 * generated against the pre-refactor assembly and are committed — a
 * mismatch means the refactor changed the emitted source, which is a
 * regression by definition (run with `--update` ONLY for a deliberate,
 * changelog-worthy change to the assembly).
 */

// exercises every builtin at once: an annotated screen_texture sampler
// (with wrap mode), screen_uv, noise_uv, a user uniform and uTime
const ALL_BUILTINS_BODY = `
uniform sampler2D uScene : screen_texture(repeat);
uniform float uStrength;
uniform float uTime;
vec4 apply(vec4 color, vec2 uv) {
	vec4 scene = texture2D(uScene, screen_uv);
	vec2 n = noise_uv;
	return mix(color, scene, uStrength * n.x + uTime * 0.0);
}
`;

// no builtins: must ride the stock quad vertex shader untouched
const PLAIN_BODY = `
uniform float uStrength;
vec4 apply(vec4 color, vec2 uv) {
	return vec4(color.rgb * uStrength, color.a);
}
`;

describe("ShaderEffect generated-GLSL golden", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	it("a body using every builtin assembles to the pinned sources", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const effect = new ShaderEffect(renderer, ALL_BUILTINS_BODY);
		expect(effect._shader._sourceVertex).toMatchSnapshot("all-builtins vertex");
		expect(effect._shader._sourceFragment).toMatchSnapshot(
			"all-builtins fragment",
		);
		effect.destroy();
	});

	it("a builtin-free body assembles to the pinned sources (stock vertex)", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const effect = new ShaderEffect(renderer, PLAIN_BODY);
		expect(effect._shader._sourceVertex).toMatchSnapshot("plain vertex");
		expect(effect._shader._sourceFragment).toMatchSnapshot("plain fragment");
		effect.destroy();
	});

	it("a built-in effect class assembles to its pinned sources", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		const effect = new VignetteEffect(renderer);
		expect(effect._shader._sourceFragment).toMatchSnapshot("vignette fragment");
		effect.destroy();
	});
});
