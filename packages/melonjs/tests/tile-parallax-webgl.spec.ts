import { video } from "../src/index.js";
import { parallaxChecks } from "./helpers/tile-parallax-checks.ts";

parallaxChecks(video.WEBGL, "WebGL", 2, 0.02);
