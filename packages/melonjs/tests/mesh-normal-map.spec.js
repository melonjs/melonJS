import { describe, expect, it } from "vitest";
import { parseMTL } from "../src/loader/parsers/mtl.js";
import { meshHasNormalMap } from "../src/video/gpu/meshmaterial.js";

/**
 * MTL normal maps (#1574) — the parsing half.
 *
 * The three spellings are the interesting part: `norm` is the only one the
 * format defines as a tangent-space normal map, while `bump` and `map_bump`
 * are specified as height maps. Every exporter worth supporting writes a
 * normal map under `map_bump`, so all three are read as normal maps — a
 * deliberate choice, and one a test should pin rather than leave to whoever
 * next reads the spec.
 */
describe("MTL normal maps", () => {
	/**
	 * @param {string} body - MTL lines under a single `newmtl`
	 * @returns {object} the parsed material
	 */
	const material = (body) => {
		return parseMTL(`newmtl probe\n${body}\n`, "assets/")["probe"];
	};

	it("reads map_bump", () => {
		expect(material("map_bump rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
	});

	it("reads the bare `bump` spelling", () => {
		expect(material("bump rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
	});

	it("reads `norm`, the one the format actually defines for this", () => {
		expect(material("norm rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
	});

	it("resolves the path against the MTL's own location", () => {
		// the same rule `map_Kd` follows — a material references its maps
		// relative to itself, not to the page
		expect(
			parseMTL("newmtl m\nmap_bump n.png\n", "assets/models/deep/")["m"]
				.map_bump,
		).toBe("assets/models/deep/n.png");
	});

	it("keeps a filename containing spaces intact", () => {
		expect(material("map_bump My Normal.png").map_bump).toBe(
			"assets/My Normal.png",
		);
	});

	it("is null on a material that declares none", () => {
		// absent must stay distinguishable from present-but-empty, since the
		// mesh only binds a second texture when there is one to bind
		expect(material("Kd 1 1 1").map_bump).toBe(null);
	});

	it("no longer warns that normal maps are unsupported", () => {
		// they were in UNSUPPORTED_MAPS, which warns once per parse. A stale
		// warning telling you a feature is missing while it works is worse
		// than no warning
		const warnings = [];
		const original = console.warn;
		console.warn = (...args) => {
			warnings.push(args.join(" "));
		};
		try {
			material("map_bump n.png");
		} finally {
			console.warn = original;
		}
		expect(warnings.join(" ")).not.toContain("map_bump");
	});

	it("still warns for maps that genuinely are unsupported", () => {
		// the guard that the previous test does not simply pass because the
		// warning was removed altogether
		const warnings = [];
		const original = console.warn;
		console.warn = (...args) => {
			warnings.push(args.join(" "));
		};
		try {
			material("map_Ks spec.png");
		} finally {
			console.warn = original;
		}
		expect(warnings.join(" ")).toContain("map_Ks");
	});
});

/**
 * Option flags on a map line.
 *
 * The format allows them on every `map_*`, but a normal map is where they
 * actually turn up: exporters write `map_Bump -bm 1.000000 rock-normal.png`
 * as a matter of course. Unstripped, the flags become part of the path, the
 * auto-fetch 404s, and the user gets two differently-worded warnings about a
 * file they never named.
 */
describe("MTL map option flags", () => {
	/**
	 * @param {string} body - MTL lines under a single `newmtl`
	 * @returns {object} the parsed material
	 */
	const material = (body) => {
		return parseMTL(`newmtl probe\n${body}\n`, "assets/")["probe"];
	};

	it("strips -bm, the one an exporter puts on a normal map", () => {
		expect(material("map_bump -bm 1.000000 rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
	});

	it("reads map_Bump, the capital an exporter actually writes", () => {
		// the format is case-sensitive and this spelling is the common one,
		// so without it the line falls through to "unknown property"
		expect(material("map_Bump -bm 1.0 rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
	});

	it("strips a multi-value flag, and stops at the filename", () => {
		// -s takes UP TO three numbers; the filename is the first token that
		// is not one, so a count-based skip would eat it on a 2-value -s
		expect(material("map_bump -s 1 1 1 rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
		expect(material("map_bump -s 1 1 rock-normal.png").map_bump).toBe(
			"assets/rock-normal.png",
		);
	});

	it("strips several flags in a row", () => {
		expect(
			material("map_bump -bm 0.5 -clamp on -o 1 2 3 rock-normal.png").map_bump,
		).toBe("assets/rock-normal.png");
	});

	it("keeps a filename with spaces intact after the flags", () => {
		expect(material("map_bump -bm 1.0 My Normal.png").map_bump).toBe(
			"assets/My Normal.png",
		);
	});

	it("leaves a line that names no file alone", () => {
		// `basePath` alone is a directory, and fetching it would 404 with a
		// message naming a file the MTL never mentioned
		expect(material("map_bump -bm 1.0").map_bump).toBe(null);
	});

	it("strips them on map_Kd and map_d as well", () => {
		// same rule, same helper — a diffuse rarely carries options but
		// nothing in the format says it cannot
		const mat = material("map_Kd -clamp on wood.png\nmap_d -bm 1.0 mask.png");
		expect(mat.map_Kd).toBe("assets/wood.png");
		expect(mat.map_d).toBe("assets/mask.png");
	});

	it("does not mistake a filename starting with a dash for a flag", () => {
		// only KNOWN flags are consumed; an unknown leading dash-token ends
		// the scan rather than swallowing the path
		expect(material("map_bump -weird.png").map_bump).toBe("assets/-weird.png");
	});
});

/**
 * `meshHasNormalMap` — the single input to the WebGPU backend's per-draw
 * "does this mesh perturb its normals" flag.
 *
 * A false negative silently disables normal mapping for a whole mesh with no
 * error of any kind; a false positive runs the perturbation on every fragment
 * of an unmapped mesh forever, for the same output. Neither shows up in a
 * screenshot, so the contract is pinned here directly.
 */
describe("meshHasNormalMap", () => {
	it("is true for a mesh-level map", () => {
		expect(meshHasNormalMap({ normalMap: {} })).toBe(true);
	});

	it("is false for a plain mesh with no groups", () => {
		expect(meshHasNormalMap({})).toBe(false);
		expect(meshHasNormalMap({ normalMap: undefined })).toBe(false);
	});

	it("is true when ANY group carries one", () => {
		expect(
			meshHasNormalMap({
				textureGroups: [{ normalMap: undefined }, { normalMap: {} }],
			}),
		).toBe(true);
	});

	it("is false when NO group carries one", () => {
		expect(
			meshHasNormalMap({
				textureGroups: [{ normalMap: undefined }, { normalMap: undefined }],
			}),
		).toBe(false);
	});

	it("is false for an empty group list", () => {
		expect(meshHasNormalMap({ textureGroups: [] })).toBe(false);
	});

	it("does not throw on the bare object the shadow-quad path passes", () => {
		// that path builds a plain literal, not a Mesh — no textureGroups at all
		expect(meshHasNormalMap({ texture: {}, indices: [] })).toBe(false);
	});
});

/**
 * The two shaders, pinned on their source.
 *
 * There is no pixel-level harness for a lit mesh here, and these three
 * properties are all invisible to a call-count test — the same reason the
 * alpha-map ordering is pinned this way in `mtl_material.spec.js`.
 */
describe("the normal-map shaders", () => {
	/**
	 * @returns {Promise<{glsl: string, wgsl: string}>} both shader sources
	 */
	const sources = async () => {
		const [glsl, wgsl] = await Promise.all([
			import("../src/video/webgl/shaders/mesh-lit.frag?raw"),
			import("../src/video/webgpu/shaders/mesh-lit.wgsl?raw"),
		]);
		return { glsl: glsl.default, wgsl: wgsl.default };
	};

	it("resolves the perturbation ABOVE the alpha cutout, in both", async () => {
		// The tangent frame comes from screen-space derivatives, and a
		// `discard` leaves them undefined for every fragment after it. WGSL
		// rejects that outright; GLSL quietly produces garbage on some
		// drivers. Moving the call below the cutout compiles fine on one
		// backend and breaks the other, which is exactly the divergence a
		// source pin exists to catch.
		const { glsl, wgsl } = await sources();
		expect(glsl.indexOf("perturbNormal(vNormal")).toBeLessThan(
			glsl.indexOf("discard;"),
		);
		expect(wgsl.indexOf("perturbNormal(in.vNormal")).toBeLessThan(
			wgsl.indexOf("discard;"),
		);
	});

	it("guards the frame normalize rather than calling normalize(), in both", async () => {
		// A face with no UV variation collapses the frame, and a texel of
		// exactly (128, 128, 128) decodes to the zero vector — together they
		// make normalize(0), which is NaN. GLSL's `mix` evaluates BOTH
		// operands, so that NaN would survive the blend as `NaN * 0.0` and
		// poison the whole lighting sum; WGSL's `select` would not, and the
		// two backends would disagree on the same fragment.
		const { glsl, wgsl } = await sources();
		expect(glsl).toContain("perturbed / max(length(perturbed), 1e-12)");
		expect(wgsl).toContain("perturbed / max(length(perturbed), 1e-12)");
		expect(glsl).not.toContain("normalize(perturbed)");
		expect(wgsl).not.toContain("normalize(perturbed)");
	});

	it("weights the sample rather than branching, in both", async () => {
		// the shape that keeps the WGSL fetch in uniform control flow, and
		// the shape #1572 diverged on when one backend branched
		const { glsl, wgsl } = await sources();
		expect(glsl).toContain("uHasNormalMap > 0.5");
		expect(wgsl).toContain("uMesh.params.z > 0.5");
	});

	it("defines perturbNormal ABOVE @vertex, where the instanced splice keeps it", async () => {
		// `buildInstancedMeshWGSL` assembles the derived module as
		// head + generated vertex stage + fragment stage, so a helper defined
		// BETWEEN the two stages loses its definition while the fragment
		// keeps the call. The module then fails to compile on every frame an
		// instanced lit mesh is drawn — silently, with a black canvas and no
		// console error. `webgpu_mesh_instanced.spec.js` guards the general
		// rule; this pins the position directly.
		const { wgsl } = await sources();
		// matched the way the splice itself matches — at line start, so a
		// mention of `@vertex` in prose above cannot satisfy this
		const vertexAt = wgsl.search(/^@vertex\b/m);
		expect(vertexAt).toBeGreaterThan(-1);
		expect(wgsl.search(/^fn perturbNormal\b/m)).toBeLessThan(vertexAt);
	});
});
