/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
var quadFragment = "uniform sampler2D uSampler;\nvarying vec4 vColor;\nvarying vec2 vRegion;\n\nvoid main(void) {\n    gl_FragColor = texture2D(uSampler, vRegion) * vColor;\n}\n";

export { quadFragment as default };
