import { parseDDS } from "./parseDDS.js";
import { parseKTX } from "./parseKTX.js";
import { parseKTX2 } from "./parseKTX2.js";
import { parsePVR } from "./parsePVR.js";
import { parsePKM } from "./parsePKM.js";
import * as event from "../../../system/event.js";

let _renderer;

// gracefully capture a reference to the active renderer without adding more cyclic redundancy
event.once(event.VIDEO_INIT, (renderer) => {
    _renderer = renderer;
});


export function parseCompressedImage(arrayBuffer, imgExt) {
    let texture;

    // check if the current renderer is WebGL
    if (_renderer.type.includes("WebGL")) {
        switch (imgExt) {
            // Compressed texture
            case "dds":
                texture = parseDDS(arrayBuffer);
                break;
            case "pvr":
                texture = parsePVR(arrayBuffer);
                break;
            case "pkm":
                texture = parsePKM(arrayBuffer);
                break;
            case "ktx":
                texture = parseKTX(arrayBuffer);
                break;
            case "ktx2":
                texture = parseKTX2(arrayBuffer);
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
