import { LDtkLevel, LDtkWorld } from "../../level/ldtk/level.ts";
import { LDtkProject } from "../../level/ldtk/project.ts";
import { ldtkMaps, ldtkProjects } from "../../level/ldtk/registry.ts";
import type { LDtkLevelJson, LDtkProjectJson } from "../../level/ldtk/types.ts";
import { level } from "../../level/level.js";
import { fetchData } from "../../utils/fetchdata.js";
import { getBasename, getExtension } from "../../utils/file.ts";
import { getImage } from "../cache.js";
import { unload } from "../loader.js";
import { preloadAseprite } from "./aseprite.js";
import { preloadImage } from "./image.js";

/** an asset as the loader hands it to a parser */
interface LDtkAsset {
	name: string;
	type: string;
	src?: string | string[];
	/** the project file's content, in place of a file to fetch */
	data?: unknown;
}

/** the images loaded for projects: who uses each, and its load */
const images = new Map<
	string,
	{
		asset: { name: string; type: string; src: string };
		users: Set<string>;
		loading: Promise<void>;
	}
>();

/**
 * load an image a project names, unless one of its name is loaded already
 * @param project - the name of the project
 * @param dir - the folder of the project file
 * @param relPath - the image, relative to it
 * @param settings - the loader's request settings
 * @returns when it is loaded
 */
const loadImage = (
	project: string,
	dir: string,
	relPath: string,
	settings?: object,
): Promise<void> => {
	const name = getBasename(relPath);
	const mine = images.get(name);
	if (mine !== undefined) {
		mine.users.add(project);
		return mine.loading;
	}
	// the game's own, preloaded under the file's name
	if (getImage(name) !== null) {
		return Promise.resolve();
	}
	const extension = getExtension(relPath).toLowerCase();
	const asset = {
		name,
		// LDtk takes an Aseprite file for a tileset, and so does the loader
		type:
			extension === "aseprite" || extension === "ase" ? "aseprite" : "image",
		src: dir + relPath,
	};
	// through the parser itself, as a file's own references are: the path
	// is already resolved against the project file, and the image type's
	// base URL would be put in front of it a second time
	const parser = asset.type === "aseprite" ? preloadAseprite : preloadImage;
	const loading = new Promise<void>((resolve, reject) => {
		if (parser(asset, resolve, reject, settings) === 0) {
			resolve();
		}
	}).catch((error: unknown) => {
		// not kept: the next project to name this image tries again, or
		// finds the one the game loaded in the meantime
		images.delete(name);
		throw new Error(
			`LDtk project "${project}": its image "${relPath}" could not be loaded (${asset.src})`,
			{ cause: error },
		);
	});
	images.set(name, { asset, users: new Set([project]), loading });
	return loading;
};

/**
 * a project no longer uses the images loaded for it: each is freed once no
 * other project does
 * @param project - the name of the project
 */
const releaseImages = (project: string) => {
	for (const [name, image] of images) {
		if (image.users.delete(project) && image.users.size === 0) {
			images.delete(name);
			unload(image.asset);
		}
	}
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

	// the images the project names, unless the game loaded them itself
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
			[...paths].map((path) => {
				return loadImage(asset.name, dir, path, settings);
			}),
		);
		for (const result of results) {
			if (result.status === "rejected") {
				releaseImages(asset.name);
				throw result.reason;
			}
		}
	}
	return new LDtkProject(asset.name, json);
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
	readProject(asset, settings).then(
		(project) => {
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
 * for it are freed once no other project uses them
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
		level.remove(id);
		ldtkMaps.delete(id);
	}
	releaseImages(asset.name);
	return true;
}
