/**
 * @ignore
 */
function compileShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

/**
 * Compile GLSL into a shader object
 * @ignore
 */
export function compileProgram(gl, vertex, fragment, attributes) {
    let vertShader = compileShader(gl, gl.VERTEX_SHADER, vertex);
    let fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment);

    let program = gl.createProgram();

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);


    // force vertex attributes to use location 0 as starting location to prevent
    // browser to do complicated emulation when running on desktop OpenGL (e.g. on macOS)
    for (let location in attributes) {
        gl.bindAttribLocation(program, attributes[location], location);
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        let error_msg =
            "Error initializing Shader " + this + "\n" +
            "gl.VALIDATE_STATUS: " + gl.getProgramParameter(program, gl.VALIDATE_STATUS) + "\n" +
            "gl.getError()" + gl.getError() + "\n" +
            "gl.getProgramInfoLog()" + gl.getProgramInfoLog(program);
        // house cleaning
        gl.deleteProgram(program);
        program = null;
        // throw the exception
        throw new Error(error_msg);
    }

    gl.useProgram(program);

    // clean-up
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    return program;
}
