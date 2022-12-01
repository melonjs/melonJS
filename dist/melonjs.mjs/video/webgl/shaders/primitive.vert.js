/*!
 * melonJS Game Engine - v14.1.2
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
var primitiveVertex = "// Current vertex point\nattribute vec2 aVertex;\n\n// Projection matrix\nuniform mat4 uProjectionMatrix;\n\n// Vertex color\nuniform vec4 uColor;\n\n// Fragment color\nvarying vec4 vColor;\n\nvoid main(void) {\n    // Transform the vertex position by the projection matrix\n    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);\n    // Pass the remaining attributes to the fragment shader\n    vColor = vec4(uColor.rgb * uColor.a, uColor.a);\n}\n";

export { primitiveVertex as default };
