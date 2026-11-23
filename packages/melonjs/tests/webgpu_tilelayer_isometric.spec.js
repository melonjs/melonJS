/**
 * Isometric tile layers on the GPU, on WebGPU: see
 * `helpers/tile-layer-isometric-scenarios.js`. Skipped, visibly, where the
 * browser has no WebGPU adapter.
 */
import { video } from "../src/index.js";
import { isometricScenarios } from "./helpers/tile-layer-isometric-scenarios.js";

isometricScenarios(video.WEBGPU, "WebGPU");
