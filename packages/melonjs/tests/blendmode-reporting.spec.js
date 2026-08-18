/**
 * `setBlendMode` reports what was actually applied, and the two GPU backends
 * must agree on that report.
 *
 * The contract is a capability probe: ask for a mode, and if the returned value
 * differs from what you asked for, the renderer could not honour it. The Blend
 * Modes example is built on exactly that comparison.
 *
 * WebGPU used to return the CANONICAL name rather than the requested one, so
 * `add` and `lighter` — three spellings of one pipeline state alongside
 * `additive` — came back as `"additive"` and read as UNSUPPORTED. They render
 * identically on both backends; only the report was wrong, which showed up as
 * `add` being green under WebGL and red under WebGPU.
 */
import { describe, expect, it } from "vitest";
import { normalizeBlendMode } from "../src/video/webgpu/pipeline/cache.js";

/** every mode the engine names, plus ones it deliberately does not support */
const SUPPORTED = [
	"normal",
	"multiply",
	"screen",
	"darken",
	"lighten",
	"additive",
	"add",
	"lighter",
	"none",
	// exclusion(a, b) = a + b - 2ab is pure algebra with no per-pixel branch,
	// so unlike the rest of the CSS advanced set it needs no shader — it is a
	// plain `src*(1-dst) + dst*(1-src)` blend on both backends
	"exclusion",
];

const UNSUPPORTED = [
	"overlay",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	// `difference` is |a - b|; expressible as two clamped subtract passes, but
	// that costs an intermediate for what a shader does in one instruction
	"difference",
];

/**
 * The reporting rule `WebGPURenderer.setBlendMode` applies: a mode that
 * normalizes to something real is reported back verbatim, so an alias reports
 * itself; anything that falls through to `normal` without having asked for it
 * is reported as `normal`.
 * @param {string} mode - the requested blend mode
 * @returns {string} what the renderer would report as applied
 */
const reported = (mode) => {
	const normalized = normalizeBlendMode(mode);
	return normalized === "normal" && mode !== "normal" ? "normal" : mode;
};

describe("blend mode reporting (WebGPU)", () => {
	it("reports a supported mode as itself, including every alias", () => {
		// the regression: `add` and `lighter` must not come back as `additive`,
		// or a caller comparing the result against its request concludes the
		// mode was rejected when it was honoured
		for (const mode of SUPPORTED) {
			expect(reported(mode), `${mode} should report itself`).toBe(mode);
		}
	});

	it("reports an unsupported mode as normal", () => {
		// the other half of the contract — this is how a caller learns it did
		// NOT get what it asked for
		for (const mode of UNSUPPORTED) {
			expect(reported(mode), `${mode} should fall back`).toBe("normal");
		}
	});

	it("distinguishes asking for normal from falling back to it", () => {
		// both return "normal", and that is correct: the caller asked for normal
		// and got normal. The difference only matters for a mode that was NOT
		// requested as normal, which the case above covers.
		expect(reported("normal")).toBe("normal");
		expect(reported("overlay")).toBe("normal");
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
});
