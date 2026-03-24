import * as device from "./../system/device";
import type Application from "./application.ts";

/**
 * scale the "displayed" canvas by the given scalar.
 * this will modify the size of canvas element directly.
 * Only use this if you are not using the automatic scaling feature.
 * @param game - the game application instance triggering the resize
 * @param x - x scaling multiplier
 * @param y - y scaling multiplier
 */
function scale(game: Application, x: number, y: number): void {
	const renderer = game.renderer;
	const canvas = renderer.getCanvas();
	const context = renderer.getContext();
	const settings = renderer.settings as any;
	const pixelRatio = device.devicePixelRatio;

	const w = (settings.zoomX = canvas.width * x * pixelRatio);
	const h = (settings.zoomY = canvas.height * y * pixelRatio);

	// update the global scale variable
	renderer.scaleRatio.set(x * pixelRatio, y * pixelRatio);

	// adjust CSS style based on device pixel ratio
	canvas.style.width = `${w / pixelRatio}px`;
	canvas.style.height = `${h / pixelRatio}px`;

	// if anti-alias and blend mode were reset (e.g. Canvas mode)
	renderer.setAntiAlias(settings.antiAlias);
	(renderer as any).setBlendMode(settings.blendMode, context);

	// force repaint
	game.repaint();
}

/**
 * callback for window resize event
 * @param game - the game application instance triggering the resize
 */
export function onresize(game: Application): void {
	const renderer = game.renderer;
	const settings = renderer.settings as any;
	let scaleX = settings.scale,
		scaleY = settings.scale;
	let nodeBounds;

	if (settings.autoScale) {
		// set max the canvas max size if CSS values are defined
		let canvasMaxWidth = Infinity;
		let canvasMaxHeight = Infinity;

		if (globalThis.getComputedStyle) {
			const style = globalThis.getComputedStyle(renderer.getCanvas(), null);
			canvasMaxWidth = parseInt(style.maxWidth, 10) || Infinity;
			canvasMaxHeight = parseInt(style.maxHeight, 10) || Infinity;
		}

		if (typeof game.settings.scaleTarget !== "undefined") {
			// get the bounds of the given scale target
			nodeBounds = device.getElementBounds(game.settings.scaleTarget);
		} else {
			// get the maximum canvas size within the parent div containing the canvas container
			nodeBounds = device.getParentBounds(game.getParentElement());
		}

		const _max_width = Math.min(canvasMaxWidth, nodeBounds.width);
		const _max_height = Math.min(canvasMaxHeight, nodeBounds.height);

		// calculate final canvas width & height
		const screenRatio = _max_width / _max_height;

		if (
			(settings.scaleMethod === "fill-min" &&
				screenRatio > renderer.designRatio) ||
			(settings.scaleMethod === "fill-max" &&
				screenRatio < renderer.designRatio) ||
			settings.scaleMethod === "flex-width"
		) {
			// resize the display canvas to fill the parent container
			const sWidth = Math.min(canvasMaxWidth, settings.height * screenRatio);
			scaleX = scaleY = _max_width / sWidth;
			renderer.resize(Math.floor(sWidth), settings.height);
		} else if (
			(settings.scaleMethod === "fill-min" &&
				screenRatio < renderer.designRatio) ||
			(settings.scaleMethod === "fill-max" &&
				screenRatio > renderer.designRatio) ||
			settings.scaleMethod === "flex-height"
		) {
			// resize the display canvas to fill the parent container
			const sHeight = Math.min(
				canvasMaxHeight,
				settings.width * (_max_height / _max_width),
			);
			scaleX = scaleY = _max_height / sHeight;
			renderer.resize(settings.width, Math.floor(sHeight));
		} else if (settings.scaleMethod === "flex") {
			// resize the display canvas to fill the parent container
			renderer.resize(Math.floor(_max_width), Math.floor(_max_height));
		} else if (settings.scaleMethod === "stretch") {
			// scale the display canvas to fit with the parent container
			scaleX = _max_width / settings.width;
			scaleY = _max_height / settings.height;
		} else {
			// scale the display canvas to fit the parent container
			// make sure we maintain the original aspect ratio
			if (screenRatio < renderer.designRatio) {
				scaleX = scaleY = _max_width / settings.width;
			} else {
				scaleX = scaleY = _max_height / settings.height;
			}
		}
	}
	// adjust scaling ratio
	scale(game, scaleX, scaleY);
}
