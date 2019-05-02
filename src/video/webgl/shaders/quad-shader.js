(function () {

    /**
     * a built-in shader used by the Compositor for Quad Texture drawing
     * @class
     * @extends me.GLShader
     * @see me.WebGLRenderer.Compositor
     * @constructor
     * @param {WebGLRenderingContext} gl the current WebGL rendering context
     * @param {Number} maxTextures the maximum amount of Texture supported by the WebGL Driver
     */
    me.QuadGLShader = me.GLShader.extend({
        /**
         * @ignore
         */
        init : function (gl, maxTextures) {
            this._super(me.GLShader, "init", [ gl,
                [   // vertex`
                    "precision highp float;",
                    "attribute vec2 aVertex;",
                    "attribute vec4 aColor;",
                    "attribute float aTexture;",
                    "attribute vec2 aRegion;",
                    "uniform mat3 uProjectionMatrix;",
                    "varying vec4 vColor;",
                    "varying float vTexture;",
                    "varying vec2 vRegion;",
                    "void main(void) {",
                    "    // Transform the vertex position by the projection matrix",
                    "    gl_Position = vec4((uProjectionMatrix * vec3(aVertex, 1.0)).xy, 0.0, 1.0);",
                    "    // Pass the remaining attributes to the fragment shader",
                    "    vColor = vec4(aColor.rgb * aColor.a, aColor.a);",
                    "    vTexture = aTexture;",
                    "    vRegion = aRegion;",
                    "}"
                ].join("\n"),
                [ // fragment
                    /*
                     * Dynamically indexing arrays in a fragment shader is not allowed:
                     *
                     * https://www.khronos.org/registry/webgl/specs/1.0/#4.3
                     *
                     * "
                     *  Appendix A mandates certain forms of indexing of arrays; for example,
                     *  within fragment shaders, indexing is only mandated with a
                     *  constant-index-expression (see [GLES20GLSL] for the definition of this
                     *  term). In the WebGL API, only the forms of indexing mandated in
                     *  Appendix A are supported.
                     * "
                     *
                     * And GLES20GLSL has this to say about constant-index-expressions:
                     *
                     * "
                     *  constant-index-expressions are a superset of constant-expressions.
                     *  Constant-index-expressions can include loop indices as defined in
                     *  Appendix A section 4.
                     *
                     *  The following are constant-index-expressions:
                     *    * Constant expressions
                     *    * Loop indices as defined in section 4
                     *    * Expressions composed of both of the above
                     * "
                     *
                     * To workaround this issue, we create a long if-then-else statement using
                     * a template processor; the number of branches depends only on the total
                     * number of texture units supported by the WebGL implementation.
                     *
                     * The number of available texture units is at least 8, but can be as high
                     * as 32 (as of 2016-01); source: http://webglstats.com/
                     * See: MAX_TEXTURE_IMAGE_UNITS
                     *
                     * The idea of sampler selection originated from work by Kenneth Russell and
                     * Nat Duca from the Chromium Team.
                     * See: http://webglsamples.org/sprites/readme.html
                     */
                    "uniform sampler2D uSampler[" +maxTextures+ "];",
                    "varying vec4 vColor;",
                    "varying float vTexture;",
                    "varying vec2 vRegion;",
                    "void main(void) {",
                    "    // Convert texture unit index to integer",
                    "    int texture = int(vTexture);",
                    "    if (texture == 0) {",
                    "        gl_FragColor = texture2D(uSampler[0], vRegion) * vColor;",
                    "    }",
                    "    else {",
                    "        for (int i = 1; i < " + (maxTextures - 1) +"; i++) {",
                    "            if (texture == i) {",
                    "                gl_FragColor = texture2D(uSampler[i], vRegion) * vColor;",
                    "                return;",
                    "            }",
                    "            gl_FragColor = texture2D(uSampler[" + (maxTextures - 1) + "], vRegion) * vColor;",
                    "        };",
                    "    }",
                    "}"
                ].join("\n")
            ]);
            return this;
        }
    });
})();
