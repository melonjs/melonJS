/**
 * Screenshot one example on every backend it can actually reach.
 *
 * Headless Chromium has no GPU and falls back to WebGL 2 on SwiftShader, so a
 * headless-only check cannot see a WebGPU bug at all — which is how glyph tops
 * shorn off on Safari survived a full example sweep. Real Chrome and WebKit
 * both take the WebGPU path on a Mac, and they do not agree with each other:
 * the same texture mistake was invisible on one and obvious on the other.
 *
 * Prints the renderer each target actually selected, so a "verified" claim can
 * name the backend it was verified on.
 *
 * Usage (from packages/examples, with the dev server running):
 *   node scripts/backends.mjs text
 *   node scripts/backends.mjs jungle-rabbit --wait 10000
 *   node scripts/backends.mjs text --clip 200,300,320,90
 *   node scripts/backends.mjs text --only webkit
 *
 * Every run writes `<route>.<target>.<stamp>.png`, with one stamp shared by
 * the run's targets. A retry therefore lands NEXT TO the baseline instead of
 * overwriting it, which is what makes a backend bug readable: the shots only
 * say anything as a before/after pair.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";

const args = process.argv.slice(2);
const route = args.find((a) => !a.startsWith("--"));

if (!route) {
	console.error(
		"usage: node scripts/backends.mjs <route> [--wait ms] [--clip x,y,w,h] [--out dir] [--only name]",
	);
	process.exit(1);
}

/**
 * Read a `--flag value` pair off the argument list.
 * @param name - the flag, without dashes
 * @param fallback - what to use when it is absent
 * @returns the value, or the fallback
 */
const flag = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : args[i + 1];
};

const wait = Number(flag("wait", 8000));
const outDir = resolve(flag("out", "backend-shots"));
const only = flag("only", null);
const clip = flag("clip", null)
	? (() => {
			const [x, y, width, height] = flag("clip").split(",").map(Number);
			return { x, y, width, height };
		})()
	: undefined;

/**
 * The targets worth checking, and why each one earns its place.
 *
 * `headless` is the cheap gate that CI-style sweeps use. The other two are the
 * ones that find backend bugs, and they must be headed: a headless browser gets
 * no GPU, so it silently falls back and stops testing what you think it tests.
 */
const TARGETS = [
	{
		name: "headless",
		note: "no GPU — falls back to WebGL 2 (SwiftShader)",
		open: () => chromium.launch(),
	},
	{
		name: "chrome",
		note: "real GPU — WebGPU",
		open: () => chromium.launch({ channel: "chrome", headless: false }),
	},
	{
		name: "webkit",
		note: "real GPU — WebGPU, and it disagrees with Chrome",
		open: () => webkit.launch({ headless: false }),
	},
];

// One local-time stamp for the whole run, so a run's targets stay grouped and
// a listing sorts oldest-first within a route.
const runStamp = (() => {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
	return `${day}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
})();

mkdirSync(outDir, { recursive: true });

let failed = false;

for (const target of TARGETS) {
	if (only && only !== target.name) {
		continue;
	}

	let browser;
	let renderer = "unknown";
	const errors = [];

	try {
		browser = await target.open();
		const page = await browser.newPage({
			viewport: { width: 1280, height: 800 },
			deviceScaleFactor: 2,
		});
		page.on("pageerror", (e) => {
			errors.push(e.message.slice(0, 160));
		});
		page.on("console", (m) => {
			const text = m.text();
			// the engine announces the backend it resolved to on boot
			if (/renderer \(/i.test(text)) {
				renderer = text.split("|")[0].trim();
			}
			if (m.type() === "error") {
				errors.push(text.slice(0, 160));
			}
		});

		await page.goto(`http://localhost:5173/#/${route}`, {
			waitUntil: "commit",
		});
		await page.waitForSelector("canvas", { timeout: 30000 });
		await page.waitForTimeout(wait);
		await page.screenshot({
			path: `${outDir}/${route}.${target.name}.${runStamp}.png`,
			...(clip ? { clip } : {}),
		});
	} catch (e) {
		errors.push(String(e).slice(0, 160));
	} finally {
		await browser?.close();
	}

	const status = errors.length > 0 ? `FAIL (${errors[0]})` : "ok";
	if (errors.length > 0) {
		failed = true;
	}
	console.log(
		`${target.name.padEnd(9)} ${renderer.padEnd(34)} ${status}\n${" ".repeat(10)}${target.note}`,
	);
}

console.log(`\nshots in ${outDir} — this run: ${route}.*.${runStamp}.png`);
process.exit(failed ? 1 : 0);
