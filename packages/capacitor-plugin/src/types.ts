/**
 * Event payload dispatched on every Capacitor hardware-back press.
 * Mirrors the DOM `Event` shape: handlers can call `preventDefault()`
 * to keep the engine from running the default action (typically
 * exiting the app).
 */
export interface CapacitorBackEvent {
	readonly defaultPrevented: boolean;
	preventDefault(): void;
}

/**
 * Options accepted by `CapacitorPlugin` (and the underlying
 * `connectCapacitor` wiring).
 */
export interface ConnectCapacitorOptions {
	/**
	 * Auto-pause the engine when the app goes to background and
	 * resume when it comes back. Default `true`.
	 */
	pauseOnBackground?: boolean;

	/**
	 * Forwarded to `state.pause(music)` / `state.resume(music)` —
	 * also pauses/resumes the current audio track. Default `true`.
	 */
	pauseAudio?: boolean;

	/**
	 * Forward Capacitor's `backButton` event into the engine event bus.
	 * When `false`, the plugin leaves back-button handling entirely to
	 * user code. Default `true`.
	 */
	forwardBackButton?: boolean;

	/**
	 * Called when a `backButton` event is dispatched and no handler
	 * calls `evt.preventDefault()`. Default `() => App.exitApp()`
	 * (quits the native app). May be async — useful for confirm
	 * dialogs or other awaitable user prompts.
	 */
	onUnhandledBack?: () => void | Promise<void>;
}
