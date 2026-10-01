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

/**
 * Cheap pre-filter for the underscore rule below.
 *
 * It has to admit every modifier a member can carry, or a file whose only
 * underscore members are written `private _foo` is skipped outright and they
 * survive into the published types — a silent hole, since the file simply is
 * not parsed. Erring wide costs one AST walk on a file with nothing to strip.
 */
const UNDERSCORE_HINT =
	/^\s*(?:private |protected |public |static |declare |readonly |abstract |override |get |set )*_[A-Za-z0-9_]+\s*[?:(<]/m;

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

/**
 * Remove imports left with nothing referring to them once the internals that
 * used them are gone.
 *
 * Needed because a module whose declarations were ALL internal is emptied
 * completely, and a file still importing from it then fails with "is not a
 * module" — which makes the imported name an error type, so every signature
 * naming it silently becomes `any` for consumers. The import is dead either
 * way: its binding no longer appears anywhere in the file.
 *
 * Only bindings with no remaining reference are dropped, so an import still
 * used by a surviving declaration is untouched, as is a side-effect import
 * (no bindings at all).
 * @param path - the declaration file, for parsing
 * @param text - its contents, after the internal declarations were spliced out
 * @returns the contents with dead imports removed
 */
function dropOrphanedImports(path: string, text: string): string {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const cuts: Array<{ start: number; end: number }> = [];

	// every identifier in the file that is NOT part of an import clause
	const used = new Set<string>();
	const note = (node: ts.Node) => {
		if (ts.isImportDeclaration(node)) {
			// the module specifier can't reference a binding; skip the clause
			return;
		}
		if (ts.isIdentifier(node)) {
			used.add(node.text);
		}
		node.forEachChild(note);
	};
	source.forEachChild(note);

	for (const statement of source.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			statement.importClause === undefined
		) {
			continue; // side-effect import: nothing to orphan
		}
		const clause = statement.importClause;
		const bindings: string[] = [];
		if (clause.name !== undefined) {
			bindings.push(clause.name.text);
		}
		if (clause.namedBindings !== undefined) {
			if (ts.isNamespaceImport(clause.namedBindings)) {
				bindings.push(clause.namedBindings.name.text);
			} else {
				for (const element of clause.namedBindings.elements) {
					bindings.push(element.name.text);
				}
			}
		}
		// drop the statement only when NONE of what it brings in is still
		// referenced; a partially-used import keeps all of its bindings,
		// which costs an unused name rather than risking a live one
		if (bindings.length > 0 && bindings.every((name) => !used.has(name))) {
			cuts.push({ start: statement.getFullStart(), end: statement.getEnd() });
		}
	}

	let out = text;
	for (const cut of cuts.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, cut.start) + out.slice(cut.end);
	}
	return out;
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
	// names of the top-level declarations being removed, so the export
	// statements that point at them can go too (see below)
	const removedNames = new Set<string>();
	const collect = (node: ts.Node) => {
		if (isInternal(node) || isUnderscoreMember(node)) {
			ranges.push({ start: node.getFullStart(), end: node.getEnd() });
			const name = (node as { name?: ts.Node }).name;
			if (name !== undefined && ts.isIdentifier(name)) {
				removedNames.add(name.text);
			}
			return; // no need to descend into a removed subtree
		}
		node.forEachChild(collect);
	};
	source.forEachChild(collect);

	// Remove the export that re-exported a declaration we just deleted.
	//
	// Without this the file keeps `export default TextureCache;` with nothing
	// named TextureCache left in it, and that is not merely untidy: the name
	// is then unresolved, so every signature mentioning it degrades to `any`
	// for consumers, silently, because `skipLibCheck` hides the only error
	// that would have said so.
	//
	// Only top-level exports, and only ones naming a removed declaration —
	// an export of something still present is untouched.
	for (const statement of source.statements) {
		if (
			ts.isExportAssignment(statement) &&
			ts.isIdentifier(statement.expression) &&
			removedNames.has(statement.expression.text)
		) {
			ranges.push({
				start: statement.getFullStart(),
				end: statement.getEnd(),
			});
			continue;
		}
		// `export { A, B };` — drop it only when EVERY name it exports is
		// gone, so a surviving sibling keeps its export
		if (
			ts.isExportDeclaration(statement) &&
			statement.exportClause !== undefined &&
			ts.isNamedExports(statement.exportClause) &&
			statement.moduleSpecifier === undefined &&
			statement.exportClause.elements.length > 0 &&
			statement.exportClause.elements.every((element) =>
				removedNames.has((element.propertyName ?? element.name).text),
			)
		) {
			ranges.push({
				start: statement.getFullStart(),
				end: statement.getEnd(),
			});
		}
	}

	if (ranges.length === 0) {
		continue;
	}
	// splice back-to-front so earlier ranges stay valid
	let out = text;
	for (const range of ranges.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, range.start) + out.slice(range.end);
	}
	out = dropOrphanedImports(path, out);
	writeFileSync(path, out);
	filesTouched += 1;
	membersStripped += ranges.length;
}

console.log(
	`strip-internal: removed ${membersStripped} internal declaration(s) across ${filesTouched} file(s)`,
);
