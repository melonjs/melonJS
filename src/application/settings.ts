/**
 * additional import for TypeScript
 * @import Renderer from "./../video/renderer.js";
 */

import { RendererType } from "../const";
import Renderer from "../video/renderer";
import Compositor from "../video/webgl/compositors/compositor";
import { ScaleMethod } from "./scaleMethods";

type BlendMode = "normal" | "multiply" | "lighter" | "additive" | "screen";

type PhysicsType = "builtin" | "none";

type PowerPreference = "default" | "low-power";

type DepthTest = "sorting" | "z-buffer";

export type ApplicationSettings = {
	/**
	 * renderer to use (CANVAS, WEBGL, AUTO), or a custom renderer class
	 * @default AUTO
	 */
	renderer: RendererType | Renderer;

	/**
	 * enable scaling of the canvas ('auto' for automatic scaling)
	 * @default 1
	 */
	scale: number | "auto";

	/**
	 * screen scaling modes
	 * @default fit
	 */
	scaleMethod: ScaleMethod;

	/**
	 * the HTML Element to be used as the reference target when using automatic scaling (by default melonJS will use the parent container of the div element containing the canvas)
	 */
	scaleTarget: HTMLElement;

	/**
	 * if true the renderer will only use WebGL 1
	 * @default false
	 */
	preferWebGL1: boolean;

	/**
	 * ~Experimental~ the default method to sort object on the z axis in WebGL
	 * @default sorting
	 */
	depthTest: DepthTest;

	/**
	 * a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context. To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
	 * @default default
	 */
	powerPreference: PowerPreference;

	/**
	 * whether to allow transparent pixels in the front buffer (screen).
	 * @default false
	 */
	transparent: boolean;

	/**
	 * whether to enable or not video scaling interpolation
	 * @default false
	 */
	antiAlias: boolean;

	/**
	 * whether to display melonJS version and basic device information in the console
	 * @default true
	 */
	consoleHeader: boolean;
	blendMode: BlendMode;

	/**
	 * the physic system to use (default: "builtin", or "none" to disable builtin physic)
	 * @default "builtin"
	 */
	physic: PhysicsType;
	failIfMajorPerformanceCaveat: boolean;
	subPixel: boolean;
	verbose: boolean;
	legacy: boolean;

	/**
	 * a custom compositor class (WebGL only)
	 */
	compositor?: Compositor | undefined;
} & (
	| {
			// the DOM parent element to hold the canvas in the HTML file
			parent: HTMLElement;
			canvas?: never;
	  }
	| {
			parent?: never;
			// an existing canvas element to use as the renderer target (by default melonJS will create its own canvas based on given parameters)
			canvas: HTMLCanvasElement;
	  }
);
