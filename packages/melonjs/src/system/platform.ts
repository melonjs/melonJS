/**
 * The device platform type
 * @namespace platform
 * ua the user agent string for the current device
 * iOS `true` if the device is an iOS platform
 * android `true` if the device is an Android platform
 * android2 `true` if the device is an Android 2.x platform (deprecated)
 * linux `true` if the device is a Linux platform
 * chromeOS `true` if the device is running on ChromeOS.
 * appleVendor `true` if the browser reports an Apple vendor (Safari)
 * wp `true` if the device is a Windows Phone platform (deprecated)
 * BlackBerry `true` if the device is a BlackBerry platform (deprecated)
 * Kindle `true` if the device is a Kindle platform (deprecated)
 * ejecta `true` if running under Ejecta
 * isWeixin `true` if running under Wechat
 * nodeJS `true` if running under node.js
 * isMobile `true` if a mobile device
 * webApp `true` if running as a standalone web app
 */

export const ua =
	typeof globalThis.navigator !== "undefined"
		? globalThis.navigator.userAgent
		: "";

// iPadOS 13+ (Sept 2019) ships Safari with the desktop Mac UA — no `iPad`
// token. Feature-detect the iPad-on-Mac-UA case so `iOS` / `isMobile`
// don't miss every modern iPad:
//
// - `navigator.platform === "MacIntel"` is the Mac identity Apple keeps
//   frozen on Apple Silicon Macs/iPads for backwards compat (same trick
//   as `Win32` on 64-bit Windows). NOT a CPU check — `MacIntel` persists
//   on M1/M2/M3/M4.
// - `maxTouchPoints > 1` excludes actual Macs (no touchscreens) and
//   keeps real iPads (multi-touch digitizers).
//
/**
 * iPad-on-Mac-UA predicate. Exported so the spec file can assert the
 * SAME function the module evaluates at load time (no drift between
 * docs and implementation), but marked `@internal` because it's a
 * test-seam, not a stable public API — the engine reserves the right
 * to change / inline / rename it without a breaking-change bump.
 *
 * Parameter shape is `Partial<Pick<Navigator, ...>>` rather than a
 * named alias so no engine-defined type leaks into the emitted
 * `.d.ts` (`tsconfig.build.json` doesn't currently set
 * `stripInternal`).
 * @param nav - a `navigator`-shaped object (or `undefined` for Node/SSR)
 * @returns `true` when `nav` looks like an iPad reporting under the iPadOS-13+ desktop Mac UA
 * @internal
 */
export function isIPadOnMacUA(
	nav: Partial<Pick<Navigator, "platform" | "maxTouchPoints">> | undefined,
): boolean {
	return nav?.platform === "MacIntel" && (nav?.maxTouchPoints ?? 0) > 1;
}

const _nav =
	typeof globalThis.navigator !== "undefined"
		? globalThis.navigator
		: undefined;

/**
 * Apple-vendor predicate. Exported as a test seam, like
 * {@link isIPadOnMacUA} — `@internal`, not stable public API.
 *
 * `navigator.vendor` is the most reliable signal for "this is Apple's
 * WebKit": it reads `Apple Computer, Inc.` in Safari on macOS and iOS,
 * and is empty or another vendor in Chrome and Firefox. The audio
 * backend needs it to decide whether a buffer has to be detached
 * through a scratch buffer, which is a WebKit-specific requirement.
 * @param nav - a `navigator`-shaped object (or `undefined` for Node/SSR)
 * @returns `true` when the browser reports an Apple vendor string
 * @internal
 */
export function isAppleVendorNav(
	nav: Partial<Pick<Navigator, "vendor">> | undefined,
): boolean {
	return (nav?.vendor ?? "").indexOf("Apple") >= 0;
}

export const iOS = /iPhone|iPad|iPod/i.test(ua) || isIPadOnMacUA(_nav);
/**
 * `true` when the browser reports an Apple vendor string — Safari on
 * macOS or iOS. Distinct from {@link iOS}: a Mac running Safari is
 * `appleVendor` but not `iOS`, and Chrome on iOS is `iOS` but not
 * `appleVendor`.
 */
export const appleVendor = isAppleVendorNav(_nav);
export const android = /Android/i.test(ua);
/**
 * @deprecated since 19.7.0 — Android 2.x predates 2012. Will be removed in 20.x.
 */
export const android2 = /Android 2/i.test(ua);
export const linux = /Linux/i.test(ua);
export const chromeOS = /CrOS/.test(ua);
/**
 * @deprecated since 19.7.0 — Windows Phone was EOL'd by Microsoft in 2017. Will be removed in 20.x.
 */
export const wp = /Windows Phone/i.test(ua);
/**
 * @deprecated since 19.7.0 — BlackBerry stopped shipping BB10 devices in 2016. Will be removed in 20.x.
 */
export const BlackBerry = /BlackBerry/i.test(ua);
/**
 * `true` on Amazon devices — Fire tablets (which report the Silk browser) and
 * legacy Kindle e-readers.
 *
 * The previous pattern required `Silk` followed by `Mobile Safari`, which no
 * current Fire tablet sends: Chromium-based Silk ends its user agent with
 * `Safari/537.36`, so every modern Fire tablet went undetected. Silk is
 * Amazon-only, so matching the `Silk/` token directly is both narrower and
 * correct.
 *
 * Note these devices are ordinary Android: {@link android} is `true` for all of
 * them, and nothing in the engine branches on this constant.
 * @deprecated since 19.7.0 — Kindle behaves like Android and {@link android}
 *   already covers it. Will be removed in a future release.
 */
export const Kindle = /Kindle|Silk\//i.test(ua);
export const ejecta = "ejecta" in globalThis;
export const isWeixin = /MicroMessenger/i.test(ua);
// Node.js detection — `process.release.name === "node"` is the
// official runtime identifier (set by V8 / Node.js itself). The cast
// is contained in one variable so the rest of the check reads as plain
// dotted access without repeating `as unknown as ...` three times.
const _proc = (globalThis as { process?: { release?: { name: string } } })
	.process;
export const nodeJS =
	typeof _proc !== "undefined" &&
	typeof _proc.release !== "undefined" &&
	_proc.release.name === "node";
// `Mobi` substring matches Firefox + Chrome + Safari mobile UAs in
// 2026 (MDN's recommended fallback); the `iOS || android` chain
// catches the few outliers and the iPad-on-Mac-UA case. Dropped
// `wp` / `BlackBerry` / `Kindle` — the underlying platforms are EOL
// and the regexes were burning cycles on every page load for
// hardware nobody ships.
export const isMobile = /Mobi/i.test(ua) || iOS || android;
export const webApp =
	(typeof globalThis.navigator !== "undefined" &&
		"standalone" in globalThis.navigator &&
		globalThis.navigator.standalone === true) ||
	(typeof globalThis.matchMedia !== "undefined" &&
		globalThis.matchMedia("(display-mode: standalone)").matches);
