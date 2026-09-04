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

/** cheap pre-filter for the underscore rule below */
const UNDERSCORE_HINT = /^\s*(readonly\s+)?_[A-Za-z0-9_]+\s*[?:(<]/m;

/**
 * A class member whose name starts with `_`.
 *
 * The underscore prefix is this codebase's own convention for "not part of the
 * API", and it is used consistently — but only some of those members carry a
 * doc tag, so tagging alone left hundreds of them in consumers' autocomplete.
 * Treating the prefix as the declaration it already is covers them all,
 * including any added later, without a tag on every one.
 *
 * Deliberately limited to class members: a module-level `_name` is not emitted
 * unless exported, and an exported one is a public decision rather than an
 * accident.
 * @param node - the declaration under consideration
 * @returns true when the member is private by naming convention
 */
function isUnderscoreMember(node: ts.Node): boolean {
	// Class members only. NOT interface members: an exported interface's
	// `_field` is part of a contract someone may implement, so removing it
	// changes that contract rather than hiding an implementation detail.
	// `SpatialSoundState._pos` and its siblings are real cases here.
	if (
		!ts.isPropertyDeclaration(node) &&
		!ts.isMethodDeclaration(node) &&
		!ts.isGetAccessorDeclaration(node) &&
		!ts.isSetAccessorDeclaration(node)
	) {
		return false;
	}
	const name = node.name;
	return (
		(ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) &&
		name.text.startsWith("_")
	);
}

let filesTouched = 0;
let membersStripped = 0;

for (const path of walkFiles(ROOT)) {
	const text = readFileSync(path, "utf8");
	if (!text.includes("@internal") && !UNDERSCORE_HINT.test(text)) {
		continue;
	}
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);

	// collect the full text ranges (leading trivia included, so the doc
	// comment goes with the declaration) of every @internal-tagged node:
	// class members plus top-level statements
	const ranges: Array<{ start: number; end: number }> = [];
	const collect = (node: ts.Node) => {
		if (isInternal(node) || isUnderscoreMember(node)) {
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
