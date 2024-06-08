/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
var quadVertex = "// Current vertex point\nattribute vec2 aVertex;\nattribute vec2 aRegion;\nattribute vec4 aColor;\n\n// Projection matrix\nuniform mat4 uProjectionMatrix;\n\nvarying vec2 vRegion;\nvarying vec4 vColor;\n\nvoid main(void) {\n    // Transform the vertex position by the projection matrix\n    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);\n    // Pass the remaining attributes to the fragment shader\n    vColor = vec4(aColor.bgr * aColor.a, aColor.a);\n    vRegion = aRegion;\n}\n";

export { quadVertex as default };
