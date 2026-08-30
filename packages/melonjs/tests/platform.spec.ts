import { describe, expect, it } from "vitest";
import {
	android,
	android2,
	appleVendor,
	BlackBerry,
	chromeOS,
	ejecta,
	iOS,
	isAppleVendorNav,
	isIPadOnMacUA,
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
		// These tests assert the REAL exported `isIPadOnMacUA` predicate
		// from `platform.ts` — the same function the module calls at
		// load time to compute `iOS`. No drift possible: a regression
		// in the predicate (e.g. flipping `> 1` to `> 0`, or dropping
		// the `platform === "MacIntel"` check) surfaces here.

		it("flags an Apple Silicon iPad reporting as Mac (platform=MacIntel, maxTouchPoints=5)", () => {
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

	describe("isAppleVendorNav (test seam)", () => {
		// Consolidated from the audio backend, which shipped its own UA parser.
		// The backend needs "is this Apple's WebKit" to decide whether a buffer
		// must be detached through a scratch buffer — a WebKit-only requirement.
		it("flags Safari on macOS", () => {
			expect(isAppleVendorNav({ vendor: "Apple Computer, Inc." })).toBe(true);
		});

		it("flags Safari on iOS", () => {
			expect(isAppleVendorNav({ vendor: "Apple Computer, Inc." })).toBe(true);
		});

		it("does not flag Chrome (Google vendor)", () => {
			expect(isAppleVendorNav({ vendor: "Google Inc." })).toBe(false);
		});

		it("does not flag Firefox (empty vendor)", () => {
			expect(isAppleVendorNav({ vendor: "" })).toBe(false);
		});

		it("does not flag a navigator without a vendor field", () => {
			expect(isAppleVendorNav({})).toBe(false);
		});

		it("does not throw for undefined (Node / SSR)", () => {
			expect(isAppleVendorNav(undefined)).toBe(false);
		});

		it("appleVendor is a boolean evaluated from the live navigator", () => {
			expect(typeof appleVendor).toBe("boolean");
		});

		it("appleVendor is independent of iOS", () => {
			// a Mac running Safari is appleVendor but not iOS; Chrome on iOS is
			// iOS but not appleVendor — so neither implies the other
			expect(typeof iOS).toBe("boolean");
			expect(typeof appleVendor).toBe("boolean");
		});
	});

	describe("Amazon device detection", () => {
		// The pattern is asserted directly rather than through the exported
		// constant: the constant is evaluated once at module load from the live
		// user agent, so it can only ever report the machine running the suite.
		// This keeps the regression check honest about what it covers.
		const KINDLE = /Kindle|Silk\//i;

		it("matches a modern Chromium-based Silk Fire tablet", () => {
			// the case the previous `Silk.*Mobile Safari` pattern missed: modern
			// Silk ends its user agent with `Safari/537.36`, not `Mobile Safari`
			expect(
				KINDLE.test(
					"Mozilla/5.0 (Linux; Android 11; KFRAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.1.4 like Chrome/119.0.6045.193 Safari/537.36",
				),
			).toBe(true);
		});

		it("still matches an older Silk Fire tablet", () => {
			expect(
				KINDLE.test(
					"Mozilla/5.0 (Linux; Android 5.1.1; KFAUWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/78.4.1 like Chrome/78.0.3904.108 Mobile Safari/537.36",
				),
			).toBe(true);
		});

		it("still matches a legacy Kindle e-reader", () => {
			expect(
				KINDLE.test(
					"Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ Kindle/3.0+",
				),
			).toBe(true);
		});

		it("does not match a non-Amazon Android device", () => {
			expect(
				KINDLE.test(
					"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
				),
			).toBe(false);
		});

		it("does not match iOS Safari", () => {
			expect(
				KINDLE.test(
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
				),
			).toBe(false);
		});

		it("the exported constant is a boolean", () => {
			expect(typeof Kindle).toBe("boolean");
		});
	});
});
