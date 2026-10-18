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
	renderer.setBlendMode(settings.blendMode);

	// force repaint
	game.repaint();
}

/**
 * The largest scale at or below `scale` that covers each source pixel with a
 * WHOLE number of device pixels.
 *
 * Rounded down, and rounded in DEVICE pixels rather than CSS ones. That
 * distinction is the whole of it: the canvas is given a CSS size and the
 * browser multiplies by `devicePixelRatio` on the way to real pixels, so
 * flooring the CSS factor lets the fraction come straight back. A factor of
 * 2 at a ratio of 1.25 is 2.5 device pixels per source pixel, which is the
 * unevenness the setting exists to remove.
 *
 * Worked through at a ratio of 2, fitting a 480 wide design into 1280: the
 * raw factor is 2.667 CSS, which is 5.333 device pixels. Flooring here gives
 * 5 device pixels, so a CSS factor of 2.5. Flooring the CSS factor instead
 * would give 2, which is 4 device pixels: also whole, and a whole device
 * pixel smaller than the container could have afforded.
 *
 * Never returns less than one device pixel per source pixel. A container
 * smaller than the design resolution has no whole factor to give, and a
 * scale of zero does not draw at all.
 * @param scale - the unconstrained factor, in CSS pixels
 * @param ratio - `devicePixelRatio`
 * @returns the constrained factor, still in CSS pixels
 */
export function integerDeviceScale(scale: number, ratio: number): number {
	return Math.max(1, Math.floor(scale * ratio)) / ratio;
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

		let measuredElement;
		if (typeof game.settings.scaleTarget !== "undefined") {
			// get the bounds of the given scale target
			measuredElement = game.settings.scaleTarget;
			nodeBounds = device.getElementBounds(measuredElement);
		} else {
			// get the maximum canvas size within the parent div containing the canvas container
			measuredElement = device.getParentElement(game.getParentElement());
			nodeBounds = device.getElementBounds(measuredElement);
		}

		let availWidth = nodeBounds.width;
		let availHeight = nodeBounds.height;
		// The space available to a child is the measured element's CONTENT
		// box; `getBoundingClientRect` returns the border box. On an
		// auto-sized container the difference (padding + border) gets baked
		// into the canvas size and re-measured on the next pass — growing
		// the canvas by that amount on every resize event (#1231). The
		// window-fallback path (string target / document.body) has no
		// padding concept and is left untouched.
		if (
			typeof measuredElement === "object" &&
			typeof globalThis.getComputedStyle === "function"
		) {
			const style = globalThis.getComputedStyle(measuredElement);
			availWidth -=
				(parseFloat(style.paddingLeft) || 0) +
				(parseFloat(style.paddingRight) || 0) +
				(parseFloat(style.borderLeftWidth) || 0) +
				(parseFloat(style.borderRightWidth) || 0);
			availHeight -=
				(parseFloat(style.paddingTop) || 0) +
				(parseFloat(style.paddingBottom) || 0) +
				(parseFloat(style.borderTopWidth) || 0) +
				(parseFloat(style.borderBottomWidth) || 0);
		}

		const _max_width = Math.min(canvasMaxWidth, Math.max(0, availWidth));
		const _max_height = Math.min(canvasMaxHeight, Math.max(0, availHeight));

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
			if (settings.scaleRounding === "integer") {
				scaleX = scaleY = integerDeviceScale(scaleX, device.devicePixelRatio);
			}
		}
	}
	// adjust scaling ratio
	scale(game, scaleX, scaleY);
}
