/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
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

// contains all the video files
let videoList = {};

// contains all the font files
let fontList = {};

export { binList, fontList, imgList, jsonList, tmxList, videoList };
