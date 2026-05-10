import { plugin } from "melonjs";
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
	/** Detach every Capacitor listener wired by this plugin. */
	teardown: () => void;

	/**
	 * @param options - forwarded to the underlying `connectCapacitor`
	 *   wiring (lifecycle, back-button, audio, default-action hook).
	 */
	constructor(options: ConnectCapacitorOptions = {}) {
		super();
		// minimum melonJS version this plugin is compatible with
		this.version = "19.3.0";
		this.teardown = connectCapacitor(options);
	}
}
