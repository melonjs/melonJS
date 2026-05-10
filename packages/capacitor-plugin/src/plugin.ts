import { plugin } from "melonjs";
import packageJson from "../package.json" with { type: "json" };
import { connectCapacitor } from "./connect.ts";
import type { ConnectCapacitorOptions } from "./types.ts";

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
		// Compatibility floor: read straight from `peerDependencies.melonjs`
		// so the version lives in one place (package.json). The engine's
		// `checkVersion` regex picks the digits out of the range string,
		// so the leading `>=` / `^` / `~` is harmless.
		this.version = packageJson.peerDependencies.melonjs;
		this.teardown = connectCapacitor(options);
	}
}
