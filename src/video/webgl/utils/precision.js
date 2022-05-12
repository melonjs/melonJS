/**
 * set precision for the fiven shader source
 * won't do anything if the precision is already specified
 * @ignore
 */
export function setPrecision(src, precision) {
    if (src.substring(0, 9) !== "precision") {
        return "precision " + precision + " float;" + src;
    }
    return src;
};
