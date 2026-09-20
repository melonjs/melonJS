/**
 * Screenshot the physics-shapes example on each physics backend.
 *
 * Temporary companion to #1685: the claim is that one shape file and one body
 * definition behave the same on all three, so the check is three shots of the
 * same scene with only the backend changed.
 *
 * Usage (from packages/examples, with the dev server running):
 *   node scripts/shapes-backends.mjs [--wait ms] [--port 5174]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : args[i + 1];
};

const wait = Number(flag("wait", 14000));
const port = flag("port", "5174");
const outDir = resolve(flag("out", "backend-shots"));
mkdirSync(outDir, { recursive: true });

const stamp = (() => {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
})();

let failed = false;
const browser = await chromium.launch();

for (const backend of ["builtin", "matter", "planck"]) {
	const errors = [];
	const page = await browser.newPage({
		viewport: { width: 1100, height: 760 },
		deviceScaleFactor: 2,
	});
	page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
	page.on("console", (m) => {
		if (m.type() === "error") {
			errors.push(m.text().slice(0, 200));
		}
	});

	try {
		await page.goto(
			`http://localhost:${port}/?physics=${backend}#/physics-shapes`,
			{ waitUntil: "commit" },
		);
		await page.waitForSelector("canvas", { timeout: 30000 });
		await page.waitForTimeout(wait);
		await page.screenshot({ path: `${outDir}/shapes.${backend}.${stamp}.png` });
	} catch (e) {
		errors.push(String(e).slice(0, 200));
	}
	await page.close();

	if (errors.length > 0) {
		failed = true;
	}
	console.log(
		`${backend.padEnd(8)} ${errors.length > 0 ? `FAIL ${errors[0]}` : "ok"}`,
	);
}

await browser.close();
console.log(`\nshots in ${outDir} — this run: shapes.*.${stamp}.png`);
process.exit(failed ? 1 : 0);
