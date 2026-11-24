/**
 * melonJS — LDtk level loader example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
const base = `${import.meta.env.BASE_URL}assets/ldtk/`;

/** the sample projects that come with LDtk, as the editor saves them */
export const samples = [
	{ name: "Typical_2D_platformer_example", label: "Typical 2D platformer" },
	{ name: "Typical_TopDown_example", label: "Typical top-down" },
	{ name: "WorldMap_GridVania_layout", label: "World map: GridVania layout" },
	{ name: "WorldMap_Free_layout", label: "World map: free layout" },
	{ name: "AutoLayers_1_basic", label: "Auto-layers 1: basic" },
	{ name: "AutoLayers_2_stamps", label: "Auto-layers 2: stamps" },
	{ name: "AutoLayers_3_Mosaic", label: "Auto-layers 3: mosaic" },
	{ name: "AutoLayers_4_Assistant", label: "Auto-layers 4: assistant" },
	{ name: "AutoLayers_5_Advanced", label: "Auto-layers 5: advanced" },
	{ name: "Entities", label: "Entities" },
	{ name: "SeparateLevelFiles", label: "Levels in separate files" },
	{
		name: "Test_file_for_API_showing_all_features",
		label: "Every feature (API test file)",
	},
];

// A project is one asset: the tileset images it names, its levels'
// backgrounds and the level files it keeps apart are loaded with it, from
// where the project file says they are.
export const resources = samples.map((sample) => {
	return { name: sample.name, type: "ldtk", src: `${base}${sample.name}.ldtk` };
});
