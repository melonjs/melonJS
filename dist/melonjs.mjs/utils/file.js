/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * a collection of file utility functions
 * @namespace utils.file
 */

// regexp to deal with file name & path
const PATH = /^.*(\\|\/|\:)/;
const EXT = /\.[^\.]*$/;


/**
 * return the base name of the file without path info
 * @public
 * @memberof utils.file
 * @name getBasename
 * @param  {string} path -  path containing the basename to extract
 * @returns {string} the base name without path information.
 */
function getBasename(path) {
    return path.replace(PATH, "").replace(EXT, "");
}

/**
 * return the path of the file
 * @public
 * @memberof utils.file
 * @name getPath
 * @param  {string} path - the copmplete file path to extract the path from
 * @returns {string} the extracted path
 */
function getPath(path) {
    return path.match(PATH)[0];
}

/**
 * return the extension of the file in the given path
 * @public
 * @memberof utils.file
 * @name getExtension
 * @param  {string} path - path containing the filename and extension to extract
 * @returns {string} filename extension.
 */
function getExtension(path) {
    return path.substring(path.lastIndexOf(".") + 1, path.length);
}

export { getBasename, getExtension, getPath };
