import { LDtkLevel, LDtkWorld } from "../../level/ldtk/level.ts";
import { LDtkProject } from "../../level/ldtk/project.ts";
import { ldtkMaps, ldtkProjects } from "../../level/ldtk/registry.ts";
import type { LDtkLevelJson, LDtkProjectJson } from "../../level/ldtk/types.ts";
import { level } from "../../level/level.js";
import { fetchData } from "../../utils/fetchdata.js";
import { getBasename, getExtension } from "../../utils/file.ts";
import { getImage } from "../cache.js";
import {
	loadReference,
	referenceSource,
	releaseReferences,
} from "../loader.js";

/** an asset as the loader hands it to a parser */
interface LDtkAsset {
	name: string;
	type: string;
	src?: string | string[];
	/** the project file's content, in place of a file to fetch */
	data?: unknown;
}

/** the projects on their way, by name: loaded once however many ask */
const loading = new Map<string, Promise<void>>();

/**
 * The image a project names, loaded for it unless one of its name is there
 * already: the loader holds it for the project, and frees it with the last
 * project that uses it.
 * @param project - the project's asset
 * @param dir - the folder of the project file
 * @param relPath - the image, relative to it
 * @param settings - the loader's request settings
 * @returns the name the image is kept under
 */
const loadImage = async (
	project: LDtkAsset,
	dir: string,
	relPath: string,
	settings?: object,
): Promise<string> => {
	const src = dir + relPath;
	const extension = getExtension(relPath).toLowerCase();
	// LDtk takes an Aseprite file for a tileset, and so does the loader
	const type =
		extension === "aseprite" || extension === "ase" ? "aseprite" : "image";
	// Kept under the file's name, as a Tiled map's images are. Another file
	// of that name, in another folder, was loaded for a project already: this
	// one takes the name with a number, so that each keeps its own image.
	// (An image the game loaded itself under the name stands for the file.)
	const base = getBasename(relPath);
	let name = base;
	for (let n = 2; ; n++) {
		const from = referenceSource({ name, type });
		if (from === undefined || from === src) {
			break;
		}
		name = `${base}~${String(n)}`;
	}
	try {
		await loadReference(
			{ name: project.name, type: project.type },
			{ name, type, src },
			settings,
		);
	} catch (error) {
		throw new Error(
			`LDtk project "${project.name}": its image "${relPath}" could not be loaded (${src})`,
			{ cause: error },
		);
	}
	return name;
};

/**
 * read a project: its file, the level files it names, and its images
 * @param asset - the asset
 * @param settings - the loader's request settings
 * @returns the project
 */
const readProject = async (
	asset: LDtkAsset,
	settings?: object,
): Promise<LDtkProject> => {
	const src = typeof asset.src === "string" ? asset.src : undefined;
	const json = (
		asset.data !== undefined && asset.data !== null
			? asset.data
			: await fetchData(src ?? "", "json", settings)
	) as LDtkProjectJson;
	if (!Array.isArray(json.levels) || typeof json.defs !== "object") {
		throw new Error(`${asset.name}: not an LDtk project file`);
	}
	// a project saved before LDtk had several worlds has no list of them
	(json as { worlds?: unknown }).worlds ??= [];
	// what the project names is relative to its own file
	const dir =
		src === undefined ? undefined : src.slice(0, src.lastIndexOf("/") + 1);

	// a project that saves its levels apart keeps only their outline
	const levels: LDtkLevelJson[] = [...json.levels];
	for (const world of json.worlds) {
		levels.push(...world.levels);
	}
	await Promise.all(
		levels.map(async (entry) => {
			if (
				entry.layerInstances === null &&
				typeof entry.externalRelPath === "string"
			) {
				if (dir === undefined) {
					throw new Error(
						`${asset.name}: level "${entry.identifier}" is in a file of its own (${entry.externalRelPath}), which needs the project loaded from a file`,
					);
				}
				const file = dir + entry.externalRelPath;
				const external = (await fetchData(file, "json", settings).catch(
					(error: unknown) => {
						throw new Error(
							`LDtk project "${asset.name}": the file of its level "${entry.identifier}" could not be loaded (${file})`,
							{ cause: error },
						);
					},
				)) as LDtkLevelJson;
				entry.layerInstances = external.layerInstances;
			}
		}),
	);

	// the images the project names, each under the name it is kept by
	const images = new Map<string, string>();
	if (dir !== undefined) {
		const paths = new Set<string>();
		for (const tileset of json.defs.tilesets) {
			if (tileset.relPath !== null) {
				paths.add(tileset.relPath);
			}
		}
		for (const entry of levels) {
			if (typeof entry.bgRelPath === "string") {
				paths.add(entry.bgRelPath);
			}
		}
		// every image is waited for, loaded or not: a project that fails
		// then lets go of the ones that did load
		const results = await Promise.allSettled(
			[...paths].map(async (path) => {
				// the game's own, preloaded under the file's name
				if (
					getImage(getBasename(path)) !== null &&
					referenceSource({ name: getBasename(path), type: "image" }) ===
						undefined &&
					referenceSource({ name: getBasename(path), type: "aseprite" }) ===
						undefined
				) {
					images.set(path, getBasename(path));
					return;
				}
				images.set(path, await loadImage(asset, dir, path, settings));
			}),
		);
		for (const result of results) {
			if (result.status === "rejected") {
				releaseReferences({ name: asset.name, type: asset.type });
				throw result.reason;
			}
		}
	}
	return new LDtkProject(asset.name, json, images);
};

/**
 * parse/preload an LDtk project file
 * @param asset - asset data
 * @param [onload] - function to be called when the asset is loaded
 * @param [onerror] - function to be called in case of error
 * @param [settings] - Additional settings to be passed when loading the asset
 * @returns the amount of corresponding resource parsed/preloaded
 * @ignore
 * @internal
 */
export function preloadLDtk(
	asset: LDtkAsset,
	onload?: () => void,
	onerror?: (error: unknown) => void,
	settings?: object,
): number {
	if (ldtkProjects.has(asset.name)) {
		// already loaded
		return 0;
	}
	// asked for again while it is on its way: the same load, not another
	let pending = loading.get(asset.name);
	if (pending === undefined) {
		pending = readProject(asset, settings)
			.then((project) => {
				ldtkProjects.set(asset.name, project);
				// the levels in LDtk's order, then the worlds: `level.next()`
				// steps through the levels first
				for (const info of project.levels) {
					ldtkMaps.set(info.id, new LDtkLevel(project, info));
					level.add("ldtk", info.id);
				}
				for (const info of project.worlds) {
					ldtkMaps.set(info.id, new LDtkWorld(project, info));
					level.add("ldtk", info.id);
				}
			})
			.finally(() => {
				loading.delete(asset.name);
			});
		loading.set(asset.name, pending);
	}
	pending.then(
		() => {
			onload?.();
		},
		(error: unknown) => {
			onerror?.(error);
		},
	);
	return 1;
}

/**
 * free a project: its levels leave the level director, and the images loaded
 * for it are freed once no other project, no bundle and not the game holds
 * them
 * @param asset - the asset
 * @returns false if no such project was loaded
 * @ignore
 * @internal
 */
export function unloadLDtk(asset: LDtkAsset): boolean {
	const project = ldtkProjects.get(asset.name);
	if (project === undefined) {
		return false;
	}
	ldtkProjects.delete(asset.name);
	for (const id of [
		...project.levels.map((info) => {
			return info.id;
		}),
		...project.worlds.map((info) => {
			return info.id;
		}),
	]) {
		// a level in the world stays there, as a Tiled map's does, but no
		// longer follows the viewport: nothing would end that later
		ldtkMaps.get(id)?.destroy();
		level.remove(id);
		ldtkMaps.delete(id);
	}
	releaseReferences({ name: asset.name, type: "ldtk" });
	return true;
}
