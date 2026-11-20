// TEMPORARY, for one pull request: makes the installed test runner write to
// the file named by WSLOG when a test page crashes, closes or loses a
// websocket, and with which close code. Removed before the pull request is
// merged.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pnpm = "node_modules/.pnpm";
const find = (prefix, rest) => {
	return readdirSync(pnpm)
		.filter((dir) => {
			return dir.startsWith(prefix);
		})
		.map((dir) => {
			return join(pnpm, dir, "node_modules", rest);
		});
};
// the file is replaced, never written in place: pnpm hard-links it from its
// store, which the workflow caches
const patch = (file, edits, prefix = "") => {
	let source = readFileSync(file, "utf8");
	for (const [from, to] of edits) {
		if (!source.includes(from)) {
			console.log(`skipped ${file}: not the version this was written for`);
			return;
		}
		source = source.replace(from, to);
	}
	rmSync(file);
	writeFileSync(file, prefix + source);
	console.log(`patched ${file}`);
};

const LOG = `((m) => { try { require("node:fs").appendFileSync(process.env.WSLOG || "/dev/null", new Date().toISOString() + " " + m + "\\n"); } catch {} })`;

for (const file of find("@vitest+browser@", "@vitest/browser/dist/index.js")) {
	patch(
		file,
		[
			[
				'debug?.("[%s] Browser API connected to %s", rpcId, type);\n\t\t\tws.on("close", () => {',
				'ws.on("close", (__code, __reason) => {\n\t\t\t\tif (type === "orchestrator") globalThis.__wslog?.(`server: the ${type} websocket of page ${sessionId.slice(0, 8)} closed, code=${__code} reason=${String(__reason)}`);',
			],
		],
		`import { createRequire as __cr } from 'node:module'; const require = globalThis.require ?? __cr(import.meta.url); globalThis.__wslog = ${LOG};\n`,
	);
}

for (const file of find(
	"@vitest+browser-playwright@",
	"@vitest/browser-playwright/dist/index.js",
)) {
	patch(file, [
		[
			"this.browser = await playwright[this.browserName].launch(launchOptions);",
			'this.browser = await playwright[this.browserName].launch(launchOptions);\n\t\t\t\tthis.browser.on("disconnected", () => globalThis.__wslog?.("the browser disconnected"));',
		],
		[
			"this.pages.set(sessionId, page);\n\t\tif (process.env.VITEST_PW_DEBUG) {",
			`this.pages.set(sessionId, page);
		{
			const L = (m) => globalThis.__wslog?.(\`page \${sessionId.slice(0, 8)}: \${m}\`);
			L("created");
			page.on("crash", () => L("CRASHED"));
			page.on("close", () => L("closed"));
			page.on("framenavigated", (f) => { if (f === page.mainFrame()) L("main frame navigated to " + f.url().replace(/\\?.*/, "")); });
			page.on("websocket", (w) => {
				const kind = w.url().includes("type=orchestrator") ? "orchestrator" : w.url().includes("type=tester") ? "tester" : "vite";
				w.on("socketerror", (e) => L(kind + " websocket error: " + e));
				if (kind === "orchestrator") w.on("close", () => L("orchestrator websocket closed, seen from the page"));
			});
			page.on("console", (m) => { const t = m.text(); if (/server connection lost|WebSocket connection to/i.test(t)) L("console: " + t.slice(0, 200)); });
			page.on("requestfailed", (r) => { const f = r.failure()?.errorText ?? ""; if (/INSUFFICIENT|NETWORK_CHANGED|CONNECTION_RESET|CONNECTION_CLOSED|EMPTY_RESPONSE|OUT_OF_MEMORY/.test(f)) L("request failed: " + f + " " + r.url().slice(0, 120)); });
		}
		if (process.env.VITEST_PW_DEBUG) {`,
		],
	]);
}

for (const file of find("vitest@", "vitest/dist/chunks").flatMap((dir) => {
	return readdirSync(dir)
		.filter((name) => {
			return name.startsWith("cli-api.");
		})
		.map((name) => {
			return join(dir, name);
		});
})) {
	patch(file, [
		[
			'debug?.("[%s] run test %s", sessionId, file);',
			'debug?.("[%s] run test %s", sessionId, file);\n\t\tglobalThis.__wslog?.("page " + sessionId.slice(0, 8) + ": starts " + String(file.filepath).replace(/.*\\/tests\\//, ""));',
		],
	]);
}
