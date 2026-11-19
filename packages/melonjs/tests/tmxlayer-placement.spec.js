/**
 * A tile layer drawn where its ancestors put it, on the Canvas renderer:
 * see `helpers/tile-layer-placement-checks.js`.
 */
import { video } from "../src/index.js";
import { placementChecks } from "./helpers/tile-layer-placement-checks.js";

placementChecks(video.CANVAS, "CANVAS", ["perTile", "prerender"]);
