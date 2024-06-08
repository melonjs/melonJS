/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
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
