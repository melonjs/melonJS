(function () {

    /**
     * a built-in shader used by the Compositor for Quad Texture drawing
     * @class
     * @extends me.GLShader
     * @see me.WebGLRenderer.Compositor
     * @constructor
     * @param {WebGLRenderingContext} gl the current WebGL rendering context
     */
    me.QuadGLShader = me.GLShader.extend({
        /**
         * @ignore
         */
        init : function (gl) {
            this._super(me.GLShader, "init", [ gl,
                [   // vertex`
                    "attribute vec2 aVertex;",
                    "attribute vec2 aRegion;",
                    "attribute vec4 aColor;",

                    "uniform mat4 uProjectionMatrix;",

                    "varying vec2 vRegion;",
                    "varying vec4 vColor;",

                    "void main(void) {",
                    "    // Transform the vertex position by the projection matrix",
                    "     gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);",
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
