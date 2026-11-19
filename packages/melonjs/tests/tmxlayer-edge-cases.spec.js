/**
 * Tile layers at their edges, on WebGL: see
 * `helpers/tile-layer-edge-cases.js`.
 */
import { video } from "../src/index.js";
import { edgeCases } from "./helpers/tile-layer-edge-cases.js";

edgeCases(video.WEBGL, "WebGL");
