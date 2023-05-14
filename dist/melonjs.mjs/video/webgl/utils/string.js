/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * clean the given source from space, comments, etc...
 * @ignore
 */
function minify(src) {
    // remove comments
    src = src.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
    // Remove leading and trailing whitespace from lines
    src = src.replace(/(\\n\s+)|(\s+\\n)/g, "");
    // Remove line breaks
    src = src.replace(/(\\r|\\n)+/g, "");
    // Remove unnecessary whitespace
    src = src.replace(/\s*([;,[\](){}\\\/\-+*|^&!=<>?~%])\s*/g, "$1");

    return src;
}

export { minify };
