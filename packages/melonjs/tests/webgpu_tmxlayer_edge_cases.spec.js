/**
 * Tile layers at their edges, on WebGPU: see
 * `helpers/tile-layer-edge-cases.js`. Skipped where the browser has no
 * WebGPU adapter.
 */
import { video } from "../src/index.js";
import { edgeCases } from "./helpers/tile-layer-edge-cases.js";

edgeCases(video.WEBGPU, "WebGPU");
