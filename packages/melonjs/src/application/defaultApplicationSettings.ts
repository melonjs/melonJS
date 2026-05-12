import { AUTO } from "../const";
import { ScaleMethods } from "./scaleMethods";
import { ApplicationSettings } from "./settings";

export const defaultApplicationSettings = {
	renderer: AUTO,
	scale: 1.0,
	scaleMethod: ScaleMethods.Manual,
	preferWebGL1: false,
	powerPreference: "default",
	transparent: false,
	antiAlias: false,
	consoleHeader: true,
	blendMode: "normal",
	physic: "builtin",
	gpuTilemap: true,
	failIfMajorPerformanceCaveat: true,
	highPrecisionShader: true,
	subPixel: false,
	verbose: false,
	legacy: false,
	backgroundColor: "#000000",
} satisfies Partial<ApplicationSettings>;
