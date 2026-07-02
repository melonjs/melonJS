/**
 * where all preloaded content is cached
 */

// contains all the images loaded
export const imgList = {};

// contains all the TMX loaded
export const tmxList = {};

// contains all the binary files loaded
export const binList = {};

// contains all the JSON files
export const jsonList = {};

// contains all the video files
export const videoList = {};

// contains all the font files
export const fontList = {};

// contains all the OBJ model files
export const objList = {};

// contains all the MTL material files
export const mtlList = {};

// contains all the parsed glTF/GLB scene descriptors
export const gltfList = {};

// contains all the preloaded shader assets, keyed by name → the shared,
// precompiled ShaderEffect (compiled at load time; video.init is an
// inherent precondition of the preload flow)
export const shaderList = {};
