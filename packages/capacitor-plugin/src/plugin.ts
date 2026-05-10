import { plugin } from "melonjs";
import { connectCapacitor } from "./connect.ts";
import type { ConnectCapacitorOptions } from "./types.ts";

// Replaced at build time by esbuild's `define`, sourced from
// `package.json` -> `peerDependencies.melonjs` (range prefix
// stripped). Keeps the compatibility floor in a single place.
declare const __MELONJS_PEER__: string;

/**
 * melonJS plugin that bridges Capacitor's native lifecycle and
 * hardware-back events into the engine. Register via
 * `plugin.register(CapacitorPlugin, "capacitor", options?)` — the
 * Capacitor wiring is installed automatically on registration.
 *
 * The instance is then accessible at `plugin.cache.capacitor`; call
 * `instance.teardown()` to detach all listeners (typically only
 * needed for hot-reload or unit tests).
 */
export class CapacitorPlugin extends plugin.BasePlugin {
	/**
	 * Detach every Capacitor listener wired by this plugin. Returns a
	 * promise that resolves once all `remove()` calls have settled —
	 * `await` it from tests / hot-reload paths for deterministic
	 * cleanup, or fire-and-forget for opportunistic detachment.
	 */
	teardown: () => Promise<void>;

	/**
	 * @param options - forwarded to the underlying `connectCapacitor`
	 *   wiring (lifecycle, back-button, audio, default-action hook).
	 */
	constructor(options: ConnectCapacitorOptions = {}) {
		super();
		// Compatibility floor: read from `peerDependencies.melonjs` at
		// build time so the version lives in one place (package.json).
		this.version = __MELONJS_PEER__;
		this.teardown = connectCapacitor(options);
	}
}
