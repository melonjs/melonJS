/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { parseDDS } from './parseDDS.js';
import { parseKTX } from './parseKTX.js';
import { parseKTX2 } from './parseKTX2.js';
import { parsePVR } from './parsePVR.js';
import { parsePKM } from './parsePKM.js';
import { once, VIDEO_INIT } from '../../../system/event.js';

let _renderer;

// gracefully capture a reference to the active renderer without adding more cyclic redundancy
once(VIDEO_INIT, (renderer) => {
    _renderer = renderer;
});


function parseCompressedImage(arrayBuffer, imgExt) {
    let texture;

    // check if the current renderer is WebGL
    if (_renderer.type.includes("WebGL")) {
        switch (imgExt) {
            // Compressed texture
            case "dds":
                texture = parseDDS();
                break;
            case "pvr":
                texture = parsePVR();
                break;
            case "pkm":
                texture = parsePKM();
                break;
            case "ktx":
                texture = parseKTX();
                break;
            case "ktx2":
                texture = parseKTX2();
                break;
        }
    }

    if (typeof texture !== "undefined") {
        if (_renderer.hasSupportedCompressedFormats(texture.format)) {
            console.log("Compressed texture format supported: " + texture.format);
            return texture;
        }
    }

    throw ("unsupported texture format:" + imgExt + texture ? " (" + texture.format + ")" : "");
}

export { parseCompressedImage };
