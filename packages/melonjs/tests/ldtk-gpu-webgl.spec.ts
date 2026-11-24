import { video } from "../src/index.js";
import { gpuChecks } from "./helpers/ldtk-gpu-checks.ts";

gpuChecks(video.WEBGL, "WebGL", 2);
