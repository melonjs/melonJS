(function () {

    /**
     * a built-in shader used by the Compositor for primitive drawing
     * @class
     * @extends me.GLShader
     * @see me.WebGLRenderer.Compositor
     * @constructor
     * @param {WebGLRenderingContext} gl the current WebGL rendering context
     */
    me.PrimitiveGLShader = me.GLShader.extend({
        /**
         * @ignore
         */
        init : function (gl) {
            this._super(me.GLShader, "init", [ gl,
                [   // vertex`
                    "precision highp float;",

                    "// Current vertex point",
                    "attribute vec2 aVertex;",

                    "// Projection matrix",
                    "uniform mat3 uProjectionMatrix;",

                    "// Vertex color",
                    "uniform vec4 uColor;",

                    "// Fragment color",
                    "varying vec4 vColor;",

                    "void main(void) {",
                    "    // Transform the vertex position by the projection matrix",
                    "    gl_Position = vec4((uProjectionMatrix * vec3(aVertex, 1.0)).xy, 0.0, 1.0);",
                    "    // Pass the remaining attributes to the fragment shader",
                    "    vColor = vec4(uColor.rgb * uColor.a, uColor.a);",
                    "}"
                ].join("\n"),
                [   // fragment
                    "// fragment color",
                    "varying vec4 vColor;",

                    "void main(void) {",
                    "    gl_FragColor = vColor;",
                    "}"
                ].join("\n")
            ]);
            return this;
        }
    });
})();
