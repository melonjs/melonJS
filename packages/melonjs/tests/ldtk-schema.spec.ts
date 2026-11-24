import { beforeAll, describe, expect, it } from "vitest";
import {
	type LDtkLevelInfo,
	LDtkProject,
	type LDtkProjectJson,
} from "../src/index.js";
// the declarations as written: what the engine says an LDtk file holds
import typesSource from "../src/level/ldtk/types.ts?raw";
import { SAMPLES, sampleURL } from "./helpers/ldtk-harness.ts";
import {
	defs,
	entity,
	layer,
	levelJson,
	projectJson,
	tile,
} from "./helpers/ldtk-project-builder.ts";
import {
	loadSchema,
	mayBeAbsent,
	type Schema,
	typeOf,
	violations,
} from "./helpers/ldtk-schema.ts";

/**
 * The loader against LDtk's own definition of its format: the JSON schema
 * LDtk publishes (https://ldtk.io/files/JSON_SCHEMA.json), and the smaller
 * one that holds the fields a game is meant to read
 * (https://ldtk.io/files/MINIMAL_JSON_SCHEMA.json).
 */

/** the engine's name for each type of the schema */
const TYPES: Record<string, string> = {
	LDtkProjectJson: "LdtkJsonRoot",
	LDtkWorldJson: "World",
	LDtkLevelJson: "Level",
	LDtkBackgroundPosition: "LevelBgPosInfos",
	LDtkNeighbour: "NeighbourLevel",
	LDtkLayerInstance: "LayerInstance",
	LDtkTile: "Tile",
	LDtkEntityInstance: "EntityInstance",
	LDtkFieldInstance: "FieldInstance",
	LDtkTileRect: "TilesetRect",
	LDtkGridPoint: "GridPoint",
	LDtkEntityReference: "EntityReferenceInfos",
	LDtkTilesetDef: "TilesetDef",
	LDtkLayerDef: "LayerDef",
	LDtkIntGridValueDef: "IntGridValueDef",
	LDtkIntGridValueGroupDef: "IntGridValueGroupDef",
	LDtkEntityDef: "EntityDef",
	LDtkEnumDef: "EnumDef",
	LDtkTocEntry: "TableOfContentEntry",
	LDtkTocInstance: "TocInstanceData",
};

/** a field of a schema type that no file holds: it is there for code generators */
const NOT_IN_FILES = ["__FORCED_REFS"];

/**
 * the fields of each interface declared in the engine's types
 * @returns per interface, each field and whether it may be absent or null
 */
const declared = () => {
	const interfaces = new Map<string, Map<string, boolean>>();
	const pattern = /export interface (\w+) \{\n([\s\S]*?)\n\}/g;
	for (const match of typesSource.matchAll(pattern)) {
		const fields = new Map<string, boolean>();
		// a field is a line one tab in; its type may run over the next lines
		const lines = match[2].split("\n");
		for (const [i, line] of lines.entries()) {
			const field = /^\t(\w+)(\??):(.*)$/.exec(line);
			if (field !== null) {
				let type = field[3];
				for (let j = i + 1; j < lines.length && !type.includes(";"); j++) {
					type += lines[j];
				}
				fields.set(field[1], field[2] === "?" || /\bnull\b/.test(type));
			}
		}
		interfaces.set(match[1], fields);
	}
	return interfaces;
};

describe("the LDtk format, as LDtk's schemas define it", () => {
	let full: Schema;
	let minimal: Schema;

	beforeAll(async () => {
		full = await loadSchema("JSON_SCHEMA.json");
		minimal = await loadSchema("MINIMAL_JSON_SCHEMA.json");
	});

	it("the schemas are the ones of the version the samples were saved with", () => {
		expect(full.version).toBe("1.5.3");
		expect(minimal.version).toBe("1.5.3");
	});

	describe("the engine's types", () => {
		it("declare every type under test", () => {
			const interfaces = declared();
			for (const name of Object.keys(TYPES)) {
				expect(interfaces.has(name), name).toBe(true);
				expect(interfaces.get(name)?.size, name).toBeGreaterThan(0);
			}
		});

		it.each(Object.entries(TYPES))(
			"%s names every field a game is meant to read of %s",
			(name, schemaName) => {
				const fields = declared().get(name) as Map<string, boolean>;
				const wanted = Object.keys(
					typeOf(minimal, schemaName).properties ?? {},
				).filter((field) => {
					return !NOT_IN_FILES.includes(field);
				});
				const missing = wanted.filter((field) => {
					return !fields.has(field);
				});
				expect(missing).toEqual([]);
			},
		);

		it.each(Object.entries(TYPES))(
			"%s names no field %s does not have",
			(name, schemaName) => {
				const fields = declared().get(name) as Map<string, boolean>;
				const known = typeOf(full, schemaName).properties ?? {};
				const invented = [...fields.keys()].filter((field) => {
					return !(field in known);
				});
				expect(invented).toEqual([]);
			},
		);

		it.each(Object.entries(TYPES))(
			"%s lets a field be absent or null wherever %s does",
			(name, schemaName) => {
				const fields = declared().get(name) as Map<string, boolean>;
				const type = typeOf(full, schemaName);
				// a field typed as always there, that a file may leave out or
				// set to null: code reading it would not be made to check
				const tooStrict = [...fields.entries()]
					.filter(([field, lenient]) => {
						return !lenient && mayBeAbsent(type, field);
					})
					.map(([field]) => {
						return field;
					});
				expect(tooStrict).toEqual([]);
			},
		);

		it("read none of the fields LDtk has deprecated", () => {
			const deprecated: string[] = [];
			for (const [name, schemaName] of Object.entries(TYPES)) {
				const fields = declared().get(name) as Map<string, boolean>;
				const known = typeOf(full, schemaName).properties ?? {};
				for (const field of fields.keys()) {
					const text = known[field]?.description ?? "";
					// `instances` is the table of content of a file saved before
					// LDtk 1.5: read only where `instancesData` is not there
					if (
						/this deprecated value/.test(text) &&
						!(name === "LDtkTocEntry" && field === "instances")
					) {
						deprecated.push(`${name}.${field}`);
					}
				}
			}
			expect(deprecated).toEqual([]);
		});
	});

	describe("the samples that come with LDtk", () => {
		it.each(SAMPLES)("%s follows the schema", async (sample) => {
			const json: unknown = await (
				await fetch(sampleURL(`${sample}.ldtk`))
			).json();
			// the fields a game reads, each there and of its type; the
			// editor's own fields are not looked at
			expect(violations(minimal, minimal.LdtkJsonRoot, json, false)).toEqual(
				[],
			);
		});

		it.each(SAMPLES)(
			"%s: the table of content places entities where the world's layout does",
			async (sample) => {
				const json = (await (
					await fetch(sampleURL(`${sample}.ldtk`))
				).json()) as LDtkProjectJson;
				const project = new LDtkProject(sample, json);
				// LDtk's own word on where an entity is in its world, against
				// where the levels are laid out here: a linear world's levels
				// have no position in the file, and are placed by the loader
				for (const listed of project.getTableOfContent()) {
					expect(listed.level, listed.iid).toBeDefined();
					const info = listed.level as LDtkLevelInfo;
					let found = false;
					for (const instance of info.json.layerInstances ?? []) {
						for (const placed of instance.entityInstances) {
							if (placed.iid === listed.iid) {
								found = true;
								expect([listed.x, listed.y]).toEqual([
									info.x + placed.px[0],
									info.y + placed.px[1],
								]);
								expect([listed.width, listed.height]).toEqual([
									placed.width,
									placed.height,
								]);
							}
						}
					}
					// a project that keeps its levels in files of their own has
					// no layers here to look in
					expect(found || json.externalLevels).toBe(true);
				}
			},
		);

		it("four of the samples have a table of content, one of a linear world of several levels", async () => {
			const counts: Record<string, number> = {};
			for (const sample of SAMPLES) {
				const json = (await (
					await fetch(sampleURL(`${sample}.ldtk`))
				).json()) as LDtkProjectJson;
				const listed = new LDtkProject(sample, json).getTableOfContent();
				if (listed.length > 0) {
					counts[sample] = listed.length;
				}
			}
			expect(counts).toEqual({
				Entities: 1,
				Test_file_for_API_showing_all_features: 2,
				Typical_TopDown_example: 1,
				WorldMap_GridVania_layout: 1,
			});
			// the one that tells the space between a linear world's levels
			const json = (await (
				await fetch(sampleURL("Test_file_for_API_showing_all_features.ldtk"))
			).json()) as LDtkProjectJson;
			const listed = new LDtkProject("t", json).getTableOfContent(
				"EntityFieldsTest",
			);
			expect(
				listed.map((entry) => {
					return [entry.level?.identifier, entry.x, entry.y];
				}),
			).toEqual([
				["Everything", 152, 312],
				["Autolayer", 120, 704],
			]);
		});

		it("the checker tells a file that does not follow it", async () => {
			const json = (await (await fetch(sampleURL("Entities.ldtk"))).json()) as {
				levels: Record<string, unknown>[];
			};
			delete json.levels[0].pxWid;
			json.levels[0].worldDepth = "0";
			expect(violations(minimal, minimal.LdtkJsonRoot, json, false)).toEqual([
				'$.levels[0]: "pxWid" is missing',
				'$.levels[0].worldDepth: "0" is not integer',
			]);
		});
	});

	describe("the projects written for the tests", () => {
		// what the tests load is what LDtk could have saved: every field a
		// game reads, of its type, and no field of the tests' own invention
		it("a tile", () => {
			expect(
				violations(minimal, typeOf(minimal, "Tile"), tile(8, 16, 3, 1), true),
			).toEqual([]);
		});

		it("a layer", () => {
			expect(
				violations(
					minimal,
					typeOf(minimal, "LayerInstance"),
					layer("Tiles", "Tiles", 16, 4, 4, [tile(0, 0, 1)], {
						entityInstances: [entity("Chest", 8, 8)],
					}),
					true,
				),
			).toEqual([]);
		});

		it("a level", () => {
			expect(
				violations(
					minimal,
					typeOf(minimal, "Level"),
					levelJson("Level", [layer("Auto", "AutoLayer", 16, 4, 4, [])]),
					true,
				),
			).toEqual([]);
		});

		it("the definitions", () => {
			expect(
				violations(minimal, typeOf(minimal, "Definitions"), defs(), true),
			).toEqual([]);
		});

		it("a whole project", () => {
			expect(
				violations(
					minimal,
					minimal.LdtkJsonRoot,
					projectJson([levelJson("Level", [])]),
					true,
				),
			).toEqual([]);
		});
	});
});
