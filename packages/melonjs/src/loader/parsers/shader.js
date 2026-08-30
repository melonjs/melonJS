import { on, VIDEO_INIT } from "../../system/event.ts";
import { fetchData } from "../../utils/fetchdata.js";
import ShaderEffect from "../../video/effects/shadereffect.js";
import GLShader from "../../video/webgl/glshader.js";
import { shaderList } from "../cache.js";

// a `wgsl` source is either an effect BODY (the apply() convention — the
// realization generates the vertex stage around it) or a complete MODULE
// (a custom mesh shader). A module must declare its own `@vertex` entry
// point named `vertex_main`; a body never legally can — the realization
// already emits one, so a body containing it would fail compilation
// anyway. Comments are stripped before sniffing: a body whose comment
// merely MENTIONS "@vertex" must not be misrouted into a raw program.
const WGSL_MODULE = /@vertex\b[\s\S]*?\bfn\s+vertex_main\b/;
const WGSL_COMMENTS = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;

function isWGSLModule(source) {
	return WGSL_MODULE.test(source.replace(WGSL_COMMENTS, ""));
}

let _renderer;

// gracefully capture a reference to the active renderer without adding more
// cyclic redundancy (same pattern as the compressed-textures parser). `on`
// rather than `once` so a re-init (renderer switch, tests) stays current.
on(VIDEO_INIT, (renderer) => {
	_renderer = renderer;
});

/**
 * compile a shader asset's source into its shared, loader-owned instance:
 * a fragment body (the `apply()` convention) compiles into a
 * {@link ShaderEffect}; a complete program — a `{vertex, fragment}` GLSL
 * pair and/or a `wgsl` full module, either omittable — compiles into a
 * {@link GLShader} carrying whichever realizations were declared, for the
 * hosted paths that take one (a `Mesh` custom shader,
 * `renderer.customShader`, a custom batcher). The active renderer hosts
 * the realization it speaks; a shader without one for this backend is
 * inert — assigning it degrades to built-in shading, never fails.
 * @param {string|object} source - the fragment body (or `{glsl, wgsl}`
 * bodies), or a complete program: `{vertex, fragment, wgsl?, precision?}`
 * @returns {ShaderEffect|GLShader} the compiled asset, flagged `shared`
 * @throws if called before any `app.init()` resolved (no renderer to compile against)
 * @ignore
 */
export function compileShaderAsset(source) {
	if (typeof _renderer === "undefined") {
		throw new Error(
			"shader assets require an initialized Application — `await app.init()` first (no renderer available to compile against)",
		);
	}
	if (typeof source === "object" && source !== null) {
		const hasPair =
			typeof source.vertex === "string" && typeof source.fragment === "string";
		// a wgsl source that declares an @vertex vertex_main is a complete
		// module (a custom mesh shader), not an effect body — see above
		const wgslModule =
			typeof source.wgsl === "string" && isWGSLModule(source.wgsl)
				? source.wgsl
				: null;

		// complete-program shapes → one GLShader carrying every declared
		// realization; `renderer.gl` is undefined on non-WebGL backends,
		// which simply skips the GLSL compile (isWebGL stays false)
		if (hasPair || wgslModule !== null) {
			const shader = new GLShader(_renderer.gl, {
				vertex: source.vertex,
				fragment: source.fragment,
				precision: source.precision,
				wgsl: wgslModule ?? undefined,
				label: "melonJS shader asset",
			});
			shader.shared = true;
			return shader;
		}

		// dual-language fragment bodies ({glsl, wgsl} — either may be
		// omitted): the ShaderEffect constructor picks the body matching
		// the renderer's shading language, and degrades to the inert stub
		// when none matches — the preload itself always succeeds
		if (typeof source.glsl === "string" || typeof source.wgsl === "string") {
			const effect = new ShaderEffect(_renderer, source);
			effect.shared = true;
			return effect;
		}
		throw new Error(
			"a program pair needs both `vertex` and `fragment` GLSL sources",
		);
	}
	const effect = new ShaderEffect(_renderer, source);
	// loader-owned: a renderable's cleanup must never auto-destroy it —
	// only loader.unload() / unloadAll() does (see the `shared` flag)
	effect.shared = true;
	return effect;
}

/**
 * parse/preload a shader asset, from a `src` URL (or data: URI) or inline
 * source via the `data` field. Three source shapes are accepted:
 *
 * - a GLSL **fragment body** following the ShaderEffect convention (uniform
 *   declarations + `vec4 apply(vec4, vec2)`) → compiles into a shared
 *   {@link ShaderEffect};
 * - a **dual-language body** — `src: {glsl: url, wgsl: url}` or
 *   `data: {glsl: source, wgsl: source}`, either language omittable — →
 *   a shared {@link ShaderEffect} carrying one body per shading language;
 *   the renderer compiles the matching one, and when none matches the
 *   preload still succeeds with an inert (`enabled === false`) effect;
 * - a complete **program** — `src: {vertex: url, fragment: url}` (GLSL
 *   pair), `src: {wgsl: url}` where the WGSL declares its own `@vertex`
 *   entry point (a complete module), or both together for a dual-backend
 *   asset — → compiles into a shared raw {@link GLShader} carrying the
 *   declared realizations (`isWebGL` / `isWebGPU`), for the hosted paths
 *   that take one (a `Mesh` custom shader, `renderer.customShader`, a
 *   custom batcher); the active renderer hosts the realization it speaks
 *   and a missing one degrades to built-in shading.
 *
 * Always compiled AT LOAD TIME, so the GLSL compile cost lands in the
 * loading screen and compile errors carry the asset name. An initialized
 * Application (`await app.init()`) is an inherent precondition of the
 * preload flow (the loading screen itself needs the renderer, and a failed
 * init rejects and halts) — loading a shader without it fails with a clear
 * error.
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadShader(data, onload, onerror, settings) {
	if (typeof shaderList[data.name] !== "undefined") {
		// already loaded
		return 0;
	}

	// inline GLSL source via the `data` field (same convention as inline
	// TMX): a fragment-body string, or a {vertex, fragment} program pair
	if (
		typeof data.data === "string" ||
		(typeof data.data === "object" && data.data !== null)
	) {
		try {
			shaderList[data.name] = compileShaderAsset(data.data);
		} catch (error) {
			if (typeof onerror === "function") {
				onerror(new Error(`shader asset "${data.name}": ${error.message}`));
			}
			return 1;
		}
		if (typeof onload === "function") {
			onload();
		}
		return 1;
	}

	// `src` as an object of URLs — {glsl, wgsl} effect bodies, a
	// {vertex, fragment} GLSL program pair, or a complete dual-backend
	// program {vertex, fragment, wgsl}: fetch whatever is declared and
	// let compileShaderAsset dispatch on the assembled shape
	if (typeof data.src === "object" && data.src !== null) {
		const fields = ["glsl", "wgsl", "vertex", "fragment"].filter((field) => {
			return typeof data.src[field] === "string";
		});
		const pairComplete =
			(typeof data.src.vertex === "string") ===
			(typeof data.src.fragment === "string");
		if (fields.length === 0 || !pairComplete) {
			if (typeof onerror === "function") {
				onerror(
					new Error(
						fields.length === 0
							? `shader asset "${data.name}": \`src\` needs {glsl, wgsl} body URLs and/or a {vertex, fragment} program pair`
							: `shader asset "${data.name}": a program pair needs both \`src.vertex\` and \`src.fragment\` URLs`,
					),
				);
			}
			return 1;
		}
		Promise.all(
			fields.map((field) => {
				return fetchData(data.src[field], "text", settings);
			}),
		)
			.then((sources) => {
				// concurrent-load guard — see the single-source path below
				if (typeof shaderList[data.name] === "undefined") {
					const parts = {};
					fields.forEach((field, index) => {
						parts[field] = sources[index];
					});
					if (typeof data.precision === "string") {
						parts.precision = data.precision;
					}
					shaderList[data.name] = compileShaderAsset(parts);
				}
				if (typeof onload === "function") {
					onload();
				}
			})
			.catch((error) => {
				if (typeof onerror === "function") {
					onerror(new Error(`shader asset "${data.name}": ${error.message}`));
				}
			});
		return 1;
	}

	if (typeof data.src !== "string") {
		if (typeof onerror === "function") {
			onerror(
				new Error(
					`shader asset "${data.name}": needs a \`src\` URL (or {vertex, fragment} URL pair), or inline GLSL via \`data\``,
				),
			);
		}
		return 1;
	}

	fetchData(data.src, "text", settings)
		.then((source) => {
			// a concurrent load for the same name may have stored while this
			// fetch was in flight — compiling again would orphan a live GL
			// program (pinned by its context-loss event subscriptions, so
			// never GC-eligible and unreachable by unload)
			if (typeof shaderList[data.name] === "undefined") {
				shaderList[data.name] = compileShaderAsset(source);
			}
			if (typeof onload === "function") {
				onload();
			}
		})
		.catch((error) => {
			if (typeof onerror === "function") {
				onerror(new Error(`shader asset "${data.name}": ${error.message}`));
			}
		});

	return 1;
}
