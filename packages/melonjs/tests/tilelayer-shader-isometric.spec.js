/**
 * Isometric tile layers on the GPU, on WebGL: see
 * `helpers/tile-layer-isometric-scenarios.js`.
 */
import { video } from "../src/index.js";
import { isometricScenarios } from "./helpers/tile-layer-isometric-scenarios.js";

isometricScenarios(video.WEBGL, "WebGL");
