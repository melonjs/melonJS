import { dirname, resolve, extname, posix, sep } from "node:path";
import { emitWarning, cwd } from "node:process";
import { readFileSync } from "node:fs";
import { LoadingOptions } from "./types";

/**
 * that caused a recursion error
 */
let recursiveChunk = "";

/**
 * List of all shader chunks, it's used to track included files
 */
const allChunks = new Set();

/**
 * @description Map of shaders that import other chunks, it's
 * used to track included files in order to avoid recursion
 * - Key: shader path that uses other chunks as dependencies
 * - Value: list of chunk paths included within the shader
 */
const dependentChunks = new Map<string, string[]>();

/**
 * @description Map of duplicated shader
 * imports, used by warning messages
 */
const duplicatedChunks = new Map<string, string[]>();

/**
 * @description RegEx to match GLSL
 * `#include` preprocessor instruction
 */
const include = /#include(\s+([^\s<>]+));?/gi;

/**
 * @description Clears all lists of saved chunks
 * and resets "recursiveChunk" path to empty
 * @returns Copy of "recursiveChunk" path
 */
function resetSavedChunks() {
	const chunk = recursiveChunk;
	duplicatedChunks.clear();
	dependentChunks.clear();

	recursiveChunk = "";
	allChunks.clear();
	return chunk;
}

/**
 * @description Gets last chunk that caused a
 * recursion error from the "dependentChunks" list
 * @returns Chunk path that started a recursion
 */
function getRecursionCaller() {
	const dependencies = [...dependentChunks.keys()];
	return dependencies[dependencies.length - 1];
}

/**
 * @description Checks if shader chunk was already included
 * and adds it to the "duplicatedChunks" list if yes
 * @param path Shader's absolute path
 * @throws {Warning} If shader chunk was already included
 */
function checkDuplicatedImports(path: string) {
	if (!allChunks.has(path)) return;
	const caller = getRecursionCaller();

	const chunks = duplicatedChunks.get(caller) ?? [];
	if (chunks.includes(path)) return;

	chunks.push(path);
	duplicatedChunks.set(caller, chunks);

	emitWarning(`'${path}' was included multiple times.`, {
		code: "vite-plugin-glsl",
		detail:
			"Please avoid multiple imports of the same chunk in order to avoid" +
			` recursions and optimize your shader length.\nDuplicated import found in file '${caller}'.`,
	});
}

/**
 * @description Removes comments from shader source
 * code in order to avoid including commented chunks
 * @param  source Shader's source code
 * @param triple Remove comments starting with `///`
 * @returns Shader's source code without comments
 */
function removeSourceComments(source: string, triple = false) {
	if (source.includes("/*") && source.includes("*/")) {
		source =
			source.slice(0, source.indexOf("/*")) +
			source.slice(source.indexOf("*/") + 2, source.length);
	}

	const lines = source.split("\n");

	for (let l = lines.length; l--; ) {
		const index = lines[l].indexOf("//");

		if (index > -1) {
			if (lines[l][index + 2] === "/" && !include.test(lines[l]) && !triple)
				continue;
			lines[l] = lines[l].slice(0, lines[l].indexOf("//"));
		}
	}

	return lines.join("\n");
}

/**
 * @description Checks if shader dependencies
 * have caused a recursion error or warning
 * @param  path Shader's absolute path
 * @param warn Check already included chunks
 * @returns Import recursion has occurred
 */
function checkRecursiveImports(path: string, warn: boolean) {
	if (warn) {
		checkDuplicatedImports(path);
	}
	return checkIncludedDependencies(path, path);
}

/**
 * @description Checks if included
 * chunks caused a recursion error
 * @param path Current chunk absolute path
 * @param root Main shader path that imports chunks
 * @returns Included chunk started a recursion
 */
function checkIncludedDependencies(path: string, root: string) {
	const dependencies = dependentChunks.get(path);
	let recursiveDependency = false;

	if (dependencies?.includes(root)) {
		recursiveChunk = root;
		return true;
	}

	dependencies?.forEach(
		(dependency) =>
			(recursiveDependency ||= checkIncludedDependencies(dependency, root)),
	);

	return recursiveDependency;
}

/**
 * @description Compresses shader source code by
 * removing unnecessary whitespace and empty lines
 * @param  shader  Shader code with included chunks
 * @param newLine Flag to require a new line for the code
 * @returns Compressed shader's source code
 */
function compressShader(shader: string, newLine = false) {
	return shader
		.replace(
			/\\(?:\r\n|\n\r|\n|\r)|\/\*.*?\*\/|\/\/(?:\\(?:\r\n|\n\r|\n|\r)|[^\n\r])*/g,
			"",
		)
		.split(/\n+/)
		.reduce<string[]>((result, line) => {
			line = line.trim().replace(/\s{2,}|\t/, " ");

			if (/@(vertex|fragment)/.test(line) || line.endsWith("return"))
				line += " ";

			if (line[0] === "#") {
				if (newLine) {
					result.push("\n");
				}
				result.push(line, "\n");
				newLine = false;
			} else {
				if (
					!line.startsWith("{") &&
					result.length &&
					result[result.length - 1].endsWith("else")
				) {
					result.push(" ");
				}
				result.push(
					line.replace(
						/\s*({|}|=|\*|,|\+|\/|>|<|&|\||\[|\]|\(|\)|-|!|;)\s*/g,
						"$1",
					),
				);
				newLine = true;
			}

			return result;
		}, [])
		.join("")
		.replace(/\n+/g, "\n");
}

/**
 * @description Includes shader's dependencies
 * and removes comments from the source code
 * @param  source    Shader's source code
 * @param  path      Shader's absolute path
 * @param  extension Default shader extension
 * @param warn      Check already included chunks
 * @param  root      Shader's root directory
 * @throws {Error}   If shader chunks started a recursion loop
 * @returns Shader's source code without external chunks
 */
function loadChunks(
	source: string,
	path: string,
	extension: string,
	warn: boolean,
	root: string,
) {
	const unixPath = path.split(sep).join(posix.sep);

	if (checkRecursiveImports(unixPath, warn)) {
		return recursiveChunk;
	}

	source = removeSourceComments(source);
	let directory = dirname(unixPath);
	allChunks.add(unixPath);

	if (include.test(source)) {
		dependentChunks.set(unixPath, []);
		const currentDirectory = directory;

		source = source.replace(include, (_, chunkPath: string) => {
			chunkPath = chunkPath.trim().replace(/^(?:"|')?|(?:"|')?;?$/gi, "");

			if (!chunkPath.indexOf("/")) {
				const base = cwd().split(sep).join(posix.sep);
				chunkPath = base + root + chunkPath;
			}

			const directoryIndex = chunkPath.lastIndexOf("/");
			directory = currentDirectory;

			if (directoryIndex !== -1) {
				directory = resolve(directory, chunkPath.slice(0, directoryIndex + 1));
				chunkPath = chunkPath.slice(directoryIndex + 1, chunkPath.length);
			}

			let shader = resolve(directory, chunkPath);

			if (!extname(shader)) shader = `${shader}.${extension}`;

			const shaderPath = shader.split(sep).join(posix.sep);
			dependentChunks.get(unixPath)?.push(shaderPath);

			return loadChunks(
				readFileSync(shader, "utf8"),
				shader,
				extension,
				warn,
				root,
			);
		});
	}

	if (recursiveChunk) {
		const caller = getRecursionCaller();
		const recursiveChunk = resetSavedChunks();

		throw new Error(
			`Recursion detected when importing '${recursiveChunk}' in '${caller}'.`,
		);
	}

	return source.trim().replace(/(\r\n|\r|\n){3,}/g, "$1\n");
}

/**
 * @description Iterates through all external chunks,
 * includes them into the shader's source code
 * and optionally compresses the output
 * @param         source  Shader's source code
 * @param         shader  Shader's absolute path
 * @param options Configuration object to define:
 *
 *  - Warn if the same chunk was imported multiple times
 *  - Shader suffix when no extension is specified
 *  - Compress output shader code
 *  - Directory for root imports
 * @returns Loaded, parsed (and compress)
 * shader output and Map of shaders that import other chunks
 */
export default function (
	source: string,
	shader: string,
	options: LoadingOptions,
) {
	const { warnDuplicatedImports, defaultExtension, compress, root } = options;

	resetSavedChunks();

	let output = loadChunks(
		source,
		shader,
		defaultExtension,
		warnDuplicatedImports,
		root,
	);
	output = compress ? removeSourceComments(output, true) : output;

	return {
		dependentChunks,
		outputShader: compress
			? typeof compress !== "function"
				? compressShader(output)
				: compress(output)
			: output,
	};
}
