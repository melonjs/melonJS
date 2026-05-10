/**
 * Hide Capacitor's splash screen via `@capacitor/splash-screen`.
 * Optional peer dep — install it only if you call this. Typically
 * called after the first frame has rendered (e.g. inside the first
 * `Stage.onResetEvent`).
 * @param opts - forwarded to `SplashScreen.hide()`.
 * @param opts.fadeOutDuration - fade-out duration in milliseconds.
 */
export async function hideSplash(opts?: {
	fadeOutDuration?: number;
}): Promise<void> {
	const { SplashScreen } = await import("@capacitor/splash-screen");
	await SplashScreen.hide(opts);
}
