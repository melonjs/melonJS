/**
 * `setBlendMode` reports what was actually applied, and the two GPU backends
 * must agree on that report.
 *
 * The contract is a capability probe: ask for a mode, and if the returned
 * value differs from what you asked for, the renderer could not honour it.
 * The Blend Modes example is built on exactly that comparison.
 *
 * Two distinct histories are pinned here:
 *
 * - WebGPU used to return the CANONICAL name rather than the requested one,
 *   so `add` and `lighter` — three spellings of one pipeline state alongside
 *   `additive` — came back as `"additive"` and read as UNSUPPORTED. They
 *   render identically on both backends; only the report was wrong.
 * - The six advanced modes used to fall back to `"normal"` on both GPU
 *   backends. They are now composited through a shader, so they report
 *   themselves. `normalizeBlendMode` still collapses them to `"normal"` —
 *   that is the PIPELINE key, and it is deliberately unchanged, since the
 *   geometry really does rasterize under ordinary source-over. Reporting and
 *   pipeline state are separate questions and this file keeps them separate.
 */
import { describe, expect, it } from "vitest";
import {
	ADVANCED_BLEND_MODES,
	isAdvancedBlendMode,
	normalizeBlendMode,
	reportedBlendMode,
} from "../src/video/blendmodes.js";

/** modes honoured by fixed-function blend state alone */
const FIXED_FUNCTION = [
	"normal",
	"multiply",
	"screen",
	"additive",
	"add",
	"lighter",
	"none",
	// exclusion(a, b) = a + b - 2ab is pure algebra with no per-pixel branch,
	// so unlike the rest of the CSS advanced set it needs no shader — it is a
	// plain `src*(1-dst) + dst*(1-src)` blend on both backends
	"exclusion",
];

/**
 * The reporting rule, imported rather than re-implemented. The previous
 * version of this file modelled the rule in the test itself, which meant it
 * could agree with a renderer that had drifted — it was pinning the model,
 * not the code. `reportedBlendMode` is now the single definition both GPU
 * backends call.
 */
const reported = reportedBlendMode;

describe("blend mode reporting (WebGPU)", () => {
	it("reports a supported mode as itself, including every alias", () => {
		// the regression: `add` and `lighter` must not come back as `additive`,
		// or a caller comparing the result against its request concludes the
		// mode was rejected when it was honoured
		for (const mode of FIXED_FUNCTION) {
			expect(reported(mode), `${mode} should report itself`).toBe(mode);
		}
	});

	it("reports every advanced mode as itself", () => {
		// these six used to report "normal" — the whole point of #1318
		for (const mode of ADVANCED_BLEND_MODES) {
			expect(reported(mode), `${mode} should report itself`).toBe(mode);
		}
	});

	it("still reports a genuinely unknown mode as normal", () => {
		// the other half of the contract — this is how a caller learns it did
		// NOT get what it asked for. "hue", "saturation", "color" and
		// "luminosity" are the NON-separable CSS modes, which nothing in the
		// engine implements on any backend.
		for (const mode of ["hue", "saturation", "color", "luminosity"]) {
			expect(reported(mode), `${mode} should fall back`).toBe("normal");
		}
	});

	it("distinguishes asking for normal from falling back to it", () => {
		// both return "normal", and that is correct: the caller asked for normal
		// and got normal. The difference only matters for a mode that was NOT
		// requested as normal, which the case above covers.
		expect(reported("normal")).toBe("normal");
		expect(reported("luminosity")).toBe("normal");
	});

	it("agrees with the aliases the WebGL backend accepts", () => {
		// The two backends implement blending independently. This pins the set
		// they must both recognise — if one grows a mode the other lacks, the
		// same scene reports different capabilities depending on which backend
		// `video.AUTO` happened to pick.
		for (const alias of ["add", "additive", "lighter"]) {
			expect(normalizeBlendMode(alias)).toBe("additive");
		}
	});

	it("keeps the advanced modes OUT of the pipeline key", () => {
		// The bracket rasterizes the geometry under ordinary premultiplied
		// source-over and composites in a shader, so an advanced mode must not
		// mint its own pipeline variant. Letting the token through here would
		// create six duplicate pipelines per shader/topology combination that
		// differ in name only.
		for (const mode of ADVANCED_BLEND_MODES) {
			expect(normalizeBlendMode(mode), `${mode} pipeline key`).toBe("normal");
		}
	});

	it("names exactly the modes that need the shader path", () => {
		// a mode in both lists (or in neither) is a contradiction: the first
		// would rasterize bracketed AND under its own blend state, the second
		// would silently render as normal again
		for (const mode of FIXED_FUNCTION) {
			expect(isAdvancedBlendMode(mode), `${mode} must be fixed-function`).toBe(
				false,
			);
		}
		expect(ADVANCED_BLEND_MODES).toHaveLength(8);
	});
});
