import { App } from "@capacitor/app";
import { state } from "melonjs";
import { emitBackEvent } from "./back-event.ts";
import type { ConnectCapacitorOptions } from "./types.ts";

interface CapacitorListenerHandle {
	remove(): Promise<void>;
}

/**
 * Wire Capacitor's lifecycle and back-button events into the engine.
 * Most users should register `CapacitorPlugin` instead of calling
 * this directly.
 * @param options - tuning for which events to forward and the default
 *   action when no handler intercepts a back press.
 * @returns a teardown function that removes every listener installed.
 */
export function connectCapacitor(
	options: ConnectCapacitorOptions = {},
): () => void {
	const {
		pauseOnBackground = true,
		pauseAudio = true,
		forwardBackButton = true,
		onUnhandledBack = () => {
			void App.exitApp();
		},
	} = options;

	const handles: CapacitorListenerHandle[] = [];

	if (pauseOnBackground) {
		handles.push(
			App.addListener("appStateChange", ({ isActive }) => {
				if (isActive) {
					state.resume(pauseAudio);
				} else {
					state.pause(pauseAudio);
				}
			}) as unknown as CapacitorListenerHandle,
		);
	}

	if (forwardBackButton) {
		handles.push(
			App.addListener("backButton", () => {
				if (!emitBackEvent()) {
					// `onUnhandledBack` is allowed to be async; wrap so a
					// thrown / rejected promise surfaces as a console
					// warning instead of an unhandled rejection.
					try {
						const ret = onUnhandledBack();
						if (ret && typeof ret.then === "function") {
							ret.catch((err: unknown) => {
								console.warn(
									"[@melonjs/capacitor-plugin] onUnhandledBack rejected:",
									err,
								);
							});
						}
					} catch (err) {
						console.warn(
							"[@melonjs/capacitor-plugin] onUnhandledBack threw:",
							err,
						);
					}
				}
			}) as unknown as CapacitorListenerHandle,
		);
	}

	return () => {
		for (const h of handles) {
			h.remove().catch((err: unknown) => {
				console.warn(
					"[@melonjs/capacitor-plugin] failed to remove Capacitor listener:",
					err,
				);
			});
		}
		handles.length = 0;
	};
}
