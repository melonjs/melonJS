import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser
	.newContext({
		viewport: { width: 800, height: 700 },
		deviceScaleFactor: 1,
	})
	.then((c) => c.newPage());

const pageErrors = [];
page.on("pageerror", (e) => {
	pageErrors.push(e.message);
	console.log("PAGE ERROR:", e.message);
});
page.on("console", (m) => {
	console.log(`[${m.type()}]`, m.text());
});

await page.goto("http://127.0.0.1:8766/.1448-repro.html", {
	waitUntil: "domcontentloaded",
});
await page.waitForSelector("#screen canvas", { timeout: 10_000 });
await page.waitForTimeout(1500);

await page.screenshot({
	path: "/tmp/1448-repro-screenshot.png",
	fullPage: true,
});

console.log("page errors:", pageErrors.length);
console.log("screenshot saved");
await browser.close();
