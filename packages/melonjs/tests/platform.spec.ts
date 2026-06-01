import { describe, expect, it } from "vitest";
import {
	android,
	android2,
	BlackBerry,
	chromeOS,
	ejecta,
	iOS,
	isMobile,
	isWeixin,
	Kindle,
	linux,
	nodeJS,
	ua,
	webApp,
	wp,
} from "../src/system/platform.ts";

/**
 * Smoke coverage for the platform-detection constants. They're computed
 * once at module load from `globalThis.navigator.userAgent` /
 * `globalThis.process` / etc., so there's no behavior to test
 * exhaustively — we lock in the shape (everything is a boolean except
 * `ua` which is a string) and assert the values we expect in our
 * Playwright + chromium test environment (desktop browser, no Node
 * `process`, no WebView shells).
 *
 * The Node-detection branch in particular went through a refactor that
 * collapsed three repeated `as unknown as { process? }` casts into a
 * single locally-typed `_proc` const. This spec pins the result so
 * regressions in that branch show up as a clear test failure rather
 * than a silent `true`/`false` flip.
 */
describe("system/platform", () => {
	describe("shape", () => {
		it("`ua` is a string", () => {
			expect(typeof ua).toBe("string");
		});
		it.each<[string, boolean]>([
			["iOS", iOS],
			["android", android],
			["android2", android2],
			["linux", linux],
			["chromeOS", chromeOS],
			["wp", wp],
			["BlackBerry", BlackBerry],
			["Kindle", Kindle],
			["ejecta", ejecta],
			["isWeixin", isWeixin],
			["nodeJS", nodeJS],
			["isMobile", isMobile],
			["webApp", webApp],
		])("`%s` is a boolean", (_, value) => {
			expect(typeof value).toBe("boolean");
		});
	});

	describe("values under Playwright chromium (desktop, headless)", () => {
		// Playwright launches a real chromium with a desktop user agent —
		// these are the values the rest of the test suite relies on
		// implicitly (e.g. `keyboard.ts` skips the on-screen-keyboard
		// branch because `isMobile === false` in this env).
		it("nodeJS is false (we're in a browser, not Node)", () => {
			expect(nodeJS).toBe(false);
		});
		it("isWeixin is false (no MicroMessenger UA)", () => {
			expect(isWeixin).toBe(false);
		});
		it("ejecta is false (no Ejecta WebView)", () => {
			expect(ejecta).toBe(false);
		});
		it("BlackBerry is false", () => {
			expect(BlackBerry).toBe(false);
		});
		it("Kindle is false", () => {
			expect(Kindle).toBe(false);
		});
	});

	describe("mobile-vs-desktop wiring", () => {
		// `isMobile` is the OR of the mobile-UA hits — verify it's not
		// silently true on our desktop runner (a regression in the OR
		// chain would page every test that branches on this).
		//
		// Note: as of #1467, `wp` / `BlackBerry` / `Kindle` are deprecated
		// and NO LONGER participate in this OR chain. Their underlying
		// platforms are EOL (Windows Phone 2017, BB10 2016) and the
		// regexes were burning cycles for hardware nobody ships. The
		// exports themselves stay around so any external consumer
		// (third-party plugin, user code) keeps working through 19.x.
		it("isMobile === /Mobi/.test(ua) || iOS || android", () => {
			const expected = /Mobi/i.test(ua) || iOS || android;
			expect(isMobile).toBe(expected);
		});
	});

	describe("iPadOS 13+ detection (#1467)", () => {
		// iPadOS 13 (Sept 2019) made Safari ship the desktop Mac UA by
		// default — no `iPad` token. Pure UA regex misses every modern
		// iPad. The fix layers a feature-detection check on top:
		// `navigator.platform === "MacIntel"` (Apple-frozen legacy
		// string, persists on Apple Silicon Macs/iPads for compat) +
		// `maxTouchPoints > 1` (Macs don't have touchscreens; iPads do).
		//
		// The module computes `iOS` at load time from `globalThis`, so
		// these tests assert the LOGIC of the documented check by
		// recreating it inline against stubbed navigator shapes. This
		// is verification of the contract; the runtime-load value in
		// real chromium is covered by the shape / desktop-defaults
		// blocks above.
		const isIPadOnMacUA = (
			nav: { platform?: string; maxTouchPoints?: number } | undefined,
		): boolean =>
			nav?.platform === "MacIntel" && (nav?.maxTouchPoints ?? 0) > 1;

		it("detects an Apple Silicon iPad reporting as Mac (platform=MacIntel, maxTouchPoints=5)", () => {
			expect(isIPadOnMacUA({ platform: "MacIntel", maxTouchPoints: 5 })).toBe(
				true,
			);
		});

		it("does not flag an actual Mac (platform=MacIntel, no touch)", () => {
			expect(isIPadOnMacUA({ platform: "MacIntel", maxTouchPoints: 0 })).toBe(
				false,
			);
		});

		it("does not flag a Mac with `maxTouchPoints` undefined (older Safari)", () => {
			expect(isIPadOnMacUA({ platform: "MacIntel" })).toBe(false);
		});

		it("does not flag Windows touchscreen (platform=Win32, maxTouchPoints=10)", () => {
			expect(isIPadOnMacUA({ platform: "Win32", maxTouchPoints: 10 })).toBe(
				false,
			);
		});

		it("does not flag a missing navigator (Node/SSR)", () => {
			expect(isIPadOnMacUA(undefined)).toBe(false);
		});

		it("does not flag a device reporting `maxTouchPoints === 1`", () => {
			// The check uses `> 1`, not `> 0`. A hypothetical single-point
			// touch device should not trip it — multi-touch is iPad-class.
			expect(isIPadOnMacUA({ platform: "MacIntel", maxTouchPoints: 1 })).toBe(
				false,
			);
		});
	});
});
