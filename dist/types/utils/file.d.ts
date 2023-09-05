/**
 * return the base name of the file without path info
 * @public
 * @memberof utils.file
 * @name getBasename
 * @param  {string} path -  path containing the basename to extract
 * @returns {string} the base name without path information.
 */
export function getBasename(path: string): string;
/**
 * return the path of the file
 * @public
 * @memberof utils.file
 * @name getPath
 * @param  {string} path - the copmplete file path to extract the path from
 * @returns {string} the extracted path
 */
export function getPath(path: string): string;
/**
 * return the extension of the file in the given path
 * @public
 * @memberof utils.file
 * @name getExtension
 * @param  {string} path - path containing the filename and extension to extract
 * @returns {string} filename extension.
 */
export function getExtension(path: string): string;
