/**
 * Load every example and report anything that errors.
 *
 * Catches boot and first-frames regressions across the gallery: a throw in
 * `Container.addChild` / `registerChildBody`, a bad body definition, a missing
 * asset, an uncaught promise. It does NOT exercise teardown, since navigating
 * between examples reloads the page rather than destroying the scene.
 */
import { chromium } from "playwright";

const port = process.argv[2] ?? "5173";
const wait = Number(process.argv[3] ?? 4000);
const routes = process.argv.slice(4);

const browser = await chromium.launch();
const failures = [];

for (const route of routes) {
	const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
	const errors = [];
	page.on("pageerror", (e) =>
		errors.push(`PAGEERROR ${e.message.slice(0, 180)}`),
	);
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(`CONSOLE ${m.text().slice(0, 180)}`);
	});
	try {
		await page.goto(`http://localhost:${port}/#/${route}`, {
			waitUntil: "commit",
		});
		await page.waitForSelector("canvas", { timeout: 25000 });
		await page.waitForTimeout(wait);
	} catch (e) {
		errors.push(`NAV ${String(e).slice(0, 180)}`);
	}
	await page.close();

	if (errors.length > 0) {
		failures.push({ route, errors });
		console.log(`FAIL ${route}`);
		for (const e of [...new Set(errors)].slice(0, 3)) console.log(`     ${e}`);
	} else {
		console.log(`ok   ${route}`);
	}
}

await browser.close();
console.log(`\n${routes.length - failures.length}/${routes.length} clean`);
process.exit(failures.length > 0 ? 1 : 0);
