/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * The WebGL Shader singleton <br>
     * There is no constructor function for me.video.shader
     * @namespace me.video.shader
     * @memberOf me.video
     */
    me.video.shader = (function () {
        /**
         * Public API
         * @ignore
         */
        var api = {};

        /**
         * Compile GLSL into a shader object
         * @private
         */
        function getShader(gl, type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new me.video.Error(gl.getShaderInfoLog(shader));
            }

            return shader;
        }

        /**
         * Hash map of GLSL data types to WebGL Uniform methods
         * @private
         */
        var fnHash = {
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
         * Create a shader program (with bindings) using the given GLSL sources
         * @name createShader
         * @memberOf me.video.shader
         * @function
         * @param {WebGLContext} gl WebGL Context
         * @param {String} vertex Vertex shader source
         * @param {String} fragment Fragment shader source
         * @return {Object} A reference to the WebGL Shader Program
         */
        api.createShader = function (gl, vertex, fragment) {
            var program = {
                    "attributes"    : {},
                    "uniforms"      : {},
                    "handle"        : null
                },
                handle = program.handle = gl.createProgram(),
                attrRx = /attribute\s+\w+\s+(\w+)/g,
                uniRx = /uniform\s+(\w+)\s+(\w+)/g,
                attributes = [],
                uniforms = {},
                match,
                descriptor = {},
                locations = {};

            gl.attachShader(handle, getShader(gl, gl.VERTEX_SHADER, vertex));
            gl.attachShader(handle, getShader(gl, gl.FRAGMENT_SHADER, fragment));
            gl.linkProgram(handle);

            if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
                throw new me.video.Error(gl.getProgramInfoLog(handle));
            }

            gl.useProgram(handle);

            // Detect all attribute names
            while ((match = attrRx.exec(vertex))) {
                attributes.push(match[1]);
            }

            // Detect all uniform names and types
            [ vertex, fragment ].forEach(function (shader) {
                while ((match = uniRx.exec(shader))) {
                    uniforms[match[2]] = match[1];
                }
            });

            // Get attribute references
            attributes.forEach(function (attr) {
                program.attributes[attr] = gl.getAttribLocation(handle, attr);
                gl.enableVertexAttribArray(program.attributes[attr]);
            });

            // Get uniform references
            Object.keys(uniforms).forEach(function (name) {
                var type = uniforms[name];
                locations[name] = gl.getUniformLocation(handle, name);

                descriptor[name] = {
                    "get" : (function (name) {
                        /**
                         * A getter for the uniform location
                         * @ignore
                         */
                        return function () {
                            return locations[name];
                        };
                    })(name),
                    "set" : (function (name, type, fn) {
                        if (type.indexOf("mat") === 0) {
                            /**
                             * A generic setter for uniform matrices
                             * @ignore
                             */
                            return function (val) {
                                gl[fn](locations[name], false, val);
                            };
                        }
                        else {
                            /**
                            * A generic setter for uniform vectors
                            * @ignore
                            */
                            return function (val) {
                                var fnv = fn;
                                if (val.length && fn.substr(-1) !== "v") {
                                    fnv += "v";
                                }
                                gl[fnv](locations[name], val);
                            };
                        }
                    })(name, type, "uniform" + fnHash[type])
                };
            });
            Object.defineProperties(program.uniforms, descriptor);

            return program;
        };

        /**
         * Create a texture from an image
         * @name createTexture
         * @memberOf me.video.shader
         * @function
         * @param {WebGLContext} gl WebGL Context
         * @param {Number} unit Destination texture unit
         * @param {Image|Canvas|ImageData|UInt8Array[]|Float32Array[]} image Source image
         * @param {Number} filter gl.LINEAR or gl.NEAREST
         * @param {String} [repeat="no-repeat"] Image repeat behavior (see {@link me.ImageLayer#repeat})
         * @param {Number} [w] Source image width (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {Number} [h] Source image height (Only use with UInt8Array[] or Float32Array[] source image)
         * @param {Number} [b] Source image border (Only use with UInt8Array[] or Float32Array[] source image)
         * @return {WebGLTexture} A texture object
         */
        api.createTexture = function (gl, unit, image, filter, repeat, w, h, b) {
            repeat = repeat || "no-repeat";

            if (!me.utils.isPowerOfTwo(w || image.width) || !me.utils.isPowerOfTwo(h || image.height)) {
                console.warn(
                    "[WebGL Renderer] " + image + " is not a POT texture " +
                    "(" + (w || image.width) + "x" + (h || image.height) + ")"
                );
            }

            var texture = gl.createTexture(),
                rs = (repeat.search(/^repeat(-x)?$/) === 0) ? gl.REPEAT : gl.CLAMP_TO_EDGE,
                rt = (repeat.search(/^repeat(-y)?$/) === 0) ? gl.REPEAT : gl.CLAMP_TO_EDGE;

            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rs);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rt);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            if (w || h || b) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, b, gl.RGBA, gl.UNSIGNED_BYTE, image);
            }
            else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            }

            return texture;
        };

        return api;
    })();

})();
