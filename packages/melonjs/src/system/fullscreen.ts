// Fullscreen-capability probes, factored out of `device.ts` so the
// (small, leaf-level) `lang/deprecated.js` re-export wrappers can use them
// without creating a circular import — device.ts re-exports these so
// `me.device.hasFullscreenSupport` / `me.device.isFullscreen` stay
// byte-for-byte unchanged for consumers.
//
// `lib.dom.d.ts` only carries the unprefixed `fullscreenEnabled` /
// `fullscreenElement` fields; older WebKit / Gecko / IE-derived engines
// still surface state via vendor-prefixed variants. The intersection type
// below is local + un-exported; consumers cast through it.
type DocumentLegacy = Document & {
	mozFullScreenEnabled?: boolean;
	mozFullScreenElement?: Element;
	webkitFullscreenEnabled?: boolean;
	webkitFullscreenElement?: Element;
	msFullscreenEnabled?: boolean;
	msFullscreenElement?: Element;
};

/**
 * Browser full screen support — probed once at module load via the
 * unprefixed `fullscreenEnabled` field with vendor-prefixed fallbacks.
 */
export const hasFullscreenSupport =
	typeof globalThis.document !== "undefined" &&
	!!(
		globalThis.document.fullscreenEnabled ||
		(globalThis.document as DocumentLegacy).webkitFullscreenEnabled ||
		(globalThis.document as DocumentLegacy).mozFullScreenEnabled ||
		(globalThis.document as DocumentLegacy).msFullscreenEnabled
	);

/**
 * Returns true if the browser/device is in full screen mode.
 *
 * Pure document-state probe — no Application context needed, since the
 * browser tracks exactly one fullscreen element per document regardless
 * of how many Applications are running.
 * @category Application
 * @returns true when any of the four vendor variants of `fullscreenElement` is non-null
 */
export function isFullscreen(): boolean {
	if (!hasFullscreenSupport) return false;
	const doc = globalThis.document as DocumentLegacy;
	return !!(
		doc.fullscreenElement ||
		doc.webkitFullscreenElement ||
		doc.mozFullScreenElement ||
		doc.msFullscreenElement
	);
}
