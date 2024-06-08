/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * Hash map of GLSL data types to WebGL Uniform methods
 * @ignore
 */
const fnHash = {
    "bool"      : "1i",
    "int"       : "1i",
    "float"     : "1f",
    "vec2"      : "2fv",
    "vec3"      : "3fv",
    "vec4"      : "4fv",
    "bvec2"     : "2iv",
    "bvec3"     : "3iv",
    "bvec4"     : "4iv",
    "ivec2"     : "2iv",
    "ivec3"     : "3iv",
    "ivec4"     : "4iv",
    "mat2"      : "Matrix2fv",
    "mat3"      : "Matrix3fv",
    "mat4"      : "Matrix4fv",
    "sampler2D" : "1i"
};

/**
 * @ignore
 */
function extractUniforms(gl, shader) {
    let uniforms = {},
        uniRx = /uniform\s+(\w+)\s+(\w+)/g,
        uniformsData = {},
        descriptor = {},
        locations = {},
        match;

    // Detect all uniform names and types
    [ shader.vertex, shader.fragment ].forEach((shader) => {
        while ((match = uniRx.exec(shader))) {
            uniformsData[match[2]] = match[1];
        }
    });

    // Get uniform references
    Object.keys(uniformsData).forEach((name) => {
        let type = uniformsData[name];
        locations[name] = gl.getUniformLocation(shader.program, name);

        descriptor[name] = {
            "get" : (function (name) {
                /*
                 * A getter for the uniform location
                 */
                return function () {
                    return locations[name];
                };
            })(name),
            "set" : (function (name, type, fn) {
                if (type.indexOf("mat") === 0) {
                    /*
                     * A generic setter for uniform matrices
                     */
                    return function (val) {
                        gl[fn](locations[name], false, val);
                    };
                }
                else {
                    /*
                     * A generic setter for uniform vectors
                     */
                    return function (val) {
                        let fnv = fn;
                        if (val.length && fn.slice(-1) !== "v") {
                            fnv += "v";
                        }
                        gl[fnv](locations[name], val);
                    };
                }
            })(name, type, "uniform" + fnHash[type])
        };
    });
    Object.defineProperties(uniforms, descriptor);

    return uniforms;
}

export { extractUniforms };
