/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
var primitiveVertex = "// Current vertex point\nattribute vec2 aVertex;\nattribute vec4 aColor;\n\n// Projection matrix\nuniform mat4 uProjectionMatrix;\n\nvarying vec4 vColor;\n\nvoid main(void) {\n    // Transform the vertex position by the projection matrix\n    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);\n    // Pass the remaining attributes to the fragment shader\n    vColor = vec4(aColor.bgr * aColor.a, aColor.a);\n}\n";

export { primitiveVertex as default };
