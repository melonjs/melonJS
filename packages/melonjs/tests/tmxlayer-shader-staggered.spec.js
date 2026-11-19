/**
 * Staggered and hexagonal tile layers on the GPU, on WebGL: see
 * `helpers/tile-layer-staggered-scenarios.js`.
 */
import { video } from "../src/index.js";
import { staggeredScenarios } from "./helpers/tile-layer-staggered-scenarios.js";

staggeredScenarios(video.WEBGL, "WebGL");
