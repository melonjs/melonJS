/**
 * Lock the device orientation via `@capacitor/screen-orientation`.
 * The dependency is loaded lazily and is an optional peer — install
 * it only if you call this.
 * @param o - target orientation (`"portrait"` or `"landscape"`).
 */
export async function lockOrientation(
	o: "portrait" | "landscape",
): Promise<void> {
	const { ScreenOrientation } = await import("@capacitor/screen-orientation");
	await ScreenOrientation.lock({ orientation: o });
}

/** Release any orientation lock. Pairs with `lockOrientation`. */
export async function unlockOrientation(): Promise<void> {
	const { ScreenOrientation } = await import("@capacitor/screen-orientation");
	await ScreenOrientation.unlock();
}
