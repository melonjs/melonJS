/**
 * A tile layer drawn where its ancestors put it, on WebGPU: see
 * `helpers/tile-layer-placement-checks.js`. Skipped where the browser has
 * no WebGPU adapter.
 */
import { video } from "../src/index.js";
import { placementChecks } from "./helpers/tile-layer-placement-checks.js";

placementChecks(video.WEBGPU, "WebGPU", ["perTile", "shader", "prerender"]);
