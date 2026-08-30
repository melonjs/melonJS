/**
 * Generate `docs/llms.txt` from the TypeDoc output.
 *
 * The agent skills under `skills/` cover the engine by topic, but they are
 * hand-written and deliberately partial. `llms.txt` is the escape hatch: a
 * machine-readable index of the *whole* generated API reference, regenerated on
 * every docs build, so an agent that cannot find something in a skill has one
 * URL to fetch instead of guessing at class names.
 *
 * Format follows llmstxt.org: an H1, a blockquote summary, then sections of
 * `- [name](url): summary` links. Summaries come from the same TSDoc comments
 * the HTML pages render, so this cannot drift from the docs it indexes.
 *
 * Runs after `typedoc` in the `doc` script; `docs/` is what the Pages workflow
 * publishes, so the file lands at <https://melonjs.github.io/melonJS/llms.txt>.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(here, "../docs");
const baseUrl = "https://melonjs.github.io/melonJS/";

/** TypeDoc's output directories, in the order they are listed in the index */
const sections = [
	{ dir: "classes", title: "Classes" },
	{ dir: "functions", title: "Functions" },
	{ dir: "interfaces", title: "Interfaces" },
	{ dir: "enums", title: "Enumerations" },
	{ dir: "types", title: "Type aliases" },
	{ dir: "variables", title: "Variables and namespaces" },
	{ dir: "modules", title: "Modules" },
];

const entities: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&nbsp;": " ",
};

const toText = (html: string): string => {
	return html
		.replace(/<[^>]+>/g, "")
		.replace(/&[a-z#0-9]+;/g, (match) => {
			return entities[match] ?? " ";
		})
		.replace(/\s+/g, " ")
		.trim();
};

/**
 * The substring of `html` covered by the div opening at `from`, closing tag
 * included. Regex cannot match nested `<div>`s, and TypeDoc nests them.
 * @param html - the page source
 * @param from - index of the opening `<div`
 * @returns the balanced substring
 */
const balancedDiv = (html: string, from: number): string => {
	const tag = /<\/?div\b/g;
	tag.lastIndex = from;
	let depth = 0;
	let match = tag.exec(html);
	while (match !== null) {
		depth += match[0] === "</div" ? -1 : 1;
		if (depth === 0) {
			return html.slice(from, match.index + "</div>".length);
		}
		match = tag.exec(html);
	}
	return html.slice(from);
};

/**
 * The first documented paragraph inside a block of TypeDoc HTML.
 *
 * `@deprecated` / `@see` render as `tsd-tag-*` blocks *inside* the comment, so
 * they are lifted out first — otherwise a symbol whose only comment is
 * `@deprecated since 17.1.0` gets indexed with "since 17.1.0" as its summary.
 * Parameter and return blocks are cut away for the same reason: they carry
 * comments of their own, and one of those is not a summary of the symbol.
 * @param block - a fragment of TypeDoc HTML
 * @returns the paragraph as plain text, or an empty string
 */
const firstParagraph = (block: string): string => {
	const body = block
		.split('<div class="tsd-parameters"')[0]
		.split('<h4 class="tsd-returns-title"')[0];

	let at = body.indexOf('<div class="tsd-comment tsd-typography">');
	while (at !== -1) {
		let comment = balancedDiv(body, at);
		for (;;) {
			const tagAt = comment.indexOf('<div class="tsd-tag-');
			if (tagAt === -1) {
				break;
			}
			comment = comment.replace(balancedDiv(comment, tagAt), "");
		}
		const paragraph = comment.match(/<p>([\s\S]*?)<\/p>/);
		if (paragraph !== null) {
			const text = toText(paragraph[1]);
			if (text !== "") {
				return text;
			}
		}
		at = body.indexOf('<div class="tsd-comment tsd-typography">', at + 1);
	}
	return "";
};

/**
 * Whether the page documents something this repository actually defines.
 *
 * TypeDoc walks into the type of an exported value, so a `string` constant like
 * `loader.nocache` contributes a page for every `String.prototype` method —
 * 49 of them, all pointing at `lib.es5.d.ts`. Indexing those would tell an
 * agent that `loader.nocache.trimEnd` is part of the melonJS API.
 * @param html - the page source
 * @returns true when at least one source link points into the repository
 */
const isOwnSymbol = (html: string): boolean => {
	const sources = [
		...html.matchAll(/<aside class="tsd-sources">([\s\S]*?)<\/aside>/g),
	];
	if (sources.length === 0) {
		// no "Defined in" at all — a type alias or namespace page; keep it
		return true;
	}
	return sources.some((source) => {
		return source[1].includes("github.com/melonjs/");
	});
};

/**
 * A one-line summary for a documentation page, plus whether the symbol is
 * deprecated.
 *
 * Deliberately reads the rendered HTML rather than a second TypeDoc run: it is
 * the only way to be sure the summary matches the page it links to.
 *
 * Which block wins depends on the page kind, and getting it wrong is silent.
 * A class page's panel holds the class comment while its first
 * `tsd-description` holds the *constructor's* — but on a namespaced function
 * page the panel holds the *namespace's* comment, which would give every
 * `TMXUtils.*` entry the same summary. So functions read the signature
 * description first, everything else reads the panel first.
 * @param html - the page source
 * @returns the summary, and whether the symbol is deprecated
 */
const describe = (html: string): { summary: string; deprecated: boolean } => {
	// TypeDoc marks a deprecated symbol on the page title, which is the one
	// place that cannot be confused with a deprecated member of it.
	const deprecated = html.includes('<h1 class="deprecated">');

	const title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
	const isFunction = title !== null && toText(title[1]).startsWith("Function");

	const blocks: string[] = [];
	const panel = html.match(
		/<section class="tsd-panel tsd-comment">([\s\S]*?)<\/section>/,
	);
	const descriptionAt = html.indexOf('<div class="tsd-description">');
	if (panel !== null && !isFunction) {
		blocks.push(panel[1]);
	}
	if (descriptionAt !== -1) {
		blocks.push(balancedDiv(html, descriptionAt));
	}
	if (panel !== null && isFunction) {
		blocks.push(panel[1]);
	}

	for (const block of blocks) {
		const text = firstParagraph(block);
		if (text === "") {
			continue;
		}
		if (text.length <= 160) {
			return { summary: text, deprecated };
		}
		const cut = text.slice(0, 160);
		return { summary: `${cut.slice(0, cut.lastIndexOf(" "))}…`, deprecated };
	}

	return { summary: "", deprecated };
};

const lines: string[] = [
	"# melonJS",
	"",
	"> melonJS is an open source 2.5D HTML5 game engine, rendering on WebGPU, WebGL 2 or Canvas with automatic fallback and no runtime dependencies. This file indexes the complete generated API reference.",
	"",
	"Three rules produce code that runs and is wrong, so they are worth stating up front:",
	"",
	"- `await app.init()` is mandatory since 20.0 — without it there is no renderer, and the failure does not name the cause.",
	"- `addChild(child, z)` is the only way to set draw order; `renderable.z` does not exist.",
	"- `isKinematic` defaults to `true`, which silently excludes a renderable from pointer events and from the physics broadphase.",
	"",
	"Each link below is a documentation page; fetch the ones relevant to the task.",
	"",
	"## Guides",
	"",
	"- [Agent skills](https://github.com/melonjs/melonJS/tree/master/packages/melonjs/skills): task-oriented guides shipped in the npm package under `melonjs/skills/`, one per subsystem. Start with `melonjs/SKILL.md`.",
	"- [Wiki](https://github.com/melonjs/melonJS/wiki): hand-written guides — rendering API, Tiled workflows, 3D, upgrade notes.",
	"- [Examples](https://melonjs.github.io/melonJS/examples/): runnable demos; sources under `packages/examples/src/examples/`.",
	"- [Changelog](https://github.com/melonjs/melonJS/blob/master/packages/melonjs/CHANGELOG.md): what changed and when, including breaking changes.",
	"",
];

let total = 0;
let skipped = 0;

for (const section of sections) {
	const dir = join(docsDir, section.dir);
	let files: string[];
	try {
		files = readdirSync(dir).filter((name) => {
			return name.endsWith(".html");
		});
	} catch {
		// A missing directory means typedoc's output changed shape. Say so
		// rather than quietly emitting a shorter index.
		console.error(
			`generate-llms-txt: expected ${section.dir}/ in ${docsDir} — run \`pnpm doc\` first`,
		);
		process.exit(1);
	}

	if (files.length === 0) {
		continue;
	}

	lines.push(`## ${section.title}`, "");
	for (const file of files.sort()) {
		const name = file.replace(/\.html$/, "");
		const html = readFileSync(join(dir, file), "utf8");
		if (!isOwnSymbol(html)) {
			skipped += 1;
			continue;
		}
		const { summary, deprecated } = describe(html);
		const url = `${baseUrl}${section.dir}/${file}`;
		const note = [deprecated ? "**deprecated**" : "", summary]
			.filter(Boolean)
			.join(" — ");
		lines.push(
			note === "" ? `- [${name}](${url})` : `- [${name}](${url}): ${note}`,
		);
		total += 1;
	}
	lines.push("");
}

if (total === 0) {
	console.error("generate-llms-txt: no documentation pages found");
	process.exit(1);
}

const out = join(docsDir, "llms.txt");
writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
console.log(
	`generate-llms-txt: indexed ${total} pages into docs/llms.txt (${skipped} skipped as not defined in this repository)`,
);
