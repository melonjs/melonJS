/**
 * LDtk's own JSON schemas, to hold the loader and its tests to the format as
 * LDtk defines it. The two files are LDtk's, version 1.5.3 (MIT, © Sébastien
 * Benard - Deepnight Games), from https://ldtk.io/files/ (line endings aside):
 * `JSON_SCHEMA.json`, every field of a project file, and
 * `MINIMAL_JSON_SCHEMA.json`, the fields a game is meant to read.
 */

/** a JSON schema node, as far as LDtk's schemas use them */
export interface SchemaNode {
	type?: string | string[];
	items?: SchemaNode;
	$ref?: string;
	oneOf?: SchemaNode[];
	anyOf?: SchemaNode[];
	enum?: unknown[];
	properties?: Record<string, SchemaNode | undefined>;
	required?: string[];
	additionalProperties?: boolean;
	description?: string;
}

/** one of LDtk's schema files */
export interface Schema {
	version: string;
	LdtkJsonRoot: SchemaNode;
	otherTypes: Record<string, SchemaNode | undefined>;
}

/**
 * load one of LDtk's schema files
 * @param file - `JSON_SCHEMA.json` or `MINIMAL_JSON_SCHEMA.json`
 * @returns the schema
 */
export async function loadSchema(file: string): Promise<Schema> {
	const response = await fetch(
		new URL(`../fixtures/ldtk/${file}`, import.meta.url),
	);
	return (await response.json()) as Schema;
}

/**
 * a type of a schema, by its name
 * @param schema - the schema
 * @param name - `LdtkJsonRoot`, `Level`, `LayerInstance`...
 * @returns the type
 */
export function typeOf(schema: Schema, name: string): SchemaNode {
	const node =
		name === "LdtkJsonRoot" ? schema.LdtkJsonRoot : schema.otherTypes[name];
	if (node === undefined) {
		throw new Error(`LDtk's schema has no type "${name}"`);
	}
	return node;
}

/**
 * whether a field may be left out or null, by its schema
 * @param type - the type the field is in
 * @param field - the field
 * @returns true if a file need not hold a value for it
 */
export function mayBeAbsent(type: SchemaNode, field: string): boolean {
	const node = type.properties?.[field];
	if (node === undefined) {
		return true;
	}
	const types = [node.type ?? []].flat();
	const alternatives = [...(node.oneOf ?? []), ...(node.anyOf ?? [])];
	return (
		!(type.required ?? []).includes(field) ||
		types.includes("null") ||
		alternatives.some((alternative) => {
			return [alternative.type ?? []].flat().includes("null");
		}) ||
		(node.enum ?? []).includes(null)
	);
}

const matchesType = (value: unknown, type: string): boolean => {
	switch (type) {
		case "null":
			return value === null;
		case "string":
			return typeof value === "string";
		case "boolean":
			return typeof value === "boolean";
		case "number":
			return typeof value === "number";
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "array":
			return Array.isArray(value);
		case "object":
			return (
				typeof value === "object" && value !== null && !Array.isArray(value)
			);
		default:
			return false;
	}
};

/**
 * What of a value does not follow a schema node: a field that is required
 * and missing, a value of the wrong type, and, when `strict`, a field the
 * schema does not know where it says it knows them all.
 * @param schema - the schema the node is from
 * @param node - the node
 * @param value - the value
 * @param strict - whether unknown fields count
 * @param path - where the value is, for the messages
 * @returns one line per fault; none for a value that follows the schema
 */
export function violations(
	schema: Schema,
	node: SchemaNode,
	value: unknown,
	strict: boolean,
	path = "$",
): string[] {
	if (node.$ref !== undefined) {
		const name = node.$ref.split("/").pop() as string;
		return violations(schema, typeOf(schema, name), value, strict, path);
	}
	const alternatives = node.oneOf ?? node.anyOf;
	if (alternatives !== undefined) {
		const faults = alternatives.map((alternative) => {
			return violations(schema, alternative, value, strict, path);
		});
		const fits = faults.some((list) => {
			return list.length === 0;
		});
		return fits ? [] : [faults.flat()[0]];
	}
	if (node.enum !== undefined) {
		return node.enum.includes(value)
			? []
			: [`${path}: ${JSON.stringify(value)} is not one of the enum's values`];
	}
	const types = [node.type ?? []].flat();
	if (types.length > 0) {
		const fits = types.some((type) => {
			return matchesType(value, type);
		});
		if (!fits) {
			return [
				`${path}: ${JSON.stringify(value).slice(0, 40)} is not ${types.join(" | ")}`,
			];
		}
	}
	const found: string[] = [];
	if (Array.isArray(value) && node.items !== undefined) {
		for (const [i, item] of value.entries()) {
			found.push(
				...violations(schema, node.items, item, strict, `${path}[${i}]`),
			);
		}
	}
	if (matchesType(value, "object") && node.properties !== undefined) {
		const object = value as Record<string, unknown>;
		for (const field of node.required ?? []) {
			if (!(field in object)) {
				found.push(`${path}: "${field}" is missing`);
			}
		}
		for (const [field, child] of Object.entries(object)) {
			const childNode = node.properties[field];
			if (childNode !== undefined) {
				found.push(
					...violations(schema, childNode, child, strict, `${path}.${field}`),
				);
			} else if (strict && node.additionalProperties === false) {
				found.push(`${path}: "${field}" is not a field of the format`);
			}
		}
	}
	return found;
}
