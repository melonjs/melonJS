/**
 * Documentation entry point: the engine plus every official plugin.
 *
 * Typedoc is pointed at THIS file rather than at each package, and that is
 * deliberate. Given several entry points it namespaces every symbol by its
 * module, so `classes/Sprite.html` becomes `classes/melonjs_src.Sprite.html`
 * and every published link, wiki page and bookmark breaks. With one entry
 * point the layout stays flat, so the plugins join the site without moving
 * the engine's pages.
 *
 * One site rather than one per plugin, so that a single search index covers
 * engine and plugins together, `llms.txt` indexes the plugin pages with
 * everything else, and `{@link}` references from a plugin resolve to the
 * engine types they are about. The cost is that a plugin's README is a
 * linked page rather than its landing page; `@document` on each plugin class
 * is what carries it in.
 *
 * Plugin symbols are re-exported by name rather than with `export *`, because
 * both physics adapters export a `REQUIRED_MELONJS_VERSION` constant and a
 * flat namespace cannot hold two of them. Each plugin's own `@category
 * Plugins` tag is what groups them in the navigation.
 *
 * Not part of the published package: `files` ships `build/` only.
 */
export * from "../../src/index.ts";

export { CapacitorPlugin } from "../../../capacitor-plugin/src/index.ts";
export { DebugPanelPlugin } from "../../../debug-plugin/src/index.js";
export {
	MatterAdapter,
	type MatterAdapterOptions,
} from "../../../matter-adapter/src/index.ts";
export {
	PlanckAdapter,
	type PlanckAdapterOptions,
} from "../../../planck-adapter/src/index.ts";
export { SpinePlugin } from "../../../spine-plugin/src/index.js";
export { TiledInflatePlugin } from "../../../tiled-inflate-plugin/src/index.js";
