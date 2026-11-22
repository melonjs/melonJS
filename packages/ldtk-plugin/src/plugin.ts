import {
	type Application,
	level as director,
	loader,
	plugin,
	utils,
} from "melonjs";
import {
	defaults,
	LDtkLevel,
	type LDtkLoadOptions,
	LDtkWorld,
	LOAD_OPTIONS,
} from "./level.ts";
import { LDtkProject } from "./project.ts";
import type { LDtkLevelJson, LDtkProjectJson } from "./types.ts";

/** the name LDtk projects are loaded and registered under */
const FORMAT = "ldtk";

/** an asset as the loader hands it to a parser */
interface LDtkAsset {
	name: string;
	type: string;
	src?: string | string[];
	/** the project file's content, in place of a file to fetch */
	data?: unknown;
}

/** how the plugin loads projects, and the options of every level it loads */
export interface LDtkPluginOptions extends LDtkLoadOptions {
	/**
	 * Load the images a project names (its tilesets and its levels'
	 * backgrounds) with the project, from where the project file says they
	 * are, when no image of that name is loaded already. Set it to `false`
	 * to preload them yourself, each under its file's name without the
	 * extension.
	 * @default true
	 */
	loadImages?: boolean;
}

/** the projects loaded, by the name they were loaded under */
const projects = new Map<string, LDtkProject>();
/** the levels and worlds registered with the level director, by their id */
const maps = new Map<string, LDtkLevel | LDtkWorld>();
/** the images loaded for projects: who uses each, and its load */
const images = new Map<
	string,
	{
		asset: { name: string; type: string; src: string };
		users: Set<string>;
		loading: Promise<void>;
	}
>();

let loadImages = true;
let registered = false;

/**
 * a JSON file
 * @param url - where it is
 * @returns its content
 */
const fetchJSON = async (url: string): Promise<unknown> => {
	const response = await fetch(url);
	// a 404 still resolves: without this the error page is parsed
	if (!response.ok) {
		throw new Error(`${url}: HTTP ${String(response.status)}`);
	}
	return response.json();
};

/**
 * load an image a project names, unless one of its name is loaded already
 * @param project - the name of the project
 * @param dir - the folder of the project file
 * @param relPath - the image, relative to it
 * @returns when it is loaded
 */
const loadImage = (
	project: string,
	dir: string,
	relPath: string,
): Promise<void> => {
	const name = utils.file.getBasename(relPath);
	const mine = images.get(name);
	if (mine !== undefined) {
		mine.users.add(project);
		return mine.loading;
	}
	// the game's own, preloaded under the file's name
	if (loader.getImage(name) !== null) {
		return Promise.resolve();
	}
	const extension = utils.file.getExtension(relPath).toLowerCase();
	const asset = {
		name,
		// LDtk takes an Aseprite file for a tileset, and so does the loader
		type:
			extension === "aseprite" || extension === "ase" ? "aseprite" : "image",
		src: dir + relPath,
	};
	const loading = loader.load(asset);
	images.set(name, { asset, users: new Set([project]), loading });
	return loading;
};

/**
 * read a project: its file, the level files it names, and its images
 * @param asset - the asset
 * @returns the project
 */
const readProject = async (asset: LDtkAsset): Promise<LDtkProject> => {
	const src = typeof asset.src === "string" ? asset.src : undefined;
	const json = (
		asset.data !== undefined && asset.data !== null
			? asset.data
			: await fetchJSON(src ?? "")
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
		levels.map(async (level) => {
			if (
				level.layerInstances === null &&
				typeof level.externalRelPath === "string"
			) {
				if (dir === undefined) {
					throw new Error(
						`${asset.name}: level "${level.identifier}" is in a file of its own (${level.externalRelPath}), which needs the project loaded from a file`,
					);
				}
				const external = (await fetchJSON(
					dir + level.externalRelPath,
				)) as LDtkLevelJson;
				level.layerInstances = external.layerInstances;
			}
		}),
	);

	if (loadImages && dir !== undefined) {
		const paths = new Set<string>();
		for (const tileset of json.defs.tilesets) {
			if (tileset.relPath !== null) {
				paths.add(tileset.relPath);
			}
		}
		for (const level of levels) {
			if (typeof level.bgRelPath === "string") {
				paths.add(level.bgRelPath);
			}
		}
		await Promise.all(
			[...paths].map((path) => {
				return loadImage(asset.name, dir, path);
			}),
		);
	}
	return new LDtkProject(asset.name, json);
};

/**
 * the loader's parser for `.ldtk` files
 * @param asset - the asset
 * @param onload - called once the project is ready
 * @param onerror - called if it cannot be read
 * @returns how many assets are being loaded
 */
const parse = (
	asset: LDtkAsset,
	onload?: () => void,
	onerror?: (error: unknown) => void,
): number => {
	if (projects.has(asset.name)) {
		// loaded already
		return 0;
	}
	readProject(asset).then(
		(project) => {
			projects.set(asset.name, project);
			// the levels in LDtk's order, then the worlds: `level.next()`
			// steps through the levels first
			for (const info of project.levels) {
				maps.set(info.id, new LDtkLevel(project, info));
				director.add(FORMAT, info.id);
			}
			for (const info of project.worlds) {
				maps.set(info.id, new LDtkWorld(project, info));
				director.add(FORMAT, info.id);
			}
			onload?.();
		},
		(error: unknown) => {
			onerror?.(error);
		},
	);
	return 1;
};

/**
 * free a project: its levels leave the level director, and the images loaded
 * for it are freed once no other project uses them
 * @param asset - the asset
 * @returns false if no such project was loaded
 */
const unload = (asset: LDtkAsset): boolean => {
	const project = projects.get(asset.name);
	if (project === undefined) {
		return false;
	}
	projects.delete(asset.name);
	for (const id of [
		...project.levels.map((info) => {
			return info.id;
		}),
		...project.worlds.map((info) => {
			return info.id;
		}),
	]) {
		director.remove(id);
		maps.delete(id);
	}
	for (const [name, image] of images) {
		image.users.delete(asset.name);
		if (image.users.size === 0) {
			images.delete(name);
			loader.unload(image.asset);
		}
	}
	return true;
};

/**
 * a project loaded with the loader
 * @param name - the name it was loaded under
 * @returns the project, or undefined if none was loaded under that name
 * @example
 * const project = getProject("world");
 * for (const info of project.levels) {
 *     console.log(info.identifier, info.id, info.width, info.height);
 * }
 */
export function getProject(name: string): LDtkProject | undefined {
	return projects.get(name);
}

/**
 * Loads LDtk projects: once registered, a `.ldtk` file is an asset of type
 * `"ldtk"`, and each of its levels a level of the level director, loaded with
 * `level.load("<asset name>:<level identifier>")`. The whole world is loaded
 * with `level.load("<asset name>")`.
 * @example
 * import { level, loader, plugin } from "melonjs";
 * import { LDtkPlugin } from "@melonjs/ldtk-plugin";
 *
 * plugin.register(LDtkPlugin);
 *
 * // the tileset images the project names are loaded with it
 * loader.preload([{ name: "world", type: "ldtk", src: "data/world.ldtk" }], () => {
 *     level.load("world:Level_0");
 * });
 * @category Plugins
 * @document ../README.md
 */
export class LDtkPlugin extends plugin.BasePlugin {
	/**
	 * @param options - how projects are loaded, and the options of every level loaded
	 * @param app - the application; the default one unless given
	 */
	constructor(options: LDtkPluginOptions = {}, app?: Application) {
		super(app);
		// the level format registry and the tile map classes this is built on
		this.version = "20.18.0";

		const { loadImages: load, ...loadOptions } = options;
		loadImages = load !== false;
		Object.assign(defaults, loadOptions);

		// the parser and the level format are the page's, as the loader and
		// the level director are: registered once
		if (!registered) {
			registered = true;
			loader.setParser(FORMAT, parse, { unload });
			director.registerFormat(FORMAT, {
				create: (levelId: string) => {
					return maps.get(levelId);
				},
				loadOptions: LOAD_OPTIONS,
			});
		}
	}

	/**
	 * a project loaded with the loader
	 * @param name - the name it was loaded under
	 * @returns the project, or undefined if none was loaded under that name
	 */
	getProject(name: string): LDtkProject | undefined {
		return projects.get(name);
	}
}
