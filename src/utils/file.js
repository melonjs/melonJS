
/**
 * a collection of file utility functions
 * @namespace utils.file
 */

// regexp to deal with file name & path
const REMOVE_PATH = /^.*(\\|\/|\:)/;
const REMOVE_EXT = /\.[^\.]*$/;


/**
 * return the base name of the file without path info
 * @public
 * @memberof utils.file
 * @name getBasename
 * @param  {string} path- -  path containing the filename
 * @returns {string} the base name without path information.
 */
export function getBasename(path) {
    return path.replace(REMOVE_PATH, "").replace(REMOVE_EXT, "");
}

/**
 * return the extension of the file in the given path
 * @public
 * @memberof utils.file
 * @name getExtension
 * @param  {string} path- -  path containing the filename
 * @returns {string} filename extension.
 */
export function getExtension(path) {
    return path.substring(path.lastIndexOf(".") + 1, path.length);
}
