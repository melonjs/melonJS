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
 * @returns an async teardown function. Awaiting it resolves once
 *   every Capacitor listener has been removed (using
 *   `Promise.allSettled`, so a single failed removal does not abort
 *   the rest); calling it without awaiting still detaches everything
 *   in the background.
 */
export function connectCapacitor(
	options: ConnectCapacitorOptions = {},
): () => Promise<void> {
	const {
		pauseOnBackground = true,
		pauseAudio = true,
		forwardBackButton = true,
		// Return the promise from `App.exitApp()` so a rejection flows
		// through the same async-handling path used for user-provided
		// `onUnhandledBack` handlers.
		onUnhandledBack = () => App.exitApp(),
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

	return async () => {
		const results = await Promise.allSettled(handles.map((h) => h.remove()));
		handles.length = 0;
		for (const r of results) {
			if (r.status === "rejected") {
				console.warn(
					"[@melonjs/capacitor-plugin] failed to remove Capacitor listener:",
					r.reason,
				);
			}
		}
	};
}
