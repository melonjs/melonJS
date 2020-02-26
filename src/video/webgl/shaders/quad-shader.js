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
                    "attribute vec2 aRegion;",
                    "attribute vec4 aColor;",

                    "uniform mat3 uProjectionMatrix;",

                    "varying vec2 vRegion;",
                    "varying vec4 vColor;",
                    
                    "void main(void) {",
                    "    // Transform the vertex position by the projection matrix",
                    "    gl_Position = vec4((uProjectionMatrix * vec3(aVertex, 1.0)).xy, 0.0, 1.0);",
                    "    // Pass the remaining attributes to the fragment shader",
                    "    vColor = vec4(aColor.rgb * aColor.a, aColor.a);",
                    "    vRegion = aRegion;",
                    "}"
                ].join("\n"),
                [   // fragment
                    "uniform sampler2D uSampler;",
                    "varying vec4 vColor;",
                    "varying vec2 vRegion;",
                    "void main(void) {",
                    "    gl_FragColor = texture2D(uSampler, vRegion) * vColor;",
                    "}"
                ].join("\n")
            ]);
            return this;
        }
    });
})();
