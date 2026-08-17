import { AUTO } from "../const";
import { ScaleMethods } from "./scaleMethods";
import { ApplicationSettings } from "./settings";

export const defaultApplicationSettings = {
	renderer: AUTO,
	scale: 1.0,
	scaleMethod: ScaleMethods.Manual,
	powerPreference: "default",
	transparent: false,
	antiAlias: false,
	textureFilter: "auto",
	maxTextures: "auto",
	castGroundShadow: true,
	consoleHeader: true,
	blendMode: "normal",
	physic: "builtin",
	gpuTilemap: true,
	failIfMajorPerformanceCaveat: true,
	highPrecisionShader: true,
	subPixel: false,
	verbose: false,
	backgroundColor: "#000000",
} satisfies Partial<ApplicationSettings>;
