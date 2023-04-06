/**
 * @ignore
 */
export function extractAttributes(gl, shader) {
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
