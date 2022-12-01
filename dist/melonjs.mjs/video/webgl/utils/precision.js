/*!
 * melonJS Game Engine - v14.1.2
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * set precision for the fiven shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
function setPrecision(src, precision) {
    if (src.substring(0, 9) !== "precision") {
        return "precision " + precision + " float;" + src;
    }
    return src;
}

export { setPrecision };
