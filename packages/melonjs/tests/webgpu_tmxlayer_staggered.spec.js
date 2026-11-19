/**
 * Staggered and hexagonal tile layers on the GPU, on WebGPU: see
 * `helpers/tile-layer-staggered-scenarios.js`. Skipped, visibly, where the
 * browser has no WebGPU adapter.
 */
import { video } from "../src/index.js";
import { staggeredScenarios } from "./helpers/tile-layer-staggered-scenarios.js";

staggeredScenarios(video.WEBGPU, "WebGPU");
