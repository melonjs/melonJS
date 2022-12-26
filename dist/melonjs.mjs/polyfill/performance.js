/*!
 * melonJS Game Engine - v14.1.3
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
if ("performance" in globalThis === false) {
    globalThis.performance = {};
}

Date.now = (Date.now || function () {  // thanks IE8
    return new Date().getTime();
});

if ("now" in globalThis.performance === false) {

    let nowOffset = Date.now();

    if (performance.timing && performance.timing.navigationStart) {
      nowOffset = performance.timing.navigationStart;
    }

    globalThis.performance.now = function now() {
      return Date.now() - nowOffset;
  };
}
