/**
 * Guard the documentation homepage against going stale.
 *
 * `pnpm doc` builds the API docs with `--readme ../../DOC_README.md`, so that
 * file is the landing page a new user reads first. Being a second README, it
 * drifts from the one that actually gets maintained: it sat untouched across
 * eight releases, its Quick Start missing the `await app.init()` that became
 * mandatory in 20.0 — so the very first snippet anyone copied could not run —
 * and teaching `renderable.shader =`, deprecated since 19.2.0.
 *
 * Moving it beside the root README makes that visible. This makes it fail the
 * build, by checking the things that actually went wrong rather than trying to
 * validate prose.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const docReadme = resolve(repoRoot, "DOC_README.md");
const srcDir = resolve(here, "../src");

const source = readFileSync(docReadme, "utf8");
const problems: string[] = [];

/** every ```js / ```javascript fence on the page */
const samples = [
	...source.matchAll(/```(?:js|javascript)\n([\s\S]*?)```/g),
].map((m) => {
	return m[1];
});

if (samples.length < 4) {
	problems.push(
		`only ${samples.length} code samples found — a rewrite that drops the fences would make every check below vacuous`,
	);
}

// `init()` became mandatory in 20.0: the WebGPU device is acquired
// asynchronously, so a sample that constructs an Application without awaiting
// it is one a reader cannot run.
for (const sample of samples) {
	if (
		sample.includes("new Application(") &&
		!/await\s+\w+\.init\(\)/.test(sample)
	) {
		problems.push("a sample constructs an Application but never awaits init()");
	}
}

// The renderer list is the other thing that rotted: the feature table said
// "WebGL & Canvas 2D" for the whole of 20.x, omitting the backend that release
// was built around.
for (const backend of ["WebGPU", "WebGL", "Canvas"]) {
	if (!source.includes(backend)) {
		problems.push(`the page never mentions ${backend}`);
	}
}

// Deprecated members are collected from the source rather than hardcoded, so
// something deprecated later is covered without anyone remembering to come
// back here.
const walk = (dir: string): string[] => {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			return walk(full);
		}
		return /\.(js|ts)$/.test(name) ? [full] : [];
	});
};

const deprecated = new Set<string>();
for (const file of walk(srcDir)) {
	const body = readFileSync(file, "utf8");
	for (const m of body.matchAll(
		/@deprecated[\s\S]{0,400}?\*\/\s*(?:get\s+|set\s+)?([A-Za-z_]\w*)\s*[(=]/g,
	)) {
		// short names produce false hits against ordinary prose
		if (m[1].length > 3) {
			deprecated.add(m[1]);
		}
	}
}

if (deprecated.size === 0) {
	problems.push(
		"found no @deprecated members to check against — the scan is broken",
	);
}

for (const sample of samples) {
	for (const name of deprecated) {
		if (new RegExp(`\\.${name}\\s*[(=]`).test(sample)) {
			problems.push(`a sample uses the deprecated \`${name}\``);
		}
	}
}

if (problems.length > 0) {
	console.error("DOC_README.md is out of date:\n");
	for (const p of [...new Set(problems)]) {
		console.error(`  - ${p}`);
	}
	console.error(
		"\nIt is the documentation homepage — the first thing a new user reads.\n",
	);
	process.exit(1);
}

console.log(
	`check-doc-readme: ${samples.length} samples checked against ${deprecated.size} deprecated members`,
);
