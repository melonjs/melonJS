/**
 * The device platform type
 * @namespace platform
 * @memberof device
 * ua the user agent string for the current device
 * iOS `true` if the device is an iOS platform
 * android `true` if the device is an Android platform
 * android2 `true` if the device is an Android 2.x platform (deprecated)
 * linux `true` if the device is a Linux platform
 * chromeOS `true` if the device is running on ChromeOS.
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

export const iOS = /iPhone|iPad|iPod/i.test(ua) || isIPadOnMacUA(_nav);
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
 * @deprecated since 19.7.0 — Kindle has a negligible market share and behaves like Android. Will be removed in 20.x.
 */
export const Kindle = /Kindle|Silk.*Mobile Safari/i.test(ua);
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
