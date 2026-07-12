import { on, VIDEO_INIT } from "../../system/event.ts";
import GLShader from "../../video/webgl/glshader.js";
import ShaderEffect from "../../video/webgl/shadereffect.js";
import { shaderList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

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
 * {@link ShaderEffect}; a full `{vertex, fragment}` program pair compiles
 * into a raw {@link GLShader} — for the advanced paths that take one (a
 * `Mesh` custom shader, `renderer.customShader`, a custom batcher).
 * Program pairs are WebGL-only: under the Canvas renderer a pair asset
 * stores `null` (with a warning) — a raw GL program has no canvas analog,
 * unlike ShaderEffect's inert Canvas stub.
 * @param {string|{vertex: string, fragment: string, precision?: string}} source - the fragment body, or a complete program pair
 * @returns {ShaderEffect|GLShader|null} the compiled asset, flagged `shared`
 * @throws if called before `video.init()` (no renderer to compile against)
 * @ignore
 */
export function compileShaderAsset(source) {
	if (typeof _renderer === "undefined") {
		throw new Error(
			"shader assets require video.init() to be called first (no renderer available to compile against)",
		);
	}
	if (typeof source === "object" && source !== null) {
		if (
			typeof source.vertex !== "string" ||
			typeof source.fragment !== "string"
		) {
			throw new Error(
				"a program pair needs both `vertex` and `fragment` GLSL sources",
			);
		}
		if (typeof _renderer.gl === "undefined") {
			console.warn(
				"shader asset: {vertex, fragment} program pairs require WebGL and are unavailable in Canvas mode",
			);
			return null;
		}
		const shader = new GLShader(
			_renderer.gl,
			source.vertex,
			source.fragment,
			source.precision,
		);
		shader.shared = true;
		return shader;
	}
	const effect = new ShaderEffect(_renderer, source);
	// loader-owned: a renderable's cleanup must never auto-destroy it —
	// only loader.unload() / unloadAll() does (see the `shared` flag)
	effect.shared = true;
	return effect;
}

/**
 * parse/preload a shader asset, from a `src` URL (or data: URI) or inline
 * GLSL via the `data` field. Two source shapes are accepted:
 *
 * - a GLSL **fragment body** following the ShaderEffect convention (uniform
 *   declarations + `vec4 apply(vec4, vec2)`) → compiles into a shared
 *   {@link ShaderEffect};
 * - a complete **program pair** — `src: {vertex: url, fragment: url}` or
 *   `data: {vertex: glsl, fragment: glsl}` — → compiles into a shared raw
 *   {@link GLShader}, for the advanced paths that take one (a `Mesh`
 *   custom shader, `renderer.customShader`, a custom batcher).
 *
 * Always compiled AT LOAD TIME, so the GLSL compile cost lands in the
 * loading screen and compile errors carry the asset name. `video.init()`
 * is an inherent precondition of the preload flow (the loading screen
 * itself needs the renderer, and a failed init throws and halts) —
 * loading a shader without it fails with a clear error.
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

	// `src` as a {vertex, fragment} pair of URLs → fetch both, compile a
	// raw GLShader program
	if (typeof data.src === "object" && data.src !== null) {
		if (
			typeof data.src.vertex !== "string" ||
			typeof data.src.fragment !== "string"
		) {
			if (typeof onerror === "function") {
				onerror(
					new Error(
						`shader asset "${data.name}": a program pair needs both \`src.vertex\` and \`src.fragment\` URLs`,
					),
				);
			}
			return 1;
		}
		Promise.all([
			fetchData(data.src.vertex, "text", settings),
			fetchData(data.src.fragment, "text", settings),
		])
			.then(([vertex, fragment]) => {
				// concurrent-load guard — see the single-source path below
				if (typeof shaderList[data.name] === "undefined") {
					shaderList[data.name] = compileShaderAsset({
						vertex,
						fragment,
						precision: data.precision,
					});
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
