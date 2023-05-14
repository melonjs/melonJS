/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * where all preloaded content is cached
 */

// contains all the images loaded
let imgList = {};

// contains all the TMX loaded
let tmxList = {};

// contains all the binary files loaded
let binList = {};

// contains all the JSON files
let jsonList = {};

export { binList, imgList, jsonList, tmxList };
