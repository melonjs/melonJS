/**
 * a collection of file utility functions
 */

// regexp to deal with file name & path
const PATH = /^.*(\\|\/|:)/;
const EXT = /\.[^.]*$/;

/**
 * return the base name of the file without path info
 * @param path -  path containing the basename to extract
 * @returns the base name without path information.
 */
export function getBasename(path: string) {
	return path.replace(PATH, "").replace(EXT, "");
}

/**
 * return the extension of the file in the given path
 * @param path - path containing the filename and extension to extract
 * @returns filename extension.
 */
export function getExtension(path: string) {
	return path.substring(path.lastIndexOf(".") + 1, path.length);
}
