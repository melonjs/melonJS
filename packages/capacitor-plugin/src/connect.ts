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
					onUnhandledBack();
				}
			}) as unknown as CapacitorListenerHandle,
		);
	}

	return () => {
		for (const h of handles) {
			void h.remove();
		}
		handles.length = 0;
	};
}
