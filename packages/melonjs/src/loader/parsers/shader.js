import { on, VIDEO_INIT } from "../../system/event.ts";
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
 * compile a shader asset's source into its shared, loader-owned ShaderEffect.
 * @param {string} source - the fragment body (uniforms + `apply(color, uv)`)
 * @returns {ShaderEffect} the compiled effect, flagged `shared`
 * @throws if called before `video.init()` (no renderer to compile against)
 * @ignore
 */
export function compileShaderAsset(source) {
	if (typeof _renderer === "undefined") {
		throw new Error(
			"shader assets require video.init() to be called first (no renderer available to compile against)",
		);
	}
	const effect = new ShaderEffect(_renderer, source);
	// loader-owned: a renderable's cleanup must never auto-destroy it —
	// only loader.unload() / unloadAll() does (see the `shared` flag)
	effect.shared = true;
	return effect;
}

/**
 * parse/preload a shader asset (a GLSL fragment body following the
 * ShaderEffect convention: uniform declarations + `vec4 apply(vec4, vec2)`),
 * from a `src` URL (or data: URI) or inline GLSL via the `data` field.
 * Always compiled into a shared ShaderEffect AT LOAD TIME, so the GLSL
 * compile cost lands in the loading screen and compile errors carry the
 * asset name. `video.init()` is an inherent precondition of the preload
 * flow (the loading screen itself needs the renderer, and a failed init
 * throws and halts) — loading a shader without it fails with a clear error.
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

	// inline GLSL source via the `data` field (same convention as inline TMX)
	if (typeof data.data === "string") {
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

	if (typeof data.src !== "string") {
		if (typeof onerror === "function") {
			onerror(
				new Error(
					`shader asset "${data.name}": needs a \`src\` URL or inline GLSL via \`data\``,
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
