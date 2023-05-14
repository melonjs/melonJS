/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * @ignore
 */
function extractAttributes(gl, shader) {
    let attributes = {},
        attrRx = /attribute\s+\w+\s+(\w+)/g,
        match,
        i = 0;

    // Detect all attribute names
    while ((match = attrRx.exec(shader.vertex))) {
        attributes[match[1]] = i++;
    }

    return attributes;
}

export { extractAttributes };
