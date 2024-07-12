import { AUTO } from "../const";
import { ScaleMethods } from "./scaleMethods";
import { ApplicationSettings } from "./settings";

export const defaultApplicationSettings = {
	renderer: AUTO,
	scale: 1.0,
	scaleMethod: ScaleMethods.Manual,
	preferWebGL1: false,
	depthTest: "sorting",
	powerPreference: "default",
	transparent: false,
	antiAlias: false,
	consoleHeader: !("__vitest_browser__" in window),
	blendMode: "normal",
	physic: "builtin",
	failIfMajorPerformanceCaveat: true,
	subPixel: false,
	verbose: false,
	legacy: false,
} satisfies Partial<ApplicationSettings>;
