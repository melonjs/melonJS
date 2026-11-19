/**
 * A tile layer drawn where its ancestors put it, on WebGL, with the GPU
 * path: see `helpers/tile-layer-placement-checks.js`.
 */
import { video } from "../src/index.js";
import { placementChecks } from "./helpers/tile-layer-placement-checks.js";

placementChecks(video.WEBGL, "WebGL", ["perTile", "shader", "prerender"]);
