import { describe, expect, it } from "vitest";
import { parseMTL } from "../src/loader/parsers/mtl.js";

/**
 * `Ka` and `illum` (#1599).
 *
 * Both are read onto the material so an authored value is not silently
 * dropped, and both are deliberately kept out of shading. `Ka` predates
 * scene-wide ambient light and would fight `Stage.ambientLightingColor`;
 * `illum` enumerates fixed-function behaviours from the Phong era and
 * describes a pipeline this renderer does not have.
 *
 * The important half of this file is the last block: a model carrying these
 * fields must render byte-identically to one that does not.
 */
describe("MTL ambient and illumination model", () => {
	/**
	 * @param {string} body - MTL lines under a single `newmtl`
	 * @returns {object} the parsed material
	 */
	const material = (body) => {
		return parseMTL(`newmtl probe\n${body}\n`, "assets/")["probe"];
	};

	describe("Ka", () => {
		it("is read as an [r, g, b] triple", () => {
			expect(material("Ka 0.25 0.5 0.75").Ka).toEqual([0.25, 0.5, 0.75]);
		});

		it("is null when the material declares none", () => {
			// absent must stay distinguishable from an authored value
			expect(material("Kd 1 1 1").Ka).toBe(null);
		});

		it("keeps an authored black, which is not the same as absent", () => {
			// `Ka 0 0 0` is a deliberate statement; `null` is silence
			expect(material("Ka 0 0 0").Ka).toEqual([0, 0, 0]);
		});
	});

	describe("illum", () => {
		it("is read as an integer", () => {
			expect(material("illum 2").illum).toBe(2);
		});

		it("keeps 0, which is a meaningful model and not a missing one", () => {
			// `illum 0` means colour on / ambient off — the reason the default
			// is null rather than 0
			expect(material("illum 0").illum).toBe(0);
		});

		it("is null when the material declares none", () => {
			expect(material("Kd 1 1 1").illum).toBe(null);
		});

		it("reads the higher fixed-function models without complaint", () => {
			// 3..10 describe reflection and raytrace modes this renderer has
			// no equivalent for; they are reported, not obeyed
			expect(material("illum 7").illum).toBe(7);
		});
	});

	describe("neither is wired into shading", () => {
		it("does not disturb the terms the renderer does use", () => {
			// the guard that matters: adding these fields must not alter how
			// an existing model shades
			const withAmbient = material(
				"Kd 0.8 0.2 0.2\nKs 1 1 1\nNs 60\nKa 0.9 0.9 0.9\nillum 1",
			);
			const without = material("Kd 0.8 0.2 0.2\nKs 1 1 1\nNs 60");
			expect(withAmbient.Kd).toEqual(without.Kd);
			expect(withAmbient.Ks).toEqual(without.Ks);
			expect(withAmbient.Ns).toEqual(without.Ns);
			expect(withAmbient.Ke).toEqual(without.Ke);
			expect(withAmbient.d).toEqual(without.d);
		});

		it("an illum that forbids highlights does NOT suppress the specular", () => {
			// `illum 0`/`1` technically mean "no specular". Obeying that would
			// silently restyle models that render correctly today, so the
			// exponent stays the only gate — see the ticket
			expect(material("Ks 1 1 1\nNs 120\nillum 0").Ns).toBe(120);
			expect(material("Ks 1 1 1\nNs 120\nillum 0").Ks).toEqual([1, 1, 1]);
		});
	});

	describe("the PBR extension's texture maps", () => {
		/**
		 * @param {string} body - MTL lines under a single `newmtl`
		 * @returns {string} everything warned while parsing
		 */
		const warningsFor = (body) => {
			const seen = [];
			const original = console.warn;
			console.warn = (...args) => {
				seen.push(args.join(" "));
			};
			try {
				parseMTL(`newmtl probe\n${body}\n`, "assets/");
			} finally {
				console.warn = original;
			}
			return seen.join(" ");
		};

		it("are reported as unsupported, not as unknown", () => {
			// they are declined on purpose — the scalars are approximated onto
			// the existing terms, the maps would need a real PBR model — so an
			// exporter writing them should be told which of the two it is
			expect(warningsFor("map_Pr rough.png")).toContain("not supported");
			expect(warningsFor("map_Pr rough.png")).not.toContain("unknown");
			expect(warningsFor("map_Pm metal.png")).toContain("not supported");
			expect(warningsFor("map_Pm metal.png")).not.toContain("unknown");
		});

		it("the SCALARS are still read, and still approximated", () => {
			// the half this ticket does not decline
			const m = parseMTL("newmtl probe\nPr 0.3\nPm 0.8\n", "")["probe"];
			expect(m.Pr).toBe(0.3);
			expect(m.Pm).toBe(0.8);
		});

		it("a genuinely unknown property is still called unknown", () => {
			// the guard that the above is not just a blanket message change
			expect(warningsFor("map_Nonsense x.png")).toContain("unknown");
		});
	});

	it("neither warns: they are supported properties now, not unknown ones", () => {
		const warnings = [];
		const original = console.warn;
		console.warn = (...args) => {
			warnings.push(args.join(" "));
		};
		try {
			material("Ka 0.2 0.2 0.2\nillum 2");
		} finally {
			console.warn = original;
		}
		expect(warnings.join(" ")).not.toContain("Ka");
		expect(warnings.join(" ")).not.toContain("illum");
	});
});
