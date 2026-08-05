/**
 * Post-process the emitted `.d.ts` files, removing every declaration whose
 * JSDoc carries an `@internal` tag.
 *
 * tsc's own `stripInternal` only honors the tag for TypeScript sources —
 * declarations generated from JSDoc'd JavaScript keep their internal
 * members, so engine internals (pass lifecycle, texture retirement, …)
 * would otherwise surface in consumers' autocomplete. This pass walks the
 * declaration AST with the TypeScript API and splices those members out,
 * doc comment included. Runs as the tail of the `types` script.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dirname, "..", "build");

function* walkFiles(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			yield* walkFiles(path);
		} else if (path.endsWith(".d.ts")) {
			yield path;
		}
	}
}

function isInternal(node: ts.Node): boolean {
	return ts
		.getJSDocTags(node)
		.some((tag) => tag.tagName.getText() === "internal");
}

let filesTouched = 0;
let membersStripped = 0;

for (const path of walkFiles(ROOT)) {
	const text = readFileSync(path, "utf8");
	if (!text.includes("@internal")) {
		continue;
	}
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);

	// collect the full text ranges (leading trivia included, so the doc
	// comment goes with the declaration) of every @internal-tagged node:
	// class members plus top-level statements
	const ranges: Array<{ start: number; end: number }> = [];
	const collect = (node: ts.Node) => {
		if (isInternal(node)) {
			ranges.push({ start: node.getFullStart(), end: node.getEnd() });
			return; // no need to descend into a removed subtree
		}
		node.forEachChild(collect);
	};
	source.forEachChild(collect);

	if (ranges.length === 0) {
		continue;
	}
	// splice back-to-front so earlier ranges stay valid
	let out = text;
	for (const range of ranges.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, range.start) + out.slice(range.end);
	}
	writeFileSync(path, out);
	filesTouched += 1;
	membersStripped += ranges.length;
}

console.log(
	`strip-internal: removed ${membersStripped} internal declaration(s) across ${filesTouched} file(s)`,
);
