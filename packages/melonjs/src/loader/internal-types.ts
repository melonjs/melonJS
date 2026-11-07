/**
 * The loader's internal shapes, kept out of `loader.js` on purpose: every
 * `@typedef` in a JavaScript module is an export of that module, so declared
 * there they were published on the API site as part of `loader`, whatever
 * `@ignore` / `@internal` tags they carried. Imported from here for type
 * checking only, they are not part of the public API.
 * @ignore
 */
import type { Asset } from "./loader.js";

/**
 * The progress `loader.preload` reports through `LOADER_PROGRESS`: the
 * assets asked for and how many of them have loaded.
 *
 * One tally for every preload in flight, so that a second preload started
 * before the first has settled joins it and the one progress bar keeps
 * counting, rather than two calls taking turns to move it back and forth. Once
 * every asset in it has settled (loaded or failed), the next preload starts a
 * fresh tally from zero. These counters used to live for the whole session, so
 * a second preload of two assets reported `0.75, 1` instead of `0.5, 1`, and
 * after one failed asset no later preload reached `1` at all.
 */
export interface PreloadTally {
	/** assets asked for */
	total: number;
	/** assets that loaded */
	loaded: number;
	/** assets that loaded or failed */
	settled: number;
}

/**
 * A bundle declared with `loader.setBundle`: a named list of assets with a
 * lifetime of its own, over the same caches as every other asset.
 *
 * `state` is what `setBundle` checks: a bundle is `"loading"` from a
 * `load(id)` / `preload([id])` until every asset of that call has settled,
 * `"loaded"` after that (even when one failed: it keeps the ones that did
 * load), and `"unloaded"` again after `unload(id)` or `unloadAll()`.
 * `epoch` changes on every unload, so a load still in flight from before
 * cannot hand its assets to a bundle that has since been released.
 */
export interface Bundle {
	/** the bundle's asset descriptors */
	assets: Asset[];
	/** see above */
	state: "unloaded" | "loading" | "loaded";
	/** bumped on every unload of the bundle */
	epoch: number;
	/** calls loading it that have not settled yet */
	loads: number;
}

/**
 * A registered parser, normalized by `loader.setParser`.
 *
 * Every type gets the same shape whether or not it needs the src hooks, so
 * `load()` can treat all of them alike. The alternative — a bare function that
 * some types decorate with extra properties — puts the knowledge of which
 * types are special back into the caller, which is what moving it out was for.
 */
export interface AssetParser {
	/**
	 * preloads the asset and returns how many resources it will load (0 when
	 * already cached)
	 */
	parse: (
		asset: Asset,
		onload?: (...args: unknown[]) => void,
		onerror?: (...args: unknown[]) => void,
		settings?: object,
	) => number;
	/**
	 * turns a type-specific descriptor into a bare path, before any base URL
	 * is applied. Identity unless the type overrides it
	 */
	normalizeSrc: (src: string) => string;
	/**
	 * whether the normalized src is relative to this type's base URL. Declares
	 * only this type's own exceptions, such as a `local()` font naming an
	 * installed family — data URIs are excluded for every type before this is
	 * consulted
	 */
	needsBaseURL: (src: string) => boolean;
}
