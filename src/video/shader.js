/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * The WebGL Shader singleton
     * There is no constructor function for me.video.shader
     * @namespace me.video.shader
     * @memberOf me.video
     * @ignore
     */
    me.video.shader = (function () {
        /**
         * Public API
         * @ignore
         */
        var api = {
            "attributes"    : {},
            "uniforms"      : {},
            "handle"        : null,
        };

        /**
         * Shader GLSL
         * @ignore
         */
        var fragment = "@FRAGMENT";
        var vertex = "@VERTEX";

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
         * Useless bind function for compatibility with glslify
         * @name bind
         * @memberOf me.video.shader
         * @function
         */
        api.bind = function () {};

        /**
         *
         * @name createShader
         * @memberOf me.video.shader
         * @function
         * @param {WebGLContext} gl WebGL Context
         * @return {me.video.shader} A reference to the WebGL Shader singleton
         */
        api.createShader = function (gl) {
            var handle = api.handle = gl.createProgram();
            gl.attachShader(handle, getShader(gl, gl.VERTEX_SHADER, vertex));
            gl.attachShader(handle, getShader(gl, gl.FRAGMENT_SHADER, fragment));
            gl.linkProgram(handle);

            if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
                throw new me.video.Error("Could not initialize shaders");
            }

            gl.useProgram(handle);

            // Get attribute references
            var attributes = {};
            var aLocations = {};
            [
                "aPosition",
                "aTexture"
            ].forEach(function (attr) {
                aLocations[attr] = {
                    "location" : gl.getAttribLocation(handle, attr)
                };
                gl.enableVertexAttribArray(aLocations[attr].location);
                attributes[attr] = {
                    "get" : (function (attr) {
                        /**
                         * A getter for the attribute location
                         * @ignore
                         */
                        return function () {
                            return aLocations[attr];
                        };
                    })(attr),
                };
            });
            Object.defineProperties(api.attributes, attributes);

            // Get uniform references
            var uniforms = {};
            var uLocations = {};
            [
                "pMatrix",
                "uMatrix",
                "uColor",
                "texture"
            ].forEach(function (uniform) {
                uLocations[uniform] = {
                    "location" : gl.getUniformLocation(handle, uniform)
                };
                uniforms[uniform] = {
                    "get" : (function (uniform) {
                        /**
                         * A getter for the uniform location
                         * @ignore
                         */
                        return function () {
                            return uLocations[uniform];
                        };
                    })(uniform),
                    "set" : (function (uniform) {
                        if (uniform === "uColor") {
                            /**
                             * A setter for 4-element float vectors, e.g. colors
                             * @ignore
                             */
                            return function (val) {
                                gl.uniform4fv(
                                    uLocations[uniform].location,
                                    val
                                );
                            };
                        }
                        if (uniform === "texture") {
                            /**
                             * A setter for sampler2D uniforms, e.g. textures
                             * @ignore
                             */
                            return function () {
                                gl.uniform1i(
                                    uLocations[uniform].location,
                                    0
                                );
                            };
                        }
                        return function (val) {
                            /**
                             * A setter for 3x3 matrices
                             * @ignore
                             */
                            gl.uniformMatrix3fv(
                                uLocations[uniform].location,
                                false,
                                val
                            );
                        };
                    })(uniform),
                };
            });
            Object.defineProperties(api.uniforms, uniforms);

            return api;
        };

        /**
         * Create a texture from an image
         * @name gltexture2d
         * @memberOf me.video.shader
         * @function
         * @param {WebGLContext} gl WebGL Context
         * @param {Image|Canvas|ImageData} image Source image
         * @return {WebGLTexture} A newly created texture
         */
        api.gltexture2d = function (gl, image) {
            var texture = gl.createTexture(),
                filter = me.sys.scalingInterpolation ? gl.LINEAR : gl.NEAREST;

            /**
             * A convenience method for binding this texture to the current
             * texture element for compatibility with gl-texture2d
             * @ignore
             */
            texture.bind = function () {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return texture;
            };

            texture.bind();
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            return texture;
        };

        return api;
    })();

})();
